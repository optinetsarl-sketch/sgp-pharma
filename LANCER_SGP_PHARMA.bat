@echo off
title SGP-Pharma - Logiciel de Gestion d'Officine
cd /d "%~dp0"
if exist "dist\SGP-Pharma\SGP-Pharma.exe" (
    echo Demarrage de SGP-Pharma Standalone...
    start "" "dist\SGP-Pharma\SGP-Pharma.exe"
) else (
    echo Demarrage du serveur et de l'interface...
    .\.venv\Scripts\python.exe desktop_app.py
)
exit
