import type { Stroke } from "../types.js";
import { Pen, Rng } from "./pen.js";
import * as parts from "./parts.js";
import type { Box } from "./parts.js";

/** Ink colours a person might grab first, plus a few accents for details. */
const INKS = ["#1A1A1A", "#1A1A1A", "#1A1A1A", "#243447", "#3A2A22"];
const ACCENTS = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#FDD835"];

/** Shading and backdrop ink. Lighter than the outline on purpose: these marks
 *  have to sit behind the subject, and on this paper a mid grey reads as the
 *  side of the pencil rather than as another outline competing for attention. */
const SHADES = ["#8C9199", "#7E8790", "#94918A"];

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

/** A few parts take a centre and radius rather than a box; these let them sit
 *  in the same lookup as everything else. Declared above the tables below
 *  because they're referenced from them at module-init time. */
const centred = (
  draw: (pen: Pen, rng: Rng, cx: number, cy: number, r: number) => void,
  scale = 0.42,
): PartFn => (pen, rng, box) =>
  draw(pen, rng, box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) * scale);

const dumbbellShape = centred(parts.dumbbell, 0.5);
const coinShape = centred(parts.coin);
const bulbShape = centred(parts.lightbulb, 0.34);

/** Every topic that can be drawn as *something* should be. A topic with no
 *  entry here falls through to a generic machine, so the gaps were a direct
 *  source of same-looking output for any prompt the word map didn't catch. */
