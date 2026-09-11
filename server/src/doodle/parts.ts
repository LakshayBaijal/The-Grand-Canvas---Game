import { Pen, Rng } from "./pen.js";

export type Box = { x: number; y: number; w: number; h: number };

// --- machine parts ---------------------------------------------------------
// Every drawing in this game is a piece of "homework", so a contraption body plus a
// handful of these details always reads as plausible, whatever the prompt.

export function machineBody(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 7));

  // Vary the silhouette so not every drawing is the same rectangle. The
  // outline is what a viewer registers first, so this matters more for
  // "that's a different drawing" than any amount of extra detailing does.
  const shape = rng.int(0, 6);
  if (shape <= 1) {
    pen.rect(box.x, box.y, box.w, box.h);
  } else if (shape === 2) {
    // Tapered console — wider at the base.
    pen.polyline(
      [
        { x: box.x + box.w * 0.12, y: box.y },
        { x: box.x + box.w * 0.88, y: box.y },
        { x: box.x + box.w, y: box.y + box.h },
        { x: box.x, y: box.y + box.h },
      ],
      true,
      0.9,
    );
  } else if (shape === 3) {
    // Rounded canister.
    pen.ellipse(box.x + box.w * 0.5, box.y + box.h * 0.5, box.w * 0.5, box.h * 0.5, 0.8);
  } else if (shape === 4) {
    // Stepped — a smaller unit bolted on top of a bigger one.
    const splitY = box.y + box.h * rng.range(0.3, 0.45);
    const topInset = box.w * rng.range(0.16, 0.3);
    pen.rect(box.x + topInset, box.y, box.w - topInset * 2, splitY - box.y);
    pen.rect(box.x, splitY, box.w, box.y + box.h - splitY);
  } else if (shape === 5) {
    // Dome top on a plain body.
    const domeY = box.y + box.h * rng.range(0.26, 0.38);
    pen.arc(box.x + box.w * 0.5, domeY, box.w * 0.5, Math.PI, Math.PI * 2, 0.8);
    pen.polyline(
      [
        { x: box.x, y: domeY },
        { x: box.x, y: box.y + box.h },
        { x: box.x + box.w, y: box.y + box.h },
        { x: box.x + box.w, y: domeY },
      ],
      false,
      0.9,
    );
  } else {
    // Angled corners — reads as moulded plastic rather than a crate.
    const c = Math.min(box.w, box.h) * rng.range(0.16, 0.28);
    pen.polyline(
      [
        { x: box.x + c, y: box.y },
        { x: box.x + box.w - c, y: box.y },
        { x: box.x + box.w, y: box.y + c },
        { x: box.x + box.w, y: box.y + box.h - c },
        { x: box.x + box.w - c, y: box.y + box.h },
        { x: box.x + c, y: box.y + box.h },
        { x: box.x, y: box.y + box.h - c },
        { x: box.x, y: box.y + c },
      ],
      true,
      0.85,
    );
  }

  // A seam or panel line across the body sells "manufactured object".
  if (rng.chance(0.7)) {
    pen.setWidth(rng.range(2.5, 3.5));
    const y = box.y + box.h * rng.range(0.28, 0.62);
    pen.line({ x: box.x + box.w * 0.08, y }, { x: box.x + box.w * 0.92, y }, 0.7);
  }
}

export function wheels(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 5));
  const r = Math.min(box.w, box.h) * rng.range(0.11, 0.16);
  const y = box.y + box.h + r * 0.65;
  for (const fx of [0.24, 0.76]) {
    const cx = box.x + box.w * fx;
    pen.circle(cx, y, r);
    if (rng.chance(0.6)) pen.circle(cx, y, r * 0.32);
  }
}

export function legs(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const bottom = box.y + box.h;
  for (const fx of [0.22, 0.78]) {
    const x = box.x + box.w * fx;
    const footY = bottom + rng.range(0.07, 0.12);
    pen.line({ x, y: bottom }, { x: x + rng.range(-0.02, 0.02), y: footY });
    pen.line({ x: x - 0.025, y: footY }, { x: x + 0.025, y: footY });
  }
}

export function antenna(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const x = box.x + box.w * rng.range(0.2, 0.8);
  const topY = box.y - rng.range(0.08, 0.15);
  pen.line({ x: box.x + box.w * 0.5, y: box.y }, { x, y: topY }, 0.8);
  pen.circle(x, topY - 0.012, rng.range(0.012, 0.02));
  // Signal waves radiating off the tip. Kept rare: these arcs are the single
  // most recognizable mark in the whole set, so they stop reading as detail
  // and start reading as "the same drawing" very quickly.
  if (rng.chance(0.2)) {
    pen.setWidth(2.5);
    for (let i = 1; i <= 2; i++) {
      pen.arc(x, topY - 0.012, 0.03 + i * 0.022, -2.5, -0.65, 0.6);
    }
  }
}

export function buttons(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.5, 3.5));
  const count = rng.int(2, 4);
  const y = box.y + box.h * rng.range(0.62, 0.82);
  for (let i = 0; i < count; i++) {
    const x = box.x + box.w * (0.2 + (i / Math.max(count - 1, 1)) * 0.6);
    pen.circle(x, y, rng.range(0.014, 0.022));
  }
}

export function dial(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const cx = box.x + box.w * rng.range(0.25, 0.75);
  const cy = box.y + box.h * rng.range(0.2, 0.45);
  const r = rng.range(0.035, 0.055);
  pen.circle(cx, cy, r);
  const ang = rng.range(-2.6, 0.4);
  pen.setWidth(2.5);
  pen.line({ x: cx, y: cy }, { x: cx + Math.cos(ang) * r * 0.75, y: cy + Math.sin(ang) * r * 0.75 });
}

export function screen(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const w = box.w * rng.range(0.4, 0.6);
  const h = box.h * rng.range(0.24, 0.36);
  const x = box.x + (box.w - w) * rng.range(0.2, 0.8);
  const y = box.y + box.h * rng.range(0.12, 0.25);
  pen.rect(x, y, w, h);
  // Squiggle standing in for readouts.
  pen.setWidth(2.2);
  pen.zigzag(
    { x: x + w * 0.12, y: y + h * 0.6 },
    { x: x + w * 0.88, y: y + h * 0.6 },
    rng.int(4, 7),
    h * 0.18,
  );
}

export function lever(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const side = rng.chance(0.5) ? -1 : 1;
  const baseX = side < 0 ? box.x : box.x + box.w;
  const baseY = box.y + box.h * rng.range(0.35, 0.6);
  const tipX = baseX + side * rng.range(0.07, 0.11);
  const tipY = baseY - rng.range(0.05, 0.1);
  pen.line({ x: baseX, y: baseY }, { x: tipX, y: tipY });
  pen.circle(tipX, tipY, rng.range(0.016, 0.024));
}

export function spring(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const x = box.x + box.w * rng.range(0.2, 0.8);
  pen.coil(x, box.y + box.h, box.y + box.h + rng.range(0.08, 0.14), rng.range(0.02, 0.032), rng.int(3, 5));
}

export function gear(pen: Pen, rng: Rng, cx: number, cy: number, r: number): void {
  pen.setWidth(rng.range(3, 4));
  pen.circle(cx, cy, r);
  pen.circle(cx, cy, r * 0.35);
  const teeth = rng.int(6, 9);
  pen.setWidth(2.5);
  for (let i = 0; i < teeth; i++) {
    const ang = (i / teeth) * Math.PI * 2;
    pen.line(
      { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r },
      { x: cx + Math.cos(ang) * r * 1.28, y: cy + Math.sin(ang) * r * 1.28 },
      0.5,
    );
  }
}

export function pipe(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 7));
  const side = rng.chance(0.5) ? -1 : 1;
  const startX = side < 0 ? box.x : box.x + box.w;
  const startY = box.y + box.h * rng.range(0.3, 0.6);
  const midX = startX + side * rng.range(0.08, 0.13);
  pen.polyline(
    [
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: startY - rng.range(0.08, 0.14) },
    ],
    false,
    0.8,
  );
}

/** Two eyes on the body — the cheapest way to turn an appliance into a
 *  character, and it changes the read of the whole drawing. */
export function eyes(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const cy = box.y + box.h * rng.range(0.2, 0.34);
  const r = Math.min(box.w, box.h) * rng.range(0.09, 0.14);
  const gap = box.w * rng.range(0.19, 0.28);
  const cx = box.x + box.w * 0.5;
  for (const side of [-1, 1]) {
    pen.circle(cx + side * gap, cy, r);
    // Pupils placed a hair off-centre so it looks at something.
    pen.circle(cx + side * gap + rng.range(-r * 0.3, r * 0.3), cy + rng.range(-r * 0.2, r * 0.2), r * 0.3);
  }
}

export function smoke(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const x = box.x + box.w * rng.range(0.22, 0.78);
  const stackTop = box.y - rng.range(0.035, 0.065);
  pen.rect(x - 0.02, stackTop, 0.04, box.y - stackTop);
  pen.setWidth(2.8);
  pen.coil(x, stackTop - 0.015, stackTop - rng.range(0.1, 0.17), rng.range(0.018, 0.03), rng.int(2, 4));
}

export function cord(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const side = rng.chance(0.5) ? -1 : 1;
  const startX = side < 0 ? box.x : box.x + box.w;
  const startY = box.y + box.h * rng.range(0.55, 0.8);
  const endX = startX + side * rng.range(0.1, 0.17);
  const endY = startY + rng.range(0.05, 0.1);
  // Sags in the middle the way a real cable does.
  pen.polyline(
    [
      { x: startX, y: startY },
      { x: startX + side * 0.05, y: startY + rng.range(0.05, 0.09) },
      { x: endX, y: endY },
    ],
    false,
    1.2,
  );
  pen.rect(endX - 0.018, endY, 0.036, 0.026);
  pen.setWidth(2.4);
  for (const o of [-0.008, 0.008]) {
    pen.line({ x: endX + o, y: endY + 0.026 }, { x: endX + o, y: endY + 0.042 }, 0.4);
  }
}

export function handle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  pen.arc(box.x + box.w * 0.5, box.y, box.w * rng.range(0.22, 0.34), Math.PI * 1.05, Math.PI * 1.95, 0.7);
}

/** Hopper on top — instantly says "you put something in here". */
export function funnel(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * rng.range(0.35, 0.65);
  const topW = box.w * rng.range(0.4, 0.62);
  const topY = box.y - rng.range(0.09, 0.15);
  pen.polyline(
    [
      { x: cx - topW / 2, y: topY },
      { x: cx - topW * 0.14, y: box.y },
      { x: cx + topW * 0.14, y: box.y },
      { x: cx + topW / 2, y: topY },
    ],
    false,
    0.8,
  );
}

export function robotArm(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const side = rng.chance(0.5) ? -1 : 1;
  const baseX = side < 0 ? box.x : box.x + box.w;
  const baseY = box.y + box.h * rng.range(0.25, 0.5);
  const elbowX = baseX + side * rng.range(0.08, 0.13);
  const elbowY = baseY - rng.range(0.02, 0.08);
  const handX = elbowX + side * rng.range(0.04, 0.08);
  const handY = elbowY + rng.range(0.03, 0.08);
  pen.polyline(
    [
      { x: baseX, y: baseY },
      { x: elbowX, y: elbowY },
      { x: handX, y: handY },
    ],
    false,
    0.8,
  );
  pen.setWidth(3);
  pen.line({ x: handX, y: handY }, { x: handX + side * 0.035, y: handY - 0.026 }, 0.6);
  pen.line({ x: handX, y: handY }, { x: handX + side * 0.035, y: handY + 0.02 }, 0.6);
}

export function conveyor(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const y = box.y + box.h + rng.range(0.035, 0.06);
  const x0 = box.x - rng.range(0.03, 0.08);
  const x1 = box.x + box.w + rng.range(0.03, 0.08);
  const r = rng.range(0.022, 0.032);
  pen.line({ x: x0, y }, { x: x1, y }, 0.8);
  pen.line({ x: x0, y: y + r * 2 }, { x: x1, y: y + r * 2 }, 0.8);
  for (const cx of [x0 + r, (x0 + x1) / 2, x1 - r]) pen.circle(cx, y + r, r * 0.8);
}

/** The universal "here's an idea" mark. */
export function lightbulb(pen: Pen, rng: Rng, cx: number, cy: number, r: number): void {
  pen.setWidth(rng.range(3.5, 4.5));
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  pen.rect(cx - r * 0.42, cy + r * 0.85, r * 0.84, r * 0.5);
  pen.setWidth(2.4);
  for (let i = 0; i < rng.int(3, 5); i++) {
    const ang = -Math.PI / 2 + (i - 1.5) * 0.55;
    pen.line(
      { x: cx + Math.cos(ang) * r * 1.4, y: cy + Math.sin(ang) * r * 1.4 },
      { x: cx + Math.cos(ang) * r * 1.9, y: cy + Math.sin(ang) * r * 1.9 },
      0.4,
    );
  }
}

export function motionLines(pen: Pen, rng: Rng, x: number, y: number, size: number, dir = -1): void {
  pen.setWidth(rng.range(2.4, 3.2));
  for (let i = 0; i < rng.int(2, 3); i++) {
    const yy = y + (i - 1) * size * 0.45;
    pen.line({ x, y: yy }, { x: x + dir * size * rng.range(0.6, 1), y: yy }, 0.5);
  }
}

export function exclaim(pen: Pen, rng: Rng, x: number, y: number, size: number): void {
  pen.setWidth(rng.range(3.5, 4.5));
  pen.line({ x, y: y - size }, { x: x + rng.range(-0.006, 0.006), y: y + size * 0.28 }, 0.5);
  pen.circle(x, y + size * 0.6, size * 0.09);
}

/** Sound radiating out of something — the "this is loud" mark. */
export function soundWaves(pen: Pen, rng: Rng, x: number, y: number, dir = 1): void {
  pen.setWidth(rng.range(2.4, 3));
  for (let i = 1; i <= 3; i++) {
    const r = 0.028 + i * 0.024;
    pen.arc(x, y, r, dir > 0 ? -1.05 : Math.PI - 1.05, dir > 0 ? 1.05 : Math.PI + 1.05, 0.6);
  }
}

export function face(pen: Pen, rng: Rng, cx: number, cy: number, r: number, happy: boolean): void {
  pen.setWidth(rng.range(3, 4));
  pen.circle(cx, cy, r);
  pen.setWidth(2.6);
  for (const side of [-1, 1]) pen.circle(cx + side * r * 0.36, cy - r * 0.22, r * 0.09);
  if (happy) pen.arc(cx, cy + r * 0.08, r * 0.5, 0.35, Math.PI - 0.35, 0.6);
  else pen.arc(cx, cy + r * 0.62, r * 0.5, -Math.PI + 0.35, -0.35, 0.6);
}

export function panelFrame(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.4));
  pen.rect(box.x, box.y, box.w, box.h, 1.1);
}

// --- everyday objects ------------------------------------------------------
// Ordinary things the prompts keep naming. A drawing built around one of
// these reads completely differently from a drawing built around a machine,
// which is most of what stops the bots repeating themselves.

export function mug(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const w = box.w * 0.6;
  const x = box.x + (box.w - w) / 2;
  pen.polyline(
    [
      { x, y: box.y },
      { x: x + w * 0.08, y: box.y + box.h },
      { x: x + w * 0.92, y: box.y + box.h },
      { x: x + w, y: box.y },
    ],
    false,
    0.8,
  );
  pen.line({ x, y: box.y }, { x: x + w, y: box.y }, 0.7);
  pen.setWidth(3.5);
  pen.arc(x + w, box.y + box.h * 0.42, box.h * 0.24, -1.3, 1.3, 0.7);
  pen.setWidth(2.6);
  for (const fx of [0.35, 0.62]) {
    pen.coil(x + w * fx, box.y - 0.015, box.y - rng.range(0.07, 0.11), 0.014, 2);
  }
}

export function bed(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const y = box.y + box.h * 0.45;
  pen.rect(box.x, y, box.w, box.h * 0.35);
  pen.polyline(
    [
      { x: box.x, y },
      { x: box.x, y: box.y },
      { x: box.x + box.w * 0.22, y: box.y },
    ],
    false,
    0.8,
  );
  pen.setWidth(3);
  pen.rect(box.x + box.w * 0.06, y - box.h * 0.11, box.w * 0.22, box.h * 0.13);
  for (const fx of [0.04, 0.94]) {
    pen.line(
      { x: box.x + box.w * fx, y: y + box.h * 0.35 },
      { x: box.x + box.w * fx, y: y + box.h * 0.52 },
      0.6,
    );
  }
}

export function umbrella(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.38;
  const r = box.w * 0.5;
  pen.arc(cx, cy, r, Math.PI, Math.PI * 2, 0.7);
  pen.setWidth(3);
  const scallops = 3;
  for (let i = 0; i < scallops; i++) {
    const x0 = cx - r + (i / scallops) * 2 * r;
    const x1 = cx - r + ((i + 1) / scallops) * 2 * r;
    pen.arc((x0 + x1) / 2, cy, (x1 - x0) / 2, 0, Math.PI, 0.6);
  }
  pen.setWidth(3.5);
  pen.line({ x: cx, y: cy }, { x: cx, y: box.y + box.h }, 0.8);
  pen.arc(cx - 0.024, box.y + box.h, 0.024, 0, Math.PI, 0.6);
}

export function phoneDevice(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.46;
  const h = box.h * 0.95;
  const x = box.x + (box.w - w) / 2;
  pen.rect(x, box.y, w, h);
  pen.setWidth(2.8);
  pen.rect(x + w * 0.12, box.y + h * 0.1, w * 0.76, h * 0.66);
  pen.circle(x + w * 0.5, box.y + h * 0.87, w * 0.1);
}

export function alarmClock(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.55;
  const r = Math.min(box.w, box.h) * 0.4;
  pen.circle(cx, cy, r);
  pen.setWidth(3.2);
  for (const side of [-1, 1]) pen.arc(cx + side * r * 0.78, cy - r * 0.72, r * 0.28, Math.PI, Math.PI * 2, 0.6);
  pen.setWidth(3);
  pen.line({ x: cx, y: cy }, { x: cx + r * 0.5, y: cy - r * 0.25 }, 0.5);
  pen.line({ x: cx, y: cy }, { x: cx - r * 0.12, y: cy - r * 0.62 }, 0.5);
  for (const side of [-1, 1]) {
    pen.line({ x: cx + side * r * 0.6, y: cy + r * 0.8 }, { x: cx + side * r * 0.9, y: cy + r * 1.08 }, 0.5);
  }
}

export function plant(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const potTop = box.y + box.h * 0.62;
  pen.polyline(
    [
      { x: box.x + box.w * 0.28, y: potTop },
      { x: box.x + box.w * 0.36, y: box.y + box.h },
      { x: box.x + box.w * 0.64, y: box.y + box.h },
      { x: box.x + box.w * 0.72, y: potTop },
    ],
    false,
    0.8,
  );
  pen.line({ x: box.x + box.w * 0.28, y: potTop }, { x: box.x + box.w * 0.72, y: potTop }, 0.7);
  pen.setWidth(3.2);
  const cx = box.x + box.w * 0.5;
  pen.line({ x: cx, y: potTop }, { x: cx, y: box.y + box.h * 0.14 }, 1.3);
  const leaves = rng.int(2, 4);
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const y = potTop - (i + 1) * (box.h * 0.15);
    pen.ellipse(cx + side * box.w * 0.15, y, box.w * 0.15, box.h * 0.055, 0.8);
  }
}

export function fan(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.4;
  const r = Math.min(box.w, box.h) * 0.42;
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  const spin = rng.range(0, Math.PI);
  for (let i = 0; i < 3; i++) {
    const ang = spin + (i / 3) * Math.PI * 2;
    pen.ellipse(cx + Math.cos(ang) * r * 0.5, cy + Math.sin(ang) * r * 0.5, r * 0.36, r * 0.2, 0.8);
  }
  pen.circle(cx, cy, r * 0.14);
  pen.setWidth(3.5);
  pen.line({ x: cx, y: cy + r }, { x: cx, y: box.y + box.h }, 0.8);
  pen.line({ x: cx - box.w * 0.16, y: box.y + box.h }, { x: cx + box.w * 0.16, y: box.y + box.h }, 0.6);
}

