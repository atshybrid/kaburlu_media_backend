#!/usr/bin/env bash

set -Eeuo pipefail
trap 'echo "[deploy] ERROR: command failed at line $LINENO: $BASH_COMMAND" >&2' ERR

HOST="${DEPLOY_HOST:-${DO_SERVER_IP:-${DROPLET_HOST:-}}}"
USER_NAME="${DEPLOY_USER:-deploy}"
APP_DIR="${DEPLOY_PATH:-/home/deploy/kaburlu_media_backend}"
APP_NAME="${DEPLOY_APP_NAME:-kaburlu-api}"
HEALTH_PORT="${DEPLOY_HEALTH_PORT:-3001}"
HEALTH_PATH="${DEPLOY_HEALTH_PATH:-/health/ai}"
SKIP_LOCAL_BUILD="${SKIP_LOCAL_BUILD:-false}"

if [[ -z "$HOST" ]]; then
  echo "[deploy] DEPLOY_HOST (or DO_SERVER_IP / DROPLET_HOST) is required." >&2
  exit 1
fi

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=15
  -o StrictHostKeyChecking=accept-new
)

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=( -i "$DEPLOY_SSH_KEY" )
fi

run_ssh() {
  ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" "$@"
}

if [[ "$SKIP_LOCAL_BUILD" != "true" ]]; then
  echo "[deploy] Installing dependencies and building locally..."
  npm ci
  npm run build
else
  echo "[deploy] Skipping local build (SKIP_LOCAL_BUILD=true)."
fi

echo "[deploy] Uploading dist/ to $USER_NAME@$HOST:$APP_DIR/dist_new/..."
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" dist/ "$USER_NAME@$HOST:$APP_DIR/dist_new/"

if [[ -n "${DEPLOY_ENV_FILE:-}" ]]; then
  if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
    echo "[deploy] DEPLOY_ENV_FILE not found: $DEPLOY_ENV_FILE" >&2
    exit 1
  fi
  echo "[deploy] Uploading env file from $DEPLOY_ENV_FILE"
  scp "${SSH_OPTS[@]}" "$DEPLOY_ENV_FILE" "$USER_NAME@$HOST:$APP_DIR/.env"
  run_ssh "chmod 600 '$APP_DIR/.env' || true"
fi

echo "[deploy] Running remote deployment script..."
ssh "${SSH_OPTS[@]}" "$USER_NAME@$HOST" APP_DIR="$APP_DIR" APP_NAME="$APP_NAME" HEALTH_PORT="$HEALTH_PORT" HEALTH_PATH="$HEALTH_PATH" 'bash -se' <<'REMOTE_SCRIPT'
set -Eeuo pipefail
trap 'echo "[remote] ERROR: command failed at line $LINENO: $BASH_COMMAND" >&2' ERR

cd "$APP_DIR"

if [[ ! -d dist_new ]]; then
  echo "[remote] dist_new is missing at $APP_DIR/dist_new" >&2
  ls -la "$APP_DIR" || true
  exit 1
fi

echo "[remote] Activating uploaded build"
rm -rf dist
mv dist_new dist

if [[ -f package-lock.json ]]; then
  echo "[remote] Installing production dependencies"
  rm -rf node_modules
  npm ci --omit=dev
else
  echo "[remote] package-lock.json not found, skipping npm ci"
fi

if [[ -d prisma ]]; then
  echo "[remote] Generating Prisma client"
  npx prisma generate
fi

if [[ -f "/snap/bin/chromium" ]]; then
  CHROME_BIN="/snap/bin/chromium"
elif [[ -f "/usr/bin/chromium" ]]; then
  CHROME_BIN="/usr/bin/chromium"
elif [[ -f "/usr/bin/chromium-browser" ]]; then
  CHROME_BIN="/usr/bin/chromium-browser"
else
  CHROME_BIN=""
  echo "[remote] Chromium not found; PDF generation may not work"
fi

export PUPPETEER_EXECUTABLE_PATH="$CHROME_BIN"

echo "[remote] Restarting PM2 app: $APP_NAME"
pm2 stop "$APP_NAME" 2>/dev/null || true
fuser -k "$HEALTH_PORT"/tcp 2>/dev/null || true
sleep 2
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[remote] Health check: http://127.0.0.1:$HEALTH_PORT$HEALTH_PATH"
OK=0
for i in $(seq 1 25); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$HEALTH_PORT$HEALTH_PATH" >/dev/null 2>&1; then
    OK=1
    echo "[remote] Health check passed (attempt $i)"
    break
  fi
  echo "[remote] Waiting for app ($i/25)"
  sleep 2
done

if [[ "$OK" -ne 1 ]]; then
  echo "[remote] Health check failed"
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
  exit 1
fi

echo "[remote] Deployment successful"
REMOTE_SCRIPT

echo "[deploy] Completed successfully."