/**
 * Foul language in player-*written* text.
 *
 * Scope is deliberate and narrow: the prompt blank and drawing titles — the
 * two places a few typed words land on every other player's screen. Drawings
 * are not looked at, classified or filtered by anything, anywhere; what
 * people draw is the game's freedom and stays that way.
 *
 * Two tiers, because one rule does not fit both kinds of word:
 *
 *  * WORDS match a whole token only. Short or ambiguous terms live here so
 *    "Dickens", "assist", "cockerel" and "Scunthorpe" pass — the classic
 *    failure of a naive filter is banning more innocent words than rude ones.
 *  * FRAGMENTS match anywhere in the squashed text. Only terms that are rude
 *    in every word they appear in belong here, which is what lets "f*ckoff"
 *    and "sh1thead" be caught without a space.
 *
 * Both are checked against a normalised form: lower-cased, leetspeak undone,
 * punctuation and spacing collapsed, and repeated letters folded so "fuuuck"
 * is the same word as "fuck". Hindi is covered in transliteration, which is
 * how it gets typed on a phone keyboard.
 */

const WORDS: readonly string[] = [
  // English
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuk", "fck",
  "shit", "shits", "shitty", "shite", "bullshit", "shithead", "shithole",
  "bitch", "bitches", "bitchy",
  "cunt", "cunts",
  "dick", "dicks", "dickhead", "dickheads",
  "cock", "cocks", "cocksucker",
  "pussy", "pussies",
  "ass", "arse", "asshole", "arsehole", "assholes", "arseholes",
  "bastard", "bastards",
  "slut", "sluts", "whore", "whores", "hoe", "hoes",
  "twat", "twats", "wanker", "wankers", "wank",
  "prick", "pricks", "bollocks", "tits", "boobs", "boob",
  "cum", "jizz", "dildo", "porn", "porno", "penis", "vagina", "boobies", "titties",
  "sex", "sexy", "nude", "nudes", "naked", "horny", "orgasm", "anal", "blowjob", "handjob",
  "rape", "rapist", "molest", "pedo", "paedo",
  "nigger", "nigga", "niggers", "niggas", "fag", "faggot", "fags", "faggots",
  "retard", "retarded", "retards",
  "damn", "goddamn", "crap",
  // Hindi / Hinglish, as typed
  "chutiya", "chutiye", "chutia", "chutiyapa",
  "bhosdike", "bhosdi", "bhosadike", "bhosdika", "bsdk",
  "madarchod", "maderchod", "madarchode", "mc",
  "behenchod", "bhenchod", "benchod", "behnchod", "bc",
  "gandu", "gaand", "gand", "gaandu",
  "lund", "lauda", "loda", "lawda",
  "randi", "randi",
  "harami", "haramzada", "haramzade", "kamina", "kamine",
  "kutta", "kutte", "kutiya", "kutti",
  "chut", "choot", "jhant", "jhaant",
  "saala", "sala", "saale", "saali",
  "bhadwa", "bhadwe", "hijra", "chinaal",
];

// Not here, on purpose: "cunt" (Scunthorpe), "shit" (shiitake), "nigg"
// (snigger), "fuk" (Fukuoka). Those are whole-word only, above.
const FRAGMENTS: readonly string[] = [
  "fuck", "motherf", "bitch", "faggot",
  "cocksuck", "asshole", "arsehole", "dickhead", "shithead", "shithole",
  "wanker", "bollock",
  "chutiy", "bhosd", "madarch", "maderch", "behench", "bhench", "benchod",
  "gaandu", "haramz", "bhadw",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "l", "+": "t",
};

/** Lower-cased, leetspeak undone, everything but letters removed. */
function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "");
}

/** "fuuuck" -> "fuck", "asss" -> "as". Only meaningful on words long
 *  enough that folding cannot turn them into a different real word. */
const fold = (s: string) => s.replace(/(.)\1+/g, "$1");

const WORD_SET = new Set(WORDS);
/** Folded forms of words long enough to survive folding intact (4+). */
const FOLDED_WORD_SET = new Set(WORDS.map(fold).filter((w) => w.length >= 4));

/** Tokens as a person would see them: letters only, split on anything else. */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (c) => LEET[c] ?? c)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** A token this short is not a word on its own in a written answer; a run
 *  of them is somebody spelling something out. */
const FRAGMENT_LEN = 3;
/** Short tokens that are ordinary words, not fragments of anything. "The
 *  pen is mightier" joins to "penis" without this, and that sentence is a
 *  prompt. Somebody spelling a word out uses letters, not these. */
