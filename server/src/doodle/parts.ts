import { Pen, Rng } from "./pen.js";

export type Box = { x: number; y: number; w: number; h: number };

// --- machine parts ---------------------------------------------------------
// Every drawing in this game is an "invention", so a contraption body plus a
// handful of these details always reads as plausible, whatever the prompt.

export function machineBody(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 7));

  // Vary the silhouette so not every invention is the same rectangle. The
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
  // Signal waves radiating off the tip.
  if (rng.chance(0.6)) {
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

export function animal(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  pen.blob(box.x + box.w * 0.5, box.y + box.h * 0.6, Math.min(box.w, box.h) * 0.42, 3);
  const headR = Math.min(box.w, box.h) * 0.22;
  const hx = box.x + box.w * 0.75;
  const hy = box.y + box.h * 0.25;
  pen.circle(hx, hy, headR);
  // Ears.
  pen.setWidth(3);
  for (const side of [-1, 1]) {
    pen.polyline(
      [
        { x: hx + side * headR * 0.5, y: hy - headR * 0.7 },
        { x: hx + side * headR * 0.8, y: hy - headR * 1.5 },
        { x: hx + side * headR * 1.0, y: hy - headR * 0.4 },
      ],
      false,
      0.6,
    );
  }
  // Tail.
  pen.arc(box.x + box.w * 0.15, box.y + box.h * 0.45, headR * 0.9, -1.2, 1.2, 0.7);
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

export function toast(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(4, 5));
  const w = box.w * 0.7;
  const x = box.x + (box.w - w) / 2;
  const crustY = box.y + box.h * 0.28;
  // Domed top, straight sides.
  pen.arc(x + w * 0.5, crustY, w * 0.5, Math.PI, Math.PI * 2, 0.7);
  pen.polyline(
    [
      { x, y: crustY },
      { x, y: box.y + box.h },
      { x: x + w, y: box.y + box.h },
      { x: x + w, y: crustY },
    ],
    false,
    0.8,
  );
  pen.setWidth(2.6);
  pen.rect(x + w * 0.14, crustY + box.h * 0.1, w * 0.72, box.h * 0.48);
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
