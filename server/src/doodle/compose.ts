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

/** A few parts take a centre and radius rather than a box; these let them sit
 *  in the same lookup as everything else. */
const centred = (
  draw: (pen: Pen, rng: Rng, cx: number, cy: number, r: number) => void,
  scale = 0.42,
): PartFn => (pen, rng, box) =>
  draw(pen, rng, box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) * scale);

const dumbbellShape = centred(parts.dumbbell, 0.5);
const coinShape = centred(parts.coin);
const bulbShape = centred(parts.lightbulb, 0.34);

/**
 * Words that name one specific drawable thing.
 *
 * This is the accuracy layer. Topic matching is a fallback that says "this is
 * vaguely about food"; a hit here says "they wrote *coffee*, so draw a mug".
 * Checked before topics, and checked against the player's own answer before
 * the rest of the sentence, because the answer is the part that was actually
 * chosen — the template around it is the same boilerplate every round.
 */
const WORD_SHAPES: Record<string, PartFn> = {
  // time
  alarm: parts.alarmClock, clock: parts.alarmClock, snooze: parts.alarmClock,
  oversleeping: parts.alarmClock, overslept: parts.alarmClock, timer: parts.alarmClock,

  // drinks and food
  coffee: parts.mug, tea: parts.mug, espresso: parts.mug, latte: parts.mug,
  mug: parts.mug, cup: parts.mug, brew: parts.mug,
  toast: parts.toast, bread: parts.toast, toaster: parts.toast, burnt: parts.toast,
  pizza: parts.foodStack, burger: parts.foodStack, sandwich: parts.foodStack,
  snack: parts.foodStack, food: parts.foodStack, lunch: parts.foodStack,
  dinner: parts.foodStack, breakfast: parts.foodStack, meal: parts.foodStack,
  leftovers: parts.foodStack, takeaway: parts.foodStack,
  icecream: parts.iceCream, dessert: parts.iceCream, melting: parts.iceCream,
  bottle: parts.bottle, water: parts.bottle, juice: parts.bottle,

  // getting around
  car: parts.car, traffic: parts.car, commute: parts.car, driving: parts.car,
  drive: parts.car, parking: parts.car, bus: parts.car, taxi: parts.car,
  jam: parts.car, gridlock: parts.car,
  bike: parts.bicycle, bicycle: parts.bicycle, cycling: parts.bicycle,
  suitcase: parts.suitcase, luggage: parts.suitcase, packing: parts.suitcase,
  holiday: parts.suitcase, airport: parts.suitcase,
  stairs: parts.stairs, lift: parts.stairs, elevator: parts.stairs, escalator: parts.stairs,

  // animals
  dog: parts.animal, puppy: parts.animal, paws: parts.animal, barking: parts.animal,
  cat: parts.animal, kitten: parts.animal, pet: parts.animal, fur: parts.animal,
  bird: parts.bird, pigeon: parts.bird, seagull: parts.bird, crow: parts.bird,

  // household
  sock: parts.sock, socks: parts.sock,
  laundry: parts.washingMachine, washing: parts.washingMachine,
  dishes: parts.washingMachine, dishwasher: parts.washingMachine,
  key: parts.keys, keys: parts.keys, keyring: parts.keys, wallet: parts.keys,
  door: parts.door, doorbell: parts.door, knocking: parts.door, lock: parts.door,
  bin: parts.trashBin, trash: parts.trashBin, rubbish: parts.trashBin,
  garbage: parts.trashBin, recycling: parts.trashBin,
  chair: parts.chair, desk: parts.chair, sofa: parts.chair, seat: parts.chair,
  house: parts.house, home: parts.house, apartment: parts.house, flat: parts.house,
  box: parts.crate, boxes: parts.crate, parcel: parts.crate, delivery: parts.crate,
  package: parts.crate, shoe: parts.shoe, shoes: parts.shoe, boots: parts.shoe,

  // tech
  phone: parts.phoneDevice, mobile: parts.phoneDevice, texting: parts.phoneDevice,
  laptop: parts.laptop, computer: parts.laptop, meeting: parts.laptop,
  zoom: parts.laptop, email: parts.laptop, spreadsheet: parts.laptop,
  wifi: parts.wifiIcon, internet: parts.wifiIcon, signal: parts.wifiIcon,
  router: parts.wifiIcon, broadband: parts.wifiIcon, buffering: parts.wifiIcon,
  cable: parts.cables, cables: parts.cables, cords: parts.cables, wires: parts.cables,
  headphones: parts.cables, earphones: parts.cables, tangled: parts.cables,
  charger: parts.battery, battery: parts.battery, charging: parts.battery,
  inbox: parts.envelope, letter: parts.envelope, post: parts.envelope, mail: parts.envelope,

  // money
  bill: coinShape, bills: coinShape, money: coinShape, cash: coinShape,
  tax: coinShape, rent: coinShape, price: coinShape,
  shopping: parts.shoppingBag, groceries: parts.shoppingBag, grocery: parts.shoppingBag,
  bags: parts.shoppingBag, bag: parts.shoppingBag,

  // rest
  bed: parts.bed, sleep: parts.bed, nap: parts.bed, pillow: parts.bed,
  mattress: parts.bed, duvet: parts.bed, snoring: parts.bed,

  // outdoors
  umbrella: parts.umbrella, rain: parts.umbrella, drizzle: parts.umbrella,
  downpour: parts.umbrella, puddles: parts.umbrella,
  snow: parts.snowflake, winter: parts.snowflake, frost: parts.snowflake,
  freezing: parts.snowflake, ice: parts.snowflake,
  sun: parts.sun, summer: parts.sun, sunshine: parts.sun, sunburn: parts.sun,
  plant: parts.plant, plants: parts.plant, garden: parts.plant, flowers: parts.plant,
  weeds: parts.plant, tree: parts.tree, trees: parts.tree, leaves: parts.tree,
  fan: parts.fan, aircon: parts.fan, heatwave: parts.fan,

  // fitness
  gym: parts.treadmill, treadmill: parts.treadmill, running: parts.treadmill,
  cardio: parts.treadmill, jogging: parts.treadmill,
  weights: dumbbellShape, dumbbell: dumbbellShape, lifting: dumbbellShape,
  ball: parts.ball, football: parts.ball, cricket: parts.ball, tennis: parts.ball,

  // noise
  noise: parts.speaker, loud: parts.speaker, noisy: parts.speaker,
  speaker: parts.speaker, volume: parts.speaker, shouting: parts.speaker,
  music: parts.speaker, alarms: parts.speaker,

  // kitchen
  kettle: parts.kettle, boiling: parts.kettle, fridge: parts.fridge,
  freezer: parts.fridge, microwave: parts.microwave, reheating: parts.microwave,
  pan: parts.pan, frying: parts.pan, saucepan: parts.pan, cooking: parts.pan,
  plate: parts.plate, plates: parts.plate, cutlery: parts.plate, fork: parts.plate,
  tap: parts.tap, faucet: parts.tap, dripping: parts.tap, plumbing: parts.tap,
  sink: parts.tap, leak: parts.tap, leaking: parts.tap,

  // around the house
  glasses: parts.glasses, specs: parts.glasses, spectacles: parts.glasses,
  toothbrush: parts.toothbrush, teeth: parts.toothbrush, brushing: parts.toothbrush,
  dentist: parts.toothbrush,
  broom: parts.broom, sweeping: parts.broom, mop: parts.broom, mopping: parts.broom,
  vacuum: parts.broom, vacuuming: parts.broom, hoover: parts.broom,
  bucket: parts.bucket, ladder: parts.ladder, shelf: parts.ladder,
  ceiling: parts.ladder, lightbulb: parts.lamp, lamp: parts.lamp, lighting: parts.lamp,
  television: parts.television, telly: parts.television, netflix: parts.television,
  remote: parts.television, streaming: parts.television,
  hat: parts.hat, cap: parts.hat, haircut: parts.hat,
  backpack: parts.backpack, rucksack: parts.backpack, schoolbag: parts.backpack,

  // desk and admin
  book: parts.book, books: parts.book, reading: parts.book, homework: parts.book,
  studying: parts.book, manual: parts.book, instructions: parts.book,
  pen: parts.pencil, pencil: parts.pencil, writing: parts.pencil, notes: parts.pencil,
  handwriting: parts.pencil, signature: parts.pencil,
  scissors: parts.scissors, cutting: parts.scissors, wrapping: parts.scissors,
  camera: parts.camera, photo: parts.camera, photos: parts.camera, selfie: parts.camera,
  pictures: parts.camera,
  calendar: parts.calendar, schedule: parts.calendar, appointment: parts.calendar,
  reminder: parts.calendar, birthday: parts.calendar,
  sign: parts.signpost, signs: parts.signpost, directions: parts.signpost,
  rules: parts.signpost, forms: parts.signpost, paperwork: parts.signpost,
  watch: parts.watch, wristwatch: parts.watch,

  // diy and health
  hammer: parts.hammer, nails: parts.hammer, flatpack: parts.hammer,
  assembly: parts.hammer, diy: parts.hammer,
  paint: parts.paintbrush, painting: parts.paintbrush, decorating: parts.paintbrush,
  brush: parts.paintbrush,
  pill: parts.pill, pills: parts.pill, medicine: parts.pill, tablets: parts.pill,
  headache: parts.pill,
  cone: parts.trafficCone, roadworks: parts.trafficCone, construction: parts.trafficCone,
  detour: parts.trafficCone,

  // elsewhere
  rocket: parts.rocket, space: parts.rocket, moon: parts.rocket, planet: parts.rocket,
  idea: bulbShape, bulb: bulbShape, electricity: bulbShape,
};

