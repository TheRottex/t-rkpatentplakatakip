#!/usr/bin/env bash
cd /workspaces/tpplakatakip || exit 1
source /usr/local/share/nvm/nvm.sh 2>/dev/null || source ~/.nvm/nvm.sh
nvm install 18.20 >/dev/null && nvm use 18.20
[ -d node_modules ] || npm ci
grep -q 'node:crypto' server/db.js || sed -i '1i import crypto from "node:crypto";' server/db.js
mkdir -p data
[ -f data/plates.csv ] || printf 'plaka;blok;daire\n06ABC06;C15;3\n34XYZ34;A2;12\n' > data/plates.csv
[ -f .env ] || cp .env.example .env
URL="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
sed -i '/^\(CORS_ORIGINS\|PUBLIC_BASE_URL\|DATA_DIR\|SEED_CSV\|VORTEX_SERVER_URL\)=/d' .env
printf '%s\n' "CORS_ORIGINS=$URL,http://localhost:5173" "PUBLIC_BASE_URL=$URL" "DATA_DIR=./data" "SEED_CSV=./data/plates.csv" "VORTEX_SERVER_URL=" >> .env
grep -qE '^JWT_SECRET=[0-9a-f]{64}$' .env || { sed -i '/^JWT_SECRET=/d' .env; echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env; }
echo "Hazir. Adres: $URL"
