import type { Point, Stroke } from "../types.js";

/** Small deterministic RNG (mulberry32) so a given seed always yields the
 *  same doodle — makes bot drawings reproducible in tests. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export type Pt = { x: number; y: number };

/**
 * Draws in normalized 0..1 space with a simulated unsteady hand.
 *
 * Three separate imperfections stack to sell "a person drew this":
 *   - drift: a slow bow across the whole stroke, so lines are never straight
 *   - tremor: high-frequency micro-jitter, like an unsteady grip
 *   - endpoint slop: strokes start/end a hair off their intended target
 *
 * Anything drawn is clamped into a margin so nothing runs off the paper.
 */
/**
 * Coordinates are 0..1 fractions of the canvas, and a full-precision double
 * serialises to ~19 characters of JSON for no benefit: at 4 decimal places the
 * worst error is 0.1px on a 1000px canvas, which is well under one pixel and
 * far under the wobble the pen deliberately adds anyway.
 *
 * It matters because drawings are the one big thing on this wire. A round with
 * five bots is ~100KB of strokes broadcast to every player; rounding here takes
 * about 45% off that, which is worth far more than any saving available in the
 * generation itself (measured at well under a millisecond per drawing).
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export class Pen {
  readonly strokes: Stroke[] = [];
  private color = "#1A1A1A";
  private width = 5;
  private widthScale = 1;

  constructor(
    private readonly rng: Rng,
    /** Scales every imperfection — higher means shakier. */
    private readonly shakiness = 1,
  ) {}

  setColor(color: string): void {
    this.color = color;
  }

  /** Multiplies every width set from here on. Parts ask for widths in
   *  absolute terms; this lets one artist press harder than another without
   *  every part needing to know about it. */
  setWidthScale(scale: number): void {
    this.widthScale = scale;
  }

  setWidth(width: number): void {
    this.width = width * this.widthScale;
  }

  private clamp(p: Pt): Point {
    return {
      x: round4(Math.min(0.97, Math.max(0.03, p.x))),
      y: round4(Math.min(0.97, Math.max(0.03, p.y))),
    };
  }

  private commit(points: Pt[]): void {
    if (points.length < 2) return;
    this.strokes.push({
      color: this.color,
      // Same argument as the coordinates: every width here comes out of a
      // random range multiplied by a random scale, so it serialises as a full
      // double — twenty-odd characters, once per stroke, for differences far
      // below one screen pixel.
      width: Math.round(this.width * 100) / 100,
      points: points.map((p) => this.clamp(p)),
    });
  }

  /** Nudges a point slightly — humans don't land exactly where they aim. */
  private slop(p: Pt, amount = 0.008): Pt {
    return {
      x: p.x + this.rng.range(-amount, amount) * this.shakiness,
      y: p.y + this.rng.range(-amount, amount) * this.shakiness,
    };
  }

  /** Builds the wobbly path between two points without committing it, so
   *  callers can chain segments into one continuous stroke. */
  private linePoints(rawA: Pt, rawB: Pt, wobble: number): Pt[] {
    const a = this.slop(rawA);
    const b = this.slop(rawB);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1e-6;

    // Perpendicular unit vector — all deviation is sideways to the stroke.
    const px = -dy / dist;
    const py = dx / dist;

    const steps = Math.max(4, Math.round(dist * 55));
    const driftAmp = this.rng.range(-0.007, 0.007) * wobble * this.shakiness;
    const driftPhase = this.rng.range(0, Math.PI);
    const tremorAmp = 0.0016 * wobble * this.shakiness;

    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // sin(0)=sin(pi)=0 keeps the bow strongest mid-stroke, like a real arm.
      const drift = Math.sin(t * Math.PI + driftPhase * 0.15) * driftAmp;
      const tremor = this.rng.range(-tremorAmp, tremorAmp);
      const off = drift + tremor;
      out.push({ x: a.x + dx * t + px * off, y: a.y + dy * t + py * off });
    }
    return out;
  }

  line(a: Pt, b: Pt, wobble = 1): void {
    this.commit(this.linePoints(a, b, wobble));
  }

  /** Connected segments drawn without lifting the pen. */
  polyline(points: Pt[], close = false, wobble = 1): void {
    if (points.length < 2) return;
    const path = close ? [...points, points[0]] : points;
    const out: Pt[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const seg = this.linePoints(path[i], path[i + 1], wobble);
      out.push(...(i === 0 ? seg : seg.slice(1)));
    }
    if (close) {
      // Humans overshoot slightly when closing a shape back onto its start.
      const first = out[0];
      out.push(this.slop(first, 0.012));
    }
    this.commit(out);
  }

  rect(x: number, y: number, w: number, h: number, wobble = 1): void {
    this.polyline(
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      true,
      wobble,
    );
  }

  /** Ellipse that starts at a random angle and doesn't quite close — the
   *  single most recognizable "hand-drawn" tell. */
  ellipse(cx: number, cy: number, rx: number, ry: number, wobble = 1): void {
    const start = this.rng.range(0, Math.PI * 2);
    // Slight over- or under-shoot of a full turn leaves a gap or a crossover.
    const sweep = Math.PI * 2 + this.rng.range(-0.22, 0.28) * this.shakiness;
    const steps = Math.max(18, Math.round((rx + ry) * 120));

    const wobA = this.rng.range(-0.06, 0.06) * wobble * this.shakiness;
    const wobB = this.rng.range(-0.04, 0.04) * wobble * this.shakiness;
    const phaseA = this.rng.range(0, Math.PI * 2);
    const phaseB = this.rng.range(0, Math.PI * 2);

    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = start + sweep * t;
      // Two out-of-phase waves make the radius breathe unevenly.
      const rWob = 1 + Math.sin(ang * 2 + phaseA) * wobA + Math.sin(ang * 3 + phaseB) * wobB;
      out.push({
        x: cx + Math.cos(ang) * rx * rWob,
        y: cy + Math.sin(ang) * ry * rWob,
      });
    }
    this.commit(out);
  }

  circle(cx: number, cy: number, r: number, wobble = 1): void {
    this.ellipse(cx, cy, r, r, wobble);
  }

  arc(cx: number, cy: number, r: number, from: number, to: number, wobble = 1): void {
    const steps = Math.max(6, Math.round(Math.abs(to - from) * r * 90));
    const wobAmp = this.rng.range(-0.05, 0.05) * wobble * this.shakiness;
    const phase = this.rng.range(0, Math.PI * 2);
    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = from + (to - from) * t;
      const rWob = 1 + Math.sin(ang * 2.3 + phase) * wobAmp;
      out.push({ x: cx + Math.cos(ang) * r * rWob, y: cy + Math.sin(ang) * r * rWob });
    }
    this.commit(out);
  }

  /** Back-and-forth zigzag between two points — springs, saw teeth, scribble. */
  zigzag(a: Pt, b: Pt, teeth: number, amplitude: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const px = -dy / dist;
    const py = dx / dist;
    const pts: Pt[] = [];
    for (let i = 0; i <= teeth; i++) {
      const t = i / teeth;
      const side = i % 2 === 0 ? 1 : -1;
      const amp = i === 0 || i === teeth ? 0 : amplitude;
      pts.push({
        x: a.x + dx * t + px * amp * side,
        y: a.y + dy * t + py * amp * side,
      });
    }
    this.polyline(pts, false, 0.6);
  }

  /** Coil drawn as a continuous loopy path — springs, smoke, cords. */
  coil(x: number, yTop: number, yBottom: number, r: number, loops: number): void {
    const steps = loops * 16;
    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = t * loops * Math.PI * 2;
      out.push({
        x: x + Math.cos(ang) * r,
        y: yTop + (yBottom - yTop) * t + Math.sin(ang) * r * 0.35,
      });
    }
    this.commit(out);
  }

  /** Loose closed blob — clouds, smoke, puddles, splats. */
  blob(cx: number, cy: number, r: number, lumps: number): void {
    const steps = 40;
    const phase = this.rng.range(0, Math.PI * 2);
    const amp = this.rng.range(0.15, 0.32);
    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const rr = r * (1 + Math.sin(ang * lumps + phase) * amp);
      out.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr * 0.85 });
    }
    this.commit(out);
  }

  star(cx: number, cy: number, r: number, points = 5): void {
    const out: Pt[] = [];
    const start = this.rng.range(0, Math.PI);
    for (let i = 0; i <= points * 2; i++) {
      const ang = start + (i / (points * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      out.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr });
    }
    this.polyline(out, false, 0.5);
  }

  /** Straight shaft plus a two-line head. */
  arrow(a: Pt, b: Pt): void {
    this.line(a, b);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const headLen = 0.035;
    for (const spread of [2.6, -2.6]) {
      this.line(b, {
        x: b.x + Math.cos(ang + spread) * headLen,
        y: b.y + Math.sin(ang + spread) * headLen,
      });
    }
  }
}
