from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import date, timedelta
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import (
    Supplier, SupplierBase, ReceptionRequest, LossRequest,
    PurchaseOrderRequest, PurchaseOrderStatus, gen_id, now_utc,
)

router = APIRouter(prefix="/api", tags=["inventory"])


# ---------- Suppliers ----------
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user)):
    db = get_db()
    return await db.suppliers.find(pharmacy_scope(user), {"_id": 0}).sort("raison_sociale", 1).to_list(500)


@router.post("/suppliers")
async def create_supplier(data: SupplierBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "storekeeper"))):
    db = get_db()
    doc = Supplier(**data.model_dump()).model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    stamp_pharmacy(user, doc)
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "supplier.create", "supplier", doc["id"])
    return doc


@router.put("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    s = await db.suppliers.find_one({"id": sid}, {"_id": 0})
    assert_same_pharmacy(user, s)
    await db.suppliers.update_one({"id": sid}, {"$set": data.model_dump()})
    await log_audit(user, "supplier.update", "supplier", sid)
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})


@router.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    s = await db.suppliers.find_one({"id": sid}, {"_id": 0})
    assert_same_pharmacy(user, s)
    await db.suppliers.delete_one({"id": sid})
    await log_audit(user, "supplier.delete", "supplier", sid)
    return {"ok": True}


# ---------- Batches ----------
@router.get("/batches")
async def list_batches(product_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = pharmacy_scope(user)
    if product_id:
        query = {**query, "product_id": product_id}
    items = await db.batches.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(2000)
    pids = list({b["product_id"] for b in items})
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "nom_commercial": 1, "code_barre": 1}).to_list(2000)
    pmap = {p["id"]: p for p in products}
    for b in items:
        prod = pmap.get(b["product_id"], {})
        b["product_name"] = prod.get("nom_commercial", "?")
        b["product_code"] = prod.get("code_barre", "")
    return items


@router.get("/batches/expiring")
async def expiring_batches(days: int = 90, user: dict = Depends(get_current_user)):
    db = get_db()
    today = date.today().isoformat()
    limit = (date.today() + timedelta(days=days)).isoformat()
    query = {**pharmacy_scope(user), "current_quantity": {"$gt": 0}, "expiry_date": {"$lte": limit}}
    items = await db.batches.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(500)
    pids = list({b["product_id"] for b in items})
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0}).to_list(2000)
    pmap = {p["id"]: p for p in products}
    for b in items:
        prod = pmap.get(b["product_id"], {})
        b["product_name"] = prod.get("nom_commercial", "?")
        b["expired"] = b["expiry_date"] < today
    return items


@router.post("/reception")
async def receive_stock(payload: ReceptionRequest, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "storekeeper"))):
    db = get_db()
    today = date.today()
    created = []
    for item in payload.items:
        if item.expiry_date < today:
            raise HTTPException(400, f"Lot {item.batch_number}: produit déjà expiré à la réception")
        if item.quantity <= 0:
            raise HTTPException(400, "Quantité doit être positive")
        prod = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        assert_same_pharmacy(user, prod)
        bid = gen_id()
        bdoc = {
            "id": bid,
            "product_id": item.product_id,
            "batch_number": item.batch_number,
            "expiry_date": item.expiry_date.isoformat(),
            "purchase_price": item.purchase_price,
            "initial_quantity": item.quantity,
            "current_quantity": item.quantity,
            "status": "active",
            "supplier_id": payload.supplier_id,
            "received_at": now_utc().isoformat(),
        }
        stamp_pharmacy(user, bdoc, prod.get("pharmacy_id"))
        await db.batches.insert_one(bdoc)
        await db.stock_movements.insert_one({
            "id": gen_id(),
            "pharmacy_id": bdoc["pharmacy_id"],
            "batch_id": bid,
            "product_id": item.product_id,
            "type": "ENTREE_ACHAT",
            "quantity": item.quantity,
            "created_at": now_utc().isoformat(),
            "user_id": user["id"],
            "reference_id": payload.purchase_order_id,
            "notes": f"Réception lot {item.batch_number}",
        })
        created.append(bid)
        await log_audit(user, "reception.create", "batch", bid, {"product_id": item.product_id, "qty": item.quantity})
    if payload.purchase_order_id:
        await db.purchase_orders.update_one({"id": payload.purchase_order_id}, {"$set": {"status": "received"}})
    return {"ok": True, "batch_ids": created}


