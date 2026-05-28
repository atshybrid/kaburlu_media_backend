#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$REPO_ROOT/.deploy.env" ]] && source "$REPO_ROOT/.deploy.env"

HOST="${DEPLOY_HOST:-}"
USER_NAME="${DEPLOY_USER:-deploy}"
APP_DIR="${DEPLOY_PATH:-/home/deploy/kaburlu_media_backend}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")

[[ -z "$HOST" ]] && { echo "DEPLOY_HOST required" >&2; exit 1; }

RSYNC_SSH="ssh ${SSH_OPTS[*]}"
echo "[remote] Syncing migration, scripts, data..."
rsync -az -e "$RSYNC_SSH" \
  "$REPO_ROOT/prisma/migrations/20260525120000_indian_political_parties/" \
  "$USER_NAME@$HOST:$APP_DIR/prisma/migrations/20260525120000_indian_political_parties/"

rsync -az -e "$RSYNC_SSH" \
  "$REPO_ROOT/scripts/data/indian-political-parties/eci-gazette-2024.txt" \
  "$REPO_ROOT/scripts/data/indian-political-parties/eci-national-state-seed.json" \
  "$USER_NAME@$HOST:$APP_DIR/scripts/data/indian-political-parties/"

rsync -az -e "$RSYNC_SSH" \
  "$REPO_ROOT/scripts/lib/parseEciGazette.ts" \
  "$REPO_ROOT/scripts/lib/partyBrandColors.ts" \
  "$REPO_ROOT/scripts/import_indian_political_parties_full.ts" \
  "$REPO_ROOT/scripts/upload_indian_party_symbols.ts" \
  "$REPO_ROOT/src/lib/indianPoliticalParty.ts" \
  "$USER_NAME@$HOST:$APP_DIR/scripts/lib/" 2>/dev/null || true

ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" "set -e
  cd '$APP_DIR'
  mkdir -p scripts/lib scripts/data/indian-political-parties
  cp -f scripts/lib/parseEciGazette.ts scripts/lib/ 2>/dev/null || true
  cp -f scripts/lib/partyBrandColors.ts scripts/lib/ 2>/dev/null || true
  test -f scripts/import_indian_political_parties_full.ts || echo 'WARN: run deploy first for scripts'
  npx prisma migrate deploy --schema prisma/schema.prisma
  npx ts-node --transpile-only scripts/import_indian_political_parties_full.ts
  npx ts-node --transpile-only scripts/upload_indian_party_symbols.ts
  npx ts-node --transpile-only scripts/upload_indian_party_symbols.ts --all-national-state
"
