"""Unit tests for Pre-sales & Operator workflow."""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "super_admin": ("optinet@sgp-pharma.tg", "Optinet@2026"),
    "admin": ("admin@sgp-pharma.tg", "Admin@2026"),
    "pharmacist": ("pharmacien@sgp-pharma.tg", "Pharma@2026"),
    "cashier": ("caissier@sgp-pharma.tg", "Cash@2026"),
    "storekeeper": ("magasinier@sgp-pharma.tg", "Store@2026"),
    "operator": ("vendeur@sgp-pharma.tg", "Vendeur@2026"),
}


def login(role: str):
    email, pwd = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestOperatorPresales:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.operator_data = login("operator")
        self.op_tok = self.operator_data["token"]
        self.cashier_data = login("cashier")
        self.cash_tok = self.cashier_data["token"]

    def test_operator_login(self):
        u = self.operator_data["user"]
        assert u["role"] == "operator"
        assert u["email"] == "vendeur@sgp-pharma.tg"
        assert u.get("pharmacy_id") is not None

    def test_create_and_recall_presale_flow(self):
        # 1. Fetch available products
        r = requests.get(f"{API}/products", headers=hdr(self.op_tok), timeout=10)
        assert r.status_code == 200
        products = r.json()
        avail = [p for p in products if (p.get("stock_total") or 0) >= 2 and not p.get("requires_prescription")]
        assert len(avail) > 0, "Needs at least one active non-rx product with stock >= 2"
        target_prod = avail[0]

        # 2. Operator creates a pre-sale cart
        payload = {
            "items": [
                {
                    "product_id": target_prod["id"],
                    "quantity": 1,
                    "unit_price": target_prod["prix_vente"],
                    "product_name": target_prod["nom_commercial"],
                }
            ],
            "customer_name": "Test Client Yao",
            "notes": "Guichet conseil",
        }

        r_create = requests.post(f"{API}/presales", headers=hdr(self.op_tok), json=payload, timeout=10)
        assert r_create.status_code == 200, f"Create presale failed: {r_create.text}"
        data = r_create.json()
        assert data.get("ok") is True
        presale = data["presale"]
        presale_id = presale["id"]
        ticket_number = presale["ticket_number"]
        assert ticket_number.startswith("PV-")
        assert presale["status"] == "pending"
        assert presale["operator_id"] == self.operator_data["user"]["id"]
        assert presale["total_amount"] == round(target_prod["prix_vente"], 2)

        # 3. Cashier queries pending queue
        r_pending = requests.get(f"{API}/presales/pending", headers=hdr(self.cash_tok), timeout=10)
        assert r_pending.status_code == 200
        pending_list = r_pending.json()
        found_in_pending = any(p["id"] == presale_id for p in pending_list)
        assert found_in_pending is True, f"Presale {presale_id} should be in pending list"

        # 4. Recall by ticket number (e.g. "PV-01" or numeric portion)
        r_get = requests.get(f"{API}/presales/{ticket_number}", headers=hdr(self.cash_tok), timeout=10)
        assert r_get.status_code == 200
        recalled = r_get.json()
        assert recalled["id"] == presale_id
        assert recalled["customer_name"] == "Test Client Yao"

        # 5. Cashier finalizes the sale
        sale_payload = {
            "items": [{"product_id": target_prod["id"], "quantity": 1}],
            "payment_method": "cash",
            "customer_name": "Test Client Yao",
            "presale_id": presale_id,
        }
        r_sale = requests.post(f"{API}/sales", headers=hdr(self.cash_tok), json=sale_payload, timeout=10)
        assert r_sale.status_code == 200, f"Finalize sale failed: {r_sale.text}"
        sale = r_sale.json()
        assert sale["operator_id"] == self.operator_data["user"]["id"]
        assert sale["operator_name"] == self.operator_data["user"]["name"]
        assert sale["presale_id"] == presale_id

        # 6. Verify presale is now completed and removed from pending queue
        r_pending_after = requests.get(f"{API}/presales/pending", headers=hdr(self.cash_tok), timeout=10)
        assert r_pending_after.status_code == 200
        assert not any(p["id"] == presale_id for p in r_pending_after.json())

    def test_cancel_presale(self):
        # 1. Fetch available product
        r = requests.get(f"{API}/products", headers=hdr(self.op_tok), timeout=10)
        products = r.json()
        avail = [p for p in products if (p.get("stock_total") or 0) >= 1 and not p.get("requires_prescription")]
        target = avail[0]

        # 2. Create presale
        r_create = requests.post(f"{API}/presales", headers=hdr(self.op_tok), json={
            "items": [{"product_id": target["id"], "quantity": 1}],
            "customer_name": "Client Annulation",
        }, timeout=10)
        assert r_create.status_code == 200
        presale_id = r_create.json()["presale"]["id"]

        # 3. Cancel presale
        r_cancel = requests.put(f"{API}/presales/{presale_id}/cancel", headers=hdr(self.op_tok), timeout=10)
        assert r_cancel.status_code == 200
        assert r_cancel.json().get("ok") is True

        # 4. Must not be in pending list
        r_pending = requests.get(f"{API}/presales/pending", headers=hdr(self.cash_tok), timeout=10)
        assert not any(p["id"] == presale_id for p in r_pending.json())
