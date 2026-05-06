"""Pharmacy (tenant) management — super_admin only."""
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import require_roles, log_audit
from models import Pharmacy, PharmacyBase, gen_id, now_utc
from tenant import is_super

router = APIRouter(prefix="/api", tags=["pharmacies"])


@router.get("/pharmacies")
async def list_pharmacies(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "cashier", "storekeeper"))):
    db = get_db()
    if is_super(user):
        items = await db.pharmacies.find({}, {"_id": 0}).to_list(500)
    else:
        items = await db.pharmacies.find({"id": user.get("pharmacy_id")}, {"_id": 0}).to_list(1)
    return items


@router.get("/pharmacies/{pid}")
async def get_pharmacy(pid: str, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist", "cashier", "storekeeper"))):
    db = get_db()
    if not is_super(user) and pid != user.get("pharmacy_id"):
        raise HTTPException(403, "Accès refusé")
    p = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pharmacie introuvable")
    return p


@router.post("/pharmacies")
async def create_pharmacy(data: PharmacyBase, user: dict = Depends(require_roles("super_admin"))):
    db = get_db()
    doc = Pharmacy(**data.model_dump()).model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.pharmacies.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "pharmacy.create", "pharmacy", doc["id"], {"name": data.name})
    return doc


@router.put("/pharmacies/{pid}")
async def update_pharmacy(pid: str, data: PharmacyBase, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    if not is_super(user) and pid != user.get("pharmacy_id"):
        raise HTTPException(403, "Accès refusé")
    res = await db.pharmacies.update_one({"id": pid}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Pharmacie introuvable")
    await log_audit(user, "pharmacy.update", "pharmacy", pid)
    return await db.pharmacies.find_one({"id": pid}, {"_id": 0})


@router.delete("/pharmacies/{pid}")
async def delete_pharmacy(pid: str, user: dict = Depends(require_roles("super_admin"))):
    db = get_db()
    await db.pharmacies.delete_one({"id": pid})
    await log_audit(user, "pharmacy.delete", "pharmacy", pid)
    return {"ok": True}