const TOPIC_SUBJECTS: Partial<Record<Topic, readonly PartFn[]>> = {
  vehicle: [parts.car, parts.trafficLight, parts.bicycle],
  home: [parts.house, parts.crate, parts.windowFrame],
  animal: [parts.animal, parts.bird],
  space: [parts.rocket],
  food: [parts.foodStack, parts.mug, parts.cake],
  sleep: [parts.bed, parts.alarmClock],
  weather: [parts.umbrella, parts.plant, parts.fan, parts.snowman],
  tech: [parts.phoneDevice, parts.laptop, parts.gameController],
  time: [parts.alarmClock, parts.queue],
  clean: [parts.sock, parts.crate, parts.sprayBottle, parts.washingLine],
  garden: [parts.plant, parts.tree],
  money: [coinShape, parts.piggyBank, parts.receipt],
  person: [parts.queue, parts.pram],
  fitness: [parts.treadmill, dumbbellShape],
  music: [parts.guitar, parts.speaker],
  fire: [parts.fireExtinguisher],
  noise: [parts.speaker],
  water: [parts.bottle, parts.tap],
  flight: [parts.bird],
};

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
  // "flat" is not here: as an answer it is far more often "flat battery" or
  // "flat tyre" than a home, and it was drawing houses for both.
  house: parts.house, home: parts.house, apartment: parts.house,
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
  money: coinShape, cash: coinShape, rent: coinShape, price: coinShape,
  // A restaurant "bill" is a slip of paper, not a coin — and splitting one is
  // a prompt people actually write.
  bill: parts.receipt, bills: parts.receipt, receipt: parts.receipt,
  invoice: parts.receipt, tax: parts.receipt, expenses: parts.receipt,
  savings: parts.piggyBank, saving: parts.piggyBank, budget: parts.piggyBank,
  pension: parts.piggyBank,
  card: parts.creditCard, subscription: parts.creditCard,
  subscriptions: parts.creditCard, payment: parts.creditCard,
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
  reminder: parts.calendar,
  sign: parts.signpost, signs: parts.signpost, directions: parts.signpost,
  rules: parts.signpost,
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

  // --- added to widen coverage -------------------------------------------
  // Everything below was a word people plausibly type that previously fell
  // through to a generic contraption. This map is the highest-leverage place
  // to add accuracy, so it's worth growing whenever a real answer misses.
  queue: parts.queue, queues: parts.queue, waiting: parts.queue,
  lines: parts.queue, crowd: parts.queue, crowds: parts.queue,
  trolley: parts.trolley, cart: parts.trolley, supermarket: parts.trolley,
  checkout: parts.trolley,
  printer: parts.printer, printing: parts.printer, scanner: parts.printer,
  photocopier: parts.printer,
  gaming: parts.gameController, videogames: parts.gameController,
  console: parts.gameController, controller: parts.gameController,
  spanner: parts.wrench, wrench: parts.wrench, repairs: parts.wrench,
  repair: parts.wrench, mechanic: parts.wrench, plumber: parts.wrench,
  padlock: parts.padlock, password: parts.padlock, passwords: parts.padlock,
  security: parts.padlock, locked: parts.padlock,
  fever: parts.thermometer, temperature: parts.thermometer,
  thermostat: parts.thermometer, heating: parts.thermometer,
  wine: parts.wineGlass, cocktail: parts.wineGlass, drinks: parts.wineGlass,
  cake: parts.cake, birthday: parts.cake, candles: parts.cake,
  celebration: parts.cake, party: parts.cake,
  pram: parts.pram, stroller: parts.pram, buggy: parts.pram, nappies: parts.pram,
  guitar: parts.guitar, band: parts.guitar, busker: parts.guitar,
  drying: parts.washingLine, clothesline: parts.washingLine,
  window: parts.windowFrame, windows: parts.windowFrame,
  curtains: parts.windowFrame, blinds: parts.windowFrame,
  teapot: parts.teapot,
  helmet: parts.helmet, hardhat: parts.helmet, safety: parts.helmet,
  snowman: parts.snowman,
  toolbox: parts.toolbox, tools: parts.toolbox,
  // A clipboard reads as admin far better than a signpost does.
  forms: parts.clipboard, paperwork: parts.clipboard, admin: parts.clipboard,
  checklist: parts.clipboard, survey: parts.clipboard, clipboard: parts.clipboard,
  spray: parts.sprayBottle, disinfectant: parts.sprayBottle,
  polish: parts.sprayBottle, bleach: parts.sprayBottle,
  extinguisher: parts.fireExtinguisher,
  mirror: parts.mirror, reflection: parts.mirror, makeup: parts.mirror,
  trafficlight: parts.trafficLight, junction: parts.trafficLight,
  crossing: parts.trafficLight, roundabout: parts.trafficLight,

  // --- second wave --------------------------------------------------------
  // Chosen by measurement rather than taste: a list of answers people
  // plausibly type was matched against this map, and these were the misses.
  // Bathroom, public transport, pests and DIY had no coverage at all.

  // bathroom
  shower: parts.shower, showers: parts.shower, showering: parts.shower,
  bath: parts.shower, bathroom: parts.shower, plughole: parts.shower,
  toilet: parts.toilet, loo: parts.toilet, flush: parts.toilet,
  toiletpaper: parts.toiletRoll, looroll: parts.toiletRoll, tp: parts.toiletRoll,
  sponge: parts.sponge, scrubbing: parts.sponge, washingup: parts.sponge,
  soap: parts.sponge, suds: parts.sponge, lather: parts.sponge,
  towel: parts.towel, towels: parts.towel, bathmat: parts.towel,
  razor: parts.razor, shaving: parts.razor, stubble: parts.razor,
  shave: parts.razor,

  // pests
  bug: parts.bug, bugs: parts.bug, insect: parts.bug, insects: parts.bug,
  spider: parts.bug, spiders: parts.bug, fly: parts.bug, flies: parts.bug,
  mosquito: parts.bug, mosquitoes: parts.bug, wasp: parts.bug, wasps: parts.bug,
  ants: parts.bug, ant: parts.bug, cockroach: parts.bug, beetle: parts.bug,
  moth: parts.bug, bites: parts.bug, buzzing: parts.bug,

  // getting around, other than by car
  train: parts.train, trains: parts.train, tube: parts.train, subway: parts.train,
  metro: parts.train, platform: parts.train, railway: parts.train,
  underground: parts.train, carriage: parts.train,
  plane: parts.plane, planes: parts.plane, flight: parts.plane,
  flights: parts.plane, airplane: parts.plane, aeroplane: parts.plane,
  flying: parts.plane, boarding: parts.plane, delays: parts.plane,

  // power and heat
  plug: parts.plugSocket, socket: parts.plugSocket, sockets: parts.plugSocket,
  adapter: parts.plugSocket, extension: parts.plugSocket, unplugged: parts.plugSocket,
  radiator: parts.radiator, radiators: parts.radiator, heater: parts.radiator,
  candle: parts.candle, candlelight: parts.candle, powercut: parts.candle,
  blackout: parts.candle,

  // kitchen and chores
  oven: parts.oven, baking: parts.oven, roast: parts.oven, grill: parts.oven,
  iron: parts.iron, ironing: parts.iron, creases: parts.iron, wrinkles: parts.iron,
  can: parts.drinkCan, cans: parts.drinkCan, soda: parts.drinkCan,
  fizzy: parts.drinkCan, beer: parts.drinkCan,
  basket: parts.shoppingBasket, baskets: parts.shoppingBasket,

  // celebrations
  balloon: parts.balloon, balloons: parts.balloon,
  gift: parts.gift, gifts: parts.gift, present: parts.gift, presents: parts.gift,

  // pets and outdoors
  fish: parts.fish, goldfish: parts.fish, aquarium: parts.fish,
  fishtank: parts.fish, pond: parts.fish,
  fence: parts.fence, fences: parts.fence, gate: parts.fence,
  neighbours: parts.fence, neighbour: parts.fence, neighbors: parts.fence,
  lightning: parts.lightningBolt, thunder: parts.lightningBolt,
  storm: parts.lightningBolt, storms: parts.lightningBolt,
  thunderstorm: parts.lightningBolt,

  // diy
  screwdriver: parts.screwdriver, screw: parts.screwdriver,
  screws: parts.screwdriver, flatpacked: parts.screwdriver,
  drill: parts.drill, drilling: parts.drill, dust: parts.drill,

  // desk and admin
  stapler: parts.stapler, stapling: parts.stapler, staples: parts.stapler,
  calculator: parts.calculator, maths: parts.calculator, sums: parts.calculator,
  accounting: parts.calculator, invoices: parts.calculator,
  mailbox: parts.mailbox, postbox: parts.mailbox, postman: parts.mailbox,
  map: parts.mapSheet, maps: parts.mapSheet, roadmap: parts.mapSheet,
  navigation: parts.mapSheet, lost: parts.mapSheet,
  newspaper: parts.newspaper, newspapers: parts.newspaper,
  magazine: parts.newspaper, headlines: parts.newspaper, news: parts.newspaper,

  // waiting, noise, kids
  hourglass: parts.hourglass, sand: parts.hourglass, delay: parts.hourglass,
  microphone: parts.microphone, karaoke: parts.microphone, mic: parts.microphone,
  singing: parts.microphone, podcast: parts.microphone,
  teddy: parts.teddy, teddybear: parts.teddy, toy: parts.teddy,
  toys: parts.teddy, bear: parts.teddy, cuddly: parts.teddy,

  // --- synonyms for shapes that already existed ----------------------------
  // These were misses too, but the drawing was already there; only the word
  // was missing.
  tv: parts.television, monitor: parts.television,
  screen: parts.television,
  envelope: parts.envelope, stamp: parts.envelope, postage: parts.envelope,
  coins: coinShape, change: coinShape, coin: coinShape, wages: coinShape,
  salary: coinShape, fare: coinShape,
  table: parts.chair, tables: parts.chair, stool: parts.chair,
  keyboard: parts.laptop, typing: parts.laptop, workfromhome: parts.laptop,
  purse: parts.keys, handbag: parts.shoppingBag,
  blanket: parts.bed, duvets: parts.bed, sheets: parts.bed,
  curtain: parts.windowFrame,
  milk: parts.bottle, carton: parts.bottle, fizz: parts.bottle,
  egg: parts.foodStack, eggs: parts.foodStack, cereal: parts.foodStack,
  noodles: parts.foodStack, rice: parts.foodStack, soup: parts.foodStack,
  salad: parts.foodStack, fries: parts.foodStack, chips: parts.foodStack,
  torch: parts.lamp, flashlight: parts.lamp,
  ticket: parts.receipt, tickets: parts.receipt, passport: parts.receipt,
  bandage: parts.pill, plaster: parts.pill, injury: parts.pill,
  mask: parts.helmet,
  rope: parts.cables, string: parts.cables, chain: parts.cables,
  tape: parts.cables, glue: parts.cables, wire: parts.cables,
  scooter: parts.bicycle, motorbike: parts.bicycle, skateboard: parts.bicycle,
  moped: parts.bicycle,
  boat: parts.pontoon, ferry: parts.pontoon, ship: parts.pontoon,
  lawn: parts.plant, lawnmower: parts.plant, hedge: parts.plant,
  weeding: parts.plant, cactus: parts.plant,
  piano: parts.guitar, drums: parts.guitar, violin: parts.guitar,
  radio: parts.speaker, podcasts: parts.speaker,
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
/**
 * The most specific shape the text names, or null.
 *
 * When several words hit, the *last* wins. English noun phrases put the head
 * noun last — "flat phone battery" is a battery, "lost luggage" is luggage,
 * "cold showers" is a shower — and taking the first hit drew a house for the
 * first of those, because "flat" is also a word for an apartment.
 */
