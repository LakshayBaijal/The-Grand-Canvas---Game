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

/** Standard Elo divisor: a 400-point gap means the favourite is expected to
 *  beat the underdog about 10 times out of 11. */
const ELO_SCALE = 400;

/** How far one game can move you. Deliberately modest: this is a five-player
 *  game decided by other people's taste, so no single night should define you. */
const K_BASE = 24;

/** Your first few games count for much more, so new players land near their
 *  real level in an evening instead of grinding up from the bottom. */
export const PLACEMENT_GAMES = 5;
const K_PLACEMENT = 3;

/** Bots are opponents, but beating them is not an achievement. Their result
 *  contributes at a fraction of the weight, which is what stops someone
 *  queueing alone against a bot backfill to farm the ladder.
 *
 * This is deliberately much stricter than the trophy scaling it replaces:
 * a lobby of 1 human + 4 bots moves rating by only a few points either way. */
const BOT_WEIGHT = 0.15;

/** Bots play at roughly a mid-Doodler level, which is about where their
 *  drawings actually land against real players. */
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
 * Rates one finished game.
 *
 * Free-for-all Elo: every player is scored against every other as if they had
 * played a pairwise match, and the results are averaged. Beating someone rated
 * far above you is worth a lot; losing to someone far below costs a lot. Coming
 * exactly where your rating predicted moves you barely at all — which is the
 * property that makes the number mean something over time.
 */
export function rateGame(contenders: readonly Contender[]): RatingChange[] {
  const out: RatingChange[] = [];

  for (const player of contenders) {
    if (player.isBot) continue;

    const opponents = contenders.filter((c) => c.playerId !== player.playerId);
    if (opponents.length === 0) {
      // Solo game: nothing to measure skill against, so nothing changes.
      out.push({ playerId: player.playerId, before: player.rating, after: player.rating, delta: 0 });
      continue;
    }

    let net = 0;

    for (const opponent of opponents) {
      const weight = opponent.isBot ? BOT_WEIGHT : 1;
      const actual = player.place < opponent.place ? 1 : player.place > opponent.place ? 0 : 0.5;
      const predicted = 1 / (1 + 10 ** ((opponent.rating - player.rating) / ELO_SCALE));
      net += weight * (actual - predicted);
    }

    // Divide by the number of opponents, NOT by the sum of their weights.
    // Dividing by the weight sum cancels the weighting out — it appears in the
    // numerator and denominator both — which silently made beating four bots
    // worth exactly as much as beating four humans, the one thing BOT_WEIGHT
    // exists to prevent. Per-opponent normalisation also keeps a 3-player game
    // and a 5-player game moving you comparably.
    const k = K_BASE * (player.gamesPlayed < PLACEMENT_GAMES ? K_PLACEMENT : 1);
    const delta = Math.round((k * net) / opponents.length);
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
