#!/usr/bin/env bash
# Run on a host that can reach the DB (e.g. production droplet after SSH).
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[prgi] prisma generate..."
npx prisma generate

echo "[prgi] migrate deploy..."
npx prisma migrate deploy

echo "[prgi] import CSV rows..."
npx ts-node --transpile-only scripts/import_prgi_registered_titles.ts "$@"

echo "[prgi] done."
