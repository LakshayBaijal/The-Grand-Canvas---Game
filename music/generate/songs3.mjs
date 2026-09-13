// Expanded songs with real development, plus ad cuts and UI stingers.
//
// Phrases are written once and then placed by the arranger, so the same tune
// can come back doubled on glockenspiel, ornamented, an octave up, or under a
// walking bass. That reuse is deliberate: a listener needs to recognise a
// phrase to enjoy hearing it change.

import { SR, midiToFreq, applyReverb, master, writeWavStereo } from "./engine.mjs";
import { ksPluck, mallet, uprightBass, softKick, snap, applyChorus, tameMids } from "./acoustic.mjs";
import { bowedString, whistle, triangle, handClap, tambourine, degToMidi } from "./acoustic2.mjs";

// ---------------------------------------------------------------------------
// PHRASES — the actual tunes. Each is 4 bars, written on a 16th grid.
// [bar, step, scaleDegree, lengthIn16ths]
// ---------------------------------------------------------------------------

// The hook. Four notes, restated with one changed — that small difference is
// what makes it stick rather than just repeat.
const A = [
  [0, 0, 5, 2], [0, 2, 5, 2], [0, 4, 6, 2], [0, 6, 5, 2], [0, 8, 3, 4], [0, 12, 1, 4],
  [1, 0, 2, 4], [1, 4, 3, 4], [1, 8, 5, 8],
  [2, 0, 5, 2], [2, 2, 5, 2], [2, 4, 6, 2], [2, 6, 8, 2], [2, 8, 7, 4], [2, 12, 5, 4],
  [3, 0, 6, 4], [3, 4, 5, 4], [3, 8, 3, 8],
];

// The answer: same rhythm, lifted an octave, then walks back down to the tonic.
const B = [
  [0, 0, 8, 2], [0, 2, 8, 2], [0, 4, 9, 2], [0, 6, 8, 2], [0, 8, 6, 4], [0, 12, 5, 4],
  [1, 0, 4, 4], [1, 4, 5, 4], [1, 8, 6, 8],
  [2, 0, 8, 2], [2, 2, 7, 2], [2, 4, 6, 2], [2, 6, 5, 2], [2, 8, 4, 4], [2, 12, 2, 4],
  [3, 0, 1, 8], [3, 8, 5, 8],
];

// The breath: long notes, wide gaps. Gives the ear somewhere to rest before
// the last chorus, which is what makes that chorus land.
const BRIDGE = [
  [0, 0, 3, 8], [0, 8, 5, 8],
  [1, 0, 6, 8], [1, 8, 5, 8],
  [2, 0, 4, 8], [2, 8, 2, 8],
  [3, 0, 1, 16],
];

// Drawing-screen phrases: deliberately under-written.
const CALM_A = [
  [0, 0, 5, 8], [0, 8, 3, 8],
  [1, 4, 2, 4], [1, 8, 1, 8],
  [2, 0, 3, 8], [2, 8, 5, 8],
  [3, 4, 6, 4], [3, 8, 5, 8],
];
const CALM_B = [
  [0, 0, 8, 8], [0, 8, 6, 8],
  [1, 4, 5, 4], [1, 8, 3, 8],
  [2, 0, 2, 8], [2, 8, 4, 8],
  [3, 0, 3, 16],
];

// Results fanfare: a three-note climb repeated up the chord.
const WIN_A = [
  [0, 0, 1, 2], [0, 2, 3, 2], [0, 4, 5, 4], [0, 8, 8, 8],
  [1, 0, 7, 2], [1, 2, 8, 2], [1, 4, 9, 4], [1, 8, 8, 8],
  [2, 0, 6, 2], [2, 2, 5, 2], [2, 4, 6, 4], [2, 8, 5, 8],
  [3, 0, 4, 2], [3, 2, 3, 2], [3, 4, 2, 4], [3, 8, 1, 8],
];

// ---------------------------------------------------------------------------
// SONGS
// ---------------------------------------------------------------------------

