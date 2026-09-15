"""
Script de préparation du package "Deployement client" pour livraison client clé en main.
Mode : MongoDB installé séparément sur le PC client (Service Windows standard).

Contenu généré :
  - SGP-Pharma.exe + dossier _internal/ (directement à la racine)
  - .env                         -> Config production (DB_NAME="HOP-Pharma", MONGO_URL="mongodb://localhost:27017")
  - Lancer Silencieux.vbs        -> Lanceur recommandé (démarrage 100% silencieux sans console noire)
  - Lancer SGP-Pharma.vbs        -> Lanceur alternatif identique
  - LANCER_DEBUG.bat             -> Lanceur console pour diagnostic/maintenance
  - Creer_Raccourci_Bureau.vbs   -> Créateur automatique de raccourci Bureau avec logo
  - Creer_Raccourci_Bureau.bat   -> Lanceur 1-clic pour le créateur de raccourci
  - LOGO-SGP-Pharma.png          -> Logo officiel de la pharmacie
  - sgp_pharma.ico / app.ico     -> Icônes pour raccourcis Windows
  - GUIDE_INSTALLATION_CLIENT.txt -> Manuel de déploiement et d'utilisation
"""

import os
import shutil
from pathlib import Path

ROOT_DIR    = Path(__file__).resolve().parent
DEPLOY_DIR  = ROOT_DIR / "Deployement client"
DIST_DIR    = ROOT_DIR / "dist" / "SGP-Pharma"
LOGO_SRC    = ROOT_DIR / "frontend" / "public" / "optinet-logo.png"
ICO_SRC     = ROOT_DIR / "sgp_pharma.ico"


# ── Lanceur Silencieux VBS ─────────────────────────────────────────────────────
VBS_CONTENT = r'''Set objShell = CreateObject("WScript.Shell")
Set objFSO   = CreateObject("Scripting.FileSystemObject")

baseDir  = objFSO.GetParentFolderName(WScript.ScriptFullName)
exePath  = objFSO.BuildPath(baseDir, "SGP-Pharma.exe")
icoPath  = objFSO.BuildPath(baseDir, "sgp_pharma.ico")
If Not objFSO.FileExists(icoPath) Then
    icoPath = objFSO.BuildPath(baseDir, "app.ico")
End If

If Not objFSO.FileExists(exePath) Then
    MsgBox "SGP-Pharma.exe introuvable !" & vbCrLf & "Verifiez que tous les fichiers sont presents dans le dossier.", vbCritical, "SGP-Pharma - Erreur"
    WScript.Quit
End If

' Verifier si SGP-Pharma.exe est deja en cours d'execution
Dim alreadyRunning
alreadyRunning = False
On Error Resume Next
Dim objWMI, colProcesses
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMI.ExecQuery("Select * from Win32_Process Where Name = 'SGP-Pharma.exe'")
If colProcesses.Count > 0 Then alreadyRunning = True
On Error GoTo 0

If Not alreadyRunning Then
    ' Lancer SGP-Pharma en arriere-plan 100% silencieux (0 = masquer la fenetre)
    objShell.Run Chr(34) & exePath & Chr(34), 0, False
    ' Attente du demarrage du serveur FastAPI
    WScript.Sleep 4000
End If

' Ouvrir l'application dans le navigateur par defaut
objShell.Run "http://127.0.0.1:8000", 1, False

' ==============================================================
' 1. Creer le raccourci dans shell:startup (demarrage auto Windows)
' ==============================================================
Dim strStartup, startupLink
strStartup  = objShell.SpecialFolders("Startup")
startupLink = strStartup & "\SGP-Pharma.lnk"

If Not objFSO.FileExists(startupLink) Then
    Set oStartup = objShell.CreateShortcut(startupLink)
    oStartup.TargetPath       = "wscript.exe"
    oStartup.Arguments        = Chr(34) & WScript.ScriptFullName & Chr(34)
    oStartup.WorkingDirectory = baseDir
    oStartup.Description      = "SGP-Pharma - Demarrage automatique Windows"
    If objFSO.FileExists(icoPath) Then
        oStartup.IconLocation = icoPath & ", 0"
    End If
    oStartup.Save
    Set oStartup = Nothing
End If

' ==============================================================
' 2. Creer le raccourci URL sur le Bureau avec le logo et le nom
'    de la pharmacie (lu depuis l'API SGP-Pharma)
' ==============================================================
Dim strDesktop, pharmacyName
strDesktop   = objShell.SpecialFolders("Desktop")
pharmacyName = "SGP-Pharma"

' Lire le nom reel de la pharmacie depuis l'API
On Error Resume Next
Dim http
Set http = CreateObject("MSXML2.XMLHTTP.6.0")
If Not http Is Nothing Then
    http.Open "GET", "http://127.0.0.1:8000/api/pharmacies/public-name", False
    http.setRequestHeader "Accept", "application/json"
    http.Send
    If http.Status = 200 Then
        Dim resp, pos1, pos2
        resp = http.responseText
        pos1 = InStr(resp, """name"":""")
        If pos1 > 0 Then
            pos1 = pos1 + 8
            pos2 = InStr(pos1, resp, """")
            If pos2 > 0 Then
                Dim rawName
                rawName = Mid(resp, pos1, pos2 - pos1)
                If Len(Trim(rawName)) > 0 Then pharmacyName = Trim(rawName)
            End If
        End If
    End If
End If
On Error GoTo 0

' Nom du fichier raccourci = nom de la pharmacie (nettoye des caracteres speciaux)
Dim safePharmName
safePharmName = pharmacyName
Dim badChars, ch, i
badChars = Array("\", "/", ":", "*", "?", """", "<", ">", "|")
For Each ch In badChars
    Dim parts
    Do While InStr(safePharmName, ch) > 0
        i = InStr(safePharmName, ch)
        safePharmName = Left(safePharmName, i - 1) & Mid(safePharmName, i + 1)
    Loop
Next
If Len(Trim(safePharmName)) = 0 Then safePharmName = "SGP-Pharma"

' Creer le fichier .url (raccourci Internet avec icone personnalisee)
Dim urlFile
urlFile = strDesktop & "\" & safePharmName & ".url"

Dim fURL
Set fURL = objFSO.CreateTextFile(urlFile, True, False)
fURL.WriteLine "[InternetShortcut]"
fURL.WriteLine "URL=http://127.0.0.1:8000"
If objFSO.FileExists(icoPath) Then
    fURL.WriteLine "IconFile=" & icoPath
    fURL.WriteLine "IconIndex=0"
End If
fURL.Close
Set fURL = Nothing

Set objShell = Nothing
Set objFSO   = Nothing
WScript.Quit
'''


