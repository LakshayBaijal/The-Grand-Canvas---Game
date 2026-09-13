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
//   call      the first half, held      - leaves a gap for an echo to answer
//   turn      ornamented with a passing note - the tune, sung rather than spelt
//   skip      double-time, then two long notes - the rhythmic hook
//   high      the whole thing an octave up - for a climax, once
//
// So the drawing screen and the winner screen are the same melody. One is
// whispered, one is shouted. That's what makes a soundtrack feel composed
// rather than assembled.
//
// The first six are all *reductions* — they take notes away. That is right for
// a loop playing under a screen, and it is why the title track needed the last
// four: a piece somebody actually listens to has to add, not just subtract.

import { mkdirSync } from "node:fs";
import {
  SR, midiToFreq, SCALES, applyReverb, applyDelay, master, writeWavStereo,
  kick, snare, hat, clap, crash,
} from "./engine.mjs";
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

    // The three below exist for one job: carrying a long piece. Six of the
    // transforms above are reductions — they take notes away — which is right
    // for a background loop but leaves nothing to develop across a title
    // track that has to hold someone's attention for over a minute.

    // Ornamented: a passing note leans into the leap. The extra note is what
    // makes a tune feel sung rather than spelled out.
    case "turn":     return [[0, 5, 2], [2, 6, 1], [3, 8, 3], [6, 7, 2], [8, 5, 6]];

    // Double-time and bouncy in the first half, then two long notes to land
    // on. The rhythmic hook, and the one people end up humming.
    case "skip":     return [[0, 5, 2], [2, 8, 2], [4, 7, 2], [6, 5, 2], [8, 8, 4], [12, 5, 4]];

    // The opening half only, held — leaves the back of the bar empty on
    // purpose so an `echo` voice has somewhere to answer from.
    case "call":     return [[0, 5, 3], [3, 8, 5]];

    // An octave up, for the last statement, where the tune needs to arrive
    // somewhere it has not already been.
    case "high":     return m.map(([s, d, l]) => [s, d + 7, l]);

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
  // The drum bus. Everything struck goes here rather than into L/R, so the
  // chorus, delay and room reverb that make the pads sit back never touch a
  // transient. The delay in particular is timed at six sixteenths, which put
  // a ghost of every kick on the "and" of the bar and turned a beat into a
  // wash. Mixed in dry, with only a short, small reverb of its own, after the
  // melodic bus has had its effects.
  const D = new Float32Array(n), E = new Float32Array(n);

  // Swing: the off-beat eighths land late rather than dead on the grid, which
  // is the difference between a sequencer and somebody playing. Everything
  // rides on it — shakers, comps, arpeggios and any motif note that falls
  // there — so one number per track shuffles the whole arrangement together.
  //
  // Applied to `s % 4 === 2` only: those are the "and"s of each beat. Swinging
  // every odd sixteenth instead turns a shuffle into a stagger.
  const swing = cfg.swing ?? 0;
  // Kit gain. The pads and arpeggio sit at a level chosen for a living-room
  // sound, and at 1.0 the drums measured only ~20% louder on the beat than
  // off it -- present, not felt. Measured as a ratio, not by ear: the 30ms
  // RMS on each downbeat over the 30ms one sixteenth later, across 32 bars.
  const K = cfg.kit ?? 1.0;
  const at = (b, s = 0) =>
    Math.round((b * bar + (s + (s % 4 === 2 ? swing * 0.5 : 0)) * step) * SR);
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
            for (const s of [0, 4, 8, 12]) woodblock(D, E, at(abs, s), 0.1 * lvl, 1220, -0.25);
            break;
          case "brush":
            softKick(D, E, at(abs, 0), 0.3 * lvl);
            brush(D, E, at(abs, 4), 0.13 * lvl);
            brush(D, E, at(abs, 12), 0.14 * lvl, true);
            break;
          case "light":
            softKick(D, E, at(abs, 0), 0.42 * lvl);
            snap(D, E, at(abs, 8), 0.18 * lvl);
            for (const s of [4, 12]) shaker(D, E, at(abs, s), 0.08 * lvl);
            break;
          case "groove":
            softKick(D, E, at(abs, 0), 0.46 * lvl);
            softKick(D, E, at(abs, 10), 0.28 * lvl);
            snap(D, E, at(abs, 4), 0.22 * lvl);
            snap(D, E, at(abs, 12), 0.22 * lvl);
            for (const s of [2, 6, 10, 14]) shaker(D, E, at(abs, s), 0.09 * lvl);
            break;
          case "full":
            softKick(D, E, at(abs, 0), 0.5 * lvl);
            softKick(D, E, at(abs, 10), 0.3 * lvl);
            handClap(D, E, at(abs, 4), 0.24 * lvl);
            handClap(D, E, at(abs, 12), 0.24 * lvl);
            for (const s of [0, 2, 4, 6, 8, 10, 12, 14]) shaker(D, E, at(abs, s), 0.08 * lvl);
            if (abs % 2 === 1) tambourine(D, E, at(abs, 14), 0.1 * lvl);
            break;
          case "epic":
            taiko(D, E, at(abs, 0), 0.44 * lvl);
            taiko(D, E, at(abs, 8), 0.3 * lvl);
            timpani(D, E, at(abs, 0), midiToFreq(chord[0] - 24), 0.3 * lvl);
            break;

          // The three below are the *real* drum kit — engine.mjs's kick,
          // snare, hats and clap, which the score never touched because the
          // whole palette was chosen to sound like a living room. That was
          // right for texture and wrong for pulse: a soft thump and a finger
          // snap don't make anyone nod, and a tune nobody nods to is a tune
          // nobody hums afterwards. Kick on the one, snare on the backbeat,
          // hats keeping time — the shape every catchy thing shares.

          // Half-time. Weight without hurry, for screens where people are
          // reading or waiting.
          case "halfbeat":
            kick(D, E, at(abs, 0), 0.62 * K * lvl, { decay: 0.3 });
            snare(D, E, at(abs, 8), 0.40 * K * lvl, { decay: 0.14 });
            for (const s of [0, 2, 4, 6, 8, 10, 12, 14]) hat(D, E, at(abs, s), (s % 4 === 0 ? 0.2 : 0.12) * K * lvl);
            hat(D, E, at(abs, 14), 0.14 * K * lvl, true);
            break;

          // The groove. Kick on one and the and-of-three, snare on two and
          // four with a clap under it, eighth hats with the open one at the
          // end of the bar pulling into the next.
          case "beat":
            kick(D, E, at(abs, 0), 0.72 * K * lvl, { decay: 0.3 });
            kick(D, E, at(abs, 10), 0.50 * K * lvl, { decay: 0.24 });
            snare(D, E, at(abs, 4), 0.46 * K * lvl, { decay: 0.15 });
            snare(D, E, at(abs, 12), 0.48 * K * lvl, { decay: 0.15 });
            clap(D, E, at(abs, 12), 0.20 * K * lvl);
            for (const s of [0, 2, 4, 6, 8, 10, 12]) hat(D, E, at(abs, s), (s % 4 === 0 ? 0.22 : 0.13) * K * lvl);
            hat(D, E, at(abs, 14), 0.17 * K * lvl, true);
            break;

          // Everything on. Sixteenth hats with a velocity shape so they
          // bounce instead of hiss, an extra kick pushing into the backbeat,
          // and a ghost snare on the last sixteenth every other bar — the
          // little stumble that makes a beat feel played.
          case "beatfull": {
            kick(D, E, at(abs, 0), 0.76 * K * lvl, { decay: 0.32 });
            kick(D, E, at(abs, 6), 0.42 * K * lvl, { decay: 0.22 });
            kick(D, E, at(abs, 10), 0.56 * K * lvl, { decay: 0.26 });
            snare(D, E, at(abs, 4), 0.50 * K * lvl, { decay: 0.16 });
            snare(D, E, at(abs, 12), 0.52 * K * lvl, { decay: 0.16 });
            clap(D, E, at(abs, 4), 0.16 * K * lvl);
            clap(D, E, at(abs, 12), 0.24 * K * lvl);
            const shape = [0.24, 0.09, 0.15, 0.09, 0.2, 0.09, 0.15, 0.1, 0.24, 0.09, 0.15, 0.09, 0.2, 0.09, 0.15, 0.11];
            for (let s = 0; s < 16; s++) {
              if (s === 14) hat(D, E, at(abs, s), 0.18 * K * lvl, true);
              else hat(D, E, at(abs, s), shape[s] * K * lvl);
            }
            if (b % 2 === 1) snare(D, E, at(abs, 15), 0.16 * K * lvl, { decay: 0.08 });
            break;
          }
        }
      }

      // ---- drumsticks
      // Layered rather than switched. `perc` picks one kit at a time, so the
      // woodblock could only ever be the *whole* percussion part — which is
      // why it vanished the moment a track got a real kit under it. As its own
      // channel it sits on top of anything.
      if (sec.sticks && !silent) {
        // [step, accented]. Son clave is five hits that imply the whole bar,
        // and it is the reason a stick pattern sticks where a count-in doesn't.
        const PATTERNS = {
          count: [[0, 1], [4, 0], [8, 1], [12, 0]],
          clave: [[0, 1], [3, 0], [6, 1], [10, 0], [12, 1]],
          busy: [[0, 1], [2, 0], [4, 1], [6, 0], [8, 1], [10, 0], [12, 1], [14, 0]],
        };
        const hits = PATTERNS[sec.sticks === true ? "count" : sec.sticks] ?? PATTERNS.count;
        const gain = sec.sticksAmp ?? 1;
        for (const [s, accent] of hits) {
          // Accents sit a little higher and a little wider, so it reads as two
          // sticks in a pair of hands rather than one sample retriggering.
          woodblock(
            L, R, at(abs, s),
            (accent ? 0.135 : 0.085) * gain * lvl,
            accent ? 1290 : 1140,
            accent ? -0.3 : -0.14,
          );
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
        [8, 10, 12, 14].forEach((s, i) => tom(D, E, at(abs, s), 190 - i * 24, 0.26 * lvl, -0.3 + i * 0.2));
      }
      if (sec.fill === "swell" && b === sec.bars - 1) swell(L, R, at(abs), bar, 0.18);
      // A snare roll into the next section: four hits, each louder, then the
      // crash lands on the downbeat that follows.
      if (sec.fill === "roll" && b === sec.bars - 1) {
        [12, 13, 14, 15].forEach((s, i) => snare(D, E, at(abs, s), (0.22 + i * 0.1) * lvl, { decay: 0.1 }));
      }
      if (sec.crash && b === 0) crash(D, E, at(abs, 0), 0.22 * lvl);
      if (sec.impactOn && b === 0) impact(L, R, at(abs), 0.42);
      if (sec.shimmer && b === 0) triangle(L, R, at(abs), 0.1 * lvl);
    }
    b0 += sec.bars;
  }

  applyChorus(L, R, 5.5, 0.4, chorus);
  applyDelay(L, R, step * 6, 0.2, 0.08);
  applyReverb(L, R, reverb, style === "epic" ? 1.4 : 1.1, 0.4);
  applyReverb(D, E, 0.07, 0.6, 0.5);
  for (let i = 0; i < n; i++) { L[i] += D[i]; R[i] += E[i]; }
  tameMids(L, R, style === "epic" ? 0.3 : 0.42);
  // Drive is what makes a track *loud* rather than merely peaking at the
  // ceiling: the soft clipper folds the transients over and the average level
  // rises. 1.06 was polite; the whole score read as too soft on a phone.
  master(L, R, { targetPeak: 0.92, drive: style === "epic" ? 1.3 : 1.45, fadeOut: 0.3 });

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
    brief: "The theme tune, and the only track written to be listened to rather than sat under. Thirty-six bars with a real shape: the hook stated bare, answered, taken somewhere else, then brought back twice as big. It loops on the home screen, so it is also the one people hear for minutes at a time while they wait for friends to join — which is the whole argument for giving it somewhere to go.",
    instruments: "Ukulele · whistle · glockenspiel · marimba · upright bass",
    // A moving eight-bar progression rather than the two chords this used to
    // sit on. Over four-bar sections the harmony lands differently each time
    // the hook comes round, which is most of why a long piece stays alive.
    bpm: 118, root: D, scale: "major", prog: [1, 5, 6, 4, 1, 6, 2, 5], style: "cozy", reverb: 0.25, swing: 0.22,
    sections: [
      // Straight in on the hook. There was a four-bar accompaniment-only intro
      // here; on a screen people sit on for minutes it just read as the track
      // being slow to start, and on every loop it came round again.
      { bars: 4, motif: "full", voice: "uke", double: "glockenspiel", amp: 0.46, pad: 0.12, bass: "root", perc: "light", sticks: true, arp: 4, level: 0.9 },
      // A2 — call and response: the whistle asks, the glockenspiel answers in
      // the gap `call` leaves at the back of the bar.
      { bars: 4, motif: ["call", "full"], voice: "whistle", echo: "glockenspiel", amp: 0.5, pad: 0.14, bass: "root", perc: "groove", sticks: "clave", arp: 4, shimmer: true, level: 0.94 },
      // B — the turn. Drops the kit and inverts the tune, so the return of the
      // hook afterwards is worth something. The sticks carry it alone here.
      { bars: 4, motif: ["invert", "turn"], voice: "marimba", echo: "vibraphone", amp: 0.34, bass: "walk", perc: "brush", sticks: "clave", comp: true, pad: 0.1, level: 0.78, fill: "roll" },
      // A3 — back, on a walking bass, with the bouncy restatement alternating.
      { bars: 4, motif: ["full", "skip"], voice: "uke", double: "glockenspiel", amp: 0.48, bass: "walk", perc: "beat", sticks: "clave", comp: true, arp: 4, level: 0.98, crash: true },
      // C — the lift: up a step, then up an octave. Nowhere else in the score
      // goes this high, which is what makes it read as a climb.
      { bars: 4, motif: ["up", "high"], voice: "whistle", echo: "glockenspiel", amp: 0.5, bass: "walk", perc: "beatfull", sticks: "busy", comp: "busy", pad: 0.1, level: 1.02, fill: "roll" },
      // A4 — everything at once, six bars of it. The payoff.
      { bars: 6, motif: ["full", "skip", "full", "turn"], voice: "uke", double: "glockenspiel", echo: "whistle", amp: 0.5, bass: "walk", perc: "beatfull", sticks: "clave", comp: "busy", arp: 4, shimmer: true, level: 1.1, crash: true },
      // Outro — comes down, but keeps the kit and the sticks running. With no
      // intro to hand back to, a wind-down that thinned out to nothing would
      // just put the slow opening back on every loop.
      { bars: 6, motif: ["tail", "sparse", "turn", "full"], voice: "marimba", double: "glockenspiel", doubleAmp: 0.12, amp: 0.36, bass: "walk", perc: "light", sticks: true, arp: 4, pad: 0.12, level: 0.8 },
    ],
  },
  {
    name: "Front Room",
    file: "s02_lobby",
    screen: "Lobby · friends joining",
    brief: "People are talking and reading a room code aloud. The motif is stretched to two long notes so it's present without asking for attention, and the bass just strolls.",
    instruments: "Marimba · upright bass · brushes · ukulele comp",
    bpm: 100, root: D, scale: "major", prog: [1, 6, 4, 5], style: "cozy", reverb: 0.24, swing: 0.32,
    sections: [
      { bars: 4, motif: "stretch", voice: "marimba", amp: 0.3, bass: "walk", perc: "brush", comp: true, pad: 0.08 },
      { bars: 4, motif: ["stretch", "full", "stretch", "turn"], voice: "marimba", echo: "glockenspiel", amp: 0.3, bass: "walk", perc: "light", sticks: true, comp: true, arp: 4, pad: 0.08 },
      { bars: 4, motif: ["full", "skip", "up", "turn"], voice: "uke", double: "glockenspiel", amp: 0.34, bass: "walk", perc: "beat", sticks: "clave", comp: "busy", pad: 0.07, level: 1.08, fill: "roll" },
    ],
  },
  {
    name: "Finding People",
    file: "s03_matchmaking",
    screen: "Ranked queue · waiting for a match",
    brief: "A woodblock keeps time like a clock that isn't stressful, and only the leap of the motif shows up — two notes, unresolved. It should feel like something is about to happen without promising when.",
    instruments: "Woodblock · marimba · upright bass · pad",
    bpm: 110, root: D, scale: "major", prog: [1, 5, 6, 5], style: "cozy", reverb: 0.22, swing: 0.3,
    sections: [
      { bars: 4, motif: "fragment", voice: "marimba", amp: 0.26, bass: "root", perc: "tick", pad: 0.1, level: 0.68 },
      { bars: 4, motif: ["fragment", "full", "fragment", "up"], voice: "marimba", echo: "glockenspiel", amp: 0.26, bass: "root", perc: "light", sticks: true, arp: 4, pad: 0.1, level: 0.8 },
      { bars: 4, motif: ["full", "fragment", "turn", "call"], voice: "uke", amp: 0.28, bass: "walk", perc: "groove", sticks: "clave", comp: true, pad: 0.09, level: 0.9 },
    ],
  },
  {
    name: "Think of Something",
    file: "s04_prompt",
    screen: "Writing the prompt · 40 seconds",
    brief: "One player is typing and everyone else is waiting on them. Kalimba and a soft pad, motif inverted so it feels open-ended rather than settled.",
    instruments: "Kalimba · warm pad · shaker",
    bpm: 96, root: D, scale: "major", prog: [1, 4, 6, 5], style: "cozy", reverb: 0.26, swing: 0.3,
    sections: [
      { bars: 4, motif: "invert", voice: "kalimba", amp: 0.28, bass: "root", perc: "brush", arp: 4, pad: 0.13, level: 0.68 },
      { bars: 4, motif: ["invert", "full", "invert", "call"], voice: "kalimba", echo: "glockenspiel", amp: 0.28, bass: "root", perc: "light", arp: 4, pad: 0.13, level: 0.78 },
      { bars: 4, motif: ["full", "turn", "invert", "full"], voice: "marimba", double: "glockenspiel", amp: 0.3, bass: "walk", perc: "groove", sticks: true, comp: true, pad: 0.12, level: 0.95 },
    ],
  },
  {
    name: "Pens Down",
    file: "s05_drawing",
    screen: "Drawing · 75 seconds",
    brief: "The one that must never be muted, and now the one that stays out of the way. Every track is peak-normalised by the mastering stage, so 'quiet' cannot be achieved here — it is set as a playback gain in AudioService. What IS set here is density: the brushes are gone entirely, the pad carries more of the weight than the mallets, and half the phrases are 'sparse'. The result is a track with nothing rhythmic in it to pull an eye off the canvas.",
    instruments: "Marimba · vibraphone · kalimba · cello · pad",
    bpm: 88, root: D, scale: "major", prog: [1, 6, 4, 5, 1, 6, 2, 5], style: "cozy", reverb: 0.36, swing: 0.28,
    sections: [
      { bars: 4, motif: ["stretch", "sparse"], voice: "marimba", amp: 0.2, bass: "long", arp: 8, pad: 0.2, level: 0.72 },
      { bars: 4, motif: ["sparse", "call", "stretch", "full"], voice: "vibraphone", echo: "glockenspiel", amp: 0.19, bass: "long", arp: 8, pad: 0.2, strings: 0.07, level: 0.74 },
      { bars: 4, motif: ["full", "sparse", "turn", "sparse"], voice: "vibraphone", echo: "kalimba", amp: 0.19, bass: "root", perc: "brush", arp: 8, pad: 0.19, level: 0.76 },
      { bars: 4, motif: ["sparse", "tail"], voice: "kalimba", double: "glockenspiel", doubleAmp: 0.1, amp: 0.19, bass: "long", arp: 8, pad: 0.2, strings: 0.07, level: 0.72 },
    ],
  },
  {
    name: "Everyone Else",
    file: "s06_waiting",
    screen: "Waiting for other players",
    brief: "A holding pattern, not a build. Two notes of the motif circling over a single held chord — deliberately going nowhere, because it might be five seconds or forty.",
    instruments: "Vibraphone · warm pad · shaker",
    bpm: 98, root: D, scale: "major", prog: [1, 1, 4, 4], style: "cozy", reverb: 0.28, swing: 0.32,
    sections: [
      { bars: 4, motif: "fragment", voice: "vibraphone", amp: 0.27, bass: "root", perc: "brush", arp: 4, pad: 0.15, level: 0.72 },
      { bars: 4, motif: ["fragment", "full", "call", "turn"], voice: "vibraphone", echo: "glockenspiel", amp: 0.27, bass: "root", pad: 0.15, perc: "light", comp: true, arp: 4, level: 0.84 },
    ],
  },
  {
    name: "Have a Look",
    file: "s07_presentation",
    screen: "Showing each drawing",
    brief: "Curious and light, so a bad drawing gets the laugh rather than a fanfare. Ukulele plays the motif plainly with a glockenspiel answering, one phrase per drawing.",
    instruments: "Ukulele · glockenspiel · upright bass · snaps",
    bpm: 116, root: D, scale: "major", prog: [1, 5, 6, 4], style: "cozy", reverb: 0.21, swing: 0.34,
    sections: [
      { bars: 4, motif: "full", voice: "uke", double: "glockenspiel", amp: 0.38, bass: "root", perc: "groove", sticks: true, comp: true, arp: 4, pad: 0.07 },
      { bars: 4, motif: ["full", "skip", "turn", "up"], voice: "uke", echo: "glockenspiel", amp: 0.38, bass: "walk", perc: "beat", sticks: "clave", comp: "busy", arp: 4, shimmer: true, level: 1.06, fill: "roll", crash: true },
    ],
  },
  {
    name: "Place Your Bets",
    file: "s08_voting",
    screen: "Voting / investing · 35 seconds",
    brief: "There's a decision and a clock. Slightly faster, minor-tinged, motif tightened up with a walking bass underneath so it presses forward without nagging.",
    instruments: "Marimba · upright bass · woodblock · snaps",
    bpm: 126, root: D, scale: "dorian", prog: [1, 7, 4, 5], style: "cozy", reverb: 0.2, swing: 0.3,
    sections: [
      { bars: 4, motif: "full", voice: "marimba", amp: 0.34, bass: "walk", perc: "light", sticks: true, comp: true, arp: 4, level: 0.92 },
      { bars: 4, motif: ["full", "skip", "up", "turn"], voice: "marimba", echo: "glockenspiel", amp: 0.34, bass: "walk", perc: "beatfull", sticks: "clave", comp: "busy", arp: 4, level: 1.04 },
      { bars: 4, motif: ["up", "skip", "full", "high"], voice: "uke", double: "glockenspiel", amp: 0.36, bass: "walk", perc: "beatfull", sticks: "busy", comp: "busy", arp: 2, shimmer: true, level: 1.12, fill: "roll", crash: true },
    ],
  },
  {
    name: "And the Money Went To",
    file: "s09_reveal",
    screen: "Score reveal",
    brief: "Builds under the numbers counting up. Starts on a single held string note, adds a layer per bar, and lands on the full motif when the totals do.",
    instruments: "Strings · piano · timpani · glockenspiel",
    bpm: 106, root: D, scale: "major", prog: [1, 5, 6, 4], style: "epic", reverb: 0.28, swing: 0.16,
    sections: [
      { bars: 2, motif: "fragment", voice: "piano", amp: 0.34, strings: 0.06, sub: 0.16, level: 0.35 },
      { bars: 2, motif: "sparse", voice: "piano", echo: "glockenspiel", amp: 0.36, strings: 0.1, sub: 0.22, perc: "light", level: 0.58 },
      { bars: 2, motif: "full", voice: "strings", double: "glockenspiel", amp: 0.4, strings: 0.16, sub: 0.3, perc: "epic", shimmer: true, level: 0.82, fill: "swell" },
      { bars: 4, motif: ["full", "up", "high", "full"], voice: "strings", double: "glockenspiel", doubleAmp: 0.2, amp: 0.44, strings: 0.24, sub: 0.38, perc: "epic", pad: 0.1, shimmer: true, level: 1.04, impactOn: true, fill: "toms", crash: true },
    ],
  },
  {
    name: "The Board",
    file: "s10_leaderboard",
    screen: "Leaderboard",
    brief: "Calm pride rather than triumph — you're reading a list, not winning anything. Piano states the motif slowly over strings, no percussion at all.",
    instruments: "Felt piano · strings · sub",
    bpm: 92, root: D, scale: "major", prog: [1, 6, 4, 5], style: "epic", reverb: 0.29, swing: 0.24,
    sections: [
      { bars: 4, motif: "stretch", voice: "piano", amp: 0.36, strings: 0.08, sub: 0.16, arp: 4, shimmer: true, level: 0.64 },
      { bars: 4, motif: ["turn", "stretch", "full", "sparse"], voice: "piano", echo: "glockenspiel", double: "glockenspiel", doubleAmp: 0.1, amp: 0.36, strings: 0.12, sub: 0.2, arp: 4, level: 0.82 },
      { bars: 4, motif: ["full", "tail", "turn", "tail"], voice: "piano", echo: "glockenspiel", amp: 0.34, strings: 0.1, sub: 0.18, arp: 4, level: 0.72 },
    ],
  },
  {
    name: "That's the Game",
    file: "s11_results",
    screen: "Final scores",
    brief: "The last screen of a whole game, so it is allowed to be pleased with itself. Loops, because everyone sits here reading the table and arguing. Warm rather than orchestral — the reveal already did the drum-roll, and doing it twice would make neither land.",
    instruments: "Ukulele · glockenspiel · whistle · upright bass · full kit",
    bpm: 114, root: D, scale: "major", prog: [1, 5, 6, 4, 4, 5, 1, 5], style: "cozy", reverb: 0.26, swing: 0.28,
    sections: [
      { bars: 4, motif: "full", voice: "uke", double: "glockenspiel", amp: 0.44, bass: "root", perc: "groove", sticks: true, comp: true, arp: 4, level: 0.9 },
      { bars: 4, motif: ["skip", "full"], voice: "whistle", echo: "glockenspiel", amp: 0.46, bass: "walk", perc: "beatfull", sticks: "clave", comp: "busy", arp: 4, shimmer: true, level: 1, crash: true },
      { bars: 4, motif: ["high", "full", "turn", "skip"], voice: "uke", double: "glockenspiel", echo: "whistle", amp: 0.48, bass: "walk", perc: "beatfull", sticks: "clave", comp: "busy", arp: 4, level: 1.06, fill: "roll" },
      { bars: 4, motif: ["tail", "sparse", "full", "tail"], voice: "marimba", double: "glockenspiel", doubleAmp: 0.12, amp: 0.34, bass: "walk", perc: "light", sticks: true, arp: 4, pad: 0.12, level: 0.78 },
    ],
  },
];

export function saveScore(path, L, R) {
  mkdirSync(path.substring(0, path.lastIndexOf("/")), { recursive: true });
  writeWavStereo(path, L, R);
}
