#!/usr/bin/env bash
# Run this on the server, from /opt/resin, to pull and deploy the latest code.
# Requires a passwordless sudo rule for `systemctl restart resin` (see deploy/README.md).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull

echo "==> Installing dependencies"
npm ci --legacy-peer-deps

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Ensuring demo store exists (idempotent, skips if already synced)"
npm run seed || echo "Seed step failed or skipped — continuing."

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart resin

echo "==> Done. Tail logs with: sudo journalctl -u resin -f"
