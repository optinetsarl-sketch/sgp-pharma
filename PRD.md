# SGP-Pharma — Product Requirements Document

## Original problem statement
Build SGP-Pharma — a complete Pharmacy Management System for OPTINET SARLU (Lomé, Togo).
Multi-rôles, FEFO obligatoire, RBAC + audit log, multi-pharmacies (SaaS).

## Architecture
- **Backend**: FastAPI + Motor/MongoDB. UUID string IDs. Multi-tenant via `pharmacy_id` field.
- **Frontend**: React 19 + Tailwind + Shadcn/UI. Forest green primary (#166534). FR/EN i18n.
- **Auth**: JWT Bearer token in localStorage. 5 rôles: super_admin (OPTINET), admin, pharmacist, cashier, storekeeper.
- **PDF**: ReportLab server-side (thermal 80mm + A4).

## Implemented (v1.1 — 2026-05-01)

### Phase A — Core (v1.0)
- Auth + RBAC + brute-force protection
- Dashboard avec KPIs et alertes péremption (rouge/orange)
- Produits CRUD + Categories
- Suppliers CRUD
- Purchase Orders (workflow draft → received)
- Reception (lot+péremption obligatoire, blocage si expiré)
- Batches & Stock view + FEFO badges
- Block batch
- POS avec sélection FEFO automatique + atomic decrement + rollback
- Losses (péremption/casse/vol)
- Reports (sales, top, margins, CSV)
- Users (admin scope) + Audit log
- i18n FR/EN

### Phase B+ — SaaS Multi-tenant + PDF (v1.1)
- **Multi-tenant**: `pharmacy_id` partout. Helpers `pharmacy_scope`, `stamp_pharmacy`, `assert_same_pharmacy`. Compound unique index (pharmacy_id, code_barre).
- **Super Admin OPTINET** (optinet@sgp-pharma.tg / Optinet@2026): voit toutes les pharmacies, peut créer/supprimer pharmacies et créer admins par pharmacie.
- **Pharmacy management**: CRUD via `/api/pharmacies` (super_admin).
- **PDF Tickets thermiques 80mm** via `/api/sales/{id}/receipt.pdf` (ReportLab dynamic-height canvas).
- **PDF Bons de commande A4** via `/api/purchase-orders/{id}/pdf` (SimpleDocTemplate avec branding vert OPTINET).
- **Upload photo ordonnance** (base64) attaché à la vente, prévisualisé en POS.
- **Admin reset password**: génère mot de passe temporaire (`secrets.token_urlsafe(8)`), affiché 1 fois avec copie clipboard.
- **Catalogue CAMEG ~150 produits** essentiels Togo: paludisme, antibiotiques, antalgiques, MNT, mère-enfant, VIH/TB, dermatologie, gynéco, ophtalmologie, pédiatrie, matériel.
- **Optimisation rapports**: Dashboard `low_stock` et `/reports/margins` utilisent une seule aggregation MongoDB (élimination N+1).

## Test status
- **Backend**: 49/49 pytest passing (29 régression + 20 Phase B+)
- **Frontend**: super admin banner, pharmacies, admin sidebar pharmacy name, orders PDF, users reset password — vérifiés
- **Multi-tenant isolation testée** : 2 pharmacies + 2 admins isolés, cross-tenant returns 404.
- **PDFs vérifiés** : magic bytes %PDF, application/pdf

## Test credentials (`/app/memory/test_credentials.md`)
- Super Admin: optinet@sgp-pharma.tg / Optinet@2026 (no pharmacy)
- Admin: admin@sgp-pharma.tg / Admin@2026
- Pharmacist: pharmacien@sgp-pharma.tg / Pharma@2026
- Cashier: caissier@sgp-pharma.tg / Cash@2026
- Storekeeper: magasinier@sgp-pharma.tg / Store@2026

## Backlog (P1 / P2)
- Notifications email (Resend/SendGrid) — différé sur demande utilisateur
- Object storage S3 pour images ordonnances (actuellement base64 inline)
- Mobile responsive POS layout
- Forgot-password public flow (actuellement reset-password manuel par admin uniquement)
- Reports avancés : produits dormants, rotation stock, comparaison période/période
- Backup automatique nightly + restauration
- Service worker offline-first (cycle de re-sync ventes)
- Vaccin / chaîne du froid spécifique
- Rapport légal stupéfiants/tableau B
- Imprimante thermique ESC/POS direct
- Multi-devise / TVA complexe
