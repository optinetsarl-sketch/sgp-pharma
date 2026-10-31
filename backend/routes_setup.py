"""
Service d'Initialisation Automatique, Onboarding & Restauration Cloud pour SGP-Pharma.

Permet :
1. De détecter si une installation est neuve, existante ou nécessite une restauration Cloud.
2. D'initialiser une nouvelle officine cliente avec un pharmacy_id unique et permanent,
   son pack CAMEG complet pré-rempli et sa base Cloud dédiée sur MongoDB Atlas.
3. De restaurer instantanément l'intégralité d'une officine depuis Atlas en cas de crash
   ou remplacement de PC matériel (Disaster Recovery).
"""

import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, HTTPException, Response

from database import get_db, get_client
from auth import hash_password, verify_password, create_access_token, create_refresh_token, set_auth_cookies
from models import gen_id, now_utc
from cameg_products import CAMEG_PRODUCTS, CAMEG_CATEGORIES
from routes_acts import DEFAULT_ACTS
from routes_lab import DEFAULT_LAB_EXAMS
from sync_service import sync_manager

router = APIRouter(prefix="/api/setup", tags=["setup"])

# Villes principales et secondaires du Togo
TOGO_CITIES = [
    "Lomé", "Kpalimé", "Sokodé", "Kara", "Dapaong", "Atakpamé", "Tsévié",
    "Aného", "Bassar", "Mango", "Notsé", "Tabligbo", "Tchamba", "Vogan",
    "Badou", "Bafilo", "Kandé", "Niamtougou", "Cinkassé", "Blitta"
]

DEFAULT_SUPPLIERS = [
    {"raison_sociale": "CAMEG Togo", "contact": "Direction CAMEG", "email": "info@cameg.tg", "telephone": "+228 22 21 80 00", "adresse": "Quartier Bé, Lomé"},
    {"raison_sociale": "UBIPHARM Togo", "contact": "M. Adjiwa", "email": "contact@ubipharm.tg", "telephone": "+228 22 21 30 40", "adresse": "Zone Portuaire, Lomé"},
    {"raison_sociale": "COPHARMA", "contact": "Mme. Bassa", "email": "info@copharma.tg", "telephone": "+228 22 25 65 87", "adresse": "Lomé, Togo"},
    {"raison_sociale": "Laborex Togo", "contact": "M. Kodjo", "email": "togo@laborex.com", "telephone": "+228 22 50 14 22", "adresse": "Lomé, Togo"},
]


def slugify_db_name(name: str) -> str:
    """Transforme un nom de pharmacie en identifiant de base de données Cloud en majuscules (ex: PHARMA-PAIX)."""
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", name)
    words = [w.strip() for w in clean.split() if w.strip()]
    # Éviter la répétition du mot 'pharmacie'
    if words and words[0].lower() in ("pharmacie", "pharma"):
        words = words[1:]
    suffix = "-".join(words)[:18].upper()
    if not suffix:
        suffix = "CLIENT"
    return f"PHARMA-{suffix}"


def update_local_env_file(key: str, value: str):
    """Met à jour une variable dans le fichier .env local."""
    for base_dir in [Path(__file__).resolve().parent, Path.cwd() / "backend", Path.cwd()]:
        env_path = base_dir / ".env"
        if env_path.exists():
            try:
                lines = env_path.read_text(encoding="utf-8").splitlines()
                found = False
                new_lines = []
                for line in lines:
                    if line.strip().startswith(f"{key}=") or line.strip().startswith(f'export {key}='):
                        new_lines.append(f'{key}="{value}"')
                        found = True
                    else:
                        new_lines.append(line)
                if not found:
                    new_lines.append(f'{key}="{value}"')
                env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
                break
            except Exception:
                pass
    os.environ[key] = value


class SetupInitializeRequest(BaseModel):
    name: str = Field(..., min_length=2)
    city: str = "Lomé"
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cloud_db_name: Optional[str] = None
    admin_name: str = "Admin Pharmacie"
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=6)


class SetupRestoreRequest(BaseModel):
    cloud_db_name: str = Field(..., min_length=3)
    admin_email: EmailStr
    admin_password: str


@router.get("/status")
async def get_installation_status():
    """Vérifie l'état de l'installation actuelle (locale et Cloud)."""
    db = get_db()
    pharmacy = await db.pharmacies.find_one({"active": True}, {"_id": 0})
    is_configured = bool(pharmacy and (pharmacy.get("is_configured") or pharmacy.get("name")))

    return {
        "is_configured": is_configured,
        "pharmacy": {
            "id": pharmacy.get("id"),
            "name": pharmacy.get("name"),
            "city": pharmacy.get("city"),
        } if pharmacy else None,
        "current_db_name": os.environ.get("DB_NAME", "HOP-Pharma"),
        "cloud_sync_enabled": sync_manager.enabled,
        "cloud_connected": sync_manager.connected,
        "cluster": sync_manager.cluster_host,
    }