function findNamedShape(words: Set<string>): PartFn | null {
  let hit: PartFn | null = null;
  for (const word of words) {
    const shape = WORD_SHAPES[word];
    if (shape) hit = shape;
  }
  return hit;
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
  /** Pencil grey for shading and backdrop. */
  shade: string;
  /** True when the subject came from an exact word match rather than a topical
   *  guess, which is the difference between "draw a kettle" and "draw
   *  something kitchen-ish". */
  named: boolean;
  /** Which way the light falls. Fixed per drawing so the shadow under the
   *  subject and the shading on it agree with each other — they read as a
   *  mistake the moment they disagree. */
  lightFromLeft: boolean;
  primary: Topic | null;
  topics: Topic[];
  subjects: readonly PartFn[];
};

// --- shared building blocks ------------------------------------------------

/** The main mass of the drawing: the topic's own silhouette when it has one,
 *  otherwise a machine.
 *
 * The fallback rate is deliberately different for the two cases. A topical
 * guess ("this is vaguely about cleaning") is worth overriding sometimes. An
 * exact word match is not: when the answer says *dishes*, drawing a generic
 * canister instead is simply the wrong picture, and at one in seven it was
 * happening often enough to see on a single contact sheet. */
function chassis(pen: Pen, rng: Rng, ctx: Ctx, box: Box): void {
  const keep = ctx.named ? 0.97 : 0.85;
  if (ctx.subjects.length > 0 && rng.chance(keep)) rng.pick(ctx.subjects)(pen, rng, box);
  else parts.machineBody(pen, rng, box);
}