export function crate(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  pen.rect(box.x, box.y, box.w, box.h);
  pen.setWidth(2.8);
  pen.line({ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, 0.6);
  pen.line({ x: box.x + box.w, y: box.y }, { x: box.x, y: box.y + box.h }, 0.6);
}

export function sock(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.3;
  const x = box.x + box.w * 0.3;
  pen.polyline(
    [
      { x, y: box.y },
      { x: x + w, y: box.y },
      { x: x + w, y: box.y + box.h * 0.6 },
      { x: x + w * 2.0, y: box.y + box.h * 0.68 },
      { x: x + w * 2.1, y: box.y + box.h },
      { x, y: box.y + box.h },
    ],
    true,
    0.8,
  );
  pen.setWidth(2.6);
  pen.line({ x, y: box.y + box.h * 0.16 }, { x: x + w, y: box.y + box.h * 0.16 }, 0.5);
}

// --- topical extras --------------------------------------------------------

export function flames(pen: Pen, rng: Rng, cx: number, cy: number, size: number): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const count = rng.int(2, 3);
  for (let i = 0; i < count; i++) {
    const x = cx + rng.range(-size, size) * 0.8;
    const s = size * rng.range(0.6, 1.1);
    pen.polyline(
      [
        { x: x - s * 0.5, y: cy },
        { x: x - s * 0.2, y: cy - s * 0.9 },
        { x: x + s * 0.1, y: cy - s * 0.4 },
        { x: x + s * 0.35, y: cy - s * 1.2 },
        { x: x + s * 0.5, y: cy },
      ],
      false,
      0.7,
    );
  }
}

export function droplets(pen: Pen, rng: Rng, cx: number, cy: number, size: number): void {
  pen.setWidth(rng.range(3, 4));
  for (let i = 0; i < rng.int(3, 5); i++) {
    const x = cx + rng.range(-size * 1.6, size * 1.6);
    const y = cy + rng.range(-size * 0.6, size * 0.9);
    const s = size * rng.range(0.3, 0.5);
    pen.polyline(
      [
        { x, y: y - s * 1.6 },
        { x: x + s, y: y + s * 0.3 },
        { x, y: y + s },
        { x: x - s, y: y + s * 0.3 },
      ],
      true,
      0.6,
    );
  }
}

export function wings(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 5.5));
  const cy = box.y + box.h * 0.3;
  for (const side of [-1, 1]) {
    const baseX = side < 0 ? box.x : box.x + box.w;
    const span = rng.range(0.16, 0.22);
    const tipX = baseX + side * span;
    // Scalloped trailing edge reads as a wing rather than a fin.
    pen.polyline(
      [
        { x: baseX, y: cy },
        { x: baseX + side * span * 0.45, y: cy - rng.range(0.08, 0.12) },
        { x: tipX, y: cy - rng.range(0.02, 0.05) },
        { x: baseX + side * span * 0.6, y: cy + rng.range(0.05, 0.08) },
        { x: baseX, y: cy + 0.03 },
      ],
      false,
      0.7,
    );
    pen.setWidth(2.4);
    pen.line({ x: baseX + side * span * 0.2, y: cy }, { x: baseX + side * span * 0.55, y: cy - 0.02 }, 0.5);
    pen.setWidth(rng.range(4.5, 5.5));
  }
}

export function cloud(pen: Pen, rng: Rng, cx: number, cy: number, r: number): void {
  pen.setWidth(rng.range(3.5, 4.5));
  pen.blob(cx, cy, r, rng.int(4, 6));
}

export function stickPerson(pen: Pen, rng: Rng, x: number, feetY: number, height: number): void {
  pen.setWidth(rng.range(3, 4));
  const headR = height * 0.16;
  const headY = feetY - height + headR;
  pen.circle(x, headY, headR);
  const shoulderY = headY + headR * 1.4;
  const hipY = feetY - height * 0.38;
  pen.line({ x, y: shoulderY }, { x, y: hipY });
  // Arms and legs, each at a slightly random angle so poses vary.
  const armY = shoulderY + height * 0.12;
  pen.line({ x, y: armY }, { x: x - height * rng.range(0.18, 0.3), y: armY + height * rng.range(-0.14, 0.16) });
  pen.line({ x, y: armY }, { x: x + height * rng.range(0.18, 0.3), y: armY + height * rng.range(-0.14, 0.16) });
  pen.line({ x, y: hipY }, { x: x - height * rng.range(0.12, 0.2), y: feetY });
  pen.line({ x, y: hipY }, { x: x + height * rng.range(0.12, 0.2), y: feetY });
}

export function rocket(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const cx = box.x + box.w * 0.5;
  pen.polyline(
    [
      { x: cx, y: box.y - 0.02 },
      { x: box.x + box.w * 0.82, y: box.y + box.h * 0.35 },
      { x: box.x + box.w * 0.82, y: box.y + box.h },
      { x: box.x + box.w * 0.18, y: box.y + box.h },
      { x: box.x + box.w * 0.18, y: box.y + box.h * 0.35 },
    ],
    true,
    0.8,
  );
  pen.setWidth(3);
  pen.circle(cx, box.y + box.h * 0.42, Math.min(box.w, box.h) * 0.13);
}

export function foodStack(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const layers = rng.int(3, 4);
  for (let i = 0; i < layers; i++) {
    const y = box.y + box.h * (0.15 + (i / layers) * 0.7);
    const w = box.w * rng.range(0.65, 0.9);
    pen.arc(box.x + box.w * 0.5, y, w * 0.5, 0, Math.PI, 0.7);
    pen.line(
      { x: box.x + box.w * 0.5 - w * 0.5, y },
      { x: box.x + box.w * 0.5 + w * 0.5, y },
      0.6,
    );
  }
}

export function house(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const roofY = box.y + box.h * 0.38;
  pen.rect(box.x, roofY, box.w, box.h - (roofY - box.y));
  pen.polyline(
    [
      { x: box.x - 0.015, y: roofY },
      { x: box.x + box.w * 0.5, y: box.y },
      { x: box.x + box.w + 0.015, y: roofY },
    ],
    false,
    0.8,
  );
  pen.setWidth(3);
  const doorW = box.w * 0.22;
  pen.rect(box.x + box.w * 0.5 - doorW * 0.5, box.y + box.h * 0.72, doorW, box.h * 0.28);
}

export function car(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  pen.polyline(
    [
      { x: box.x, y: box.y + box.h },
      { x: box.x, y: box.y + box.h * 0.55 },
      { x: box.x + box.w * 0.25, y: box.y + box.h * 0.55 },
      { x: box.x + box.w * 0.38, y: box.y },
      { x: box.x + box.w * 0.72, y: box.y },
      { x: box.x + box.w * 0.85, y: box.y + box.h * 0.55 },
      { x: box.x + box.w, y: box.y + box.h * 0.55 },
      { x: box.x + box.w, y: box.y + box.h },
    ],
    false,
    0.8,
  );
  pen.setWidth(3.5);
  for (const fx of [0.26, 0.74]) {
    pen.circle(box.x + box.w * fx, box.y + box.h, Math.min(box.w, box.h) * 0.14);
  }
}

/** A pet, side on, standing: a dog most of the time, otherwise a cat. The
 *  old one was a lumpy blob with a circle on it, which is what "animal" looks
 *  like when nothing commits to a species. What sells each is small and
 *  specific — floppy ears and a snout, or pointed ears and whiskers. */
export function animal(pen: Pen, rng: Rng, box: Box): void {
  const cat = rng.chance(0.4);
  const u = Math.min(box.w, box.h);
  pen.setWidth(rng.range(4, 5));

  // Body: a long ellipse sitting in the lower half.
  const bx = box.x + box.w * 0.45;
  const by = box.y + box.h * 0.6;
  const brx = box.w * 0.32;
  const bry = box.h * 0.2;
  pen.ellipse(bx, by, brx, bry, 0.8);

  // Head, overlapping the front of the body.
  const headR = u * 0.17;
  const hx = box.x + box.w * 0.78;
  const hy = box.y + box.h * 0.36;
  pen.circle(hx, hy, headR);

  if (cat) {
    // Pointed ears.
    pen.setWidth(3.2);
    for (const side of [-1, 1]) {
      pen.polyline(
        [
          { x: hx + side * headR * 0.35, y: hy - headR * 0.85 },
          { x: hx + side * headR * 0.75, y: hy - headR * 1.6 },
          { x: hx + side * headR * 0.95, y: hy - headR * 0.35 },
        ],
        false,
        0.5,
      );
    }
    // Whiskers.
    pen.setWidth(2);
    for (const side of [-1, 1]) {
      for (const dy of [-0.05, 0.12]) {
        pen.line(
          { x: hx + side * headR * 0.45, y: hy + headR * (0.25 + dy) },
          { x: hx + side * headR * 1.5, y: hy + headR * (0.15 + dy * 2.5) },
          0.4,
        );
      }
    }
    // Tail curling up behind.
    pen.setWidth(3.5);
    pen.arc(box.x + box.w * 0.1, box.y + box.h * 0.42, u * 0.2, 0.3, 2.6, 0.7);
  } else {
    // Floppy ears: two lobes hanging off the top of the head.
    pen.setWidth(3.2);
    for (const side of [-1, 1]) {
      pen.ellipse(hx + side * headR * 0.85, hy - headR * 0.1, headR * 0.28, headR * 0.6, 0.6);
    }
    // Snout: a small rounded bump on the front, with a nose.
    pen.ellipse(hx + headR * 0.9, hy + headR * 0.25, headR * 0.45, headR * 0.32, 0.6);
    pen.setWidth(4);
    pen.circle(hx + headR * 1.25, hy + headR * 0.15, headR * 0.1);
    // Tail up, wagging.
    pen.setWidth(3.5);
    pen.arc(box.x + box.w * 0.12, box.y + box.h * 0.4, u * 0.18, -0.4, 1.6, 0.7);
  }

  // Eye.
  pen.setWidth(4);
  pen.circle(hx + headR * 0.3, hy - headR * 0.15, headR * 0.09);

  // Four legs, front pair and back pair, with little feet.
  pen.setWidth(3.4);
  const footY = by + bry + box.h * 0.16;
  for (const fx of [bx - brx * 0.7, bx - brx * 0.45, bx + brx * 0.45, bx + brx * 0.7]) {
    pen.line({ x: fx, y: by + bry * 0.6 }, { x: fx, y: footY }, 0.5);
    pen.line({ x: fx - u * 0.02, y: footY }, { x: fx + u * 0.035, y: footY }, 0.4);
  }
}

export function musicNotes(pen: Pen, rng: Rng, cx: number, cy: number, size: number): void {
  pen.setWidth(rng.range(3, 4));
  for (let i = 0; i < rng.int(2, 3); i++) {
    const x = cx + rng.range(-size * 1.5, size * 1.5);
    const y = cy + rng.range(-size, size);
    pen.circle(x, y, size * 0.3);
    pen.line({ x: x + size * 0.28, y }, { x: x + size * 0.28, y: y - size * 1.1 });
  }
}

export function sparkles(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2, 2.8));
  // Kept sparse and small — these are a garnish, not the subject.
  for (let i = 0; i < rng.int(2, 3); i++) {
    const x = box.x + rng.range(-0.06, box.w + 0.06);
    const y = box.y + rng.range(-0.09, box.h * 0.4);
    const r = rng.range(0.012, 0.02);
    // Four-point sparkle: two crossed strokes.
    pen.line({ x: x - r, y }, { x: x + r, y }, 0.4);
    pen.line({ x, y: y - r }, { x, y: y + r }, 0.4);
  }
}

export function zzz(pen: Pen, rng: Rng, cx: number, cy: number, size: number): void {
  pen.setWidth(3);
  for (let i = 0; i < 3; i++) {
    const s = size * (1 - i * 0.22);
    const x = cx + i * size * 0.7;
    const y = cy - i * size * 0.8;
    pen.polyline(
      [
        { x, y },
        { x: x + s, y },
        { x, y: y + s },
        { x: x + s, y: y + s },
      ],
      false,
      0.5,
    );
  }
}

export function dumbbell(pen: Pen, rng: Rng, cx: number, cy: number, size: number): void {
  pen.setWidth(rng.range(4, 5));
  pen.line({ x: cx - size, y: cy }, { x: cx + size, y: cy });
  for (const side of [-1, 1]) {
    pen.rect(cx + side * size - size * 0.18, cy - size * 0.35, size * 0.36, size * 0.7);
  }
}

export function coin(pen: Pen, rng: Rng, cx: number, cy: number, r: number): void {
  pen.setWidth(rng.range(3.5, 4.5));
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  pen.line({ x: cx, y: cy - r * 0.7 }, { x: cx, y: cy + r * 0.7 }, 0.5);
  pen.arc(cx, cy - r * 0.22, r * 0.38, Math.PI * 0.9, Math.PI * 2.1, 0.6);
  pen.arc(cx, cy + r * 0.22, r * 0.38, -Math.PI * 0.1, Math.PI * 1.1, 0.6);
}

// --- everyday objects, part two --------------------------------------------
// Named things the prompts actually produce. A drawing that opens with the
// object someone wrote about reads as "they understood the prompt" in a way
// no amount of extra machine detailing does.

export function keys(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  // Drawn side-on: bow, shaft, teeth. An earlier version hung two blades off a
  // ring and every single one read as a stick figure instead.
  const drawKey = (y: number, len: number, w: number) => {
    const bowR = box.h * 0.11;
    const x = box.x + box.w * 0.16;
    pen.circle(x, y, bowR);
    pen.circle(x, y, bowR * 0.42);
    const tipX = x + box.w * len;
    pen.line({ x: x + bowR, y }, { x: tipX, y }, 0.6);
    // Teeth hanging off the end of the shaft.
    pen.setWidth(w);
    for (let i = 0; i < 2; i++) {
      const tx = tipX - i * box.w * 0.09 - box.w * 0.02;
      pen.polyline(
        [
          { x: tx, y },
          { x: tx, y: y + box.h * 0.1 },
          { x: tx - box.w * 0.045, y: y + box.h * 0.1 },
          { x: tx - box.w * 0.045, y },
        ],
        false,
        0.5,
      );
    }
    pen.setWidth(rng.range(4, 5));
  };

  drawKey(box.y + box.h * 0.32, 0.68, 3.2);
  drawKey(box.y + box.h * 0.68, 0.52, 3);
  // The ring they're both on.
  pen.setWidth(3);
  pen.arc(box.x + box.w * 0.16, box.y + box.h * 0.5, box.h * 0.24, -1.9, 1.9, 0.8);
}

export function cables(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  // A knot: two long loops crossing over each other.
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  for (let i = 0; i < rng.int(2, 3); i++) {
    const rx = box.w * rng.range(0.22, 0.4);
    const ry = box.h * rng.range(0.2, 0.38);
    pen.ellipse(
      cx + rng.range(-box.w * 0.12, box.w * 0.12),
      cy + rng.range(-box.h * 0.12, box.h * 0.12),
      rx,
      ry,
      1.6,
    );
  }
  // A loose end trailing out of the tangle, with a plug.
  const endX = box.x + box.w * rng.range(0.75, 0.95);
  const endY = box.y + box.h * 0.85;
  pen.polyline([{ x: cx, y: cy }, { x: endX - 0.04, y: endY - 0.03 }, { x: endX, y: endY }], false, 1.4);
  pen.setWidth(3);
  pen.rect(endX - 0.016, endY, 0.032, 0.024);
}

export function wifiIcon(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.82;
  for (let i = 1; i <= 3; i++) {
    pen.arc(cx, cy, Math.min(box.w, box.h) * 0.16 * i, -Math.PI * 0.78, -Math.PI * 0.22, 0.6);
  }
  pen.circle(cx, cy, Math.min(box.w, box.h) * 0.045);
}

export function laptop(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const screenH = box.h * 0.62;
  pen.rect(box.x + box.w * 0.12, box.y, box.w * 0.76, screenH);
  pen.setWidth(2.6);
  pen.rect(box.x + box.w * 0.17, box.y + screenH * 0.12, box.w * 0.66, screenH * 0.7);
  // Keyboard deck, splayed slightly wider than the lid.
  pen.setWidth(rng.range(4, 5));
  pen.polyline(
    [
      { x: box.x + box.w * 0.12, y: box.y + screenH },
      { x: box.x, y: box.y + box.h },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x + box.w * 0.88, y: box.y + screenH },
    ],
    false,
    0.8,
  );
}

/** A toaster with a slice popped up. The old one was the slice alone — a
 *  dome on a rectangle — which at doodle size read as a window or a
 *  tombstone. The toaster is the recognisable part: the slots, the lever,
 *  and the bread sticking out of the top. */
export function toast(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.78;
  const x = box.x + (box.w - w) / 2;
  const topY = box.y + box.h * 0.42;
  const bottomY = box.y + box.h;
  const bodyH = bottomY - topY;

  // Body: rounded shoulders, straight sides, flat bottom.
  const r = w * 0.12;
  pen.polyline(
    [
      { x, y: topY + r },
      { x, y: bottomY },
      { x: x + w, y: bottomY },
      { x: x + w, y: topY + r },
    ],
    false,
    0.8,
  );
  pen.arc(x + r, topY + r, r, Math.PI, Math.PI * 1.5, 0.6);
  pen.arc(x + w - r, topY + r, r, Math.PI * 1.5, Math.PI * 2, 0.6);
  pen.line({ x: x + r, y: topY }, { x: x + w - r, y: topY }, 0.7);

  // Two slots along the top.
  pen.setWidth(3);
  for (const fx of [0.3, 0.62]) {
    pen.line({ x: x + w * (fx - 0.1), y: topY + bodyH * 0.06 }, { x: x + w * (fx + 0.18), y: topY + bodyH * 0.06 }, 0.5);
  }

  // The slice, popped up out of the first slot: domed top, straight sides.
  pen.setWidth(rng.range(3.6, 4.4));
  const sw = w * 0.34;
  const sx = x + w * 0.15;
  const sTop = box.y + box.h * 0.1;
  pen.arc(sx + sw * 0.5, sTop + sw * 0.4, sw * 0.5, Math.PI, Math.PI * 2, 0.7);
  pen.line({ x: sx, y: sTop + sw * 0.4 }, { x: sx, y: topY }, 0.6);
  pen.line({ x: sx + sw, y: sTop + sw * 0.4 }, { x: sx + sw, y: topY }, 0.6);

  // Lever on the side, and a cord trailing off.
  pen.setWidth(3.4);
  const lvY = topY + bodyH * 0.35;
  pen.line({ x: x + w, y: lvY }, { x: x + w + box.w * 0.08, y: lvY }, 0.5);
  pen.line({ x: x + w + box.w * 0.08, y: lvY - box.h * 0.04 }, { x: x + w + box.w * 0.08, y: lvY + box.h * 0.04 }, 0.5);
  pen.setWidth(2.4);
  pen.polyline(
    [
      { x: x + w * 0.85, y: bottomY },
      { x: x + w * 0.95, y: bottomY + box.h * 0.05 },
      { x: x + w * 1.1, y: bottomY + box.h * 0.03 },
    ],
    false,
    0.8,
  );
}

export function iceCream(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const coneTop = box.y + box.h * 0.45;
  pen.polyline(
    [
      { x: cx - box.w * 0.2, y: coneTop },
      { x: cx, y: box.y + box.h },
      { x: cx + box.w * 0.2, y: coneTop },
    ],
    false,
    0.8,
  );
  for (let i = 0; i < rng.int(1, 2); i++) {
    pen.blob(cx + rng.range(-0.02, 0.02), coneTop - box.h * (0.06 + i * 0.16), box.w * 0.21, 4);
  }
  // A drip, because it's always melting.
  pen.setWidth(3);
  pen.arc(cx - box.w * 0.16, coneTop + box.h * 0.06, box.w * 0.05, -Math.PI, 0, 0.6);
}