export const ARRANGED = [
  {
    name: "Grand Canvas (full)",
    file: "v3_theme_full",
    role: "Title screen & menu",
    blurb:
      "The main theme, now a song rather than a loop. Solo ukulele states the hook, glockenspiel doubles it, strings and a walking bass arrive for the answering phrase, a whistle bridge clears the air, then everything returns an octave up. Loops seamlessly.",
    instruments: "Ukulele · glockenspiel · bowed strings · upright bass · whistle · claps",
    bpm: 104, rootMidi: 60, scale: "major", melodyOct: 12, seed: 7001,
    progression: [0, 4, 5, 3],
    phrases: { A, B, BRIDGE },
    reverb: 0.21, chorus: 0.28,
    sections: [
      { bars: 2, arp: true, pad: 0.1, level: 0.7 },
      { bars: 4, phrase: "A", lead: "uke", bass: "root", perc: "light", comp: true, pad: 0.05 },
      { bars: 4, phrase: "A", lead: "uke", double: "glockenspiel", bass: "root", perc: "mid", comp: true, pad: 0.05, fill: "shimmer" },
      { bars: 4, phrase: "B", lead: "uke", bass: "walk", perc: "mid", comp: true, strings: 0.13, counter: "strings", fill: "toms" },
      { bars: 4, phrase: "A", ornament: true, lead: "uke", double: "glockenspiel", bass: "walk", perc: "full", comp: "busy", strings: 0.11 },
      { bars: 4, phrase: "BRIDGE", lead: "whistle", bass: "sparse", perc: "brushes", pad: 0.16, level: 0.72, melodyAmp: 0.42 },
      { bars: 4, phrase: "A", lead: "uke", melodyShift: 7, double: "glockenspiel", bass: "walk", perc: "full", comp: "busy", strings: 0.15, counter: "whistle", level: 1.08, fill: "clap" },
      { bars: 2, arp: true, pad: 0.12, level: 0.65 },
    ],
  },
  {
    name: "Quiet Studio (full)",
    file: "v3_studio_full",
    role: "While drawing",
    blurb:
      "Same restraint as before but it now moves: marimba states a phrase, a cello holds underneath, kalimba takes the second idea, vibraphone shimmers on the return. Still leaves whole bars empty.",
    instruments: "Marimba · kalimba · vibraphone · cello · brushes",
    bpm: 84, rootMidi: 65, scale: "major", melodyOct: 12, seed: 7002,
    progression: [0, 5, 3, 4],
    phrases: { CALM_A, CALM_B },
    reverb: 0.3, chorus: 0.18, reverbSize: 1.3,
    sections: [
      { bars: 4, phrase: "CALM_A", lead: "marimba", bass: "sparse", perc: "brushes", pad: 0.15, melodyAmp: 0.4 },
      { bars: 4, phrase: "CALM_A", lead: "marimba", bass: "sparse", perc: "brushes", pad: 0.15, strings: 0.09, melodyAmp: 0.4 },
      { bars: 4, phrase: "CALM_B", lead: "kalimba", bass: "sparse", perc: "brushes", pad: 0.16, counter: "strings", melodyAmp: 0.42 },
      { bars: 4, phrase: "CALM_A", ornament: true, lead: "vibraphone", bass: "sparse", perc: "brushes", pad: 0.14, strings: 0.08, melodyAmp: 0.38, fill: "shimmer" },
    ],
  },
  {
    name: "Nice One (full)",
    file: "v3_win_full",
    role: "Results & winner",
    blurb:
      "Toy piano fanfare, answered by glockenspiel, then the whole band with claps and tambourine. Ends on a triangle shimmer rather than a cymbal, so it stays warm.",
    instruments: "Toy piano · glockenspiel · ukulele · strings · claps · tambourine",
    bpm: 118, rootMidi: 67, scale: "major", melodyOct: 12, seed: 7003,
    progression: [0, 4, 5, 3],
    phrases: { WIN_A },
    reverb: 0.23, chorus: 0.26,
    sections: [
      { bars: 4, phrase: "WIN_A", lead: "toyPiano", bass: "root", perc: "mid", comp: true, melodyAmp: 0.38 },
      { bars: 4, phrase: "WIN_A", lead: "toyPiano", double: "glockenspiel", bass: "walk", perc: "full", comp: "busy", strings: 0.13, melodyAmp: 0.38, fill: "toms" },
      { bars: 4, phrase: "WIN_A", ornament: true, lead: "glockenspiel", melodyShift: 7, bass: "walk", perc: "full", comp: "busy", strings: 0.16, counter: "strings", level: 1.06, melodyAmp: 0.3, fill: "clap" },
      { bars: 2, arp: true, pad: 0.14, level: 0.7 },
    ],
  },
  {
    name: "Waiting Room",
    file: "v3_lobby",
    role: "Lobby & matchmaking",
    blurb:
      "For the queue and the lobby. A relaxed shuffle that stays out of the way while people join — the bass walks, the uke comps, nothing demands attention.",
    instruments: "Ukulele · upright bass · brushes · marimba",
    bpm: 96, rootMidi: 62, scale: "major", melodyOct: 12, seed: 7004,
    progression: [0, 5, 1, 4],
    phrases: { CALM_A, CALM_B },
    reverb: 0.24, chorus: 0.22,
    sections: [
      { bars: 4, phrase: "CALM_A", lead: "marimba", bass: "walk", perc: "brushes", comp: true, pad: 0.08, melodyAmp: 0.32 },
      { bars: 4, phrase: "CALM_B", lead: "uke", bass: "walk", perc: "light", comp: true, pad: 0.07, melodyAmp: 0.34 },
      { bars: 4, phrase: "CALM_A", ornament: true, lead: "marimba", double: "vibraphone", bass: "walk", perc: "mid", comp: true, pad: 0.07, melodyAmp: 0.3, fill: "shimmer" },
    ],
  },
  {
    name: "Sixty Seconds",
    file: "v3_timer",
    role: "Round timer / drawing countdown",
    blurb:
      "Light forward motion for a timed round. A woodblock pulse and a rising marimba figure add pressure without the stress of a ticking clock.",
    instruments: "Marimba · woodblock · upright bass · shaker",
    bpm: 126, rootMidi: 57, scale: "minor", melodyOct: 12, seed: 7005,
    progression: [0, 5, 3, 4],
    phrases: { A, B },
    reverb: 0.18, chorus: 0.2,
    sections: [
      { bars: 4, phrase: "A", lead: "marimba", bass: "root", perc: "light", comp: true, melodyAmp: 0.3 },
      { bars: 4, phrase: "A", lead: "marimba", double: "glockenspiel", bass: "walk", perc: "mid", comp: "busy", melodyAmp: 0.3, level: 1.05, fill: "toms" },
    ],
  },
];