# ── Script de Création Automatique de Raccourci Bureau avec Icône ──────────────
SHORTCUT_VBS_CONTENT = r'''Set objShell = CreateObject("WScript.Shell")
Set objFSO   = CreateObject("Scripting.FileSystemObject")

strDesktop = objShell.SpecialFolders("Desktop")
baseDir    = objFSO.GetParentFolderName(WScript.ScriptFullName)
vbsTarget  = objFSO.BuildPath(baseDir, "Lancer Silencieux.vbs")
icoPath    = objFSO.BuildPath(baseDir, "sgp_pharma.ico")
exePath    = objFSO.BuildPath(baseDir, "SGP-Pharma.exe")

If Not objFSO.FileExists(icoPath) Then
    icoPath = objFSO.BuildPath(baseDir, "app.ico")
End If

' Creation du raccourci sur le Bureau
Set oLink = objShell.CreateShortcut(strDesktop & "\SGP-Pharma.lnk")
oLink.TargetPath = "wscript.exe"
oLink.Arguments = Chr(34) & vbsTarget & Chr(34)
oLink.WorkingDirectory = baseDir
oLink.Description = "SGP-Pharma - Logiciel de Gestion d'Officine Pharmaceutique"

If objFSO.FileExists(icoPath) Then
    oLink.IconLocation = icoPath & ", 0"
ElseIf objFSO.FileExists(exePath) Then
    oLink.IconLocation = exePath & ", 0"
End If

oLink.Save

MsgBox "Le raccourci 'SGP-Pharma' a ete cree sur votre Bureau avec l'icone de la pharmacie." & vbCrLf & vbCrLf & "Vous pouvez maintenant lancer l'application directement depuis votre Bureau.", vbInformation, "SGP-Pharma - Installation"

Set oLink    = Nothing
Set objShell = Nothing
Set objFSO   = Nothing
WScript.Quit
'''

SHORTCUT_BAT_CONTENT = """@echo off
cd /d "%~dp0"
cscript //nologo "Creer_Raccourci_Bureau.vbs"
"""


# ── Lanceur Debug BAT ─────────────────────────────────────────────────────────
BAT_CONTENT = """@echo off
title SGP-Pharma - Mode Console Debug
cd /d "%~dp0"
echo ============================================================
echo   DEMARRAGE DE SGP-PHARMA EN MODE CONSOLE (DEBUG)
echo ============================================================
echo Base de donnees : HOP-Pharma
echo Port            : 8000
echo.
echo Verification du service MongoDB...
tasklist /fi "imagename eq mongod.exe" | findstr /i "mongod.exe" >nul
if errorlevel 1 (
    echo [ATTENTION] mongod.exe n'apparait pas dans la liste des processus.
    echo Assurez-vous que le service MongoDB Server est bien demarre.
    echo.
)
echo Lancement de SGP-Pharma...
"SGP-Pharma.exe"
pause
"""