/** Everyday clutter on the floor beside the subject: the difference between an
 *  object photographed against white and an object in a room. Placed outside
 *  the subject's own footprint, and skipped when there is no room. */
function sceneProps(pen: Pen, rng: Rng, ctx: Ctx, focus: Box): void {
  // Only shapes that still read at this size. Anything with interior detail
  // collapses into a dark smudge once it is a tenth of the page wide.
  const PROPS: readonly PartFn[] = [
    parts.mug, parts.crate, parts.bottle, parts.trashBin,
    parts.bucket, parts.book, parts.plant, parts.ball,
  ];
  const footY = Math.min(0.9, focus.y + focus.h);
  for (let i = 0; i < rng.int(1, 2); i++) {
    const w = rng.range(0.11, 0.17);
    const h = w * rng.range(0.9, 1.3);
    // Hug whichever margin the subject left free.
    const leftRoom = focus.x - 0.06;
    const rightRoom = 0.94 - (focus.x + focus.w);
    if (Math.max(leftRoom, rightRoom) < w) return;
    const onLeft = leftRoom > rightRoom ? true : rightRoom > leftRoom ? false : rng.chance(0.5);
    const x = onLeft ? rng.range(0.05, Math.max(0.05, leftRoom - w)) : rng.range(focus.x + focus.w + 0.02, 0.94 - w);
    const y = footY - h + rng.range(-0.02, 0.02);
    if (y < 0.1) return;
    rng.pick(PROPS)(pen, rng, { x, y, w, h });
    pen.setColor(ctx.shade);
    parts.groundShadow(pen, rng, { x, y, w, h });
    pen.setColor(ctx.ink);
  }
}

/** The drawing in progress. Set by drawForPrompt before any layout runs, so
 *  the helpers below can tell a real thing from a machine without every one
 *  of a dozen call sites having to be told. */
let current: Ctx | null = null;

/**
 * Bolts [count] distinct fittings onto a body — but only a *machine's* body.
 *
 * This was the single biggest source of drawings that made no sense: the same
 * pool that gives a contraption its dials and levers was being applied to
 * whatever the answer named, so a cake got a hose, a speaker got a propeller,
 * and a toilet got a crank. On a machine those are its identity; on a real
 * object they are noise. When the drawing has a subject, this does nothing,
 * and `fittings` exists for the one place a machine is wanted next to one.
 */
function details(pen: Pen, rng: Rng, box: Box, count: number): void {
  if (current && current.subjects.length > 0) return;
  fittings(pen, rng, box, count);
}

