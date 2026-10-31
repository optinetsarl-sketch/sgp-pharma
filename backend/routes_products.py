from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pymongo import ReturnDocument
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import Product, ProductBase, Category, CategoryBase, gen_id, now_utc
from sync_service import register_tombstone

router = APIRouter(prefix="/api", tags=["products"])


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    db = get_db()
    items = await db.categories.find(pharmacy_scope(user), {"_id": 0}).to_list(1000)
    return items


@router.post("/categories")
async def create_category(data: CategoryBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    doc = {"id": gen_id(), "name": data.name}
    stamp_pharmacy(user, doc)
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "category.create", "category", doc["id"], {"name": data.name})
    return doc


@router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    cat = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Catégorie non trouvée")
    assert_same_pharmacy(user, cat)
    new_name = data.name.strip()
    if not new_name:
        raise HTTPException(400, "Le nom de la catégorie ne peut pas être vide")
    await db.categories.update_one({"id": cid}, {"$set": {"name": new_name, "_synced": False}})
    await log_audit(user, "category.update", "category", cid, {"old_name": cat.get("name"), "new_name": new_name})
    return {"id": cid, "name": new_name}


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    cat = await db.categories.find_one({"id": cid}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Catégorie non trouvée")
    assert_same_pharmacy(user, cat)
    # Detach products from this category so no orphaned constraints
    await db.products.update_many({"categorie_id": cid}, {"$set": {"categorie_id": None}})
    await db.categories.delete_one({"id": cid})
    await register_tombstone(db, "categories", cid)
    await log_audit(user, "category.delete", "category", cid, {"name": cat.get("name")})
    return {"ok": True}


from datetime import date

# Products
@router.get("/products")
async def list_products(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_db()
    query = pharmacy_scope(user)
    if q:
        query = {**query, "$or": [
            {"nom_commercial": {"$regex": q, "$options": "i"}},
            {"dci": {"$regex": q, "$options": "i"}},
            {"code_barre": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.products.find(query, {"_id": 0}).sort("nom_commercial", 1).to_list(2000)
    # batch totals and FEFO earliest non-expired batch via aggregation
    pids = [p["id"] for p in items]
    if pids:
        today_iso = date.today().isoformat()
        agg = await db.batches.aggregate([
            {"$match": {
                "product_id": {"$in": pids},
                "status": "active",
                "current_quantity": {"$gt": 0},
                "expiry_date": {"$gte": today_iso}
            }},
            {"$sort": {"expiry_date": 1}},
            {"$group": {
                "_id": "$product_id",
                "total": {"$sum": "$current_quantity"},
                "earliest_expiry": {"$first": "$expiry_date"},
                "earliest_batch": {"$first": "$batch_number"},
                "batches_count": {"$sum": 1},
            }},
        ]).to_list(5000)
        tot = {a["_id"]: a for a in agg}
        for p in items:
            info = tot.get(p["id"], {})
            p["stock_total"] = info.get("total", 0)
            p["earliest_expiry"] = info.get("earliest_expiry", None)
            p["earliest_batch"] = info.get("earliest_batch", None)
            p["batches_count"] = info.get("batches_count", 0)
    return items


# ---------- Internal barcode generation (EAN-13, GS1 prefix "2" = in-store use) ----------
BARCODE_COUNTER_ID = "product_internal_barcode"


def ean13_check_digit(body12: str) -> str:
    """Compute the EAN-13 check digit for a 12-digit body."""
    total = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(body12))
    return str((10 - total % 10) % 10)


async def generate_internal_barcode(db, scope: dict) -> str:
    """Return a new unique internal EAN-13 code: '2' + 11-digit sequence + check digit.

    Uses an atomic MongoDB counter so two simultaneous requests never get the same number,
    and skips any value already used (e.g. typed manually) in the pharmacy.
    """
    for _ in range(1000):
        counter = await db.counters.find_one_and_update(
            {"_id": BARCODE_COUNTER_ID},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        body = "2" + str(counter["seq"]).zfill(11)
        code = body + ean13_check_digit(body)
        if not await db.products.find_one({**scope, "code_barre": code}, {"_id": 1}):
            return code
    raise HTTPException(500, "Impossible de générer un code-barre unique")


@router.get("/products/generate-barcode")
async def generate_barcode(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    return {"code_barre": await generate_internal_barcode(db, pharmacy_scope(user))}


@router.get("/products/{pid}")
async def get_product(pid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    assert_same_pharmacy(user, p)
    return p


@router.post("/products")
async def create_product(data: ProductBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    scope = pharmacy_scope(user)
    code = (data.code_barre or "").strip()
    if code:
        if await db.products.find_one({**scope, "code_barre": code}):
            raise HTTPException(400, "Code barre déjà existant pour cette pharmacie")
    else:
        code = await generate_internal_barcode(db, scope)
    data.code_barre = code
    doc = Product(**data.model_dump()).model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    stamp_pharmacy(user, doc)
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "product.create", "product", doc["id"], {"nom": data.nom_commercial})
    return doc


@router.put("/products/{pid}")
async def update_product(pid: str, data: ProductBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    assert_same_pharmacy(user, p)
    scope = pharmacy_scope(user)
    code = (data.code_barre or "").strip()
    if code:
        if await db.products.find_one({**scope, "code_barre": code, "id": {"$ne": pid}}):
            raise HTTPException(400, "Code barre déjà existant pour cette pharmacie")
    else:
        # Field cleared: keep the existing code, or generate one if the product never had any.
        code = p.get("code_barre") or await generate_internal_barcode(db, scope)
    data.code_barre = code
    await db.products.update_one({"id": pid}, {"$set": {**data.model_dump(), "_synced": False, "updated_at": now_utc().isoformat()}})
    await log_audit(user, "product.update", "product", pid)
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    assert_same_pharmacy(user, p)
    await db.products.delete_one({"id": pid})
    await register_tombstone(db, "products", pid)
    await log_audit(user, "product.delete", "product", pid)
    return {"ok": True}
