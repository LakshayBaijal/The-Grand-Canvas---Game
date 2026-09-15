/** Fill-in-the-blank prompts. Each round one random player fills in the
 *  blank (marked "___"); the completed sentence is what everyone else draws.
 *
 *  Every one of these is a saying people already know -- a proverb, an
 *  idiom, a line from a song or a story -- with the punchline taken out.
 *  That does two things the earlier "everyday annoyance" sentences didn't:
 *
 *    - The writer has somewhere to start. "An apple a day keeps ___ away"
 *      asks for exactly one word and half the table already has a joke for
 *      it; "the most annoying part of waking up is usually ___" asked for an
 *      essay. Forty seconds is not long.
 *    - The word in the blank is the whole subject, so the bots' drawings
 *      (which key off the filled-in answer) land on the right thing.
 *
 *  Keep them short, universally known, and clean, with one blank each. Vary
 *  what the blank asks for -- a thing, a creature, a place, a person -- so a
 *  game doesn't feel like the same question five times. */
export const PROMPT_TEMPLATES: string[] = [
  // proverbs
  "An apple a day keeps ___ away.",
  "The early bird catches the ___.",
  "Don't count your ___ before they hatch.",
  "A picture is worth a thousand ___.",
  "When life gives you lemons, make ___.",
  "Every cloud has a ___ lining.",
  "Rome wasn't built in a ___.",
  "All that glitters is not ___.",
  "Home is where the ___ is.",
  "Too many cooks spoil the ___.",
  "The grass is always greener on the other side of the ___.",
  "Don't put all your eggs in one ___.",
  "Actions speak louder than ___.",
  "Curiosity killed the ___.",
  "Never judge a book by its ___.",
  "Laughter is the best ___.",
  "Money can't buy ___.",
  "The pen is mightier than the ___.",
  "Practice makes ___.",
  "A watched pot never ___.",
  "Good things come to those who ___.",
  "There's no place like ___.",
  "Let sleeping ___ lie.",
  "The best things in life are ___.",
  "You can't teach an old dog new ___.",
  "Birds of a feather ___ together.",
  "A rolling stone gathers no ___.",
  "Beauty is in the eye of the ___.",
  "Two heads are better than ___.",
  "The elephant in the room is ___.",
  "One man's trash is another man's ___.",
  "Slow and steady wins the ___.",
  "Don't bite the hand that ___ you.",
  "Every dog has its ___.",
  "What goes around comes ___.",
  "Blood is thicker than ___.",

  // idioms
  "It's raining ___ and dogs.",
  "That costs an arm and a ___.",
  "Let the ___ out of the bag.",
  "Don't cry over spilled ___.",
  "Once in a blue ___.",
  "The last straw that broke the ___'s back.",
  "A piece of ___.",
  "Kill two ___ with one stone.",
  "Hit the ___ running.",
  "Put a ___ in it.",
  "Cool as a ___.",
  "Busy as a ___.",
  "Blind as a ___.",
  "Sleeping like a ___.",
  "Eating like a ___.",
  "Happy as a ___.",
  "Stubborn as a ___.",
  "Fits like a ___.",
  "As light as a ___.",
  "Wolf in ___'s clothing.",
  "The ___ is on fire.",
  "Barking up the wrong ___.",
  "A ___ in a china shop.",
  "Like a ___ in headlights.",
  "Living on ___ street.",
  "Spill the ___.",
  "Under the ___.",
  "Over the ___.",

  // songs, rhymes and stories everybody knows
  "Twinkle twinkle little ___.",
  "Old MacDonald had a ___.",
  "Row, row, row your ___.",
  "Humpty Dumpty sat on a ___.",
  "Jack and Jill went up the ___.",
  "Mary had a little ___.",
  "The wheels on the ___ go round and round.",
  "Somewhere over the ___.",
  "We all live in a yellow ___.",
  "Hey diddle diddle, the cat and the ___.",
  "Baa baa black ___.",
  "Hickory dickory dock, the mouse ran up the ___.",
  "Little Miss Muffet sat on a ___.",
  "Three blind ___.",
  "The itsy bitsy ___ climbed up the water spout.",
  "Happy birthday to ___.",
  "Jingle bells, jingle bells, jingle all the ___.",
  "London Bridge is falling ___.",
  "Ring around the ___.",
  "Head, shoulders, knees and ___.",
  "If you're happy and you know it, clap your ___.",
  "Do you want to build a ___?",

  // modern sayings
  "Keep calm and ___.",
  "Netflix and ___.",
  "Sorry, my ___ died.",
  "New phone, who ___?",
  "It's not a bug, it's a ___.",
  "Have you tried turning your ___ off and on again?",
  "Coffee first, then ___.",
  "Monday is just a ___.",
  "There's an app for ___.",
  "Never skip ___ day.",
  "The customer is always ___.",
  "Fake it till you ___.",
  "Diamonds are a ___'s best friend.",
  "May the ___ be with you.",
  "Winter is ___.",
  "Life is like a box of ___.",
  "I'll be ___.",
  "With great power comes great ___.",
  "To infinity and ___.",
  "Hakuna ___.",
  "You shall not ___.",
];

