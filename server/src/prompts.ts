/** Mad-Libs-style "invention problem" templates. Each round one random
 *  player fills in the blank (marked "___"); the completed sentence becomes
 *  the problem everyone else draws a solution to — the same structure as
 *  Jackbox's Patently Stupid.
 *
 *  Kept deliberately plain and everyday rather than dramatic ("Scientists
 *  discover...", "Breaking news...") — ordinary annoyances give players more
 *  to actually latch onto than hype language does. Phrased impersonally
 *  ("everyone", "nobody", "there's never...") rather than as first-person
 *  "I need"/"I wish" statements.
 *
 *  Two blank shapes, deliberately mixed so it doesn't always read as "a way
 *  to ___":
 *    - noun blanks   ("deals with ___", "solves ___") — filled with a
 *      concrete annoying thing, e.g. "loud chewing", "traffic". Usually the
 *      fastest to think of and the easiest to draw.
 *    - verb blanks    ("a way to ___", "before having to ___") — filled with
 *      a short action, e.g. "find my keys".
 *  Keep both flavors when adding more, rather than drifting back to one. */
export const PROMPT_TEMPLATES: string[] = [
  // morning routine
  "The most annoying part of waking up is usually ___.",
  "Nobody should have to ___ before they've even had coffee.",
  "Mornings would be so much easier without ___.",
  "It shouldn't take this long to ___ before work.",
  "The snooze button exists because of ___.",
  "Every morning comes down to a rushed fight against ___.",

  // commute and travel
  "Nothing ruins a commute faster than ___.",
  "There's no reason anyone should still have to ___ in traffic.",
  "Every parking lot has the same problem: ___.",
  "Long car rides always come down to somebody having to ___.",
  "Airports would be so much better without ___.",
  "Every bus stop eventually deals with ___.",

  // work and school
  "Every office has an ongoing problem with ___.",
  "Nobody wants to be the one who has to ___ in a meeting.",
  "Video calls get ruined by ___ more often than not.",
  "It's about time somebody solved ___ once and for all.",
  "Deadlines always come down to somebody having to ___ at the last minute.",
  "Every classroom eventually has to deal with ___.",

  // home and chores
  "Laundry day is really just an ongoing battle against ___.",
  "Nobody enjoys ___, but somebody always has to deal with it.",
  "Every kitchen eventually has a problem with ___.",
  "Cleaning day always means somebody has to ___.",
  "Roommates always end up arguing about ___.",
  "It's always tricky to ___ without waking up the neighbors.",

  // food and eating
  "Breakfast always gets ruined by ___.",
  "Cooking dinner always comes down to having to ___.",
  "The worst part of eating out is usually ___.",
  "Late-night snacking always means having to ___ quietly.",
  "Every dinner table eventually deals with ___.",

  // phone and technology
  "Half of modern life is just dealing with ___.",
  "Nobody has found a good way to stop ___.",
  "Video calls always get interrupted by ___.",
  "It shouldn't be this hard to ___ without the phone dying.",
  "Every group chat eventually runs into ___.",
  "Autocorrect always turns a simple text into ___.",

  // social and relationships
  "Every family gathering eventually runs into ___.",
  "Small talk always turns awkward because of ___.",
  "Nobody wants to be the one who has to ___ at a party.",
  "In-laws always have something to say about ___.",
  "Every group project comes down to somebody having to ___.",
  "There's never a graceful way to deal with ___.",

  // sleep and rest
  "Falling asleep is hard enough without ___.",
  "Nobody wants to be the one who has to ___ at 2am.",
  "Boring lectures are mostly just a fight against ___.",
  "Every nap gets interrupted by ___.",

  // money and shopping
  "Nobody wants to spend money on ___, but everyone eventually does.",
  "Grocery shopping always comes down to dealing with ___.",
  "The days before payday always mean dealing with ___.",

  // pets
  "Dog owners everywhere deal with ___ on a daily basis.",
  "Cats always seem to have a problem with ___.",
  "Walking the dog always means dealing with ___.",

  // kids and family
  "Every road trip with kids eventually comes down to ___.",
  "Bedtime always turns into a fight about ___.",
  "Parenting is mostly just dealing with ___ all day.",

  // fitness and health
  "Nobody wants to go to the gym and deal with ___.",
  "Every workout eventually gets derailed by ___.",
  "Eating healthy always falls apart because of ___.",

  // weather and outdoors
  "Rainy days always mean dealing with ___.",
  "Every winter comes with the exact same problem: ___.",
  "Summer would be perfect if it weren't for ___.",

  // everyday annoyances
  "Nothing wastes more time than ___.",
  "Everyone has lost something important to ___ at least once.",
  "There's nothing more frustrating than ___.",
  "Every junk drawer is full of ___.",
  "Nobody has ever enjoyed dealing with ___.",
  "Every year, people waste hours dealing with ___.",
  "Losing your keys always means dealing with ___.",
  "Tangled headphones always lead to ___.",
  "A dead Wi-Fi connection always causes ___.",
  "Long lines always leave people thinking about ___.",
  "An hour on hold is plenty of time to think about ___.",

  // plain and simple
  "The world still doesn't have a good solution for ___.",
  "Somebody really needs to invent something for ___.",
  "Everyone agrees ___ is a real problem.",
  "If there's one thing that needs fixing, it's ___.",
  "Nobody has cracked the problem of ___ yet.",
  "There's a real market for anything that solves ___.",
  "Every household could use a gadget that finally deals with ___.",
  "A good invention right now would put an end to ___.",

  // shopping and errands
  "Every supermarket trip ends the same way: ___.",
  "Self-checkout machines exist purely to ___.",
  "Nobody has ever had a good experience trying to ___.",
  "Online shopping always goes wrong at the point of ___.",

  // repairs and stuff breaking
  "Everything works fine right up until ___.",
  "Assembling furniture always comes down to ___.",
  "Every rented flat has the same unfixable problem: ___.",
  "It's never worth the money to fix ___.",

  // admin and bureaucracy
  "Every form ever printed eventually asks you to ___.",
  "Renewing anything official means dealing with ___.",
  "Nothing makes an afternoon disappear like ___.",

  // hobbies and downtime
  "Every hobby eventually turns into ___.",
  "Nobody warns you that a holiday involves ___.",
  "Movie night always gets derailed by ___.",
  "Every board game ends in an argument about ___.",

  // health
  "The doctor's waiting room is really just ___.",
  "Getting a decent night's sleep is impossible with ___.",
  "Every new year's resolution dies because of ___.",

  // seasonal
  "The first hot day of the year always means ___.",
  "Every holiday season comes down to ___.",
  "Nobody is ever prepared for ___.",

  // neighbours and shared spaces
  "Shared bins are just an invitation to ___.",
  "Every block of flats has one person who insists on ___.",
  "Communal kitchens always end up with ___.",

  // more verb blanks, to keep the mix even
  "There should be an easier way to ___.",
  "Somebody should be paid handsomely to ___.",
  "Nobody should have to ___ more than once a year.",
  "It takes a special kind of patience to ___.",
  "The hardest part of any morning is having to ___.",
  "You should never have to ___ in front of other people.",
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
