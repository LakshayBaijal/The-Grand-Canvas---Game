#!/bin/bash
# Prints the most recent player reports about drawings, newest first, so a
# human can look. Nothing is removed automatically, ever; this is the list.
# Run on the server:  ~/grandcanvas/deploy/reports.sh [how-many]
set -euo pipefail
DB="$(grep '^DB_PATH=' "$(dirname "$0")/../.env" | cut -d= -f2-)"
node -e '
  const { DatabaseSync } = require("node:sqlite");
  const [src, n] = process.argv.slice(1);
  const db = new DatabaseSync(src, { readOnly: true });
  const rows = db.prepare(`
    SELECT r.id, r.created_ms, r.reason, r.title, r.entry_id,
           COALESCE(a.nickname, r.artist_id) AS artist,
           COALESCE(p.nickname, r.reporter_id) AS reporter
      FROM reports r
      LEFT JOIN players a ON a.id = r.artist_id
      LEFT JOIN players p ON p.id = r.reporter_id
     ORDER BY r.id DESC LIMIT ?`).all(Number(n));
  if (rows.length === 0) { console.log("No reports."); process.exit(0); }
  for (const r of rows) {
    const when = new Date(r.created_ms).toISOString().slice(0, 16).replace("T", " ");
    console.log(`#${r.id}  ${when}  "${r.title}" by ${r.artist}  <- ${r.reporter}: ${r.reason}${r.entry_id ? "  (entry " + r.entry_id + ")" : ""}`);
  }
  db.close();
' "$DB" "${1:-50}"
