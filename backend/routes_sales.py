from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import SaleRequest, gen_id, now_utc

router = APIRouter(prefix="/api", tags=["sales"])


@router.post("/sales")
async def create_sale(payload: SaleRequest, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "cashier"))):
    db = get_db()
    if not payload.items:
        raise HTTPException(400, "Panier vide")

    today_iso = date.today().isoformat()
    sale_items = []
    rollback_ops = []
    total = 0.0
    scope = pharmacy_scope(user)

    try:
        for it in payload.items:
            if it.quantity <= 0:
                raise HTTPException(400, "Quantité invalide")
            product = await db.products.find_one({"id": it.product_id}, {"_id": 0})
            assert_same_pharmacy(user, product)

            if product.get("requires_prescription") and not (payload.prescription_ref or payload.prescription_image):
                raise HTTPException(400, f"Ordonnance requise pour {product['nom_commercial']}")

            unit_price = it.unit_price if it.unit_price is not None else product.get("prix_vente", 0)
            remaining = it.quantity

            cursor = db.batches.find(
                {
                    **scope,
                    "product_id": it.product_id,
                    "status": "active",
                    "current_quantity": {"$gt": 0},
                    "expiry_date": {"$gte": today_iso},
                },
                {"_id": 0},
            ).sort("expiry_date", 1)

            batches = await cursor.to_list(100)
            if not batches:
                raise HTTPException(400, f"Aucun lot disponible non-expiré pour {product['nom_commercial']}")

            for batch in batches:
                if remaining <= 0:
                    break
                take = min(remaining, batch["current_quantity"])
                res = await db.batches.update_one(
                    {"id": batch["id"], "current_quantity": {"$gte": take}},
                    {"$inc": {"current_quantity": -take}},
                )
                if res.modified_count == 0:
                    fresh = await db.batches.find_one({"id": batch["id"]}, {"_id": 0})
                    if not fresh or fresh["current_quantity"] <= 0:
                        continue
                    take = min(remaining, fresh["current_quantity"])
                    res = await db.batches.update_one(
                        {"id": batch["id"], "current_quantity": {"$gte": take}},
                        {"$inc": {"current_quantity": -take}},
                    )
                    if res.modified_count == 0:
                        continue

                rollback_ops.append((batch["id"], take))
                fresh_after = await db.batches.find_one({"id": batch["id"]}, {"_id": 0})
                if fresh_after and fresh_after["current_quantity"] == 0:
                    await db.batches.update_one({"id": batch["id"]}, {"$set": {"status": "depleted"}})

                sub = round(take * unit_price, 2)
                total += sub
                sale_items.append({
                    "product_id": it.product_id,
                    "batch_id": batch["id"],
                    "quantity": take,
                    "unit_price": unit_price,
                    "subtotal": sub,
                })
                remaining -= take

            if remaining > 0:
                raise HTTPException(400, f"Stock insuffisant pour {product['nom_commercial']}")

        sale_id = gen_id()
        operator_id = None
        operator_name = None
        if payload.presale_id:
            presale = await db.presales.find_one({"id": payload.presale_id}, {"_id": 0})
            if presale:
                operator_id = presale.get("operator_id")
                operator_name = presale.get("operator_name")
                await db.presales.update_one(
                    {"id": payload.presale_id},
                    {"$set": {"status": "completed", "sale_id": sale_id, "completed_at": now_utc().isoformat()}}
                )

        sale_doc = {
            "id": sale_id,
            "date": now_utc().isoformat(),
            "total_amount": round(total, 2),
            "payment_method": payload.payment_method,
            "prescription_ref": payload.prescription_ref,
            "prescription_image": payload.prescription_image,
            "customer_name": payload.customer_name,
            "user_id": user["id"],
            "operator_id": operator_id,
            "operator_name": operator_name,
            "presale_id": payload.presale_id,
            "items": sale_items,
        }
        stamp_pharmacy(user, sale_doc)
        await db.sales.insert_one(sale_doc)
        sale_doc.pop("_id", None)
        for si in sale_items:
            await db.stock_movements.insert_one({
                "id": gen_id(),
                "pharmacy_id": sale_doc["pharmacy_id"],
                "batch_id": si["batch_id"],
                "product_id": si["product_id"],
                "type": "SORTIE_VENTE",
                "quantity": -si["quantity"],
                "created_at": now_utc().isoformat(),
                "user_id": user["id"],
                "reference_id": sale_id,
                "notes": "Vente",
            })
        await log_audit(user, "sale.create", "sale", sale_id, {"total": total})
        return sale_doc

    except HTTPException:
        for bid, qty in rollback_ops:
            await db.batches.update_one({"id": bid}, {"$inc": {"current_quantity": qty}, "$set": {"status": "active"}})
        raise


