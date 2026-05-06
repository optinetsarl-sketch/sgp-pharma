# SGP-Pharma — Test Credentials

JWT Bearer token via `Authorization: Bearer <access_token>` header. Login response returns `{user, access_token}`.

| Role         | Email                        | Password    | Pharmacy             |
|--------------|------------------------------|-------------|----------------------|
| Super Admin  | optinet@sgp-pharma.tg        | Optinet@2026| (toutes)             |
| Admin        | admin@sgp-pharma.tg          | Admin@2026  | Pharmacie Centrale OPTINET |
| Pharmacist   | pharmacien@sgp-pharma.tg     | Pharma@2026 | Pharmacie Centrale OPTINET |
| Cashier      | caissier@sgp-pharma.tg       | Cash@2026   | Pharmacie Centrale OPTINET |
| Storekeeper  | magasinier@sgp-pharma.tg     | Store@2026  | Pharmacie Centrale OPTINET |

## Auth endpoints
- `POST /api/auth/login` — body `{email, password}` → returns `{user, access_token}`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/refresh`

## PDF endpoints
- `GET /api/sales/{id}/receipt.pdf` — Thermal receipt 80mm
- `GET /api/purchase-orders/{id}/pdf` — A4 purchase order

## Multi-tenant
- super_admin sees all pharmacies; other roles scoped to their pharmacy_id
- Admin can create/manage users within their pharmacy + reset passwords
