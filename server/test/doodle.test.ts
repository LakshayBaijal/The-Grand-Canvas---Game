import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";

import { botDrawing } from "../src/bots.js";
import { DEMO_PROMPTS } from "../src/prompts.js";

/**
 * The bot drawings are the main attraction, and two things about them are easy
 * to break without noticing: the size they take on the wire, and how often a
 * player's answer actually gets a shape rather than a generic contraption.
 */

/** The word -> shape map, read out of the source rather than exported, so this
 *  stays a test of the shipped table and not of a copy of it. */
function wordMap(): Map<string, string> {
  const src = readFileSync(new URL("../src/doodle/compose.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("const WORD_SHAPES"), src.indexOf("/** Crude stemmer"));
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(\w+)\s*:\s*(parts\.\w+|\w+Shape)/g)) out.set(m[1], m[2]);
  return out;
}

test("stroke coordinates are rounded, so drawings stay small on the wire", () => {
  const strokes = botDrawing("Every morning starts with cold showers.", "cold showers", "b1");
  for (const s of strokes) {
    for (const p of s.points) {
      // 4dp is a tenth of a pixel on a 1000px canvas. Full doubles roughly
      // double the payload for precision nobody can see.
      assert.equal(
        Number(p.x.toFixed(4)),
        p.x,
        `x=${p.x} carries more precision than is sent for a reason`,
      );
      assert.equal(Number(p.y.toFixed(4)), p.y, `y=${p.y} is not rounded`);
    }
  }
});

test("a drawing stays under the size it takes to feel instant on a phone", () => {
  let worst = 0;
  for (const prompt of DEMO_PROMPTS) {
    const bytes = Buffer.byteLength(JSON.stringify(botDrawing(prompt, "", prompt)));
    worst = Math.max(worst, bytes);
  }
  // Measured around 11KB after rounding, from ~20KB before. The ceiling is
  // deliberately loose: it is here to catch a regression back to full-precision
  // floats or a runaway stroke count, not to police normal variation.
  assert.ok(
    worst < 24 * 1024,
    `largest drawing was ${(worst / 1024).toFixed(1)}KB — a round broadcasts five of these to every player`,
  );
});

test("the word map has no duplicate keys", () => {
  // A duplicate is a silent bug: the later entry wins and the earlier shape
  // becomes unreachable. TypeScript catches it in an object literal, but only
  // while the two spellings are identical.
  const src = readFileSync(new URL("../src/doodle/compose.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("const WORD_SHAPES"), src.indexOf("/** Crude stemmer"));
  const keys = [...body.matchAll(/(\w+)\s*:\s*(?:parts\.\w+|\w+Shape)/g)].map((m) => m[1]);
  const seen = new Set<string>();
  const dupes = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(dupes, []);
});

test("everyday answers mostly find a real shape", () => {
  const map = wordMap();
  const stems = (w: string) => {
    const f = [w];
    if (w.endsWith("es") && w.length > 3) f.push(w.slice(0, -2));
    if (w.endsWith("s") && w.length > 3) f.push(w.slice(0, -1));
    if (w.endsWith("ing") && w.length > 5) f.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
    return f;
  };
  // A spread of things people actually type into "the worst part of ___".
  const answers = `shower toilet sponge towel razor spider fly mosquito train plane
    plug radiator candle oven iron balloon gift fish screwdriver drill lightning
    stapler calculator mailbox fence basket hourglass microphone map newspaper
    teddy coffee traffic dog laundry keys phone wifi money bed rain snow gym
    noise printer queue trolley password wine cake pram guitar window helmet`
    .split(/\s+/)
    .filter(Boolean);

  const missing = answers.filter((a) => !stems(a).some((f) => map.has(f)));
  assert.deepEqual(
    missing,
    [],
    "these fall through to a generic contraption; add them to WORD_SHAPES",
  );
});

test("every mapped word points at a shape that exists", () => {
  const parts = readFileSync(new URL("../src/doodle/parts.ts", import.meta.url), "utf8");
  const exported = new Set(
    [...parts.matchAll(/^export function (\w+)/gm)].map((m) => m[1]),
  );
  const broken: string[] = [];
  for (const [word, target] of wordMap()) {
    if (!target.startsWith("parts.")) continue; // locally-defined shape
    if (!exported.has(target.slice(6))) broken.push(`${word} -> ${target}`);
  }
  assert.deepEqual(broken, [], "word map points at a part that is not exported");
});
