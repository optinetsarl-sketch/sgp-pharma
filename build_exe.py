"""
Script de compilation automatique SGP-Pharma vers un fichier Exécutable (.exe) Windows.
Combine le Frontend React et le Backend FastAPI dans un bundle autonome.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
FRONTEND_BUILD = FRONTEND_DIR / "build"
BACKEND_DIR = ROOT_DIR / "backend"
DIST_DIR = ROOT_DIR / "dist"
BUILD_DIR = ROOT_DIR / "build"


def step_1_build_frontend():
    print("\n" + "=" * 60)
    print("   [1/3] Compilation du Frontend React (Production Build)...")
    print("=" * 60)
    
    cmd = "yarn --cwd frontend build"
    res = subprocess.run(cmd, shell=True, cwd=ROOT_DIR)
    if res.returncode != 0:
        print("Erreur: Échec du build React.")
        sys.exit(1)

    if not (FRONTEND_BUILD / "index.html").exists():
        print("Erreur: frontend/build/index.html n'a pas été généré.")
        sys.exit(1)
    print("[OK] Frontend React compilé avec succès !")


def step_2_compile_pyinstaller():
    print("\n" + "=" * 60)
    print("   [2/3] Compilation PyInstaller Standalone (.exe)...")
    print("=" * 60)

    pyinstaller_exe = ROOT_DIR / ".venv" / "Scripts" / "pyinstaller.exe"
    if not pyinstaller_exe.exists():
        pyinstaller_exe = Path(sys.executable).parent / "Scripts" / "pyinstaller.exe"
    if not pyinstaller_exe.exists():
        pyinstaller_exe = "pyinstaller"

    hidden_imports = [
        "uvicorn", "uvicorn.logging", "uvicorn.loops", "uvicorn.loops.auto",
        "uvicorn.protocols", "uvicorn.protocols.http", "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets", "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan", "uvicorn.lifespan.on",
        "fastapi", "fastapi.staticfiles", "fastapi.responses",
        "starlette", "starlette.middleware", "starlette.middleware.cors", "starlette.staticfiles",
        "motor", "motor.motor_asyncio", "pymongo",
        "passlib", "passlib.handlers", "passlib.handlers.bcrypt", "bcrypt",
        "jwt", "jose",
        "reportlab", "reportlab.pdfgen", "reportlab.pdfgen.canvas",
        "reportlab.lib", "reportlab.lib.pagesizes", "reportlab.lib.units",
        "pydantic", "dotenv",
    ]

    import_args = []
    for imp in hidden_imports:
        import_args.extend(["--hidden-import", imp])

    add_data_args = [
        "--add-data", f"{FRONTEND_BUILD};frontend_build",
        "--add-data", f"{BACKEND_DIR};backend",
    ]
    if (BACKEND_DIR / ".env").exists():
        add_data_args.extend(["--add-data", f"{BACKEND_DIR / '.env'};backend"])

    # Clean old dist folder if exists
    target_dist = DIST_DIR / "SGP-Pharma"
    if target_dist.exists():
        try:
            shutil.rmtree(target_dist)
        except Exception:
            pass

    cmd = [
        str(pyinstaller_exe),
        "--noconfirm",
        "--onedir",
        "--name", "SGP-Pharma",
        "--distpath", str(DIST_DIR),
        "--workpath", str(BUILD_DIR),
        "--paths", str(BACKEND_DIR),
        *add_data_args,
        *import_args,
        str(ROOT_DIR / "desktop_app.py")
    ]

    print(f"Exécution de PyInstaller...")
    res = subprocess.run(cmd, cwd=ROOT_DIR)
    if res.returncode != 0:
        print("Erreur: Échec de la compilation PyInstaller.")
        sys.exit(1)

    output_exe = DIST_DIR / "SGP-Pharma" / "SGP-Pharma.exe"
    if output_exe.exists():
        print(f"\n[OK] Exécutable généré avec succès dans :")
        print(f"     {output_exe}")
    else:
        print(f"\n[!] Dossier dist généré dans : {DIST_DIR}")


def step_3_create_shortcuts():
    print("\n" + "=" * 60)
    print("   [3/3] Configuration du Lanceur Rapide Windows (.bat)...")
    print("=" * 60)
    
    launcher_bat = ROOT_DIR / "LANCER_SGP_PHARMA.bat"
    with open(launcher_bat, "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("title SGP-Pharma - Logiciel de Gestion d'Officine\n")
        f.write("cd /d \"%~dp0\"\n")
        f.write("if exist \"dist\\SGP-Pharma\\SGP-Pharma.exe\" (\n")
        f.write("    echo Demarrage de SGP-Pharma Standalone...\n")
        f.write("    start \"\" \"dist\\SGP-Pharma\\SGP-Pharma.exe\"\n")
        f.write(") else (\n")
        f.write("    echo Demarrage du serveur et de l'interface...\n")
        f.write("    .\\.venv\\Scripts\\python.exe desktop_app.py\n")
        f.write(")\n")
        f.write("exit\n")
    print(f"[OK] Fichier de lancement rapide prêt : {launcher_bat}")


if __name__ == "__main__":
    step_1_build_frontend()
    step_2_compile_pyinstaller()
    step_3_create_shortcuts()
    print("\n" + "=" * 60)
    print("   [SUCCES] SGP-PHARMA EST PRET A L'EMPLOI EN MODE EXE !")
    print("=" * 60)