export function trafficLight(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.4;
  const x = box.x + (box.w - w) / 2;
  const h = box.h * 0.68;
  pen.rect(x, box.y, w, h);
  pen.setWidth(3);
  for (let i = 0; i < 3; i++) {
    pen.circle(x + w * 0.5, box.y + h * (0.2 + i * 0.3), w * 0.2);
  }
  pen.setWidth(rng.range(4, 5));
  pen.line({ x: x + w * 0.5, y: box.y + h }, { x: x + w * 0.5, y: box.y + box.h }, 0.8);
}

export function bicycle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const r = Math.min(box.w * 0.26, box.h * 0.4);
  const y = box.y + box.h - r;
  const leftX = box.x + r;
  const rightX = box.x + box.w - r;
  pen.circle(leftX, y, r);
  pen.circle(rightX, y, r);
  const midX = (leftX + rightX) / 2;
  const barY = y - r * 0.9;
  pen.polyline(
    [{ x: leftX, y }, { x: midX, y: barY }, { x: rightX, y }, { x: midX, y }, { x: leftX, y }],
    false,
    0.7,
  );
  // Handlebars and seat.
  pen.line({ x: rightX, y }, { x: rightX + 0.01, y: barY - 0.03 }, 0.6);
  pen.line({ x: rightX - 0.02, y: barY - 0.03 }, { x: rightX + 0.03, y: barY - 0.03 }, 0.5);
  pen.line({ x: midX - 0.025, y: barY }, { x: midX + 0.015, y: barY }, 0.5);
}

export function trashBin(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const topW = box.w * 0.6;
  const x = box.x + (box.w - topW) / 2;
  const lidY = box.y + box.h * 0.18;
  pen.polyline(
    [
      { x, y: lidY },
      { x: x + topW * 0.1, y: box.y + box.h },
      { x: x + topW * 0.9, y: box.y + box.h },
      { x: x + topW, y: lidY },
    ],
    false,
    0.8,
  );
  pen.line({ x: x - 0.015, y: lidY }, { x: x + topW + 0.015, y: lidY }, 0.6);
  pen.setWidth(3);
  pen.line({ x: x + topW * 0.42, y: box.y }, { x: x + topW * 0.58, y: box.y }, 0.5);
  pen.line({ x: x + topW * 0.5, y: box.y }, { x: x + topW * 0.5, y: lidY }, 0.5);
  for (const fx of [0.35, 0.65]) {
    pen.line(
      { x: x + topW * fx, y: lidY + box.h * 0.18 },
      { x: x + topW * fx, y: box.y + box.h - box.h * 0.08 },
      0.5,
    );
  }
}

export function washingMachine(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  pen.rect(box.x, box.y, box.w, box.h);
  pen.setWidth(3.5);
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.58;
  const r = Math.min(box.w, box.h) * 0.28;
  pen.circle(cx, cy, r);
  pen.circle(cx, cy, r * 0.62);
  pen.setWidth(2.6);
  pen.circle(box.x + box.w * 0.2, box.y + box.h * 0.16, box.w * 0.05);
  pen.line(
    { x: box.x + box.w * 0.4, y: box.y + box.h * 0.16 },
    { x: box.x + box.w * 0.82, y: box.y + box.h * 0.16 },
    0.5,
  );
}

export function shoppingBag(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.66;
  const x = box.x + (box.w - w) / 2;
  const topY = box.y + box.h * 0.28;
  pen.rect(x, topY, w, box.h - (topY - box.y));
  // Handles.
  pen.setWidth(3.2);
  for (const fx of [0.3, 0.7]) {
    pen.arc(x + w * fx, topY, w * 0.13, Math.PI, Math.PI * 2, 0.7);
  }
}

export function shoe(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const y = box.y + box.h * 0.72;
  pen.polyline(
    [
      { x: box.x + box.w * 0.12, y: box.y + box.h * 0.3 },
      { x: box.x + box.w * 0.32, y: box.y + box.h * 0.28 },
      { x: box.x + box.w * 0.5, y },
      { x: box.x + box.w * 0.88, y: y + box.h * 0.06 },
      { x: box.x + box.w * 0.9, y: box.y + box.h },
      { x: box.x + box.w * 0.12, y: box.y + box.h },
    ],
    true,
    0.8,
  );
  pen.setWidth(2.6);
  pen.line(
    { x: box.x + box.w * 0.12, y: box.y + box.h * 0.86 },
    { x: box.x + box.w * 0.9, y: box.y + box.h * 0.86 },
    0.5,
  );
}

export function bird(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.45;
  const cy = box.y + box.h * 0.6;
  pen.ellipse(cx, cy, box.w * 0.26, box.h * 0.2, 0.9);
  const headR = Math.min(box.w, box.h) * 0.14;
  const hx = cx + box.w * 0.26;
  const hy = cy - box.h * 0.18;
  pen.circle(hx, hy, headR);
  pen.setWidth(3);
  // Beak and tail.
  pen.polyline(
    [
      { x: hx + headR * 0.8, y: hy },
      { x: hx + headR * 1.9, y: hy + headR * 0.25 },
      { x: hx + headR * 0.8, y: hy + headR * 0.5 },
    ],
    false,
    0.5,
  );
  pen.polyline(
    [
      { x: cx - box.w * 0.26, y: cy },
      { x: cx - box.w * 0.46, y: cy - box.h * 0.12 },
      { x: cx - box.w * 0.44, y: cy + box.h * 0.1 },
    ],
    false,
    0.6,
  );
  pen.arc(cx, cy - box.h * 0.04, box.w * 0.16, 0.2, Math.PI - 0.2, 0.7);
  for (const side of [-1, 1]) {
    pen.line({ x: cx + side * 0.02, y: cy + box.h * 0.2 }, { x: cx + side * 0.02, y: box.y + box.h }, 0.5);
  }
}

export function tree(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.blob(cx, box.y + box.h * 0.34, Math.min(box.w, box.h) * 0.38, rng.int(4, 6));
  pen.setWidth(rng.range(4.5, 6));
  pen.line({ x: cx, y: box.y + box.h * 0.62 }, { x: cx, y: box.y + box.h }, 0.7);
  pen.setWidth(3);
  pen.line({ x: cx, y: box.y + box.h * 0.78 }, { x: cx - box.w * 0.12, y: box.y + box.h * 0.68 }, 0.6);
}

export function sun(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w, box.h) * 0.28;
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  const rays = rng.int(7, 9);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rng.range(0, 0.2);
    pen.line(
      { x: cx + Math.cos(a) * r * 1.3, y: cy + Math.sin(a) * r * 1.3 },
      { x: cx + Math.cos(a) * r * 1.75, y: cy + Math.sin(a) * r * 1.75 },
      0.4,
    );
  }
}

export function snowflake(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w, box.h) * 0.42;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    pen.line(
      { x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r },
      { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      0.5,
    );
    // Barbs near each tip.
    for (const dir of [-1, 1]) {
      const tx = cx + dir * Math.cos(a) * r * 0.68;
      const ty = cy + dir * Math.sin(a) * r * 0.68;
      for (const off of [0.5, -0.5]) {
        pen.line(
          { x: tx, y: ty },
          { x: tx + dir * Math.cos(a + off) * r * 0.28, y: ty + dir * Math.sin(a + off) * r * 0.28 },
          0.4,
        );
      }
    }
  }
}

export function chair(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const seatY = box.y + box.h * 0.52;
  pen.line({ x: box.x + box.w * 0.2, y: seatY }, { x: box.x + box.w * 0.8, y: seatY }, 0.7);
  pen.line({ x: box.x + box.w * 0.2, y: seatY }, { x: box.x + box.w * 0.24, y: box.y }, 0.7);
  pen.line({ x: box.x + box.w * 0.24, y: box.y }, { x: box.x + box.w * 0.4, y: box.y + 0.01 }, 0.6);
  for (const fx of [0.22, 0.78]) {
    pen.line({ x: box.x + box.w * fx, y: seatY }, { x: box.x + box.w * fx, y: box.y + box.h }, 0.7);
  }
}

export function door(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.58;
  const x = box.x + (box.w - w) / 2;
  pen.rect(x, box.y, w, box.h);
  pen.setWidth(3);
  pen.rect(x + w * 0.14, box.y + box.h * 0.08, w * 0.72, box.h * 0.42);
  pen.circle(x + w * 0.82, box.y + box.h * 0.62, w * 0.07);
}

export function bottle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const bw = box.w * 0.36;
  const neckW = bw * 0.36;
  const shoulderY = box.y + box.h * 0.3;
  pen.polyline(
    [
      { x: cx - neckW / 2, y: box.y },
      { x: cx - neckW / 2, y: shoulderY - box.h * 0.06 },
      { x: cx - bw / 2, y: shoulderY },
      { x: cx - bw / 2, y: box.y + box.h },
      { x: cx + bw / 2, y: box.y + box.h },
      { x: cx + bw / 2, y: shoulderY },
      { x: cx + neckW / 2, y: shoulderY - box.h * 0.06 },
      { x: cx + neckW / 2, y: box.y },
    ],
    false,
    0.8,
  );
  pen.setWidth(3);
  pen.rect(cx - neckW * 0.6, box.y - box.h * 0.05, neckW * 1.2, box.h * 0.06);
  pen.rect(cx - bw * 0.42, box.y + box.h * 0.55, bw * 0.84, box.h * 0.22);
}

export function ball(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w, box.h) * 0.4;
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  pen.arc(cx - r * 0.7, cy, r * 0.9, -1.0, 1.0, 0.7);
  pen.arc(cx + r * 0.7, cy, r * 0.9, Math.PI - 1.0, Math.PI + 1.0, 0.7);
}

export function envelope(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const h = box.h * 0.62;
  const y = box.y + (box.h - h) / 2;
  pen.rect(box.x, y, box.w, h);
  pen.setWidth(3);
  pen.polyline(
    [
      { x: box.x, y },
      { x: box.x + box.w * 0.5, y: y + h * 0.55 },
      { x: box.x + box.w, y },
    ],
    false,
    0.6,
  );
}

export function battery(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.7;
  const h = box.h * 0.42;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  pen.rect(x, y, w, h);
  pen.rect(x + w, y + h * 0.3, w * 0.08, h * 0.4);
  // Nearly flat, which is the only reason a battery ever gets drawn.
  pen.setWidth(3);
  pen.rect(x + w * 0.06, y + h * 0.18, w * 0.16, h * 0.64);
}

export function treadmill(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const deckY = box.y + box.h * 0.7;
  pen.polyline(
    [
      { x: box.x, y: box.y + box.h },
      { x: box.x + box.w * 0.08, y: deckY },
      { x: box.x + box.w * 0.78, y: deckY },
      { x: box.x + box.w * 0.86, y: box.y + box.h },
    ],
    false,
    0.8,
  );
  // Upright and console.
  pen.line({ x: box.x + box.w * 0.78, y: deckY }, { x: box.x + box.w * 0.9, y: box.y + box.h * 0.16 }, 0.8);
  pen.setWidth(3.2);
  pen.rect(box.x + box.w * 0.74, box.y, box.w * 0.26, box.h * 0.16);
  pen.line(
    { x: box.x + box.w * 0.6, y: box.y + box.h * 0.3 },
    { x: box.x + box.w * 0.88, y: box.y + box.h * 0.26 },
    0.6,
  );
}

export function stairs(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const steps = rng.int(3, 4);
  const pts: { x: number; y: number }[] = [{ x: box.x, y: box.y + box.h }];
  for (let i = 0; i < steps; i++) {
    const x = box.x + (box.w * i) / steps;
    const y = box.y + box.h - (box.h * (i + 1)) / steps;
    pts.push({ x, y });
    pts.push({ x: box.x + (box.w * (i + 1)) / steps, y });
  }
  pts.push({ x: box.x + box.w, y: box.y + box.h });
  pen.polyline(pts, true, 0.7);
}

export function speaker(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const x = box.x + box.w * 0.12;
  const midY = box.y + box.h * 0.5;
  pen.polyline(
    [
      { x, y: midY - box.h * 0.12 },
      { x: x + box.w * 0.14, y: midY - box.h * 0.12 },
      { x: x + box.w * 0.34, y: midY - box.h * 0.3 },
      { x: x + box.w * 0.34, y: midY + box.h * 0.3 },
      { x: x + box.w * 0.14, y: midY + box.h * 0.12 },
      { x, y: midY + box.h * 0.12 },
    ],
    true,
    0.8,
  );
  pen.setWidth(3);
  for (let i = 1; i <= 3; i++) {
    pen.arc(x + box.w * 0.36, midY, box.w * 0.12 * i, -1.0, 1.0, 0.6);
  }
}

export function suitcase(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const h = box.h * 0.6;
  const y = box.y + box.h * 0.32;
  pen.rect(box.x, y, box.w, h);
  pen.setWidth(3.2);
  pen.arc(box.x + box.w * 0.5, y, box.w * 0.16, Math.PI, Math.PI * 2, 0.7);
  pen.line({ x: box.x, y: y + h * 0.35 }, { x: box.x + box.w, y: y + h * 0.35 }, 0.5);
}

// --- more everyday objects --------------------------------------------------

export function glasses(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w * 0.22, box.h * 0.3);
  const gap = box.w * 0.06;
  pen.circle(box.x + box.w * 0.5 - r - gap / 2, cy, r);
  pen.circle(box.x + box.w * 0.5 + r + gap / 2, cy, r);
  pen.setWidth(3);
  pen.arc(box.x + box.w * 0.5, cy - r * 0.2, gap * 0.9, Math.PI, Math.PI * 2, 0.6);
  for (const side of [-1, 1]) {
    const x = box.x + box.w * 0.5 + side * (r * 2 + gap / 2);
    pen.line({ x, y: cy - r * 0.3 }, { x: x + side * box.w * 0.12, y: cy - r * 0.6 }, 0.6);
  }
}

export function toothbrush(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.rect(cx - box.w * 0.07, box.y + box.h * 0.18, box.w * 0.14, box.h * 0.8);
  pen.setWidth(3.2);
  pen.rect(cx - box.w * 0.11, box.y + box.h * 0.06, box.w * 0.22, box.h * 0.14);
  for (let i = 0; i < 4; i++) {
    const x = cx - box.w * 0.09 + (i / 3) * box.w * 0.18;
    pen.line({ x, y: box.y + box.h * 0.06 }, { x, y: box.y - box.h * 0.04 }, 0.4);
  }
}

export function kettle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.48;
  const bodyTop = box.y + box.h * 0.34;
  pen.polyline(
    [
      { x: cx - box.w * 0.24, y: bodyTop },
      { x: cx - box.w * 0.3, y: box.y + box.h },
      { x: cx + box.w * 0.3, y: box.y + box.h },
      { x: cx + box.w * 0.24, y: bodyTop },
    ],
    false,
    0.8,
  );
  pen.line({ x: cx - box.w * 0.24, y: bodyTop }, { x: cx + box.w * 0.24, y: bodyTop }, 0.6);
  pen.setWidth(3.4);
  pen.arc(cx, bodyTop, box.w * 0.2, Math.PI, Math.PI * 2, 0.7);
  // Spout, and steam because it's always boiling.
  pen.polyline(
    [
      { x: cx + box.w * 0.26, y: bodyTop + box.h * 0.14 },
      { x: cx + box.w * 0.42, y: bodyTop + box.h * 0.04 },
      { x: cx + box.w * 0.38, y: bodyTop + box.h * 0.2 },
    ],
    false,
    0.7,
  );
  pen.setWidth(2.6);
  pen.coil(cx + box.w * 0.42, bodyTop - box.h * 0.02, bodyTop - box.h * 0.3, box.w * 0.05, 2);
}

export function fridge(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.62;
  const x = box.x + (box.w - w) / 2;
  pen.rect(x, box.y, w, box.h);
  pen.setWidth(3);
  const splitY = box.y + box.h * 0.34;
  pen.line({ x, y: splitY }, { x: x + w, y: splitY }, 0.5);
  for (const y of [splitY - box.h * 0.08, splitY + box.h * 0.08]) {
    pen.line({ x: x + w * 0.78, y }, { x: x + w * 0.78, y: y + box.h * 0.12 }, 0.5);
  }
}

export function microwave(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const h = box.h * 0.6;
  const y = box.y + (box.h - h) / 2;
  pen.rect(box.x, y, box.w, h);
  pen.setWidth(3);
  pen.rect(box.x + box.w * 0.07, y + h * 0.14, box.w * 0.58, h * 0.72);
  for (let i = 0; i < 3; i++) {
    pen.circle(box.x + box.w * 0.82, y + h * (0.26 + i * 0.24), box.w * 0.035);
  }
}

export function television(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const h = box.h * 0.66;
  pen.rect(box.x, box.y, box.w, h);
  pen.setWidth(2.8);
  pen.zigzag(
    { x: box.x + box.w * 0.14, y: box.y + h * 0.55 },
    { x: box.x + box.w * 0.86, y: box.y + h * 0.5 },
    rng.int(5, 8),
    h * 0.14,
  );
  pen.setWidth(rng.range(3.5, 4.5));
  pen.line({ x: box.x + box.w * 0.5, y: box.y + h }, { x: box.x + box.w * 0.5, y: box.y + box.h * 0.9 }, 0.7);
  pen.line(
    { x: box.x + box.w * 0.3, y: box.y + box.h * 0.9 },
    { x: box.x + box.w * 0.7, y: box.y + box.h * 0.9 },
    0.6,
  );
}

export function book(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.28;
  const bottom = box.y + box.h * 0.8;
  // Two pages meeting at the spine.
  for (const side of [-1, 1]) {
    pen.polyline(
      [
        { x: cx, y: top },
        { x: cx + side * box.w * 0.42, y: top - box.h * 0.08 },
        { x: cx + side * box.w * 0.42, y: bottom - box.h * 0.06 },
        { x: cx, y: bottom },
      ],
      false,
      0.8,
    );
  }
  pen.line({ x: cx, y: top }, { x: cx, y: bottom }, 0.6);
  pen.setWidth(2.4);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const y = top + box.h * (0.12 + i * 0.14);
      pen.line({ x: cx + side * box.w * 0.08, y }, { x: cx + side * box.w * 0.34, y }, 0.4);
    }
  }
}

export function pencil(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const w = box.w * 0.16;
  const tipY = box.y + box.h * 0.86;
  pen.polyline(
    [
      { x: cx - w, y: box.y + box.h * 0.08 },
      { x: cx + w, y: box.y + box.h * 0.08 },
      { x: cx + w, y: tipY - box.h * 0.12 },
      { x: cx, y: tipY },
      { x: cx - w, y: tipY - box.h * 0.12 },
    ],
    true,
    0.8,
  );
  pen.setWidth(2.8);
  pen.line({ x: cx - w, y: box.y + box.h * 0.24 }, { x: cx + w, y: box.y + box.h * 0.24 }, 0.4);
  pen.line(
    { x: cx - w * 0.5, y: tipY - box.h * 0.06 },
    { x: cx + w * 0.5, y: tipY - box.h * 0.06 },
    0.4,
  );
}

export function scissors(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const cx = box.x + box.w * 0.5;
  const pivotY = box.y + box.h * 0.52;
  for (const side of [-1, 1]) {
    pen.line({ x: cx, y: pivotY }, { x: cx + side * box.w * 0.22, y: box.y }, 0.6);
    pen.ellipse(
      cx - side * box.w * 0.16,
      box.y + box.h * 0.85,
      box.w * 0.1,
      box.h * 0.12,
      0.8,
    );
    pen.line({ x: cx, y: pivotY }, { x: cx - side * box.w * 0.14, y: box.y + box.h * 0.75 }, 0.6);
  }
  pen.setWidth(2.6);
  pen.circle(cx, pivotY, box.w * 0.03);
}

