import type { Point, Stroke } from "./types.js";

/**
 * Everything a client sends is untrusted, and the two places that bites are
 * drawings and money. A drawing is relayed to every other player and stored;
 * a badly-shaped one — a string where a number should be, an Infinity, a
 * 50MB stroke list — does not just fail for the sender, it throws inside
 * every other client's decoder and drops *their* connection. So drawings are
 * cleaned rather than trusted: anything unusable is dropped, and what is left
 * is guaranteed to be finite, in range, and bounded in size.
 */

/** More strokes than a person makes in 75 seconds by a wide margin; the
 *  richest bot drawing is ~100. */
export const MAX_STROKES = 800;

/** Across a whole drawing. Human capture after simplification is ~500
 *  points; this is room for a very busy one, not an open door. */
export const MAX_POINTS = 16_000;
export const MAX_POINTS_PER_STROKE = 4_000;

const MIN_WIDTH = 0.5;
const MAX_WIDTH = 60;

const HEX = /^#[0-9a-fA-F]{6}$/;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function cleanPoint(raw: unknown): Point | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { x, y } = raw as Record<string, unknown>;
  if (!isNum(x) || !isNum(y)) return null;
  // Clamp rather than reject: a point a hair off the paper is a rounding
  // artefact, not an attack, and the canvas clips it anyway.
  return { x: round4(Math.min(1, Math.max(0, x))), y: round4(Math.min(1, Math.max(0, y))) };
}

function cleanStroke(raw: unknown, pointBudget: number): Stroke | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.color !== "string" || !HEX.test(s.color)) return null;
  if (!isNum(s.width)) return null;
  if (!Array.isArray(s.points)) return null;

  const points: Point[] = [];
  const limit = Math.min(s.points.length, MAX_POINTS_PER_STROKE, pointBudget);
  for (let i = 0; i < limit; i++) {
    const p = cleanPoint(s.points[i]);
    if (p) points.push(p);
  }
  if (points.length < 2) return null;

  const out: Stroke = {
    color: s.color.toUpperCase(),
    width: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, s.width)) * 100) / 100,
    points,
  };
  // Cosmetic and passed through, but only as a short plain string — an
  // unknown value already falls back to the default pen on the client.
  if (typeof s.style === "string" && s.style.length <= 16 && /^[a-z]+$/.test(s.style)) {
    out.style = s.style;
  }
  return out;
}

/** Returns only the usable strokes, in order, within the size limits. Empty
 *  means there was nothing worth keeping — callers treat that as "no
 *  drawing", not as an error to relay. */
export function sanitizeStrokes(input: unknown): Stroke[] {
  if (!Array.isArray(input)) return [];
  const out: Stroke[] = [];
  let budget = MAX_POINTS;
  for (let i = 0; i < input.length && out.length < MAX_STROKES && budget > 1; i++) {
    const s = cleanStroke(input[i], budget);
    if (!s) continue;
    budget -= s.points.length;
    out.push(s);
  }
  return out;
}

/**
 * A short piece of player-typed text: nicknames, titles, the prompt blank.
 *
 * Control characters (including newlines) are removed and runs of whitespace
 * collapsed, because these strings are laid out in single-line UI on every
 * other player's screen. Anything that is not a string becomes empty, and
 * callers decide whether empty is allowed.
 */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return (
    input
      // Line and paragraph breaks become a space, so "Riya\nthe Great" stays
      // three words rather than fusing into one.
      .replace(/[\r\n\t\v\f\p{Zl}\p{Zp}]/gu, " ")
      // Everything else invisible — other controls, zero-width joiners, BOMs —
      // is simply removed.
      .replace(/[\p{Cc}\p{Cf}]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
      .trim()
  );
}

/** A finite whole number, or null. */
export function asInt(input: unknown): number | null {
  return isNum(input) ? Math.trunc(input) : null;
}

/**
 * Per-connection message budget: a token bucket refilled at [perSecond],
 * holding at most [burst]. Nothing in the game needs more than a few messages
 * a second; a client sending hundreds is broken or hostile, and either way
 * the answer is to ignore it rather than let it drive the server.
 */
export class RateLimit {
  private tokens: number;
  /** Set on first use rather than at construction, and never allowed to run
   *  backwards: a clock step (NTP, a suspended laptop) must not be able to
   *  starve a socket, and it must not be able to top it up either. */
  private last: number | null = null;
  /** How many messages have been dropped, for deciding when to give up. */
  dropped = 0;

  constructor(
    private readonly perSecond = 30,
    private readonly burst = 60,
  ) {
    this.tokens = burst;
  }

  /** True if the message may proceed. */
  allow(now = Date.now()): boolean {
    const elapsed = this.last === null ? 0 : Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.perSecond);
    if (this.tokens < 1) {
      this.dropped++;
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}
