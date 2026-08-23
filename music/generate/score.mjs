// THE FULL SCORE — every screen, one motif.
//
// The four notes from "Draw It" (5 -> 8 -> 7 -> 5) run through all of these.
// What changes is how they're TRANSFORMED, which is how a film score keeps a
// theme present without playing the tune at you for an hour:
//
//   fragment  just the leap (2 notes)   - background tension, barely noticed
//   sparse    first and last note only  - the shape without the chatter
//   stretch   two long notes over a bar - calm screens, no forward push
//   invert    mirrored around the root  - unsettled; used where you're waiting
//   tail      the descent only          - resolution, endings
//   full      all four                  - menus and payoffs
//
// So the drawing screen and the winner screen are the same melody. One is
// whispered, one is shouted. That's what makes a soundtrack feel composed
// rather than assembled.

import { mkdirSync } from "node:fs";
import { SR, midiToFreq, SCALES, applyReverb, applyDelay, master, writeWavStereo } from "./engine.mjs";
import {
  ksPluck, mallet, uprightBass, softKick, snap, shaker, woodblock, brush,
  warmPad, applyChorus, tameMids,
} from "./acoustic.mjs";
import { bowedString, whistle, tambourine, triangle, handClap, tom, degToMidi } from "./acoustic2.mjs";
import { subBass, timpani, taiko, stringEnsemble, piano, choirPad, swell, impact } from "./cinematic.mjs";

SCALES.mixolydian = [0, 2, 4, 5, 7, 9, 10];

// The motif. [step, scaleDegree, lengthIn16ths]
const MOTIF = [[0, 5, 3], [3, 8, 3], [6, 7, 2], [8, 5, 6]];

function transform(mode) {
  const m = MOTIF;
  switch (mode) {
    case "fragment": return [m[0], m[1]];
    case "sparse":   return [[0, m[0][1], 4], [8, m[3][1], 8]];
    case "stretch":  return [[0, m[0][1], 8], [8, m[1][1], 8]];
    case "tail":     return [[0, m[2][1], 4], [4, m[3][1], 12]];
    case "invert": {
      const base = m[0][1];
      return m.map(([s, d, l]) => [s, base - (d - base), l]);
    }
    case "up":       return m.map(([s, d, l]) => [s, d + 1, l]);
    case "answer":   return [[0, 4, 3], [3, 3, 3], [6, 2, 2], [8, 1, 6]];
    default:         return m;
  }
}

