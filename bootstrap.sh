#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
	echo "python3 is not installed or not on PATH."
	exit 1
fi

PY_MINOR="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)'; then
	echo "Python 3.9+ is required. Found Python ${PY_MINOR}."
	exit 1
fi

echo "[1/4] Creating Python virtual environment..."
python3 -m venv "$ROOT_DIR/backend/.venv"

# shellcheck disable=SC1091
source "$ROOT_DIR/backend/.venv/bin/activate"

echo "[2/4] Installing backend dependencies..."
pip install --upgrade pip
pip install -r "$ROOT_DIR/backend/requirements.txt"

echo "[3/4] Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo "[4/4] Setup complete."
echo "Run backend:  cd $ROOT_DIR/backend && ./start_backend.sh"
echo "Run frontend: cd $ROOT_DIR/frontend && ./start_frontend.sh"
