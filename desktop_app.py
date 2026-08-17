"""
SGP-Pharma · Launcher d'application Desktop Standalone
Combine le Frontend React et le Backend FastAPI dans un seul exécutable Windows (.exe).
"""

import os
import sys
import time
import socket
import logging
import threading
import subprocess
import webbrowser
from pathlib import Path
import urllib.request

# Adjust base paths (support running from source or from PyInstaller bundle)
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    BASE_DIR = Path(sys._MEIPASS)
    APP_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent
    APP_DIR = BASE_DIR

# Add backend directory to sys.path
backend_path = BASE_DIR / "backend"
if backend_path.exists() and str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("SGP-Launcher")


def find_free_port(preferred_port=8000):
    """Check if preferred port is free or find the next available port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('127.0.0.1', preferred_port)) != 0:
            return preferred_port
    # Find any free port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def start_uvicorn_server(host="127.0.0.1", port=8000):
    """Start uvicorn server in a background thread."""
    import uvicorn
    import server

    config = uvicorn.Config(
        app=server.app,
        host=host,
        port=port,
        log_level="warning",
        access_log=False
    )
    srv = uvicorn.Server(config)
    srv.run()


def wait_for_server(url, timeout=15):
    """Wait for server to be responsive."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def launch_app_window(url):
    """Launch clean standalone desktop application window."""
    # List of possible browsers supporting --app mode (standalone window without URL bar)
    browser_candidates = [
        # Microsoft Edge (default on all Windows 10/11)
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        # Google Chrome
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        # Brave
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]

    for exe in browser_candidates:
        if os.path.isfile(exe):
            try:
                logger.info(f"Ouverture en mode Application Desktop via: {exe}")
                proc = subprocess.Popen([
                    exe,
                    f"--app={url}",
                    "--window-size=1400,850",
                    "--window-position=100,50",
                    "--start-maximized"
                ])
                return proc
            except Exception as e:
                logger.warning(f"Erreur lancement navigateur {exe}: {e}")

    # Fallback to standard default browser
    logger.info("Ouverture dans le navigateur par défaut...")
    webbrowser.open(url)
    return None


def main():
    print("=" * 60)
    print("   SGP-PHARMA · GESTION INTÉGRÉE D'OFFICINE DE PHARMACIE")
    print("   Démarrage de l'application...")
    print("=" * 60)

    port = find_free_port(8000)
    app_url = f"http://127.0.0.1:{port}"
    logger.info(f"Port assigné : {port} ({app_url})")

    # Start FastAPI backend in background daemon thread
    server_thread = threading.Thread(
        target=start_uvicorn_server,
        args=("127.0.0.1", port),
        daemon=True
    )
    server_thread.start()

    logger.info("Initialisation du serveur et des données...")
    if wait_for_server(app_url, timeout=20):
        logger.info("Serveur SGP-Pharma prêt !")
        app_proc = launch_app_window(app_url)
        print(f"\n[OK] SGP-Pharma est actif sur : {app_url}")
        print("Laissez cette fenêtre ouverte pendant l'utilisation.")
        print("Pour arrêter l'application, fermez simplement cette fenêtre ou appuyez sur Ctrl+C.\n")

        try:
            if app_proc:
                # Wait for the browser window to be closed
                app_proc.wait()
            else:
                # Keep main thread alive
                while True:
                    time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Arrêt demandé par l'utilisateur.")
    else:
        logger.error("Le serveur n'a pas pu démarrer dans le délai imparti.")
        input("Appuyez sur Entrée pour quitter...")


if __name__ == "__main__":
    main()
