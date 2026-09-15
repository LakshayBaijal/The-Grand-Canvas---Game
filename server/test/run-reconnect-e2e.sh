#!/bin/bash
# Starts a throwaway server on a spare port with a scratch database, runs
# the reconnect end-to-end test against it, and stops it again.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=8099
DB="$(mktemp -d)/e2e.db"
PORT=$PORT DB_PATH="$DB" npx tsx src/index.ts >/tmp/reconnect-e2e-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 40); do
  if grep -q "listening" /tmp/reconnect-e2e-server.log 2>/dev/null; then break; fi
  sleep 0.25
done
node test/reconnect.e2e.mjs $PORT
