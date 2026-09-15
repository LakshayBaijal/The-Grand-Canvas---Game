import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The prompt lists, loaded from plain text files in `server/prompts/`.
 *
 * They live outside the code on purpose. Wording is the part of this game
 * most likely to change, and it is the part least likely to be changed by a
 * programmer -- a typo fix, a joke that didn't land, one more line -- so it
 * should not need a TypeScript edit, a compile and a code review. Edit the
 * .txt file, restart the server, done. The files are documented in their own
 * headers, which is where anyone editing them will actually look.
 *
 * Read once at startup and kept in memory: a few hundred short strings, and
 * picking one happens on the hot path of every round.
 */

/** Resolves to `server/prompts/`, from either `src/` (tsx, tests) or
 *  `dist/` (the built server) -- both are one level below the package. */
const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

const BLANK = "___";

/** One entry per non-empty, non-comment line. */
function readLines(file: string): string[] {
  const text = readFileSync(join(PROMPTS_DIR, file), "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Fill-in-the-blank templates. Each round one random player fills in the
 * blank; the completed sentence becomes what everyone else draws.
 *
 * A malformed line is dropped with a warning rather than taken: a template
 * with no blank can never be completed, and one with two would leave half a
 * sentence with "___" still in it on five screens. Loudly, because a typo
 * here is invisible until a round lands on that line.
 */
export const PROMPT_TEMPLATES: string[] = readLines("prompts.txt").filter((line) => {
  const blanks = line.split(BLANK).length - 1;
  if (blanks === 1) return true;
  console.warn(`[prompts] ignoring a line with ${blanks} blanks: ${JSON.stringify(line)}`);
  return false;
});

/** Already-completed sentences, for the ambient "someone is doodling" canvas
 *  on the home and lobby screens. See prompts/demo-prompts.txt. */
export const DEMO_PROMPTS: string[] = readLines("demo-prompts.txt");

if (PROMPT_TEMPLATES.length === 0) throw new Error("no usable prompts in prompts/prompts.txt");
if (DEMO_PROMPTS.length === 0) throw new Error("no prompts in prompts/demo-prompts.txt");

export function pickDemoPrompt(): string {
  return DEMO_PROMPTS[Math.floor(Math.random() * DEMO_PROMPTS.length)];
}

export function pickTemplate(excludeIndices: Set<number>): { index: number; template: string } {
  const available = PROMPT_TEMPLATES.map((_, i) => i).filter((i) => !excludeIndices.has(i));
  // Once every template has been used this game, it's fine to repeat —
  // better than running out mid-game.
  const pool = available.length > 0 ? available : PROMPT_TEMPLATES.map((_, i) => i);
  const index = pool[Math.floor(Math.random() * pool.length)];
  return { index, template: PROMPT_TEMPLATES[index] };
}

/** Splices the writer's answer into the blank to build the full prompt
 *  everyone draws. Falls back to something generic if they never answered
 *  (e.g. they ran out of time). */
export function fillTemplate(template: string, answer: string): string {
  const cleaned = answer.trim().slice(0, 60);
  return template.replace(BLANK, cleaned || "something amazing");
}
