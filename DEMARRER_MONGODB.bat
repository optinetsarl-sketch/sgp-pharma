@echo off
title Demarrage Service MongoDB
echo ============================================================
echo   DEMARRAGE DU SERVICE WINDOWS MONGODB
echo ============================================================
echo.
net start MongoDB
if errorlevel 1 (
    echo.
    echo ------------------------------------------------------------
    echo ATTENTION : Ce script necessite les droits Administrateur.
    echo.
    echo Solution :
    echo   1. Fermez cette fenetre
    echo   2. Faites Clic droit sur "DEMARRER_MONGODB.bat"
    echo   3. Choisissez "Executer en tant qu'administrateur"
    echo ------------------------------------------------------------
) else (
    echo.
    echo [OK] MongoDB Server est actif sur le port 27017 !
    echo Vous pouvez maintenant relancer votre serveur uvicorn ou SGP-Pharma.
)
echo.
pause
