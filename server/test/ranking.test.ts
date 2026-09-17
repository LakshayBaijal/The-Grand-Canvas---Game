import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyFloor,
  BOT_RATING,
  leagueFor,
  LEAGUES,
  PLACEMENT_GAMES,
  rateGame,
  softReset,
  START_RATING,
  type Contender,
} from "../src/ranking.js";

const player = (over: Partial<Contender> & { playerId: string; place: number }): Contender => ({
  rating: START_RATING,
  isBot: false,
  gamesPlayed: PLACEMENT_GAMES, // past placements unless a test says otherwise
  ...over,
});

const deltaFor = (changes: ReturnType<typeof rateGame>, id: string) =>
  changes.find((c) => c.playerId === id)!.delta;

test("winning gains rating and losing loses it", () => {
  const changes = rateGame([
    player({ playerId: "a", place: 0 }),
    player({ playerId: "b", place: 1 }),
    player({ playerId: "c", place: 2 }),
  ]);
  assert.ok(deltaFor(changes, "a") > 0, "winner should gain");
  assert.ok(deltaFor(changes, "c") < 0, "last place should lose");
});

test("the higher you are, the less a win pays and the more a loss costs", () => {
  const win = (rating: number) => deltaFor(rateGame([
    player({ playerId: "me", place: 0, rating }),
    ...[1, 2, 3, 4].map((i) => player({ playerId: `h${i}`, place: i })),
  ]), "me");
  const lose = (rating: number) => deltaFor(rateGame([
    ...[0, 1, 2, 3].map((i) => player({ playerId: `h${i}`, place: i })),
    player({ playerId: "me", place: 4, rating }),
  ]), "me");
  assert.equal(win(1000), 40); assert.equal(lose(1000), -10);
  assert.equal(win(1500), 20); assert.equal(lose(1500), -20);
  assert.equal(win(2000), 10); assert.equal(lose(2000), -40);
  assert.equal(win(2600), 10); assert.equal(lose(2600), -40);
});

test("the middle of the table is spread between the ends", () => {
  const rows = rateGame([0, 1, 2, 3, 4].map((i) => player({ playerId: `p${i}`, place: i, rating: 1200 })));
  assert.deepEqual(rows.map((r) => r.delta), [40, 25, 10, -5, -10]);
  const three = rateGame([0, 1, 2].map((i) => player({ playerId: `p${i}`, place: i, rating: 1700 })));
  assert.deepEqual(three.map((r) => r.delta), [20, 0, -20], "three players: top, middle, bottom of the scale");
});

test("farming bots is not a ladder strategy", () => {
  // Queue alone, let the backfill fill the lobby, win. Worth almost nothing.
  const changes = rateGame([
    player({ playerId: "me", place: 0 }),
    ...[1, 2, 3, 4].map((i) => player({ playerId: `b${i}`, place: i, isBot: true, rating: BOT_RATING })),
  ]);
  assert.equal(changes.length, 1, "bots must not be rated themselves");
  assert.ok(deltaFor(changes, "me") <= 8, `beating four bots should be worth little, got ${deltaFor(changes, "me")}`);
  // And losing to them costs as little.
  const lost = rateGame([
    ...[0, 1, 2, 3].map((i) => player({ playerId: `b${i}`, place: i, isBot: true, rating: BOT_RATING })),
    player({ playerId: "me", place: 4, rating: 2100 }),
  ]);
  assert.ok(deltaFor(lost, "me") >= -8);
});

test("beating four humans is worth far more than beating four bots", () => {
  const vsBots = rateGame([
    player({ playerId: "me", place: 0 }),
    ...[1, 2, 3, 4].map((i) => player({ playerId: `b${i}`, place: i, isBot: true, rating: BOT_RATING })),
  ]);
  const vsHumans = rateGame([
    player({ playerId: "me", place: 0 }),
    ...[1, 2, 3, 4].map((i) => player({ playerId: `h${i}`, place: i })),
  ]);
  assert.ok(deltaFor(vsHumans, "me") > deltaFor(vsBots, "me") * 3);
});

test("placement games move a new player faster, but only upward", () => {
  const settled = rateGame([player({ playerId: "me", place: 0 }), player({ playerId: "x", place: 1 })]);
  const placing = rateGame([player({ playerId: "me", place: 0, gamesPlayed: 0 }), player({ playerId: "x", place: 1 })]);
  assert.ok(deltaFor(placing, "me") > deltaFor(settled, "me"));
  const placingLoss = rateGame([player({ playerId: "x", place: 0 }), player({ playerId: "me", place: 1, gamesPlayed: 0 })]);
  const settledLoss = rateGame([player({ playerId: "x", place: 0 }), player({ playerId: "me", place: 1 })]);
  assert.equal(deltaFor(placingLoss, "me"), deltaFor(settledLoss, "me"), "a new player's losses are not amplified");
});