/** Crude stemmer: enough to make "cables"/"cable" and "running"/"run" land on
 *  the same entry without pulling in a real NLP dependency. */
function stem(word: string): string[] {
  const forms = [word];
  if (word.endsWith("ies") && word.length > 4) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es") && word.length > 3) forms.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) forms.push(word.slice(0, -1));
  if (word.endsWith("ing") && word.length > 5) {
    forms.push(word.slice(0, -3), `${word.slice(0, -3)}e`);
  }
  if (word.endsWith("ed") && word.length > 4) forms.push(word.slice(0, -2), word.slice(0, -1));
  return forms;
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Every word plus its stems, so lookups can be a plain Set test. */
function expand(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of wordsOf(text)) for (const form of stem(word)) out.add(form);
  return out;
}

/** The most specific shape the text names, or null. */
function findNamedShape(words: Set<string>): PartFn | null {
  const hits: PartFn[] = [];
  for (const word of words) {
    const shape = WORD_SHAPES[word];
    if (shape && !hits.includes(shape)) hits.push(shape);
  }
  return hits.length > 0 ? hits[0] : null;
}

/**
 * Scores every topic by how many of its keywords the text uses, weighting the
 * player's answer far above the template. Returns the best, rather than a
 * random one of everything that matched — a prompt about a dog shouldn't have
 * an even chance of coming out as a spaceship because "space" appeared in the
 * boilerplate.
 */
