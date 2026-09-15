@echo off
title Preparation du Package Deployement Client
cd /d "%~dp0"
echo ========================================================
echo    GENERATION DU DOSSIER DEPLOYEMENT CLIENT
echo ========================================================
echo.
.\.venv\Scripts\python.exe prepare_deployment.py
echo.
pause
