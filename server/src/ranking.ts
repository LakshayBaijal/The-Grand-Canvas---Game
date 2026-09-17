/**
 * The competitive ladder: rating, leagues and seasons.
 *
 * ## Why this replaced pure trophy accumulation
 *
 * Trophies only ever went up, and even last place paid out. That makes a
 * perfectly good *career* counter and a bad *leaderboard*: it ranks time
 * played, not skill. Someone winning 90% of 50 games sat below someone
 * winning 10% of 500, and the top of the board just meant "played the most".
 *
 * But the opposite extreme is wrong for this game too. Placement here is
 * decided by other players voting on drawings — it is genuinely high variance,
 * and a prompt that doesn't suit you is nobody's fault. A ladder where every
 * loss bites hard would punish people for luck and make a party game stressful.
 *
 * So there are three separate numbers, each doing one job, and they no longer
 * fight each other:
 *
 *   - **rating**   — skill. Moves both ways. What the leaderboard sorts by.
 *   - **league**   — identity. Derived from rating, and *floored*: once you
 *                    reach a tier this season you cannot fall out of it.
 *   - **trophies** — career. Never lost, exactly as before. Yours forever.
 *
 * The floor is what makes this safe to play on. Within your tier the rating
 * moves freely, so the top of the board stays honest — but a bad night can't
 * undo a promotion you already earned.
 */

/** Where everyone starts. Mid-Doodler, so the first few games can move you in
 *  either direction rather than only up from zero. */
export const START_RATING = 1000;

/**
 * Rating bands, lowest first. `floor` is both the promotion threshold and the
 * protection line — reach it once in a season and you keep it.
 *
 * Named for how the drawing looks rather than for metals, because "Silver III"
 * says nothing about this game.
 */
export const LEAGUES = [
  { id: "scribbles", name: "Scribbles", floor: 0 },
  { id: "doodler", name: "Doodler", floor: 950 },
  { id: "sketcher", name: "Sketcher", floor: 1100 },
  { id: "illustrator", name: "Illustrator", floor: 1250 },
  { id: "curator", name: "Curator", floor: 1400 },
  { id: "master", name: "Old Master", floor: 1550 },
  { id: "grand", name: "Grand Canvas", floor: 1700 },
] as const;

export type LeagueId = (typeof LEAGUES)[number]["id"];

export type League = {
  id: LeagueId;
  name: string;
  floor: number;
  /** Rating at which the next league starts, or null at the top. */
  next: number | null;
  /** 0..1 through the current band. 1 when there's nothing above. */
  progress: number;
};

export function leagueFor(rating: number): League {
  let index = 0;
  for (let i = 0; i < LEAGUES.length; i++) {
    if (rating >= LEAGUES[i].floor) index = i;
  }
  const band = LEAGUES[index];
  const above = LEAGUES[index + 1] ?? null;
  const next = above ? above.floor : null;
  const progress = next === null
    ? 1
    : Math.min(1, Math.max(0, (rating - band.floor) / (next - band.floor)));
  return { id: band.id, name: band.name, floor: band.floor, next, progress };
}

/** The floor a player can't drop below, given the best league they've reached
 *  this season. Passing an unknown id (an older client, a renamed tier) falls
 *  back to no protection rather than throwing. */
export function floorForLeague(id: string | null): number {
  if (!id) return 0;
  return LEAGUES.find((l) => l.id === id)?.floor ?? 0;
}

// --- trophies and tiers ----------------------------------------------------
//
// Trophies are the number players *see* on each other. They move both ways
// now, and where you sit decides how: at the bottom a loss barely stings and
// a win pays well, so a new player climbs; at the top a win pays little and a
// loss costs a lot, so staying there means keeping on winning. The tier badge
// is derived from the current count, never floored -- fall under the line and
// the badge goes with it, which is what stops anyone coasting on it.

