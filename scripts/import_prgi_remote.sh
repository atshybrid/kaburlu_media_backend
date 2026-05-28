#!/usr/bin/env bash
# Import PRGI CSV data via production droplet (when local Mac cannot reach DO Postgres).
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$REPO_ROOT/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.deploy.env"
  set +a
fi

HOST="${DEPLOY_HOST:-${DO_SERVER_IP:-142.93.213.144}}"
USER_NAME="${DEPLOY_USER:-deploy}"
APP_DIR="${DEPLOY_PATH:-/home/deploy/kaburlu_media_backend}"
STAGING="/home/deploy/prgi_import_staging"
SQL_FILE="$REPO_ROOT/scripts/data/prgi-registered-titles/import_prgi.sql"
MIGRATION_SQL="$REPO_ROOT/prisma/migrations/20260524120000_prgi_registered_titles/migration.sql"
SCHEMA="$REPO_ROOT/prisma/schema.prisma"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
fi

echo "[prgi-remote] Generating SQL from CSVs (if needed)..."
node "$REPO_ROOT/scripts/generate_prgi_import_sql.js"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "[prgi-remote] Missing $SQL_FILE" >&2
  exit 1
fi

echo "[prgi-remote] Uploading to $USER_NAME@$HOST:$STAGING ..."
ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" "mkdir -p '$STAGING'"
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "$MIGRATION_SQL" "$SCHEMA" "$SQL_FILE" \
  "$USER_NAME@$HOST:$STAGING/"

echo "[prgi-remote] Ensuring table exists..."
ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" bash -s <<REMOTE
set -e
cd "$APP_DIR"
npx prisma db execute --file "$STAGING/migration.sql" --schema "$STAGING/schema.prisma" 2>/dev/null || true
npx prisma db execute --stdin --schema "$STAGING/schema.prisma" <<'SQL' 2>/dev/null || true
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '', NOW(), '20260524120000_prgi_registered_titles', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260524120000_prgi_registered_titles'
);
SQL
echo "[prgi-remote] Importing rows (ON CONFLICT DO NOTHING)..."
npx prisma db execute --file "$STAGING/import_prgi.sql" --schema "$STAGING/schema.prisma"
echo "[prgi-remote] Done."
REMOTE

echo "[prgi-remote] Import finished on production DB."
