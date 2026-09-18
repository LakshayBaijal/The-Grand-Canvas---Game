#!/bin/bash
# One-time setup of a fresh Ubuntu server (a DigitalOcean droplet, a Vultr
# instance, any Ubuntu 24.04 box) as the Grand Canvas server. Run it ON the
# server after you've SSH'd in, as whichever user the provider gives you
# (root on DigitalOcean, ubuntu on Oracle/AWS; both work):
#
#   curl -fsSL https://raw.githubusercontent.com/LakshayBaijal/The-Grand-Canvas---Game/main/deploy/setup-vm.sh | bash -s -- grandcanvas.duckdns.org
#
# The one argument is the domain name that points at this server. When it's done:
#   * the server runs as a system service (restarts on crash and on reboot)
#   * Caddy answers https://<domain> and wss://<domain> with a free certificate
#     and hands everything to the game server
#   * the database is backed up every night to ~/backups
#
# Safe to run again: it updates the code and restarts.
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "usage: setup-vm.sh <domain>     e.g. setup-vm.sh grandcanvas.duckdns.org"
  exit 1
fi

REPO_URL="https://github.com/LakshayBaijal/The-Grand-Canvas---Game.git"
APP_DIR="$HOME/grandcanvas"
DB_DIR="$HOME/data"

echo "==> Packages (Node 24, Caddy, git)"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl cron ca-certificates debian-keyring debian-archive-keyring apt-transport-https >/dev/null
sudo systemctl enable --now cron >/dev/null 2>&1 || true
if ! command -v node >/dev/null 2>&1 || [ "$(node --version | sed 's/^v//; s/\..*//')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy >/dev/null
fi
echo "    node $(node --version), caddy $(caddy version | cut -d' ' -f1)"

echo "==> Firewall: make sure web traffic can get in (some images block it by default)"
# Only relevant on providers whose *host* firewall defaults to closed
# (Oracle's images do). Google Cloud and most others filter at the network
# edge instead -- the console checkboxes for HTTP/HTTPS traffic already
# cover it, there's no local firewall blocking anything, and several
# current cloud images don't even ship iptables. So: only touch it if it's
# actually there.
if command -v iptables >/dev/null 2>&1; then
  sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
  sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
  sudo netfilter-persistent save >/dev/null 2>&1 || true
else
  echo "    no local iptables here -- assuming the cloud provider's own firewall handles it (Google Cloud does)"
fi

echo "==> Code"
if [ -d "$APP_DIR/.git" ]; then
  # Nothing in the checkout is edited by hand (.env is untracked), so any
  # local change is noise -- the chmod below, mostly -- and gets dropped.
  git -C "$APP_DIR" checkout -- .
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
git -C "$APP_DIR" config core.fileMode false
mkdir -p "$DB_DIR" "$HOME/backups"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  sed -i "s|^DB_PATH=.*|DB_PATH=$DB_DIR/leaderboard.db|" "$APP_DIR/.env"
  echo "    wrote $APP_DIR/.env  (put your GOOGLE_CLIENT_ID in it later, then: sudo systemctl restart grandcanvas)"
fi
cd "$APP_DIR/server"
npm ci --no-audit --no-fund >/dev/null
npm run build >/dev/null

echo "==> Service"
sudo tee /etc/systemd/system/grandcanvas.service >/dev/null <<UNIT
[Unit]
Description=Grand Canvas game server
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) dist/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable grandcanvas >/dev/null
sudo systemctl restart grandcanvas

echo "==> Caddy (https + wss on $DOMAIN)"
sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
$DOMAIN {
    reverse_proxy localhost:8090
}
CADDY
sudo systemctl enable caddy >/dev/null
sudo systemctl restart caddy

echo "==> Nightly database backup (3 am, keeps 14 days)"
chmod +x "$APP_DIR/deploy/"*.sh
( crontab -l 2>/dev/null | grep -v grandcanvas-backup || true; echo "0 3 * * * $APP_DIR/deploy/backup.sh # grandcanvas-backup" ) | crontab -

echo ""
echo "================================================================"
echo " Done. In about a minute, https://$DOMAIN should answer, and the"
echo " app built with SERVER=$DOMAIN will connect over wss://."
echo ""
echo "   status:   sudo systemctl status grandcanvas"
echo "   logs:     journalctl -u grandcanvas -f"
echo "   update:   ~/grandcanvas/deploy/update.sh"
echo "================================================================"
