import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

import type { Stroke } from "./types.js";

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
 * Identity comes in two grades. The default is a client-generated id the app
 * stores on the device: right for "your name sticks until you delete the app",
 * but **self-asserted** — nothing stops a modified client claiming another id.
 * Linking a Google account upgrades that, because the server verifies the
 * token's signature rather than taking the client's word (see verifyGoogle in
 * google.ts). A linked profile also survives losing the phone, which the
 * device id never could.
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
  /** Whether a Google account owns this profile. The `sub` itself never
   *  leaves the server — the client only needs to know if it is linked. */
  linked: boolean;
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

  // The Google account this profile belongs to, if it has been linked. Google
  // calls it `sub`; it is stable for a given user and app, and is the only
  // part of the token worth storing — we deliberately keep no email or name.
  addColumn("players", "google_sub", "TEXT");
  // Partial index: unlinked profiles all have NULL here, and NULLs would
  // otherwise collide under a plain unique index on some engines.
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_players_google " +
      "ON players(google_sub) WHERE google_sub IS NOT NULL",
  );

  // Finished drawings. See "the drawing archive" below for why these are kept
  // as strokes rather than images, and why bots never land here.
  db.exec(`
    CREATE TABLE IF NOT EXISTS drawings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_ms  INTEGER NOT NULL,
      player_id   TEXT    NOT NULL,
      prompt      TEXT    NOT NULL,
      answer      TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      paper       TEXT,
      raised      INTEGER NOT NULL DEFAULT 0,
      strokes     BLOB    NOT NULL
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_drawings_created ON drawings(created_ms)");

  // The daily gallery. One row per player per day; drawing again replaces it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      day         INTEGER NOT NULL,
      player_id   TEXT    NOT NULL,
      nickname    TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      paper       TEXT,
      strokes     BLOB    NOT NULL,
      created_ms  INTEGER NOT NULL,
      UNIQUE(day, player_id)
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_daily_day ON daily_entries(day, id DESC)");

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
  google_sub: string | null;
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
    linked: row.google_sub !== null,
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
/** The profile a Google account owns, if any. */
export function getProfileByGoogle(sub: string): Profile | null {
  const row = db.prepare("SELECT * FROM players WHERE google_sub = ?").get(sub) as
    | Row
    | undefined;
  return row ? toProfile(rollSeason(row)) : null;
}

/**
 * Attaches a Google account to a profile, absorbing a device-only profile into
 * it when both exist.
 *
 * The three cases, and why each behaves as it does:
 *
 *  1. **Nothing linked yet.** The device profile becomes the account. Nothing
 *     moves; the player just gained a way back in after losing the phone.
 *  2. **Already linked to this same profile.** A no-op, so signing in twice is
 *     harmless.
 *  3. **The account already owns a different profile.** That one wins — it is
 *     the record that exists on every other device, and silently preferring
 *     whatever this phone happened to have would lose it. Career totals from
 *     the device profile are folded in so a few games played before signing in
 *     are not thrown away, but **rating is not**: rating is a measure of
 *     current skill, not a pile to be added to, and summing two of them would
 *     hand out free ladder position for reinstalling.
 *
 * Returns the profile the caller should use from now on. The device profile in
 * case 3 is deleted, so it can never be resurrected by an unlinked client and
 * merged a second time.
 */
export function linkGoogle(deviceId: string, sub: string): Profile {
  const existing = getProfileByGoogle(sub);

  if (!existing) {
    db.prepare("UPDATE players SET google_sub = ? WHERE id = ?").run(sub, deviceId);
    return getProfile(deviceId)!;
  }
  if (existing.id === deviceId) return existing;

  const device = getProfile(deviceId);
  if (device) {
    db.prepare(
      `UPDATE players
         SET trophies   = trophies + ?,
             games      = games + ?,
             wins       = wins + ?,
             best_score = MAX(best_score, ?)
       WHERE id = ?`,
    ).run(device.trophies, device.games, device.wins, device.bestScore, existing.id);
    db.prepare("DELETE FROM players WHERE id = ?").run(deviceId);
  }
  return getProfile(existing.id)!;
}

/** Detaches the account, leaving the profile in place as a device-only one. */
export function unlinkGoogle(id: string): Profile | null {
  db.prepare("UPDATE players SET google_sub = NULL WHERE id = ?").run(id);
  return getProfile(id);
}

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

// --- the drawing archive ---------------------------------------------------

/**
 * Every human drawing, kept.
 *
 * A finished drawing is currently shown for a few seconds and then dropped on
 * the floor. Keeping it costs very little and is worth a lot: it is a labelled
 * pair — a sentence somebody wrote, and the picture somebody else drew for it —
 * which is exactly the shape a training set wants, and it is also what any
 * future gallery or share feature would be built on.
 *
 * Two decisions worth knowing about:
 *
 *  * **Strokes, not images.** A drawing is vector data. Compressed it is ~3KB,
 *    where a 1000px PNG of the same thing is ~60KB, and the strokes re-render
 *    at any size, on any paper, and can be replayed being drawn. Rasterising
 *    here would cost twenty times the disk to store strictly less.
 *
 *  * **Humans only.** Bot drawings are generated from `doodle/compose.ts`, so
 *    archiving them would mean training on our own output. They are also the
 *    majority of drawings in a lobby padded with bots, which would make the
 *    set mostly synthetic without anyone noticing.
 */

/** How long a drawing is kept. Age is the honest axis — a two-year-old doodle
 *  is not more useful than a recent one, and unbounded growth on a small disk
 *  is how a server falls over quietly at 3am. */
const RETENTION_DAYS = Number(process.env.DRAWING_RETENTION_DAYS ?? 180);

/** A second ceiling, for when a burst of traffic fills the disk faster than
 *  age alone would clear it. Whichever limit bites first wins. At ~3KB a row
 *  this default is well under a gigabyte. */
const DEFAULT_MAX_ROWS = Number(process.env.DRAWING_MAX_ROWS ?? 250_000);

export type ArchivedDrawing = {
  playerId: string;
  /** The finished sentence, as everyone in the lobby saw it. */
  prompt: string;
  /** Just the words the writer typed into the blank — the part anyone chose,
   *  and the strongest single label for what the picture should show. */
  answer: string;
  /** What the artist named their own drawing. */
  title: string;
  paper?: string;
  /** What it raised. Not needed to render anything — it is here because it is
   *  a free quality signal: other players judged this drawing, and a set can
   *  be filtered on that later without having to re-run the judging. */
  raised: number;
  strokes: Stroke[];
};

/** Rows come back with the strokes already decompressed and parsed. */
export type StoredDrawing = ArchivedDrawing & { id: number; createdMs: number };

export function archiveDrawings(entries: readonly ArchivedDrawing[]): void {
  if (entries.length === 0) return;
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO drawings
       (created_ms, player_id, prompt, answer, title, paper, raised, strokes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of entries) {
    // Brotli rather than gzip: measured about 30% smaller again on stroke
    // JSON, and this is written once and read rarely, so the slower compress
    // costs nothing that matters.
    const blob = brotliCompressSync(Buffer.from(JSON.stringify(e.strokes)), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
    });
    insert.run(
      now,
      e.playerId,
      e.prompt,
      e.answer,
      e.title,
      e.paper ?? null,
      Math.round(e.raised),
      blob,
    );
  }
}

/** Drops anything past either limit. Safe to call whenever; it is cheap when
 *  there is nothing to do, because both conditions are indexed.
 *
 *  Both limits can be overridden per call, which is what lets a one-off
 *  reclaim run trim harder than the standing policy without a redeploy. */
export function pruneDrawings(
  opts: { maxAgeMs?: number; maxRows?: number } = {},
): { byAge: number; byCount: number } {
  const maxAgeMs = opts.maxAgeMs ?? RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const MAX_ROWS = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const cutoff = Date.now() - maxAgeMs;
  const byAge = db.prepare("DELETE FROM drawings WHERE created_ms < ?").run(cutoff);
  // Keep the newest MAX_ROWS. `id` is monotonic, so "oldest" needs no date
  // comparison — anything below the id at the cutoff position goes.
  const byCount = db
    .prepare(
      `DELETE FROM drawings WHERE id < (
         SELECT MIN(id) FROM (SELECT id FROM drawings ORDER BY id DESC LIMIT ?)
       )`,
    )
    .run(MAX_ROWS);
  return {
    byAge: Number(byAge.changes ?? 0),
    byCount: Number(byCount.changes ?? 0),
  };
}

/**
 * Reads drawings back out, oldest first, for export.
 *
 * Paged by id rather than by offset so an export can be resumed, and so it
 * stays correct while rows are being added underneath it.
 */
export function readDrawings(afterId = 0, limit = 500): StoredDrawing[] {
  const rows = db
    .prepare(
      `SELECT id, created_ms, player_id, prompt, answer, title, paper, raised, strokes
         FROM drawings WHERE id > ? ORDER BY id ASC LIMIT ?`,
    )
    .all(afterId, limit) as DrawingRow[];
  return rows.map((r) => ({
    id: Number(r.id),
    createdMs: Number(r.created_ms),
    playerId: r.player_id,
    prompt: r.prompt,
    answer: r.answer,
    title: r.title,
    paper: r.paper ?? undefined,
    raised: Number(r.raised),
    strokes: JSON.parse(brotliDecompressSync(Buffer.from(r.strokes)).toString("utf8")) as Stroke[],
  }));
}

export function countDrawings(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM drawings").get() as { n: number };
  return Number(row.n);
}

/** Total size of the stored stroke blobs. What to watch if you want to know
 *  whether the retention settings are holding. */
export function archiveBytes(): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(LENGTH(strokes)), 0) AS bytes FROM drawings")
    .get() as { bytes: number };
  return Number(row.bytes);
}

type DrawingRow = {
  id: number;
  created_ms: number;
  player_id: string;
  prompt: string;
  answer: string;
  title: string;
  paper: string | null;
  raised: number;
  strokes: Uint8Array;
};

// --- the daily gallery -----------------------------------------------------
// One drawing per player per day, viewable by everyone who also drew that day.
// Kept apart from `drawings` above because the two have different lives: the
// archive is a long-term training set nobody looks at, this is a gallery that
// is looked at constantly for a few days and then never again.

/** How long a day's gallery stays browsable. */
const DAILY_RETENTION_DAYS = Number(process.env.DAILY_RETENTION_DAYS ?? 30);

export type DailySubmission = {
  day: number;
  playerId: string;
  nickname: string;
  title: string;
  paper?: string;
  strokes: Stroke[];
};

export type DailyEntry = {
  id: number;
  day: number;
  artistId: string;
  artistName: string;
  title: string;
  paper?: string;
  strokes: Stroke[];
  createdMs: number;
};

/** Records today's drawing. Drawing again the same day replaces the earlier
 *  one — the day is the unit, not the attempt. */
export function submitDaily(s: DailySubmission): void {
  const blob = brotliCompressSync(Buffer.from(JSON.stringify(s.strokes)), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
  });
  db.prepare(
    `INSERT INTO daily_entries (day, player_id, nickname, title, paper, strokes, created_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day, player_id) DO UPDATE SET
       nickname = excluded.nickname,
       title = excluded.title,
       paper = excluded.paper,
       strokes = excluded.strokes,
       created_ms = excluded.created_ms`,
  ).run(s.day, s.playerId, s.nickname, s.title, s.paper ?? null, blob, Date.now());
}

export function hasSubmittedDaily(day: number, playerId: string): boolean {
  const row = db
    .prepare("SELECT 1 AS yes FROM daily_entries WHERE day = ? AND player_id = ?")
    .get(day, playerId);
  return row !== undefined;
}

export function myDailyEntry(day: number, playerId: string): DailyEntry | null {
  const row = db
    .prepare(`${DAILY_SELECT} WHERE day = ? AND player_id = ?`)
    .get(day, playerId) as DailyRow | undefined;
  return row ? toDailyEntry(row) : null;
}

export function countDaily(day: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM daily_entries WHERE day = ?")
    .get(day) as { n: number };
  return Number(row.n);
}

/** A page of the day's gallery, newest first. Paged by id so scrolling stays
 *  stable while new entries arrive above. */
export function dailyGallery(
  day: number,
  beforeId: number | null,
  limit: number,
): { entries: DailyEntry[]; hasMore: boolean } {
  const rows = (
    beforeId === null
      ? db.prepare(`${DAILY_SELECT} WHERE day = ? ORDER BY id DESC LIMIT ?`).all(day, limit + 1)
      : db
          .prepare(`${DAILY_SELECT} WHERE day = ? AND id < ? ORDER BY id DESC LIMIT ?`)
          .all(day, beforeId, limit + 1)
  ) as DailyRow[];
  const hasMore = rows.length > limit;
  return { entries: rows.slice(0, limit).map(toDailyEntry), hasMore };
}

export function pruneDaily(opts: { maxAgeDays?: number } = {}): number {
  const days = opts.maxAgeDays ?? DAILY_RETENTION_DAYS;
  const cutoffDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) - days;
  const result = db.prepare("DELETE FROM daily_entries WHERE day < ?").run(cutoffDay);
  return Number(result.changes ?? 0);
}

const DAILY_SELECT =
  "SELECT id, day, player_id, nickname, title, paper, strokes, created_ms FROM daily_entries";

type DailyRow = {
  id: number;
  day: number;
  player_id: string;
  nickname: string;
  title: string;
  paper: string | null;
  strokes: Uint8Array;
  created_ms: number;
};

function toDailyEntry(r: DailyRow): DailyEntry {
  return {
    id: Number(r.id),
    day: Number(r.day),
    artistId: r.player_id,
    artistName: r.nickname,
    title: r.title,
    paper: r.paper ?? undefined,
    strokes: JSON.parse(brotliDecompressSync(Buffer.from(r.strokes)).toString("utf8")) as Stroke[],
    createdMs: Number(r.created_ms),
  };
}