/** Already-completed sentences used only for the ambient "someone is doodling"
 *  canvas on the home and lobby screens. Real rounds get their blank filled by
 *  a player, but there's nobody to write one while people are just waiting
 *  around — so these ship pre-filled.
 *
 *  Deliberately weighted toward words the doodle engine can actually depict
 *  (see TOPIC_WORDS in doodle/compose.ts) — coffee, dogs, traffic, phones —
 *  so the drawing that appears looks connected to the sentence above it. */
export const DEMO_PROMPTS: string[] = [
  "Nothing ruins a commute faster than traffic that never moves.",
  "Every office has an ongoing problem with the coffee machine.",
  "Falling asleep is hard enough without the neighbour's dog.",
  "The most annoying part of waking up is usually the alarm.",
  "Mornings would be so much easier without cold showers.",
  "Every kitchen eventually has a problem with burnt toast.",
  "Somebody really needs to invent something for tangled cables.",
  "Video calls always get interrupted by a cat on the keyboard.",
  "Laundry day is really just an ongoing battle against missing socks.",
  "Half of modern life is just dealing with a phone at 1% battery.",
  "Dog owners everywhere deal with muddy paws on a daily basis.",
  "Every road trip with kids eventually comes down to snacks.",
  "Nobody wants to go to the gym and deal with the treadmill.",
  "Rainy days always mean dealing with a broken umbrella.",
  "Every winter comes with the exact same problem: frozen car doors.",
  "Summer would be perfect if it weren't for melting ice cream.",
  "The worst part of eating out is splitting the bill.",
  "Grocery shopping always comes down to dealing with heavy bags.",
  "Every group chat eventually runs into someone sending 40 photos.",
  "Nothing wastes more time than looking for lost keys.",
  "Every parking lot has the same problem: nowhere to park.",
  "Cooking dinner always comes down to having to wash up after.",
  "Every nap gets interrupted by the doorbell.",
  "A dead wifi connection always causes a very long meeting.",
  "Late-night snacking always means opening a loud packet quietly.",
  "Cats always seem to have a problem with a closed door.",

  // Added alongside the wider shape map — each of these names something the
  // engine can now actually depict, so the drawing matches the sentence.
  "Every supermarket trip ends with one wobbly trolley.",
  "The worst part of any restaurant is splitting the receipt.",
  "An hour on hold is plenty of time to think about the queue.",
  "Every office printer jams at the worst possible moment.",
  "Nobody has ever remembered a single password.",
  "Every birthday cake has one candle that won't blow out.",
  "The neighbour's guitar practice starts at exactly 11pm.",
  "Rainy days always mean staring out of a foggy window.",
  "Every winter comes down to building one sad snowman.",
  "Nothing ruins a morning like a bathroom mirror.",
  "Renewing anything official means another clipboard of forms.",
  "Cleaning day always comes down to one empty spray bottle.",
  "Every shared flat argues about the thermostat.",
  "Getting anywhere with a pram takes three times as long.",
  "Every party ends with somebody's abandoned wine glass.",
  "Assembling furniture always means finding the right spanner.",
  "Nobody enjoys wearing a helmet that doesn't fit.",
  "Every games night ends in a fight over one controller.",
  "The days before payday always mean hiding the credit card.",
  "Saving money is mostly just ignoring the piggy bank.",
  "Laundry day ends with a washing line in the rain.",
  "Every kitchen has one teapot nobody ever uses.",
  "Every commute comes down to one very slow traffic light.",
  "Every kitchen fire starts with a forgotten pan.",
  "Nobody has ever assembled a toolbox and kept it tidy.",
  "Every fridge eventually contains one mystery leftover.",
];

export function pickDemoPrompt(): string {
  return DEMO_PROMPTS[Math.floor(Math.random() * DEMO_PROMPTS.length)];
}

const BLANK = "___";

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
