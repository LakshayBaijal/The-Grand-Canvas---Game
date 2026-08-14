import type { Stroke } from "../types.js";
import { Pen, Rng } from "./pen.js";
import * as parts from "./parts.js";
import type { Box } from "./parts.js";

/** Ink colours a person might grab first, plus a few accents for details. */
const INKS = ["#1A1A1A", "#1A1A1A", "#1A1A1A", "#243447", "#3A2A22"];
const ACCENTS = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#FDD835"];

/** Topics we can actually depict. The blank in each prompt is player-written
 *  and unpredictable, so this is best-effort: when nothing matches we still
 *  draw a contraption, which fits every prompt in this game by definition. */
type Topic =
  | "flight"
  | "food"
  | "water"
  | "fire"
  | "vehicle"
  | "home"
  | "animal"
  | "person"
  | "space"
  | "music"
  | "sleep"
  | "money"
  | "fitness"
  | "tech"
  | "clean"
  | "weather"
  | "time"
  | "noise"
  | "garden";

const TOPIC_WORDS: Record<Topic, readonly string[]> = {
  flight: ["fly", "flying", "flight", "bird", "pigeon", "wing", "air", "float", "jump", "sky"],
  food: ["food", "eat", "eating", "taco", "pizza", "burger", "snack", "snacks", "snacking", "cook", "cooking", "lunch", "dinner", "breakfast", "sandwich", "cake", "coffee", "drink", "toast", "kitchen", "packet", "bill"],
  water: ["water", "swim", "rain", "wet", "ocean", "sea", "shower", "showers", "bath", "underwater", "leak"],
  fire: ["fire", "flame", "flaming", "burn", "burnt", "hot", "heat", "spicy", "explode", "bomb"],
  vehicle: ["car", "drive", "driving", "road", "travel", "bike", "bus", "truck", "traffic", "commute", "parking", "park"],
  home: ["home", "house", "room", "living", "bedroom", "door", "doors", "furniture", "doorbell", "neighbour", "neighbours", "neighbor", "neighbors"],
  animal: ["pet", "pets", "dog", "dogs", "cat", "cats", "animal", "puppy", "kitten", "horse", "cow", "bear", "fish", "duck", "paws"],
  person: ["kid", "kids", "child", "children", "baby", "parent", "people", "person", "friend", "toddler", "grandma", "grandpa", "someone", "owners"],
  space: ["space", "astronaut", "gravity", "moon", "star", "planet", "rocket", "alien", "orbit"],
  music: ["music", "dance", "dancing", "sing", "song", "karaoke", "guitar", "drum", "party"],
  sleep: ["sleep", "sleeping", "asleep", "bed", "dream", "nap", "tired", "snore", "snoring", "wake", "waking", "alarm", "night"],
  money: ["money", "cash", "rich", "pay", "buy", "shopping", "tax", "bill", "coin", "sell", "bags", "grocery"],
  fitness: ["gym", "exercise", "run", "running", "workout", "fit", "muscle", "sport", "lift", "yoga", "treadmill"],
  tech: ["phone", "computer", "laptop", "screen", "internet", "wifi", "app", "robot", "email", "work", "office", "meeting", "zoom", "keyboard", "battery", "cables", "chat", "photos", "calls", "connection"],
  clean: ["laundry", "wash", "washing", "dirty", "muddy", "mud", "mess", "messy", "dishes", "vacuum", "dust", "socks", "sock", "stain", "tidy", "clean", "cleaning", "chores"],
  weather: ["rainy", "umbrella", "snow", "winter", "cold", "freezing", "frozen", "summer", "sun", "storm", "wind", "melting"],
  time: ["clock", "late", "morning", "mornings", "wait", "waiting", "hours", "minutes", "time", "snooze", "deadline", "deadlines", "queue", "lines", "hold"],
  noise: ["loud", "noise", "noisy", "chewing", "quiet", "quietly", "silence", "shouting", "barking", "interrupted"],
  garden: ["garden", "plant", "plants", "tree", "grass", "flower", "weeds"],
};

/** What a topic can be *drawn as*, when it has a recognizable silhouette.
 *  Several options per topic so the same keyword doesn't always produce the
 *  same picture. Topics absent here get a machine, and their flavour comes
 *  from the accents instead. */
type PartFn = (pen: Pen, rng: Rng, box: Box) => void;