export function hammer(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.rect(cx - box.w * 0.05, box.y + box.h * 0.24, box.w * 0.1, box.h * 0.72);
  pen.polyline(
    [
      { x: cx - box.w * 0.28, y: box.y + box.h * 0.1 },
      { x: cx + box.w * 0.24, y: box.y + box.h * 0.06 },
      { x: cx + box.w * 0.3, y: box.y + box.h * 0.24 },
      { x: cx - box.w * 0.2, y: box.y + box.h * 0.26 },
      { x: cx - box.w * 0.3, y: box.y + box.h * 0.18 },
    ],
    true,
    0.8,
  );
}

export function paintbrush(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.rect(cx - box.w * 0.05, box.y, box.w * 0.1, box.h * 0.56);
  pen.setWidth(3.2);
  pen.rect(cx - box.w * 0.08, box.y + box.h * 0.56, box.w * 0.16, box.h * 0.1);
  pen.polyline(
    [
      { x: cx - box.w * 0.08, y: box.y + box.h * 0.66 },
      { x: cx - box.w * 0.1, y: box.y + box.h * 0.94 },
      { x: cx + box.w * 0.1, y: box.y + box.h * 0.94 },
      { x: cx + box.w * 0.08, y: box.y + box.h * 0.66 },
    ],
    false,
    0.7,
  );
}

export function camera(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const h = box.h * 0.6;
  const y = box.y + box.h * 0.24;
  pen.rect(box.x, y, box.w, h);
  pen.setWidth(3.2);
  pen.rect(box.x + box.w * 0.28, y - h * 0.18, box.w * 0.24, h * 0.18);
  pen.circle(box.x + box.w * 0.5, y + h * 0.52, Math.min(box.w, h) * 0.24);
  pen.circle(box.x + box.w * 0.5, y + h * 0.52, Math.min(box.w, h) * 0.12);
  pen.setWidth(2.6);
  pen.circle(box.x + box.w * 0.84, y + h * 0.2, box.w * 0.035);
}

export function watch(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w, box.h) * 0.26;
  pen.circle(cx, cy, r);
  pen.setWidth(3);
  pen.line({ x: cx, y: cy }, { x: cx + r * 0.5, y: cy - r * 0.3 }, 0.4);
  pen.line({ x: cx, y: cy }, { x: cx, y: cy - r * 0.65 }, 0.4);
  pen.setWidth(rng.range(3.5, 4.5));
  for (const dir of [-1, 1]) {
    pen.polyline(
      [
        { x: cx - r * 0.55, y: cy + dir * r },
        { x: cx - r * 0.5, y: cy + dir * (r + box.h * 0.22) },
        { x: cx + r * 0.5, y: cy + dir * (r + box.h * 0.22) },
        { x: cx + r * 0.55, y: cy + dir * r },
      ],
      false,
      0.7,
    );
  }
}

export function broom(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.line({ x: cx + box.w * 0.12, y: box.y }, { x: cx - box.w * 0.06, y: box.y + box.h * 0.62 }, 0.8);
  pen.polyline(
    [
      { x: cx - box.w * 0.24, y: box.y + box.h * 0.66 },
      { x: cx + box.w * 0.12, y: box.y + box.h * 0.58 },
      { x: cx + box.w * 0.2, y: box.y + box.h },
      { x: cx - box.w * 0.3, y: box.y + box.h },
    ],
    true,
    0.8,
  );
  pen.setWidth(2.6);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    pen.line(
      { x: cx - box.w * 0.22 + t * box.w * 0.32, y: box.y + box.h * 0.7 },
      { x: cx - box.w * 0.26 + t * box.w * 0.44, y: box.y + box.h * 0.98 },
      0.4,
    );
  }
}

export function bucket(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const topW = box.w * 0.56;
  const topY = box.y + box.h * 0.3;
  pen.polyline(
    [
      { x: cx - topW / 2, y: topY },
      { x: cx - topW * 0.36, y: box.y + box.h },
      { x: cx + topW * 0.36, y: box.y + box.h },
      { x: cx + topW / 2, y: topY },
    ],
    false,
    0.8,
  );
  pen.ellipse(cx, topY, topW / 2, box.h * 0.06, 0.7);
  pen.setWidth(3.2);
  pen.arc(cx, topY, topW * 0.56, Math.PI * 1.05, Math.PI * 1.95, 0.7);
}

export function ladder(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const inset = box.w * 0.2;
  pen.line({ x: box.x + inset, y: box.y }, { x: box.x + inset * 0.4, y: box.y + box.h }, 0.7);
  pen.line(
    { x: box.x + box.w - inset, y: box.y },
    { x: box.x + box.w - inset * 0.4, y: box.y + box.h },
    0.7,
  );
  pen.setWidth(3.2);
  const rungs = rng.int(4, 5);
  for (let i = 0; i < rungs; i++) {
    const t = (i + 0.5) / rungs;
    const spread = inset * (1 - t * 0.6);
    pen.line(
      { x: box.x + spread, y: box.y + box.h * t },
      { x: box.x + box.w - spread, y: box.y + box.h * t },
      0.5,
    );
  }
}

export function trafficCone(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.polyline(
    [
      { x: cx - box.w * 0.1, y: box.y + box.h * 0.14 },
      { x: cx - box.w * 0.3, y: box.y + box.h * 0.84 },
      { x: cx + box.w * 0.3, y: box.y + box.h * 0.84 },
      { x: cx + box.w * 0.1, y: box.y + box.h * 0.14 },
    ],
    true,
    0.8,
  );
  pen.setWidth(3.2);
  pen.rect(cx - box.w * 0.38, box.y + box.h * 0.84, box.w * 0.76, box.h * 0.14);
  pen.setWidth(2.8);
  pen.line(
    { x: cx - box.w * 0.19, y: box.y + box.h * 0.46 },
    { x: cx + box.w * 0.19, y: box.y + box.h * 0.46 },
    0.4,
  );
}

export function lamp(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const shadeY = box.y + box.h * 0.34;
  pen.polyline(
    [
      { x: cx - box.w * 0.18, y: box.y + box.h * 0.06 },
      { x: cx - box.w * 0.34, y: shadeY },
      { x: cx + box.w * 0.34, y: shadeY },
      { x: cx + box.w * 0.18, y: box.y + box.h * 0.06 },
    ],
    true,
    0.8,
  );
  pen.line({ x: cx, y: shadeY }, { x: cx, y: box.y + box.h * 0.9 }, 0.7);
  pen.setWidth(3.4);
  pen.ellipse(cx, box.y + box.h * 0.94, box.w * 0.2, box.h * 0.05, 0.7);
}

export function tap(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 5.5));
  const x = box.x + box.w * 0.24;
  pen.polyline(
    [
      { x, y: box.y + box.h * 0.66 },
      { x, y: box.y + box.h * 0.2 },
      { x: box.x + box.w * 0.66, y: box.y + box.h * 0.2 },
      { x: box.x + box.w * 0.66, y: box.y + box.h * 0.42 },
    ],
    false,
    0.8,
  );
  pen.setWidth(3.4);
  pen.line({ x: x - box.w * 0.12, y: box.y + box.h * 0.36 }, { x: x + box.w * 0.12, y: box.y + box.h * 0.36 }, 0.5);
  pen.line({ x, y: box.y + box.h * 0.36 }, { x, y: box.y + box.h * 0.26 }, 0.5);
  // The drip, which is the whole reason a tap gets drawn.
  pen.setWidth(3);
  for (let i = 0; i < rng.int(2, 3); i++) {
    const y = box.y + box.h * (0.56 + i * 0.16);
    const s = box.h * 0.05;
    pen.polyline(
      [
        { x: box.x + box.w * 0.66, y: y - s },
        { x: box.x + box.w * 0.66 + s * 0.7, y: y + s * 0.3 },
        { x: box.x + box.w * 0.66, y: y + s },
        { x: box.x + box.w * 0.66 - s * 0.7, y: y + s * 0.3 },
      ],
      true,
      0.5,
    );
  }
}

export function plate(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.52;
  const cy = box.y + box.h * 0.5;
  pen.ellipse(cx, cy, box.w * 0.34, box.h * 0.3, 0.8);
  pen.setWidth(3);
  pen.ellipse(cx, cy, box.w * 0.24, box.h * 0.2, 0.8);
  // Fork alongside.
  const fx = box.x + box.w * 0.1;
  pen.line({ x: fx, y: cy - box.h * 0.28 }, { x: fx, y: cy + box.h * 0.3 }, 0.6);
  pen.setWidth(2.4);
  for (const off of [-0.022, 0, 0.022]) {
    pen.line({ x: fx + off, y: cy - box.h * 0.28 }, { x: fx + off, y: cy - box.h * 0.08 }, 0.4);
  }
}

export function pan(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.42;
  const topY = box.y + box.h * 0.44;
  pen.polyline(
    [
      { x: cx - box.w * 0.28, y: topY },
      { x: cx - box.w * 0.22, y: box.y + box.h * 0.86 },
      { x: cx + box.w * 0.22, y: box.y + box.h * 0.86 },
      { x: cx + box.w * 0.28, y: topY },
    ],
    false,
    0.8,
  );
  pen.line({ x: cx - box.w * 0.28, y: topY }, { x: cx + box.w * 0.28, y: topY }, 0.6);
  pen.setWidth(4.4);
  pen.line({ x: cx + box.w * 0.28, y: topY + box.h * 0.05 }, { x: box.x + box.w, y: topY - box.h * 0.02 }, 0.7);
  pen.setWidth(2.6);
  for (const fx of [-0.12, 0.06]) {
    pen.coil(cx + box.w * fx, topY - box.h * 0.03, topY - box.h * 0.28, box.w * 0.04, 2);
  }
}

export function backpack(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.56;
  const x = box.x + (box.w - w) / 2;
  const topY = box.y + box.h * 0.18;
  pen.polyline(
    [
      { x, y: box.y + box.h },
      { x, y: topY },
      { x: x + w * 0.5, y: box.y + box.h * 0.04 },
      { x: x + w, y: topY },
      { x: x + w, y: box.y + box.h },
    ],
    true,
    0.8,
  );
  pen.setWidth(3);
  pen.rect(x + w * 0.16, box.y + box.h * 0.58, w * 0.68, box.h * 0.28);
  pen.arc(x + w * 0.5, topY + box.h * 0.06, w * 0.3, 0.2, Math.PI - 0.2, 0.6);
}

export function hat(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const brimY = box.y + box.h * 0.66;
  pen.arc(cx, brimY, box.w * 0.26, Math.PI, Math.PI * 2, 0.8);
  pen.setWidth(rng.range(4, 5.5));
  pen.arc(cx, brimY, box.w * 0.46, 0, Math.PI, 0.7);
  pen.line({ x: cx - box.w * 0.46, y: brimY }, { x: cx + box.w * 0.46, y: brimY }, 0.6);
  pen.setWidth(3);
  pen.line({ x: cx - box.w * 0.26, y: brimY - box.h * 0.06 }, { x: cx + box.w * 0.26, y: brimY - box.h * 0.06 }, 0.5);
}

export function pill(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const rx = box.w * 0.34;
  const ry = box.h * 0.17;
  pen.ellipse(cx, cy, rx, ry, 0.8);
  pen.setWidth(3);
  pen.line({ x: cx, y: cy - ry }, { x: cx, y: cy + ry }, 0.5);
}

export function calendar(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  pen.rect(box.x, box.y + box.h * 0.14, box.w, box.h * 0.8);
  pen.setWidth(3.2);
  pen.line(
    { x: box.x, y: box.y + box.h * 0.36 },
    { x: box.x + box.w, y: box.y + box.h * 0.36 },
    0.5,
  );
  for (const fx of [0.26, 0.74]) {
    pen.line({ x: box.x + box.w * fx, y: box.y + box.h * 0.14 }, { x: box.x + box.w * fx, y: box.y }, 0.5);
  }
  pen.setWidth(2.4);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      pen.circle(
        box.x + box.w * (0.24 + c * 0.26),
        box.y + box.h * (0.52 + r * 0.24),
        box.w * 0.035,
      );
    }
  }
}

export function signpost(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  pen.line({ x: cx, y: box.y + box.h * 0.18 }, { x: cx, y: box.y + box.h }, 0.7);
  pen.rect(box.x + box.w * 0.14, box.y, box.w * 0.72, box.h * 0.26);
  pen.setWidth(2.6);
  for (let i = 0; i < 2; i++) {
    pen.zigzag(
      { x: box.x + box.w * 0.24, y: box.y + box.h * (0.09 + i * 0.09) },
      { x: box.x + box.w * 0.76, y: box.y + box.h * (0.09 + i * 0.09) },
      rng.int(5, 8),
      box.h * 0.012,
    );
  }
}

// --- more ways for a machine to stand --------------------------------------

export function treads(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const y = box.y + box.h;
  const r = Math.min(box.w, box.h) * 0.13;
  pen.polyline(
    [
      { x: box.x + box.w * 0.1, y: y + r * 0.2 },
      { x: box.x + box.w * 0.9, y: y + r * 0.2 },
      { x: box.x + box.w * 0.9, y: y + r * 1.8 },
      { x: box.x + box.w * 0.1, y: y + r * 1.8 },
    ],
    true,
    0.8,
  );
  pen.setWidth(2.6);
  for (let i = 0; i < 4; i++) {
    pen.circle(box.x + box.w * (0.2 + i * 0.2), y + r, r * 0.42);
  }
}

export function tripod(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const bottom = box.y + box.h;
  const cx = box.x + box.w * 0.5;
  for (const fx of [0.2, 0.5, 0.8]) {
    pen.line(
      { x: cx, y: bottom },
      { x: box.x + box.w * fx, y: bottom + rng.range(0.08, 0.13) },
      0.7,
    );
  }
}

export function skids(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const bottom = box.y + box.h;
  const footY = bottom + rng.range(0.07, 0.11);
  for (const fx of [0.24, 0.76]) {
    pen.line({ x: box.x + box.w * fx, y: bottom }, { x: box.x + box.w * fx, y: footY }, 0.6);
  }
  pen.polyline(
    [
      { x: box.x + box.w * 0.1, y: footY },
      { x: box.x + box.w * 0.9, y: footY },
      { x: box.x + box.w * 1.02, y: footY - 0.03 },
    ],
    false,
    0.7,
  );
}

export function plinth(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const bottom = box.y + box.h;
  const h = rng.range(0.05, 0.08);
  pen.polyline(
    [
      { x: box.x + box.w * 0.16, y: bottom },
      { x: box.x - box.w * 0.04, y: bottom + h },
      { x: box.x + box.w * 1.04, y: bottom + h },
      { x: box.x + box.w * 0.84, y: bottom },
    ],
    false,
    0.8,
  );
}

/** Not standing on anything — a puff of exhaust and some motion lines under it. */
export function hover(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.4));
  const bottom = box.y + box.h;
  for (let i = 0; i < rng.int(2, 3); i++) {
    const y = bottom + 0.03 + i * 0.028;
    const inset = box.w * (0.1 + i * 0.12);
    pen.line({ x: box.x + inset, y }, { x: box.x + box.w - inset, y }, 0.5);
  }
}

export function pole(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 5.5));
  const cx = box.x + box.w * 0.5;
  const bottom = box.y + box.h;
  const footY = bottom + rng.range(0.1, 0.15);
  pen.line({ x: cx, y: bottom }, { x: cx, y: footY }, 0.7);
  pen.setWidth(3.4);
  pen.ellipse(cx, footY, box.w * 0.22, 0.016, 0.7);
}

// --- more fittings to bolt on ----------------------------------------------

export function vent(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.4));
  const w = box.w * rng.range(0.24, 0.36);
  const x = box.x + (box.w - w) * rng.range(0.15, 0.85);
  const y = box.y + box.h * rng.range(0.5, 0.72);
  for (let i = 0; i < rng.int(3, 4); i++) {
    pen.line({ x, y: y + i * box.h * 0.07 }, { x: x + w, y: y + i * box.h * 0.07 }, 0.4);
  }
}

export function hatch(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 4));
  const cx = box.x + box.w * rng.range(0.28, 0.72);
  const cy = box.y + box.h * rng.range(0.3, 0.62);
  const r = Math.min(box.w, box.h) * rng.range(0.14, 0.2);
  pen.circle(cx, cy, r);
  pen.setWidth(2.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    pen.circle(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72, r * 0.12);
  }
}

export function nameplate(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.2));
  const w = box.w * rng.range(0.34, 0.5);
  const h = box.h * 0.14;
  const x = box.x + (box.w - w) * rng.range(0.2, 0.8);
  const y = box.y + box.h * rng.range(0.55, 0.78);
  pen.rect(x, y, w, h);
  pen.setWidth(2.2);
  pen.zigzag({ x: x + w * 0.1, y: y + h * 0.55 }, { x: x + w * 0.9, y: y + h * 0.55 }, rng.int(6, 10), h * 0.14);
}

export function hose(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const side = rng.chance(0.5) ? -1 : 1;
  const x = side < 0 ? box.x : box.x + box.w;
  const y = box.y + box.h * rng.range(0.3, 0.6);
  pen.coil(x + side * 0.06, y, y + rng.range(0.08, 0.14), rng.range(0.02, 0.032), rng.int(2, 4));
}

export function nozzle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * rng.range(0.3, 0.7);
  const y = box.y + box.h;
  pen.polyline(
    [
      { x: cx - box.w * 0.1, y },
      { x: cx - box.w * 0.05, y: y + 0.05 },
      { x: cx + box.w * 0.05, y: y + 0.05 },
      { x: cx + box.w * 0.1, y },
    ],
    false,
    0.7,
  );
  // Spray cone.
  pen.setWidth(2.6);
  for (const off of [-0.05, 0, 0.05]) {
    pen.line({ x: cx, y: y + 0.055 }, { x: cx + off, y: y + 0.11 }, 0.5);
  }
}

export function crank(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const side = rng.chance(0.5) ? -1 : 1;
  const x = side < 0 ? box.x : box.x + box.w;
  const y = box.y + box.h * rng.range(0.35, 0.65);
  pen.circle(x, y, box.w * 0.05);
  pen.polyline(
    [
      { x, y },
      { x: x + side * box.w * 0.16, y: y - box.h * 0.04 },
      { x: x + side * box.w * 0.16, y: y - box.h * 0.16 },
    ],
    false,
    0.7,
  );
  pen.circle(x + side * box.w * 0.16, y - box.h * 0.18, box.w * 0.035);
}

export function propeller(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const cx = box.x + box.w * rng.range(0.35, 0.65);
  const cy = box.y - box.h * 0.08;
  pen.line({ x: cx, y: box.y }, { x: cx, y: cy }, 0.6);
  for (const dir of [-1, 1]) {
    pen.ellipse(cx + dir * box.w * 0.16, cy, box.w * 0.16, box.h * 0.04, 0.8);
  }
  pen.circle(cx, cy, box.w * 0.03);
}

export function solarPanel(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.2, 4));
  const w = box.w * rng.range(0.4, 0.6);
  const cx = box.x + box.w * rng.range(0.3, 0.7);
  const y = box.y - rng.range(0.05, 0.09);
  pen.polyline(
    [
      { x: cx - w / 2, y },
      { x: cx + w / 2, y: y - 0.025 },
      { x: cx + w / 2 + 0.02, y: y + 0.02 },
      { x: cx - w / 2 + 0.02, y: y + 0.045 },
    ],
    true,
    0.7,
  );
  pen.setWidth(2.2);
  for (const t of [0.33, 0.66]) {
    pen.line({ x: cx - w / 2 + w * t, y: y - 0.025 * t }, { x: cx - w / 2 + w * t + 0.02, y: y + 0.02 + 0.025 * (1 - t) }, 0.4);
  }
  pen.setWidth(rng.range(3.2, 4));
  pen.line({ x: cx, y: y + 0.03 }, { x: cx, y: box.y }, 0.6);
}

export function bellOnTop(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const cx = box.x + box.w * rng.range(0.3, 0.7);
  const r = Math.min(box.w, box.h) * 0.14;
  pen.arc(cx, box.y - r * 0.2, r, Math.PI, Math.PI * 2, 0.7);
  pen.line({ x: cx - r, y: box.y - r * 0.2 }, { x: cx + r, y: box.y - r * 0.2 }, 0.6);
  pen.setWidth(2.6);
  pen.circle(cx, box.y - r * 0.02, r * 0.16);
}