# ── Guide d'installation Client ───────────────────────────────────────────────
GUIDE_CONTENT = """================================================================================
          SGP-PHARMA · GUIDE DE DEPLOIEMENT ET D'INSTALLATION CLIENT
                         OPTINET · Lome, Togo
================================================================================

Bienvenue dans SGP-Pharma, logiciel de gestion integree d'officine pharmaceutique.

--------------------------------------------------------------------------------
1. CONTENU DU DOSSIER DE LIVRAISON
--------------------------------------------------------------------------------
  - SGP-Pharma.exe             -> Application principale
  - _internal/                 -> Librairies et composants (ne pas deplacer)
  - .env                       -> Configuration (Base HOP-Pharma, port 27017)
  - Lancer Silencieux.vbs      -> LANCEUR PRINCIPAL (demarrage sans fenetre noire)
  - Lancer SGP-Pharma.vbs      -> Lanceur alternatif identique
  - Creer_Raccourci_Bureau.bat -> Cree le raccourci sur le Bureau en 1 clic
  - Creer_Raccourci_Bureau.vbs -> Script VBS pour creation du raccourci
  - LANCER_DEBUG.bat           -> Lanceur console pour diagnostic / maintenance
  - LOGO-SGP-Pharma.png        -> Logo officiel de la pharmacie
  - sgp_pharma.ico / app.ico   -> Icone de pharmacie pour les raccourcis
  - GUIDE_INSTALLATION_CLIENT.txt -> Ce guide

--------------------------------------------------------------------------------
2. INSTALLATION CHEZ LE CLIENT (2 ETAPES SIMPLES)
--------------------------------------------------------------------------------
  ETAPE 1 : Installer MongoDB Community Edition
    - Installez mongodb-windows-x86_64-...exe sur le PC.
    - Cochez "Install MongoDB as a Service" (service automatique au demarrage).
    - Port standard : 27017.

  ETAPE 2 : Creer le Raccourci sur le Bureau
    - Copiez le dossier "Deployement client" sur le PC (ex: C:\\SGP-Pharma).
    - Double-cliquez sur "Creer_Raccourci_Bureau.bat"
    - Un raccourci "SGP-Pharma" avec le logo de pharmacie apparait sur le Bureau.

--------------------------------------------------------------------------------
3. UTILISATION QUOTIDIENNE
--------------------------------------------------------------------------------
  Double-cliquez simplement sur l'icone "SGP-Pharma" sur votre Bureau :
    -> SGP-Pharma demarre silencieusement en arriere-plan.
    -> Votre navigateur web s'ouvre automatiquement sur :
       http://127.0.0.1:8000

--------------------------------------------------------------------------------
4. BASE DE DONNEES ET ETAT INITIAL
--------------------------------------------------------------------------------
  - Nom de la base : HOP-Pharma
  - Catalogue      : 188 produits pharmaceutiques Togo / CAMEG
  - Stocks         : TOUS LES STOCKS SONT A ZERO (Pret pour entrees d'officine)
  - Caisse         : Prete a l'emploi des le premier approvisionnement

--------------------------------------------------------------------------------
5. IDENTIFIANTS DE CONNEXION PAR DEFAUT
--------------------------------------------------------------------------------
  Compte Administrateur Unique :
    Nom          : Admin Pharmacie
    Email        : admin@sgp-pharma.tg
    Mot de passe : Admin@2026
    Role         : Administrateur (Actif)

  Note : Les autres comptes utilisateurs (caissiers, pharmaciens, magasiniers)
         doivent etre crees depuis le menu "Utilisateurs" selon les besoins
         propres a l'officine.

  IMPORTANT : Modifiez le mot de passe de l'administrateur des la premiere connexion.

--------------------------------------------------------------------------------
   OPTINET · Lome, Togo · optinetsarl@gmail.com · +228 90 74 84 65
================================================================================
"""


