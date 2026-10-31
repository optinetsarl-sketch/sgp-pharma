"""Tests for Medical Acts (Actes Médicaux & Prestations Cliniques)."""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_CREDS = ("admin@sgp-pharma.tg", "Admin@2026")


def login_admin():
    email, pwd = ADMIN_CREDS
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestMedicalActs:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.tok = login_admin()

    def test_list_and_seed_defaults(self):
        r = requests.get(f"{API}/acts", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        acts = r.json()
        assert len(acts) >= 7, "Should contain at least 7 default acts"

        # Check the 7 requested acts and prices
        act_map = {a["name"].strip().lower(): a["price"] for a in acts}
        assert "consultation" in act_map and act_map["consultation"] == 500.0
        assert "cpn" in act_map and act_map["cpn"] == 1500.0
        assert "acte petite chirurgie" in act_map and act_map["acte petite chirurgie"] == 1000.0
        assert "pansement" in act_map and act_map["pansement"] == 1000.0
        assert any("accouchement" in k for k in act_map) and any("accouchement" in k and v == 2000.0 for k, v in act_map.items())
        assert any("révision" in k or "revision" in k for k in act_map) and any(("révision" in k or "revision" in k) and v == 2000.0 for k, v in act_map.items())
        assert "suture" in act_map and act_map["suture"] == 1000.0

    def test_direct_sale_of_medical_act(self):
        # 1. Get an act
        r = requests.get(f"{API}/acts", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        acts = r.json()
        consultation = next((a for a in acts if a["name"] == "Consultation"), acts[0])

        # 2. Bill the act directly without stock or batch
        sale_payload = {
            "payment_method": "cash",
            "customer_name": "Patient Test Consultation",
            "items": [
                {
                    "product_id": consultation["id"],
                    "quantity": 1,
                    "unit_price": consultation["price"],
                    "is_act": True,
                    "act_name": consultation["name"],
                }
            ],
        }
        r_sale = requests.post(f"{API}/sales", headers=hdr(self.tok), json=sale_payload, timeout=10)
        assert r_sale.status_code == 200, f"Sale failed: {r_sale.text}"
        sale_data = r_sale.json()
        assert sale_data["total_amount"] == consultation["price"]
        assert len(sale_data["items"]) == 1
        assert sale_data["items"][0]["is_act"] is True

    def test_presale_with_medical_act(self):
        # 1. Get act
        r = requests.get(f"{API}/acts", headers=hdr(self.tok), timeout=10)
        acts = r.json()
        cpn = next((a for a in acts if "cpn" in a["name"].lower()), acts[0])

        # 2. Add to pre-sale
        presale_payload = {
            "customer_name": "Patiente Enceinte Test CPN",
            "items": [
                {
                    "product_id": cpn["id"],
                    "quantity": 1,
                    "unit_price": cpn["price"],
                    "product_name": cpn["name"],
                    "is_act": True,
                    "act_name": cpn["name"],
                }
            ],
        }
        r_ps = requests.post(f"{API}/presales", headers=hdr(self.tok), json=presale_payload, timeout=10)
        assert r_ps.status_code == 200, f"Pre-sale failed: {r_ps.text}"
        ps_data = r_ps.json()["presale"]
        assert ps_data["total_amount"] == cpn["price"]
        assert ps_data["ticket_number"].startswith("PV-")