export function tank(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const side = rng.chance(0.5) ? -1 : 1;
  const w = box.w * 0.2;
  const h = box.h * rng.range(0.4, 0.6);
  const x = side < 0 ? box.x - w - 0.015 : box.x + box.w + 0.015;
  const y = box.y + box.h * 0.3;
  pen.rect(x, y, w, h);
  pen.ellipse(x + w / 2, y, w / 2, h * 0.08, 0.7);
  pen.setWidth(3);
  pen.line({ x: side < 0 ? x + w : x, y: y + h * 0.4 }, { x: side < 0 ? box.x : box.x + box.w, y: y + h * 0.5 }, 0.7);
}

// --- more everyday objects -------------------------------------------------
// Words people actually type ("the queue", "splitting the bill", "flatpack
// furniture") had no shape of their own and fell through to a generic
// contraption, which is most of why drawings started to look alike.
//
// Silhouette first, as with keys(): each of these has to read at thumbnail
// size, side-on, before any detail goes on it.

type XY = { x: number; y: number };

export function receipt(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.5, 4.5));
  const w = box.w * 0.44;
  const x = box.x + (box.w - w) / 2;
  const top = box.y + box.h * 0.04;
  const bottom = box.y + box.h * 0.82;

  // The torn bottom edge is the whole tell — a plain rectangle is just paper.
  const teeth: XY[] = [{ x, y: top }, { x: x + w, y: top }, { x: x + w, y: bottom }];
  const n = 5;
  for (let i = n; i >= 0; i--) {
    teeth.push({ x: x + (w * i) / n, y: bottom + (i % 2 === 0 ? 0.012 : 0) });
  }
  pen.polyline(teeth, true, 0.7);

  pen.setWidth(2.2);
  for (let i = 0; i < rng.int(3, 5); i++) {
    const ly = top + box.h * (0.16 + i * 0.13);
    pen.line({ x: x + w * 0.14, y: ly }, { x: x + w * rng.range(0.6, 0.86), y: ly }, 0.4);
  }
}

export function piggyBank(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.5;
  const r = Math.min(box.w, box.h) * 0.34;
  pen.ellipse(cx, cy, r * 1.25, r, 0.9);
  pen.setWidth(3.2);
  // Snout, ear, slot on the back, and four stubby legs.
  pen.ellipse(cx + r * 1.2, cy + r * 0.1, r * 0.22, r * 0.18, 0.7);
  pen.polyline([{ x: cx + r * 0.3, y: cy - r * 0.85 }, { x: cx + r * 0.62, y: cy - r * 1.15 }, { x: cx + r * 0.7, y: cy - r * 0.7 }], true, 0.6);
  pen.line({ x: cx - r * 0.25, y: cy - r * 0.92 }, { x: cx + r * 0.1, y: cy - r * 0.95 }, 0.5);
  for (const f of [-0.7, -0.25, 0.3, 0.72]) {
    pen.line({ x: cx + r * f, y: cy + r * 0.85 }, { x: cx + r * f, y: cy + r * 1.3 }, 0.6);
  }
  pen.circle(cx - r * 1.05, cy - r * 0.05, r * 0.09);
}

export function creditCard(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.6, 4.6));
  const w = box.w * 0.7;
  const h = w * 0.62;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  pen.rect(x, y, w, h, 0.9);
  pen.setWidth(2.6);
  pen.rect(x + w * 0.08, y + h * 0.18, w * 0.16, h * 0.22, 0.6); // chip
  for (let i = 0; i < 2; i++) {
    pen.line({ x: x + w * 0.08, y: y + h * (0.62 + i * 0.16) }, { x: x + w * rng.range(0.6, 0.9), y: y + h * (0.62 + i * 0.16) }, 0.4);
  }
}

export function trolley(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const x = box.x + box.w * 0.16;
  const y = box.y + box.h * 0.28;
  const w = box.w * 0.6;
  const h = box.h * 0.36;
  // Basket tapers outward toward the top.
  pen.polyline(
    [{ x, y }, { x: x + w, y }, { x: x + w * 0.86, y: y + h }, { x: x + w * 0.14, y: y + h }],
    true,
    0.8,
  );
  pen.setWidth(2.4);
  for (const t of [0.3, 0.55, 0.8]) {
    pen.line({ x: x + w * t, y: y }, { x: x + w * (0.14 + t * 0.72), y: y + h }, 0.4);
  }
  pen.setWidth(3.4);
  pen.polyline([{ x, y }, { x: x - box.w * 0.12, y: y - box.h * 0.16 }], false, 0.6);
  pen.line({ x: x + w * 0.14, y: y + h }, { x: x + w * 0.14, y: y + h * 1.4 }, 0.6);
  pen.line({ x: x + w * 0.86, y: y + h }, { x: x + w * 0.86, y: y + h * 1.4 }, 0.6);
  pen.setWidth(3);
  pen.circle(x + w * 0.16, y + h * 1.5, box.h * 0.045);
  pen.circle(x + w * 0.84, y + h * 1.5, box.h * 0.045);
}

export function printer(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const x = box.x + box.w * 0.18;
  const y = box.y + box.h * 0.34;
  const w = box.w * 0.64;
  const h = box.h * 0.4;
  pen.rect(x, y, w, h, 0.9);
  // Jammed sheet crumpling out of the top is the joke.
  pen.setWidth(3.2);
  pen.polyline(
    [
      { x: x + w * 0.26, y },
      { x: x + w * 0.3, y: y - box.h * 0.24 },
      { x: x + w * 0.52, y: y - box.h * 0.3 },
      { x: x + w * 0.7, y: y - box.h * 0.14 },
      { x: x + w * 0.72, y },
    ],
    false,
    1.2,
  );
  pen.setWidth(2.4);
  pen.line({ x: x + w * 0.14, y: y + h * 0.72 }, { x: x + w * 0.86, y: y + h * 0.72 }, 0.4);
  pen.circle(x + w * 0.84, y + h * 0.3, Math.min(w, h) * 0.06);
}

export function gameController(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.5;
  const w = box.w * 0.62;
  const h = box.h * 0.3;
  pen.polyline(
    [
      { x: cx - w / 2, y: cy - h * 0.1 },
      { x: cx - w * 0.28, y: cy - h * 0.62 },
      { x: cx + w * 0.28, y: cy - h * 0.62 },
      { x: cx + w / 2, y: cy - h * 0.1 },
      { x: cx + w * 0.34, y: cy + h * 0.7 },
      { x: cx + w * 0.1, y: cy + h * 0.2 },
      { x: cx - w * 0.1, y: cy + h * 0.2 },
      { x: cx - w * 0.34, y: cy + h * 0.7 },
    ],
    true,
    0.9,
  );
  pen.setWidth(2.6);
  pen.line({ x: cx - w * 0.3, y: cy - h * 0.1 }, { x: cx - w * 0.12, y: cy - h * 0.1 }, 0.4);
  pen.line({ x: cx - w * 0.21, y: cy - h * 0.32 }, { x: cx - w * 0.21, y: cy + h * 0.12 }, 0.4);
  pen.circle(cx + w * 0.2, cy - h * 0.22, Math.min(w, h) * 0.07);
  pen.circle(cx + w * 0.32, cy + h * 0.02, Math.min(w, h) * 0.07);
}

export function wrench(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const len = Math.min(box.w, box.h) * 0.78;
  const ang = rng.range(-0.9, -0.5);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const shaftW = len * 0.13;
  const px = -dy * shaftW;
  const py = dx * shaftW;
  const ax = cx - (dx * len) / 2;
  const ay = cy - (dy * len) / 2;
  const bx = cx + (dx * len) / 2;
  const by = cy + (dy * len) / 2;
  pen.polyline(
    [
      { x: ax + px, y: ay + py },
      { x: bx + px, y: by + py },
      { x: bx - px, y: by - py },
      { x: ax - px, y: ay - py },
    ],
    true,
    0.7,
  );
  // Open C-jaws at both ends.
  for (const [ex, ey, dir] of [[ax, ay, -1], [bx, by, 1]] as const) {
    const jr = shaftW * 1.9;
    pen.arc(ex + dx * dir * jr * 0.4, ey + dy * dir * jr * 0.4, jr, ang + dir * 0.8, ang + dir * 5.5, 0.7);
  }
}

export function padlock(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const w = box.w * 0.4;
  const h = box.h * 0.34;
  const y = box.y + box.h * 0.44;
  pen.rect(cx - w / 2, y, w, h, 0.9);
  pen.setWidth(3.6);
  pen.arc(cx, y, w * 0.32, Math.PI, Math.PI * 2, 0.8);
  pen.setWidth(2.6);
  pen.circle(cx, y + h * 0.42, Math.min(w, h) * 0.12);
  pen.line({ x: cx, y: y + h * 0.5 }, { x: cx, y: y + h * 0.75 }, 0.5);
}

export function thermometer(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.6, 4.6));
  const cx = box.x + box.w / 2;
  const top = box.y + box.h * 0.14;
  const bottom = box.y + box.h * 0.76;
  const r = Math.min(box.w, box.h) * 0.1;
  pen.line({ x: cx - r * 0.5, y: top }, { x: cx - r * 0.5, y: bottom }, 0.5);
  pen.line({ x: cx + r * 0.5, y: top }, { x: cx + r * 0.5, y: bottom }, 0.5);
  pen.arc(cx, top, r * 0.5, Math.PI, Math.PI * 2, 0.6);
  pen.circle(cx, bottom + r, r);
  pen.setWidth(2.2);
  for (let i = 0; i < 4; i++) {
    const ty = top + (bottom - top) * (0.2 + i * 0.18);
    pen.line({ x: cx + r * 0.5, y: ty }, { x: cx + r * 1.3, y: ty }, 0.4);
  }
}

export function wineGlass(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.6, 4.6));
  const cx = box.x + box.w / 2;
  const top = box.y + box.h * 0.2;
  const bowl = box.h * 0.3;
  const r = Math.min(box.w, box.h) * 0.22;
  pen.polyline(
    [{ x: cx - r, y: top }, { x: cx - r * 0.75, y: top + bowl * 0.8 }, { x: cx, y: top + bowl }, { x: cx + r * 0.75, y: top + bowl * 0.8 }, { x: cx + r, y: top }],
    false,
    0.8,
  );
  pen.line({ x: cx - r, y: top }, { x: cx + r, y: top }, 0.5);
  pen.line({ x: cx, y: top + bowl }, { x: cx, y: top + bowl + box.h * 0.24 }, 0.5);
  pen.line({ x: cx - r * 0.7, y: top + bowl + box.h * 0.24 }, { x: cx + r * 0.7, y: top + bowl + box.h * 0.24 }, 0.5);
}

export function cake(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const w = box.w * 0.56;
  const h = box.h * 0.3;
  const y = box.y + box.h * 0.46;
  pen.rect(cx - w / 2, y, w, h, 0.9);
  pen.setWidth(3);
  // Icing drips along the top edge.
  const drip: XY[] = [];
  for (let i = 0; i <= 6; i++) {
    drip.push({ x: cx - w / 2 + (w * i) / 6, y: y + (i % 2 === 0 ? 0 : h * 0.22) });
  }
  pen.polyline(drip, false, 0.7);
  for (const f of [-0.28, 0, 0.28]) {
    pen.line({ x: cx + w * f, y: y }, { x: cx + w * f, y: y - h * 0.5 }, 0.6);
    pen.setWidth(2.4);
    pen.polyline([{ x: cx + w * f - 0.008, y: y - h * 0.5 }, { x: cx + w * f, y: y - h * 0.72 }, { x: cx + w * f + 0.008, y: y - h * 0.5 }], false, 0.8);
    pen.setWidth(3);
  }
}

export function pram(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const x = box.x + box.w * 0.2;
  const y = box.y + box.h * 0.3;
  const w = box.w * 0.54;
  const h = box.h * 0.32;
  pen.arc(x + w * 0.5, y + h, w * 0.5, Math.PI, Math.PI * 2, 0.9);
  pen.line({ x, y: y + h }, { x: x + w, y: y + h }, 0.6);
  pen.setWidth(3.4);
  pen.arc(x + w * 0.5, y + h, w * 0.5, Math.PI * 1.05, Math.PI * 1.55, 0.8);
  pen.polyline([{ x: x + w, y: y + h * 0.2 }, { x: x + w * 1.35, y: y + h * 0.6 }], false, 0.6);
  pen.setWidth(3);
  pen.circle(x + w * 0.22, y + h * 1.42, box.h * 0.055);
  pen.circle(x + w * 0.78, y + h * 1.42, box.h * 0.055);
}

export function guitar(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.42;
  const cy = box.y + box.h * 0.62;
  const r = Math.min(box.w, box.h) * 0.24;
  pen.ellipse(cx, cy + r * 0.5, r * 0.95, r * 0.8, 0.9);
  pen.ellipse(cx, cy - r * 0.55, r * 0.72, r * 0.62, 0.9);
  pen.setWidth(3);
  pen.circle(cx, cy - r * 0.15, r * 0.26);
  pen.setWidth(3.4);
  const nx = cx + r * 1.4;
  const ny = cy - r * 1.9;
  pen.line({ x: cx, y: cy - r * 1.1 }, { x: nx, y: ny }, 0.5);
  pen.rect(nx - r * 0.12, ny - r * 0.42, r * 0.34, r * 0.44, 0.7);
}

export function washingLine(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.4, 4.2));
  const y = box.y + box.h * 0.24;
  const x0 = box.x + box.w * 0.05;
  const x1 = box.x + box.w * 0.95;
  // Sag in the middle, or it reads as a shelf.
  pen.polyline([{ x: x0, y }, { x: (x0 + x1) / 2, y: y + box.h * 0.09 }, { x: x1, y }], false, 0.8);
  const n = rng.int(3, 4);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.4);
    const hx = x0 + (x1 - x0) * t;
    const hy = y + Math.sin(t * Math.PI) * box.h * 0.09;
    const w = box.w * rng.range(0.1, 0.15);
    const h = box.h * rng.range(0.2, 0.32);
    pen.setWidth(3);
    pen.polyline(
      [{ x: hx - w / 2, y: hy }, { x: hx - w / 2, y: hy + h }, { x: hx + w / 2, y: hy + h }, { x: hx + w / 2, y: hy }],
      false,
      0.8,
    );
  }
}

export function windowFrame(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.62;
  const h = box.h * 0.56;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.18;
  pen.rect(x, y, w, h, 0.9);
  pen.setWidth(3);
  pen.line({ x: x + w / 2, y }, { x: x + w / 2, y: y + h }, 0.5);
  pen.line({ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }, 0.5);
  pen.setWidth(2.4);
  // Rain streaks on the glass.
  for (let i = 0; i < rng.int(2, 4); i++) {
    const rx = x + w * rng.range(0.08, 0.92);
    const ry = y + h * rng.range(0.1, 0.5);
    pen.line({ x: rx, y: ry }, { x: rx - 0.006, y: ry + h * 0.24 }, 0.5);
  }
}

export function teapot(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.56;
  const r = Math.min(box.w, box.h) * 0.28;
  pen.ellipse(cx, cy, r * 1.1, r * 0.85, 0.9);
  pen.setWidth(3.2);
  pen.polyline([{ x: cx - r * 1.05, y: cy - r * 0.2 }, { x: cx - r * 1.7, y: cy - r * 0.55 }, { x: cx - r * 1.75, y: cy + r * 0.1 }], false, 0.9);
  pen.arc(cx + r * 1.15, cy, r * 0.45, -Math.PI * 0.5, Math.PI * 0.5, 0.8);
  pen.line({ x: cx - r * 0.35, y: cy - r * 0.82 }, { x: cx + r * 0.35, y: cy - r * 0.82 }, 0.5);
  pen.circle(cx, cy - r * 0.98, r * 0.14);
}

export function helmet(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.56;
  const r = Math.min(box.w, box.h) * 0.3;
  pen.arc(cx, cy, r, Math.PI, Math.PI * 2, 0.9);
  pen.line({ x: cx - r, y: cy }, { x: cx + r, y: cy }, 0.6);
  pen.setWidth(3);
  pen.line({ x: cx - r * 1.25, y: cy }, { x: cx + r * 1.25, y: cy }, 0.6);
  pen.arc(cx, cy - r * 0.1, r * 0.55, Math.PI * 1.15, Math.PI * 1.85, 0.6);
}

export function snowman(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const base = box.y + box.h * 0.86;
  const r = Math.min(box.w, box.h) * 0.22;
  pen.circle(cx, base - r, r);
  pen.circle(cx, base - r * 2.6, r * 0.72);
  pen.circle(cx, base - r * 3.9, r * 0.5);
  pen.setWidth(2.6);
  pen.line({ x: cx - r * 0.5, y: base - r * 4.35 }, { x: cx + r * 0.5, y: base - r * 4.35 }, 0.5);
  pen.rect(cx - r * 0.34, base - r * 4.95, r * 0.68, r * 0.6, 0.7);
  pen.line({ x: cx - r * 0.68, y: base - r * 2.7 }, { x: cx - r * 1.5, y: base - r * 3.2 }, 0.6);
  pen.line({ x: cx + r * 0.68, y: base - r * 2.7 }, { x: cx + r * 1.5, y: base - r * 3.2 }, 0.6);
  for (let i = 0; i < 3; i++) pen.circle(cx, base - r * (2.2 + i * 0.42), r * 0.07);
}

export function queue(pen: Pen, rng: Rng, box: Box): void {
  // A line of people, receding. Reads as "waiting" far better than one figure.
  const n = rng.int(3, 4);
  const feetY = box.y + box.h * 0.92;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const x = box.x + box.w * (0.15 + t * 0.7);
    stickPerson(pen, rng, x, feetY - box.h * t * 0.08, box.h * (0.6 - t * 0.1));
  }
}

export function toolbox(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.6;
  const h = box.h * 0.32;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.46;
  pen.rect(x, y, w, h, 0.9);
  pen.setWidth(3.4);
  pen.arc(x + w / 2, y, w * 0.26, Math.PI, Math.PI * 2, 0.8);
  pen.setWidth(2.6);
  pen.line({ x, y: y + h * 0.4 }, { x: x + w, y: y + h * 0.4 }, 0.4);
  pen.rect(x + w * 0.4, y + h * 0.55, w * 0.2, h * 0.22, 0.6);
}

export function clipboard(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.8, 4.8));
  const w = box.w * 0.46;
  const h = box.h * 0.6;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.2;
  pen.rect(x, y, w, h, 0.9);
  pen.setWidth(3);
  pen.rect(x + w * 0.34, y - h * 0.08, w * 0.32, h * 0.11, 0.7);
  pen.setWidth(2.2);
  for (let i = 0; i < rng.int(3, 5); i++) {
    const ly = y + h * (0.22 + i * 0.16);
    pen.line({ x: x + w * 0.14, y: ly }, { x: x + w * rng.range(0.6, 0.88), y: ly }, 0.4);
    if (rng.chance(0.4)) pen.rect(x + w * 0.06, ly - h * 0.035, w * 0.06, h * 0.07, 0.5);
  }
}

export function sprayBottle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.45;
  const w = box.w * 0.26;
  const h = box.h * 0.42;
  const y = box.y + box.h * 0.42;
  pen.rect(cx - w / 2, y, w, h, 0.9);
  pen.setWidth(3.2);
  pen.polyline(
    [
      { x: cx - w * 0.3, y },
      { x: cx - w * 0.3, y: y - h * 0.3 },
      { x: cx + w * 0.6, y: y - h * 0.3 },
      { x: cx + w * 0.6, y: y - h * 0.12 },
    ],
    false,
    0.8,
  );
  pen.setWidth(2.4);
  // Mist puffing out of the nozzle.
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.35;
    pen.line(
      { x: cx + w * 0.7, y: y - h * 0.22 },
      { x: cx + w * 0.7 + Math.cos(a) * box.w * 0.16, y: y - h * 0.22 + Math.sin(a) * box.h * 0.14 },
      0.5,
    );
  }
}