export function renderScore(cfg) {
  const {
    bpm, root, scale, prog, sections, tail = 3.0,
    style = "cozy", reverb = 0.24, chorus = 0.26,
  } = cfg;

  const beat = 60 / bpm, bar = beat * 4, step = bar / 16;
  const totalBars = sections.reduce((a, s) => a + s.bars, 0);
  const n = Math.round((totalBars * bar + tail) * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const at = (b, s = 0) => Math.round((b * bar + s * step) * SR);
  const dg = (d, oct = 0) => degToMidi(root, scale, d) + oct * 12;
  const chordAt = (b) => {
    const d = prog[b % prog.length];
    return [dg(d), dg(d + 2), dg(d + 4)];
  };

  let b0 = 0;
  for (const sec of sections) {
    const lvl = sec.level ?? 1;
    // A section can cycle through several transforms bar to bar.
    const modes = Array.isArray(sec.motif) ? sec.motif : [sec.motif ?? "full"];

    for (let b = 0; b < sec.bars; b++) {
      const abs = b0 + b;
      const chord = chordAt(abs);
      const motif = transform(modes[b % modes.length]);
      const silent = sec.gap && b === sec.bars - 1;

      // ---- pads / sustained
      if (sec.pad) {
        chord.forEach((c) => {
          if (style === "epic") choirPad(L, R, at(abs), midiToFreq(c), bar * 0.94, sec.pad * lvl, { attack: 0.8, release: 1.1 });
          else warmPad(L, R, at(abs), midiToFreq(c - 12), bar * 0.94, sec.pad * lvl, { cutoff: 760 });
        });
      }
      if (sec.strings) {
        chord.forEach((c, ci) => {
          stringEnsemble(L, R, at(abs), midiToFreq(c), bar * 0.92, sec.strings * lvl * (ci ? 0.7 : 1), {
            voices: 7, attack: 0.3, release: 0.75, cutoff: 2000, pan: -0.4 + ci * 0.4,
          });
        });
      }
      if (sec.sub) subBass(L, R, at(abs), midiToFreq(chord[0] - 24), bar * 0.95, sec.sub * lvl);

      // ---- bass
      if (sec.bass === "root" && !silent) {
        for (const s of [0, 8]) uprightBass(L, R, at(abs, s), midiToFreq(chord[0] - 24), step * 6, 0.4 * lvl, { decay: 0.5 });
      } else if (sec.bass === "long" && !silent) {
        uprightBass(L, R, at(abs, 0), midiToFreq(chord[0] - 24), step * 14, 0.32 * lvl, { decay: 0.8 });
      } else if (sec.bass === "walk" && !silent) {
        const next = prog[(abs + 1) % prog.length];
        const line = [chord[0], chord[1], chord[2], dg(next) - 1];
        line.forEach((nt, i) => uprightBass(L, R, at(abs, i * 4), midiToFreq(nt - 24), step * 3.6, 0.36 * lvl, { decay: 0.42 }));
      }

      // ---- percussion
      if (!silent) {
        switch (sec.perc) {
          case "tick":
            // A clock without a clock: woodblock on the beat, nothing else.
            for (const s of [0, 4, 8, 12]) woodblock(L, R, at(abs, s), 0.1 * lvl, 1220, -0.25);
            break;
          case "brush":
            softKick(L, R, at(abs, 0), 0.3 * lvl);
            brush(L, R, at(abs, 4), 0.13 * lvl);
            brush(L, R, at(abs, 12), 0.14 * lvl, true);
            break;
          case "light":
            softKick(L, R, at(abs, 0), 0.42 * lvl);
            snap(L, R, at(abs, 8), 0.18 * lvl);
            for (const s of [4, 12]) shaker(L, R, at(abs, s), 0.08 * lvl);
            break;
          case "groove":
            softKick(L, R, at(abs, 0), 0.46 * lvl);
            softKick(L, R, at(abs, 10), 0.28 * lvl);
            snap(L, R, at(abs, 4), 0.22 * lvl);
            snap(L, R, at(abs, 12), 0.22 * lvl);
            for (const s of [2, 6, 10, 14]) shaker(L, R, at(abs, s), 0.09 * lvl);
            break;
          case "full":
            softKick(L, R, at(abs, 0), 0.5 * lvl);
            softKick(L, R, at(abs, 10), 0.3 * lvl);
            handClap(L, R, at(abs, 4), 0.24 * lvl);
            handClap(L, R, at(abs, 12), 0.24 * lvl);
            for (const s of [0, 2, 4, 6, 8, 10, 12, 14]) shaker(L, R, at(abs, s), 0.08 * lvl);
            if (abs % 2 === 1) tambourine(L, R, at(abs, 14), 0.1 * lvl);
            break;
          case "epic":
            taiko(L, R, at(abs, 0), 0.44 * lvl);
            taiko(L, R, at(abs, 8), 0.3 * lvl);
            timpani(L, R, at(abs, 0), midiToFreq(chord[0] - 24), 0.3 * lvl);
            break;
        }
      }

      // ---- comp
      if (sec.comp && !silent) {
        const steps = sec.comp === "busy" ? [2, 6, 10, 14] : [4, 12];
        for (const cs of steps) {
          chord.forEach((c, ci) => {
            ksPluck(L, R, at(abs, cs) + ci * 190, midiToFreq(c), 1.2, 0.1 * lvl, {
              damping: 0.62, brightness: 0.4, pan: -0.28 + ci * 0.28, pick: 0.3,
            });
          });
        }
      }

      // ---- arpeggio bed
      if (sec.arp && !silent) {
        const notes = [chord[0], chord[1], chord[2], chord[1]];
        for (let s = 0; s < 16; s += sec.arp) {
          ksPluck(L, R, at(abs, s), midiToFreq(notes[((s / sec.arp) | 0) % 4]), 1.0, 0.11 * lvl, {
            damping: 0.52, brightness: 0.48, pan: (s / sec.arp) % 2 ? 0.22 : -0.22, pick: 0.28,
          });
        }
      }

      // ---- THE MOTIF
      if (sec.voice && !silent) {
        for (const [st, d, len] of motif) {
          const midi = dg(d, sec.oct ?? 1);
          const s0 = at(abs, st), dur = step * len, amp = (sec.amp ?? 0.4) * lvl;
          switch (sec.voice) {
            case "whistle": whistle(L, R, s0, midiToFreq(midi), dur * 0.95, amp * 0.8, { pan: 0.05 }); break;
            case "piano":   piano(L, R, s0, midiToFreq(midi), amp * 0.8, { decay: 1.4, pan: -0.05 }); break;
            case "strings":
              stringEnsemble(L, R, s0, midiToFreq(midi), dur * 0.95, amp * 0.5, {
                voices: 7, attack: 0.06, release: 0.35, cutoff: 2700, spread: 0.5,
              });
              break;
            case "uke":
              ksPluck(L, R, s0, midiToFreq(midi), Math.min(dur * 1.9, 2.2), amp, {
                damping: 0.42, brightness: 0.55, pick: 0.26, pan: -0.1,
              });
              break;
            default: mallet(L, R, s0, midiToFreq(midi), amp * 0.85, sec.voice, { pan: -0.06 });
          }
          if (sec.double) mallet(L, R, s0, midiToFreq(midi + 12), (sec.doubleAmp ?? 0.14) * lvl, sec.double, { pan: 0.24 });
        }
      }

      // ---- echo / response
      if (sec.echo && !silent) {
        for (const [st, d, len] of motif) {
          if (st + 8 >= 16) continue;
          const midi = dg(d, (sec.oct ?? 1) + (sec.echoOct ?? 0));
          if (sec.echo === "whistle") whistle(L, R, at(abs, st + 8), midiToFreq(midi), step * len * 0.9, 0.15 * lvl, { pan: 0.42 });
          else mallet(L, R, at(abs, st + 8), midiToFreq(midi), 0.16 * lvl, sec.echo, { pan: 0.4 });
        }
      }

      if (sec.fill === "toms" && b === sec.bars - 1) {
        [8, 10, 12, 14].forEach((s, i) => tom(L, R, at(abs, s), 190 - i * 24, 0.26 * lvl, -0.3 + i * 0.2));
      }
      if (sec.fill === "swell" && b === sec.bars - 1) swell(L, R, at(abs), bar, 0.18);
      if (sec.impactOn && b === 0) impact(L, R, at(abs), 0.42);
      if (sec.shimmer && b === 0) triangle(L, R, at(abs), 0.1 * lvl);
    }
    b0 += sec.bars;
  }

  applyChorus(L, R, 5.5, 0.4, chorus);
  applyDelay(L, R, step * 6, 0.2, 0.08);
  applyReverb(L, R, reverb, style === "epic" ? 1.4 : 1.1, 0.4);
  tameMids(L, R, style === "epic" ? 0.3 : 0.42);
  master(L, R, { targetPeak: 0.88, drive: style === "epic" ? 1.03 : 1.06, fadeOut: 0.3 });

  // Seamless loop: everything after the final bar is reverb/release tail. Fold
  // it back over the opening so the loop point has no gap and no pile-up —
  // this is what lets a 40-second loop run for ten minutes unnoticed.
  if (cfg.loop !== false) {
    const loopN = Math.round(totalBars * bar * SR);
    const foldN = Math.min(Math.round(1.4 * SR), n - loopN);
    if (loopN > 0 && loopN < n) {
      for (let i = 0; i < foldN; i++) {
        const j = i;
        if (j >= loopN) break;
        // Taper the fold so the seam is a decay, not a hit.
        const g = 1 - i / foldN;
        L[j] += L[loopN + i] * g; R[j] += R[loopN + i] * g;
      }
      return { L: L.slice(0, loopN), R: R.slice(0, loopN), totalSec: loopN / SR, totalBars };
    }
  }
  return { L, R, totalSec: n / SR, totalBars };
}

// ---------------------------------------------------------------------------
// ONE TRACK PER SCREEN
// ---------------------------------------------------------------------------

const D = 62; // D — the game's home key, so everything relates

export const SCORE = [
  {
    name: "Opening",
    file: "s01_title",
    screen: "Title screen",
    brief: "Plays once while the logo draws itself. States the motif plainly, alone, so the first thing anyone hears is the thing they'll hear all game.",
    instruments: "Ukulele · whistle · warm pad",
    bpm: 112, root: D, scale: "major", prog: [1, 1, 5, 5], style: "cozy", reverb: 0.28, loop: false,
    sections: [
      { bars: 2, pad: 0.14, arp: 4, level: 0.5 },
      { bars: 2, motif: "full", voice: "uke", amp: 0.46, pad: 0.12, bass: "long", level: 0.8 },
      { bars: 2, motif: "full", voice: "whistle", echo: "glockenspiel", amp: 0.5, pad: 0.14, bass: "long", shimmer: true, level: 0.9 },
      { bars: 2, motif: "tail", voice: "uke", double: "glockenspiel", amp: 0.4, pad: 0.12, bass: "long", level: 0.7 },
    ],
  },
  {
    name: "Front Room",
    file: "s02_lobby",
    screen: "Lobby · friends joining",
    brief: "People are talking and reading a room code aloud. The motif is stretched to two long notes so it's present without asking for attention, and the bass just strolls.",
    instruments: "Marimba · upright bass · brushes · ukulele comp",
    bpm: 94, root: D, scale: "major", prog: [1, 6, 4, 5], style: "cozy", reverb: 0.26,
    sections: [
      { bars: 4, motif: "stretch", voice: "marimba", amp: 0.3, bass: "walk", perc: "brush", comp: true, pad: 0.08 },
      { bars: 4, motif: ["stretch", "sparse"], voice: "marimba", echo: "vibraphone", amp: 0.3, bass: "walk", perc: "brush", comp: true, pad: 0.08 },
      { bars: 4, motif: ["sparse", "stretch"], voice: "uke", amp: 0.32, bass: "walk", perc: "light", comp: true, pad: 0.07, level: 1.05 },
    ],
  },
  {
    name: "Finding People",
    file: "s03_matchmaking",
    screen: "Ranked queue · waiting for a match",
    brief: "A woodblock keeps time like a clock that isn't stressful, and only the leap of the motif shows up — two notes, unresolved. It should feel like something is about to happen without promising when.",
    instruments: "Woodblock · marimba · upright bass · pad",
    bpm: 104, root: D, scale: "major", prog: [1, 5, 6, 5], style: "cozy", reverb: 0.24,
    sections: [
      { bars: 4, motif: "fragment", voice: "marimba", amp: 0.24, bass: "long", perc: "tick", pad: 0.1, level: 0.62 },
      { bars: 4, motif: ["fragment", "fragment", "sparse", "fragment"], voice: "marimba", echo: "glockenspiel", amp: 0.24, bass: "long", perc: "tick", pad: 0.1, level: 0.66 },
      { bars: 4, motif: ["fragment", "sparse"], voice: "marimba", amp: 0.24, bass: "long", perc: "tick", pad: 0.09, level: 0.6 },
    ],
  },
  {
    name: "Think of Something",
    file: "s04_prompt",
    screen: "Writing the prompt · 40 seconds",
    brief: "One player is typing and everyone else is waiting on them. Kalimba and a soft pad, motif inverted so it feels open-ended rather than settled.",
    instruments: "Kalimba · warm pad · shaker",
    bpm: 88, root: D, scale: "major", prog: [1, 4, 6, 5], style: "cozy", reverb: 0.3,
    sections: [
      { bars: 4, motif: "invert", voice: "kalimba", amp: 0.27, bass: "long", pad: 0.13, level: 0.62 },
      { bars: 4, motif: ["invert", "sparse"], voice: "kalimba", echo: "vibraphone", amp: 0.27, bass: "long", perc: "brush", pad: 0.13, level: 0.66 },
      { bars: 4, motif: ["sparse", "invert"], voice: "marimba", amp: 0.28, bass: "long", perc: "brush", pad: 0.13, level: 0.9 },
    ],
  },
  {
    name: "Pens Down",
    file: "s05_drawing",
    screen: "Drawing · 75 seconds",
    brief: "The one that must never be muted, and now the one that stays out of the way. Every track is peak-normalised by the mastering stage, so 'quiet' cannot be achieved here — it is set as a playback gain in AudioService. What IS set here is density: the brushes are gone entirely, the pad carries more of the weight than the mallets, and half the phrases are 'sparse'. The result is a track with nothing rhythmic in it to pull an eye off the canvas.",
    instruments: "Marimba · vibraphone · kalimba · cello · pad",
    bpm: 82, root: D, scale: "major", prog: [1, 6, 4, 5, 1, 6, 2, 5], style: "cozy", reverb: 0.4,
    sections: [
      { bars: 4, motif: ["stretch", "sparse"], voice: "marimba", amp: 0.19, bass: "long", pad: 0.2, level: 0.7 },
      { bars: 4, motif: ["sparse", "stretch"], voice: "vibraphone", amp: 0.18, bass: "long", pad: 0.2, strings: 0.07, level: 0.7 },
      { bars: 4, motif: ["sparse", "invert"], voice: "vibraphone", echo: "kalimba", amp: 0.18, bass: "long", pad: 0.2, level: 0.68 },
      { bars: 4, motif: ["sparse", "tail"], voice: "kalimba", amp: 0.18, bass: "long", pad: 0.2, strings: 0.07, level: 0.68 },
    ],
  },
  {
    name: "Everyone Else",
    file: "s06_waiting",
    screen: "Waiting for other players",
    brief: "A holding pattern, not a build. Two notes of the motif circling over a single held chord — deliberately going nowhere, because it might be five seconds or forty.",
    instruments: "Vibraphone · warm pad · shaker",
    bpm: 90, root: D, scale: "major", prog: [1, 1, 4, 4], style: "cozy", reverb: 0.32,
    sections: [
      { bars: 4, motif: "fragment", voice: "vibraphone", amp: 0.26, bass: "long", pad: 0.15, level: 0.65 },
      { bars: 4, motif: ["fragment", "sparse"], voice: "vibraphone", echo: "glockenspiel", amp: 0.26, bass: "long", pad: 0.15, perc: "brush", level: 0.7 },
    ],
  },
  {
    name: "Have a Look",
    file: "s07_presentation",
    screen: "Showing each drawing",
    brief: "Curious and light, so a bad drawing gets the laugh rather than a fanfare. Ukulele plays the motif plainly with a glockenspiel answering, one phrase per drawing.",
    instruments: "Ukulele · glockenspiel · upright bass · snaps",
    bpm: 108, root: D, scale: "major", prog: [1, 5, 6, 4], style: "cozy", reverb: 0.24,
    sections: [
      { bars: 4, motif: "full", voice: "uke", amp: 0.36, bass: "root", perc: "light", comp: true, pad: 0.07 },
      { bars: 4, motif: ["full", "up"], voice: "uke", echo: "glockenspiel", amp: 0.36, bass: "root", perc: "groove", comp: true, level: 1.02 },
    ],
  },
  {
    name: "Place Your Bets",
    file: "s08_voting",
    screen: "Voting / investing · 35 seconds",
    brief: "There's a decision and a clock. Slightly faster, minor-tinged, motif tightened up with a walking bass underneath so it presses forward without nagging.",
    instruments: "Marimba · upright bass · woodblock · snaps",
    bpm: 118, root: D, scale: "dorian", prog: [1, 7, 4, 5], style: "cozy", reverb: 0.22,
    sections: [
      { bars: 4, motif: "full", voice: "marimba", amp: 0.32, bass: "walk", perc: "tick", comp: true, level: 0.85 },
      { bars: 4, motif: ["full", "up"], voice: "marimba", echo: "glockenspiel", amp: 0.32, bass: "walk", perc: "groove", comp: true, level: 1 },
      { bars: 4, motif: ["up", "full"], voice: "uke", amp: 0.34, bass: "walk", perc: "groove", comp: "busy", level: 1.08, fill: "toms" },
    ],
  },
  {
    name: "And the Money Went To",
    file: "s09_reveal",
    screen: "Score reveal",
    brief: "Builds under the numbers counting up. Starts on a single held string note, adds a layer per bar, and lands on the full motif when the totals do.",
    instruments: "Strings · piano · timpani · glockenspiel",
    bpm: 100, root: D, scale: "major", prog: [1, 5, 6, 4], style: "epic", reverb: 0.3, loop: false,
    sections: [
      { bars: 2, motif: "fragment", voice: "piano", amp: 0.34, strings: 0.06, sub: 0.16, level: 0.35 },
      { bars: 2, motif: "sparse", voice: "piano", amp: 0.36, strings: 0.1, sub: 0.22, perc: "brush", level: 0.55 },
      { bars: 2, motif: "full", voice: "strings", amp: 0.4, strings: 0.16, sub: 0.3, perc: "epic", level: 0.8, fill: "swell" },
      { bars: 4, motif: ["full", "up"], voice: "strings", double: "glockenspiel", amp: 0.42, strings: 0.24, sub: 0.38, perc: "epic", pad: 0.1, level: 1, impactOn: true },
    ],
  },
  {
    name: "The Board",
    file: "s10_leaderboard",
    screen: "Leaderboard",
    brief: "Calm pride rather than triumph — you're reading a list, not winning anything. Piano states the motif slowly over strings, no percussion at all.",
    instruments: "Felt piano · strings · sub",
    bpm: 86, root: D, scale: "major", prog: [1, 6, 4, 5], style: "epic", reverb: 0.32,
    sections: [
      { bars: 4, motif: "stretch", voice: "piano", amp: 0.36, strings: 0.08, sub: 0.16, level: 0.6 },
      { bars: 4, motif: ["stretch", "sparse"], voice: "piano", echo: "glockenspiel", amp: 0.36, strings: 0.12, sub: 0.2, level: 0.75 },
      { bars: 4, motif: ["sparse", "tail"], voice: "piano", amp: 0.34, strings: 0.1, sub: 0.18, level: 0.65 },
    ],
  },
];

export function saveScore(path, L, R) {
  mkdirSync(path.substring(0, path.lastIndexOf("/")), { recursive: true });
  writeWavStereo(path, L, R);
}