function detectTopic(rng: Rng, prompt: string, answer: string): { primary: Topic | null; all: Topic[] } {
  const answerWords = expand(answer);
  const promptWords = expand(prompt);

  const scored: { topic: Topic; score: number }[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_WORDS) as [Topic, string[]][]) {
    let score = 0;
    for (const keyword of keywords) {
      if (answerWords.has(keyword)) score += 4;
      else if (promptWords.has(keyword)) score += 1;
    }
    if (score > 0) scored.push({ topic, score });
  }
  if (scored.length === 0) return { primary: null, all: [] };

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].score;
  // Ties broken at random so repeated prompts still vary.
  const top = scored.filter((s) => s.score === best).map((s) => s.topic);
  return { primary: rng.pick(top), all: scored.map((s) => s.topic) };
}

/** Stable-ish seed from the prompt plus the artist, so two artists given the
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
  if (ctx.subjects.length > 0 && rng.chance(0.85)) rng.pick(ctx.subjects)(pen, rng, box);
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
    () => parts.vent(pen, rng, box),
    () => parts.hatch(pen, rng, box),
    () => parts.nameplate(pen, rng, box),
    () => parts.hose(pen, rng, box),
    () => parts.nozzle(pen, rng, box),
    () => parts.crank(pen, rng, box),
    () => parts.propeller(pen, rng, box),
    () => parts.solarPanel(pen, rng, box),
    () => parts.bellOnTop(pen, rng, box),
    () => parts.tank(pen, rng, box),
    () => parts.eyes(pen, rng, box),
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

/** Something to stand on — or nothing, which is itself a change of look.
 *
 * Deliberately many options with none dominant. Wheels used to be 38% of every
 * drawing that called this, which is exactly the kind of thing that makes a
 * gallery of doodles look like one doodle. */
