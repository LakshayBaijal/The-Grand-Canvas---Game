import { randomUUID } from "node:crypto";
import type { DrawingEntry, Stroke } from "./types.js";
import { drawForPrompt } from "./doodle/compose.js";
import { Rng } from "./doodle/pen.js";

/** Ordinary first names — bots should read as just another player in the
 *  lobby, not as obvious machines. */
const BOT_NAMES = [
  "Riya", "Arjun", "Neha", "Sam", "Priya", "Dev", "Maya", "Kabir",
  "Ana", "Leo", "Zoe", "Omar", "Ravi", "Tara", "Finn", "Isha",
  "Noah", "Mira", "Jay", "Sofia",
] as const;

const BOT_ID_PREFIX = "bot-";

export function isBotId(playerId: string): boolean {
  return playerId.startsWith(BOT_ID_PREFIX);
}

/** Any bot name, no lobby involved — used to sign the ambient doodles shown
 *  on the home and lobby screens. */
export function randomBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

/** Picks a name not already taken in the lobby, so two bots never collide. */
export function createBot(takenNames: Set<string>): { id: string; nickname: string } {
  const lower = new Set(Array.from(takenNames, (n) => n.toLowerCase()));
  const free = BOT_NAMES.filter((n) => !lower.has(n.toLowerCase()));
  const pool = free.length > 0 ? free : BOT_NAMES;
  const nickname = pool[Math.floor(Math.random() * pool.length)];
  return { id: `${BOT_ID_PREFIX}${randomUUID()}`, nickname };
}

// --- naming the homework --------------------------------------------------

const TITLE_ADJECTIVES = [
  "Mega", "Turbo", "Auto", "Ultra", "Super", "Insta", "Hyper", "Smart", "Pocket", "Jumbo",
];
const TITLE_NOUNS = [
  "Blaster", "Buddy", "Machine", "Master", "Helper", "Gadget", "Bot", "Wizard", "Genie", "Pal",
];
const TITLE_SUFFIXES = ["3000", "9000", "Pro", "XL", "Max", "2.0", "Deluxe", "Mini"];

/** Stop-words stripped when mining the prompt for a keyword to name after. */
const BORING_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "you", "your", "with", "that", "this",
  "it", "its", "in", "on", "at", "by", "from", "is", "was", "are", "were", "be", "been",
  "homework", "device", "machine", "gadget", "thing", "something", "anyone", "people",
  "world", "worlds", "first", "new", "finally", "introducing", "scientists", "helps", "help",
  "lets", "let", "stop", "solves", "problem", "created", "invented", "years", "after",
  "coming", "soon", "store", "near", "next", "even", "without", "trying", "more", "efficiently",
  "who", "has", "ever", "wanted", "can", "cant", "one", "weird", "every", "waiting", "made",
  "specifically", "designed", "built", "purpose", "only", "team", "spent", "just", "might",
  "too", "good", "promises", "make", "past", "must", "have", "year", "perfect", "gift",
  "needs", "want", "wants", "there", "their",
  // Filler that reads badly in a title ("The Than Machine Pro"). The prompt
  // sentences are conversational, so most of their words are connective
  // tissue — keep only the ones naming an actual thing.
  "somebody", "someone", "everybody", "everyone", "anybody", "nobody", "than",
  "always", "never", "nothing", "usually", "really", "still", "very", "quite",
  "comes", "come", "coming", "down", "into", "onto", "about", "over", "under",
  "when", "what", "where", "while", "which", "because", "eventually", "ongoing",
  "gets", "getting", "goes", "going", "does", "doing", "turns", "turn", "means",
  "keeps", "keep", "leaves", "takes", "take", "having", "hard", "enough", "same",
  "another", "least", "once", "much", "many", "some", "such", "would", "could",
  "should", "will", "wont", "your", "them", "they", "were", "faster", "worst",
  "best", "better", "long", "longer", "half", "part", "back", "away", "each",
  "most", "them", "then", "these", "those", "than",
]);

function keywordFrom(prompt: string, rng: Rng): string | null {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !BORING_WORDS.has(w));
  if (words.length === 0) return null;
  const word = rng.pick(words);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Names the homework, weaving in a word from the prompt when there's a
 *  usable one so titles feel connected to what was asked. */
export function botTitle(prompt: string): string {
  const rng = new Rng(Math.floor(Math.random() * 0xffffffff));
  const keyword = keywordFrom(prompt, rng);
  const adj = rng.pick(TITLE_ADJECTIVES);
  const noun = rng.pick(TITLE_NOUNS);
  const suffix = rng.pick(TITLE_SUFFIXES);

  const patterns: string[] = keyword
    ? [
        `The ${keyword} ${noun}`,
        `${adj} ${keyword} ${noun}`,
        `${keyword}-o-Matic ${suffix}`,
        `The ${keyword} ${noun} ${suffix}`,
        `${adj} ${keyword}inator`,
      ]
    : [`The ${adj} ${noun}`, `${adj} ${noun} ${suffix}`, `The ${noun} ${suffix}`];

  return rng.pick(patterns).slice(0, 40);
}

// --- drawing ---------------------------------------------------------------

/** [answer] is the blank the player filled in — the part of the sentence the
 *  drawing should actually be about. */
export function botDrawing(prompt: string, answer: string, botId: string): Stroke[] {
  return drawForPrompt(prompt, answer, botId);
}

// --- investing -------------------------------------------------------------

/**
 * Spreads the bot's entire budget across other players' entries in [step]
 * increments. Bots always spend everything — leaving money unspent is
 * strictly penalized, so a plausible player wouldn't do it.
 */
export function botInvestment(
  entries: DrawingEntry[],
  botId: string,
  budget: number,
  step: number,
): Record<string, number> {
  const others = entries.filter((e) => e.artistId !== botId);
  const allocations: Record<string, number> = {};
  if (others.length === 0) return allocations;

  let unitsLeft = Math.floor(budget / step);
  // Weight picks randomly so bots have "favourites" rather than splitting evenly.
  const weights = others.map(() => 0.4 + Math.random());
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  others.forEach((entry, i) => {
    const isLast = i === others.length - 1;
    const units = isLast
      ? unitsLeft
      : Math.min(unitsLeft, Math.round((weights[i] / totalWeight) * (budget / step)));
    if (units > 0) allocations[entry.artistId] = units * step;
    unitsLeft -= units;
  });

  return allocations;
}

/**
 * A bot's podium for a friendly game: up to [places] other entries, best
 * first, picked at random. Bots have no taste to model, and a random podium
 * spreads points around the same way a table of friends roughly does.
 */
export function botRanking(entries: DrawingEntry[], botId: string, places: number): string[] {
  const others = entries.filter((e) => e.artistId !== botId).map((e) => e.artistId);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, places);
}

/** Bots shouldn't answer instantly — stagger them across most of the phase
 *  so the "3/5 submitted" counter creeps up like it would with real people. */
export function botDelayMs(phaseSeconds: number): number {
  const min = phaseSeconds * 1000 * 0.25;
  const max = phaseSeconds * 1000 * 0.7;
  return min + Math.random() * (max - min);
}