/** Fittings, unconditionally. For bodies that really are machines. */
function fittings(pen: Pen, rng: Rng, box: Box, count: number): void {
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
    () => parts.rivets(pen, rng, box),
    () => parts.gauge(pen, rng, box),
    () => parts.toggleSwitch(pen, rng, box),
    () => parts.chimney(pen, rng, box),
    () => parts.clawGrabber(pen, rng, box),
    () => parts.sirenLight(pen, rng, box),
    () => parts.keypad(pen, rng, box),
    () => parts.slot(pen, rng, box),
    () => parts.beltDrive(pen, rng, box),
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
  // A toilet on wheels and a snowflake on a spring were both real output.
  // Things that stand on something already draw it themselves.
  if (current && current.subjects.length > 0) return;
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
    () => parts.stilts(pen, rng, box),
    () => parts.railTrack(pen, rng, box),
    () => parts.pontoon(pen, rng, box),
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

/** Accents that draw *onto* the subject rather than beside it. Right on a
 *  machine, wrong on a thing: wings on a bird that already has wings, a
 *  screen stuck across a laptop, plus-signs over a cake. */
const ON_BODY: ReadonlySet<Topic> = new Set<Topic>(["tech", "flight", "space"]);

function accents(pen: Pen, rng: Rng, ctx: Ctx, box: Box): void {
  if (!ctx.primary) return;
  const hasSubject = ctx.subjects.length > 0;
  pen.setColor(ctx.ink);
  if (!(hasSubject && ON_BODY.has(ctx.primary))) {
    topicAccents(pen, rng, ctx.primary, box, ctx.accent);
  }
  // A second topic sometimes sneaks in when the prompt mentions several —
  // rarely, on a real thing, where a second decoration is usually one too many.
  const secondary = ctx.topics.find((t) => t !== ctx.primary);
  if (secondary && !(hasSubject && ON_BODY.has(secondary)) && rng.chance(hasSubject ? 0.25 : 0.5)) {
    pen.setColor(ctx.ink);
    topicAccents(pen, rng, secondary, box, ctx.accent);
  }
  pen.setColor(ctx.ink);
}

// --- depth -----------------------------------------------------------------

/** Topics that happen outdoors, and so want sky behind them rather than a
 *  skirting board. */
const OUTDOOR: ReadonlySet<Topic> = new Set<Topic>(["garden", "weather", "flight", "space", "vehicle"]);

/**
 * Puts the subject somewhere.
 *
 * Drawn *after* the subject, then moved to the front of the stroke list by the
 * caller, so it can be positioned around whatever was actually drawn while
 * still replaying behind it.
 *
 * Everything here is deliberately thin and grey. A backdrop that competes with
 * the subject is worse than no backdrop at all — the point is to give the page
 * a floor and a wall so the drawing stops reading as a cut-out.
 */
function backdrop(pen: Pen, rng: Rng, ctx: Ctx, focus: Box, grounded: boolean): void {
  pen.setColor(ctx.shade);

  const outdoors = ctx.primary !== null && OUTDOOR.has(ctx.primary);
  // Below the subject, but never so low it falls off the page.
  const floorY = Math.min(0.88, Math.max(0.6, focus.y + focus.h + rng.range(0.02, 0.07)));

  // A floor line is not decoration, it is the thing that stops the subject
  // hanging in space — so anything standing on something gets one, and only
  // the extras are left to chance. Leaving this to a dice roll put a handful
  // of drawings a sheet back to floating on blank paper.
  if (grounded) parts.roomFloor(pen, rng, floorY);

  if (outdoors) {
    parts.skyline(pen, rng);
    pen.setColor(ctx.ink);
    return;
  }

  const choice = rng.int(0, 4);
  if (choice === 0 && grounded) {
    parts.floorBoards(pen, rng, floorY);
  } else if (choice === 1) {
    parts.roomCorner(pen, rng, floorY, focus);
  } else if (choice === 2 && focus.y > 0.24) {
    // Only when the subject leaves room for it — a window drawn over the
    // subject is the one way this makes the page worse.
    parts.backWindow(pen, rng);
  }
  // The rest leave it at just the floor, which plenty of drawings want.

  pen.setColor(ctx.ink);
}

/** Shading on the subject and its shadow on the floor. The single biggest
 *  difference between these drawings and the flat outlines they used to be. */
function depth(pen: Pen, rng: Rng, ctx: Ctx, focus: Box, grounded: boolean): void {
  pen.setColor(ctx.shade);
  if (rng.chance(0.8)) parts.shadeSide(pen, rng, focus, ctx.lightFromLeft);
  if (grounded && rng.chance(0.85)) parts.groundShadow(pen, rng, focus);
  pen.setColor(ctx.ink);
}

// --- page layouts ----------------------------------------------------------
// The single biggest source of "these all look the same" was that every
// drawing was one medium box in the middle of the page. Varying the whole
// arrangement changes the read far more than swapping which dial goes on it.

type Layout = (pen: Pen, rng: Rng, ctx: Ctx) => Box;

/** One machine, centred. The classic. */
const hero: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.42, 0.56);
  const h = rng.range(0.34, 0.48);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.05, 0.05), y: 0.42 - h / 2 + rng.range(-0.04, 0.06), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(2, 4));
  base(pen, rng, box);
  accents(pen, rng, ctx, box);
  return box;
};

/** Tall and narrow — a stack rather than a console. */
const tower: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.23, 0.33);
  const h = rng.range(0.48, 0.6);
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
  const w = rng.range(0.56, 0.72);
  const h = rng.range(0.21, 0.3);
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
  const w = rng.range(0.34, 0.46);
  const h = rng.range(0.32, 0.44);
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
  const w = rng.range(0.3, 0.4);
  const h = rng.range(0.34, 0.44);
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

/** Somebody wearing the homework on their head. */
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
  const w = rng.range(0.32, 0.42);
  const h = rng.range(0.3, 0.4);
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

/** The everyday object itself, large, with the homework bolted onto it. */
const showcase: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.5, 0.64);
  const h = rng.range(0.4, 0.52);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.04, 0.04), y: rng.range(0.18, 0.28), w, h };
  rng.pick(ctx.subjects)(pen, rng, box);

  // The bolted-on homework is the joke, but not every time — a clean object
  // is often the clearer read.
  if (rng.chance(0.45)) {
    const gw = rng.range(0.12, 0.17);
    const gh = rng.range(0.09, 0.14);
    const gadget = beside(rng, box, gw, gh);
    parts.machineBody(pen, rng, gadget);
    // `fittings`, not `details`: this box *is* a machine, sitting beside the
    // subject, and a dial is what makes it read as one.
    fittings(pen, rng, gadget, rng.int(1, 2));
  }
  accents(pen, rng, ctx, box);
  return box;
};

/** A patent sheet: the thing boxed off, with callout bubbles pointing at its
 *  parts. Fits the game better than anything else here — the whole premise is
 *  presenting a stupid bit of homework as if it were a real filing. */
