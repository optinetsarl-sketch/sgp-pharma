"""
Script de préparation du package "Deployement client" pour livraison client clé en main.
"""

import os
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DEPLOY_DIR = ROOT_DIR / "Deployement client"
DIST_DIR = ROOT_DIR / "dist" / "SGP-Pharma"


def prepare_deployment_package():
    print("=" * 60)
    print("   CREATION DU DOSSIER : Deployement client")
    print("=" * 60)

    # 1. Create or clean Deployement client folder
    if DEPLOY_DIR.exists():
        print("Nettoyage de l'ancien dossier...")
        shutil.rmtree(DEPLOY_DIR)
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Copy the standalone application bundle
    print("\n[1/4] Copie de l'application autonome SGP-Pharma...")
    target_app_dir = DEPLOY_DIR / "SGP-Pharma"
    shutil.copytree(DIST_DIR, target_app_dir)
    print(f"Application copiee dans : {target_app_dir}")

    # 3. Create LANCER_APPLICATION.bat in the root of Deployement client
    print("\n[2/4] Creation du lanceur Windows a 1 clic...")
    launcher_content = """@echo off
title SGP-Pharma - Logiciel de Gestion d'Officine
cd /d "%~dp0"

echo ======================================================================
echo          SGP-PHARMA - SYSTEME DE GESTION PHARMACEUTIQUE
echo ======================================================================
echo.
echo Verification de l'environnement...

:: Verifier si le binaire existe
if not exist "SGP-Pharma\\SGP-Pharma.exe" (
    echo [ERREUR] L'executable SGP-Pharma.exe est introuvable dans le sous-dossier SGP-Pharma.
    echo Veuillez reinstaller le package ou verifier vos fichiers.
    pause
    exit /b 1
)

echo Demarrage de SGP-Pharma...
start "" "SGP-Pharma\\SGP-Pharma.exe"
exit
"""
    with open(DEPLOY_DIR / "LANCER_APPLICATION.bat", "w", encoding="utf-8") as f:
        f.write(launcher_content)

    # 4. Create VERIFIER_MONGODB.bat
    print("\n[3/4] Creation du script de verification des prerequis...")
    verifier_content = """@echo off
title SGP-Pharma - Verification des Prerequis
cd /d "%~dp0"

echo ======================================================================
echo          VERIFICATION DES PREREQUIS SYSTEME (MONGODB)
echo ======================================================================
echo.
echo Test de connexion au serveur MongoDB local (port 27017)...

powershell -Command "$s = New-Object System.Net.Sockets.TcpClient; try { $s.Connect('127.0.0.1', 27017); Write-Host '[OK] Le service MongoDB est ACTIF et ACCESSIBLE sur le port 27017 !' -ForegroundColor Green; $s.Close() } catch { Write-Host '[ATTENTION] Impossible de joindre MongoDB sur 127.0.0.1:27017.' -ForegroundColor Red; Write-Host 'Assurez-vous que le service MongoDB Server est demarre dans services.msc ou lancez mongod.exe.' -ForegroundColor Yellow }"

echo.
echo ======================================================================
pause
"""
    with open(DEPLOY_DIR / "VERIFIER_MONGODB.bat", "w", encoding="utf-8") as f:
        f.write(verifier_content)

    # 5. Create complete client guide GUIDE_INSTALLATION_CLIENT.txt
    print("\n[4/4] Creation du Guide d'Installation Client...")
    guide_content = """================================================================================
          SGP-PHARMA · GUIDE DE DEPLOIEMENT ET D'INSTALLATION CLIENT
================================================================================

Bienvenue dans SGP-Pharma, le logiciel moderne de gestion intégrée d'officine
pharmaceutique (Caisse POS, Stocks FEFO, Traçabilité, Ordonnances et Factures).

--------------------------------------------------------------------------------
1. PRÉREQUIS UNIQUE (BASE DE DONNÉES)
--------------------------------------------------------------------------------
SGP-Pharma est autonome (Frontend React + Backend Python intégrés dans le .exe).
Le seul prérequis externe sur la machine est d'installer MongoDB :

1. Téléchargez et installez "MongoDB Community Server" (version 6.x ou 7.x)
   Lien officiel : https://www.mongodb.com/try/download/community
2. Lors de l'installation, laissez la case cochée :
   [x] "Install MongoDB as a Service" (Démarrage automatique en service Windows)
3. Vous pouvez vérifier que MongoDB fonctionne en double-cliquant sur :
   "VERIFIER_MONGODB.bat"

--------------------------------------------------------------------------------
2. DÉMARRAGE DE L'APPLICATION
--------------------------------------------------------------------------------
Pour lancer le logiciel :
1. Double-cliquez simplement sur "LANCER_APPLICATION.bat".
2. L'application démarre automatiquement en mode plein écran / fenêtre logicielle
   dédiée à l'adresse locale http://127.0.0.1:8000.

--------------------------------------------------------------------------------
3. IDENTIFIANTS DE CONNEXION PAR DÉFAUT
--------------------------------------------------------------------------------
Au premier démarrage, les comptes de démonstration et d'administration sont :

• SUPER ADMINISTRATEUR (Accès total & Multi-Pharmacies) :
  - Email       : admin@pharmacy.com
  - Mot de passe : admin123

• GESTIONNAIRE D'OFFICINE (Admin Pharmacie) :
  - Email       : admin@pharmalife.com
  - Mot de passe : admin123

• CAISSIER / OPÉRATEUR DE VENTE :
  - Email       : cashier@pharmalife.com
  - Mot de passe : cashier123

• PHARMACIEN CONSEIL / VALIDATION :
  - Email       : pharmacist@pharmalife.com
  - Mot de passe : pharmacist123

--------------------------------------------------------------------------------
4. PERSONNALISATION INITIALE DE L'OFFICINE (MARQUE BLANCHE)
--------------------------------------------------------------------------------
Dès votre première connexion en tant qu'Administrateur :
1. Cliquez sur le menu "Ma Pharmacie (Infos & Logo)" dans le menu de gauche.
2. Téléversez le Logo officiel de la pharmacie (PNG/JPG).
3. Renseignez le Nom officiel, l'Adresse physique, le lien Google Maps,
   les numéros de Téléphone, WhatsApp et le N° d'Agrément du Ministère.
4. Cliquez sur "Enregistrer la Configuration".
-> Vos coordonnées et votre logo s'afficheront instantanément sur tous vos
   tickets de caisse thermiques 80mm et vos factures.

--------------------------------------------------------------------------------
5. GESTION DES UTILISATEURS ET OPÉRATEURS
--------------------------------------------------------------------------------
Dans le menu "Utilisateurs", vous pouvez :
- Créer de nouveaux comptes pour vos caissiers, magasiniers et pharmaciens.
- Modifier leurs mots de passe à tout moment.
- Activer ou désactiver un utilisateur en 1 clic.

--------------------------------------------------------------------------------
6. SAISIE RAPIDE ET RACCOURCIS CLAVIER POUR OPÉRATEURS
--------------------------------------------------------------------------------
• F1 : Aide & Liste des raccourcis clavier
• F2 : Ouvrir la Caisse (Point de Vente POS)
• F3 : Catalogue Produits & Médicaments
• F4 : Réception & Entrées en Stock par Lot (FEFO)
• F9 : Tableau de Bord principal
• Ctrl+P : Impression directe du ticket thermique 80mm

--------------------------------------------------------------------------------
   SGP-Pharma · Conçu pour la performance et la simplicité officinale
================================================================================
"""
    with open(DEPLOY_DIR / "GUIDE_INSTALLATION_CLIENT.txt", "w", encoding="utf-8") as f:
        f.write(guide_content)

    print("\n" + "=" * 60)
    print("   PACKAGE 'Deployement client' CRÉÉ AVEC SUCCÈS !")
    print(f"   Dossier de livraison : {DEPLOY_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    prepare_deployment_package()
