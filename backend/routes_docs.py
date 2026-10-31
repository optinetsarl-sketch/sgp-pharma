"""Serve user manual documentation files."""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from auth import get_current_user

router = APIRouter(prefix="/api/docs", tags=["docs"])

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
if not DOCS_DIR.exists():
    DOCS_DIR = Path("/app/docs")


@router.get("/manual.pdf")
async def manual_pdf(_: dict = Depends(get_current_user)):
    p = DOCS_DIR / "SGP-Pharma_Manuel_Utilisateur.pdf"
    if not p.exists():
        raise HTTPException(404, "Manuel PDF introuvable")
    return FileResponse(str(p), media_type="application/pdf", filename=p.name)


@router.get("/manual.pptx")
async def manual_pptx(_: dict = Depends(get_current_user)):
    p = DOCS_DIR / "SGP-Pharma_Manuel_Utilisateur.pptx"
    if not p.exists():
        raise HTTPException(404, "Manuel PowerPoint introuvable")
    return FileResponse(
        str(p),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=p.name,
    )


@router.get("/quickstart-caissier.pdf")
async def quickstart_caissier(_: dict = Depends(get_current_user)):
    p = DOCS_DIR / "QuickStart_Caissier.pdf"
    if not p.exists():
        raise HTTPException(404, "Guide Caissier introuvable")
    return FileResponse(str(p), media_type="application/pdf", filename=p.name)


@router.get("/quickstart-magasinier.pdf")
async def quickstart_magasinier(_: dict = Depends(get_current_user)):
    p = DOCS_DIR / "QuickStart_Magasinier.pdf"
    if not p.exists():
        raise HTTPException(404, "Guide Magasinier introuvable")
    return FileResponse(str(p), media_type="application/pdf", filename=p.name)
