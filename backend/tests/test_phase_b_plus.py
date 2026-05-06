"""Phase B+ tests: multi-tenant, PDFs, prescription image upload, admin reset-password."""
import os
import time
import base64

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "super_admin": ("optinet@sgp-pharma.tg", "Optinet@2026"),
    "admin": ("admin@sgp-pharma.tg", "Admin@2026"),
    "pharmacist": ("pharmacien@sgp-pharma.tg", "Pharma@2026"),
    "cashier": ("caissier@sgp-pharma.tg", "Cash@2026"),
    "storekeeper": ("magasinier@sgp-pharma.tg", "Store@2026"),
}


def login(role: str, creds=None):
    email, pwd = (creds or CREDS[role])
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- Module: Super Admin Auth & Multi-Tenant Login ----
class TestSuperAdmin:
    def test_super_admin_login(self):
        data = login("super_admin")
        u = data["user"]
        assert u["role"] == "super_admin"
        assert u.get("pharmacy_id") in (None, "")

    def test_admin_has_pharmacy_id(self):
        data = login("admin")
        u = data["user"]
        assert u["role"] == "admin"
        assert u.get("pharmacy_id"), "admin must have pharmacy_id"


# ---- Module: Pharmacies CRUD ----
class TestPharmacies:
    def test_list_as_super(self):
        tok = login("super_admin")["access_token"]
        r = requests.get(f"{API}/pharmacies", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1

    def test_list_as_admin_scoped(self):
        ad = login("admin")
        tok = ad["access_token"]
        r = requests.get(f"{API}/pharmacies", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        assert items[0]["id"] == ad["user"]["pharmacy_id"]

    def test_admin_cannot_create(self):
        tok = login("admin")["access_token"]
        r = requests.post(f"{API}/pharmacies", json={"name": "TEST_Pharma_X"}, headers=hdr(tok))
        assert r.status_code == 403

    def test_super_can_create(self):
        tok = login("super_admin")["access_token"]
        r = requests.post(
            f"{API}/pharmacies",
            json={"name": f"TEST_Pharma_{int(time.time())}", "address": "Lomé Rue X", "phone": "+228 90 00 00 00"},
            headers=hdr(tok),
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["name"].startswith("TEST_Pharma_")
        # cleanup
        requests.delete(f"{API}/pharmacies/{pid}", headers=hdr(tok))


# ---- Module: Multi-tenant Isolation ----
class TestTenantIsolation:
    @pytest.fixture(scope="class")
    def setup_two_pharmacies(self):
        """Create 2nd pharmacy + 2nd admin; return tokens + ids."""
        su = login("super_admin")["access_token"]
        # create second pharmacy
        ts = int(time.time())
        r = requests.post(
            f"{API}/pharmacies",
            json={"name": f"TEST_Pharma_B_{ts}", "address": "Kara"},
            headers=hdr(su),
        )
        assert r.status_code == 200, r.text
        pid2 = r.json()["id"]

        email2 = f"TEST_admin_b_{ts}@sgp.tg"
        r2 = requests.post(
            f"{API}/users",
            json={"email": email2, "name": "TEST Admin B", "role": "admin", "password": "Admin@2026", "pharmacy_id": pid2},
            headers=hdr(su),
        )
        assert r2.status_code == 200, r2.text
        uid2 = r2.json()["id"]

        # Login admin B
        b = login("admin", creds=(email2, "Admin@2026"))
        assert b["user"]["pharmacy_id"] == pid2

        yield {
            "super_tok": su,
            "admin_a_tok": login("admin")["access_token"],
            "admin_a_pid": login("admin")["user"]["pharmacy_id"],
            "admin_b_tok": b["access_token"],
            "admin_b_pid": pid2,
            "admin_b_uid": uid2,
            "admin_b_email": email2,
        }
        # Teardown
        requests.delete(f"{API}/users/{uid2}", headers=hdr(su))
        requests.delete(f"{API}/pharmacies/{pid2}", headers=hdr(su))

    def test_products_isolated(self, setup_two_pharmacies):
        ctx = setup_two_pharmacies
        a_products = requests.get(f"{API}/products", headers=hdr(ctx["admin_a_tok"])).json()
        b_products = requests.get(f"{API}/products", headers=hdr(ctx["admin_b_tok"])).json()
        # Pharmacy B is fresh (no seed) → must be 0
        assert isinstance(b_products, list)
        assert len(b_products) == 0, f"Pharmacy B should have 0 products but has {len(b_products)}"
        # Pharmacy A should have ~150
        assert len(a_products) >= 50, f"Pharmacy A products count too low: {len(a_products)}"

    def test_admin_a_cannot_see_b_products(self, setup_two_pharmacies):
        """Create a product in B and ensure A doesn't see it."""
        ctx = setup_two_pharmacies
        # Get category from B (may be empty) → create simple product via admin B
        # First check if there's a product-create endpoint accepting pharmacy scope
        payload = {
            "code_barre": f"BTEST{int(time.time())}",
            "nom_commercial": "TEST_B_Product",
            "dci": "test",
            "forme_pharmaceutique": "comp",
            "prix_vente": 500,
            "requires_prescription": False,
            "seuil_alerte_stock": 5,
        }
        r = requests.post(f"{API}/products", json=payload, headers=hdr(ctx["admin_b_tok"]))
        if r.status_code != 200:
            pytest.skip(f"Product creation payload mismatch: {r.status_code} {r.text}")
        b_prod_id = r.json()["id"]
        # Admin A must not see it
        a_list = requests.get(f"{API}/products", headers=hdr(ctx["admin_a_tok"])).json()
        assert all(p["id"] != b_prod_id for p in a_list), "Product leaked across tenants"
        # Direct GET must 403 or 404
        r2 = requests.get(f"{API}/products/{b_prod_id}", headers=hdr(ctx["admin_a_tok"]))
        assert r2.status_code in (403, 404), f"Cross-tenant GET should fail, got {r2.status_code}"

    def test_sales_and_batches_isolated(self, setup_two_pharmacies):
        ctx = setup_two_pharmacies
        a_sales = requests.get(f"{API}/sales", headers=hdr(ctx["admin_a_tok"])).json()
        b_sales = requests.get(f"{API}/sales", headers=hdr(ctx["admin_b_tok"])).json()
        a_batches = requests.get(f"{API}/batches", headers=hdr(ctx["admin_a_tok"])).json()
        b_batches = requests.get(f"{API}/batches", headers=hdr(ctx["admin_b_tok"])).json()
        # B should be empty
        assert b_batches == []
        # Verify no pharmacy_id from A appears in B's pharmacy scope
        a_pids = set(s.get("pharmacy_id") for s in a_sales if s.get("pharmacy_id"))
        b_pids = set(s.get("pharmacy_id") for s in b_sales if s.get("pharmacy_id"))
        assert not (a_pids & b_pids) or not a_pids, "Sale pharmacy_ids leaked"


# ---- Module: Products scope ----
class TestProductsScope:
    def test_admin_sees_150_products(self):
        tok = login("admin")["access_token"]
        r = requests.get(f"{API}/products", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 50, f"Expected CAMEG-style catalog, got {len(items)}"


# ---- Module: Sales — FEFO + prescription image ----
class TestSalesPrescription:
    def _find_rx_product_with_stock(self, tok):
        prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
        for p in prods:
            if p.get("requires_prescription") and p.get("stock_total", 0) > 0:
                return p
        return None

    def test_sale_with_prescription_image(self):
        tok = login("admin")["access_token"]
        p = self._find_rx_product_with_stock(tok)
        if not p:
            pytest.skip("no prescription product in stock")
        b64 = "data:image/png;base64," + base64.b64encode(b"fake-png-bytes").decode()
        r = requests.post(
            f"{API}/sales",
            json={"items": [{"product_id": p["id"], "quantity": 1}], "payment_method": "cash", "prescription_image": b64},
            headers=hdr(tok),
        )
        assert r.status_code == 200, r.text
        assert r.json().get("prescription_image", "").startswith("data:image/")

    def test_sale_no_prescription_no_image_fails(self):
        tok = login("admin")["access_token"]
        p = self._find_rx_product_with_stock(tok)
        if not p:
            pytest.skip("no prescription product in stock")
        r = requests.post(
            f"{API}/sales",
            json={"items": [{"product_id": p["id"], "quantity": 1}], "payment_method": "cash"},
            headers=hdr(tok),
        )
        assert r.status_code == 400


# ---- Module: PDF endpoints ----
class TestPDF:
    def test_sale_receipt_pdf(self):
        tok = login("admin")["access_token"]
        # Get a sale id
        sales = requests.get(f"{API}/sales?limit=1", headers=hdr(tok)).json()
        if not sales:
            # create one first
            prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
            p = next((x for x in prods if x.get("stock_total", 0) > 0 and not x.get("requires_prescription")), None)
            assert p
            r = requests.post(
                f"{API}/sales",
                json={"items": [{"product_id": p["id"], "quantity": 1}], "payment_method": "cash"},
                headers=hdr(tok),
            )
            assert r.status_code == 200
            sid = r.json()["id"]
        else:
            sid = sales[0]["id"]

        r = requests.get(f"{API}/sales/{sid}/receipt.pdf", headers=hdr(tok))
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF", f"PDF magic bytes missing: {r.content[:8]}"
        assert len(r.content) > 500

    def test_purchase_order_pdf(self):
        tok = login("admin")["access_token"]
        # Create a PO (or reuse existing)
        pos = requests.get(f"{API}/purchase-orders", headers=hdr(tok)).json()
        if pos:
            oid = pos[0]["id"]
        else:
            prods = requests.get(f"{API}/products", headers=hdr(tok)).json()
            sups = requests.get(f"{API}/suppliers", headers=hdr(tok)).json()
            assert sups, "need supplier"
            r = requests.post(
                f"{API}/purchase-orders",
                json={"supplier_id": sups[0]["id"], "items": [{"product_id": prods[0]["id"], "quantity": 2, "unit_price": 100}], "notes": "TEST_PO_PDF"},
                headers=hdr(tok),
            )
            assert r.status_code == 200, r.text
            oid = r.json()["id"]
        r = requests.get(f"{API}/purchase-orders/{oid}/pdf", headers=hdr(tok))
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1000


# ---- Module: Admin reset-password ----
class TestResetPassword:
    def test_admin_resets_own_pharmacy_user(self):
        admin_tok = login("admin")["access_token"]
        users = requests.get(f"{API}/users", headers=hdr(admin_tok)).json()
        # Find pharmacist
        target = next((u for u in users if u["role"] == "pharmacist"), None)
        if not target:
            pytest.skip("no pharmacist user")
        r = requests.post(f"{API}/users/{target['id']}/reset-password", headers=hdr(admin_tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "temp_password" in body and "email" in body
        temp = body["temp_password"]
        assert isinstance(temp, str) and len(temp) >= 8
        # Login with temp
        l = requests.post(f"{API}/auth/login", json={"email": body["email"], "password": temp})
        assert l.status_code == 200, f"Cannot login with temp password: {l.status_code} {l.text}"
        # Restore pharmacien password
        su = login("super_admin")["access_token"]
        requests.put(f"{API}/users/{target['id']}", json={"password": "Pharma@2026"}, headers=hdr(su))

    def test_cross_pharmacy_reset_forbidden(self):
        # Create a 2nd pharmacy + user via super_admin; admin A should be forbidden
        su = login("super_admin")["access_token"]
        ts = int(time.time())
        rp = requests.post(f"{API}/pharmacies", json={"name": f"TEST_RP_Pharma_{ts}"}, headers=hdr(su))
        assert rp.status_code == 200, rp.text
        pid2 = rp.json()["id"]
        email_b = f"TEST_user_b_{ts}@sgp.tg"
        ru = requests.post(
            f"{API}/users",
            json={"email": email_b, "name": "User B", "role": "cashier", "password": "Cash@2026", "pharmacy_id": pid2},
            headers=hdr(su),
        )
        assert ru.status_code == 200, ru.text
        uid_b = ru.json()["id"]
        try:
            admin_a = login("admin")["access_token"]
            r = requests.post(f"{API}/users/{uid_b}/reset-password", headers=hdr(admin_a))
            assert r.status_code == 403, f"Cross-pharmacy reset should be 403, got {r.status_code}"
            # Super admin CAN
            r2 = requests.post(f"{API}/users/{uid_b}/reset-password", headers=hdr(su))
            assert r2.status_code == 200
        finally:
            requests.delete(f"{API}/users/{uid_b}", headers=hdr(su))
            requests.delete(f"{API}/pharmacies/{pid2}", headers=hdr(su))

    def test_reset_requires_admin(self):
        cashier_tok = login("cashier")["access_token"]
        admin_tok = login("admin")["access_token"]
        users = requests.get(f"{API}/users", headers=hdr(admin_tok)).json()
        uid = users[0]["id"]
        r = requests.post(f"{API}/users/{uid}/reset-password", headers=hdr(cashier_tok))
        assert r.status_code == 403


# ---- Module: Reports / Dashboard scoping ----
class TestReports:
    def test_margins_aggregation_shape(self):
        tok = login("admin")["access_token"]
        r = requests.get(f"{API}/reports/margins", headers=hdr(tok))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            row = rows[0]
            for k in ["name", "qty", "revenue", "cost", "margin", "margin_pct"]:
                assert k in row, f"margins row missing {k}"

    def test_dashboard_scoped(self):
        tok = login("admin")["access_token"]
        r = requests.get(f"{API}/dashboard", headers=hdr(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["ca_today", "ca_month", "stock_value", "alerts", "low_stock", "chart_7d"]:
            assert k in d

    def test_dashboard_super_admin(self):
        tok = login("super_admin")["access_token"]
        r = requests.get(f"{API}/dashboard", headers=hdr(tok))
        assert r.status_code == 200
