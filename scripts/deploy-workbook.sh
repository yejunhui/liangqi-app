#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Deploy the static Liangqi build to /workbook on a remote nginx host.
#
# Required:
#   DEPLOY_HOST=arksc.cn
# Optional:
#   DEPLOY_USER=root
#   DEPLOY_PATH=/var/www/workbook
#
# SSH must already be authorized (key or ssh-agent). The remote nginx config
# should contain the /workbook location documented in README.md.
set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST to the nginx server}"
USER="${DEPLOY_USER:-root}"
REMOTE_PATH="${DEPLOY_PATH:-/var/www/workbook}"

pnpm build:workbook

tar -C dist -czf - . | ssh "${USER}@${HOST}" \
  "mkdir -p '${REMOTE_PATH}' && find '${REMOTE_PATH}' -mindepth 1 -delete && tar -xzf - -C '${REMOTE_PATH}'"

ssh "${USER}@${HOST}" "nginx -t && systemctl reload nginx"
echo "Deployed to ${USER}@${HOST}:${REMOTE_PATH}"