// ---------------------------------------------------------------------------
// AD CUTS — one-shots, so these *can* modulate and end on a button.
// An ad has about two seconds to land its hook, so there's no intro at all.
// ---------------------------------------------------------------------------

export const AD_CUTS = [
  {
    name: "Ad — 30 seconds",
    file: "v3_ad_30",
    role: "Store trailer / social ad",
    blurb:
      "Hook from bar one, full band by bar five, a key change up a whole tone for the last pass, and a hard button ending. Built to be cut against footage.",
    instruments: "Full band · modulating final chorus",
    bpm: 108, rootMidi: 60, scale: "major", melodyOct: 12, seed: 7010,
    progression: [0, 4, 5, 3],
    phrases: { A, B },
    reverb: 0.2, chorus: 0.28, tail: 2.4,
    sections: [
      { bars: 4, phrase: "A", lead: "uke", double: "glockenspiel", bass: "root", perc: "mid", comp: true, melodyAmp: 0.42 },
      { bars: 4, phrase: "B", lead: "uke", bass: "walk", perc: "full", comp: "busy", strings: 0.14, counter: "strings", fill: "toms" },
      // The gear change: same tune, two semitones up, everything at full tilt.
      { bars: 4, phrase: "A", ornament: true, lead: "uke", keyShift: 2, melodyShift: 7, double: "glockenspiel", bass: "walk", perc: "full", comp: "busy", strings: 0.17, counter: "whistle", level: 1.1, fill: "clap" },
    ],
  },
  {
    name: "Ad — 15 seconds",
    file: "v3_ad_15",
    role: "Short social / pre-roll",
    blurb:
      "The same hook compressed: one statement, one lifted answer, button. For a 15-second slot where the first second has to count.",
    instruments: "Full band · short",
    bpm: 112, rootMidi: 60, scale: "major", melodyOct: 12, seed: 7011,
    progression: [0, 4, 5, 3],
    phrases: { A },
    reverb: 0.2, chorus: 0.28, tail: 2.0,
    sections: [
      { bars: 4, phrase: "A", lead: "uke", double: "glockenspiel", bass: "root", perc: "mid", comp: true, melodyAmp: 0.44, strings: 0.1 },
      { bars: 2, phrase: "A", lead: "uke", keyShift: 2, melodyShift: 7, double: "glockenspiel", bass: "walk", perc: "full", comp: "busy", strings: 0.18, level: 1.1, fill: "clap" },
    ],
  },
];

// ---------------------------------------------------------------------------
// STINGERS — short one-shots for UI moments. Rendered directly rather than
// through the arranger; they're gestures, not songs.
// ---------------------------------------------------------------------------

function stingerBuffer(durSec) {
  const n = Math.round(durSec * SR);
  return [new Float32Array(n), new Float32Array(n)];
}

function finishStinger(L, R, reverb = 0.24) {
  applyChorus(L, R, 4, 0.5, 0.2);
  applyReverb(L, R, reverb, 1.1, 0.4);
  tameMids(L, R, 0.4);
  master(L, R, { targetPeak: 0.84, drive: 1.04, fadeOut: 0.12 });
  return { L, R };
}

