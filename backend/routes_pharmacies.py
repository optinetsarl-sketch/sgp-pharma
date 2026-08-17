"""Pharmacy (tenant) management & First-Run Universal Configuration."""
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import require_roles, get_current_user, log_audit
from models import Pharmacy, PharmacyBase, gen_id, now_utc
from tenant import is_super

router = APIRouter(prefix="/api", tags=["pharmacies"])


@router.get("/pharmacy/setup-status")
async def get_setup_status(user: dict = Depends(get_current_user)):
    """Check if the pharmacy is configured or if initial setup is needed."""
    db = get_db()
    pid = user.get("pharmacy_id")
    if pid:
        p = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    else:
        p = await db.pharmacies.find_one({}, {"_id": 0})

    if not p:
        return {"is_configured": False, "pharmacy": None}

    # If it has name, address and phone, it's considered configured
    configured = bool(p.get("is_configured") or (p.get("name") and p.get("phone") and p.get("address")))
    return {"is_configured": configured, "pharmacy": p}


@router.get("/pharmacy/current")
async def get_current_pharmacy(user: dict = Depends(get_current_user)):
    """Get the current logged-in user's pharmacy profile."""
    db = get_db()
    pid = user.get("pharmacy_id")
    if pid:
        p = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    else:
        p = await db.pharmacies.find_one({}, {"_id": 0})

    if not p:
        # Create a default initial record if totally empty
        default_p = Pharmacy(name="Ma Pharmacie", is_configured=False).model_dump()
        default_p["created_at"] = default_p["created_at"].isoformat()
        await db.pharmacies.insert_one(default_p)
        default_p.pop("_id", None)
        return default_p
    return p


@router.put("/pharmacy/current")
async def update_current_pharmacy(data: PharmacyBase, user: dict = Depends(require_roles("super_admin", "admin"))):
    """Update the current pharmacy profile (logo, coords, name, phone, etc.)."""
    db = get_db()
    pid = user.get("pharmacy_id")
    update_data = data.model_dump()
    update_data["is_configured"] = True

    if pid:
        res = await db.pharmacies.update_one({"id": pid}, {"$set": update_data})
        target_id = pid
    else:
        first = await db.pharmacies.find_one({})
        if first:
            target_id = first["id"]
            await db.pharmacies.update_one({"id": target_id}, {"$set": update_data})
        else:
            doc = Pharmacy(**update_data).model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.pharmacies.insert_one(doc)
            target_id = doc["id"]

    await log_audit(user, "pharmacy.setup_update", "pharmacy", target_id, {"name": data.name})
    return await db.pharmacies.find_one({"id": target_id}, {"_id": 0})


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
