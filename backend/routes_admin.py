import secrets
from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from database import get_db
from auth import get_current_user, require_roles, log_audit, hash_password
from tenant import pharmacy_scope, is_super, assert_same_pharmacy
from models import UserCreate, UserUpdate, gen_id, now_utc

router = APIRouter(prefix="/api", tags=["admin"])


# ---------- Dashboard ----------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    db = get_db()
    scope = pharmacy_scope(user)
    today_iso = date.today().isoformat()
    start_today = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
    start_month = datetime(date.today().year, date.today().month, 1, tzinfo=timezone.utc).isoformat()

    role = user.get("role")
    is_cashier = role == "cashier"
    is_storekeeper = role == "storekeeper"
    is_operator = role == "operator"
    is_restricted_finance = is_cashier or is_storekeeper or is_operator

    today_sales = await db.sales.find({**scope, "date": {"$gte": start_today}}, {"_id": 0}).to_list(5000)
    ca_today = sum(s["total_amount"] for s in today_sales) if not (is_storekeeper or is_operator) else 0
    nb_today = len(today_sales)
    nb_prescriptions_today = sum(1 for s in today_sales if s.get("prescription_ref") or s.get("prescription_image"))
    nb_presales_today = await db.presales.count_documents({**scope, "created_at": {"$gte": start_today}})

    if is_restricted_finance:
        ca_month = 0
        stock_value = 0
        if is_storekeeper or is_operator:
            agg = await db.batches.aggregate([
                {"$match": {**scope, "status": "active", "current_quantity": {"$gt": 0}}},
                {"$group": {"_id": None, "qty": {"$sum": "$current_quantity"}}}
            ]).to_list(1)
            stock_qty = agg[0]["qty"] if agg else 0
        else:
            stock_qty = 0
    else:
        month_sales = await db.sales.find({**scope, "date": {"$gte": start_month}}, {"_id": 0}).to_list(50000)
        ca_month = sum(s["total_amount"] for s in month_sales)

        agg = await db.batches.aggregate([
            {"$match": {**scope, "status": "active", "current_quantity": {"$gt": 0}}},
            {"$group": {"_id": None, "value": {"$sum": {"$multiply": ["$current_quantity", "$purchase_price"]}}, "qty": {"$sum": "$current_quantity"}}}
        ]).to_list(1)
        stock_value = agg[0]["value"] if agg else 0
        stock_qty = agg[0]["qty"] if agg else 0

    in_30 = (date.today() + timedelta(days=30)).isoformat()
    expired = await db.batches.count_documents({**scope, "current_quantity": {"$gt": 0}, "expiry_date": {"$lt": today_iso}})
    expiring_30 = await db.batches.count_documents({**scope, "current_quantity": {"$gt": 0}, "expiry_date": {"$gte": today_iso, "$lte": in_30}})

    # Low stock — single aggregation
    low_pipeline = [
        {"$match": {**scope, "status": "active"}},
        {"$group": {"_id": "$product_id", "total": {"$sum": "$current_quantity"}}},
    ]
    stock_by_product = {a["_id"]: a["total"] for a in await db.batches.aggregate(low_pipeline).to_list(5000)}
    products = await db.products.find(scope, {"_id": 0, "id": 1, "nom_commercial": 1, "seuil_alerte_stock": 1}).to_list(5000)
    low_stock = []
    for p in products:
        total = stock_by_product.get(p["id"], 0)
        if total <= p.get("seuil_alerte_stock", 10):
            low_stock.append({"product_id": p["id"], "nom_commercial": p["nom_commercial"], "stock": total, "seuil": p.get("seuil_alerte_stock", 10)})

    # 7-day chart in one pass
    chart = []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        d_start = datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
        d_end = datetime.combine(d, datetime.max.time()).replace(tzinfo=timezone.utc).isoformat()
        ds = await db.sales.find({**scope, "date": {"$gte": d_start, "$lte": d_end}}, {"_id": 0, "total_amount": 1, "lines": 1}).to_list(5000)
        qty_day = sum(sum(line.get("quantity", 0) for line in s.get("lines", [])) for s in ds)
        chart.append({
            "date": d.isoformat(),
            "total": sum(s["total_amount"] for s in ds) if not is_restricted_finance else 0,
            "count": len(ds),
            "qty": qty_day,
        })

    return {
        "ca_today": round(ca_today, 2) if not (is_storekeeper or is_operator) else None,
        "ca_month": round(ca_month, 2) if not is_restricted_finance else None,
        "nb_sales_today": nb_today,
        "nb_prescriptions_today": nb_prescriptions_today,
        "nb_presales_today": nb_presales_today,
        "stock_value": round(stock_value, 2) if not is_restricted_finance else None,
        "stock_qty": stock_qty if not is_cashier else None,
        "total_products": len(products),
        "alerts": {
            "expired": expired,
            "expiring_30": expiring_30,
            "low_stock_count": len(low_stock),
        },
        "low_stock": low_stock[:10],
        "chart_7d": chart,
    }