def prepare_deployment_package():
    print("=" * 65)
    print("   PREPARATION DU DOSSIER : Deployement client (Version Autonome)")
    print("=" * 65)

    # 1. Nettoyage + création du dossier
    if DEPLOY_DIR.exists():
        print("Nettoyage de l'ancien dossier Deployement client...")
        shutil.rmtree(DEPLOY_DIR)
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)

    # ── 2. Copier l'EXE + _internal/ directement à la racine ──────────────────
    print("\n[1/5] Copie de l'application (EXE + _internal)...")
    if not DIST_DIR.exists():
        print(f"[ERREUR] Dossier dist introuvable : {DIST_DIR}")
        raise FileNotFoundError(str(DIST_DIR))

    for item in DIST_DIR.iterdir():
        dest = DEPLOY_DIR / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
    print(f"   OK - Application copiee dans {DEPLOY_DIR}")

    # ── 3. Fichier .env avec DB_NAME=HOP-Pharma ───────────────────────────────
    print("\n[2/5] Configuration .env (DB_NAME=HOP-Pharma)...")
    env_content = """# ============================================================
# SGP-Pharma - Configuration d'environnement Production
# ============================================================
MONGO_URL="mongodb://localhost:27017"
DB_NAME="HOP-Pharma"
CORS_ORIGINS="*"
JWT_SECRET="b3a5c1e7f9d24a8d6c0e2f1b7a9c8d5e4f3b2a1c9d8e7f6a5b4c3d2e1f0a9b8c"
ADMIN_EMAIL="admin@sgp-pharma.tg"
ADMIN_PASSWORD="Admin@2026"
SEED_DEMO="false"
"""
    with open(DEPLOY_DIR / ".env", "w", encoding="utf-8") as f:
        f.write(env_content)
    print("   OK - .env cree avec DB_NAME=HOP-Pharma")

    # ── 4. Logos et Icones ────────────────────────────────────────────────────
    print("\n[3/5] Copie du logo et des icones...")
    if LOGO_SRC.exists():
        shutil.copy2(LOGO_SRC, DEPLOY_DIR / "LOGO-SGP-Pharma.png")
        print("   OK - LOGO-SGP-Pharma.png copie")
    if ICO_SRC.exists():
        shutil.copy2(ICO_SRC, DEPLOY_DIR / "sgp_pharma.ico")
        shutil.copy2(ICO_SRC, DEPLOY_DIR / "app.ico")
        print("   OK - sgp_pharma.ico et app.ico copies")

    # ── 5. Lanceurs Silencieux, Raccourcis et Debug ────────────────────────────
    print("\n[4/5] Creation des lanceurs et scripts de raccourci...")
    with open(DEPLOY_DIR / "Lancer Silencieux.vbs", "w", encoding="utf-8") as f:
        f.write(VBS_CONTENT)
    with open(DEPLOY_DIR / "Lancer SGP-Pharma.vbs", "w", encoding="utf-8") as f:
        f.write(VBS_CONTENT)
    with open(DEPLOY_DIR / "Creer_Raccourci_Bureau.vbs", "w", encoding="utf-8") as f:
        f.write(SHORTCUT_VBS_CONTENT)
    with open(DEPLOY_DIR / "Creer_Raccourci_Bureau.bat", "w", encoding="utf-8") as f:
        f.write(SHORTCUT_BAT_CONTENT)
    with open(DEPLOY_DIR / "LANCER_DEBUG.bat", "w", encoding="utf-8") as f:
        f.write(BAT_CONTENT)

    print("   OK - 'Lancer Silencieux.vbs' cree")
    print("   OK - 'Lancer SGP-Pharma.vbs' cree")
    print("   OK - 'Creer_Raccourci_Bureau.bat' & .vbs crees")
    print("   OK - 'LANCER_DEBUG.bat' cree")

    # ── 6. Guide d'installation ────────────────────────────────────────────────
    print("\n[5/5] Creation du guide client...")
    with open(DEPLOY_DIR / "GUIDE_INSTALLATION_CLIENT.txt", "w", encoding="utf-8") as f:
        f.write(GUIDE_CONTENT)
    print("   OK - GUIDE_INSTALLATION_CLIENT.txt genere")

    # ── Resume ─────────────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("   DEPLOIEMENT CLIENT TERMINE AVEC SUCCES !")
    print(f"   Dossier cible : {DEPLOY_DIR}")
    print("=" * 65)
    total_size = 0
    for item in sorted(DEPLOY_DIR.iterdir()):
        if item.is_file():
            size_mb = item.stat().st_size / 1024 / 1024
            total_size += item.stat().st_size
            print(f"  [{size_mb:>7.2f} MB]  {item.name}")
        else:
            nb = sum(1 for _ in item.rglob("*") if _.is_file())
            folder_size = sum(_.stat().st_size for _ in item.rglob("*") if _.is_file()) / 1024 / 1024
            total_size += folder_size * 1024 * 1024
            print(f"  [{folder_size:>7.2f} MB]  {item.name}/  ({nb} fichiers)")
    print(f"\nTaille totale du package : {total_size / 1024 / 1024:.2f} MB")
    print()


if __name__ == "__main__":
    prepare_deployment_package()
