#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Virtual environment not found at backend/.venv"
  echo "Create it first with: python3 -m venv backend/.venv"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
