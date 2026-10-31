from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from database import get_db
from auth import get_current_user, require_roles, log_audit
from tenant import pharmacy_scope, stamp_pharmacy, assert_same_pharmacy
from models import MedicalAct, MedicalActBase, gen_id, now_utc

router = APIRouter(prefix="/api/acts", tags=["medical_acts"])

ACT_COUNTER_ID = "act_code_sequence"


async def generate_act_code(db, scope: dict) -> str:
    """Generate sequential unique code for medical act, e.g. ACT-001, ACT-002..."""
    for _ in range(100):
        counter = await db.counters.find_one_and_update(
            {"_id": ACT_COUNTER_ID},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        code = f"ACT-{str(counter['seq']).zfill(3)}"
        if not await db.medical_acts.find_one({**scope, "code": code}, {"_id": 1}):
            return code
    count = await db.medical_acts.count_documents(scope)
    return f"ACT-{(count + 1):03d}"

DEFAULT_ACTS = [
    {
        "name": "Consultation",
        "code": "ACT-CONS",
        "category": "Consultation",
        "price": 500.0,
        "description": "Consultation médicale ou paramédicale générale",
    },
    {
        "name": "CPN",
        "code": "ACT-CPN",
        "category": "Maternité",
        "price": 1500.0,
        "description": "Consultation Prénatale de suivi de grossesse",
    },
    {
        "name": "Acte Petite Chirurgie",
        "code": "ACT-CHIR",
        "category": "Chirurgie / Soins",
        "price": 1000.0,
        "description": "Intervention chirurgicale mineure et incision",
    },
    {
        "name": "Pansement",
        "code": "ACT-PANS",
        "category": "Soins Infirmiers",
        "price": 1000.0,
        "description": "Nettoyage, désinfection et réfection de pansement",
    },
    {
        "name": "Acte d’accouchement",
        "code": "ACT-ACCO",
        "category": "Maternité",
        "price": 2000.0,
        "description": "Assistance et surveillance d'accouchement eutocique",
    },
    {
        "name": "Révision utérine",
        "code": "ACT-REVU",
        "category": "Maternité",
        "price": 2000.0,
        "description": "Contrôle et révision de la cavité utérine post-partum",
    },
    {
        "name": "Suture",
        "code": "ACT-SUTU",
        "category": "Chirurgie / Soins",
        "price": 1000.0,
        "description": "Suture de plaie superficielle ou intermédiaire",
    },
]


async def seed_defaults_if_empty(db, user: dict):
    """Seed the 7 standard medical acts if none exist for this pharmacy."""
    scope = pharmacy_scope(user)
    count = await db.medical_acts.count_documents(scope)
    if count == 0:
        now_str = now_utc().isoformat()
        docs = []
        for a in DEFAULT_ACTS:
            doc = {
                "id": gen_id(),
                "name": a["name"],
                "code": a["code"],
                "category": a["category"],
                "price": a["price"],
                "active": True,
                "description": a["description"],
                "created_at": now_str,
            }
            stamp_pharmacy(user, doc)
            docs.append(doc)
        if docs:
            await db.medical_acts.insert_many(docs)


@router.get("")
async def list_acts(q: Optional[str] = None, user: dict = Depends(get_current_user)):
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
    items = await db.medical_acts.find(query, {"_id": 0}).sort("category", 1).to_list(1000)
    return items


@router.get("/generate-code")
async def get_generated_act_code(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    """Provide a new unique sequential internal code for a medical act."""
    db = get_db()
    code = await generate_act_code(db, pharmacy_scope(user))
    return {"code": code}


@router.get("/{aid}")
async def get_act(aid: str, user: dict = Depends(get_current_user)):
    db = get_db()
    act = await db.medical_acts.find_one({"id": aid}, {"_id": 0})
    assert_same_pharmacy(user, act)
    return act


@router.post("")
async def create_act(data: MedicalActBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    scope = pharmacy_scope(user)

    code = (data.code or "").strip()
    if not code:
        code = await generate_act_code(db, scope)
    else:
        # Check uniqueness if provided
        existing = await db.medical_acts.find_one({**scope, "code": code})
        if existing:
            raise HTTPException(400, f"Le code interne '{code}' est déjà utilisé par un autre acte.")
    data.code = code

    doc = MedicalAct(**data.model_dump()).model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    stamp_pharmacy(user, doc)
    await db.medical_acts.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "medical_act.create", "medical_act", doc["id"], {"name": data.name, "code": data.code, "price": data.price})
    return doc


@router.put("/{aid}")
async def update_act(aid: str, data: MedicalActBase, user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    db = get_db()
    act = await db.medical_acts.find_one({"id": aid}, {"_id": 0})
    assert_same_pharmacy(user, act)
    update_data = data.model_dump()
    await db.medical_acts.update_one({"id": aid}, {"$set": update_data})
    await log_audit(user, "medical_act.update", "medical_act", aid, {"name": data.name, "price": data.price})
    return await db.medical_acts.find_one({"id": aid}, {"_id": 0})


@router.delete("/{aid}")
async def delete_act(aid: str, user: dict = Depends(require_roles("super_admin", "admin"))):
    db = get_db()
    act = await db.medical_acts.find_one({"id": aid}, {"_id": 0})
    assert_same_pharmacy(user, act)
    await db.medical_acts.delete_one({"id": aid})
    await log_audit(user, "medical_act.delete", "medical_act", aid)
    return {"ok": True}


@router.post("/reset-defaults")
async def reset_defaults(user: dict = Depends(require_roles("super_admin", "admin", "pharmacist"))):
    """Restore default 7 medical acts."""
    db = get_db()
    scope = pharmacy_scope(user)
    # Remove existing acts
    await db.medical_acts.delete_many(scope)
    await seed_defaults_if_empty(db, user)
    items = await db.medical_acts.find(scope, {"_id": 0}).sort("category", 1).to_list(1000)
    await log_audit(user, "medical_act.reset", "medical_act", "all")
    return items