const TOPIC_SUBJECTS: Partial<Record<Topic, readonly PartFn[]>> = {
  vehicle: [parts.car],
  home: [parts.house, parts.crate],
  animal: [parts.animal],
  space: [parts.rocket],
  food: [parts.foodStack, parts.mug],
  sleep: [parts.bed, parts.alarmClock],
  weather: [parts.umbrella, parts.plant, parts.fan],
  tech: [parts.phoneDevice],
  time: [parts.alarmClock],
  clean: [parts.sock, parts.crate],
  garden: [parts.plant],
};

function detectTopics(prompt: string): Topic[] {
  const words = prompt.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);
  const hits: Topic[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_WORDS) as [Topic, string[]][]) {
    if (keywords.some((k) => wordSet.has(k))) hits.push(topic);
  }
  return hits;
}

/** Stable-ish seed from the prompt plus the artist, so two bots given the
 *  same prompt still draw different things. */
function seedFrom(prompt: string, salt: string): number {
  let h = 2166136261;
  for (const s of [prompt, salt]) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

type Ctx = {
  ink: string;
  accent: string;
  primary: Topic | null;
  topics: Topic[];
  subjects: readonly PartFn[];
};

// --- shared building blocks ------------------------------------------------

/** The main mass of the drawing: the topic's own silhouette when it has one,
 *  otherwise a machine. */
function chassis(pen: Pen, rng: Rng, ctx: Ctx, box: Box): void {
  if (ctx.subjects.length > 0 && rng.chance(0.75)) rng.pick(ctx.subjects)(pen, rng, box);
  else parts.machineBody(pen, rng, box);
}

/** Bolts [count] distinct fittings onto a body. Drawing from a pool this size
 *  is what keeps two machines of the same silhouette from matching. */
function details(pen: Pen, rng: Rng, box: Box, count: number): void {
  const pool: (() => void)[] = [
    () => parts.dial(pen, rng, box),
    () => parts.buttons(pen, rng, box),
    () => parts.lever(pen, rng, box),
    () => parts.antenna(pen, rng, box),
    () => parts.screen(pen, rng, box),
    () => parts.pipe(pen, rng, box),
    () => parts.funnel(pen, rng, box),
    () => parts.robotArm(pen, rng, box),
    () => parts.cord(pen, rng, box),
    () => parts.smoke(pen, rng, box),
    () => parts.handle(pen, rng, box),
    () => parts.gear(
      pen,
      rng,
      box.x + box.w * rng.range(0.15, 0.85),
      box.y + box.h * rng.range(0.2, 0.7),
      rng.range(0.03, 0.045),
    ),
  ];
  const shuffled = [...pool].sort(() => rng.next() - 0.5);
  for (let i = 0; i < Math.min(count, shuffled.length); i++) shuffled[i]();
}

/** Something to stand on — or nothing, which is itself a change of look. */
function base(pen: Pen, rng: Rng, box: Box): void {
  const roll = rng.next();
  if (roll < 0.38) parts.wheels(pen, rng, box);
  else if (roll < 0.72) parts.legs(pen, rng, box);
  else if (roll < 0.88) parts.spring(pen, rng, box);
}

/** Finds room beside [box] for a prop of the given size, flipping to the
 *  other side when the first choice would run off the paper. */
function beside(rng: Rng, box: Box, w: number, h: number): Box {
  const right = box.x + box.w + 0.03;
  const left = box.x - w - 0.03;
  const x = right + w <= 0.95 ? right : left >= 0.05 ? left : Math.min(right, 0.95 - w);
  return { x, y: box.y + box.h * rng.range(0.1, 0.45), w, h };
}

/** Layers the details that make a topic recognizable around whatever body
 *  was already drawn. */
function topicAccents(pen: Pen, rng: Rng, topic: Topic, box: Box, accent: string): void {
  switch (topic) {
    case "flight":
      parts.wings(pen, rng, box);
      parts.cloud(pen, rng, box.x - rng.range(0.02, 0.08), box.y - rng.range(0.05, 0.12), rng.range(0.05, 0.075));
      break;
    case "fire":
      pen.setColor(accent);
      parts.flames(pen, rng, box.x + box.w * 0.5, box.y + box.h + rng.range(0.03, 0.07), rng.range(0.05, 0.08));
      break;
    case "water":
      pen.setColor(accent);
      parts.droplets(pen, rng, box.x + box.w * 0.5, box.y - rng.range(0.04, 0.09), rng.range(0.03, 0.045));
      break;
    case "music":
      pen.setColor(accent);
      parts.musicNotes(pen, rng, box.x + box.w + rng.range(0.04, 0.09), box.y + box.h * 0.3, rng.range(0.035, 0.05));
      break;
    case "sleep":
      parts.zzz(pen, rng, box.x + box.w + 0.03, box.y + 0.02, rng.range(0.03, 0.045));
      break;
    case "money":
      pen.setColor(accent);
      parts.coin(pen, rng, box.x + box.w + rng.range(0.05, 0.09), box.y + box.h * 0.4, rng.range(0.035, 0.05));
      break;
    case "fitness":
      parts.dumbbell(pen, rng, box.x + box.w * 0.5, box.y + box.h + rng.range(0.08, 0.13), rng.range(0.05, 0.07));
      break;
    case "tech":
      parts.screen(pen, rng, box);
      parts.antenna(pen, rng, box);
      break;
    case "person":
      parts.stickPerson(pen, rng, box.x - rng.range(0.08, 0.13), box.y + box.h + 0.06, rng.range(0.2, 0.28));
      break;
    case "space":
      pen.setColor(accent);
      // sparkles() already scatters several marks — calling it in a loop
      // buried the drawing under plus signs.
      parts.sparkles(pen, rng, { x: box.x - 0.05, y: box.y - 0.08, w: box.w + 0.1, h: box.h * 0.4 });
      break;
    case "clean":
      pen.setColor(accent);
      parts.droplets(pen, rng, box.x + box.w * 0.5, box.y - rng.range(0.05, 0.1), rng.range(0.03, 0.045));
      break;
    case "weather":
      parts.cloud(pen, rng, box.x + rng.range(-0.02, 0.1), box.y - rng.range(0.08, 0.14), rng.range(0.05, 0.075));
      pen.setColor(accent);
      parts.droplets(pen, rng, box.x + box.w * 0.4, box.y - rng.range(0.02, 0.05), rng.range(0.028, 0.04));
      break;
    case "time":
      parts.alarmClock(pen, rng, beside(rng, box, 0.15, 0.15));
      break;
    case "noise":
      pen.setColor(accent);
      parts.soundWaves(pen, rng, box.x + box.w + 0.02, box.y + box.h * 0.4, 1);
      break;
    case "garden":
      parts.plant(pen, rng, beside(rng, box, 0.16, 0.22));
      break;
    default:
      break;
  }
}

function accents(pen: Pen, rng: Rng, ctx: Ctx, box: Box): void {
  if (!ctx.primary) return;
  pen.setColor(ctx.ink);
  topicAccents(pen, rng, ctx.primary, box, ctx.accent);
  // A second topic sometimes sneaks in when the prompt mentions several.
  const secondary = ctx.topics.find((t) => t !== ctx.primary);
  if (secondary && rng.chance(0.5)) {
    pen.setColor(ctx.ink);
    topicAccents(pen, rng, secondary, box, ctx.accent);
  }
  pen.setColor(ctx.ink);
}

// --- page layouts ----------------------------------------------------------
// The single biggest source of "these all look the same" was that every
// drawing was one medium box in the middle of the page. Varying the whole
// arrangement changes the read far more than swapping which dial goes on it.

type Layout = (pen: Pen, rng: Rng, ctx: Ctx) => Box;

/** One machine, centred. The classic. */
const hero: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.34, 0.46);
  const h = rng.range(0.28, 0.4);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.05, 0.05), y: 0.42 - h / 2 + rng.range(-0.04, 0.06), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(2, 4));
  base(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** Tall and narrow — a stack rather than a console. */
const tower: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.18, 0.27);
  const h = rng.range(0.42, 0.54);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.1, 0.1), y: rng.range(0.14, 0.2), w, h };
  parts.machineBody(pen, rng, box);
  details(pen, rng, box, rng.int(2, 3));
  if (rng.chance(0.6)) parts.smoke(pen, rng, box);
  base(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** Wide and flat — a bench or production line. */
const bench: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.5, 0.64);
  const h = rng.range(0.16, 0.24);
  const box: Box = { x: 0.5 - w / 2, y: rng.range(0.38, 0.48), w, h };
  parts.machineBody(pen, rng, box);
  details(pen, rng, box, rng.int(2, 4));
  if (rng.chance(0.55)) parts.conveyor(pen, rng, box);
  else base(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** Give it eyes and limbs and it stops being an appliance. */
const creature: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.28, 0.38);
  const h = rng.range(0.26, 0.36);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.05, 0.05), y: rng.range(0.26, 0.36), w, h };
  parts.machineBody(pen, rng, box);
  parts.eyes(pen, rng, box);
  parts.legs(pen, rng, box);
  parts.robotArm(pen, rng, box);
  if (rng.chance(0.5)) parts.robotArm(pen, rng, box);
  if (rng.chance(0.6)) parts.antenna(pen, rng, box);
  if (rng.chance(0.5)) parts.buttons(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** A gadget you'd pick up, mid-use. */
const handheld: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.24, 0.32);
  const h = rng.range(0.28, 0.36);
  const box: Box = { x: rng.range(0.16, 0.26), y: rng.range(0.3, 0.4), w, h };
  parts.machineBody(pen, rng, box);
  parts.handle(pen, rng, box);
  details(pen, rng, box, rng.int(2, 3));
  if (rng.chance(0.6)) parts.robotArm(pen, rng, box);
  pen.setColor(ctx.accent);
  parts.motionLines(pen, rng, box.x - 0.03, box.y + box.h * 0.4, rng.range(0.06, 0.1), -1);
  pen.setColor(ctx.ink);
  if (rng.chance(0.6)) {
    parts.stickPerson(pen, rng, rng.range(0.72, 0.82), box.y + box.h + rng.range(0.08, 0.14), rng.range(0.24, 0.32));
  }
  accents(pen, rng, ctx, box);
  return box;
};