export function fireExtinguisher(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const w = box.w * 0.24;
  const h = box.h * 0.46;
  const y = box.y + box.h * 0.36;
  pen.polyline(
    [{ x: cx - w / 2, y: y + h }, { x: cx - w / 2, y: y + h * 0.12 }, { x: cx - w * 0.2, y }, { x: cx + w * 0.2, y }, { x: cx + w / 2, y: y + h * 0.12 }, { x: cx + w / 2, y: y + h }],
    true,
    0.8,
  );
  pen.setWidth(3);
  pen.line({ x: cx - w * 0.3, y: y - h * 0.12 }, { x: cx + w * 0.5, y: y - h * 0.12 }, 0.5);
  pen.polyline([{ x: cx + w * 0.5, y: y - h * 0.1 }, { x: cx + w * 1.1, y: y + h * 0.14 }], false, 0.7);
  pen.setWidth(2.4);
  pen.rect(cx - w * 0.32, y + h * 0.4, w * 0.64, h * 0.26, 0.6);
}

export function mirror(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.48;
  const rx = box.w * 0.24;
  const ry = box.h * 0.32;
  pen.ellipse(cx, cy, rx, ry, 0.9);
  pen.setWidth(2.6);
  pen.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0.8);
  // Two shine strokes across the glass.
  pen.line({ x: cx - rx * 0.4, y: cy + ry * 0.2 }, { x: cx + rx * 0.1, y: cy - ry * 0.45 }, 0.5);
  pen.line({ x: cx - rx * 0.05, y: cy + ry * 0.4 }, { x: cx + rx * 0.35, y: cy - ry * 0.1 }, 0.5);
  pen.setWidth(3.4);
  pen.line({ x: cx, y: cy + ry }, { x: cx, y: cy + ry * 1.5 }, 0.6);
  pen.line({ x: cx - rx * 0.5, y: cy + ry * 1.5 }, { x: cx + rx * 0.5, y: cy + ry * 1.5 }, 0.6);
}

// --- more machine fittings -------------------------------------------------
// These go in the `details` pool rather than being called from a layout, so
// they don't stack on top of the pool's own odds — the mistake that made the
// antenna show up in 56% of drawings.

export function rivets(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2, 2.6));
  const n = rng.int(3, 5);
  const edge = rng.chance(0.5);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = edge ? box.x + box.w * 0.06 : box.x + box.w * t;
    const y = edge ? box.y + box.h * t : box.y + box.h * 0.08;
    pen.circle(x, y, Math.min(box.w, box.h) * 0.022);
  }
}

export function gauge(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.8, 3.6));
  const r = Math.min(box.w, box.h) * rng.range(0.13, 0.18);
  const cx = box.x + box.w * rng.range(0.2, 0.8);
  const cy = box.y + box.h * rng.range(0.25, 0.6);
  pen.arc(cx, cy + r * 0.3, r, Math.PI, Math.PI * 2, 0.7);
  pen.line({ x: cx - r, y: cy + r * 0.3 }, { x: cx + r, y: cy + r * 0.3 }, 0.5);
  pen.setWidth(2.2);
  const a = rng.range(Math.PI * 1.15, Math.PI * 1.85);
  pen.line({ x: cx, y: cy + r * 0.3 }, { x: cx + Math.cos(a) * r * 0.8, y: cy + r * 0.3 + Math.sin(a) * r * 0.8 }, 0.4);
  for (const ta of [1.2, 1.5, 1.8]) {
    pen.line(
      { x: cx + Math.cos(Math.PI * ta) * r * 0.82, y: cy + r * 0.3 + Math.sin(Math.PI * ta) * r * 0.82 },
      { x: cx + Math.cos(Math.PI * ta) * r, y: cy + r * 0.3 + Math.sin(Math.PI * ta) * r },
      0.3,
    );
  }
}

export function toggleSwitch(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.4));
  const w = box.w * 0.1;
  const h = box.h * 0.12;
  const x = box.x + box.w * rng.range(0.15, 0.8);
  const y = box.y + box.h * rng.range(0.3, 0.7);
  pen.rect(x, y, w, h, 0.7);
  pen.setWidth(2.8);
  const up = rng.chance(0.5);
  pen.line({ x: x + w / 2, y: y + h / 2 }, { x: x + w / 2 + w * 0.3, y: up ? y - h * 0.5 : y + h * 1.4 }, 0.5);
}

export function chimney(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 3.8));
  const w = box.w * rng.range(0.1, 0.16);
  const x = box.x + box.w * rng.range(0.15, 0.7);
  const h = box.h * rng.range(0.18, 0.3);
  pen.rect(x, box.y - h, w, h, 0.8);
  pen.line({ x: x - w * 0.16, y: box.y - h }, { x: x + w * 1.16, y: box.y - h }, 0.5);
}

export function clawGrabber(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 3.8));
  const side = rng.chance(0.5) ? -1 : 1;
  const x = side < 0 ? box.x : box.x + box.w;
  const y = box.y + box.h * rng.range(0.25, 0.5);
  const len = box.w * rng.range(0.22, 0.34);
  const tipX = x + side * len;
  pen.line({ x, y }, { x: tipX, y: y + box.h * 0.12 }, 0.7);
  pen.setWidth(2.6);
  for (const s of [-1, 1]) {
    pen.polyline(
      [
        { x: tipX, y: y + box.h * 0.12 },
        { x: tipX + side * box.w * 0.06, y: y + box.h * (0.12 + s * 0.09) },
        { x: tipX + side * box.w * 0.02, y: y + box.h * (0.12 + s * 0.17) },
      ],
      false,
      0.7,
    );
  }
}

export function sirenLight(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 3.8));
  const cx = box.x + box.w * rng.range(0.25, 0.75);
  const r = Math.min(box.w, box.h) * 0.08;
  pen.arc(cx, box.y, r, Math.PI, Math.PI * 2, 0.7);
  pen.line({ x: cx - r, y: box.y }, { x: cx + r, y: box.y }, 0.5);
  pen.setWidth(2.2);
  for (const s of [-1, 1]) {
    for (let i = 1; i <= 2; i++) {
      pen.line(
        { x: cx + s * r * (1.4 + i * 0.5), y: box.y - r * (0.3 + i * 0.35) },
        { x: cx + s * r * (1.9 + i * 0.5), y: box.y - r * (0.5 + i * 0.45) },
        0.4,
      );
    }
  }
}

export function keypad(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.4, 3));
  const w = box.w * rng.range(0.22, 0.3);
  const h = box.h * rng.range(0.24, 0.32);
  const x = box.x + (box.w - w) * rng.range(0.15, 0.85);
  const y = box.y + box.h * rng.range(0.35, 0.6);
  pen.rect(x, y, w, h, 0.7);
  pen.setWidth(1.9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      pen.circle(x + w * (0.22 + c * 0.28), y + h * (0.22 + r * 0.28), Math.min(w, h) * 0.06);
    }
  }
}

export function slot(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.8, 3.4));
  const w = box.w * rng.range(0.3, 0.44);
  const x = box.x + (box.w - w) * rng.range(0.2, 0.8);
  const y = box.y + box.h * rng.range(0.4, 0.75);
  pen.rect(x, y, w, box.h * 0.06, 0.6);
  if (rng.chance(0.5)) {
    // Something halfway out of it.
    pen.setWidth(2.4);
    pen.rect(x + w * 0.2, y - box.h * 0.12, w * 0.5, box.h * 0.14, 0.7);
  }
}

export function beltDrive(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(2.6, 3.2));
  const y = box.y + box.h * rng.range(0.45, 0.7);
  const r = Math.min(box.w, box.h) * 0.09;
  const x0 = box.x + box.w * 0.2;
  const x1 = box.x + box.w * 0.72;
  pen.circle(x0, y, r);
  pen.circle(x1, y, r * 0.7);
  pen.line({ x: x0, y: y - r }, { x: x1, y: y - r * 0.7 }, 0.4);
  pen.line({ x: x0, y: y + r }, { x: x1, y: y + r * 0.7 }, 0.4);
}

// --- more things to stand on -----------------------------------------------

export function stilts(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 3.8));
  const y = box.y + box.h;
  const drop = box.h * rng.range(0.3, 0.5);
  for (const f of [0.2, 0.8]) {
    const x = box.x + box.w * f;
    pen.line({ x, y }, { x: x + rng.range(-0.02, 0.02), y: y + drop }, 0.8);
    pen.line({ x: x - box.w * 0.05, y: y + drop }, { x: x + box.w * 0.05, y: y + drop }, 0.5);
  }
  pen.setWidth(2.4);
  pen.line({ x: box.x + box.w * 0.2, y: y + drop * 0.55 }, { x: box.x + box.w * 0.8, y: y + drop * 0.45 }, 0.5);
}

export function railTrack(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3, 3.8));
  const y = box.y + box.h + box.h * 0.1;
  const x0 = box.x - box.w * 0.08;
  const x1 = box.x + box.w * 1.08;
  pen.line({ x: x0, y }, { x: x1, y }, 0.5);
  pen.line({ x: x0, y: y + box.h * 0.07 }, { x: x1, y: y + box.h * 0.07 }, 0.5);
  pen.setWidth(2.2);
  for (let i = 0; i <= 5; i++) {
    const x = x0 + ((x1 - x0) * i) / 5;
    pen.line({ x, y: y - box.h * 0.02 }, { x, y: y + box.h * 0.09 }, 0.4);
  }
}

export function pontoon(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(3.2, 4));
  const y = box.y + box.h;
  for (const f of [0.25, 0.75]) {
    const cx = box.x + box.w * f;
    pen.ellipse(cx, y + box.h * 0.12, box.w * 0.18, box.h * 0.07, 0.8);
  }
  pen.setWidth(2.4);
  // Waterline.
  const wave: XY[] = [];
  for (let i = 0; i <= 10; i++) {
    wave.push({ x: box.x - box.w * 0.1 + box.w * 1.2 * (i / 10), y: y + box.h * (0.22 + (i % 2 === 0 ? 0 : 0.035)) });
  }
  pen.polyline(wave, false, 0.5);
}

// --- second wave of everyday objects ---------------------------------------
// Measured against a list of answers people plausibly type, the map covered
// under a quarter of them; everything below closes the biggest of those gaps.
// Bathroom, commuting by anything other than a car, pests, and DIY were the
// four categories with nothing in them at all.

export function shower(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const cx = box.x + box.w * 0.5;
  const headY = box.y + box.h * 0.16;
  // Pipe down from the top, then a bend across to the head.
  pen.polyline(
    [
      { x: cx + box.w * 0.3, y: box.y },
      { x: cx + box.w * 0.3, y: headY - box.h * 0.08 },
      { x: cx, y: headY - box.h * 0.08 },
    ],
    false,
    0.7,
  );
  pen.setWidth(rng.range(4.5, 6));
  // The head itself — a shallow fan.
  pen.polyline(
    [
      { x: cx - box.w * 0.22, y: headY },
      { x: cx - box.w * 0.14, y: headY - box.h * 0.07 },
      { x: cx + box.w * 0.14, y: headY - box.h * 0.07 },
      { x: cx + box.w * 0.22, y: headY },
    ],
    true,
    0.8,
  );
  // Water. Dashes rather than solid lines, so it reads as falling.
  pen.setWidth(rng.range(2.4, 3.2));
  for (let i = 0; i < 6; i++) {
    const x = cx - box.w * 0.19 + (i / 5) * box.w * 0.38;
    let y = headY + box.h * rng.range(0.06, 0.12);
    const dashes = rng.int(2, 4);
    for (let d = 0; d < dashes; d++) {
      const len = box.h * rng.range(0.08, 0.14);
      pen.line({ x, y }, { x: x + box.w * 0.01, y: y + len }, 0.5);
      y += len + box.h * rng.range(0.04, 0.07);
    }
  }
}

export function toilet(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  // Cistern.
  pen.rect(cx - box.w * 0.26, box.y + box.h * 0.02, box.w * 0.52, box.h * 0.28);
  pen.setWidth(3);
  pen.circle(cx + box.w * 0.17, box.y + box.h * 0.1, box.w * 0.04, 0.6);
  // Bowl — narrower at the bottom, with a seat line.
  pen.setWidth(rng.range(4.5, 6));
  pen.polyline(
    [
      { x: cx - box.w * 0.3, y: box.y + box.h * 0.36 },
      { x: cx + box.w * 0.3, y: box.y + box.h * 0.36 },
      { x: cx + box.w * 0.17, y: box.y + box.h * 0.74 },
      { x: cx - box.w * 0.17, y: box.y + box.h * 0.74 },
    ],
    true,
    0.85,
  );
  pen.setWidth(3.2);
  pen.ellipse(cx, box.y + box.h * 0.38, box.w * 0.24, box.h * 0.05, 0.7);
  // Pedestal.
  pen.setWidth(rng.range(4, 5));
  pen.polyline(
    [
      { x: cx - box.w * 0.13, y: box.y + box.h * 0.74 },
      { x: cx - box.w * 0.17, y: box.y + box.h },
      { x: cx + box.w * 0.17, y: box.y + box.h },
      { x: cx + box.w * 0.13, y: box.y + box.h * 0.74 },
    ],
    false,
    0.8,
  );
}

export function toiletRoll(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.44;
  const top = box.y + box.h * 0.24;
  const bottom = box.y + box.h * 0.86;
  const rx = box.w * 0.24;
  // Cylinder: top ellipse, two sides, and the hole in the middle.
  pen.ellipse(cx, top, rx, box.h * 0.09, 0.75);
  pen.line({ x: cx - rx, y: top }, { x: cx - rx, y: bottom }, 0.7);
  pen.line({ x: cx + rx, y: top }, { x: cx + rx, y: bottom }, 0.7);
  pen.arc(cx, bottom, rx, 0, Math.PI, 0.8);
  pen.setWidth(3.2);
  pen.ellipse(cx, top, rx * 0.34, box.h * 0.033, 0.6);
  // The sheet coming off it — the bit that makes it unmistakable.
  pen.setWidth(rng.range(3.6, 4.6));
  const sx = cx + rx;
  pen.polyline(
    [
      { x: sx, y: top + box.h * 0.06 },
      { x: sx + box.w * 0.2, y: top + box.h * 0.1 },
      { x: sx + box.w * 0.24, y: bottom + box.h * 0.02 },
      { x: sx + box.w * 0.02, y: bottom - box.h * 0.04 },
    ],
    false,
    0.8,
  );
  // Perforation.
  pen.setWidth(2.2);
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    const x = sx + box.w * (0.03 + t * 0.19);
    const y = top + box.h * (0.08 + t * 0.03) + box.h * 0.24;
    pen.line({ x, y }, { x: x + box.w * 0.02, y }, 0.4);
  }
}

export function sponge(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 6.5));
  const w = box.w * 0.6;
  const h = box.h * 0.36;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.46;
  // Barrelled, because a sponge is never a clean rectangle.
  pen.polyline(
    [
      { x, y: y + h * 0.1 },
      { x: x + w * 0.5, y },
      { x: x + w, y: y + h * 0.1 },
      { x: x + w, y: y + h * 0.9 },
      { x: x + w * 0.5, y: y + h },
      { x, y: y + h * 0.9 },
    ],
    true,
    1.2,
  );
  // The scouring layer, as a band across the top third.
  pen.setWidth(3.4);
  pen.polyline(
    [
      { x: x + w * 0.02, y: y + h * 0.36 },
      { x: x + w * 0.5, y: y + h * 0.3 },
      { x: x + w * 0.98, y: y + h * 0.36 },
    ],
    false,
    0.9,
  );
  // Holes, only in the lower half so they don't fight the band.
  pen.setWidth(2.6);
  for (let i = 0; i < 5; i++) {
    pen.circle(
      x + w * rng.range(0.14, 0.86),
      y + h * rng.range(0.52, 0.86),
      box.w * rng.range(0.014, 0.024),
      0.8,
    );
  }
  // Bubbles lifting off it — the detail that says sponge and not brick.
  pen.setWidth(rng.range(2.8, 3.6));
  for (let i = 0; i < 4; i++) {
    pen.circle(
      x + w * rng.range(0.1, 0.9),
      y - box.h * rng.range(0.06, 0.26),
      box.w * rng.range(0.022, 0.045),
      0.85,
    );
  }
}
export function bug(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.52;
  const rx = box.w * 0.19;
  const ry = box.h * 0.26;
  pen.ellipse(cx, cy, rx, ry, 0.85);
  // Head.
  pen.circle(cx, cy - ry - box.h * 0.08, box.w * 0.1, 0.8);
  // Antennae.
  pen.setWidth(2.6);
  for (const dir of [-1, 1]) {
    pen.polyline(
      [
        { x: cx + dir * box.w * 0.04, y: cy - ry - box.h * 0.14 },
        { x: cx + dir * box.w * 0.12, y: cy - ry - box.h * 0.24 },
      ],
      false,
      0.6,
    );
  }
  // Six legs, kinked so they read as legs rather than whiskers.
  pen.setWidth(rng.range(2.8, 3.6));
  for (let i = 0; i < 3; i++) {
    const y = cy - ry * 0.5 + (i / 2) * ry;
    for (const dir of [-1, 1]) {
      pen.polyline(
        [
          { x: cx + dir * rx * 0.8, y },
          { x: cx + dir * (rx + box.w * 0.1), y: y - box.h * 0.04 },
          { x: cx + dir * (rx + box.w * 0.17), y: y + box.h * 0.05 },
        ],
        false,
        0.6,
      );
    }
  }
  // A line down the back, or wings.
  pen.setWidth(2.6);
  if (rng.chance(0.5)) {
    pen.line({ x: cx, y: cy - ry * 0.8 }, { x: cx, y: cy + ry * 0.8 }, 0.5);
  } else {
    for (const dir of [-1, 1]) {
      pen.ellipse(cx + dir * rx * 0.55, cy - ry * 0.1, rx * 0.5, ry * 0.6, 0.8);
    }
  }
}

export function train(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const x = box.x + box.w * 0.06;
  const w = box.w * 0.88;
  const top = box.y + box.h * 0.24;
  const bodyH = box.h * 0.44;
  // Body with a sloped nose, so it reads as a train and not a bus.
  pen.polyline(
    [
      { x, y: top + bodyH },
      { x, y: top + bodyH * 0.3 },
      { x: x + w * 0.16, y: top },
      { x: x + w, y: top },
      { x: x + w, y: top + bodyH },
    ],
    true,
    0.85,
  );
  // Windows.
  pen.setWidth(3.2);
  pen.rect(x + w * 0.05, top + bodyH * 0.16, w * 0.16, bodyH * 0.4);
  for (let i = 0; i < 3; i++) {
    pen.rect(x + w * (0.3 + i * 0.21), top + bodyH * 0.18, w * 0.14, bodyH * 0.36);
  }
  // Wheels and rail.
  pen.setWidth(rng.range(3.6, 4.6));
  const wheelY = top + bodyH + box.h * 0.07;
  for (const fx of [0.16, 0.36, 0.66, 0.86]) {
    pen.circle(x + w * fx, wheelY, box.h * 0.07, 0.8);
  }
  pen.setWidth(3);
  pen.line(
    { x: box.x, y: wheelY + box.h * 0.09 },
    { x: box.x + box.w, y: wheelY + box.h * 0.09 },
    0.6,
  );
}

