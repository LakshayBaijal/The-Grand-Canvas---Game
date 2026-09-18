#!/bin/bash
# Pulls the latest code from GitHub, rebuilds, and restarts the server.
# Run on the VM:  ~/grandcanvas/deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm ci --no-audit --no-fund >/dev/null
npm run build >/dev/null
# One socket per player, and the default cap is 1024 open files. Raised by
# a drop-in so it survives a re-run of setup-vm.sh, applied every deploy so
# an old VM picks it up too.
if [ ! -f /etc/systemd/system/grandcanvas.service.d/limits.conf ]; then
  sudo mkdir -p /etc/systemd/system/grandcanvas.service.d
  printf '[Service]\nLimitNOFILE=65536\n' | sudo tee /etc/systemd/system/grandcanvas.service.d/limits.conf >/dev/null
  sudo systemctl daemon-reload
fi
sudo systemctl restart grandcanvas
sleep 2
sudo systemctl --no-pager --lines=5 status grandcanvas