# ---------- Reports ----------
@router.get("/reports/sales")
async def report_sales(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    q = pharmacy_scope(user)
    if start:
        q = {**q, "date": {"$gte": start}}
    if end:
        q.setdefault("date", {})["$lte"] = end + "T23:59:59"
    sales = await db.sales.find(q, {"_id": 0}).sort("date", -1).to_list(20000)
    total = sum(s["total_amount"] for s in sales)
    return {"sales": sales, "count": len(sales), "total": round(total, 2)}


@router.get("/reports/top-products")
async def top_products(limit: int = 10, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    pipeline = [
        {"$match": pharmacy_scope(user)},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "qty": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.subtotal"}}},
        {"$sort": {"qty": -1}},
        {"$limit": limit},
    ]
    rows = await db.sales.aggregate(pipeline).to_list(limit)
    pids = [r["_id"] for r in rows]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "nom_commercial": 1}).to_list(100)
    pmap = {p["id"]: p["nom_commercial"] for p in products}
    return [{"product_id": r["_id"], "name": pmap.get(r["_id"], "?"), "qty": r["qty"], "revenue": round(r["revenue"], 2)} for r in rows]


@router.get("/reports/margins")
async def report_margins(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    """Single aggregation — no N+1."""
    db = get_db()
    pipeline = [
        {"$match": pharmacy_scope(user)},
        {"$unwind": "$items"},
        {"$lookup": {"from": "batches", "localField": "items.batch_id", "foreignField": "id", "as": "batch"}},
        {"$unwind": {"path": "$batch", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$items.product_id",
            "qty": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
            "cost": {"$sum": {"$multiply": ["$items.quantity", {"$ifNull": ["$batch.purchase_price", 0]}]}},
        }},
        {"$sort": {"revenue": -1}},
    ]
    rows = await db.sales.aggregate(pipeline).to_list(2000)
    pids = [r["_id"] for r in rows]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0}).to_list(2000)
    pmap = {p["id"]: p["nom_commercial"] for p in products}
    out = []
    for r in rows:
        margin = r["revenue"] - r["cost"]
        out.append({
            "product_id": r["_id"], "name": pmap.get(r["_id"], "?"),
            "qty": r["qty"], "revenue": round(r["revenue"], 2),
            "cost": round(r["cost"], 2), "margin": round(margin, 2),
            "margin_pct": round((margin / r["revenue"] * 100) if r["revenue"] else 0, 2),
        })
    return out


