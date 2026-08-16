import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  applyFloor,
  floorForLeague,
  leagueFor,
  PLACEMENT_GAMES,
  seasonAt,
  softReset,
  START_RATING,
} from "./ranking.js";

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
  /** Career total. Never goes down — see recordRankedResult. */
  trophies: number;
  games: number;
  wins: number;
  bestScore: number;
  /** Current skill rating. This is what the leaderboard sorts by. */
  rating: number;
  /** Best league reached this season; the rating can't fall below its floor. */
  bestLeague: string | null;
  /** Season this rating belongs to. A stale one is soft-reset on next sight. */
  season: number;
  /** Ranked games finished this season, for placement weighting. */
  seasonGames: number;
};

export type LeaderboardRow = Profile & { rank: number };

let db: DatabaseSync;

/** Adds a column if the table predates it. Existing installs carry real
 *  profiles and trophies, so the schema moves forward in place rather than
 *  being dropped and recreated. */
function addColumn(table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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

  // Ladder columns, added in place so an existing leaderboard survives the
  // upgrade. Everyone starts at the same rating regardless of trophies already
  // banked — trophies measured time played, so importing them as skill would
  // seed the new ladder with exactly the bias it exists to remove.
  addColumn("players", "rating", `INTEGER NOT NULL DEFAULT ${START_RATING}`);
  addColumn("players", "best_league", "TEXT");
  addColumn("players", "season", "INTEGER NOT NULL DEFAULT 0");
  addColumn("players", "season_games", "INTEGER NOT NULL DEFAULT 0");

  db.exec("DROP INDEX IF EXISTS idx_players_rank");
  db.exec("CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC, created_ms ASC)");
}

type Row = {
  id: string;
  nickname: string;
  trophies: number;
  games: number;
  wins: number;
  best_score: number;
  rating: number;
  best_league: string | null;
  season: number;
  season_games: number;
};

function toProfile(row: Row): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    trophies: row.trophies,
    games: row.games,
    wins: row.wins,
    bestScore: row.best_score,
    rating: row.rating,
    bestLeague: row.best_league,
    season: row.season,
    seasonGames: row.season_games,
  };
}

/**
 * Rolls a profile into the current season if it's behind.
 *
 * Done lazily on read rather than by a scheduled job: there's no scheduler on
 * this server, and a player whose rating is never read doesn't need resetting
 * yet. The first touch after a rollover does it.
 */
function rollSeason(row: Row): Row {
  const now = seasonAt();
  if (row.season === now) return row;
  const rating = row.season === 0 && row.season_games === 0 ? row.rating : softReset(row.rating);
  db.prepare(
    `UPDATE players SET rating = ?, best_league = NULL, season = ?, season_games = 0 WHERE id = ?`,
  ).run(rating, now, row.id);
  return { ...row, rating, best_league: null, season: now, season_games: 0 };
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
  return row ? toProfile(rollSeason(row)) : null;
}

/**
 * Records the outcome of one ranked game.
 *
 * Two numbers move, and they mean different things on purpose:
 *   - **trophies** accumulate and are never taken away. A career total.
 *   - **rating** moves both ways, floored at the best league reached this
 *     season, so a promotion already earned survives a bad run.
 */
export function recordRankedResult(
  id: string,
  result: { trophies: number; won: boolean; score: number; rating: number },
): Profile | null {
  const current = getProfile(id);
  if (!current) return null;

  // The floor is read from the league held *before* this game as well as the
  // one implied by the new rating, so a win that promotes you sets the new
  // floor immediately.
  const floored = applyFloor(result.rating, current.bestLeague);
  const reached = leagueFor(Math.max(floored, current.rating));
  const bestLeague = floorForLeague(reached.id) >= floorForLeague(current.bestLeague)
    ? reached.id
    : current.bestLeague;
  const settled = applyFloor(floored, bestLeague);

  db.prepare(
    `UPDATE players
        SET trophies     = trophies + ?,
            games        = games + 1,
            wins         = wins + ?,
            best_score   = MAX(best_score, ?),
            rating       = ?,
            best_league  = ?,
            season       = ?,
            season_games = season_games + 1,
            seen_ms      = ?
      WHERE id = ?`,
  ).run(
    Math.max(0, Math.round(result.trophies)),
    result.won ? 1 : 0,
    result.score,
    settled,
    bestLeague,
    seasonAt(),
    Date.now(),
    id,
  );
  return getProfile(id);
}

/** Players below this many ranked games this season are still placing, and are
 *  held off the public board so it isn't full of provisional ratings. */
const LEADERBOARD_MIN_GAMES = PLACEMENT_GAMES;

export function leaderboard(limit = 50): LeaderboardRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM players
        WHERE season = ? AND season_games >= ?
        ORDER BY rating DESC, created_ms ASC
        LIMIT ?`,
    )
    .all(seasonAt(), LEADERBOARD_MIN_GAMES, limit) as Row[];
  return rows.map((row, i) => ({ ...toProfile(row), rank: i + 1 }));
}

/** Where this player sits globally, or null while still placing. */
export function rankOf(id: string): number | null {
  const profile = getProfile(id);
  if (!profile || profile.seasonGames < LEADERBOARD_MIN_GAMES) return null;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM players
        WHERE season = ? AND season_games >= ?
          AND (rating > ? OR (rating = ? AND created_ms < (SELECT created_ms FROM players WHERE id = ?)))`,
    )
    .get(seasonAt(), LEADERBOARD_MIN_GAMES, profile.rating, profile.rating, id) as { ahead: number };
  return row.ahead + 1;
}

export function closeStore(): void {
  db?.close();
}