export function plane(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  // Fuselage, nose to the right.
  pen.polyline(
    [
      { x: cx - box.w * 0.34, y: cy - box.h * 0.06 },
      { x: cx + box.w * 0.26, y: cy - box.h * 0.08 },
      { x: cx + box.w * 0.38, y: cy },
      { x: cx + box.w * 0.26, y: cy + box.h * 0.08 },
      { x: cx - box.w * 0.34, y: cy + box.h * 0.06 },
    ],
    true,
    0.85,
  );
  // Swept wing and tailplane.
  pen.polyline(
    [
      { x: cx - box.w * 0.04, y: cy },
      { x: cx - box.w * 0.16, y: cy + box.h * 0.28 },
      { x: cx + box.w * 0.06, y: cy + box.h * 0.05 },
    ],
    true,
    0.8,
  );
  pen.polyline(
    [
      { x: cx - box.w * 0.3, y: cy - box.h * 0.05 },
      { x: cx - box.w * 0.38, y: cy - box.h * 0.24 },
      { x: cx - box.w * 0.2, y: cy - box.h * 0.06 },
    ],
    true,
    0.8,
  );
  pen.setWidth(3);
  for (let i = 0; i < 5; i++) {
    pen.circle(cx - box.w * (0.24 - i * 0.09), cy - box.h * 0.01, box.w * 0.017, 0.6);
  }
}

export function plugSocket(pen: Pen, rng: Rng, box: Box): void {
  const cx = box.x + box.w * 0.5;
  const w = box.w * 0.46;
  const top = box.y + box.h * 0.32;
  const h = box.h * 0.3;
  // Prongs first, short and thick, sitting on top of the body.
  pen.setWidth(rng.range(6, 7.5));
  for (const dir of [-1, 1]) {
    pen.line(
      { x: cx + dir * w * 0.26, y: top },
      { x: cx + dir * w * 0.26, y: top - box.h * 0.11 },
      0.4,
    );
  }
  // Body, with the corners taken off so it reads as moulded plastic.
  pen.setWidth(rng.range(4.5, 6));
  const c = w * 0.16;
  pen.polyline(
    [
      { x: cx - w / 2 + c, y: top },
      { x: cx + w / 2 - c, y: top },
      { x: cx + w / 2, y: top + c },
      { x: cx + w / 2, y: top + h - c },
      { x: cx + w / 2 - c, y: top + h },
      { x: cx - w / 2 + c, y: top + h },
      { x: cx - w / 2, y: top + h - c },
      { x: cx - w / 2, y: top + c },
    ],
    true,
    0.8,
  );
  // Cable, thick and hanging rather than a thin scribble.
  pen.setWidth(rng.range(5, 6.5));
  pen.polyline(
    [
      { x: cx, y: top + h },
      { x: cx + box.w * 0.03, y: top + h + box.h * 0.13 },
      { x: cx - box.w * 0.07, y: top + h + box.h * 0.24 },
      { x: cx + box.w * 0.02, y: box.y + box.h * 0.98 },
    ],
    false,
    1.0,
  );
}
export function radiator(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const x = box.x + box.w * 0.14;
  const w = box.w * 0.72;
  const y = box.y + box.h * 0.26;
  const h = box.h * 0.5;
  pen.rect(x, y, w, h);
  // Fins.
  pen.setWidth(rng.range(3, 4));
  const fins = rng.int(5, 7);
  for (let i = 1; i < fins; i++) {
    const fx = x + (i / fins) * w;
    pen.line({ x: fx, y: y + h * 0.08 }, { x: fx, y: y + h * 0.92 }, 0.6);
  }
  // Valve and feet.
  pen.setWidth(3.2);
  pen.circle(x - box.w * 0.04, y + h * 0.8, box.w * 0.035, 0.7);
  pen.line({ x: x + w * 0.2, y: y + h }, { x: x + w * 0.2, y: y + h + box.h * 0.08 }, 0.6);
  pen.line({ x: x + w * 0.8, y: y + h }, { x: x + w * 0.8, y: y + h + box.h * 0.08 }, 0.6);
}

export function candle(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.42;
  const w = box.w * 0.24;
  pen.rect(cx - w / 2, top, w, box.h * 0.48);
  pen.setWidth(3.2);
  pen.ellipse(cx, top, w * 0.5, box.h * 0.035, 0.7);
  // Wick and flame.
  pen.line({ x: cx, y: top }, { x: cx, y: top - box.h * 0.05 }, 0.5);
  pen.setWidth(rng.range(3.4, 4.4));
  pen.polyline(
    [
      { x: cx, y: top - box.h * 0.05 },
      { x: cx - box.w * 0.06, y: top - box.h * 0.14 },
      { x: cx, y: top - box.h * 0.28 },
      { x: cx + box.w * 0.06, y: top - box.h * 0.14 },
    ],
    true,
    1.1,
  );
  // A drip down the side.
  pen.setWidth(2.6);
  pen.polyline(
    [
      { x: cx - w * 0.4, y: top + box.h * 0.04 },
      { x: cx - w * 0.46, y: top + box.h * 0.16 },
      { x: cx - w * 0.34, y: top + box.h * 0.2 },
    ],
    false,
    0.8,
  );
}

export function oven(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const x = box.x + box.w * 0.16;
  const w = box.w * 0.68;
  const y = box.y + box.h * 0.14;
  const h = box.h * 0.76;
  pen.rect(x, y, w, h);
  // Control strip along the top with dials.
  pen.setWidth(3.2);
  pen.line({ x, y: y + h * 0.2 }, { x: x + w, y: y + h * 0.2 }, 0.7);
  for (let i = 0; i < 3; i++) {
    pen.circle(x + w * (0.2 + i * 0.3), y + h * 0.1, box.w * 0.03, 0.7);
  }
  // Door with a window and a handle.
  pen.rect(x + w * 0.1, y + h * 0.32, w * 0.8, h * 0.54);
  pen.setWidth(rng.range(3.6, 4.6));
  pen.line({ x: x + w * 0.12, y: y + h * 0.28 }, { x: x + w * 0.88, y: y + h * 0.28 }, 0.6);
}

export function iron(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 6.5));
  const x = box.x + box.w * 0.1;
  const w = box.w * 0.8;
  const soleY = box.y + box.h * 0.7;
  // Sole plate: long, thin, pointed right. This has to dominate the
  // silhouette -- earlier versions gave the body too much height and the
  // whole thing read as a boat.
  pen.polyline(
    [
      { x, y: soleY },
      { x: x + w, y: soleY + box.h * 0.035 },
      { x: x + w * 0.88, y: soleY + box.h * 0.105 },
      { x: x + w * 0.03, y: soleY + box.h * 0.105 },
    ],
    true,
    0.8,
  );
  // Body: deliberately shallow.
  const bodyTop = soleY - box.h * 0.09;
  pen.polyline(
    [
      { x: x + w * 0.04, y: soleY },
      { x: x + w * 0.09, y: bodyTop },
      { x: x + w * 0.7, y: bodyTop },
      { x: x + w * 0.9, y: soleY + box.h * 0.005 },
    ],
    false,
    0.85,
  );
  // Handle as a strap with a hole through it: two arcs, one inside the other,
  // closed at the ends. The hole is the whole point -- a solid arch sitting on
  // the body just reads as a cabin.
  pen.setWidth(rng.range(4, 5));
  const hl = x + w * 0.15;
  const hr = x + w * 0.63;
  const mid = (hl + hr) / 2;
  const span = (hr - hl) / 2;
  const outerTop = bodyTop - box.h * 0.26;
  const innerTop = bodyTop - box.h * 0.15;
  pen.polyline(
    [
      { x: hl, y: bodyTop },
      { x: hl - span * 0.08, y: outerTop + box.h * 0.06 },
      { x: mid, y: outerTop },
      { x: hr + span * 0.08, y: outerTop + box.h * 0.06 },
      { x: hr, y: bodyTop },
      { x: hr - span * 0.22, y: bodyTop },
      { x: hr - span * 0.3, y: innerTop + box.h * 0.03 },
      { x: mid, y: innerTop },
      { x: hl + span * 0.3, y: innerTop + box.h * 0.03 },
      { x: hl + span * 0.22, y: bodyTop },
    ],
    true,
    0.85,
  );
  // Temperature dial.
  pen.setWidth(3);
  pen.circle(x + w * 0.78, soleY - box.h * 0.035, box.w * 0.03, 0.7);
  // Steam off the pointed end. A flat hull with a prow reads as a boat more
  // readily than as an iron, and this is the cheapest cue that breaks the tie.
  pen.setWidth(2.6);
  for (let i = 0; i < 3; i++) {
    const sx = x + w * (1.02 + i * 0.06);
    const sy = soleY - box.h * (0.02 + i * 0.05);
    pen.arc(sx, sy, box.w * rng.range(0.022, 0.034), Math.PI * 0.9, Math.PI * 2.1, 0.9);
  }
}
export function balloon(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const count = rng.int(1, 3);
  for (let i = 0; i < count; i++) {
    const cx = box.x + box.w * (count === 1 ? 0.5 : 0.28 + (i / (count - 1 || 1)) * 0.44);
    const cy = box.y + box.h * rng.range(0.24, 0.34);
    const r = box.w * rng.range(0.13, 0.17);
    pen.ellipse(cx, cy, r, r * 1.2, 0.9);
    // The knot.
    pen.setWidth(2.6);
    pen.polyline(
      [
        { x: cx - r * 0.14, y: cy + r * 1.2 },
        { x: cx, y: cy + r * 1.34 },
        { x: cx + r * 0.14, y: cy + r * 1.2 },
      ],
      true,
      0.7,
    );
    // String, curling.
    const endX = box.x + box.w * 0.5 + (cx - box.x - box.w * 0.5) * 0.3;
    pen.polyline(
      [
        { x: cx, y: cy + r * 1.34 },
        { x: cx + box.w * 0.04, y: cy + box.h * 0.24 },
        { x: endX, y: box.y + box.h * 0.92 },
      ],
      false,
      1.2,
    );
    pen.setWidth(rng.range(4, 5.5));
  }
}

export function gift(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const w = box.w * 0.56;
  const h = box.h * 0.44;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.4;
  pen.rect(x, y, w, h);
  // Ribbon, both ways.
  pen.setWidth(rng.range(3.4, 4.4));
  pen.line({ x: x + w * 0.5, y }, { x: x + w * 0.5, y: y + h }, 0.6);
  pen.line({ x, y: y + h * 0.34 }, { x: x + w, y: y + h * 0.34 }, 0.6);
  // Bow.
  for (const dir of [-1, 1]) {
    pen.polyline(
      [
        { x: x + w * 0.5, y },
        { x: x + w * (0.5 + dir * 0.28), y: y - box.h * 0.12 },
        { x: x + w * (0.5 + dir * 0.1), y: y - box.h * 0.02 },
      ],
      true,
      0.9,
    );
  }
}

export function fish(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const rx = box.w * 0.26;
  const ry = box.h * 0.2;
  pen.ellipse(cx, cy, rx, ry, 0.9);
  // Tail.
  pen.polyline(
    [
      { x: cx - rx, y: cy },
      { x: cx - rx - box.w * 0.16, y: cy - box.h * 0.14 },
      { x: cx - rx - box.w * 0.16, y: cy + box.h * 0.14 },
    ],
    true,
    0.85,
  );
  // Top fin and eye.
  pen.setWidth(rng.range(3.2, 4.2));
  pen.polyline(
    [
      { x: cx - rx * 0.3, y: cy - ry * 0.9 },
      { x: cx, y: cy - ry - box.h * 0.12 },
      { x: cx + rx * 0.4, y: cy - ry * 0.7 },
    ],
    false,
    0.8,
  );
  pen.circle(cx + rx * 0.5, cy - ry * 0.28, box.w * 0.022, 0.6);
  // Bubbles.
  pen.setWidth(2.4);
  for (let i = 0; i < 3; i++) {
    pen.circle(
      cx + rx + box.w * rng.range(0.06, 0.14),
      cy - ry - box.h * (0.06 + i * 0.09),
      box.w * rng.range(0.014, 0.024),
      0.7,
    );
  }
}

export function screwdriver(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.12;
  // Handle.
  pen.rect(cx - box.w * 0.09, top, box.w * 0.18, box.h * 0.3);
  pen.setWidth(2.8);
  for (let i = 1; i < 3; i++) {
    const y = top + (i / 3) * box.h * 0.3;
    pen.line({ x: cx - box.w * 0.09, y }, { x: cx + box.w * 0.09, y }, 0.5);
  }
  // Shaft and flat tip.
  pen.setWidth(rng.range(3.6, 4.6));
  pen.line({ x: cx, y: top + box.h * 0.3 }, { x: cx, y: top + box.h * 0.72 }, 0.5);
  pen.setWidth(rng.range(4.5, 6));
  pen.polyline(
    [
      { x: cx - box.w * 0.05, y: top + box.h * 0.72 },
      { x: cx + box.w * 0.05, y: top + box.h * 0.72 },
      { x: cx + box.w * 0.03, y: top + box.h * 0.82 },
      { x: cx - box.w * 0.03, y: top + box.h * 0.82 },
    ],
    true,
    0.7,
  );
}

export function drill(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const x = box.x + box.w * 0.2;
  const y = box.y + box.h * 0.26;
  const w = box.w * 0.42;
  const h = box.h * 0.26;
  // Body.
  pen.rect(x, y, w, h);
  // Grip, angled back.
  pen.polyline(
    [
      { x: x + w * 0.16, y: y + h },
      { x: x + w * 0.06, y: y + h + box.h * 0.3 },
      { x: x + w * 0.42, y: y + h + box.h * 0.3 },
      { x: x + w * 0.52, y: y + h },
    ],
    false,
    0.85,
  );
  // Chuck and bit.
  pen.setWidth(rng.range(3.6, 4.6));
  pen.rect(x + w, y + h * 0.24, box.w * 0.07, h * 0.52);
  pen.line(
    { x: x + w + box.w * 0.07, y: y + h * 0.5 },
    { x: x + w + box.w * 0.24, y: y + h * 0.5 },
    0.5,
  );
  // Trigger.
  pen.setWidth(2.8);
  pen.line(
    { x: x + w * 0.5, y: y + h + box.h * 0.05 },
    { x: x + w * 0.62, y: y + h + box.h * 0.05 },
    0.5,
  );
}

export function lightningBolt(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  // Cloud above it.
  const cloudY = box.y + box.h * 0.26;
  pen.arc(cx - box.w * 0.14, cloudY, box.w * 0.13, Math.PI, Math.PI * 2, 0.9);
  pen.arc(cx + box.w * 0.1, cloudY, box.w * 0.16, Math.PI, Math.PI * 2, 0.9);
  pen.line(
    { x: cx - box.w * 0.27, y: cloudY },
    { x: cx + box.w * 0.26, y: cloudY },
    0.8,
  );
  // The bolt.
  pen.setWidth(rng.range(4.5, 6));
  pen.polyline(
    [
      { x: cx + box.w * 0.04, y: cloudY + box.h * 0.03 },
      { x: cx - box.w * 0.1, y: cloudY + box.h * 0.3 },
      { x: cx + box.w * 0.01, y: cloudY + box.h * 0.3 },
      { x: cx - box.w * 0.08, y: box.y + box.h * 0.96 },
      { x: cx + box.w * 0.16, y: cloudY + box.h * 0.36 },
      { x: cx + box.w * 0.04, y: cloudY + box.h * 0.36 },
      { x: cx + box.w * 0.16, y: cloudY + box.h * 0.03 },
    ],
    true,
    0.8,
  );
}

export function towel(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const x = box.x + box.w * 0.24;
  const w = box.w * 0.52;
  const top = box.y + box.h * 0.24;
  // The rail it hangs from.
  pen.setWidth(rng.range(3.4, 4.4));
  pen.line({ x: box.x + box.w * 0.12, y: top }, { x: box.x + box.w * 0.88, y: top }, 0.6);
  // Cloth, with a soft fold at the bottom.
  pen.setWidth(rng.range(4, 5.5));
  pen.polyline(
    [
      { x, y: top },
      { x, y: top + box.h * 0.5 },
      { x: x + w * 0.5, y: top + box.h * 0.56 },
      { x: x + w, y: top + box.h * 0.5 },
      { x: x + w, y: top },
    ],
    false,
    1.0,
  );
  // Stripes.
  pen.setWidth(2.8);
  for (const fy of [0.34, 0.4]) {
    pen.line({ x, y: top + box.h * fy }, { x: x + w, y: top + box.h * fy }, 0.7);
  }
}

export function razor(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const headY = box.y + box.h * 0.22;
  // Head.
  pen.rect(cx - box.w * 0.16, headY, box.w * 0.32, box.h * 0.12);
  pen.setWidth(2.6);
  for (let i = 0; i < 3; i++) {
    const y = headY + box.h * (0.03 + i * 0.03);
    pen.line({ x: cx - box.w * 0.13, y }, { x: cx + box.w * 0.13, y }, 0.4);
  }
  // Handle.
  pen.setWidth(rng.range(4, 5.5));
  pen.polyline(
    [
      { x: cx - box.w * 0.055, y: headY + box.h * 0.12 },
      { x: cx - box.w * 0.045, y: box.y + box.h * 0.9 },
      { x: cx + box.w * 0.045, y: box.y + box.h * 0.9 },
      { x: cx + box.w * 0.055, y: headY + box.h * 0.12 },
    ],
    true,
    0.8,
  );
}

export function stapler(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 6.5));
  const x = box.x + box.w * 0.14;
  const w = box.w * 0.72;
  const baseY = box.y + box.h * 0.66;
  // Base, with a foot at each end.
  pen.polyline(
    [
      { x, y: baseY },
      { x: x + w, y: baseY - box.h * 0.02 },
      { x: x + w, y: baseY + box.h * 0.08 },
      { x, y: baseY + box.h * 0.1 },
    ],
    true,
    0.8,
  );
  // Top arm, hinged at the left, lifted clear at the right.
  const armL = x + w * 0.04;
  const armR = x + w * 0.98;
  pen.polyline(
    [
      { x: armL, y: baseY - box.h * 0.06 },
      { x: armL + w * 0.06, y: baseY - box.h * 0.22 },
      { x: armR, y: baseY - box.h * 0.28 },
      { x: armR, y: baseY - box.h * 0.16 },
      { x: armL + w * 0.08, y: baseY - box.h * 0.1 },
    ],
    true,
    0.85,
  );
  // The hinge, which is what makes the two parts read as one object.
  pen.setWidth(3.4);
  pen.circle(armL + w * 0.03, baseY - box.h * 0.05, box.w * 0.032, 0.7);
  // A staple about to come out.
  pen.setWidth(2.8);
  pen.polyline(
    [
      { x: x + w * 0.82, y: baseY - box.h * 0.13 },
      { x: x + w * 0.82, y: baseY - box.h * 0.06 },
      { x: x + w * 0.9, y: baseY - box.h * 0.06 },
      { x: x + w * 0.9, y: baseY - box.h * 0.13 },
    ],
    false,
    0.6,
  );
}
export function calculator(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const w = box.w * 0.48;
  const h = box.h * 0.62;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * 0.2;
  pen.rect(x, y, w, h);
  // Screen.
  pen.setWidth(3.2);
  pen.rect(x + w * 0.12, y + h * 0.08, w * 0.76, h * 0.18);
  // Button grid.
  pen.setWidth(2.6);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      pen.rect(
        x + w * (0.14 + c * 0.26),
        y + h * (0.34 + r * 0.15),
        w * 0.18,
        h * 0.1,
      );
    }
  }
}

export function mailbox(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.22;
  const w = box.w * 0.44;
  // Domed box.
  pen.arc(cx, top + box.h * 0.1, w * 0.5, Math.PI, Math.PI * 2, 0.85);
  pen.polyline(
    [
      { x: cx - w * 0.5, y: top + box.h * 0.1 },
      { x: cx - w * 0.5, y: top + box.h * 0.3 },
      { x: cx + w * 0.5, y: top + box.h * 0.3 },
      { x: cx + w * 0.5, y: top + box.h * 0.1 },
    ],
    false,
    0.8,
  );
  // Slot and post.
  pen.setWidth(3.2);
  pen.line({ x: cx - w * 0.26, y: top + box.h * 0.06 }, { x: cx + w * 0.26, y: top + box.h * 0.06 }, 0.5);
  pen.setWidth(rng.range(4, 5.5));
  pen.line({ x: cx, y: top + box.h * 0.3 }, { x: cx, y: box.y + box.h * 0.94 }, 0.6);
  pen.line(
    { x: cx - box.w * 0.12, y: box.y + box.h * 0.94 },
    { x: cx + box.w * 0.12, y: box.y + box.h * 0.94 },
    0.6,
  );
  // The little flag.
  pen.setWidth(3);
  pen.polyline(
    [
      { x: cx + w * 0.5, y: top + box.h * 0.18 },
      { x: cx + w * 0.72, y: top + box.h * 0.18 },
      { x: cx + w * 0.72, y: top + box.h * 0.06 },
    ],
    false,
    0.7,
  );
}

