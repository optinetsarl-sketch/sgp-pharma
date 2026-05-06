from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import Product, ProductBase, Category, CategoryBase, gen_id, now_utc

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


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    cat = await db.categories.find_one({"id": cid}, {"_id": 0})
    assert_same_pharmacy(user, cat)
    await db.categories.delete_one({"id": cid})
    await log_audit(user, "category.delete", "category", cid)
    return {"ok": True}


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
    # batch totals via aggregation (avoid N+1)
    pids = [p["id"] for p in items]
    if pids:
        agg = await db.batches.aggregate([
            {"$match": {"product_id": {"$in": pids}, "status": "active"}},
            {"$group": {"_id": "$product_id", "total": {"$sum": "$current_quantity"}}},
        ]).to_list(5000)
        tot = {a["_id"]: a["total"] for a in agg}
        for p in items:
            p["stock_total"] = tot.get(p["id"], 0)
    return items


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
    if await db.products.find_one({**scope, "code_barre": data.code_barre}):
        raise HTTPException(400, "Code barre déjà existant pour cette pharmacie")
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
    await db.products.update_one({"id": pid}, {"$set": data.model_dump()})
    await log_audit(user, "product.update", "product", pid)
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    assert_same_pharmacy(user, p)
    await db.products.delete_one({"id": pid})
    await log_audit(user, "product.delete", "product", pid)
    return {"ok": True}
