import { Pen, Rng } from "./pen.js";

export type Box = { x: number; y: number; w: number; h: number };

// --- machine parts ---------------------------------------------------------
// Every drawing in this game is an "invention", so a contraption body plus a
// handful of these details always reads as plausible, whatever the prompt.

export function machineBody(pen: Pen, rng: Rng, box: Box): void {
  pen.setWidth(rng.range(5, 7));

  // Vary the silhouette so not every invention is the same rectangle.
  const shape = rng.next();
  if (shape < 0.6) {
    pen.rect(box.x, box.y, box.w, box.h);
  } else if (shape < 0.82) {
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
  } else {
    // Rounded canister.
    pen.ellipse(box.x + box.w * 0.5, box.y + box.h * 0.5, box.w * 0.5, box.h * 0.5, 0.8);
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