/** Somebody wearing the invention on their head. */
const wearable: Layout = (pen, rng, ctx) => {
  const height = rng.range(0.4, 0.5);
  const feetY = rng.range(0.78, 0.86);
  const x = 0.5 + rng.range(-0.06, 0.06);
  parts.stickPerson(pen, rng, x, feetY, height);

  const headR = height * 0.16;
  const headY = feetY - height + headR;
  const w = rng.range(0.14, 0.2);
  const h = rng.range(0.08, 0.13);
  const box: Box = { x: x - w / 2, y: headY - headR - h - 0.01, w, h };
  parts.machineBody(pen, rng, box);
  details(pen, rng, box, rng.int(1, 2));
  if (rng.chance(0.7)) parts.antenna(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** Machine on one side, the person it's for on the other. */
const duo: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.26, 0.34);
  const h = rng.range(0.24, 0.32);
  const box: Box = { x: rng.range(0.1, 0.16), y: rng.range(0.32, 0.42), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(2, 3));
  base(pen, rng, box);

  const px = rng.range(0.72, 0.82);
  parts.stickPerson(pen, rng, px, box.y + box.h + rng.range(0.1, 0.16), rng.range(0.26, 0.34));

  pen.setColor(ctx.accent);
  pen.setWidth(3);
  pen.arrow({ x: px - 0.1, y: box.y + box.h * 0.25 }, { x: box.x + box.w + 0.03, y: box.y + box.h * 0.4 });
  pen.setColor(ctx.ink);
  accents(pen, rng, ctx, box);
  return box;
};