const patentDiagram: Layout = (pen, rng, ctx) => {
  const frame: Box = { x: 0.08, y: 0.14, w: 0.84, h: 0.7 };
  if (rng.chance(0.55)) {
    parts.panelFrame(pen, rng, frame);
  } else {
    // Corner crop marks instead of a full border. Same "this is a filing"
    // read, without a hard rectangle around a fifth of all drawings.
    pen.setWidth(rng.range(2.4, 3));
    const c = 0.07;
    for (const [cx, cy, sx, sy] of [
      [frame.x, frame.y, 1, 1],
      [frame.x + frame.w, frame.y, -1, 1],
      [frame.x, frame.y + frame.h, 1, -1],
      [frame.x + frame.w, frame.y + frame.h, -1, -1],
    ] as const) {
      pen.line({ x: cx, y: cy }, { x: cx + sx * c, y: cy }, 0.5);
      pen.line({ x: cx, y: cy }, { x: cx, y: cy + sy * c }, 0.5);
    }
  }

  const w = rng.range(0.38, 0.5);
  const h = rng.range(0.32, 0.42);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.06, 0.02), y: 0.44 - h / 2 + rng.range(-0.03, 0.05), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(1, 3));

  // Callout bubbles on leader lines. No text engine here, so a bubble with a
  // tick inside stands in for a number — at thumbnail size it reads the same.
  pen.setWidth(2.2);
  const spots: { x: number; y: number }[] = [
    { x: box.x + box.w * 0.2, y: box.y },
    { x: box.x + box.w, y: box.y + box.h * 0.4 },
    { x: box.x + box.w * 0.5, y: box.y + box.h },
  ];
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const from = spots[i];
    const outX = from.x + (from.x > 0.5 ? 1 : -1) * rng.range(0.1, 0.16);
    const outY = from.y + (i === 2 ? rng.range(0.08, 0.13) : rng.range(-0.12, -0.06));
    pen.line(from, { x: outX, y: outY }, 0.5);
    pen.circle(outX, outY, rng.range(0.022, 0.03));
    pen.setWidth(1.8);
    pen.line({ x: outX, y: outY - 0.012 }, { x: outX, y: outY + 0.012 }, 0.4);
    pen.setWidth(2.2);
  }
  accents(pen, rng, ctx, box);
  return box;
};

/** A heap of the same thing. The joke of "too many of these" carries prompts
 *  about socks, dishes, boxes and laundry better than one tidy object does. */
const pileUp: Layout = (pen, rng, ctx) => {
  // Some subjects are already a plural arrangement — a queue is several people,
  // a washing line is several clothes. Heaping those reads as noise and costs a
  // fortune in strokes, so they get a crate pile instead.
  const ALREADY_PLURAL: readonly PartFn[] = [parts.queue, parts.washingLine];
  const candidate = ctx.subjects.length > 0 ? rng.pick(ctx.subjects) : parts.crate;
  const draw: PartFn = ALREADY_PLURAL.includes(candidate) ? parts.crate : candidate;

  const baseY = rng.range(0.62, 0.72);
  const n = rng.int(4, 6);
  let focus: Box = { x: 0.36, y: baseY - 0.18, w: 0.28, h: 0.2 };

  // The idle canvas replays every stroke on a clock, so a pile of an expensive
  // subject would run for a minute. Budget by what the first copy actually
  // cost rather than guessing per-subject.
  const STROKE_BUDGET = 44;
  const startedAt = pen.strokes.length;

  for (let i = 0; i < n; i++) {
    if (i >= 2 && pen.strokes.length - startedAt > STROKE_BUDGET) break;
    const row = i < 3 ? 0 : i < 5 ? 1 : 2;
    const inRow = i < 3 ? i : i < 5 ? i - 3 : 0;
    const perRow = row === 0 ? 3 : row === 1 ? 2 : 1;
    const size = rng.range(0.15, 0.2) * (1 - row * 0.08);
    const spread = 0.62;
    const x = 0.5 - spread / 2 + (spread / perRow) * (inRow + 0.5) - size / 2 + rng.range(-0.03, 0.03);
    const y = baseY - row * size * 0.82 - size;
    const b: Box = { x, y, w: size, h: size * rng.range(0.8, 1.05) };
    draw(pen, rng, b);
    if (row === 0 && inRow === 1) focus = b;
  }

  // A ground line stops the pile floating.
  pen.setWidth(3);
  pen.line({ x: 0.14, y: baseY + 0.02 }, { x: 0.86, y: baseY + 0.02 }, 0.6);
  accents(pen, rng, ctx, focus);
  return focus;
};

/** The homework drawn absurdly large next to a normal-sized person. Scale is
 *  a joke you can read instantly, and it makes the page look nothing like the
 *  medium-box-in-the-middle default. */
const scaleGag: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.44, 0.56);
  const h = rng.range(0.46, 0.58);
  const box: Box = { x: rng.range(0.08, 0.16), y: rng.range(0.14, 0.22), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(2, 4));
  base(pen, rng, box);

  const feetY = box.y + box.h + rng.range(0.02, 0.06);
  parts.stickPerson(pen, rng, rng.range(0.8, 0.88), Math.min(feetY, 0.93), rng.range(0.16, 0.22));
  accents(pen, rng, ctx, box);
  return box;
};

