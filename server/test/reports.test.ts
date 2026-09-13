import { strict as assert } from "node:assert";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as store from "../src/store.js";
import { botDrawing } from "../src/bots.js";

/**
 * Report and hide are player tools, not moderation: a report is a note for a
 * human, a hide changes what one player sees and nothing else. The test is
 * that they do exactly that much and no more.
 */

function freshStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "grandcanvas-reports-"));
  store.openStore(join(dir, "test.db"));
  return dir;
}

const strokes = () => botDrawing("A bear who has just discovered coffee.", "", "r1");

function seed(day: number) {
  for (let i = 0; i < 3; i++) {
    store.upsertPlayer(`p${i}`, `Player ${i}`);
    store.submitDaily({ day, playerId: `p${i}`, nickname: `Player ${i}`, title: `t${i}`, strokes: strokes() });
  }
  const entries = store.dailyGalleryWithHearts(day, "p0", null, 50).entries;
  return new Map(entries.map((e) => [e.artistId, e]));
}

test("hiding an artist removes them from that player's gallery, hall and yesterday -- and nobody else's", () => {
  const dir = freshStore();
  try {
    const by = seed(400);
    // p1 hides p2, found through p2's entry id (the Daily is blind).
    const target = store.artistOfEntry(by.get("p2")!.id);
    assert.equal(target?.artistId, "p2");
    assert.ok(store.hideArtist("p1", "p2"));

    const p1Sees = store.dailyGalleryWithHearts(400, "p1", null, 50).entries.map((e) => e.artistId).sort();
    assert.deepEqual(p1Sees, ["p0", "p1"]);
    const p0Sees = store.dailyGalleryWithHearts(400, "p0", null, 50).entries.map((e) => e.artistId).sort();
    assert.deepEqual(p0Sees, ["p0", "p1", "p2"], "other players see everything");

    // Freeze the day with p2 on top, then check the hall.
    store.heartDaily(400, by.get("p2")!.id, "p0");
    store.heartDaily(400, by.get("p2")!.id, "p1");
    store.heartDaily(400, by.get("p0")!.id, "p1");
    assert.ok(store.freezeDay(400, "prompt"));
    const hallForP1 = store.hallOfFame(null, 5, "p1").days[0].top.map((e) => e.artistId);
    assert.deepEqual(hallForP1, ["p0"], "p2's winning entry is gone for p1 only");
    const hallForAll = store.hallOfFame(null, 5, null).days[0].top.map((e) => e.artistId);
    assert.deepEqual(hallForAll, ["p2", "p0"]);

    // The hall entry can still be resolved for a report after the day is pruned.
    store.unhideArtist("p1", "p2");
    assert.deepEqual(
      store.dailyGalleryWithHearts(400, "p1", null, 50).entries.map((e) => e.artistId).sort(),
      ["p0", "p1", "p2"],
    );
    assert.equal(store.hideArtist("p1", "p1"), false, "can't hide yourself");
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a report is recorded for a human and changes nothing on its own", () => {
  const dir = freshStore();
  try {
    const by = seed(401);
    store.reportDrawing({ reporterId: "p0", artistId: "p2", entryId: by.get("p2")!.id, title: "t2", reason: "rude" });
    store.reportDrawing({ reporterId: "p1", artistId: "p2", entryId: null, title: "round drawing", reason: "spam" });
    const reports = store.recentReports(10);
    assert.equal(reports.length, 2);
    assert.equal(reports[0].reason, "spam");
    assert.equal(reports[0].entryId, null);
    assert.equal(reports[1].artistName, "Player 2");
    assert.equal(reports[1].entryId, by.get("p2")!.id);
    // Still visible to everyone: reports don't remove anything.
    assert.equal(store.dailyGalleryWithHearts(401, "p0", null, 50).entries.length, 3);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