test("tied scores share a place and neither player moves", () => {
  const changes = rateGame([
    player({ playerId: "a", place: 0 }),
    player({ playerId: "b", place: 0 }),
  ]);
  assert.equal(deltaFor(changes, "a"), 0);
  assert.equal(deltaFor(changes, "b"), 0);
});

test("rating never goes negative", () => {
  const changes = rateGame([
    player({ playerId: "x", place: 0, rating: 1800 }),
    player({ playerId: "me", place: 1, rating: 2 }),
  ]);
  assert.ok(changes.find((c) => c.playerId === "me")!.after >= 0);
});

test("league floors protect a promotion from a bad run", () => {
  const sketcher = LEAGUES.find((l) => l.id === "sketcher")!;
  // Dropped well below the Sketcher line, but Sketcher was reached this season.
  assert.equal(applyFloor(sketcher.floor - 200, "sketcher"), sketcher.floor);
  // With no league reached, nothing is protected.
  assert.equal(applyFloor(sketcher.floor - 200, null), sketcher.floor - 200);
  // An unknown id (older client, renamed tier) must not throw.
  assert.equal(applyFloor(500, "nonsense"), 500);
});

test("leagueFor maps ratings to the right band", () => {
  assert.equal(leagueFor(0).id, "scribbles");
  assert.equal(leagueFor(START_RATING).id, "doodler");
  assert.equal(leagueFor(99_999).id, "grand");
  for (const band of LEAGUES) {
    assert.equal(leagueFor(band.floor).id, band.id, `${band.id} floor should be inside ${band.id}`);
  }
});

test("league progress runs 0..1 and tops out at the apex", () => {
  const doodler = LEAGUES.find((l) => l.id === "doodler")!;
  assert.equal(leagueFor(doodler.floor).progress, 0);
  assert.equal(leagueFor(99_999).progress, 1);
  assert.equal(leagueFor(99_999).next, null);
});

test("the soft reset compresses the field without wiping it", () => {
  const top = softReset(1900);
  const low = softReset(950);
  assert.ok(top < 1900, "a top player should come down");
  assert.ok(top > 1100, "but should still start clearly ahead");
  assert.ok(low >= LEAGUES[1].floor, "nobody is pushed below the Doodler floor");
  assert.ok(softReset(1900) > softReset(1400), "order is preserved");
});

// --- trophies and tiers ------------------------------------------------------

import { tierFor, trophyDelta, TROPHY_DELTAS, QUIT_PLACE } from "../src/ranking.js";

test("the tier badge follows the count both ways", () => {
  assert.equal(tierFor(0), "bronze");
  assert.equal(tierFor(499), "bronze");
  assert.equal(tierFor(500), "silver");
  assert.equal(tierFor(999), "silver");
  assert.equal(tierFor(1000), "gold");
  assert.equal(tierFor(5000), "gold");
});

test("bronze gains a lot and loses a little; gold the reverse; silver is even", () => {
  const sum = (t: readonly number[]) => t.reduce((a, b) => a + b, 0);
  assert.ok(sum(TROPHY_DELTAS.bronze) > 0, "a bronze table is net positive: new players climb");
  assert.ok(sum(TROPHY_DELTAS.gold) < 0, "a gold table is net negative: staying up means winning");
  assert.equal(sum(TROPHY_DELTAS.silver), 0, "silver is zero-sum");
  assert.ok(TROPHY_DELTAS.bronze[0] > TROPHY_DELTAS.gold[0], "a win pays more at the bottom");
  assert.ok(TROPHY_DELTAS.bronze[4] > TROPHY_DELTAS.gold[4], "a loss costs less at the bottom");
});

test("a smaller table is spread over the same scale", () => {
  // 3 players: 1st, middle, last.
  assert.equal(trophyDelta(0, 0, 3), TROPHY_DELTAS.bronze[0]);
  assert.equal(trophyDelta(0, 1, 3), TROPHY_DELTAS.bronze[2]);
  assert.equal(trophyDelta(0, 2, 3), TROPHY_DELTAS.bronze[4]);
  // Solo: nothing to beat, so it's a "win" — the bot share scales it away.
  assert.equal(trophyDelta(0, 0, 1), TROPHY_DELTAS.bronze[0]);
  // Quitting is dead last.
  assert.equal(trophyDelta(1200, QUIT_PLACE, 5), TROPHY_DELTAS.gold[4]);
});
