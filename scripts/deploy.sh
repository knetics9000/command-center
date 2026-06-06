#!/usr/bin/env bash
# One-command (re)deploy on the VPS. Run from the project root after `git pull`.
# Idempotent: safe to run repeatedly. Does NOT touch .env (you manage that).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
npm ci

echo "==> Ensuring database is initialized + migrated"
npm run db:init
npm run migrate

echo "==> Building"
npm run build

echo "==> (Re)starting under pm2"
if pm2 describe command-center >/dev/null 2>&1; then
  pm2 restart command-center --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo "==> Done. Current status:"
pm2 status command-center
echo
echo "Next, if not done yet:"
echo "  1) Visit https://YOURDOMAIN/connect and connect both Google accounts"
echo "  2) Install the cron jobs:  crontab scripts/crontab.txt   (edit paths first)"
