import { strict as assert } from "node:assert";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import * as store from "../src/store.js";
import { botDrawing } from "../src/bots.js";
import type { Stroke } from "../src/types.js";

/**
 * The drawing archive is the only place this server keeps player-authored
 * content rather than passing it through, so what matters is that a drawing
 * survives the round trip intact, that the store stays bounded, and that the
 * newest work is what survives being trimmed.
 */

function freshStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "grandcanvas-"));
  store.openStore(join(dir, "test.db"));
  return dir;
}

const strokesFor = (): Stroke[] =>
  botDrawing("A machine for cold showers.", "cold showers", "t1");

type Archived = Parameters<typeof store.archiveDrawings>[0][number];

function entry(overrides: Partial<Archived> = {}): Archived {
  return {
    playerId: "p1",
    prompt: "The worst part of mornings is ___.",
    answer: "cold showers",
    title: "The Shiver-Matic",
    paper: "grid",
    raised: 1400,
    strokes: strokesFor(),
    ...overrides,
  };
}

test("a drawing survives being archived and read back", () => {
  const dir = freshStore();
  try {
    const original = entry();
    store.archiveDrawings([original]);

    const [back] = store.readDrawings();
    assert.equal(back.prompt, original.prompt);
    assert.equal(back.answer, original.answer);
    assert.equal(back.title, original.title);
    assert.equal(back.paper, "grid");
    assert.equal(back.raised, 1400);

    // The strokes are the point of the whole table: they go in as objects,
    // get compressed to a blob, and have to come back as the same drawing.
    assert.equal(back.strokes.length, original.strokes.length);
    assert.equal(back.strokes[0].color, original.strokes[0].color);
    assert.deepEqual(back.strokes[0].points, original.strokes[0].points);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("strokes are stored compressed, not as plain JSON", () => {
  const dir = freshStore();
  try {
    const drawing = entry();
    const raw = Buffer.byteLength(JSON.stringify(drawing.strokes));
    store.archiveDrawings([drawing]);

    // No exact figure asserted — this is here to catch the blob silently
    // becoming plain JSON, which would quietly quadruple the disk this costs.
    assert.ok(
      store.archiveBytes() < raw / 2,
      `stored ${store.archiveBytes()} bytes for ${raw} bytes of strokes — not compressing`,
    );
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reading pages by id, so an export can be resumed", () => {
  const dir = freshStore();
  try {
    store.archiveDrawings([
      entry({ title: "one" }),
      entry({ title: "two" }),
      entry({ title: "three" }),
    ]);

    const first = store.readDrawings(0, 2);
    assert.deepEqual(first.map((d) => d.title), ["one", "two"]);

    const rest = store.readDrawings(first[first.length - 1].id, 2);
    assert.deepEqual(rest.map((d) => d.title), ["three"]);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("old drawings are dropped once they age out", async () => {
  const dir = freshStore();
  try {
    store.archiveDrawings([entry({ title: "old1" }), entry({ title: "old2" })]);
    // Margins are wide on purpose. Archiving compresses a real drawing, which
    // takes tens of milliseconds under load, so a tight window here fails when
    // the suite runs alongside everything else rather than alone.
    await sleep(300);
    store.archiveDrawings([entry({ title: "recent" })]);

    const { byAge } = store.pruneDrawings({ maxAgeMs: 150 });
    assert.equal(byAge, 2);
    assert.deepEqual(store.readDrawings().map((d) => d.title), ["recent"]);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the row cap keeps the newest, not the oldest", () => {
  const dir = freshStore();
  try {
    for (let i = 0; i < 20; i++) store.archiveDrawings([entry({ title: `d${i}` })]);
    assert.equal(store.countDrawings(), 20);

    const { byCount } = store.pruneDrawings({ maxRows: 5 });
    assert.equal(byCount, 15);

    // An archive that kept the oldest rows and threw away today's would be
    // worse than not keeping one at all.
    assert.deepEqual(
      store.readDrawings().map((d) => d.title),
      ["d15", "d16", "d17", "d18", "d19"],
    );
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