@router.get("/sales")
async def list_sales(
    date_filter: Optional[str] = None,
    month_filter: Optional[str] = None,
    payment_method: Optional[str] = None,
    user_id: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
    user: dict = Depends(get_current_user)
):
    db = get_db()
    query = pharmacy_scope(user)

    if date_filter:
        query["date"] = {"$regex": f"^{date_filter}"}
    elif month_filter:
        query["date"] = {"$regex": f"^{month_filter}"}

    if payment_method and payment_method != "all":
        query["payment_method"] = payment_method

    if user_id and user_id != "all":
        query["user_id"] = user_id

    if q:
        raw_q = q.strip()
        clean_q = raw_q.lstrip("#").strip()
        query["$or"] = [
            {"customer_name": {"$regex": raw_q, "$options": "i"}},
            {"customer_name": {"$regex": clean_q, "$options": "i"}},
            {"id": {"$regex": clean_q, "$options": "i"}},
            {"prescription_ref": {"$regex": clean_q, "$options": "i"}},
        ]

    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(limit)

    # Enrich with users and product names
    uids = list({s["user_id"] for s in sales if s.get("user_id")})
    users_list = await db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
    user_map = {u["id"]: u.get("name", u.get("email", "Opérateur")) for u in users_list}

    all_pids = list({it["product_id"] for s in sales for it in s.get("items", [])})
    prods = await db.products.find({"id": {"$in": all_pids}}, {"_id": 0, "id": 1, "nom_commercial": 1, "dci": 1, "code_barre": 1}).to_list(2000)
    prod_map = {p["id"]: p for p in prods}

    for s in sales:
        s["cashier_name"] = user_map.get(s.get("user_id"), "Caissier")
        for it in s.get("items", []):
            prod = prod_map.get(it["product_id"], {})
            it["nom_commercial"] = prod.get("nom_commercial", "Médicament")
            it["dci"] = prod.get("dci", "")
            it["code_barre"] = prod.get("code_barre", "")

    return sales


@router.get("/sales/{sid}")
async def get_sale(sid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    s = await db.sales.find_one({"id": sid}, {"_id": 0})
    assert_same_pharmacy(user, s)
    return s


@router.get("/pos/preview-fefo")
async def preview_fefo(product_id: str, quantity: int, user: dict = Depends(get_current_user)):
    db = get_db()
    today_iso = date.today().isoformat()
    batches = await db.batches.find(
        {
            **pharmacy_scope(user),
            "product_id": product_id,
            "status": "active",
            "current_quantity": {"$gt": 0},
            "expiry_date": {"$gte": today_iso},
        },
        {"_id": 0},
    ).sort("expiry_date", 1).to_list(100)
    plan = []
    remaining = quantity
    for b in batches:
        if remaining <= 0:
            break
        take = min(remaining, b["current_quantity"])
        plan.append({"batch_id": b["id"], "batch_number": b["batch_number"], "expiry_date": b["expiry_date"], "take": take})
        remaining -= take
    return {"plan": plan, "fulfilled": remaining == 0, "missing": max(remaining, 0)}
