"""Tests for Laboratory Examinations (Analyses & Examens Médicaux de Laboratoire)."""
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


class TestLabExams:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.tok = login_admin()

    def test_list_and_seed_defaults(self):
        r = requests.get(f"{API}/lab-exams", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        exams = r.json()
        assert len(exams) >= 32, f"Should contain at least 32 default lab exams, got {len(exams)}"

        # Check key exams and prices requested by user
        exam_map = {e["code"].upper(): e["price"] for e in exams if e.get("code")}
        assert exam_map.get("LAB-GE") == 500.0, "GE must be 500 FCFA"
        assert exam_map.get("LAB-NB") == 500.0, "NB must be 500 FCFA"
        assert exam_map.get("LAB-KOP") == 500.0, "KOP must be 500 FCFA"
        assert exam_map.get("LAB-TH") == 1000.0, "TH must be 1000 FCFA"
        assert exam_map.get("LAB-NFS") == 3500.0, "NFS must be 3500 FCFA"
        assert exam_map.get("LAB-CRP") == 1000.0, "CRP must be 1000 FCFA"
        assert exam_map.get("LAB-VS") == 1000.0, "VS must be 1000 FCFA"
        assert exam_map.get("LAB-HBS") == 2000.0, "AgHBS must be 2000 FCFA"
        assert exam_map.get("LAB-HCV") == 2000.0, "AgHCV must be 2000 FCFA"
        assert exam_map.get("LAB-SRV") == 1000.0, "SRV must be 1000 FCFA"
        assert exam_map.get("LAB-HP") == 2000.0, "Test HP must be 2000 FCFA"
        assert exam_map.get("LAB-MHEP") == 8000.0, "Marqueur Hépatique must be 8000 FCFA"
        assert exam_map.get("LAB-GLY") == 1000.0, "Glycémie must be 1000 FCFA"
        assert exam_map.get("LAB-IONO") == 10500.0, "Ionogramme sanguin must be 10500 FCFA"
        assert exam_map.get("LAB-EHB") == 5000.0, "Electrophorèse HB must be 5000 FCFA"
        assert exam_map.get("LAB-GRP") == 2000.0, "Groupage RH must be 2000 FCFA"

    def test_generate_lab_code(self):
        r = requests.get(f"{API}/lab-exams/generate-code", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "code" in data
        assert data["code"].startswith("LAB-")

    def test_direct_sale_of_lab_exam(self):
        # 1. Get an exam (NFS at 3500 FCFA)
        r = requests.get(f"{API}/lab-exams", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        exams = r.json()
        nfs = next((e for e in exams if "NFS" in e["name"] or e.get("code") == "LAB-NFS"), exams[0])

        # 2. Bill the lab exam directly
        sale_payload = {
            "payment_method": "cash",
            "customer_name": "Patient Test Laboratoire NFS",
            "items": [
                {
                    "product_id": nfs["id"],
                    "quantity": 1,
                    "unit_price": nfs["price"],
                    "is_lab": True,
                    "lab_name": nfs["name"],
                }
            ],
        }
        r_sale = requests.post(f"{API}/sales", headers=hdr(self.tok), json=sale_payload, timeout=10)
        assert r_sale.status_code == 200, f"Sale failed: {r_sale.text}"
        sale_data = r_sale.json()
        assert sale_data["total_amount"] == nfs["price"]
        assert len(sale_data["items"]) == 1
        assert sale_data["items"][0]["is_lab"] is True

    def test_presale_with_lab_exam(self):
        r = requests.get(f"{API}/lab-exams", headers=hdr(self.tok), timeout=10)
        exams = r.json()
        ge = next((e for e in exams if "GE" in e["name"] or e.get("code") == "LAB-GE"), exams[0])

        presale_payload = {
            "customer_name": "Patient Fébrile Test Paludisme GE",
            "items": [
                {
                    "product_id": ge["id"],
                    "quantity": 1,
                    "unit_price": ge["price"],
                    "product_name": ge["name"],
                    "is_lab": True,
                    "lab_name": ge["name"],
                }
            ],
        }
        r_ps = requests.post(f"{API}/presales", headers=hdr(self.tok), json=presale_payload, timeout=10)
        assert r_ps.status_code == 200, f"Presale failed: {r_ps.text}"
        ps_data = r_ps.json()["presale"]
        assert ps_data["total_amount"] == ge["price"]
        assert ps_data["items"][0]["is_lab"] is True

    def test_lab_categories_crud(self):
        # 1. List
        r = requests.get(f"{API}/lab-exams/categories/list", headers=hdr(self.tok), timeout=10)
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 8

        # 2. Create
        r_create = requests.post(f"{API}/lab-exams/categories/create", headers=hdr(self.tok), json={"name": "Toxicologie Test"}, timeout=10)
        assert r_create.status_code == 200
        created = r_create.json()
        assert created["name"] == "Toxicologie Test"

        # 3. Update / Rename
        r_update = requests.put(f"{API}/lab-exams/categories/{created['id']}", headers=hdr(self.tok), json={"name": "Toxicologie Clinique"}, timeout=10)
        assert r_update.status_code == 200
        assert r_update.json()["name"] == "Toxicologie Clinique"

        # 4. Delete
        r_del = requests.delete(f"{API}/lab-exams/categories/{created['id']}", headers=hdr(self.tok), timeout=10)
        assert r_del.status_code == 200

