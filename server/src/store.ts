import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Persistent player profiles and the global leaderboard.
 *
 * Uses node's built-in SQLite (no dependency, no native build). A leaderboard
 * that resets whenever the server restarts would be worthless, so unlike
 * lobbies — which are deliberately in-memory and disposable — this is on disk.
 *
 * Identity is a client-generated id the app stores on the device. That's the
 * right shape for "your name sticks until you delete the app", but note it is
 * **self-asserted**: nothing stops a modified client claiming another id or
 * inflating its own results. Fine for a party game among friends; if the
 * leaderboard ever becomes worth cheating for, this needs real accounts.
 */

export type Profile = {
  id: string;
  nickname: string;
  trophies: number;
  games: number;
  wins: number;
  bestScore: number;
};

export type LeaderboardRow = Profile & { rank: number };

let db: DatabaseSync;

export function openStore(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      nickname    TEXT    NOT NULL,
      trophies    INTEGER NOT NULL DEFAULT 0,
      games       INTEGER NOT NULL DEFAULT 0,
      wins        INTEGER NOT NULL DEFAULT 0,
      best_score  INTEGER NOT NULL DEFAULT 0,
      created_ms  INTEGER NOT NULL,
      seen_ms     INTEGER NOT NULL
    )
  `);
  // Ties break toward whoever got there first, so the order is stable rather
  // than shuffling every time two players are level.
  db.exec("CREATE INDEX IF NOT EXISTS idx_players_rank ON players(trophies DESC, created_ms ASC)");
}

type Row = {
  id: string;
  nickname: string;
  trophies: number;
  games: number;
  wins: number;
  best_score: number;
};

function toProfile(row: Row): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    trophies: row.trophies,
    games: row.games,
    wins: row.wins,
    bestScore: row.best_score,
  };
}

/** Creates the profile on first sight, otherwise just refreshes the name and
 *  last-seen stamp. Never resets progress — the whole point is that it
 *  survives. */
export function upsertPlayer(id: string, nickname: string): Profile {
  const now = Date.now();
  db.prepare(
    `INSERT INTO players (id, nickname, created_ms, seen_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, seen_ms = excluded.seen_ms`,
  ).run(id, nickname, now, now);
  return getProfile(id)!;
}

export function getProfile(id: string): Profile | null {
  const row = db.prepare("SELECT * FROM players WHERE id = ?").get(id) as Row | undefined;
  return row ? toProfile(row) : null;
}

/** Records the outcome of one ranked game. Trophies only ever accumulate —
 *  losing never costs you any, which keeps the leaderboard something you
 *  climb by playing rather than a rating you can fall off. */
export function recordRankedResult(
  id: string,
  result: { trophies: number; won: boolean; score: number },
): Profile | null {
  if (!getProfile(id)) return null;
  db.prepare(
    `UPDATE players
        SET trophies   = trophies + ?,
            games      = games + 1,
            wins       = wins + ?,
            best_score = MAX(best_score, ?),
            seen_ms    = ?
      WHERE id = ?`,
  ).run(Math.max(0, Math.round(result.trophies)), result.won ? 1 : 0, result.score, Date.now(), id);
  return getProfile(id);
}

export function leaderboard(limit = 50): LeaderboardRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM players
        WHERE games > 0
        ORDER BY trophies DESC, created_ms ASC
        LIMIT ?`,
    )
    .all(limit) as Row[];
  return rows.map((row, i) => ({ ...toProfile(row), rank: i + 1 }));
}

/** Where this player sits globally. Null until they've finished a ranked game,
 *  matching the leaderboard's own `games > 0` filter. */
export function rankOf(id: string): number | null {
  const profile = getProfile(id);
  if (!profile || profile.games === 0) return null;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM players
        WHERE games > 0
          AND (trophies > ? OR (trophies = ? AND created_ms < (SELECT created_ms FROM players WHERE id = ?)))`,
    )
    .get(profile.trophies, profile.trophies, id) as { ahead: number };
  return row.ahead + 1;
}

export function closeStore(): void {
  db?.close();
}