function base(pen: Pen, rng: Rng, box: Box): void {
  const options: (() => void)[] = [
    () => parts.wheels(pen, rng, box),
    () => parts.legs(pen, rng, box),
    () => parts.spring(pen, rng, box),
    () => parts.treads(pen, rng, box),
    () => parts.tripod(pen, rng, box),
    () => parts.skids(pen, rng, box),
    () => parts.plinth(pen, rng, box),
    () => parts.hover(pen, rng, box),
    () => parts.pole(pen, rng, box),
    () => {}, // sitting on nothing at all
  ];
  rng.pick(options)();
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
  details(pen, rng, box, rng.int(1, 2));
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

  // The bolted-on invention is the joke, but not every time — a clean object
  // is often the clearer read.
  if (rng.chance(0.7)) {
    const gw = rng.range(0.12, 0.17);
    const gh = rng.range(0.09, 0.14);
    const gadget = beside(rng, box, gw, gh);
    parts.machineBody(pen, rng, gadget);
    details(pen, rng, gadget, rng.int(1, 2));
  }
  accents(pen, rng, ctx, box);
  return box;
};

/** Layouts that actually put the subject on stage.
 *
 * Most of the general layouts build their body from `machineBody` directly,
 * which is right when all we have is a vague topic — but wrong the moment we
 * know the prompt says "alarm". Knowing what to draw and then burying it under
 * a generic contraption is the whole failure mode this avoids. */
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

/** Weighted so a named subject is nearly always the hero: mostly `showcase`
 *  (the object large, with the invention bolted on), sometimes a plain hero or
 *  a scene with the person it's for, occasionally hanging above its target. */
const NAMED_LAYOUTS: readonly Layout[] = [
  showcase, showcase, showcase, showcase, showcase,
  hero, hero,
  duo,
  hanging,
];

/** Below this many strokes a drawing looks unfinished rather than minimal.
 *  Tuned against a contact sheet — most drawings land in the high teens. */
const MIN_STROKES = 14;

/** Marks added on top of whatever was drawn, sparingly. */
function finishingMarks(pen: Pen, rng: Rng, ctx: Ctx): void {
  pen.setColor(rng.chance(0.6) ? ctx.accent : ctx.ink);
  if (rng.chance(0.3)) parts.sparkles(pen, rng, { x: 0.2, y: 0.12, w: 0.6, h: 0.3 });
  if (rng.chance(0.16)) {
    pen.setColor(ctx.accent);
    parts.lightbulb(pen, rng, rng.range(0.13, 0.24), rng.range(0.15, 0.23), rng.range(0.035, 0.05));
  }
  if (rng.chance(0.16)) {
    pen.setColor(ctx.accent);
    parts.exclaim(pen, rng, rng.range(0.78, 0.9), rng.range(0.16, 0.26), rng.range(0.04, 0.06));
  }
}

/**
 * Composes a doodle for [prompt].
 *
 * [answer] is the blank the player filled in, passed separately because it is
 * the only part of the sentence they chose — matching leans on it heavily.
 * Pass "" when there isn't one (the idle canvas), and the whole sentence is
 * used instead.
 *
 * Picks a page layout first, then fills it, so two drawings differ in their
 * whole arrangement rather than just in which knobs ended up on the same box.
 */
export function drawForPrompt(prompt: string, answer: string, artistSalt: string): Stroke[] {
  const rng = new Rng(seedFrom(prompt, artistSalt));
  // Some "people" have a steadier hand than others, and press harder.
  const pen = new Pen(rng, rng.range(0.7, 1.5));
  pen.setWidthScale(rng.range(0.78, 1.25));

  const ink = rng.pick(INKS);
  const accent = rng.pick(ACCENTS);
  pen.setColor(ink);

  const { primary, all: topics } = detectTopic(rng, prompt, answer);

  // Three tiers, most specific first: a thing the answer names, a thing the
  // sentence names, then whatever the topic can generally be drawn as.
  const named = findNamedShape(expand(answer)) ?? findNamedShape(expand(prompt));
  const subjects: readonly PartFn[] = named
    ? [named]
    : primary
        ? TOPIC_SUBJECTS[primary] ?? []
        : [];
  const ctx: Ctx = { ink, accent, primary, topics, subjects };

  // A prompt with something drawable in it should often lead with that thing
  // rather than burying it behind another machine.
  // When we know exactly what to draw, only layouts that stage the subject are
  // eligible. When it's a topical guess, spread across everything as before.
  const pool = subjects.length === 0
    ? GENERAL_LAYOUTS
    : named
        ? NAMED_LAYOUTS
        : [...GENERAL_LAYOUTS, showcase, showcase, showcase, showcase];
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
