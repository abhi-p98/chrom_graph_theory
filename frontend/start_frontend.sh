#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "node_modules not found in frontend/."
  echo "Install dependencies first with: npm install"
  exit 1
fi

exec npm run dev
