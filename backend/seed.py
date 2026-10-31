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

    # Ne pas injecter de demo si aucune pharmacie n'est configuree (attendre l'assistant)
    first_pharmacy = await db.pharmacies.find_one({"active": True, "is_configured": True})
    if not first_pharmacy:
        return

    pharma_id = first_pharmacy["id"]

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

    # 1) Reuse the pharmacy already created by seed_admin (avoid duplicate)
    existing_pharmacy = await db.pharmacies.find_one({"active": True})
    if existing_pharmacy:
        pharmacy_id = existing_pharmacy["id"]
    else:
        pharmacy_id = gen_id()
        await db.pharmacies.insert_one({
            "id": pharmacy_id,
            **DEFAULT_PHARMACY,
            "created_at": now_utc().isoformat(),
        })

    # Make sure all DEMO_USERS_PHARMACY are linked to this pharmacy
    for u in DEMO_USERS_PHARMACY:
        await db.users.update_one(
            {"email": u["email"]},
            {"$set": {"pharmacy_id": pharmacy_id}},
        )


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

    # 5) Products only (WITHOUT batches/quantities - stock starts at 0)
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