@router.get("/metadata")
async def get_setup_metadata():
    """Fournit les métadonnées pour l'assistant d'installation (villes Togo, devise, etc.)."""
    return {
        "cities": TOGO_CITIES,
        "default_currency": "FCFA",
        "default_country": "Togo",
    }


@router.post("/initialize")
async def initialize_new_pharmacy(payload: SetupInitializeRequest, response: Response):
    """
    Initialisation d'une nouvelle pharmacie :
    1. Génération d'un pharmacy_id unique et permanent.
    2. Création de la fiche pharmacie et du compte Admin.
    3. Injection des données de base complètes (188 médicaments CAMEG, familles, répartiteurs, actes, labo).
    4. Création de la base Cloud dédiée sur Atlas et premier envoi si en ligne.
    """
    db = get_db()
    existing = await db.pharmacies.find_one({"active": True})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Une pharmacie est déjà initialisée sur cette machine. Aucune réinitialisation permise."
        )

    # 1. Génération d'un pharmacy_id unique et permanent
    pharmacy_id = f"pha_{uuid.uuid4()}"

    # 2. Détermination du nom de base Cloud
    raw_cloud_name = payload.cloud_db_name.strip() if payload.cloud_db_name else ""
    cloud_db_name = raw_cloud_name if raw_cloud_name else slugify_db_name(payload.name)

    # Mettre à jour DB_NAME
    update_local_env_file("DB_NAME", cloud_db_name)

    # 3. Création de la fiche pharmacie locale
    now_str = now_utc().isoformat()
    pharmacy_doc = {
        "id": pharmacy_id,
        "name": payload.name.strip(),
        "city": payload.city.strip(),
        "address": (payload.address or "").strip(),
        "phone": (payload.phone or "").strip(),
        "email": (payload.email or "").strip(),
        "country": "Togo",
        "currency": "FCFA",
        "cloud_db_name": cloud_db_name,
        "is_configured": True,
        "active": True,
        "created_at": now_str,
        "_synced": False,
    }
    await db.pharmacies.insert_one(pharmacy_doc)

    # 4. Création du compte Administrateur
    admin_id = gen_id()
    admin_user = {
        "id": admin_id,
        "email": payload.admin_email.lower().strip(),
        "name": payload.admin_name.strip(),
        "role": "admin",
        "pharmacy_id": pharmacy_id,
        "active": True,
        "password_hash": hash_password(payload.admin_password),
        "created_at": now_str,
        "_synced": False,
    }
    await db.users.insert_one(admin_user)

    # 5. Injection du pack de base complet
    # A. Catégories CAMEG
    cat_map = {}
    for cn in CAMEG_CATEGORIES:
        cid = gen_id()
        await db.categories.insert_one({
            "id": cid,
            "name": cn,
            "pharmacy_id": pharmacy_id,
            "_synced": False,
        })
        cat_map[cn] = cid

    # B. Fournisseurs / Répartiteurs du Togo
    for s in DEFAULT_SUPPLIERS:
        sid = gen_id()
        await db.suppliers.insert_one({
            **s,
            "id": sid,
            "pharmacy_id": pharmacy_id,
            "created_at": now_str,
            "_synced": False,
        })

    # C. 188 Médicaments CAMEG (stocks à zéro)
    for code, m_name, dci, forme, cat, seuil, presc, prix in CAMEG_PRODUCTS:
        pid = gen_id()
        await db.products.insert_one({
            "id": pid,
            "pharmacy_id": pharmacy_id,
            "code_barre": code,
            "nom_commercial": m_name,
            "dci": dci,
            "forme_pharmaceutique": forme,
            "categorie_id": cat_map.get(cat),
            "seuil_alerte_stock": seuil,
            "requires_prescription": presc,
            "prix_vente": prix,
            "created_at": now_str,
            "_synced": False,
        })

    # D. Actes Médicaux d'Officine
    for act in DEFAULT_ACTS:
        aid = gen_id()
        await db.medical_acts.insert_one({
            **act,
            "id": aid,
            "pharmacy_id": pharmacy_id,
            "created_at": now_str,
            "_synced": False,
        })

    # E. Analyses de Laboratoire
    for exam in DEFAULT_LAB_EXAMS:
        eid = gen_id()
        await db.lab_exams.insert_one({
            **exam,
            "id": eid,
            "pharmacy_id": pharmacy_id,
            "created_at": now_str,
            "_synced": False,
        })

    # 6. Création sur le Cloud Atlas si Internet disponible
    if sync_manager.enabled:
        try:
            sync_manager.database_name = cloud_db_name
            sync_manager._atlas_db = None
            # Déclencher le cycle initial
            await sync_manager.perform_sync_cycle()
        except Exception:
            pass

    # 7. Génération des tokens de session pour connexion automatique
    access_token = create_access_token(admin_id, admin_user["email"], "admin")
    refresh_token = create_refresh_token(admin_id)
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "ok": True,
        "pharmacy_id": pharmacy_id,
        "cloud_db_name": cloud_db_name,
        "name": payload.name,
        "access_token": access_token,
        "user": {
            "id": admin_id,
            "email": admin_user["email"],
            "name": admin_user["name"],
            "role": "admin",
            "pharmacy_id": pharmacy_id,
        }
    }


