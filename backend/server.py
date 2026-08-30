from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import get_db, close_db
from auth import router as auth_router, seed_admin
from routes_products import router as products_router
from routes_inventory import router as inventory_router
from routes_sales import router as sales_router
from routes_admin import router as admin_router
from routes_pharmacies import router as pharmacies_router
from routes_pdf import router as pdf_router
from routes_docs import router as docs_router
from routes_presales import router as presales_router
from seed import seed_demo

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="SGP-Pharma API", version="1.0.0")

# CORS: local frontend only.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"name": "SGP-Pharma API", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(sales_router)
app.include_router(admin_router)
app.include_router(pharmacies_router)
app.include_router(pdf_router)
app.include_router(docs_router)
app.include_router(presales_router)


@app.on_event("startup")
async def on_startup():
    db = get_db()
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.products.create_index("code_barre")
    await db.products.create_index([("pharmacy_id", 1), ("code_barre", 1)], unique=True, sparse=True)
    await db.products.create_index("id", unique=True)
    await db.products.create_index("nom_commercial")
    await db.batches.create_index("id", unique=True)
    await db.batches.create_index("product_id")
    await db.batches.create_index("expiry_date")
    await db.suppliers.create_index("id", unique=True)
    await db.sales.create_index("id", unique=True)
    await db.sales.create_index("date")
    await db.stock_movements.create_index("product_id")
    await db.stock_movements.create_index("batch_id")
    await db.stock_movements.create_index("created_at")
    await db.audit_logs.create_index("created_at")
    await db.login_attempts.create_index("identifier")
    await db.categories.create_index("id", unique=True)
    await db.purchase_orders.create_index("id", unique=True)
    await db.losses.create_index("id", unique=True)
    await db.pharmacies.create_index("id", unique=True)
    # Multi-tenant indexes
    await db.products.create_index("pharmacy_id")
    await db.batches.create_index("pharmacy_id")
    await db.sales.create_index("pharmacy_id")
    await db.users.create_index("pharmacy_id")
    await db.suppliers.create_index("pharmacy_id")
    await db.categories.create_index("pharmacy_id")
    await db.audit_logs.create_index("pharmacy_id")
    await db.purchase_orders.create_index("pharmacy_id")
    await db.losses.create_index("pharmacy_id")
    await db.stock_movements.create_index("pharmacy_id")

    await seed_admin()
    await seed_demo()
    logger.info("SGP-Pharma startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    await close_db()


# --- SERVE FRONTEND STATIC FILES (STANDALONE PRODUCTION BUNDLE) ---
import sys
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_build_dir = Path(__file__).resolve().parent.parent / "frontend" / "build"
if not frontend_build_dir.exists() and hasattr(sys, "_MEIPASS"):
    frontend_build_dir = Path(sys._MEIPASS) / "frontend_build"

if frontend_build_dir.exists():
    static_assets = frontend_build_dir / "static"
    if static_assets.exists():
        app.mount("/static", StaticFiles(directory=str(static_assets)), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path and (frontend_build_dir / full_path).is_file():
            return FileResponse(frontend_build_dir / full_path)
        index_html = frontend_build_dir / "index.html"
        if index_html.exists():
            return FileResponse(index_html)
        return {"error": "Frontend build not found"}
