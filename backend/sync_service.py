"""
Service de Synchronisation Bidirectionnelle Hors-Ligne & Cloud MongoDB Atlas
pour SGP-Pharma.

Principes clés :
1. TRAVAIL LOCAL NON PERTURBÉ : Les ventes, stocks, caisses et consultations
   s'exécutent à 100% sur le MongoDB local (localhost:27017) avec une latence < 2ms.
   Aucune dépendance réseau pour les opérations quotidiennes de la pharmacie.
2. SANS DOUBLONS (IDEMPOTENCE) : Chaque document possède un UUID unique (`id`).
   Toute écriture sur MongoDB Atlas s'effectue par un `replace_one({"id": ...}, doc, upsert=True)`.
   Même réexécutée 10 000 fois, cette opération ne crée jamais de doublons.
3. RÉSILIENCE HORS-LIGNE : Si la connexion Internet est coupée ou lente,
   le service intercepte silencieusement l'erreur, passe le statut en "Hors-ligne",
   et réessaie au cycle suivant (15s par défaut). Les données restent en attente
   sur le PC local et sont transférées dès le rétablissement d'Internet.
4. SYNCHRONISATION DU CATALOGUE (CLOUD -> LOCAL) : Les modifications apportées
   sur le catalogue (nouveaux produits, prix, catégories, actes) depuis Atlas ou
   le siège sont répercutées automatiquement dans la base locale.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReplaceOne
from database import get_db

logger = logging.getLogger("sync_service")

# Collections à synchroniser
SYNC_COLLECTIONS = [
    "pharmacies",
    "users",
    "categories",
    "products",
    "suppliers",
    "batches",
    "medical_acts",
    "lab_categories",
    "lab_exams",
    "presales",
    "purchase_orders",
    "sales",
    "stock_movements",
    "losses",
    "audit_logs",
]

# Collections de référence à propager depuis Atlas vers le local si modifiées
CATALOG_COLLECTIONS = [
    "pharmacies",
    "categories",
    "products",
    "suppliers",
    "medical_acts",
    "lab_categories",
    "lab_exams",
]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SyncManager:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._trigger_event = asyncio.Event()
        self._atlas_client: Optional[AsyncIOMotorClient] = None
        self._atlas_db = None
        self.enabled: bool = False
        self.connected: bool = False
        self.is_syncing: bool = False
        self.last_sync_time: Optional[str] = None
        self.last_sync_duration: float = 0.0
        self.last_error: Optional[str] = None
        self.pending_count: int = 0
        self.synced_count: int = 0
        self.records_transferred_last_run: int = 0
        self.cluster_host: str = ""
        self.database_name: str = ""
        self.interval_seconds: int = 15
        self._indexes_ensured: bool = False

    def _extract_cluster_host(self, uri: str) -> str:
        try:
            if "@" in uri:
                after_at = uri.split("@", 1)[1]
                return after_at.split("/", 1)[0].split("?", 1)[0]
        except Exception:
            pass
        return "Atlas Cluster"

    def init_config(self):
        atlas_url = os.environ.get("MONGO_URL_ATLAS", "").strip()
        self.database_name = os.environ.get("DB_NAME", "HOP-Pharma").strip()
        self.interval_seconds = int(os.environ.get("SYNC_INTERVAL_SECONDS", 15))
        sync_env = os.environ.get("SYNC_ENABLED", "true").lower()
        self.enabled = bool(atlas_url) and sync_env in ("true", "1", "yes")
        if atlas_url:
            self.cluster_host = self._extract_cluster_host(atlas_url)

    def get_atlas_client(self) -> AsyncIOMotorClient:
        if self._atlas_client is None:
            atlas_url = os.environ.get("MONGO_URL_ATLAS", "").strip()
            # Timeouts courts pour ne jamais bloquer en cas de coupure Internet
            self._atlas_client = AsyncIOMotorClient(
                atlas_url,
                serverSelectionTimeoutMS=4000,
                connectTimeoutMS=4000,
                socketTimeoutMS=6000,
                retryWrites=True,
            )
        return self._atlas_client

    def get_atlas_db(self):
        if self._atlas_db is None:
            client = self.get_atlas_client()
            self._atlas_db = client[self.database_name]
        return self._atlas_db

    def close_atlas_client(self):
        if self._atlas_client is not None:
            try:
                self._atlas_client.close()
            except Exception:
                pass
            self._atlas_client = None
            self._atlas_db = None

    async def ensure_atlas_indexes(self):
        """Assure que les index uniques sur 'id' existent dans Atlas pour garantir le zéro-doublon."""
        try:
            atlas_db = self.get_atlas_db()
            for col_name in SYNC_COLLECTIONS:
                await atlas_db[col_name].create_index("id", unique=True, sparse=True)
        except Exception as e:
            logger.debug(f"Atlas index creation skipped: {e}")

    async def compute_counts(self, local_db) -> tuple[int, int]:
        """Calcule le nombre de documents locaux synchronisés et en attente."""
        pending = 0
        synced = 0
        for col_name in SYNC_COLLECTIONS:
            try:
                col = local_db[col_name]
                p_cnt = await col.count_documents({"_synced": {"$ne": True}})
                s_cnt = await col.count_documents({"_synced": True})
                pending += p_cnt
                synced += s_cnt
            except Exception:
                continue
        return pending, synced

    async def push_local_to_atlas(self, local_db, atlas_db) -> int:
        """Transfère les documents locaux non synchronisés vers Atlas (Idempotent et optimisé en lot)."""
        total_pushed = 0
        for col_name in SYNC_COLLECTIONS:
            local_col = local_db[col_name]
            atlas_col = atlas_db[col_name]

            # Récupération par lots de 200 documents
            cursor = local_col.find({"_synced": {"$ne": True}}).limit(200)
            docs = await cursor.to_list(200)
            if not docs:
                continue

            ops = []
            synced_ids = []
            for doc in docs:
                doc_id = doc.get("id") or str(doc.get("_id", ""))
                if not doc_id:
                    continue

                clean_doc = dict(doc)
                clean_doc.pop("_id", None)
                clean_doc.pop("_synced", None)
                clean_doc.pop("_synced_at", None)

                ops.append(ReplaceOne({"id": doc_id}, clean_doc, upsert=True))
                synced_ids.append(doc["_id"])

            if ops:
                await atlas_col.bulk_write(ops, ordered=False)
                now_str = now_utc_iso()
                await local_col.update_many(
                    {"_id": {"$in": synced_ids}},
                    {"$set": {"_synced": True, "_synced_at": now_str}}
                )
                total_pushed += len(ops)

        # Synchroniser les suppressions (tombstones)
        try:
            tombstones = await local_db.tombstones.find({"_synced": {"$ne": True}}).limit(50).to_list(50)
            for t in tombstones:
                target_col = t.get("collection")
                rec_id = t.get("record_id")
                if target_col and rec_id and target_col in SYNC_COLLECTIONS:
                    await atlas_db[target_col].delete_one({"id": rec_id})
                await local_db.tombstones.update_one(
                    {"_id": t["_id"]},
                    {"$set": {"_synced": True, "_synced_at": now_utc_iso()}}
                )
        except Exception as e:
            logger.debug(f"Tombstones sync skipped: {e}")

        return total_pushed

    async def pull_atlas_to_local(self, local_db, atlas_db) -> int:
        """Rapatrie les modifications de catalogues créées ou modifiées sur Atlas."""
        total_pulled = 0
        for col_name in CATALOG_COLLECTIONS:
            atlas_col = atlas_db[col_name]
            local_col = local_db[col_name]

            # Filtrer par date si last_sync_time existe
            query = {}
            if self.last_sync_time:
                query = {"updated_at": {"$gte": self.last_sync_time}}

            async for atlas_doc in atlas_col.find(query).limit(100):
                doc_id = atlas_doc.get("id")
                if not doc_id:
                    continue

                local_doc = await local_col.find_one({"id": doc_id})
                if not local_doc:
                    clean = dict(atlas_doc)
                    clean.pop("_id", None)
                    clean["_synced"] = True
                    clean["_synced_at"] = now_utc_iso()
                    await local_col.insert_one(clean)
                    total_pulled += 1
                else:
                    atlas_updated = atlas_doc.get("updated_at")
                    local_updated = local_doc.get("updated_at")
                    if atlas_updated and local_updated and atlas_updated > local_updated:
                        clean = dict(atlas_doc)
                        clean.pop("_id", None)
                        clean["_synced"] = True
                        clean["_synced_at"] = now_utc_iso()
                        await local_col.replace_one({"id": doc_id}, clean)
                        total_pulled += 1

        return total_pulled

    async def perform_sync_cycle(self) -> Dict[str, Any]:
        """Exécute un cycle complet de synchronisation avec gestion des pannes."""
        if not self.enabled:
            return {"status": "disabled"}

        start_time = asyncio.get_event_loop().time()
        self.is_syncing = True
        self.last_error = None

        try:
            local_db = get_db()
            atlas_db = self.get_atlas_db()

            # Test de connexion rapide (ping avec timeout 4s)
            await atlas_db.command("ping")
            self.connected = True

            # 1. Assurer les index une seule fois par session
            if not self._indexes_ensured:
                await self.ensure_atlas_indexes()
                self._indexes_ensured = True

            # 2. Pousser les données locales vers Atlas
            pushed = await self.push_local_to_atlas(local_db, atlas_db)

            # 3. Récupérer les nouveautés du catalogue depuis Atlas
            pulled = await self.pull_atlas_to_local(local_db, atlas_db)

            # 4. Mettre à jour les compteurs
            pending, synced = await self.compute_counts(local_db)
            self.pending_count = pending
            self.synced_count = synced
            self.records_transferred_last_run = pushed + pulled
            self.last_sync_time = now_utc_iso()
            self.last_sync_duration = round(asyncio.get_event_loop().time() - start_time, 2)

            if pushed > 0 or pulled > 0:
                logger.info(
                    f"Sync Atlas réussie : {pushed} poussé(s), {pulled} rapatrié(s) "
                    f"({self.last_sync_duration}s). En attente : {pending}"
                )

            return {
                "status": "success",
                "pushed": pushed,
                "pulled": pulled,
                "pending": pending,
                "synced": synced,
                "duration": self.last_sync_duration,
            }

        except Exception as exc:
            # En cas de panne Internet, échec DNS ou timeout Atlas :
            # On n'interrompt JAMAIS le fonctionnement de la pharmacie locale
            self.connected = False
            self.last_error = str(exc)
            logger.warning(f"Synchronisation Atlas différée (Hors-ligne / indisponible) : {exc}")
            self.close_atlas_client()

            # Calculer quand même les compteurs locaux pour l'affichage UI
            try:
                local_db = get_db()
                self.pending_count, self.synced_count = await self.compute_counts(local_db)
            except Exception:
                pass

            return {"status": "offline", "error": str(exc), "pending": self.pending_count}

        finally:
            self.is_syncing = False

    async def _loop(self):
        """Boucle de fond qui s'exécute à l'intervalle spécifié."""
        logger.info(
            f"Démarrage du service de synchronisation SGP-Pharma -> Atlas ({self.interval_seconds}s)"
        )
        while not self._stop_event.is_set():
            try:
                await self.perform_sync_cycle()
            except Exception as e:
                logger.error(f"Erreur inattendue dans la boucle de sync : {e}")

            # Attendre l'intervalle ou un déclenchement forcé (trigger manuel)
            try:
                # Réinitialiser le flag de trigger
                self._trigger_event.clear()
                # Attendre soit le timeout soit le signal manuel
                await asyncio.wait_for(
                    self._trigger_event.wait(),
                    timeout=float(self.interval_seconds)
                )
            except asyncio.TimeoutError:
                pass
            except asyncio.CancelledError:
                break

    def start(self):
        self.init_config()
        if not self.enabled:
            logger.info("Synchronisation Atlas désactivée (MONGO_URL_ATLAS manquant ou SYNC_ENABLED=false)")
            return
        if self._task is None or self._task.done():
            self._stop_event.clear()
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        self._stop_event.set()
        self._trigger_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
        self.close_atlas_client()
        logger.info("Service de synchronisation Atlas arrêté.")

    def trigger_now(self):
        """Force un cycle immédiat sans attendre l'intervalle."""
        self._trigger_event.set()

    def get_status(self) -> Dict[str, Any]:
        """Retourne l'état actuel de la synchronisation pour le frontend et le monitoring."""
        return {
            "enabled": self.enabled,
            "connected": self.connected,
            "is_syncing": self.is_syncing,
            "last_sync_time": self.last_sync_time,
            "last_sync_duration": self.last_sync_duration,
            "last_error": self.last_error,
            "pending_count": self.pending_count,
            "synced_count": self.synced_count,
            "records_transferred_last_run": self.records_transferred_last_run,
            "cluster": self.cluster_host,
            "database": self.database_name,
            "interval_seconds": self.interval_seconds,
        }


# Instance singleton
sync_manager = SyncManager()


async def register_tombstone(db, collection_name: str, record_id: str):
    """Enregistre une suppression pour qu'elle soit répercutée sur Atlas."""
    try:
        await db.tombstones.insert_one({
            "collection": collection_name,
            "record_id": record_id,
            "deleted_at": now_utc_iso(),
            "_synced": False
        })
    except Exception as e:
        logger.debug(f"Could not register tombstone: {e}")

