/** Mad-Libs-style "invention problem" templates. Each round one random
 *  player fills in the blank (marked "___"); the completed sentence becomes
 *  the problem everyone else draws a solution to — the same structure as
 *  Jackbox's Patently Stupid. */
export const PROMPT_TEMPLATES: string[] = [
  "Introducing the world's first invention that helps you ___.",
  "Scientists have finally created a device to stop people from ___.",
  "This gadget will change how you ___ forever.",
  "Nobody asked for it, but now you can finally ___.",
  "The next billion-dollar idea: a machine that lets you ___.",
  "Say goodbye to bad days with an invention that helps you ___.",
  "Coming soon to a store near you: something that solves the problem of ___.",
  "After years of research, scientists invented a way to ___.",
  "This one weird gadget helps you ___ without even trying.",
  "The future of home living: an invention that automatically does ___ for you.",
  "Tired of struggling to ___? There's finally an invention for that.",
  "Introducing the ultimate solution for people who can't stop ___.",
  "This invention was designed specifically to help astronauts ___.",
  "A revolutionary new product that finally lets pets ___.",
  "The invention every parent has been waiting for: something that helps kids ___.",
  "Breaking: local inventor creates machine that can ___ in seconds.",
  "This year's must-have gadget helps busy people ___ on the go.",
  "Finally, a solution for anyone who has ever wanted to ___ at work.",
  "Say hello to the world's first invention that combines your love of snacks with ___.",
  "Scientists warn this invention might be too good at helping you ___.",
  "The invention that promises to make ___ a thing of the past.",
  "Introducing a product built for one purpose only: to help you ___.",
  "This device was invented after one man got tired of trying to ___.",
  "The perfect gift for anyone who needs help to ___.",
  "A team of engineers spent 10 years building a machine that can ___.",
  "This new wearable helps you ___ hands-free.",
  "Finally, technology exists to help you ___ while you sleep.",
  "The invention every office needs: a machine that helps coworkers ___.",
  "This kitchen gadget was invented to help you ___ in half the time.",
  "Scientists just patented a device that lets your car ___.",
  "The world's laziest invention helps you ___ without lifting a finger.",
  "Introducing an invention made specifically for people who love to ___.",
  "This bathroom gadget was invented to help you ___ more efficiently.",
  "A new startup just raised millions for an invention that helps people ___.",
  "The invention nobody knew they needed: something that helps you ___ underwater.",
  "This new invention helps toddlers learn to ___ all by themselves.",
  "Scientists accidentally invented a device that helps you ___ better than ever.",
  "The must-have invention for road trips: something that helps you ___.",
  "Introducing a gadget that helps you ___ even in zero gravity.",
  "This invention was banned in 3 countries for being too good at helping people ___.",
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
