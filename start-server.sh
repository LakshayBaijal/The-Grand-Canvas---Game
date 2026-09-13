#!/bin/bash
# Starts the Grand Canvas game server and prints the address your phone
# should connect to. Run this whenever you want to host a game — no need to
# rebuild or reinstall the app; it only needs to be done once.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/server"

# This server needs Node 22.5+ (it uses the built-in node:sqlite module).
# On Lakshay's Windows machine the modern Node lives in D:/dev/node24 and
# isn't on PATH, so prefer it when it's there; then refuse to start on an
# old Node with a message that says what to do, instead of a stack trace.
for candidate in /d/dev/node24 "$HOME/.nvm/versions/node/"*/bin; do
  if [ -x "$candidate/node" ] || [ -x "$candidate/node.exe" ]; then
    export PATH="$candidate:$PATH"
    break
  fi
done
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/^v//; s/\..*//')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  echo ""
  echo "ERROR: this server needs Node 22.5 or newer; found: $(node --version 2>/dev/null || echo none)."
  echo "On Windows, run start-server.bat instead, or install Node 24 to D:\dev\node24."
  echo ""
  exit 1
fi

if command -v powershell.exe >/dev/null 2>&1; then
  IP=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ROOT/get-lan-ip.ps1" 2>/dev/null | tr -d '')
else
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d" " -f1)
fi
[ -n "$IP" ] || IP="<no wifi found>"

echo ""
echo "=================================================="
echo " Grand Canvas server starting..."
echo ""
echo " On your phone (same Wi-Fi), open the app, tap"
echo " 'Server settings', and enter:"
echo ""
echo "     ${IP}:8090"
echo ""
echo " It's remembered after the first successful connect"
echo " — you only need to retype it when your Wi-Fi changes."
echo "=================================================="
echo ""

npm run dev
