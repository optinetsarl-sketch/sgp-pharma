# SGP-Pharma - Système de Gestion de Pharmacie (OPTINET SARLU)

Application locale de gestion d'officine pharmaceutique avec frontend React, backend FastAPI et base de données MongoDB.

---

## 📋 Prérequis

- **Node.js** (v18+) & **Yarn**
- **Python** (3.10+) avec environnement virtuel dans `.venv`
- **MongoDB** installé localement sur le port `27017`

---

## 🚀 Démarrage Rapide en Développement

### 1. Démarrer MongoDB
Si le service Windows MongoDB n'est pas actif :
- Faites un **clic droit** sur `DEMARRER_MONGODB.bat` → **Exécuter en tant qu'administrateur**
- Ou dans un terminal administrateur :
  ```powershell
  net start MongoDB
  ```

### 2. Lancer l'environnement de développement
Depuis la racine du projet :
```powershell
npm start
```
Cette commande démarre simultanément :
- **Backend FastAPI** sur [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Frontend React** sur [http://localhost:3000](http://localhost:3000)

### 3. Démarrer séparément (si besoin)
Backend :
```powershell
cd backend
..\.venv\Scripts\python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
Frontend :
```powershell
yarn --cwd frontend start
```

---

## 📦 Procédure de Build et Déploiement Client

### Option A — En 1 Clic (Recommandé)

Double-cliquez simplement sur :
```text
TOUT_REBUILDER_ET_DEPLOYER.bat
```
Ce script exécute automatiquement tout le cycle :
1. Compilation de production du Frontend React (`yarn build`).
2. Compilation de l'exécutable standalone avec icône de pharmacie (`build_exe.py`).
3. Déplacement, nettoyage et assemblage du dossier final **`Deployement client`** (`prepare_deployment.py`).

---

### Option B — En Ligne de Commande (Étape par Étape)

#### Étape 1 : Compiler le Frontend React
```powershell
yarn --cwd frontend build
```

#### Étape 2 : Compiler l'Exécutable Standalone (.EXE avec icône)
```powershell
.\.venv\Scripts\python.exe build_exe.py
```
> *Génère l'application autonome dans `dist\SGP-Pharma\SGP-Pharma.exe`.*

#### Étape 3 : Assembler et Déplacer dans le dossier `Deployement client`
```powershell
.\.venv\Scripts\python.exe prepare_deployment.py
```
> *Nettoie l'ancien dossier et assemble automatiquement l'exécutable, les dépendances `_internal/`, le `.env` de production (`DB_NAME="HOP-Pharma"`), les lanceurs silencieux, les scripts de raccourci et le guide client.*

---

## 🧹 Nettoyage des Données de Test & Vérification

### Réinitialiser les données de test (remettre à blanc)
Avant de livrer à un client, effacez toutes les ventes/sorties effectuées lors des tests :
```powershell
# Simulation (sans supprimer)
.\.venv\Scripts\python.exe reset_test_data.py --dry-run

# Nettoyage réel
.\.venv\Scripts\python.exe reset_test_data.py
```

### Vérifier que tous les stocks sont à zéro
```powershell
.\.venv\Scripts\python.exe scripts\verify_stock.py
```

---

## 📂 Contenu du Dossier `Deployement client`

Le dossier généré `Deployement client` contient tout ce qui est nécessaire pour installer et faire tourner l'application chez le client :

| Fichier / Dossier | Description |
|---|---|
| `SGP-Pharma.exe` | Exécutable principal de l'application (icône officielle intégrée) |
| `_internal/` | Bibliothèques et composants de l'exécutable |
| `.env` | Configuration de production (`DB_NAME="HOP-Pharma"`, `PORT=8000`) |
| `Lancer Silencieux.vbs` | **Lanceur 100% silencieux** (sans console noire, ouvre le navigateur) |
| `Lancer SGP-Pharma.vbs` | Lanceur silencieux alternatif |
| `Creer_Raccourci_Bureau.bat` | **Crée en 1 clic le raccourci sur le Bureau** avec l'icône de pharmacie |
| `Creer_Raccourci_Bureau.vbs` | Script VBS utilisé pour créer le raccourci Bureau |
| `LANCER_DEBUG.bat` | Lanceur console avec affichage des logs en cas de diagnostic |
| `LOGO-SGP-Pharma.png` | Logo officiel de l'officine pour reçus et tickets |
| `sgp_pharma.ico` / `app.ico` | Icône de pharmacie pour les raccourcis Windows |
| `GUIDE_INSTALLATION_CLIENT.txt` | Manuel d'installation pour le technicien ou le client |

---

## 💻 Installation chez le Client (Mode d'Emploi)

1. **Installer MongoDB** sur le PC client (cocher *Install MongoDB as a Service*).
2. **Copier le dossier `Deployement client`** sur le PC (ex: `C:\SGP-Pharma`).
3. **Double-cliquer sur `Creer_Raccourci_Bureau.bat`** :
   - Un raccourci nommé **SGP-Pharma** avec le logo de pharmacie est créé sur le Bureau.
4. **L'utilisateur double-clique sur le raccourci du Bureau** :
   - L'application démarre silencieusement en arrière-plan.
   - Le navigateur s'ouvre directement sur `http://127.0.0.1:8000`.

---

## 🔑 Identifiants de Connexion par Défaut

- **Administrateur** : `admin@sgp-pharma.tg` / `Admin@2026`
- **Pharmacien** : `pharmacien@sgp-pharma.tg` / `Pharma@2026`
- **Caissier** : `caissier@sgp-pharma.tg` / `Cash@2026`
- **Magasinier** : `magasinier@sgp-pharma.tg` / `Store@2026`
- **Vendeur** : `vendeur@sgp-pharma.tg` / `Vendeur@2026`

---

## 📞 Support & Développement

**OPTINET SARLU**  
Lomé, Togo  
Email : `optinetsarl@gmail.com`  
Tél : `+228 90 74 84 65`