/** Two panels: the problem, then the problem solved. */
const beforeAfter: Layout = (pen, rng, ctx) => {
  const w = 0.34;
  const h = 0.3;
  const y = rng.range(0.28, 0.36);
  const left: Box = { x: 0.07, y, w, h };
  const right: Box = { x: 0.59, y, w, h };

  parts.panelFrame(pen, rng, left);
  parts.panelFrame(pen, rng, right);
  parts.face(pen, rng, left.x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.3, false);
  parts.face(pen, rng, right.x + w * 0.5, y + h * 0.34, Math.min(w, h) * 0.24, true);

  // The thing that fixed it, tucked under the happy face.
  const gadget: Box = { x: right.x + w * 0.26, y: y + h * 0.66, w: w * 0.48, h: h * 0.24 };
  parts.machineBody(pen, rng, gadget);
  details(pen, rng, gadget, 1);

  pen.setColor(ctx.accent);
  pen.setWidth(3);
  pen.arrow({ x: 0.44, y: y + h * 0.5 }, { x: 0.56, y: y + h * 0.5 });
  pen.setColor(ctx.ink);
  accents(pen, rng, ctx, right);
  return right;
};

/** Mounted overhead, doing something to whatever is below it. */
const hanging: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.3, 0.4);
  const h = rng.range(0.18, 0.26);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.04, 0.04), y: rng.range(0.1, 0.16), w, h };
  parts.machineBody(pen, rng, box);
  details(pen, rng, box, rng.int(2, 3));

  pen.setWidth(3);
  for (const fx of [0.25, 0.75]) {
    pen.line(
      { x: box.x + box.w * fx, y: box.y },
      { x: box.x + box.w * fx + rng.range(-0.02, 0.02), y: 0.04 },
      0.8,
    );
  }

  const target: Box = { x: 0.37, y: rng.range(0.62, 0.72), w: 0.26, h: 0.2 };
  pen.setColor(ctx.accent);
  pen.setWidth(2.6);
  for (const fx of [0.35, 0.5, 0.65]) {
    pen.line({ x: box.x + box.w * fx, y: box.y + box.h }, { x: target.x + target.w * fx, y: target.y }, 0.6);
  }
  pen.setColor(ctx.ink);
  if (ctx.subjects.length > 0) rng.pick(ctx.subjects)(pen, rng, target);
  else parts.crate(pen, rng, target);
  accents(pen, rng, ctx, box);
  return box;
};

