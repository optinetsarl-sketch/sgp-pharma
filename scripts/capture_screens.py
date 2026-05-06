"""Capture all SGP-Pharma screens and generate a presentation PDF.

Usage: python /app/scripts/generate_doc.py
Output: /app/docs/SGP-Pharma_Manuel_Utilisateur.pdf
"""
import os
import shutil
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
OUT_DIR = Path("/app/docs/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# (route, filename, login_email, login_password, after_load_actions)
SCREENS = [
    # Login as admin first
    ("/", "01_dashboard.png", "admin@sgp-pharma.tg", "Admin@2026", None),
    ("/products", "02_produits.png", None, None, None),
    ("/stock", "03_stock_lots.png", None, None, None),
    ("/reception", "04_reception.png", None, None, None),
    ("/orders", "05_commandes.png", None, None, None),
    ("/suppliers", "06_fournisseurs.png", None, None, None),
    ("/pos", "07_caisse_pos.png", None, None, "click_first_product"),
    ("/losses", "08_pertes.png", None, None, None),
    ("/reports", "09_rapports.png", None, None, None),
    ("/users", "10_utilisateurs.png", None, None, None),
    ("/audit", "11_audit_log.png", None, None, None),
    ("/pharmacies", "12_pharmacies.png", None, None, None),
    # Re-login as super_admin to show super_admin view
    ("/", "13_super_admin_dashboard.png", "optinet@sgp-pharma.tg", "Optinet@2026", None),
    ("/pharmacies", "14_super_admin_pharmacies.png", None, None, None),
]


async def login(page, email, password):
    await page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(800)
    await page.fill('[data-testid="login-email-input"]', email)
    await page.fill('[data-testid="login-password-input"]', password)
    await page.click('[data-testid="login-submit-btn"]')
    await page.wait_for_timeout(2500)


async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await context.new_page()

        current_email = None
        for route, fname, email, password, action in SCREENS:
            if email and email != current_email:
                # Logout first if already logged in
                if current_email:
                    try:
                        await page.click('[data-testid="logout-btn"]', timeout=3000)
                        await page.wait_for_timeout(800)
                    except Exception:
                        pass
                await login(page, email, password)
                current_email = email

            await page.goto(f"{BASE_URL}{route}", wait_until="networkidle", timeout=20000)
            await page.wait_for_timeout(1500)

            if action == "click_first_product":
                try:
                    await page.click('[data-testid^="pos-product-"]', timeout=2000)
                    await page.wait_for_timeout(500)
                    # add a 2nd different product to populate cart
                    btns = await page.locator('[data-testid^="pos-product-"]').all()
                    if len(btns) > 2:
                        await btns[2].click()
                        await page.wait_for_timeout(400)
                except Exception:
                    pass

            await page.screenshot(path=str(OUT_DIR / fname), full_page=False)
            print(f"Captured {fname}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(capture())
    print(f"\nAll screenshots saved to {OUT_DIR}")