const SHORT_WORDS = new Set([
  "a", "an", "the", "is", "it", "in", "on", "at", "of", "to", "be", "as", "or", "and",
  "if", "so", "do", "go", "no", "up", "by", "my", "me", "we", "he", "us", "am", "i",
  "its", "are", "was", "for", "but", "not", "you", "all", "any", "can", "had", "has",
  "her", "him", "his", "how", "new", "now", "old", "one", "our", "out", "own", "say",
  "she", "too", "two", "use", "way", "who", "why", "yes", "yet", "off", "put", "get",
  "let", "may", "did", "big", "bad", "top", "end", "day", "man", "men",
  // Common short nouns and verbs. Not exhaustive -- it can't be -- but the
  // point is that a real word is a word, and the next token is a new one.
  "pen", "cat", "dog", "hat", "sun", "sea", "bus", "car", "ant", "log", "tie", "fan",
  "bit", "red", "cup", "tea", "pie", "egg", "ice", "oil", "box", "bag", "bed", "key",
  "map", "net", "pan", "pot", "rat", "cow", "pig", "hen", "bee", "fly", "fox", "owl",
  "leg", "arm", "eye", "ear", "toe", "lip", "hip", "jaw", "gym", "job", "war", "art",
  "sky", "air", "gas", "mud", "ash", "fog", "dew", "wet", "dry", "hot", "raw", "low",
  "run", "sit", "eat", "cut", "dig", "fix", "hit", "mix", "pay", "see", "try", "win",
  "ago", "far", "few", "lot", "odd", "per", "via", "nor", "ok", "hi", "oh", "ah",
]);
const isFragment = (t: string) => t.length <= FRAGMENT_LEN && !SHORT_WORDS.has(t);
/** How many tokens a spelled-out word can be spread across. */
const MAX_JOIN = 8;

/**
 * Words hidden by splitting them: "D icks", "Di cks", "d.i.c.k.s", "c-u-n-t".
 *
 * Squashing the whole sentence would catch these, but it also invents words
 * that were never typed: "the grass hit" squashes to "...asshit...". So
 * instead only *runs of short tokens* are joined back together -- a real
 * sentence almost never has three one-to-three-letter tokens in a row that
 * spell a rude word, and a split word always does. Each run is joined with
 * each of its neighbours in turn ("di"+"cks", "d"+"i"+"c"+"k"+"s") and the
 * joined form is checked as a whole word only, never as a fragment, so the
 * innocent joins ("an"+"assistant") stay innocent.
 */
function findSplitWord(toks: string[]): string | null {
  for (let i = 0; i < toks.length; i++) {
    let joined = "";
    let shortOnes = 0;
    for (let j = i; j < toks.length && j < i + MAX_JOIN; j++) {
      joined += toks[j];
      if (isFragment(toks[j])) shortOnes++;
      // A join has to involve at least one fragment to be a split at all,
      // and needs two tokens to be a join.
      if (j === i || shortOnes === 0) continue;
      if (WORD_SET.has(joined)) return joined;
      const f = fold(joined);
      if (f.length >= 4 && FOLDED_WORD_SET.has(f)) return joined;
    }
  }
  return null;
}

/** The first offending term, or null if the text is clean. */
export function findProfanity(text: string): string | null {
  const toks = tokens(text);
  for (const t of toks) {
    if (WORD_SET.has(t)) return t;
    const f = fold(t);
    if (f.length >= 4 && FOLDED_WORD_SET.has(f)) return t;
  }
  const split = findSplitWord(toks);
  if (split) return split;
  const flat = squash(text);
  const flatFolded = fold(flat);
  for (const frag of FRAGMENTS) {
    if (flat.includes(frag) || flatFolded.includes(fold(frag))) return frag;
  }
  return null;
}

export function hasProfanity(text: string): boolean {
  return findProfanity(text) !== null;
}

/**
 * The same text with each offending word replaced by asterisks of the same
 * length, punctuation and spacing kept. For places where the text can't be
 * sent back for a rewrite — a drawing's title arrives with the drawing, and
 * losing the drawing over its name would be the worse outcome.
 */
export function maskProfanity(text: string): string {
  // Whole words first, in place.
  let out = text.replace(/[A-Za-z0-9@$!|+]+/g, (word) => {
    const t = tokens(word)[0] ?? "";
    const bad = WORD_SET.has(t) || (fold(t).length >= 4 && FOLDED_WORD_SET.has(fold(t)));
    return bad ? "*".repeat(word.length) : word;
  });
  // Then anything a fragment still finds hiding inside a longer run.
  if (findProfanity(out) !== null) {
    out = out.replace(/[A-Za-z0-9@$!|+]+/g, (word) =>
      findProfanity(word) !== null ? "*".repeat(word.length) : word,
    );
  }
  return out;
}
