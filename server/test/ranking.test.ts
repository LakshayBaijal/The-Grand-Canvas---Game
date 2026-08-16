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

test("a game is close to zero-sum between equals", () => {
  const changes = rateGame([
    player({ playerId: "a", place: 0 }),
    player({ playerId: "b", place: 1 }),
    player({ playerId: "c", place: 2 }),
  ]);
  const total = changes.reduce((sum, c) => sum + c.delta, 0);
  assert.ok(Math.abs(total) <= 1, `expected near zero-sum, got ${total}`);
});

test("beating stronger players is worth more than beating weaker ones", () => {
  const vsStrong = rateGame([
    player({ playerId: "me", place: 0 }),
    player({ playerId: "x", place: 1, rating: 1600 }),
    player({ playerId: "y", place: 2, rating: 1600 }),
  ]);
  const vsWeak = rateGame([
    player({ playerId: "me", place: 0 }),
    player({ playerId: "x", place: 1, rating: 600 }),
    player({ playerId: "y", place: 2, rating: 600 }),
  ]);
  assert.ok(
    deltaFor(vsStrong, "me") > deltaFor(vsWeak, "me"),
    "an upset must pay better than beating the field you were expected to beat",
  );
});

test("losing to much weaker players costs more than losing to stronger ones", () => {
  const toWeak = rateGame([
    player({ playerId: "x", place: 0, rating: 600 }),
    player({ playerId: "y", place: 1, rating: 600 }),
    player({ playerId: "me", place: 2 }),
  ]);
  const toStrong = rateGame([
    player({ playerId: "x", place: 0, rating: 1600 }),
    player({ playerId: "y", place: 1, rating: 1600 }),
    player({ playerId: "me", place: 2 }),
  ]);
  assert.ok(deltaFor(toWeak, "me") < deltaFor(toStrong, "me"));
});

test("farming bots is not a ladder strategy", () => {
  // The exact case the old trophy scaling existed to stop: queue alone, let the
  // backfill fill the lobby, win. It should be worth almost nothing.
  const changes = rateGame([
    player({ playerId: "me", place: 0 }),
    player({ playerId: "b1", place: 1, isBot: true, rating: BOT_RATING }),
    player({ playerId: "b2", place: 2, isBot: true, rating: BOT_RATING }),
    player({ playerId: "b3", place: 3, isBot: true, rating: BOT_RATING }),
    player({ playerId: "b4", place: 4, isBot: true, rating: BOT_RATING }),
  ]);
  assert.equal(changes.length, 1, "bots must not be rated themselves");
  assert.ok(
    deltaFor(changes, "me") <= 3,
    `beating four bots should be worth ~nothing, got ${deltaFor(changes, "me")}`,
  );
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

test("placement games move a new player much faster", () => {
  const settled = rateGame([
    player({ playerId: "me", place: 0 }),
    player({ playerId: "x", place: 1 }),
  ]);
  const placing = rateGame([
    player({ playerId: "me", place: 0, gamesPlayed: 0 }),
    player({ playerId: "x", place: 1 }),
  ]);
  assert.ok(deltaFor(placing, "me") > deltaFor(settled, "me") * 2);
});

test("tied scores share a place and neither player moves much", () => {
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