export const STINGERS = [
  {
    name: "Win",
    file: "v3_sting_win",
    blurb: "Rising four-note fanfare on toy piano and glockenspiel, triangle shimmer on the tail.",
    render() {
      const [L, R] = stingerBuffer(2.6);
      const root = 67;
      const degs = [1, 3, 5, 8];
      degs.forEach((d, i) => {
        const m = degToMidi(root, "major", d) + 12;
        const t = Math.round(i * 0.1 * SR);
        mallet(L, R, t, midiToFreq(m), 0.4, "toyPiano", { pan: -0.1 });
        mallet(L, R, t, midiToFreq(m + 12), 0.2, "glockenspiel", { pan: 0.2 });
      });
      // Final chord, held.
      [1, 3, 5, 8].forEach((d, i) => {
        const m = degToMidi(root, "major", d) + 12;
        bowedString(L, R, Math.round(0.42 * SR), midiToFreq(m), 1.5, 0.13, { attack: 0.05, pan: -0.3 + i * 0.2 });
      });
      handClap(L, R, Math.round(0.42 * SR), 0.24);
      triangle(L, R, Math.round(0.46 * SR), 0.14);
      uprightBass(L, R, Math.round(0.42 * SR), midiToFreq(root - 12), 1.2, 0.36);
      return finishStinger(L, R, 0.3);
    },
  },
  {
    name: "Lose / near miss",
    file: "v3_sting_lose",
    blurb: "Gentle descending figure. Deliberately not a buzzer — nobody should feel punished in a party game.",
    render() {
      const [L, R] = stingerBuffer(2.2);
      const root = 60;
      [5, 4, 2].forEach((d, i) => {
        const m = degToMidi(root, "major", d) + 12;
        const t = Math.round(i * 0.13 * SR);
        mallet(L, R, t, midiToFreq(m), 0.34, "marimba", { pan: 0.05 });
      });
      // Lands on a soft minor-ish chord rather than a harsh one.
      [1, 3, 6].forEach((d, i) => {
        const m = degToMidi(root, "major", d);
        bowedString(L, R, Math.round(0.4 * SR), midiToFreq(m), 1.2, 0.12, { attack: 0.09, pan: -0.25 + i * 0.25 });
      });
      uprightBass(L, R, Math.round(0.4 * SR), midiToFreq(root - 12), 1.0, 0.3);
      return finishStinger(L, R, 0.28);
    },
  },
  {
    name: "Correct / vote cast",
    file: "v3_sting_correct",
    blurb: "Two-note glockenspiel ping. Short enough to fire on every tap without wearing out.",
    render() {
      const [L, R] = stingerBuffer(1.3);
      const root = 72;
      mallet(L, R, 0, midiToFreq(degToMidi(root, "major", 5)), 0.34, "glockenspiel", { pan: -0.12 });
      mallet(L, R, Math.round(0.075 * SR), midiToFreq(degToMidi(root, "major", 8)), 0.38, "glockenspiel", { pan: 0.12 });
      return finishStinger(L, R, 0.22);
    },
  },
  {
    name: "Round start",
    file: "v3_sting_round",
    blurb: "A quick uke flourish and a woodblock — 'pens down, here we go'.",
    render() {
      const [L, R] = stingerBuffer(1.8);
      const root = 62;
      [1, 3, 5, 8].forEach((d, i) => {
        const m = degToMidi(root, "major", d) + 12;
        ksPluck(L, R, Math.round(i * 0.055 * SR), midiToFreq(m), 1.1, 0.3, {
          damping: 0.45, brightness: 0.6, pick: 0.25, pan: -0.2 + i * 0.13,
        });
      });
      snap(L, R, Math.round(0.24 * SR), 0.26);
      tambourine(L, R, Math.round(0.24 * SR), 0.14);
      uprightBass(L, R, Math.round(0.24 * SR), midiToFreq(root - 12), 0.7, 0.32);
      return finishStinger(L, R, 0.2);
    },
  },
  {
    name: "Trophy",
    file: "v3_sting_trophy",
    blurb: "The shimmer for a trophy landing on the results screen. Pairs with the confetti burst.",
    render() {
      const [L, R] = stingerBuffer(2.4);
      const root = 72;
      [1, 5, 8, 10].forEach((d, i) => {
        mallet(L, R, Math.round(i * 0.06 * SR), midiToFreq(degToMidi(root, "major", d)), 0.3, "glockenspiel", { pan: -0.15 + i * 0.1 });
      });
      triangle(L, R, Math.round(0.1 * SR), 0.16);
      triangle(L, R, Math.round(0.5 * SR), 0.1);
      return finishStinger(L, R, 0.34);
    },
  },
];

export function saveWav(path, L, R) {
  writeWavStereo(path, L, R);
}