/** Sitting on a surface, with a horizon behind it. A room rather than a void. */
const tableTop: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.38, 0.5);
  const h = rng.range(0.32, 0.42);
  const tableY = rng.range(0.6, 0.68);
  const box: Box = { x: 0.5 - w / 2 + rng.range(-0.08, 0.08), y: tableY - h, w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(1, 3));

  // Three ways to stand it up. One fixed table silhouette under every drawing
  // becomes its own kind of repetition, however varied the thing on top is.
  pen.setWidth(rng.range(3.4, 4.2));
  const surface = rng.int(0, 2);
  if (surface === 0) {
    pen.line({ x: 0.1, y: tableY }, { x: 0.9, y: tableY }, 0.7);
    for (const fx of [0.2, 0.8]) {
      pen.line({ x: fx, y: tableY }, { x: fx + rng.range(-0.02, 0.02), y: tableY + rng.range(0.14, 0.2) }, 0.7);
    }
  } else if (surface === 1) {
    // A bare floor line running the full width — a room, not furniture.
    pen.line({ x: 0.05, y: tableY }, { x: 0.95, y: tableY }, 0.8);
  } else {
    // A shelf, bracketed to the wall.
    const x0 = box.x - rng.range(0.06, 0.12);
    const x1 = box.x + box.w + rng.range(0.06, 0.12);
    pen.line({ x: x0, y: tableY }, { x: x1, y: tableY }, 0.7);
    pen.setWidth(2.6);
    pen.polyline([{ x: x0 + 0.03, y: tableY }, { x: x0 + 0.03, y: tableY + 0.08 }, { x: x0 + 0.11, y: tableY }], false, 0.6);
  }
  // A small prop on the table beside it, so the surface reads as a surface.
  if (rng.chance(0.55)) {
    const p: Box = { x: box.x + box.w + 0.04, y: tableY - 0.1, w: 0.1, h: 0.1 };
    if (p.x + p.w < 0.9) parts.mug(pen, rng, p);
  }
  accents(pen, rng, ctx, box);
  return box;
};

/** Three panels in a row — a sequence, or three variations of the idea. */
const triptych: Layout = (pen, rng, ctx) => {
  const y = rng.range(0.32, 0.4);
  const h = rng.range(0.24, 0.3);
  const w = 0.26;
  const gap = (1 - 0.12 - w * 3) / 2;
  let focus: Box = { x: 0.06, y, w, h };

  for (let i = 0; i < 3; i++) {
    const panel: Box = { x: 0.06 + i * (w + gap), y, w, h };
    parts.panelFrame(pen, rng, panel);
    const inner: Box = {
      x: panel.x + w * 0.16,
      y: panel.y + h * 0.18,
      w: w * 0.68,
      h: h * (0.5 + i * 0.12),
    };
    // Each panel a bit more elaborate than the last, so it reads as a sequence.
    chassis(pen, rng, ctx, inner);
    details(pen, rng, inner, i);
    if (i === 1) focus = inner;
  }
  accents(pen, rng, ctx, focus);
  return focus;
};

/** The thing in the middle with the mess it deals with circling it. */
const orbit: Layout = (pen, rng, ctx) => {
  const w = rng.range(0.32, 0.4);
  const h = rng.range(0.28, 0.36);
  const box: Box = { x: 0.5 - w / 2, y: 0.5 - h / 2 + rng.range(-0.04, 0.04), w, h };
  chassis(pen, rng, ctx, box);
  details(pen, rng, box, rng.int(1, 2));

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const n = rng.int(3, 5);
  const start = rng.range(0, Math.PI * 2);
  pen.setColor(ctx.accent);
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const rx = box.w * rng.range(1.05, 1.35);
    const ry = box.h * rng.range(1.15, 1.5);
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    if (px < 0.08 || px > 0.92 || py < 0.08 || py > 0.92) continue;
    pen.setWidth(2.4);
    if (rng.chance(0.5)) parts.sparkles(pen, rng, { x: px - 0.03, y: py - 0.03, w: 0.06, h: 0.06 });
    else pen.star(px, py, rng.range(0.018, 0.028), rng.int(4, 5));
  }
  pen.setColor(ctx.ink);
  accents(pen, rng, ctx, box);
  return box;
};

/** Layouts that actually put the subject on stage.
 *
 * Most of the general layouts build their body from `machineBody` directly,
 * which is right when all we have is a vague topic — but wrong the moment we
 * know the prompt says "alarm". Knowing what to draw and then burying it under
 * a generic contraption is the whole failure mode this avoids. */
/** For when nothing in the prompt could be drawn as a thing, so the drawing
 *  is a contraption — the one case where dials, wheels and a blueprint frame
 *  are the point. `wearable`, `hanging` and `orbit` are gone even here: a box
 *  on a stick figure's head, a box with strings dropping onto something, and
 *  a ring of stars all read as arbitrary shapes rather than as a machine. */
const MACHINE_LAYOUTS: readonly Layout[] = [
  hero,
  tower,
  bench,
  creature,
  handheld,
  duo,
  beforeAfter,
  patentDiagram,
  pileUp,
  scaleGag,
  tableTop,
  triptych,
];

