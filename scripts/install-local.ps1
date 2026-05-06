$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
Set-Location $root

if (-not (Test-Path $venvPython)) {
  python -m venv (Join-Path $root ".venv")
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $root "backend\requirements.txt")

npm install
yarn --cwd (Join-Path $root "frontend") install

Write-Host ""
Write-Host "Installation terminee."
Write-Host "Demarrage local: npm start"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend:  http://localhost:8000/api/health"
