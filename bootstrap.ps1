$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PyVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)"
if ($LASTEXITCODE -ne 0) {
	Write-Error "Python 3.9+ is required. Found Python $PyVersion"
	exit 1
}

Write-Host "[1/4] Creating Python virtual environment..."
python -m venv "$RootDir\backend\.venv"

Write-Host "[2/4] Installing backend dependencies..."
& "$RootDir\backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$RootDir\backend\.venv\Scripts\python.exe" -m pip install -r "$RootDir\backend\requirements.txt"

Write-Host "[3/4] Installing frontend dependencies..."
Set-Location "$RootDir\frontend"
npm install

Write-Host "[4/4] Setup complete."
Write-Host "Run backend:  .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
Write-Host "Run frontend: cd frontend; npm run dev"
