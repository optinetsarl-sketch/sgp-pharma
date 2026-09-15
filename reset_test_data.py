"""
reset_test_data.py — Nettoyage des données de test SGP-Pharma
=============================================================
Ce script supprime les données transactionnelles saisies pendant les tests :
  - Ventes (collection: sales)
  - Pré-ventes (collection: presales)
  - Mouvements de stock de type SORTIE_VENTE (collection: stock_movements)
  - Restauration du stock des lots affectés par ces sorties

Le script NE SUPPRIME PAS :
  - Pharmacies, utilisateurs, produits, lots, fournisseurs, catégories

Usage:
  python reset_test_data.py
  python reset_test_data.py --dry-run   (simulation, aucune suppression)
  python reset_test_data.py --all       (efface aussi les pertes/losses)
"""

import sys
import io
import asyncio
import argparse
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ─── Chargement .env ──────────────────────────────────────────────────────────
ENV_FILE = Path(__file__).resolve().parent / "backend" / ".env"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            import os
            os.environ.setdefault(k.strip(), v.strip().strip('"'))

import os
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "HOP-Pharma")

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    print("[ERREUR] Le module 'motor' n'est pas installé.")
    print("  Exécutez : pip install motor")
    sys.exit(1)


# ─── Helpers ──────────────────────────────────────────────────────────────────
def hr():
    print("─" * 60)

def confirm(prompt: str) -> bool:
    ans = input(f"\n{prompt} [oui/non] : ").strip().lower()
    return ans in ("oui", "o", "yes", "y")


# ─── Logique principale ───────────────────────────────────────────────────────
async def reset(dry_run: bool = False, include_losses: bool = False):
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    print()
    hr()
    print("  SGP-PHARMA — NETTOYAGE DES DONNÉES DE TEST")
    print(f"  Base     : {DB_NAME}  ({MONGO_URL})")
    print(f"  Mode     : {'SIMULATION (--dry-run)' if dry_run else '⚠ SUPPRESSION RÉELLE'}")
    print(f"  Pertes   : {'incluses (--all)' if include_losses else 'conservées'}")
    hr()

    # ── 1. Vérification connexion ──────────────────────────────────────────────
    try:
        await client.admin.command("ping")
        print("\n[OK] Connexion MongoDB établie.")
    except Exception as e:
        print(f"\n[ERREUR] Impossible de se connecter à MongoDB : {e}")
        sys.exit(1)

    # ── 2. Compter les données existantes ──────────────────────────────────────
    nb_sales      = await db.sales.count_documents({})
    nb_presales   = await db.presales.count_documents({})
    nb_moves_out  = await db.stock_movements.count_documents({"type": "SORTIE_VENTE"})
    nb_losses     = await db.losses.count_documents({}) if include_losses else 0

    print(f"\n  Données trouvées :")
    print(f"    • Ventes              : {nb_sales}")
    print(f"    • Pré-ventes          : {nb_presales}")
    print(f"    • Mouvements SORTIE   : {nb_moves_out}")
    if include_losses:
        print(f"    • Pertes/losses       : {nb_losses}")

    if nb_sales + nb_presales + nb_moves_out + nb_losses == 0:
        print("\n  Aucune donnée transactionnelle trouvée. Rien à nettoyer.")
        return

    # ── 3. Confirmation ────────────────────────────────────────────────────────
    if not dry_run:
        print()
        print("  ⚠ ATTENTION : Cette opération est irréversible.")
        print("  Les produits, lots, utilisateurs et la pharmacie seront conservés.")
        if not confirm("  Confirmer la suppression des données de test ?"):
            print("\n  Annulé. Aucune modification effectuée.")
            return

    # ── 4. Restaurer le stock avant suppression des ventes ────────────────────
    if nb_sales > 0 and not dry_run:
        print("\n[1/4] Restauration du stock (annulation des sorties de vente)...")
        # Récupérer tous les mouvements SORTIE_VENTE avec batch_id
        cursor = db.stock_movements.find({"type": "SORTIE_VENTE", "batch_id": {"$exists": True, "$ne": None}})
        restored = 0
        async for mv in cursor:
            batch_id = mv.get("batch_id")
            qty      = mv.get("quantity", 0)
            if batch_id and qty > 0:
                result = await db.batches.update_one(
                    {"id": batch_id},
                    {"$inc": {"current_quantity": qty}}
                )
                if result.modified_count:
                    restored += 1
        print(f"    → {restored} lot(s) restauré(s).")
    elif dry_run:
        print("\n[1/4] [SIMULATION] Restauration du stock ignorée.")

    # ── 5. Supprimer les ventes ────────────────────────────────────────────────
    print(f"\n[2/4] {'[SIMULATION] ' if dry_run else ''}Suppression des ventes ({nb_sales})...")
    if not dry_run and nb_sales > 0:
        res = await db.sales.delete_many({})
        print(f"    → {res.deleted_count} vente(s) supprimée(s).")
    else:
        print(f"    → {nb_sales} vente(s) auraient été supprimées.")

    # ── 6. Supprimer les pré-ventes ────────────────────────────────────────────
    print(f"\n[3/4] {'[SIMULATION] ' if dry_run else ''}Suppression des pré-ventes ({nb_presales})...")
    if not dry_run and nb_presales > 0:
        res = await db.presales.delete_many({})
        print(f"    → {res.deleted_count} pré-vente(s) supprimée(s).")
    else:
        print(f"    → {nb_presales} pré-vente(s) auraient été supprimées.")

    # ── 7. Supprimer les mouvements de sortie ─────────────────────────────────
    print(f"\n[4/4] {'[SIMULATION] ' if dry_run else ''}Suppression des mouvements SORTIE_VENTE ({nb_moves_out})...")
    if not dry_run and nb_moves_out > 0:
        res = await db.stock_movements.delete_many({"type": "SORTIE_VENTE"})
        print(f"    → {res.deleted_count} mouvement(s) supprimé(s).")
    else:
        print(f"    → {nb_moves_out} mouvement(s) auraient été supprimés.")

    # ── 8. Pertes (optionnel) ──────────────────────────────────────────────────
    if include_losses and nb_losses > 0:
        print(f"\n[+] {'[SIMULATION] ' if dry_run else ''}Suppression des pertes ({nb_losses})...")
        if not dry_run:
            res = await db.losses.delete_many({})
            print(f"    → {res.deleted_count} perte(s) supprimée(s).")
        else:
            print(f"    → {nb_losses} perte(s) auraient été supprimées.")

    # ── 9. Résumé ──────────────────────────────────────────────────────────────
    print()
    hr()
    if dry_run:
        print("  [SIMULATION TERMINÉE] Aucune donnée modifiée.")
    else:
        print(f"  [SUCCÈS] Nettoyage terminé le {datetime.now().strftime('%d/%m/%Y à %H:%M:%S')}")
        print("  La base est prête pour la mise en production.")
    hr()
    print()
    client.close()


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Nettoyage des données de test SGP-Pharma"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulation uniquement — aucune suppression réelle"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="include_losses",
        help="Inclure aussi les pertes/losses dans le nettoyage"
    )
    args = parser.parse_args()
    asyncio.run(reset(dry_run=args.dry_run, include_losses=args.include_losses))