@router.get("/reports/summary")
async def report_summary(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    scope = pharmacy_scope(user)
    
    # 1. Sales filter
    q_sales = {**scope}
    if start:
        q_sales["date"] = {"$gte": start}
    if end:
        q_sales.setdefault("date", {})["$lte"] = end + "T23:59:59"

    sales = await db.sales.find(q_sales, {"_id": 0}).sort("date", -1).to_list(20000)
    total_sales_amount = sum(s["total_amount"] for s in sales)
    nb_sales = len(sales)
    nb_prescriptions = sum(1 for s in sales if s.get("prescription_ref") or s.get("prescription_image"))

    # Payment breakdown
    pay_methods = {"cash": 0.0, "mobile_money": 0.0, "card": 0.0, "insurance": 0.0, "other": 0.0}
    for s in sales:
        pm = s.get("payment_method", "cash")
        if pm in ["mobile_money", "tmoney", "flooz"]:
            pay_methods["mobile_money"] += s.get("total_amount", 0)
        elif pm == "cash":
            pay_methods["cash"] += s.get("total_amount", 0)
        elif pm == "card":
            pay_methods["card"] += s.get("total_amount", 0)
        elif pm == "insurance":
            pay_methods["insurance"] += s.get("total_amount", 0)
        else:
            pay_methods["other"] += s.get("total_amount", 0)

    # 2. Margins & Cost
    pipeline_margins = [
        {"$match": q_sales},
        {"$unwind": "$items"},
        {"$lookup": {"from": "batches", "localField": "items.batch_id", "foreignField": "id", "as": "batch"}},
        {"$unwind": {"path": "$batch", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$items.product_id",
            "qty": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
            "cost": {"$sum": {"$multiply": ["$items.quantity", {"$ifNull": ["$batch.purchase_price", 0]}]}},
        }},
        {"$sort": {"revenue": -1}},
    ]
    margin_rows = await db.sales.aggregate(pipeline_margins).to_list(500)
    pids = [r["_id"] for r in margin_rows]
    products = await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "nom_commercial": 1, "dci": 1, "forme": 1}).to_list(500)
    pmap = {p["id"]: p for p in products}

    total_cost = 0.0
    detailed_margins = []
    for r in margin_rows:
        rev = r["revenue"]
        c = r["cost"]
        m = rev - c
        total_cost += c
        p_info = pmap.get(r["_id"], {})
        detailed_margins.append({
            "product_id": r["_id"],
            "name": p_info.get("nom_commercial", "Médicament"),
            "dci": p_info.get("dci", ""),
            "forme": p_info.get("forme", ""),
            "qty": r["qty"],
            "revenue": round(rev, 2),
            "cost": round(c, 2),
            "margin": round(m, 2),
            "margin_pct": round((m / rev * 100) if rev else 0, 2),
        })

    total_gross_margin = total_sales_amount - total_cost
    overall_margin_pct = round((total_gross_margin / total_sales_amount * 100) if total_sales_amount else 0, 2)

    # 3. Top 10 Products
    top_10 = detailed_margins[:10]

    # 4. Stock valuation & health
    agg_stock = await db.batches.aggregate([
        {"$match": {**scope, "status": "active", "current_quantity": {"$gt": 0}}},
        {"$group": {"_id": None, "value": {"$sum": {"$multiply": ["$current_quantity", "$purchase_price"]}}, "qty": {"$sum": "$current_quantity"}}}
    ]).to_list(1)
    stock_value = agg_stock[0]["value"] if agg_stock else 0
    stock_qty = agg_stock[0]["qty"] if agg_stock else 0

    today_iso = date.today().isoformat()
    in_30 = (date.today() + timedelta(days=30)).isoformat()
    expired_batches = await db.batches.count_documents({**scope, "current_quantity": {"$gt": 0}, "expiry_date": {"$lt": today_iso}})
    expiring_30_batches = await db.batches.count_documents({**scope, "current_quantity": {"$gt": 0}, "expiry_date": {"$gte": today_iso, "$lte": in_30}})

    # 5. Losses summary
    q_losses = {**scope}
    if start:
        q_losses["created_at"] = {"$gte": start}
    if end:
        q_losses.setdefault("created_at", {})["$lte"] = end + "T23:59:59"
    losses = await db.losses.find(q_losses, {"_id": 0}).to_list(1000)
    total_losses_qty = sum(l.get("quantity", 0) for l in losses)
    total_losses_val = sum(l.get("loss_value", 0) for l in losses)

    return {
        "period": {"start": start, "end": end},
        "sales": {
            "total_revenue": round(total_sales_amount, 2),
            "nb_sales": nb_sales,
            "nb_prescriptions": nb_prescriptions,
            "avg_cart": round(total_sales_amount / nb_sales, 2) if nb_sales else 0,
            "payment_methods": {k: round(v, 2) for k, v in pay_methods.items()},
        },
        "profitability": {
            "total_revenue": round(total_sales_amount, 2),
            "total_cost": round(total_cost, 2),
            "gross_margin": round(total_gross_margin, 2),
            "margin_pct": overall_margin_pct,
        },
        "top_products": top_10,
        "margins": detailed_margins[:30],
        "inventory": {
            "stock_value": round(stock_value, 2),
            "stock_units": stock_qty,
            "expired_batches": expired_batches,
            "expiring_30_batches": expiring_30_batches,
        },
        "losses": {
            "count": len(losses),
            "total_units": total_losses_qty,
            "total_value": round(total_losses_val, 2),
        },
    }


# ---------- Users ----------
@router.get("/users")
async def list_users(user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    q = {} if is_super(user) else {"pharmacy_id": user.get("pharmacy_id")}
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)


@router.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email déjà utilisé")
    # Non-super admin must create users for their own pharmacy
    target_pharmacy = data.pharmacy_id if is_super(user) else user.get("pharmacy_id")
    # Forbid creating super_admin via UI for non-super
    if data.role == "super_admin" and not is_super(user):
        raise HTTPException(403, "Seul un super_admin peut créer un super_admin")
    doc = {
        "id": gen_id(),
        "email": email,
        "name": data.name,
        "role": data.role,
        "pharmacy_id": target_pharmacy if data.role != "super_admin" else None,
        "active": True,
        "password_hash": hash_password(data.password),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    await log_audit(user, "user.create", "user", doc["id"], {"email": email, "role": data.role})
    return doc


@router.put("/users/{uid}")
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if not is_super(user) and target.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(403, "Action non autorisée")
    upd = {k: v for k, v in data.model_dump(exclude_none=True).items() if k != "password"}
    if data.password:
        upd["password_hash"] = hash_password(data.password)
    if upd:
        await db.users.update_one({"id": uid}, {"$set": upd})
    await log_audit(user, "user.update", "user", uid, {"fields": list(upd.keys())})
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@router.post("/users/{uid}/reset-password")
async def reset_password(uid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    """Generate a temp password and update the user. Returns plaintext temp password (one-time)."""
    db = get_db()
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if not is_super(user) and target.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(403, "Action non autorisée")
    temp = secrets.token_urlsafe(8)  # ~10 char readable
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(temp)}})
    await log_audit(user, "user.reset_password", "user", uid)
    return {"temp_password": temp, "email": target["email"]}


@router.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    if uid == user["id"]:
        raise HTTPException(400, "Impossible de supprimer son propre compte")
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if not is_super(user) and target.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(403, "Action non autorisée")
    await db.users.delete_one({"id": uid})
    await log_audit(user, "user.delete", "user", uid)
    return {"ok": True}


# ---------- Audit logs ----------
@router.get("/audit-logs")
async def list_audit(limit: int = 200, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    q = {} if is_super(user) else {"pharmacy_id": user.get("pharmacy_id")}
    return await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
