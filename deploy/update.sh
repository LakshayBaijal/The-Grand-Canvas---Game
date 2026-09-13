#!/bin/bash
# Pulls the latest code from GitHub, rebuilds, and restarts the server.
# Run on the VM:  ~/grandcanvas/deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm ci --no-audit --no-fund >/dev/null
npm run build >/dev/null
sudo systemctl restart grandcanvas
sleep 2
sudo systemctl --no-pager --lines=5 status grandcanvas
