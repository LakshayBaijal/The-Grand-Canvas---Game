import { strict as assert } from "node:assert";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as store from "../src/store.js";
import { DAILY_PROMPTS, dailyFor, dayOf, promptForDay } from "../src/daily.js";
import { botDrawing } from "../src/bots.js";

/**
 * The daily is a small feature with one hard rule — one entry per player per
 * day, and the gallery is only for people who made one — and one thing that
 * has to be true forever: every day gets a prompt, and every server agrees on
 * which.
 */

function freshStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "grandcanvas-daily-"));
  store.openStore(join(dir, "test.db"));
  return dir;
}

const strokes = () => botDrawing("A snail on its way somewhere important.", "", "d1");

test("every day has a prompt, and the schedule is the same everywhere", () => {
  // Enough prompts that the bank does not come round inside a year.
  assert.ok(DAILY_PROMPTS.length >= 365, `only ${DAILY_PROMPTS.length} prompts — fewer than a year`);
  assert.equal(new Set(DAILY_PROMPTS).size, DAILY_PROMPTS.length, "duplicate prompts");

  // Deterministic: the same day always gets the same prompt, on any machine.
  assert.equal(promptForDay(20_000), promptForDay(20_000));
  // Consecutive days differ, and a day well in the future still resolves.
  assert.notEqual(promptForDay(20_000), promptForDay(20_001));
  assert.ok(promptForDay(99_999).length > 0);

  // The day boundary is midnight UTC, and endsAt is the next one.
  const noon = Date.UTC(2026, 8, 5, 12);
  const d = dailyFor(noon);
  assert.equal(d.day, dayOf(noon));
  assert.equal(d.endsAtMs, Date.UTC(2026, 8, 6));
  assert.equal(d.prompt, promptForDay(d.day));
});

test("one entry per player per day; drawing again replaces it", () => {
  const dir = freshStore();
  try {
    const day = 20_000;
    store.submitDaily({ day, playerId: "p1", nickname: "Riya", title: "First go", strokes: strokes() });
    store.submitDaily({ day, playerId: "p1", nickname: "Riya", title: "Better", strokes: strokes() });
    store.submitDaily({ day, playerId: "p2", nickname: "Dev", title: "Mine", strokes: strokes() });

    assert.equal(store.countDaily(day), 2);
    assert.equal(store.myDailyEntry(day, "p1")?.title, "Better");
    assert.equal(store.hasSubmittedDaily(day, "p1"), true);
    assert.equal(store.hasSubmittedDaily(day, "p3"), false);
    // A different day is a different gallery.
    assert.equal(store.hasSubmittedDaily(day + 1, "p1"), false);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the gallery pages newest first and comes back intact", () => {
  const dir = freshStore();
  try {
    const day = 20_000;
    for (let i = 0; i < 7; i++) {
      store.submitDaily({ day, playerId: `p${i}`, nickname: `N${i}`, title: `t${i}`, paper: "kraft", strokes: strokes() });
    }
    const first = store.dailyGallery(day, null, 3);
    assert.deepEqual(first.entries.map((e) => e.title), ["t6", "t5", "t4"]);
    assert.equal(first.hasMore, true);
    assert.equal(first.entries[0].paper, "kraft");
    assert.equal(first.entries[0].artistName, "N6");
    assert.ok(first.entries[0].strokes.length > 0);

    const second = store.dailyGallery(day, first.entries[2].id, 3);
    assert.deepEqual(second.entries.map((e) => e.title), ["t3", "t2", "t1"]);
    assert.equal(second.hasMore, true);

    const last = store.dailyGallery(day, second.entries[2].id, 3);
    assert.deepEqual(last.entries.map((e) => e.title), ["t0"]);
    assert.equal(last.hasMore, false);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("old galleries are cleared out", () => {
  const dir = freshStore();
  try {
    const today = dayOf(Date.now());
    store.submitDaily({ day: today - 40, playerId: "p1", nickname: "A", title: "old", strokes: strokes() });
    store.submitDaily({ day: today - 1, playerId: "p1", nickname: "A", title: "recent", strokes: strokes() });
    store.submitDaily({ day: today, playerId: "p1", nickname: "A", title: "now", strokes: strokes() });

    assert.equal(store.pruneDaily({ maxAgeDays: 30 }), 1);
    assert.equal(store.hasSubmittedDaily(today - 40, "p1"), false);
    assert.equal(store.hasSubmittedDaily(today - 1, "p1"), true);
    assert.equal(store.hasSubmittedDaily(today, "p1"), true);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