export function fence(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5.5));
  const y = box.y + box.h * 0.34;
  const h = box.h * 0.52;
  const count = rng.int(4, 6);
  for (let i = 0; i < count; i++) {
    const x = box.x + box.w * (0.1 + (i / (count - 1)) * 0.8);
    // Pointed pickets.
    pen.polyline(
      [
        { x: x - box.w * 0.035, y: y + box.h * 0.06 },
        { x, y },
        { x: x + box.w * 0.035, y: y + box.h * 0.06 },
        { x: x + box.w * 0.035, y: y + h },
        { x: x - box.w * 0.035, y: y + h },
      ],
      true,
      0.8,
    );
  }
  // Two rails across.
  pen.setWidth(rng.range(3.4, 4.4));
  for (const fy of [0.26, 0.7]) {
    pen.line(
      { x: box.x + box.w * 0.06, y: y + h * fy },
      { x: box.x + box.w * 0.94, y: y + h * fy },
      0.7,
    );
  }
}

export function drinkCan(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.28;
  const bottom = box.y + box.h * 0.86;
  const rx = box.w * 0.16;
  pen.ellipse(cx, top, rx, box.h * 0.05, 0.7);
  pen.line({ x: cx - rx, y: top }, { x: cx - rx, y: bottom }, 0.6);
  pen.line({ x: cx + rx, y: top }, { x: cx + rx, y: bottom }, 0.6);
  pen.arc(cx, bottom, rx, 0, Math.PI, 0.8);
  // Ring pull.
  pen.setWidth(2.6);
  pen.ellipse(cx, top - box.h * 0.005, rx * 0.34, box.h * 0.016, 0.6);
  // A band round the middle, so it isn't a blank cylinder.
  pen.setWidth(3);
  pen.line({ x: cx - rx, y: top + box.h * 0.2 }, { x: cx + rx, y: top + box.h * 0.2 }, 0.6);
  pen.line({ x: cx - rx, y: top + box.h * 0.3 }, { x: cx + rx, y: top + box.h * 0.3 }, 0.6);
}

export function hourglass(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.22;
  const bottom = box.y + box.h * 0.84;
  const w = box.w * 0.3;
  // Frame.
  pen.line({ x: cx - w, y: top }, { x: cx + w, y: top }, 0.6);
  pen.line({ x: cx - w, y: bottom }, { x: cx + w, y: bottom }, 0.6);
  // The two bulbs, meeting in the middle.
  pen.polyline(
    [
      { x: cx - w * 0.82, y: top },
      { x: cx - box.w * 0.03, y: (top + bottom) / 2 },
      { x: cx - w * 0.82, y: bottom },
    ],
    false,
    0.85,
  );
  pen.polyline(
    [
      { x: cx + w * 0.82, y: top },
      { x: cx + box.w * 0.03, y: (top + bottom) / 2 },
      { x: cx + w * 0.82, y: bottom },
    ],
    false,
    0.85,
  );
  // Sand: a heap in the bottom and a trickle through the neck.
  pen.setWidth(2.8);
  pen.polyline(
    [
      { x: cx - w * 0.5, y: bottom },
      { x: cx, y: bottom - box.h * 0.1 },
      { x: cx + w * 0.5, y: bottom },
    ],
    false,
    0.9,
  );
  pen.line(
    { x: cx, y: (top + bottom) / 2 },
    { x: cx, y: bottom - box.h * 0.12 },
    0.5,
  );
}

export function shoppingBasket(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const top = box.y + box.h * 0.4;
  const h = box.h * 0.36;
  const topW = box.w * 0.62;
  const botW = box.w * 0.46;
  pen.polyline(
    [
      { x: cx - topW / 2, y: top },
      { x: cx + topW / 2, y: top },
      { x: cx + botW / 2, y: top + h },
      { x: cx - botW / 2, y: top + h },
    ],
    true,
    0.85,
  );
  // Weave.
  pen.setWidth(2.8);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    pen.line(
      { x: cx - topW / 2 + (topW - botW) / 2 * t, y: top + h * t },
      { x: cx + topW / 2 - (topW - botW) / 2 * t, y: top + h * t },
      0.6,
    );
  }
  // Handle.
  pen.setWidth(rng.range(3.4, 4.4));
  pen.arc(cx, top, box.w * 0.18, Math.PI, Math.PI * 2, 0.8);
}

export function microphone(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const headY = box.y + box.h * 0.3;
  const r = box.w * 0.14;
  pen.circle(cx, headY, r, 0.85);
  // Grille.
  pen.setWidth(2.4);
  for (let i = -1; i <= 1; i++) {
    pen.line(
      { x: cx - r * 0.7, y: headY + i * r * 0.4 },
      { x: cx + r * 0.7, y: headY + i * r * 0.4 },
      0.4,
    );
  }
  // Body.
  pen.setWidth(rng.range(4, 5.5));
  pen.polyline(
    [
      { x: cx - box.w * 0.05, y: headY + r * 0.9 },
      { x: cx - box.w * 0.04, y: box.y + box.h * 0.86 },
      { x: cx + box.w * 0.04, y: box.y + box.h * 0.86 },
      { x: cx + box.w * 0.05, y: headY + r * 0.9 },
    ],
    true,
    0.8,
  );
  // Cable.
  pen.setWidth(2.8);
  pen.coil(cx, box.y + box.h * 0.86, box.y + box.h * 0.98, box.w * 0.03, 2);
}

export function mapSheet(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const x = box.x + box.w * 0.14;
  const w = box.w * 0.72;
  const y = box.y + box.h * 0.28;
  const h = box.h * 0.44;
  // A folded sheet: the top edge zigzags where the folds are.
  pen.polyline(
    [
      { x, y: y + h * 0.06 },
      { x: x + w * 0.33, y },
      { x: x + w * 0.66, y: y + h * 0.08 },
      { x: x + w, y },
      { x: x + w, y: y + h * 0.94 },
      { x: x + w * 0.66, y: y + h },
      { x: x + w * 0.33, y: y + h * 0.92 },
      { x, y: y + h },
    ],
    true,
    0.85,
  );
  // Fold creases.
  pen.setWidth(2.6);
  for (const fx of [0.33, 0.66]) {
    pen.line({ x: x + w * fx, y: y + h * 0.02 }, { x: x + w * fx, y: y + h * 0.96 }, 0.6);
  }
  // A dashed route and an X.
  pen.setWidth(rng.range(3, 3.8));
  let px = x + w * 0.12;
  let py = y + h * 0.72;
  for (let i = 0; i < 5; i++) {
    const nx = px + w * 0.13;
    const ny = py - h * rng.range(0.02, 0.12);
    pen.line({ x: px, y: py }, { x: nx, y: ny }, 0.7);
    px = nx + w * 0.03;
    py = ny;
  }
  pen.line({ x: px - w * 0.04, y: py - h * 0.06 }, { x: px + w * 0.04, y: py + h * 0.02 }, 0.6);
  pen.line({ x: px + w * 0.04, y: py - h * 0.06 }, { x: px - w * 0.04, y: py + h * 0.02 }, 0.6);
}

export function newspaper(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const x = box.x + box.w * 0.16;
  const w = box.w * 0.68;
  const y = box.y + box.h * 0.24;
  const h = box.h * 0.54;
  pen.rect(x, y, w, h);
  // Spine, so it reads as folded.
  pen.setWidth(3.2);
  pen.line({ x: x + w * 0.5, y }, { x: x + w * 0.5, y: y + h }, 0.7);
  // Masthead.
  pen.setWidth(rng.range(3.4, 4.4));
  pen.rect(x + w * 0.06, y + h * 0.07, w * 0.38, h * 0.13);
  // Columns of text.
  pen.setWidth(2.2);
  for (let col = 0; col < 2; col++) {
    for (let i = 0; i < 6; i++) {
      const ly = y + h * (0.28 + i * 0.1);
      const lx = x + w * (0.06 + col * 0.5);
      pen.line({ x: lx, y: ly }, { x: lx + w * rng.range(0.28, 0.38), y: ly }, 0.4);
    }
  }
}

export function teddy(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4.5, 6));
  const cx = box.x + box.w * 0.5;
  const headY = box.y + box.h * 0.3;
  const headR = box.w * 0.16;
  pen.circle(cx, headY, headR, 0.9);
  // Ears.
  for (const dir of [-1, 1]) {
    pen.circle(cx + dir * headR * 0.85, headY - headR * 0.8, headR * 0.42, 0.85);
  }
  // Face.
  pen.setWidth(3);
  pen.circle(cx - headR * 0.34, headY - headR * 0.1, box.w * 0.018, 0.6);
  pen.circle(cx + headR * 0.34, headY - headR * 0.1, box.w * 0.018, 0.6);
  pen.ellipse(cx, headY + headR * 0.36, headR * 0.3, headR * 0.22, 0.8);
  // Body and limbs.
  pen.setWidth(rng.range(4, 5.5));
  const bodyY = headY + headR + box.h * 0.14;
  pen.ellipse(cx, bodyY, box.w * 0.17, box.h * 0.16, 0.9);
  for (const dir of [-1, 1]) {
    pen.ellipse(cx + dir * box.w * 0.2, bodyY - box.h * 0.02, box.w * 0.06, box.h * 0.05, 0.85);
    pen.ellipse(cx + dir * box.w * 0.09, bodyY + box.h * 0.17, box.w * 0.06, box.h * 0.05, 0.85);
  }
}

// --- shading ---------------------------------------------------------------
// Everything above draws outlines. Outlines alone are what made a page of these
// read as clip art: no weight, no light, nothing to look at twice. The marks
// below are the ones a person adds after the shape is right, and they are what
// separates a sketch from a diagram.
//
// They are all cheap on the wire by construction. The pen emits points in
// proportion to stroke length, so a 0.06-long hatch line costs five points
// where a silhouette costs forty.

/** Clips the infinite line through (px, py) in direction (dx, dy) to [box].
 *
 *  Hatching without clipping is just lines across the paper. Clipping is what
 *  makes them read as shading *on* something. */
function clipToBox(
  box: Box,
  px: number,
  py: number,
  dx: number,
  dy: number,
): [XY, XY] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const slabs: [number, number, number, number][] = [
    [px, dx, box.x, box.x + box.w],
    [py, dy, box.y, box.y + box.h],
  ];
  for (const [p, d, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const a = (lo - p) / d;
    const b = (hi - p) / d;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  if (t1 <= t0) return null;
  return [
    { x: px + dx * t0, y: py + dy * t0 },
    { x: px + dx * t1, y: py + dy * t1 },
  ];
}

/** Parallel pencil strokes filling [box], at [angle] radians.
 *
 *  Each line stops short of the clipped ends by a random amount, because
 *  hatching that meets the edge exactly reads as a filled polygon. The ragged
 *  ends are the tell that a hand did it. */
export function hatchFill(
  pen: Pen,
  rng: Rng,
  box: Box,
  opts: { angle?: number; spacing?: number; width?: number } = {},
): void {
  const angle = opts.angle ?? -Math.PI / 3;
  const spacing = opts.spacing ?? rng.range(0.019, 0.028);
  pen.setWidth(opts.width ?? rng.range(1.5, 2.3));

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const reach = Math.ceil((box.w + box.h) / spacing);

  for (let k = -reach; k <= reach; k++) {
    const off = k * spacing + rng.range(-spacing * 0.16, spacing * 0.16);
    const seg = clipToBox(box, cx + nx * off, cy + ny * off, dx, dy);
    if (!seg) continue;
    const [a, b] = seg;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.012) continue;
    const t0 = rng.range(0, 0.14);
    const t1 = 1 - rng.range(0, 0.14);
    pen.line(
      { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
      { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 },
      0.5,
    );
  }
}

/** Shades one side of [box], the side away from the light, leaving the rest of
 *  the form bare. Shading a shape evenly just greys it out; shading a band down
 *  one edge is what makes it look round, or lit. */
export function shadeSide(pen: Pen, rng: Rng, box: Box, lightFromLeft: boolean): void {
  // Deliberately narrow and airy. A band across a third of the shape at tight
  // spacing doesn't read as shading, it reads as the object being scribbled
  // out — which is exactly what a wider first version of this looked like on
  // anything round, because the band crossed the middle of the form.
  const angle = rng.range(-1.25, -0.95);
  const spacing = rng.range(0.026, 0.036);

  const bandW = box.w * rng.range(0.14, 0.22);
  hatchFill(
    pen,
    rng,
    {
      x: lightFromLeft ? box.x + box.w - bandW : box.x,
      y: box.y + box.h * rng.range(0.28, 0.42),
      w: bandW,
      h: box.h * rng.range(0.5, 0.66),
    },
    { angle, spacing },
  );

  // A second band along the underside. Light falls from above in every drawing
  // anybody has ever made, so this is the half that always works.
  if (rng.chance(0.65)) {
    const bandH = box.h * rng.range(0.14, 0.22);
    hatchFill(
      pen,
      rng,
      {
        x: box.x + box.w * rng.range(0.12, 0.24),
        y: box.y + box.h - bandH,
        w: box.w * rng.range(0.52, 0.7),
        h: bandH,
      },
      { angle, spacing },
    );
  }
}

/** The pool of dark under an object. Nothing else here does as much to stop a
 *  drawing floating in the middle of the page. */
export function groundShadow(pen: Pen, rng: Rng, box: Box): void {
  const top = box.y + box.h + rng.range(0.004, 0.016);
  const halfW = box.w * rng.range(0.42, 0.56);
  const cx = box.x + box.w * 0.5 + rng.range(-0.02, 0.02);
  pen.setWidth(rng.range(1.8, 2.6));
  const rows = rng.int(3, 5);
  for (let i = 0; i < rows; i++) {
    // Narrower further back, so it sits like a pool rather than a stack.
    const t = i / Math.max(1, rows - 1);
    const w = halfW * (1 - t * rng.range(0.4, 0.6));
    const y = top + i * rng.range(0.008, 0.013);
    pen.line(
      { x: cx - w + rng.range(-0.01, 0.01), y },
      { x: cx + w + rng.range(-0.01, 0.01), y },
      0.45,
    );
  }
}

/** Short marks radiating off a point: impact, attention, "look at this".
 *  Comic shorthand, and it costs four points a stroke. */
export function emphasisBurst(pen: Pen, rng: Rng, cx: number, cy: number, r: number): void {
  pen.setWidth(rng.range(2.2, 3.2));
  const n = rng.int(5, 8);
  const start = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const r0 = r * rng.range(1, 1.15);
    const r1 = r0 + r * rng.range(0.25, 0.5);
    pen.line(
      { x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0 },
      { x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 },
      0.4,
    );
  }
}

// --- backdrops -------------------------------------------------------------
// A subject on blank paper is a cut-out. These put it somewhere, using the
// fewest marks that read as a place, and drawn light so they stay behind the
// subject rather than competing with it.

/** Floorline plus the skirting behind it: the cheapest interior there is. */
export function roomFloor(pen: Pen, rng: Rng, y: number): void {
  pen.setWidth(rng.range(2.4, 3.2));
  pen.line({ x: 0.04, y }, { x: 0.96, y: y + rng.range(-0.012, 0.012) }, 0.7);
  if (rng.chance(0.6)) {
    pen.setWidth(rng.range(1.6, 2.2));
    const d = rng.range(0.018, 0.03);
    pen.line({ x: 0.04, y: y - d }, { x: 0.96, y: y - d + rng.range(-0.008, 0.008) }, 0.6);
  }
}

/** Two walls meeting: a corner of a room. */
/** The corner of a room: a vertical where two walls meet, and skirting running
 *  off to each side.
 *
 *  The vertical goes in whichever margin [avoid] leaves free. It used to land
 *  anywhere across the middle of the page, which put a tall grey line straight
 *  through the subject in about a third of drawings — and a line through a cat
 *  is not a wall, it is a random stroke. With no margin wide enough it draws
 *  the skirting only, meeting at one edge. */
export function roomCorner(pen: Pen, rng: Rng, floorY: number, avoid: Box): void {
  pen.setWidth(rng.range(2.2, 3));
  const leftRoom = avoid.x - 0.08;
  const rightRoom = 0.92 - (avoid.x + avoid.w);
  const side = leftRoom >= rightRoom ? -1 : 1;
  const room = Math.max(leftRoom, rightRoom);
  let cx: number;
  if (room >= 0.1) {
    cx = side < 0 ? rng.range(0.08, avoid.x - 0.05) : rng.range(avoid.x + avoid.w + 0.05, 0.92);
    pen.line({ x: cx, y: rng.range(0.06, 0.14) }, { x: cx, y: floorY }, 0.6);
  } else {
    cx = side < 0 ? 0.05 : 0.95;
  }
  pen.line({ x: 0.04, y: floorY - rng.range(0.04, 0.09) }, { x: cx, y: floorY }, 0.6);
  pen.line({ x: cx, y: floorY }, { x: 0.96, y: floorY - rng.range(0.04, 0.09) }, 0.6);
}

/** Boards running away from the viewer. Depth, for three strokes.
 *
 *  Kept short and few: run these to the bottom of the page and the converging
 *  fan becomes the loudest thing in the drawing, which is the opposite of what
 *  a backdrop is for. */
export function floorBoards(pen: Pen, rng: Rng, y: number): void {
  pen.setWidth(rng.range(1.3, 1.8));
  const vpX = rng.range(0.35, 0.65);
  const bottom = Math.min(0.95, y + rng.range(0.08, 0.14));
  const n = rng.int(2, 3);
  for (let i = 0; i <= n; i++) {
    const x = 0.12 + (0.76 / n) * i;
    pen.line({ x, y: bottom }, { x: vpX + (x - vpX) * 0.55, y }, 0.5);
  }
}

/** A window on the back wall, with light coming through it. */
export function backWindow(pen: Pen, rng: Rng): void {
  const w = rng.range(0.16, 0.24);
  const h = w * rng.range(0.9, 1.25);
  const x = rng.chance(0.5) ? rng.range(0.06, 0.16) : rng.range(0.62, 0.76);
  const y = rng.range(0.1, 0.2);
  pen.setWidth(rng.range(2.2, 3));
  pen.rect(x, y, w, h, 0.7);
  pen.setWidth(rng.range(1.8, 2.4));
  pen.line({ x: x + w * 0.5, y }, { x: x + w * 0.5, y: y + h }, 0.5);
  pen.line({ x, y: y + h * 0.5 }, { x: x + w, y: y + h * 0.5 }, 0.5);
  hatchFill(pen, rng, { x: x + w * 0.06, y: y + h * 0.06, w: w * 0.4, h: h * 0.4 }, {
    angle: -Math.PI / 4,
    spacing: rng.range(0.02, 0.03),
  });
}

/** Sky: a couple of clouds and, sometimes, a sun. For anything outdoors. */
export function skyline(pen: Pen, rng: Rng): void {
  pen.setWidth(rng.range(2, 2.8));
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    cloud(pen, rng, rng.range(0.08, 0.72), rng.range(0.07, 0.18), rng.range(0.045, 0.07));
  }
  if (rng.chance(0.45)) {
    const sx = rng.range(0.76, 0.88);
    const sy = rng.range(0.08, 0.16);
    pen.setWidth(rng.range(2.2, 3));
    pen.circle(sx, sy, rng.range(0.03, 0.045), 0.8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pen.line(
        { x: sx + Math.cos(a) * 0.055, y: sy + Math.sin(a) * 0.055 },
        { x: sx + Math.cos(a) * 0.08, y: sy + Math.sin(a) * 0.08 },
        0.4,
      );
    }
  }
}
