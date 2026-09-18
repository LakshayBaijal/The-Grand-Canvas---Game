#!/bin/bash
# Copies the database to ~/backups with today's date and drops copies older
# than 14 days. Runs nightly from cron (set up by setup-vm.sh); safe to run
# by hand any time. SQLite's own VACUUM INTO is used so a copy taken while
# the game is running is still consistent.
set -euo pipefail
DB="$(grep '^DB_PATH=' "$(dirname "$0")/../.env" | cut -d= -f2-)"
OUT="$HOME/backups/leaderboard-$(date +%F).db"
node -e "
  const { DatabaseSync } = require('node:sqlite');
  const [src, dst] = process.argv.slice(1);
  const db = new DatabaseSync(src, { readOnly: true });
  db.exec('VACUUM INTO ' + JSON.stringify(dst));
  db.close();
" "$DB" "$OUT"
find "$HOME/backups" -name 'leaderboard-*.db' -mtime +14 -delete
echo "backed up to $OUT"
