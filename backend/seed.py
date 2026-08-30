"""Demo data seeder for SGP-Pharma — multi-tenant + CAMEG-style catalog."""
import os
from datetime import date, timedelta
from database import get_db
from auth import hash_password
from models import gen_id, now_utc
from cameg_products import CAMEG_PRODUCTS, CAMEG_CATEGORIES


DEFAULT_PHARMACY = {
    "name": "Pharmacie Centrale OPTINET",
    "address": "Quartier Agoè Cacavéli, Derrière la CEET, Lomé - Togo",
    "phone": "+228 90 74 84 65 / +228 99 05 84 71",
    "email": "optinetsarl@gmail.com",
    "license_number": "RCCM: TG-LFW-01-2026-B13-00831 — NIF: 1002114979",
    "currency": "FCFA",
    "active": True,
}

DEMO_USERS_PHARMACY = [
    {"email": "admin@sgp-pharma.tg", "name": "Admin Pharmacie", "role": "admin", "password": "Admin@2026"},
    {"email": "pharmacien@sgp-pharma.tg", "name": "Dr. Komla MENSAH", "role": "pharmacist", "password": "Pharma@2026"},
    {"email": "caissier@sgp-pharma.tg", "name": "Akossiwa AGBO", "role": "cashier", "password": "Cash@2026"},
    {"email": "magasinier@sgp-pharma.tg", "name": "Yao KPATCHA", "role": "storekeeper", "password": "Store@2026"},
    {"email": "vendeur@sgp-pharma.tg", "name": "Koffi MENSAH", "role": "operator", "password": "Vendeur@2026"},
]

DEMO_SUPPLIERS = [
    {"raison_sociale": "CAMEG Togo", "contact": "Direction CAMEG", "email": "info@cameg.tg", "telephone": "+228 22 21 80 00", "adresse": "Quartier Bé, Lomé"},
    {"raison_sociale": "UBIPHARM Togo", "contact": "M. Adjiwa", "email": "contact@ubipharm.tg", "telephone": "+228 22 21 30 40", "adresse": "Lomé, Togo"},
    {"raison_sociale": "COPHARMA", "contact": "Mme. Bassa", "email": "info@copharma.tg", "telephone": "+228 22 25 65 87", "adresse": "Lomé, Togo"},
    {"raison_sociale": "Laborex Togo", "contact": "M. Kodjo", "email": "togo@laborex.com", "telephone": "+228 22 50 14 22", "adresse": "Lomé, Togo"},
]


async def seed_demo():
    db = get_db()
    if os.environ.get("SEED_DEMO", "true").lower() != "true":
        return

    # Ensure demo users always exist
    first_pharmacy = await db.pharmacies.find_one({"active": True})
    pharma_id = first_pharmacy["id"] if first_pharmacy else None

    for u in DEMO_USERS_PHARMACY:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({
                "id": gen_id(),
                "email": u["email"],
                "name": u["name"],
                "role": u["role"],
                "pharmacy_id": pharma_id,
                "active": True,
                "password_hash": hash_password(u["password"]),
                "created_at": now_utc().isoformat(),
            })
        elif pharma_id and not existing.get("pharmacy_id"):
            await db.users.update_one(
                {"email": u["email"]},
                {"$set": {"pharmacy_id": pharma_id}}
            )

    if await db.products.count_documents({}) > 0:
        return  # already seeded

    # 1) Default pharmacy
    pharmacy_id = gen_id()
    await db.pharmacies.insert_one({
        "id": pharmacy_id,
        **DEFAULT_PHARMACY,
        "created_at": now_utc().isoformat(),
    })

    # 2) Pharmacy users (admin/pharmacist/cashier/storekeeper)
    for u in DEMO_USERS_PHARMACY:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            # Attach existing user to demo pharmacy if not already
            if not existing.get("pharmacy_id"):
                await db.users.update_one(
                    {"email": u["email"]},
                    {"$set": {"pharmacy_id": pharmacy_id}}
                )
        else:
            await db.users.insert_one({
                "id": gen_id(),
                "email": u["email"],
                "name": u["name"],
                "role": u["role"],
                "pharmacy_id": pharmacy_id,
                "active": True,
                "password_hash": hash_password(u["password"]),
                "created_at": now_utc().isoformat(),
            })

    # 3) Categories (scoped to pharmacy)
    cat_map = {}
    for cn in CAMEG_CATEGORIES:
        cid = gen_id()
        await db.categories.insert_one({"id": cid, "name": cn, "pharmacy_id": pharmacy_id})
        cat_map[cn] = cid

    # 4) Suppliers
    sup_ids = []
    for s in DEMO_SUPPLIERS:
        sid = gen_id()
        await db.suppliers.insert_one({**s, "id": sid, "pharmacy_id": pharmacy_id, "created_at": now_utc().isoformat()})
        sup_ids.append(sid)

    # 5) Products + 2 batches each
    today = date.today()
    expiry_cycle = [25, 60, 100, 150, 200, 280, 350, 420, 500]
    for idx, (code, name, dci, forme, cat, seuil, presc, prix) in enumerate(CAMEG_PRODUCTS):
        pid = gen_id()
        await db.products.insert_one({
            "id": pid,
            "pharmacy_id": pharmacy_id,
            "code_barre": code,
            "nom_commercial": name,
            "dci": dci,
            "forme_pharmaceutique": forme,
            "categorie_id": cat_map.get(cat),
            "seuil_alerte_stock": seuil,
            "requires_prescription": presc,
            "prix_vente": prix,
            "created_at": now_utc().isoformat(),
        })
        purchase_price = round(prix * 0.65, 2)
        days_1 = expiry_cycle[idx % len(expiry_cycle)]
        days_2 = days_1 + 365
        for bnum, days, qty in [(f"L{idx:03d}A", days_1, 80), (f"L{idx:03d}B", days_2, 120)]:
            bid = gen_id()
            await db.batches.insert_one({
                "id": bid,
                "pharmacy_id": pharmacy_id,
                "product_id": pid,
                "batch_number": bnum,
                "expiry_date": (today + timedelta(days=days)).isoformat(),
                "purchase_price": purchase_price,
                "initial_quantity": qty,
                "current_quantity": qty,
                "status": "active",
                "supplier_id": sup_ids[idx % len(sup_ids)],
                "received_at": now_utc().isoformat(),
            })
            await db.stock_movements.insert_one({
                "id": gen_id(),
                "pharmacy_id": pharmacy_id,
                "batch_id": bid,
                "product_id": pid,
                "type": "ENTREE_ACHAT",
                "quantity": qty,
                "created_at": now_utc().isoformat(),
                "user_id": None,
                "reference_id": None,
                "notes": "Seed initial",
            })

    # 6) One expired batch on Paracétamol 500mg for demo alert
    para = await db.products.find_one({"nom_commercial": "Paracétamol 500mg"}, {"_id": 0, "id": 1})
    if para:
        bid = gen_id()
        await db.batches.insert_one({
            "id": bid,
            "pharmacy_id": pharmacy_id,
            "product_id": para["id"],
            "batch_number": "LEXP01",
            "expiry_date": (today - timedelta(days=10)).isoformat(),
            "purchase_price": 300,
            "initial_quantity": 30,
            "current_quantity": 30,
            "status": "active",
            "supplier_id": sup_ids[0],
            "received_at": now_utc().isoformat(),
        })
