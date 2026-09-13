#!/bin/bash
# Starts the Grand Canvas game server and prints the address your phone
# should connect to. Run this whenever you want to host a game — no need to
# rebuild or reinstall the app; it only needs to be done once.
set -e
cd "$(dirname "$0")/server"

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<no wifi found>")

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
