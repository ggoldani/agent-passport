#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/srv/agent-passport"
NGINX_SRC="$ROOT_DIR/deploy/nginx/agent-passport.conf"
API_SRC="$ROOT_DIR/deploy/systemd/agent-passport-api.service"
WEB_SRC="$ROOT_DIR/deploy/systemd/agent-passport-web.service"
INDEXER_SRC="$ROOT_DIR/deploy/systemd/agent-passport-indexer.service"

install -Dm644 "$NGINX_SRC" /etc/nginx/sites-available/agent-passport
ln -sfn /etc/nginx/sites-available/agent-passport /etc/nginx/sites-enabled/agent-passport
rm -f /etc/nginx/sites-enabled/default

install -Dm644 "$API_SRC" /etc/systemd/system/agent-passport-api.service
install -Dm644 "$WEB_SRC" /etc/systemd/system/agent-passport-web.service
install -Dm644 "$INDEXER_SRC" /etc/systemd/system/agent-passport-indexer.service

systemctl daemon-reload
systemctl enable --now agent-passport-api agent-passport-web agent-passport-indexer
nginx -t
systemctl reload nginx

echo "Installed and reloaded successfully."
