#!/usr/bin/env bash
set -euo pipefail

cd /workspace

if ! command -v redis-server >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server
fi

[ -f .env ] || cp .env.example .env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env

go mod download

cd frontend
npm ci
cd ..
