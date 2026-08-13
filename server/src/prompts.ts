/** Mad-Libs-style "invention problem" templates. Each round one random
 *  player fills in the blank (marked "___"); the completed sentence becomes
 *  the problem everyone else draws a solution to — the same structure as
 *  Jackbox's Patently Stupid.
 *
 *  Kept deliberately plain and everyday rather than dramatic ("Scientists
 *  discover...", "Breaking news...") — ordinary annoyances give players more
 *  to actually latch onto than hype language does. Every blank should read
 *  naturally with a verb phrase dropped in (e.g. "find my keys",
 *  "remember birthdays") — keep that pattern when adding more. */
export const PROMPT_TEMPLATES: string[] = [
  // morning routine
  "I need something that helps me ___ every morning without hitting snooze five times.",
  "Getting out of bed would be so much easier if I could just ___.",
  "I wish I had a way to ___ before my coffee even finishes brewing.",
  "Every morning I waste ten minutes trying to ___.",
  "I need help remembering to ___ before I leave the house.",
  "I need an invention that helps me ___ while I'm still half asleep.",

  // work and school
  "At work, I really need something that helps me ___ without anyone noticing.",
  "In every meeting, I somehow end up having to ___.",
  "I need an invention that helps me ___ during a boring video call.",
  "My desk needs something that helps me ___ between emails.",
  "I wish there was a way to ___ without my coworkers hearing.",
  "I need help to ___ five minutes before a deadline.",
  "I need something that helps me ___ without my boss walking by at the wrong moment.",

  // commute and travel
  "On my commute, I always wish I could ___.",
  "Parking would be so much easier if I had something that helps me ___.",
  "I need an invention that helps me ___ while stuck in traffic.",
  "On long car rides, I really need help to ___.",
  "At the airport, I always struggle to ___.",
  "I need something that helps me ___ without missing my bus stop.",

  // home and chores
  "I hate having to ___ every single week.",
  "Doing laundry would be so much easier if I could just ___.",
  "I need something that helps me ___ without leaving the couch.",
  "My kitchen needs an invention that helps me ___ before guests arrive.",
  "I wish I had a way to ___ instead of doing the dishes.",
  "I need help to ___ before my roommate gets home.",
  "Cleaning the house would be so much easier if I could just ___.",
  "I need an invention that helps me ___ without waking up the neighbors.",

  // food and eating
  "I need an invention that helps me ___ while eating breakfast in the car.",
  "Cooking dinner would be so much easier if I could just ___.",
  "I wish I had a way to ___ without getting sauce on my shirt.",
  "I need help to ___ without waking up the whole kitchen.",
  "At restaurants, I always need something that helps me ___.",
  "I need something that helps me ___ before the food gets cold.",

  // phone and technology
  "My phone battery always dies right when I need to ___.",
  "I need something, app or otherwise, that helps me ___ instead of scrolling.",
  "I wish there was a way to ___ without dropping my phone again.",
  "I need something that helps me ___ during a video call without anyone noticing I've checked out.",
  "I need help remembering to ___ before my phone dies.",
  "I need an invention that helps me ___ every time autocorrect ruins my text.",

  // social and relationships
  "I need an excuse, or an invention, to avoid having to ___.",
  "Family dinners would be so much easier if I had a way to ___.",
  "I wish I had a way to ___ without it being awkward.",
  "I need something that helps me ___ during small talk with strangers.",
  "At parties, I always need a way to ___ without anyone noticing.",
  "I need help to ___ so my in-laws stop asking questions.",
  "I need an invention that helps me ___ every time someone asks too many questions.",

  // sleep and rest
  "I need an invention that helps me ___ without waking up my partner.",
  "I wish there was a way to ___ so I could finally fall asleep.",
  "I need help to ___ during a boring lecture without falling asleep.",
  "Naps would be so much better if I had something that helps me ___.",

  // money and shopping
  "I need something that helps me ___ without spending money I don't have.",
  "Grocery shopping would be so much easier if I had a way to ___.",
  "I wish there was an invention that helps me ___ before payday.",

  // pets
  "I need an invention that helps me ___ every time my dog barks at the mailman.",
  "I wish I had a way to ___ without my cat judging me for it.",
  "Walking the dog would be so much easier if I could just ___.",

  // kids and family
  "I need something that helps me ___ while the kids are screaming in the back seat.",
  "I wish there was a way to ___ during bedtime without a fight.",
  "Parenting would be so much easier if I had an invention that helps me ___.",

  // fitness and health
  "I need an invention that helps me ___ without actually going to the gym.",
  "I wish there was a way to ___ five minutes into a workout.",
  "I need help to ___ every time I promise myself I'll start eating healthy.",

  // weather and outdoors
  "I need something that helps me ___ every time it starts raining unexpectedly.",
  "I wish I had a way to ___ without freezing on my walk to work.",
  "Summer would be so much better if I had an invention that helps me ___.",

  // everyday annoyances
  "I need an invention that helps me ___ every time I lose my keys.",
  "I wish there was a way to ___ without untangling my headphones first.",
  "I need help to ___ every time the Wi-Fi cuts out.",
  "I need something that helps me ___ without getting stuck behind slow walkers.",
  "I wish I had a way to ___ without waiting on hold for an hour.",
  "I need an invention that helps me ___ every time I forget someone's name.",
  "I need help to ___ without spilling coffee on myself.",
  "I need something that helps me ___ every time I can't find matching socks.",
  "I wish there was a way to ___ without my umbrella turning inside out.",
  "I need an invention that helps me ___ every time I step on something sharp.",
  "I need something that helps me ___ without waiting in a long line.",
  "I wish there was a way to ___ without my browser having way too many tabs open.",
  "I need help to ___ every time I forget my reusable bags at the store.",
  "I need something that helps me ___ without my earbuds falling out.",
  "I need an invention that helps me ___ every time I forget my password.",

  // plain and simple
  "I need an invention that helps me ___.",
  "The one thing that would make my life easier is something that helps me ___.",
  "I wish someone would just invent a way to ___.",
  "All I need is something simple that helps me ___.",
  "If I could invent one thing right now, it would help me ___.",
  "I keep telling myself someone should invent a way to ___.",
  "Honestly, I just need help to ___.",
  "I would pay real money for something that helps me ___.",
];

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
