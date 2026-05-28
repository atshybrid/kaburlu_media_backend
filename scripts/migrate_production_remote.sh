#!/usr/bin/env bash
# Run Prisma migrate deploy on the production droplet (server .env → localhost:5432).
# Mac .env often points at DO Managed Postgres :25060 — not reachable locally (P1001).
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$REPO_ROOT/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.deploy.env"
  set +a
fi

HOST="${DEPLOY_HOST:-${DO_SERVER_IP:-${DROPLET_HOST:-}}}"
USER_NAME="${DEPLOY_USER:-deploy}"
APP_DIR="${DEPLOY_PATH:-/home/deploy/kaburlu_media_backend}"
APP_NAME="${DEPLOY_APP_NAME:-kaburlu-api}"

if [[ -z "$HOST" ]]; then
  echo "[migrate] Set DEPLOY_HOST in .deploy.env (or DO_SERVER_IP / DROPLET_HOST)" >&2
  exit 1
fi

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
fi

echo "[migrate] Sync prisma → $USER_NAME@$HOST:$APP_DIR/prisma/"
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "$REPO_ROOT/prisma/schema.prisma" \
  "$USER_NAME@$HOST:$APP_DIR/prisma/schema.prisma"

rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "$REPO_ROOT/prisma/migrations/" \
  "$USER_NAME@$HOST:$APP_DIR/prisma/migrations/"

ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" \
  APP_DIR="$APP_DIR" APP_NAME="$APP_NAME" 'bash -se' <<'REMOTE'
set -Eeuo pipefail
cd "$APP_DIR"
echo "[remote] migrate deploy (uses $APP_DIR/.env DATABASE_URL — droplet Postgres)"
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
pm2 restart "$APP_NAME" 2>/dev/null || true
REMOTE

echo "[migrate] Done."
