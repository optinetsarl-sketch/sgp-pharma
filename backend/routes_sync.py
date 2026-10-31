"""
Routes API pour la synchronisation MongoDB Atlas & Mode Hors-ligne.
"""
from fastapi import APIRouter, Depends
from auth import get_current_user
from sync_service import sync_manager

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.get("/status")
async def get_sync_status(user: dict = Depends(get_current_user)):
    """Retourne l'état de la synchronisation (en ligne, hors-ligne, attente, etc.)."""
    return sync_manager.get_status()


@router.post("/trigger")
async def trigger_manual_sync(user: dict = Depends(get_current_user)):
    """Déclenche un cycle de synchronisation immédiat sans attendre le délai automatique."""
    sync_manager.trigger_now()
    # Exécuter immédiatement et renvoyer le résultat
    result = await sync_manager.perform_sync_cycle()
    status = sync_manager.get_status()
    return {"message": "Synchronisation déclenchée", "result": result, "status": status}

