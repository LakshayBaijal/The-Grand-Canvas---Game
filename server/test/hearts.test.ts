import { strict as assert } from "node:assert";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as store from "../src/store.js";
import { botDrawing } from "../src/bots.js";

/**
 * Hearts are the one thing on the daily that a player gives to another
 * player, so the rules are the whole feature: one each, never your own,
 * never taken back. And the hall of fame is what the hearts are *for*, so
 * freezing a day has to be exact: the right three, in the right order, paid
 * once and only once.
 */

function freshStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "grandcanvas-hearts-"));
  store.openStore(join(dir, "test.db"));
  return dir;
}

const strokes = () => botDrawing("A bear who has just discovered coffee.", "", "h1");

/** Seats [n] players and has each draw for [day]. Returns their entries. */
function day(dayNo: number, n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p${i}`;
    store.upsertPlayer(id, `Player ${i}`);
    store.submitDaily({ day: dayNo, playerId: id, nickname: `Player ${i}`, title: `t${i}`, strokes: strokes() });
    ids.push(id);
  }
  const entries = store.dailyGalleryWithHearts(dayNo, "nobody", null, 50).entries;
  const byPlayer = new Map(entries.map((e) => [e.artistId, e]));
  return { ids, entry: (id: string) => byPlayer.get(id)! };
}

test("one heart per person per drawing, never your own, never taken back", () => {
  const dir = freshStore();
  try {
    const d = day(20_000, 3);
    const target = d.entry("p0").id;

    assert.deepEqual(store.heartDaily(20_000, target, "p1"), { ok: true, hearts: 1 });
    assert.deepEqual(store.heartDaily(20_000, target, "p2"), { ok: true, hearts: 2 });
    // Again from the same person: nothing changes, and it says so.
    assert.deepEqual(store.heartDaily(20_000, target, "p1"), { ok: false, reason: "already" });
    // Your own: refused.
    assert.deepEqual(store.heartDaily(20_000, target, "p0"), { ok: false, reason: "own" });
    // A drawing that isn't in that day's gallery: refused.
    assert.deepEqual(store.heartDaily(20_000, 999_999, "p1"), { ok: false, reason: "missing" });

    // The count is on the gallery row, and so is "did I already".
    const forP1 = store.dailyGalleryWithHearts(20_000, "p1", null, 50).entries.find((e) => e.id === target)!;
    assert.equal(forP1.hearts, 2);
    assert.equal(forP1.heartedByMe, true);
    const forP2 = store.dailyGalleryWithHearts(20_000, "p2", null, 50).entries.find((e) => e.id === target)!;
    assert.equal(forP2.heartedByMe, true);
    const forP0 = store.dailyGalleryWithHearts(20_000, "p0", null, 50).entries.find((e) => e.id === target)!;
    assert.equal(forP0.heartedByMe, false);
    // There is no API to remove one, and that is the point.
    assert.equal(typeof (store as Record<string, unknown>).unheartDaily, "undefined");
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the top three are the most hearted, best first, ties to the earlier drawing", () => {
  const dir = freshStore();
  try {
    const d = day(20_001, 5);
    const [a, b, c, e] = [d.entry("p0").id, d.entry("p1").id, d.entry("p2").id, d.entry("p4").id];
    // b: 3 hearts, a: 2, c: 1, e: 1 (submitted after c), p3: none.
    for (const from of ["p0", "p2", "p3"]) store.heartDaily(20_001, b, from);
    for (const from of ["p1", "p2"]) store.heartDaily(20_001, a, from);
    store.heartDaily(20_001, c, "p0");
    store.heartDaily(20_001, e, "p0");

    const top = store.dailyTop(20_001, null);
    assert.deepEqual(top.map((t) => [t.id, t.hearts, t.rank]), [[b, 3, 1], [a, 2, 2], [c, 1, 3]]);
    // Nobody with zero hearts is "top" of anything.
    assert.equal(store.dailyTop(20_002, null).length, 0);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("freezing a day pays the top three once, and the hall keeps them", () => {
  const dir = freshStore();
  try {
    const d = day(20_010, 4);
    const winner = d.entry("p0").id;
    const second = d.entry("p1").id;
    for (const from of ["p1", "p2", "p3"]) store.heartDaily(20_010, winner, from);
    store.heartDaily(20_010, second, "p0");

    const before = store.getProfile("p0")!.trophies;
    assert.equal(store.freezeDay(20_010, "A bear who has just discovered coffee."), true);
    assert.equal(store.getProfile("p0")!.trophies, before + store.DAILY_TROPHIES[0]);
    assert.equal(store.getProfile("p1")!.trophies, store.DAILY_TROPHIES[1]);
    // p2 and p3 had no hearts: no place, no trophies.
    assert.equal(store.getProfile("p2")!.trophies, 0);

    // Freezing again is a no-op -- no double pay.
    assert.equal(store.freezeDay(20_010, "whatever"), false);
    assert.equal(store.getProfile("p0")!.trophies, before + store.DAILY_TROPHIES[0]);

    const hall = store.hallOfFame(null, 10);
    assert.equal(hall.days.length, 1);
    assert.equal(hall.days[0].prompt, "A bear who has just discovered coffee.");
    assert.deepEqual(hall.days[0].top.map((t) => [t.rank, t.artistName, t.hearts]), [[1, "Player 0", 3], [2, "Player 1", 1]]);
    assert.ok(hall.days[0].top[0].strokes.length > 0, "the drawing itself is kept");

    // And it survives the gallery being pruned: the hall is forever.
    store.pruneDaily({ maxAgeDays: 0 });
    assert.equal(store.countDaily(20_010), 0);
    assert.equal(store.hallOfFame(null, 10).days.length, 1);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a day with drawings but no hearts is not frozen, and the backlog finds ended days", () => {
  const dir = freshStore();
  try {
    day(20_020, 2); // no hearts
    const d = day(20_021, 2);
    store.heartDaily(20_021, d.entry("p0").id, "p1");
    assert.deepEqual(store.unfrozenDays(20_030), [20_020, 20_021]);
    assert.equal(store.freezeDay(20_020, "x"), false, "nothing to celebrate");
    assert.equal(store.freezeDay(20_021, "y"), true);
    // A day still running is never in the backlog.
    assert.deepEqual(store.unfrozenDays(20_021), [20_020]);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
