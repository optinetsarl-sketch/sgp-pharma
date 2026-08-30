from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, date, timedelta, timezone
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import PresaleRequest, gen_id, now_utc

router = APIRouter(prefix="/api/presales", tags=["presales"])


@router.post("")
async def create_presale(payload: PresaleRequest, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "cashier", "operator"))):
    db = get_db()
    if not payload.items:
        raise HTTPException(400, "Panier de pré-vente vide")

    today_iso = date.today().isoformat()
    scope = pharmacy_scope(user)
    pharmacy_id = user.get("pharmacy_id")

    # Check products and calculate total
    total = 0.0
    items_detail = []

    for it in payload.items:
        if it.quantity <= 0:
            raise HTTPException(400, "Quantité invalide")

        product = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(404, f"Produit {it.product_id} non trouvé")
        assert_same_pharmacy(user, product)

        if product.get("requires_prescription") and not (payload.prescription_ref or payload.prescription_image):
            raise HTTPException(400, f"Ordonnance obligatoire pour {product['nom_commercial']}")

        unit_price = it.unit_price if it.unit_price is not None else product.get("prix_vente", 0)

        # Check total active available non-expired stock across batches
        batches = await db.batches.find({
            **scope,
            "product_id": it.product_id,
            "status": "active",
            "current_quantity": {"$gt": 0},
            "expiry_date": {"$gte": today_iso}
        }, {"_id": 0}).to_list(100)

        avail = sum(b["current_quantity"] for b in batches)
        if avail < it.quantity:
            raise HTTPException(400, f"Stock insuffisant pour {product['nom_commercial']} (Demandé: {it.quantity}, Dispo: {avail})")

        sub = round(it.quantity * unit_price, 2)
        total += sub

        items_detail.append({
            "product_id": it.product_id,
            "product_name": product.get("nom_commercial", it.product_name or ""),
            "code_barre": product.get("code_barre", ""),
            "dci": product.get("dci", ""),
            "quantity": it.quantity,
            "unit_price": unit_price,
            "subtotal": sub,
            "requires_prescription": product.get("requires_prescription", False)
        })

    # Generate sequential ticket number for today (e.g. PV-01, PV-02, ...)
    start_today = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
    today_count = await db.presales.count_documents({
        **scope,
        "created_at": {"$gte": start_today}
    })

    ticket_number = f"PV-{(today_count + 1):02d}"
    presale_id = gen_id()
    created_at = now_utc()
    expires_at = created_at + timedelta(minutes=90)  # Valid 90 minutes

    doc = {
        "id": presale_id,
        "ticket_number": ticket_number,
        "pharmacy_id": pharmacy_id,
        "operator_id": user["id"],
        "operator_name": user.get("name", "Opérateur"),
        "customer_name": payload.customer_name or "",
        "prescription_ref": payload.prescription_ref,
        "prescription_image": payload.prescription_image,
        "notes": payload.notes,
        "items": items_detail,
        "total_amount": round(total, 2),
        "status": "pending",
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "sale_id": None
    }

    stamp_pharmacy(user, doc)
    await db.presales.insert_one(doc)

    await log_audit(user, "presale.create", "presale", presale_id, {
        "ticket_number": ticket_number,
        "total": total,
        "items_count": len(items_detail)
    })

    doc.pop("_id", None)
    return {"ok": True, "presale": doc}


@router.get("/pending")
async def list_pending_presales(user: dict = Depends(get_current_user)):
    db = get_db()
    scope = pharmacy_scope(user)
    now_iso = now_utc().isoformat()

    # Find pending presales not yet expired
    cursor = db.presales.find({
        **scope,
        "status": "pending",
        "$or": [
            {"expires_at": None},
            {"expires_at": {"$gte": now_iso}}
        ]
    }, {"_id": 0}).sort("created_at", -1)

    items = await cursor.to_list(100)
    return items


@router.get("/{ticket_or_id}")
async def get_presale(ticket_or_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    scope = pharmacy_scope(user)
    raw_query = ticket_or_id.strip()

    # Try exact match on ID or ticket_number
    presale = await db.presales.find_one({
        **scope,
        "$or": [
            {"id": raw_query},
            {"ticket_number": raw_query.upper()},
            {"ticket_number": f"PV-{raw_query.upper()}"},
            {"ticket_number": f"PV-{int(raw_query):02d}" if raw_query.isdigit() else "___NONE___"}
        ]
    }, {"_id": 0})

    if not presale:
        raise HTTPException(404, f"Panier de pré-vente '{ticket_or_id}' non trouvé")

    return presale


@router.put("/{presale_id}/cancel")
async def cancel_presale(presale_id: str, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "cashier", "operator"))):
    db = get_db()
    scope = pharmacy_scope(user)

    presale = await db.presales.find_one({**scope, "id": presale_id}, {"_id": 0})
    if not presale:
        raise HTTPException(404, "Panier de pré-vente non trouvé")

    if presale["status"] != "pending":
        raise HTTPException(400, f"Ce panier ne peut plus être annulé (statut: {presale['status']})")

    await db.presales.update_one({"id": presale_id}, {"$set": {"status": "cancelled", "cancelled_at": now_utc().isoformat()}})
    await log_audit(user, "presale.cancel", "presale", presale_id, {"ticket": presale.get("ticket_number")})

    return {"ok": True, "message": "Panier annulé"}
