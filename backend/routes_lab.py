from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import LabExam, LabExamBase, CategoryBase, gen_id, now_utc

router = APIRouter(prefix="/api/lab-exams", tags=["lab_exams"])

LAB_COUNTER_ID = "lab_code_sequence"


async def generate_lab_code(db, scope: dict) -> str:
    """Generate sequential unique code for laboratory exam, e.g. LAB-001, LAB-002..."""
    for _ in range(100):
        counter = await db.counters.find_one_and_update(
            {"_id": LAB_COUNTER_ID},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        code = f"LAB-{str(counter['seq']).zfill(3)}"
        if not await db.lab_exams.find_one({**scope, "code": code}, {"_id": 1}):
            return code
    count = await db.lab_exams.count_documents(scope)
    return f"LAB-{(count + 1):03d}"


DEFAULT_LAB_EXAMS = [
    # Parasitologie & Bactériologie
    {
        "name": "GE (Goutte Épaisse)",
        "code": "LAB-GE",
        "category": "Parasitologie",
        "price": 500.0,
        "description": "Recherche de Plasmodium (diagnostic du paludisme)",
    },
    {
        "name": "NB (Numération Blanche)",
        "code": "LAB-NB",
        "category": "Hématologie",
        "price": 500.0,
        "description": "Numération des globules blancs / leucocytes",
    },
    {
        "name": "KOP (Kystes Œufs Parasites)",
        "code": "LAB-KOP",
        "category": "Parasitologie",
        "price": 500.0,
        "description": "Examen parasitologique des selles",
    },
    {
        "name": "TH (Test de Grossesse / HCG)",
        "code": "LAB-TH",
        "category": "Immunologie",
        "price": 1000.0,
        "description": "Test immunologique rapide de grossesse (HCG)",
    },
    {
        "name": "NFS (Hémogramme)",
        "code": "LAB-NFS",
        "category": "Hématologie",
        "price": 3500.0,
        "description": "Numération Formule Sanguine complète",
    },
    {
        "name": "CRP (Protéine C-Réactive)",
        "code": "LAB-CRP",
        "category": "Immunologie",
        "price": 1000.0,
        "description": "Marqueur biologique de l'inflammation",
    },
    {
        "name": "VS (Vitesse de Sédimentation)",
        "code": "LAB-VS",
        "category": "Hématologie",
        "price": 1000.0,
        "description": "Vitesse de sédimentation globulaire",
    },
    {
        "name": "AgHBS (Hépatite B)",
        "code": "LAB-HBS",
        "category": "Sérologie",
        "price": 2000.0,
        "description": "Dépistage de l'Antigène HBs (Virus Hépatite B)",
    },
    {
        "name": "AgHCV (Hépatite C)",
        "code": "LAB-HCV",
        "category": "Sérologie",
        "price": 2000.0,
        "description": "Dépistage des Anticorps anti-HCV (Virus Hépatite C)",
    },
    {
        "name": "SRV (VIH / Test VIH)",
        "code": "LAB-SRV",
        "category": "Sérologie",
        "price": 1000.0,
        "description": "Sérologie Rétrovirale / Dépistage rapide VIH 1 et 2",
    },
    {
        "name": "Test HP (Helicobacter Pylori)",
        "code": "LAB-HP",
        "category": "Bactériologie",
        "price": 2000.0,
        "description": "Recherche antigénique Helicobacter Pylori",
    },
    {
        "name": "TOXO (Toxoplasmose)",
        "code": "LAB-TOXO",
        "category": "Sérologie",
        "price": 2000.0,
        "description": "Sérologie Toxoplasmose IgG / IgM",
    },
    {
        "name": "TPHA/VDRL (Syphilis)",
        "code": "LAB-TPHA",
        "category": "Sérologie",
        "price": 2000.0,
        "description": "Diagnostic sérologique de la syphilis (TPHA et VDRL)",
    },
    {
        "name": "Marqueur Hépatique",
        "code": "LAB-MHEP",
        "category": "Biochimie",
        "price": 8000.0,
        "description": "Bilan et profil complet des marqueurs hépatiques",
    },
    {
        "name": "Glycémie",
        "code": "LAB-GLY",
        "category": "Biochimie",
        "price": 1000.0,
        "description": "Dosage du glucose sanguin à jeun ou aléatoire",
    },
    {
        "name": "Urée",
        "code": "LAB-URE",
        "category": "Biochimie",
        "price": 1000.0,
        "description": "Dosage de l'urée sanguine (bilan rénal)",
    },
    {
        "name": "Créat (Créatinine)",
        "code": "LAB-CRE",
        "category": "Biochimie",
        "price": 1000.0,
        "description": "Dosage de la créatinine sérique et clairance",
    },
    {
        "name": "ALAT (SGPT)",
        "code": "LAB-ALAT",
        "category": "Biochimie",
        "price": 1000.0,
        "description": "Transaminases hépatiques ALAT / SGPT",
    },
    {
        "name": "ASAT (SGOT)",
        "code": "LAB-ASAT",
        "category": "Biochimie",
        "price": 1000.0,
        "description": "Transaminases hépatiques ASAT / SGOT",
    },
    {
        "name": "Gamma GT",
        "code": "LAB-GGT",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Enzyme Gamma-Glutamyl Transférase (GGT)",
    },
    {
        "name": "Triglycérides",
        "code": "LAB-TG",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage des triglycérides sanguins (bilan lipidique)",
    },
    {
        "name": "Cholestérol T (Total)",
        "code": "LAB-CHLT",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage du cholestérol total",
    },
    {
        "name": "Cholestérol HDL",
        "code": "LAB-CHLD",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Fraction HDL (bon cholestérol)",
    },
    {
        "name": "Cholestérol LDL",
        "code": "LAB-CHLL",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Fraction LDL (mauvais cholestérol)",
    },
    {
        "name": "Ionogramme sanguin",
        "code": "LAB-IONO",
        "category": "Biochimie",
        "price": 10500.0,
        "description": "Dosage des électrolytes sanguins (Sodium, Potassium, Chlore...)",
    },
    {
        "name": "Calcémie",
        "code": "LAB-CALC",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage du calcium sérique total",
    },
    {
        "name": "Magnésémie",
        "code": "LAB-MAGN",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage du magnésium sanguin",
    },
    {
        "name": "Bilirubine T (Totale)",
        "code": "LAB-BILT",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage de la bilirubine totale",
    },
    {
        "name": "Amylasémie",
        "code": "LAB-AMYL",
        "category": "Biochimie",
        "price": 2000.0,
        "description": "Dosage de l'amylase sérique (bilan pancréatique)",
    },
    {
        "name": "Widal/Felix",
        "code": "LAB-WID",
        "category": "Sérologie",
        "price": 2000.0,
        "description": "Sérodiagnostic des fièvres typhoïde et paratyphoïde",
    },
    {
        "name": "Électrophorèse de l’HB",
        "code": "LAB-EHB",
        "category": "Hématologie",
        "price": 5000.0,
        "description": "Électrophorèse de l'hémoglobine (dépistage drépanocytose)",
    },
    {
        "name": "Groupage RH",
        "code": "LAB-GRP",
        "category": "Immuno-Hématologie",
        "price": 2000.0,
        "description": "Détermination du groupe sanguin ABO et facteur Rhésus",
    },
]


async def seed_defaults_if_empty(db, user: dict):
    """Seed the 32 standard laboratory examinations if none exist for this pharmacy."""
    scope = pharmacy_scope(user)
    count = await db.lab_exams.count_documents(scope)
    if count == 0:
        now_str = now_utc().isoformat()
        docs = []
        for e in DEFAULT_LAB_EXAMS:
            doc = {
                "id": gen_id(),
                "name": e["name"],
                "code": e["code"],
                "category": e["category"],
                "price": e["price"],
                "active": True,
                "description": e["description"],
                "created_at": now_str,
            }
            stamp_pharmacy(user, doc)
            docs.append(doc)
        if docs:
            await db.lab_exams.insert_many(docs)


@router.get("")
async def list_lab_exams(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_db()
    await seed_defaults_if_empty(db, user)
    query = pharmacy_scope(user)
    if q:
        query = {
            **query,
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"code": {"$regex": q, "$options": "i"}},
                {"category": {"$regex": q, "$options": "i"}},
            ],
        }
    items = await db.lab_exams.find(query, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(1000)
    return items


@router.get("/generate-code")
async def get_generated_lab_code(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    """Provide a new unique sequential internal code for a laboratory exam."""
    db = get_db()
    code = await generate_lab_code(db, pharmacy_scope(user))
    return {"code": code}


@router.get("/{lid}")
async def get_lab_exam(lid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    exam = await db.lab_exams.find_one({"id": lid}, {"_id": 0})
    assert_same_pharmacy(user, exam)
    return exam


@router.post("")
async def create_lab_exam(data: LabExamBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    scope = pharmacy_scope(user)

    code = (data.code or "").strip()
    if not code:
        code = await generate_lab_code(db, scope)
    else:
        existing = await db.lab_exams.find_one({**scope, "code": code})
        if existing:
            raise HTTPException(400, f"Le code d'analyse '{code}' est déjà utilisé.")
    data.code = code

    doc = LabExam(**data.model_dump()).model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    stamp_pharmacy(user, doc)
    await db.lab_exams.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "lab_exam.create", "lab_exam", doc["id"], {"name": data.name, "code": data.code, "price": data.price})
    return doc


@router.put("/{lid}")
async def update_lab_exam(lid: str, data: LabExamBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    exam = await db.lab_exams.find_one({"id": lid}, {"_id": 0})
    assert_same_pharmacy(user, exam)
    update_data = data.model_dump()
    await db.lab_exams.update_one({"id": lid}, {"$set": update_data})
    await log_audit(user, "lab_exam.update", "lab_exam", lid, {"name": data.name, "price": data.price})
    return await db.lab_exams.find_one({"id": lid}, {"_id": 0})


@router.delete("/{lid}")
async def delete_lab_exam(lid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    exam = await db.lab_exams.find_one({"id": lid}, {"_id": 0})
    assert_same_pharmacy(user, exam)
    await db.lab_exams.delete_one({"id": lid})
    await log_audit(user, "lab_exam.delete", "lab_exam", lid)
    return {"ok": True}


@router.post("/reset-defaults")
async def reset_defaults(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    """Restore default 32 laboratory examinations."""
    db = get_db()
    scope = pharmacy_scope(user)
    await db.lab_exams.delete_many(scope)
    await seed_defaults_if_empty(db, user)
    items = await db.lab_exams.find(scope, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(1000)
    await log_audit(user, "lab_exam.reset", "lab_exam", "all")
    return items


# ---------- Lab Disciplines / Categories Management ----------
DEFAULT_LAB_CATEGORIES = [
    "Biochimie",
    "Hématologie",
    "Sérologie",
    "Parasitologie",
    "Bactériologie",
    "Immunologie",
    "Immuno-Hématologie",
    "Autre",
]


async def seed_lab_categories_if_empty(db, user: dict):
    scope = pharmacy_scope(user)
    count = await db.lab_categories.count_documents(scope)
    if count == 0:
        docs = []
        for name in DEFAULT_LAB_CATEGORIES:
            doc = {"id": gen_id(), "name": name}
            stamp_pharmacy(user, doc)
            docs.append(doc)
        if docs:
            await db.lab_categories.insert_many(docs)


@router.get("/categories/list")
async def list_lab_categories(user: dict = Depends(get_current_user)):
    db = get_db()
    await seed_lab_categories_if_empty(db, user)
    items = await db.lab_categories.find(pharmacy_scope(user), {"_id": 0}).sort("name", 1).to_list(200)
    return items


@router.post("/categories/create")
async def create_lab_category(data: CategoryBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    scope = pharmacy_scope(user)
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(400, "Le nom de la discipline est requis.")
    existing = await db.lab_categories.find_one({**scope, "name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(400, f"La discipline '{name}' existe déjà.")
    doc = {"id": gen_id(), "name": name}
    stamp_pharmacy(user, doc)
    await db.lab_categories.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "lab_category.create", "lab_category", doc["id"], {"name": name})
    return doc


@router.put("/categories/{cid}")
async def update_lab_category(cid: str, data: CategoryBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    cat = await db.lab_categories.find_one({"id": cid}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Discipline non trouvée")
    assert_same_pharmacy(user, cat)
    new_name = (data.name or "").strip()
    if not new_name:
        raise HTTPException(400, "Le nom ne peut pas être vide.")
    old_name = cat.get("name")
    await db.lab_categories.update_one({"id": cid}, {"$set": {"name": new_name}})
    # Cascade to all exams having this category
    scope = pharmacy_scope(user)
    await db.lab_exams.update_many({**scope, "category": old_name}, {"$set": {"category": new_name}})
    await log_audit(user, "lab_category.update", "lab_category", cid, {"old": old_name, "new": new_name})
    return {"id": cid, "name": new_name}


@router.delete("/categories/{cid}")
async def delete_lab_category(cid: str, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    cat = await db.lab_categories.find_one({"id": cid}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Discipline non trouvée")
    assert_same_pharmacy(user, cat)
    scope = pharmacy_scope(user)
    # Update exams with this category to 'Autre'
    await db.lab_exams.update_many({**scope, "category": cat.get("name")}, {"$set": {"category": "Autre"}})
    await db.lab_categories.delete_one({"id": cid})
    await log_audit(user, "lab_category.delete", "lab_category", cid, {"name": cat.get("name")})
    return {"ok": True}

