"""
SGP-Pharma - Launcher d'application Desktop Standalone
Combine le Frontend React et le Backend FastAPI dans un seul executable Windows (.exe).
"""

import os
import sys
import time
import socket
import logging
import threading
import webbrowser
from pathlib import Path
import urllib.request

# Configuration d'encodage console pour Windows (evite tout UnicodeEncodeError cp1252/cp850)
if sys.platform.startswith('win'):
    try:
        if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# -- Chemins de base (source ou bundle PyInstaller) ------------------------------
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    BASE_DIR = Path(sys._MEIPASS)
    APP_DIR  = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent
    APP_DIR  = BASE_DIR

# -- Charger les variables d'environnement (.env) --------------------------------
try:
    from dotenv import load_dotenv
    if getattr(sys, 'frozen', False):
        load_dotenv(APP_DIR / '.env')
    load_dotenv(Path.cwd() / '.env')
    load_dotenv(BASE_DIR / 'backend' / '.env')
except Exception:
    pass

# -- Ajouter le dossier backend au sys.path --------------------------------------
backend_path = BASE_DIR / "backend"
if backend_path.exists() and str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("SGP-Launcher")


# -- Utilitaires -----------------------------------------------------------------

def find_free_port(preferred_port: int = 8000) -> int:
    """Retourne le port prefere s'il est libre, sinon un port libre quelconque."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('127.0.0.1', preferred_port)) != 0:
            return preferred_port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def start_uvicorn_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Lance le serveur uvicorn (FastAPI) - destine a tourner dans un thread daemon."""
    import uvicorn
    import server  # backend/server.py

    config = uvicorn.Config(
        app=server.app,
        host=host,
        port=port,
        log_level="warning",
        access_log=False,
    )
    uvicorn.Server(config).run()


def wait_for_server(url: str, timeout: int = 25) -> bool:
    """Attend que le serveur FastAPI reponde sur /api/health."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


# -- Point d'entree principal -----------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("   SGP-PHARMA - GESTION INTEGREE D'OFFICINE DE PHARMACIE")
    print("   Demarrage de l'application...")
    print("=" * 60)

    port    = find_free_port(8000)
    app_url = f"http://127.0.0.1:{port}"
    logger.info(f"Port assigne : {port} -> {app_url}")

    # -- Lancer FastAPI dans un thread daemon ------------------------------------
    threading.Thread(
        target=start_uvicorn_server,
        args=("127.0.0.1", port),
        daemon=True,
        name="uvicorn-server"
    ).start()

    logger.info("Attente du demarrage du serveur...")
    if not wait_for_server(app_url, timeout=25):
        logger.error("[ERREUR] Le serveur n'a pas pu demarrer dans le delai imparti.")
        input("Appuyez sur Entree pour quitter...")
        return

    logger.info("[OK] Serveur SGP-Pharma pret !")

    # -- Ouvrir l'application dans le navigateur par defaut de Windows -----------
    logger.info(f"Ouverture dans le navigateur par defaut -> {app_url}")
    webbrowser.open(app_url)

    print(f"\n  [OK] SGP-Pharma est actif sur : {app_url}")
    print("  Le serveur reste actif tant que cette fenetre est ouverte.")
    print("  Pour arreter l'application, fermez cette fenetre ou appuyez sur Ctrl+C.\n")

    # -- Maintenir le processus principal en vie ---------------------------------
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Arret demande par l'utilisateur.")


if __name__ == "__main__":
    main()
