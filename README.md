# SGP-Pharma - OPTINET SARLU

Application locale de gestion de pharmacie avec frontend React, backend FastAPI et base de donnees MongoDB.

Le frontend utilise la signature OPTINET SARLU dans `frontend/public/index.html`.

## Prerequis

- Node.js
- Yarn
- Python 3
- MongoDB demarre en local sur `mongodb://localhost:27017`

## Installation Complete

Depuis la racine du projet :

```powershell
npm run install:all
```

Cette commande installe :

- les dependances Python du backend dans `.venv`
- les dependances Node du frontend
- les dependances Node de la racine pour lancer frontend et backend ensemble

## Demarrer Le Serveur

Depuis la racine du projet :

```powershell
npm start
```

Cette commande demarre en meme temps :

- le backend FastAPI sur `http://127.0.0.1:8000`
- le frontend React sur `http://localhost:3000`

## URLs Utiles

Frontend :

```text
http://localhost:3000
```

Backend health check :

```text
http://127.0.0.1:8000/api/health
```

API racine :

```text
http://127.0.0.1:8000/api/
```

## Demarrer Separement

Backend seulement :

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Frontend seulement :

```powershell
yarn --cwd frontend start
```

## Configuration Locale

Frontend :

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
```

Backend :

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="sgp_pharma"
```

## Verification

Verifier que MongoDB ecoute bien sur le port `27017` :

```powershell
Test-NetConnection -ComputerName localhost -Port 27017
```

Verifier le backend :

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health
```

Verifier le frontend :

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000
```

## Commandes Utiles

Build frontend :

```powershell
yarn --cwd frontend build
```

Tests backend :

```powershell
$env:REACT_APP_BACKEND_URL='http://127.0.0.1:8000'
.\.venv\Scripts\python -m pytest backend\tests -q
```

## Notes

- MongoDB reste local et n'est pas remplace.
- Le frontend communique avec le backend local, sans serveur externe.
- Aucun script externe n'est requis dans `frontend/public/index.html`.
