"""Backend regression test suite for SGP-Pharma.
Covers: auth, products, suppliers, batches, reception, sales (FEFO),
losses, purchase orders, dashboard, reports, users, audit logs, RBAC.
"""
import os
import time
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@sgp-pharma.tg", "Admin@2026"),
    "pharmacist": ("pharmacien@sgp-pharma.tg", "Pharma@2026"),
    "cashier": ("caissier@sgp-pharma.tg", "Cash@2026"),
    "storekeeper": ("magasinier@sgp-pharma.tg", "Store@2026"),
}


def login(role: str) -> str:
    email, pwd = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["email"] == email
    return data["access_token"]


def hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---- Module: Auth ----
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_admin(self):
        tok = login("admin")
        assert isinstance(tok, str) and len(tok) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self):
        tok = login("admin")
        r = requests.get(f"{API}/auth/me", headers=hdr(tok))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        assert "password_hash" not in r.json()

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_login_all_roles(self):
        for role in CREDS:
            tok = login(role)
            r = requests.get(f"{API}/auth/me", headers=hdr(tok))
            assert r.status_code == 200, f"me failed for {role}"
            assert r.json()["role"] == role


# ---- Module: Dashboard ----
class TestDashboard:
    def test_dashboard_kpis(self):
        tok = login("admin")
        r = requests.get(f"{API}/dashboard", headers=hdr(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["ca_today", "ca_month", "stock_value", "alerts", "low_stock", "chart_7d"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["chart_7d"], list) and len(d["chart_7d"]) == 7
        assert "expired" in d["alerts"]


# ---- Module: Products & Categories ----
class TestProducts:
    def test_list_products(self):
        tok = login("admin")
        r = requests.get(f"{API}/products", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        assert "stock_total" in items[0]
        assert "nom_commercial" in items[0]

    def test_search_products(self):
        tok = login("admin")
        r = requests.get(f"{API}/products?q=Para", headers=hdr(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_and_suppliers(self):
        tok = login("admin")
        for ep in ["/categories", "/suppliers"]:
            r = requests.get(f"{API}{ep}", headers=hdr(tok))
            assert r.status_code == 200, f"{ep} -> {r.status_code}"
            assert isinstance(r.json(), list)

    def test_create_product_admin(self):
        tok = login("admin")
        cats = requests.get(f"{API}/categories", headers=hdr(tok)).json()
        cid = cats[0]["id"] if cats else None
        payload = {
            "code_barre": f"TEST{int(time.time())}",
            "nom_commercial": "TEST_Product",
            "dci": "test-dci",
            "forme": "comprimé",
            "dosage": "100mg",
            "category_id": cid,
            "prix_achat": 100.0,
            "prix_vente": 200.0,
            "tva": 0,
            "seuil_alerte_stock": 5,
            "requires_prescription": False,
        }
        r = requests.post(f"{API}/products", json=payload, headers=hdr(tok))
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # GET to verify persistence
        g = requests.get(f"{API}/products/{pid}", headers=hdr(tok))
        assert g.status_code == 200
        assert g.json()["nom_commercial"] == "TEST_Product"
        # cleanup
        requests.delete(f"{API}/products/{pid}", headers=hdr(tok))

    def test_create_product_cashier_forbidden(self):
        tok = login("cashier")
        r = requests.post(f"{API}/products", json={
            "code_barre": "X1", "nom_commercial": "n", "dci": "d",
            "forme": "f", "dosage": "1", "prix_achat": 1, "prix_vente": 1,
        }, headers=hdr(tok))
        assert r.status_code == 403


# ---- Module: Batches ----
class TestBatches:
    def test_list_batches(self):
        tok = login("admin")
        r = requests.get(f"{API}/batches", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            assert "product_name" in items[0]
            assert "expiry_date" in items[0]

    def test_expiring(self):
        tok = login("admin")
        r = requests.get(f"{API}/batches/expiring?days=180", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            assert "expired" in items[0]


# ---- Module: Reception ----
class TestReception:
    def test_reception_rejects_expired(self):
        tok = login("admin")
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        sups = requests.get(f"{API}/suppliers", headers=hdr(tok)).json()
        pid = prods[0]["id"]
        sid = sups[0]["id"] if sups else None
        past = (date.today() - timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/reception", json={
            "supplier_id": sid,
            "items": [{"product_id": pid, "batch_number": "EXPIRED", "expiry_date": past, "purchase_price": 10, "quantity": 5}],
        }, headers=hdr(tok))
        assert r.status_code == 400

    def test_reception_creates_batch(self):
        tok = login("admin")
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        sups = requests.get(f"{API}/suppliers", headers=hdr(tok)).json()
        pid = prods[0]["id"]
        sid = sups[0]["id"] if sups else None
        future = (date.today() + timedelta(days=400)).isoformat()
        bn = f"TEST{int(time.time())}"
        r = requests.post(f"{API}/reception", json={
            "supplier_id": sid,
            "items": [{"product_id": pid, "batch_number": bn, "expiry_date": future, "purchase_price": 50, "quantity": 10}],
        }, headers=hdr(tok))
        assert r.status_code == 200, r.text
        batch_ids = r.json()["batch_ids"]
        assert len(batch_ids) == 1
        # Verify batch exists
        all_batches = requests.get(f"{API}/batches?product_id={pid}", headers=hdr(tok)).json()
        assert any(b["id"] == batch_ids[0] for b in all_batches)
        # verify movement created
        movs = requests.get(f"{API}/stock-movements?product_id={pid}", headers=hdr(tok)).json()
        assert any(m.get("batch_id") == batch_ids[0] and m["type"] == "ENTREE_ACHAT" for m in movs)


# ---- Module: Sales / FEFO ----
class TestSalesFEFO:
    def _find_product(self, tok, name_contains="Para"):
        prods = requests.get(f"{API}/products?q={name_contains}", headers=hdr(tok)).json()
        for p in prods:
            if p.get("stock_total", 0) > 0 and not p.get("requires_prescription"):
                return p
        # fallback: any non-prescription product with stock
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        for p in prods:
            if p.get("stock_total", 0) > 0 and not p.get("requires_prescription"):
                return p
        return None

    def test_preview_fefo_order(self):
        tok = login("admin")
        p = self._find_product(tok)
        assert p, "no product with stock"
        r = requests.get(f"{API}/pos/preview-fefo?product_id={p['id']}&quantity=1", headers=hdr(tok))
        assert r.status_code == 200
        plan = r.json()["plan"]
        assert isinstance(plan, list)
        # plan order must be ascending expiry
        if len(plan) > 1:
            exps = [it["expiry_date"] for it in plan]
            assert exps == sorted(exps), "FEFO plan not sorted by expiry asc"

    def test_sale_fefo_picks_earliest(self):
        tok = login("admin")
        p = self._find_product(tok)
        assert p, "no product with stock"
        # get expected batch via preview
        prev = requests.get(f"{API}/pos/preview-fefo?product_id={p['id']}&quantity=1", headers=hdr(tok)).json()
        if not prev["plan"]:
            pytest.skip("no available batch")
        expected_batch = prev["plan"][0]["batch_id"]
        r = requests.post(f"{API}/sales", json={
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "cash",
        }, headers=hdr(tok))
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["items"][0]["batch_id"] == expected_batch, "FEFO did not pick earliest expiry"
        # GET sale persistence
        g = requests.get(f"{API}/sales/{sale['id']}", headers=hdr(tok))
        assert g.status_code == 200
        # movement was created
        movs = requests.get(f"{API}/stock-movements?product_id={p['id']}", headers=hdr(tok)).json()
        assert any(m.get("reference_id") == sale["id"] and m["type"] == "SORTIE_VENTE" for m in movs)

    def test_sale_skips_expired_batch(self):
        """Expired batches must never be sold (FEFO filters by expiry_date>=today)."""
        tok = login("admin")
        # Find a product whose preview plan does not include batches with expiry < today
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        for p in prods:
            if p.get("stock_total", 0) <= 0 or p.get("requires_prescription"):
                continue
            r = requests.get(f"{API}/pos/preview-fefo?product_id={p['id']}&quantity=1", headers=hdr(tok))
            plan = r.json().get("plan", [])
            today = date.today().isoformat()
            assert all(it["expiry_date"] >= today for it in plan), f"FEFO included expired batch for {p['nom_commercial']}"

    def test_prescription_required(self):
        tok = login("admin")
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        rx = next((p for p in prods if p.get("requires_prescription") and p.get("stock_total", 0) > 0), None)
        if not rx:
            pytest.skip("no prescription product with stock")
        # without prescription_ref => 400
        r = requests.post(f"{API}/sales", json={
            "items": [{"product_id": rx["id"], "quantity": 1}],
            "payment_method": "cash",
        }, headers=hdr(tok))
        assert r.status_code == 400
        # with prescription_ref => 200
        r2 = requests.post(f"{API}/sales", json={
            "items": [{"product_id": rx["id"], "quantity": 1}],
            "payment_method": "cash",
            "prescription_ref": "RX-TEST-001",
        }, headers=hdr(tok))
        assert r2.status_code == 200, r2.text

    def test_sale_decrements_atomically(self):
        tok = login("admin")
        p = self._find_product(tok)
        assert p
        before_stock = p["stock_total"]
        r = requests.post(f"{API}/sales", json={
            "items": [{"product_id": p["id"], "quantity": 1}],
            "payment_method": "cash",
        }, headers=hdr(tok))
        assert r.status_code == 200
        after = next((x for x in requests.get(f"{API}/products?q={p['nom_commercial'][:5]}", headers=hdr(tok)).json() if x["id"] == p["id"]), None)
        assert after and after["stock_total"] == before_stock - 1


# ---- Module: Losses ----
class TestLosses:
    def test_loss_decrement(self):
        tok = login("admin")
        batches = requests.get(f"{API}/batches", headers=hdr(tok)).json()
        b = next((x for x in batches if x.get("current_quantity", 0) >= 2 and x.get("status") == "active"), None)
        if not b:
            pytest.skip("no batch available")
        before = b["current_quantity"]
        r = requests.post(f"{API}/losses", json={
            "batch_id": b["id"], "quantity": 1, "motif": "casse", "notes": "TEST_loss"
        }, headers=hdr(tok))
        assert r.status_code == 200, r.text
        after_b = next(x for x in requests.get(f"{API}/batches?product_id={b['product_id']}", headers=hdr(tok)).json() if x["id"] == b["id"])
        assert after_b["current_quantity"] == before - 1
        movs = requests.get(f"{API}/stock-movements?product_id={b['product_id']}", headers=hdr(tok)).json()
        assert any(m["type"].startswith("PERTE_") for m in movs)


# ---- Module: Users ----
class TestUsers:
    def test_list_users_admin(self):
        tok = login("admin")
        r = requests.get(f"{API}/users", headers=hdr(tok))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        assert all("password_hash" not in u for u in users)

    def test_list_users_storekeeper_forbidden(self):
        tok = login("storekeeper")
        r = requests.get(f"{API}/users", headers=hdr(tok))
        assert r.status_code == 403

    def test_create_user(self):
        tok = login("admin")
        email = f"TEST_user_{int(time.time())}@x.tg"
        r = requests.post(f"{API}/users", json={
            "email": email, "name": "TEST_New", "role": "cashier", "password": "Pwd@2026"
        }, headers=hdr(tok))
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        assert "password_hash" not in r.json()
        # verify can login
        l = requests.post(f"{API}/auth/login", json={"email": email, "password": "Pwd@2026"})
        assert l.status_code == 200
        # cleanup
        requests.delete(f"{API}/users/{uid}", headers=hdr(tok))


# ---- Module: Audit & Reports ----
class TestAuditReports:
    def test_audit_logs(self):
        tok = login("admin")
        r = requests.get(f"{API}/audit-logs", headers=hdr(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_cashier_forbidden(self):
        tok = login("cashier")
        r = requests.get(f"{API}/audit-logs", headers=hdr(tok))
        assert r.status_code == 403

    def test_reports(self):
        tok = login("admin")
        for ep in ["/reports/sales", "/reports/top-products", "/reports/margins"]:
            r = requests.get(f"{API}{ep}", headers=hdr(tok))
            assert r.status_code == 200, f"{ep} -> {r.status_code}"


# ---- Module: Purchase Orders ----
class TestPurchaseOrders:
    def test_create_and_list_po(self):
        tok = login("admin")
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        sups = requests.get(f"{API}/suppliers", headers=hdr(tok)).json()
        if not sups:
            pytest.skip("no supplier")
        r = requests.post(f"{API}/purchase-orders", json={
            "supplier_id": sups[0]["id"],
            "items": [{"product_id": prods[0]["id"], "quantity": 5, "unit_price": 100.0}],
            "notes": "TEST_PO",
        }, headers=hdr(tok))
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        assert r.json()["total"] == 500.0
        lst = requests.get(f"{API}/purchase-orders", headers=hdr(tok)).json()
        assert any(o["id"] == oid for o in lst)