@router.put("/batches/{bid}/block")
async def block_batch(bid: str, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    b = await db.batches.find_one({"id": bid}, {"_id": 0})
    assert_same_pharmacy(user, b)
    await db.batches.update_one({"id": bid}, {"$set": {"status": "blocked"}})
    await log_audit(user, "batch.block", "batch", bid)
    return {"ok": True}


# ---------- Stock movements ----------
@router.get("/stock-movements")
async def list_movements(product_id: Optional[str] = None, limit: int = 200, user: dict = Depends(get_current_user)):
    db = get_db()
    q = pharmacy_scope(user)
    if product_id:
        q = {**q, "product_id": product_id}
    return await db.stock_movements.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


# ---------- Losses ----------
@router.post("/losses")
async def declare_loss(payload: LossRequest, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    batch = await db.batches.find_one({"id": payload.batch_id}, {"_id": 0})
    assert_same_pharmacy(user, batch)
    if payload.quantity <= 0 or payload.quantity > batch["current_quantity"]:
        raise HTTPException(400, "Quantité invalide")
    new_qty = batch["current_quantity"] - payload.quantity
    new_status = "depleted" if new_qty == 0 else batch["status"]
    await db.batches.update_one({"id": payload.batch_id}, {"$set": {"current_quantity": new_qty, "status": new_status}})
    motif_map = {"peremption": "PERTE_PEREMPTION", "casse": "PERTE_CASSE", "vol": "PERTE_VOL"}
    lid = gen_id()
    await db.losses.insert_one({
        "id": lid,
        "pharmacy_id": batch["pharmacy_id"],
        "batch_id": payload.batch_id,
        "product_id": batch["product_id"],
        "quantity": payload.quantity,
        "motif": payload.motif,
        "notes": payload.notes,
        "user_id": user["id"],
        "created_at": now_utc().isoformat(),
    })
    await db.stock_movements.insert_one({
        "id": gen_id(),
        "pharmacy_id": batch["pharmacy_id"],
        "batch_id": payload.batch_id,
        "product_id": batch["product_id"],
        "type": motif_map[payload.motif],
        "quantity": -payload.quantity,
        "created_at": now_utc().isoformat(),
        "user_id": user["id"],
        "reference_id": lid,
        "notes": payload.notes,
    })
    await log_audit(user, "loss.create", "loss", lid, {"motif": payload.motif, "qty": payload.quantity})
    return {"ok": True, "id": lid}


@router.get("/losses")
async def list_losses(user: dict = Depends(get_current_user)):
    db = get_db()
    items = await db.losses.find(pharmacy_scope(user), {"_id": 0}).sort("created_at", -1).to_list(500)
    pids = list({l["product_id"] for l in items})
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "nom_commercial": 1}).to_list(2000)
    pmap = {p["id"]: p["nom_commercial"] for p in products}
    for l in items:
        l["product_name"] = pmap.get(l["product_id"], "?")
    return items


# ---------- Purchase orders ----------
@router.get("/purchase-orders")
async def list_orders(user: dict = Depends(get_current_user)):
    db = get_db()
    return await db.purchase_orders.find(pharmacy_scope(user), {"_id": 0}).sort("created_at", -1).to_list(500)


@router.get("/purchase-orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    o = await db.purchase_orders.find_one({"id": oid}, {"_id": 0})
    assert_same_pharmacy(user, o)
    return o


@router.post("/purchase-orders")
async def create_order(payload: PurchaseOrderRequest, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "storekeeper"))):
    db = get_db()
    total = sum(i.quantity * i.unit_price for i in payload.items)
    oid = gen_id()
    doc = {
        "id": oid,
        "supplier_id": payload.supplier_id,
        "items": [i.model_dump() for i in payload.items],
        "status": "draft",
        "total": total,
        "notes": payload.notes,
        "created_at": now_utc().isoformat(),
        "user_id": user["id"],
    }
    stamp_pharmacy(user, doc)
    await db.purchase_orders.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "purchase_order.create", "purchase_order", oid, {"total": total})
    return doc


@router.put("/purchase-orders/{oid}/status")
async def update_order_status(oid: str, status: PurchaseOrderStatus, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    o = await db.purchase_orders.find_one({"id": oid}, {"_id": 0})
    assert_same_pharmacy(user, o)
    await db.purchase_orders.update_one({"id": oid}, {"$set": {"status": status}})
    await log_audit(user, "purchase_order.status", "purchase_order", oid, {"status": status})
    return {"ok": True}
