@echo off
title Compilation SGP-Pharma vers Executable .EXE
cd /d "%~dp0"
echo ========================================================
echo    COMPILATION SGP-PHARMA (FRONTEND + BACKEND STANDALONE)
echo ========================================================
echo.
.\.venv\Scripts\python.exe build_exe.py
echo.
pause
