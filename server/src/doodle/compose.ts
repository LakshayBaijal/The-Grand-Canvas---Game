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
  | "tech";

const TOPIC_WORDS: Record<Topic, readonly string[]> = {
  flight: ["fly", "flying", "flight", "bird", "pigeon", "wing", "air", "float", "jump", "sky"],
  food: ["food", "eat", "eating", "taco", "pizza", "burger", "snack", "cook", "lunch", "dinner", "breakfast", "sandwich", "cake", "coffee", "drink"],
  water: ["water", "swim", "rain", "wet", "ocean", "sea", "shower", "bath", "wash", "clean", "drink", "underwater"],
  fire: ["fire", "flame", "flaming", "burn", "hot", "heat", "spicy", "explode", "bomb"],
  vehicle: ["car", "drive", "driving", "road", "travel", "bike", "bus", "truck", "traffic", "commute"],
  home: ["home", "house", "room", "living", "kitchen", "bedroom", "garden", "door", "furniture"],
  animal: ["pet", "dog", "cat", "animal", "puppy", "kitten", "horse", "cow", "bear", "fish", "duck"],
  person: ["kid", "kids", "child", "children", "baby", "parent", "people", "person", "friend", "toddler", "grandma", "grandpa"],
  space: ["space", "astronaut", "gravity", "moon", "star", "planet", "rocket", "alien", "orbit"],
  music: ["music", "dance", "dancing", "sing", "song", "karaoke", "guitar", "drum", "party"],
  sleep: ["sleep", "sleeping", "bed", "dream", "nap", "tired", "snore", "wake", "alarm"],
  money: ["money", "cash", "rich", "pay", "buy", "shopping", "tax", "bill", "coin", "sell"],
  fitness: ["gym", "exercise", "run", "running", "workout", "fit", "muscle", "sport", "lift", "yoga"],
  tech: ["phone", "computer", "laptop", "screen", "internet", "wifi", "app", "robot", "email", "work", "office", "meeting", "zoom"],
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

/** Draws the "hero" subject when a topic matched, in the middle of the page. */
function drawTopicSubject(pen: Pen, rng: Rng, topic: Topic, box: Box): void {
  switch (topic) {
    case "vehicle":
      parts.car(pen, rng, box);
      return;
    case "home":
      parts.house(pen, rng, box);
      return;
    case "animal":
      parts.animal(pen, rng, box);
      return;
    case "space":
      parts.rocket(pen, rng, box);
      return;
    case "food":
      parts.foodStack(pen, rng, box);
      return;
    default:
      // Topics without a distinct silhouette still get a machine body; their
      // flavour comes from the accents added afterwards.
      parts.machineBody(pen, rng, box);
      parts.buttons(pen, rng, box);
      return;
  }
}

/** Layers the details that make a topic recognizable around whatever body
 *  was already drawn. */
function drawTopicAccents(pen: Pen, rng: Rng, topic: Topic, box: Box, accent: string): void {
  const ink = pen;
  switch (topic) {
    case "flight":
      parts.wings(ink, rng, box);
      parts.cloud(ink, rng, box.x - rng.range(0.02, 0.08), box.y - rng.range(0.05, 0.12), rng.range(0.05, 0.075));
      break;
    case "fire":
      pen.setColor(accent);
      parts.flames(ink, rng, box.x + box.w * 0.5, box.y + box.h + rng.range(0.03, 0.07), rng.range(0.05, 0.08));
      break;
    case "water":
      pen.setColor(accent);
      parts.droplets(ink, rng, box.x + box.w * 0.5, box.y - rng.range(0.04, 0.09), rng.range(0.03, 0.045));
      break;
    case "music":
      pen.setColor(accent);
      parts.musicNotes(ink, rng, box.x + box.w + rng.range(0.04, 0.09), box.y + box.h * 0.3, rng.range(0.035, 0.05));
      break;
    case "sleep":
      parts.zzz(ink, rng, box.x + box.w + 0.03, box.y + 0.02, rng.range(0.03, 0.045));
      break;
    case "money":
      pen.setColor(accent);
      parts.coin(ink, rng, box.x + box.w + rng.range(0.05, 0.09), box.y + box.h * 0.4, rng.range(0.035, 0.05));
      break;
    case "fitness":
      parts.dumbbell(ink, rng, box.x + box.w * 0.5, box.y + box.h + rng.range(0.08, 0.13), rng.range(0.05, 0.07));
      break;
    case "tech":
      parts.screen(ink, rng, box);
      parts.antenna(ink, rng, box);
      break;
    case "person":
      parts.stickPerson(ink, rng, box.x - rng.range(0.08, 0.13), box.y + box.h + 0.06, rng.range(0.2, 0.28));
      break;
    case "space":
      pen.setColor(accent);
      // sparkles() already scatters several marks — calling it in a loop
      // buried the drawing under plus signs.
      parts.sparkles(ink, rng, { x: box.x - 0.05, y: box.y - 0.08, w: box.w + 0.1, h: box.h * 0.4 });
      break;
    default:
      break;
  }
}

/**
 * Composes a doodle for [prompt]. Always produces a contraption; when the
 * prompt mentions something we can draw, the relevant subject and props are
 * layered in too.
 */
export function drawForPrompt(prompt: string, artistSalt: string): Stroke[] {
  const rng = new Rng(seedFrom(prompt, artistSalt));
  // Some "people" have a steadier hand than others.
  const pen = new Pen(rng, rng.range(0.7, 1.5));

  const ink = rng.pick(INKS);
  const accent = rng.pick(ACCENTS);
  pen.setColor(ink);

  const topics = detectTopics(prompt);
  const primary = topics.length > 0 ? rng.pick(topics) : null;

  // Main body, roughly centred with a bit of placement variation.
  const w = rng.range(0.34, 0.46);
  const h = rng.range(0.28, 0.4);
  const box: Box = {
    x: 0.5 - w / 2 + rng.range(-0.05, 0.05),
    y: 0.42 - h / 2 + rng.range(-0.04, 0.06),
    w,
    h,
  };

  if (primary) {
    drawTopicSubject(pen, rng, primary, box);
  } else {
    parts.machineBody(pen, rng, box);
  }

  // Machine detailing — the stuff that makes it read as an invention.
  pen.setColor(ink);
  const detailPool = [
    () => parts.dial(pen, rng, box),
    () => parts.buttons(pen, rng, box),
    () => parts.lever(pen, rng, box),
    () => parts.antenna(pen, rng, box),
    () => parts.screen(pen, rng, box),
    () => parts.pipe(pen, rng, box),
    () => parts.gear(pen, rng, box.x + box.w * rng.range(0.15, 0.85), box.y + box.h * rng.range(0.2, 0.7), rng.range(0.03, 0.045)),
  ];
  const detailCount = rng.int(2, 4);
  const shuffled = [...detailPool].sort(() => rng.next() - 0.5);
  for (let i = 0; i < detailCount; i++) shuffled[i]();

  // Something to stand on.
  if (rng.chance(0.55)) parts.wheels(pen, rng, box);
  else if (rng.chance(0.6)) parts.legs(pen, rng, box);
  else parts.spring(pen, rng, box);

  // Topical flavour on top.
  if (primary) {
    pen.setColor(ink);
    drawTopicAccents(pen, rng, primary, box, accent);
    // A second topic sometimes sneaks in when the prompt mentions several.
    const secondary = topics.find((t) => t !== primary);
    if (secondary && rng.chance(0.5)) {
      pen.setColor(ink);
      drawTopicAccents(pen, rng, secondary, box, accent);
    }
  }

  // Finishing marks.
  pen.setColor(rng.chance(0.6) ? accent : ink);
  if (rng.chance(0.7)) parts.sparkles(pen, rng, box);
  if (rng.chance(0.35)) {
    pen.setColor(ink);
    parts.stickPerson(pen, rng, box.x + box.w + rng.range(0.07, 0.12), box.y + box.h + 0.05, rng.range(0.18, 0.24));
  }
  if (rng.chance(0.3)) {
    pen.setColor(accent);
    pen.setWidth(3);
    const fromX = box.x + box.w + 0.06;
    pen.arrow({ x: fromX, y: box.y - 0.04 }, { x: box.x + box.w * 0.75, y: box.y + box.h * 0.2 });
  }

  return pen.strokes;
}
