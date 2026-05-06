"""Multi-tenant helpers for pharmacy_id scoping."""
from fastapi import HTTPException


def is_super(user: dict) -> bool:
    return user.get("role") == "super_admin"


def pharmacy_scope(user: dict, target_pharmacy_id: str | None = None) -> dict:
    """MongoDB filter dict scoping queries to user's pharmacy.

    super_admin: returns {} (sees all) unless target_pharmacy_id given.
    others: returns {"pharmacy_id": user.pharmacy_id}; raises if missing.
    """
    if is_super(user):
        return {"pharmacy_id": target_pharmacy_id} if target_pharmacy_id else {}
    pid = user.get("pharmacy_id")
    if not pid:
        raise HTTPException(status_code=403, detail="Aucune pharmacie assignée à cet utilisateur")
    return {"pharmacy_id": pid}


def stamp_pharmacy(user: dict, doc: dict, target_pharmacy_id: str | None = None) -> dict:
    """Attach pharmacy_id to a doc being created."""
    if is_super(user):
        # super_admin must specify target
        if target_pharmacy_id:
            doc["pharmacy_id"] = target_pharmacy_id
        elif user.get("pharmacy_id"):
            doc["pharmacy_id"] = user["pharmacy_id"]
        else:
            raise HTTPException(status_code=400, detail="pharmacy_id requis pour super_admin")
    else:
        if not user.get("pharmacy_id"):
            raise HTTPException(status_code=403, detail="Aucune pharmacie assignée")
        doc["pharmacy_id"] = user["pharmacy_id"]
    return doc


def assert_same_pharmacy(user: dict, doc: dict | None) -> dict:
    """Ensure the document belongs to user's pharmacy. super_admin bypasses."""
    if doc is None:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    if is_super(user):
        return doc
    if doc.get("pharmacy_id") != user.get("pharmacy_id"):
        raise HTTPException(status_code=403, detail="Ressource non autorisée pour votre pharmacie")
    return doc