/** The everyday object itself, large, with the invention bolted onto it. */
const showcase: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.42, 0.54);
  const h = rng.range(0.34, 0.44);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.04, 0.04), y: rng.range(0.24, 0.34), w, h };
  rng.pick(ctx.subjects)(pen, rng, box);

  const gw = rng.range(0.13, 0.19);
  const gh = rng.range(0.1, 0.15);
  const gadget = beside(rng, box, gw, gh);
  parts.machineBody(pen, rng, gadget);
  details(pen, rng, gadget, rng.int(1, 2));
  if (rng.chance(0.5)) parts.antenna(pen, rng, gadget);
  accents(pen, rng, ctx, box);
  return box;
};

const GENERAL_LAYOUTS: readonly Layout[] = [
  hero,
  tower,
  bench,
  creature,
  handheld,
  wearable,
  duo,
  beforeAfter,
  hanging,
];

/** Below this many strokes a drawing looks unfinished rather than minimal.
 *  Tuned against a contact sheet — most drawings land in the high teens. */
const MIN_STROKES = 14;

/** Marks added on top of whatever was drawn, sparingly. */
function finishingMarks(pen: Pen, rng: Rng, ctx: Ctx): void {
  pen.setColor(rng.chance(0.6) ? ctx.accent : ctx.ink);
  if (rng.chance(0.45)) parts.sparkles(pen, rng, { x: 0.2, y: 0.12, w: 0.6, h: 0.3 });
  if (rng.chance(0.28)) {
    pen.setColor(ctx.accent);
    parts.lightbulb(pen, rng, rng.range(0.13, 0.24), rng.range(0.15, 0.23), rng.range(0.035, 0.05));
  }
  if (rng.chance(0.22)) {
    pen.setColor(ctx.accent);
    parts.exclaim(pen, rng, rng.range(0.78, 0.9), rng.range(0.16, 0.26), rng.range(0.04, 0.06));
  }
}

/**
 * Composes a doodle for [prompt]. Picks a page layout first, then fills it —
 * so two drawings differ in their whole arrangement, not just in which knobs
 * ended up on the same box.
 */
export function drawForPrompt(prompt: string, artistSalt: string): Stroke[] {
  const rng = new Rng(seedFrom(prompt, artistSalt));
  // Some "people" have a steadier hand than others, and press harder.
  const pen = new Pen(rng, rng.range(0.7, 1.5));
  pen.setWidthScale(rng.range(0.78, 1.25));

  const ink = rng.pick(INKS);
  const accent = rng.pick(ACCENTS);
  pen.setColor(ink);

  const topics = detectTopics(prompt);
  const primary = topics.length > 0 ? rng.pick(topics) : null;
  const subjects = primary ? TOPIC_SUBJECTS[primary] ?? [] : [];
  const ctx: Ctx = { ink, accent, primary, topics, subjects };

  // A prompt with something drawable in it should often lead with that thing
  // rather than burying it behind another machine.
  const pool = subjects.length > 0
    ? [...GENERAL_LAYOUTS, showcase, showcase, showcase, showcase]
    : GENERAL_LAYOUTS;
  const focus = rng.pick(pool)(pen, rng, ctx);

  // Some layouts can land thin — a bare silhouette and little else, which
  // reads as abandoned rather than simple. Keep bolting things onto the focus
  // until there's enough on the page to look finished.
  pen.setColor(ink);
  for (let attempt = 0; attempt < 3 && pen.strokes.length < MIN_STROKES; attempt++) {
    details(pen, rng, focus, 2);
  }

  finishingMarks(pen, rng, ctx);
  return pen.strokes;
}