@router.post("/restore")
async def restore_existing_pharmacy(payload: SetupRestoreRequest, response: Response):
    """
    Restauration intégrale d'une pharmacie existante depuis MongoDB Atlas (Disaster Recovery) :
    1. Vérifie que la base locale est vierge (protection contre écrasement).
    2. Valide les identifiants administrateur sur la base Cloud demandée.
    3. Rapatrie tous les documents et recrée la base locale à l'identique.
    """
    local_db = get_db()
    existing = await local_db.pharmacies.find_one({"active": True})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Une pharmacie est déjà active sur ce PC. La restauration est réservée aux installations neuves."
        )

    cloud_db_name = payload.cloud_db_name.strip()
    if not cloud_db_name:
        raise HTTPException(status_code=400, detail="Nom de la base Cloud requis")

    # Connexion à MongoDB Atlas
    atlas_url = os.environ.get("MONGO_URL_ATLAS", "").strip()
    if not atlas_url:
        raise HTTPException(
            status_code=503,
            detail="L'URL de connexion Atlas (MONGO_URL_ATLAS) n'est pas configurée dans .env"
        )

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        atlas_client = AsyncIOMotorClient(
            atlas_url,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        atlas_db = atlas_client[cloud_db_name]
        await atlas_db.command("ping")
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Impossible de joindre le Cloud Atlas. Vérifiez votre connexion Internet : {e}"
        )

    # Vérifier l'existence de la base sur Atlas
    pharmacies_cnt = await atlas_db.pharmacies.count_documents({})
    if pharmacies_cnt == 0:
        atlas_client.close()
        raise HTTPException(
            status_code=404,
            detail=f"La base Cloud '{cloud_db_name}' est introuvable ou vide sur Atlas."
        )

    # Vérification de sécurité des identifiants Administrateur
    admin_email = payload.admin_email.lower().strip()
    atlas_admin = await atlas_db.users.find_one({"email": admin_email, "role": {"$in": ["admin", "super_admin"]}})
    if not atlas_admin:
        atlas_client.close()
        raise HTTPException(
            status_code=401,
            detail="Compte administrateur introuvable dans cette base Cloud."
        )

    if not verify_password(payload.admin_password, atlas_admin.get("password_hash", "")):
        atlas_client.close()
        raise HTTPException(
            status_code=401,
            detail="Mot de passe administrateur incorrect pour cette base Cloud."
        )

    # Mettre à jour DB_NAME local
    update_local_env_file("DB_NAME", cloud_db_name)

    # Rapatriement intégral de toutes les collections
    from sync_service import SYNC_COLLECTIONS
    total_restored = 0
    now_iso = now_utc().isoformat()

    for col_name in SYNC_COLLECTIONS:
        atlas_col = atlas_db[col_name]
        local_col = local_db[col_name]

        docs = await atlas_col.find().to_list(10000)
        if docs:
            for d in docs:
                d.pop("_id", None)
                d["_synced"] = True
                d["_synced_at"] = now_iso
            await local_col.insert_many(docs)
            total_restored += len(docs)

    atlas_client.close()

    # Mettre à jour le sync_manager
    sync_manager.database_name = cloud_db_name
    sync_manager._atlas_db = None
    sync_manager.init_config()

    # Récupérer la fiche pharmacie restaurée
    restored_pharmacy = await local_db.pharmacies.find_one({"active": True}, {"_id": 0})

    # Générer le token de session
    access_token = create_access_token(atlas_admin["id"], atlas_admin["email"], atlas_admin["role"])
    refresh_token = create_refresh_token(atlas_admin["id"])
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "ok": True,
        "restored": True,
        "cloud_db_name": cloud_db_name,
        "records_count": total_restored,
        "pharmacy": restored_pharmacy,
        "access_token": access_token,
        "user": {
            "id": atlas_admin["id"],
            "email": atlas_admin["email"],
            "name": atlas_admin.get("name", "Administrateur"),
            "role": atlas_admin.get("role", "admin"),
            "pharmacy_id": atlas_admin.get("pharmacy_id"),
        }
    }