export const TIERS = [
  { id: "bronze", name: "Bronze", floor: 0 },
  { id: "silver", name: "Silver", floor: 500 },
  { id: "gold", name: "Gold", floor: 1000 },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export function tierFor(trophies: number): TierId {
  let tier: TierId = "bronze";
  for (const t of TIERS) if (trophies >= t.floor) tier = t.id;
  return tier;
}

/** Trophy change for finishing 1st..5th at a five-seat table, by tier. */
export const TROPHY_DELTAS: Record<TierId, readonly number[]> = {
  bronze: [40, 25, 12, -4, -8],
  silver: [30, 15, 0, -15, -30],
  gold: [15, 5, -10, -25, -40],
};

/** Where a player who walks out of a ranked game is scored: dead last. */
export const QUIT_PLACE = TROPHY_DELTAS.bronze.length - 1;

/**
 * Trophy change for one finish. [place] is 0 = winner among [seats] players;
 * a smaller table is spread across the five-seat scale so a 3-player game
 * still has a clear top and a clear bottom.
 */
export function trophyDelta(trophies: number, place: number, seats: number): number {
  const table = TROPHY_DELTAS[tierFor(trophies)];
  const last = table.length - 1;
  const slot = seats <= 1 ? 0 : Math.round((place * last) / (seats - 1));
  return table[Math.min(last, Math.max(0, slot))];
}

// --- rating maths ----------------------------------------------------------

/**
 * Rating moves by where you finish and by how high you already are.
 *
 * Not Elo. Elo pays by the strength of the people you beat, which is right
 * for chess and wrong for a five-player party game decided by a vote: the
 * table is whoever the queue found, and nobody chose them. What matters
 * here is simpler -- the higher you sit, the harder it is to stay. Below
 * 1500 a win pays 40 and a last place costs 10, so a new player climbs.
 * From 1500 it is 20 and 20. From 2000 a win pays 10 and a last place costs
 * 40: the top of the board belongs to whoever keeps winning, not to whoever
 * got there first. The middle places are spread between.
 */
export type RatingBand = { floor: number; deltas: readonly number[] };
export const RATING_BANDS: readonly RatingBand[] = [
  { floor: 0, deltas: [40, 25, 10, -5, -10] },
  { floor: 1500, deltas: [20, 10, 0, -10, -20] },
  { floor: 2000, deltas: [10, 5, -5, -20, -40] },
];

/** The band a rating is in. */
export function ratingBand(rating: number): RatingBand {
  let band = RATING_BANDS[0];
  for (const b of RATING_BANDS) if (rating >= b.floor) band = b;
  return band;
}

/** Rating change for finishing [place] (0 = winner) of [seats], at [rating].
 *  A smaller table is spread across the five-seat scale, like trophies. */
export function ratingDelta(rating: number, place: number, seats: number): number {
  const table = ratingBand(rating).deltas;
  const last = table.length - 1;
  const slot = seats <= 1 ? 0 : Math.round((place * last) / (seats - 1));
  return table[Math.min(last, Math.max(0, slot))];
}

/** Your first few games count for more, so a new player lands near their
 *  level in an evening instead of grinding up from the start. */
export const PLACEMENT_GAMES = 5;
const PLACEMENT_BOOST = 1.5;

/**
 * Ranked games before a player appears on the leaderboard and has a rank.
 *
 * One. The first few games still count for more (see PLACEMENT_GAMES), but
 * nobody is made to play five games before the board admits they exist. A
 * new player who finishes one match and opens the leaderboard should find
 * themselves on it; that is the moment the board becomes something to
 * climb rather than something other people are on.
 */
export const BOARD_AFTER_GAMES = 1;

/** Bots are opponents, but beating them is not an achievement. A table's
 *  result is scaled by the share of it that was human, so queueing alone
 *  against a bot backfill moves the rating by only a few points either
 *  way -- and losing to bots costs as little as beating them pays. */
export const BOT_RATING = 1000;

export type Contender = {
  playerId: string;
  rating: number;
  isBot: boolean;
  /** Final placement, 0 = winner. Ties share a place. */
  place: number;
  /** How many ranked games this player has finished before this one. */
  gamesPlayed: number;
};

export type RatingChange = {
  playerId: string;
  before: number;
  after: number;
  delta: number;
};

/**
 * Rates one finished game: each human by their place and their band, scaled
 * by how much of the table was people. A solo game (nobody to beat) moves
 * nothing.
 */
export function rateGame(contenders: readonly Contender[]): RatingChange[] {
  const out: RatingChange[] = [];
  const seats = contenders.length;
  const humans = contenders.filter((c) => !c.isBot).length;
  const share = seats > 0 ? humans / seats : 0;

  for (const player of contenders) {
    if (player.isBot) continue;
    if (seats < 2) {
      out.push({ playerId: player.playerId, before: player.rating, after: player.rating, delta: 0 });
      continue;
    }
    // Everyone tied for a place shares it: no coin-flip should move a rating.
    const tiedFor = contenders.filter((c) => c.place === player.place).length;
    const base = tiedFor > 1 ? 0 : ratingDelta(player.rating, player.place, seats);
    const boost = player.gamesPlayed < PLACEMENT_GAMES && base > 0 ? PLACEMENT_BOOST : 1;
    const delta = Math.round(base * share * boost);
    const after = Math.max(0, player.rating + delta);
    out.push({ playerId: player.playerId, before: player.rating, after, delta: after - player.rating });
  }
  return out;
}

/**
 * Applies a rating change with league-floor protection.
 *
 * Returns what the rating should actually become. Losses are absorbed at the
 * floor of the best league reached this season, so a promotion, once earned,
 * survives a bad run.
 */
export function applyFloor(rating: number, bestLeagueId: string | null): number {
  return Math.max(rating, floorForLeague(bestLeagueId));
}

// --- seasons ---------------------------------------------------------------

/** A season is four weeks. Long enough to climb properly, short enough that
 *  the board doesn't calcify around whoever started first. */
export const SEASON_DAYS = 28;

/** Seasons are numbered from a fixed epoch so every server agrees on which one
 *  it is without storing any schedule. */
const SEASON_EPOCH_MS = Date.UTC(2026, 0, 5); // Mon 5 Jan 2026

export function seasonAt(nowMs: number = Date.now()): number {
  const elapsed = nowMs - SEASON_EPOCH_MS;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / (SEASON_DAYS * 24 * 60 * 60 * 1000));
}

export function seasonEndsAt(nowMs: number = Date.now()): number {
  return SEASON_EPOCH_MS + (seasonAt(nowMs) + 1) * SEASON_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Carries a rating into a new season.
 *
 * A soft reset, not a wipe: everyone is pulled halfway back toward the Sketcher
 * line. Strong players still start ahead and re-climb quickly, but the top of
 * the board is contestable again every four weeks, which is the entire point of
 * having seasons. Nobody is sent below the Doodler floor.
 */
export function softReset(rating: number): number {
  const anchor = LEAGUES[2].floor; // Sketcher
  const pulled = Math.round(anchor + (rating - anchor) * 0.5);
  return Math.max(LEAGUES[1].floor, pulled);
}