/** Weighted so a named subject is nearly always the hero, but spread across
 *  every layout that can actually stage one.
 *
 * This pool used to be `showcase`×5 plus three others, which looked balanced
 * on paper and wasn't: most answers people type *do* hit WORD_SHAPES, so this
 * is the pool nearly every drawing comes from, and `showcase` alone was over
 * half of all output. Everything below stages its subject rather than burying
 * it, so widening the pool costs no accuracy — it just stops the gallery
 * looking like one picture. Keep it that way when adding more: a layout only
 * belongs here if it calls `chassis` or draws `ctx.subjects` itself. */
const NAMED_LAYOUTS: readonly Layout[] = [
  showcase, showcase, showcase,
  hero, hero,
  tableTop, tableTop,
  scaleGag,
  pileUp,
  duo,
  // `triptych` is out too: three panels each a quarter of the page turned a
  // named subject into three unreadable thumbnails. It stays for machines,
  // where "the same box, more elaborate each time" is the joke.
  // Not here, on purpose: `patentDiagram` (its callout bubbles — a circle on
  // a stick — were the most-reported "random shape"), `orbit` (stars around a
  // kettle), and `hanging` (a box with strings dropping onto the subject).
  // All three make sense around a machine and nonsense around a thing.
];

/** Layouts whose focus isn't standing on anything: a panel of a comic strip,
 *  a thing hanging off the ceiling, a hat. Dropping a floor shadow under those
 *  puts a puddle of dark in mid-air. */
const UNGROUNDED: ReadonlySet<Layout> = new Set<Layout>([
  hanging,
  wearable,
  beforeAfter,
  triptych,
  orbit,
]);

/** Below this many strokes a drawing looks unfinished rather than minimal.
 *
 * Was 14, which is what a bare silhouette costs — and with the word map now
 * catching most answers, a bare silhouette is exactly what a lot of prompts
 * were getting: one small object, correctly drawn, alone on a big empty page.
 * Accurate and thin still reads as worse than the contraptions it replaced.
 *
 * It only counts what the layout drew, before the backdrop and shading add
 * their own dozen or so. Pushed much past this and the top-up stops being a
 * safety net and starts bolting dials onto things that were already finished. */
const MIN_STROKES = 21;

/** Marks added on top of whatever was drawn, sparingly — and only over a
 *  contraption. A stray lightbulb, an exclamation mark and a handful of plus
 *  signs floating in a corner were, with the fittings, most of what made a
 *  page look like random shapes. Over a machine they are the "eureka" of the
 *  joke; over a drawing of a cat they are litter. */
function finishingMarks(pen: Pen, rng: Rng, ctx: Ctx): void {
  if (ctx.subjects.length > 0) return;
  pen.setColor(ctx.accent);
  if (rng.chance(0.15)) parts.sparkles(pen, rng, { x: 0.2, y: 0.12, w: 0.6, h: 0.3 });
  if (rng.chance(0.12)) {
    parts.lightbulb(pen, rng, rng.range(0.13, 0.24), rng.range(0.15, 0.23), rng.range(0.035, 0.05));
  }
  pen.setColor(ctx.ink);
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
  const shade = rng.pick(SHADES);
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
  const ctx: Ctx = {
    ink,
    accent,
    shade,
    named: named !== null,
    lightFromLeft: rng.chance(0.5),
    primary,
    topics,
    subjects,
  };
  current = ctx;

  // Anything with a subject — named outright, or guessed from the topic —
  // gets staged as that subject. Only a prompt with nothing drawable in it
  // becomes a contraption. The topical case used to draw from the machine
  // pool half the time, which is how "traffic" came out as a box on wheels
  // when the topic had a perfectly good car to offer.
  const pool = subjects.length === 0 ? MACHINE_LAYOUTS : NAMED_LAYOUTS;
  const layout = rng.pick(pool);
  const focus = layout(pen, rng, ctx);

  // Some layouts can land thin — a bare silhouette and little else, which
  // reads as abandoned rather than simple. A machine is topped up with more
  // machine; a thing is topped up with more *room* around it, never with
  // fittings bolted onto it.
  pen.setColor(ink);
  const thin = pen.strokes.length < MIN_STROKES;
  if (thin && subjects.length === 0) {
    for (let attempt = 0; attempt < 3 && pen.strokes.length < MIN_STROKES; attempt++) {
      details(pen, rng, focus, 2);
    }
  }

  const grounded = !UNGROUNDED.has(layout);
  if (grounded && (thin || rng.chance(0.5))) sceneProps(pen, rng, ctx, focus);

  depth(pen, rng, ctx, focus, !UNGROUNDED.has(layout));

  // The backdrop is drawn last so it can be placed around the finished
  // drawing, then moved to the front so it replays behind it. Both matter: a
  // backdrop that can't see the subject draws through it, and one that arrives
  // last looks like it was scribbled over the top.
  const backdropAt = pen.strokes.length;
  backdrop(pen, rng, ctx, focus, !UNGROUNDED.has(layout));
  pen.strokes.unshift(...pen.strokes.splice(backdropAt));

  finishingMarks(pen, rng, ctx);
  return pen.strokes;
}
