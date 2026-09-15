@echo off
title Rebuild Complet et Deploiement SGP-Pharma
cd /d "%~dp0"
echo ========================================================
echo   REBUILD COMPLET ET GENERATION DU DOSSIER DEPLOIEMENT
echo ========================================================
echo.
echo [1/2] Compilation React et generation de l'Executable...
.\.venv\Scripts\python.exe build_exe.py
if errorlevel 1 (
    echo [ERREUR] Echec de la compilation de l'executable.
    pause
    exit /b 1
)

echo.
echo [2/2] Assemblage du package "Deployement client"...
.\.venv\Scripts\python.exe prepare_deployment.py
if errorlevel 1 (
    echo [ERREUR] Echec de l'assemblage du package de deploiement.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo [SUCCES] Package "Deployement client" pret pour livraison !
echo ========================================================
pause
