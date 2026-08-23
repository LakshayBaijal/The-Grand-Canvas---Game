// The launch signature — the sound the game is recognised by.
//
// This is a brand mnemonic, not a piece of music: it has one job, which is to
// be the same three seconds every single time the app opens, so it becomes
// "the Grand Canvas sound" by repetition. Two ideas carry it:
//
//  * A pencil stroke opens it. Every other sound in this game is mallets and
//    strings, which are pleasant but generic — a pencil dragged across paper
//    is the one sound only a drawing game would use, and it lands before any
//    note does. That's the recognisable part.
//  * Then the motif, stated bare. The same four notes as every screen loop,
//    so the launch sound and the score are audibly the same object.
//
// Deliberately short and non-looping. Anything longer gets skipped, and a
// signature that gets skipped isn't one.

import { SR, midiToFreq, applyReverb, master, writeWavStereo } from "./engine.mjs";
import { mallet, ksPluck, uprightBass, brush, applyChorus, tameMids } from "./acoustic.mjs";
import { bowedString, triangle, degToMidi } from "./acoustic2.mjs";

const D = 62; // same home key as the rest of the score

/** The game's four-note motif, as scale degrees. */
const MOTIF = [5, 8, 7, 5];

export function renderLaunch() {
  const dur = 3.0;
  const n = Math.round(dur * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  // --- 1. the pencil stroke -------------------------------------------------
  // Two sweeps, the second shorter and softer, like a stroke and its
  // lift-off. Panned across so it reads as movement over paper rather than a
  // noise burst sitting in the middle.
  brush(L, R, 0, 0.30, true);
  brush(L, R, Math.round(0.20 * SR), 0.17, true);

  // --- 2. the motif ---------------------------------------------------------
  // Uke carries it with a glockenspiel an octave up shadowing each note, which
  // is what gives it the "chime" quality a mnemonic needs to cut through a
  // phone speaker.
  const start = 0.40;
  const step = 0.115;
  MOTIF.forEach((deg, i) => {
    const m = degToMidi(D, "major", deg) + 12;
    const t = Math.round((start + i * step) * SR);
    ksPluck(L, R, t, midiToFreq(m), 0.9, 0.30, {
      damping: 0.42,
      brightness: 0.62,
      pick: 0.22,
      pan: -0.18 + i * 0.12,
    });
    mallet(L, R, t, midiToFreq(m + 12), 0.20, "glockenspiel", { pan: 0.16 - i * 0.09 });
  });

  // --- 3. the landing -------------------------------------------------------
  // A held major chord under a triangle, so the phrase resolves instead of
  // just stopping. Bass an octave and a half down gives it a floor on a
  // laptop and is felt rather than heard on a phone.
  const land = Math.round(0.88 * SR);
  [1, 3, 5, 8].forEach((deg, i) => {
    const m = degToMidi(D, "major", deg) + 12;
    bowedString(L, R, land, midiToFreq(m), 1.7, 0.115, {
      attack: 0.06,
      pan: -0.3 + i * 0.2,
    });
  });
  mallet(L, R, land, midiToFreq(degToMidi(D, "major", 8) + 24), 0.22, "glockenspiel", { pan: 0.1 });
  triangle(L, R, land + Math.round(0.03 * SR), 0.15);
  triangle(L, R, land + Math.round(0.62 * SR), 0.08);
  uprightBass(L, R, land, midiToFreq(D - 12), 1.5, 0.34);

  applyChorus(L, R, 4, 0.5, 0.18);
  applyReverb(L, R, 0.32, 1.2, 0.4);
  tameMids(L, R, 0.4);
  master(L, R, { targetPeak: 0.86, drive: 1.04, fadeOut: 0.3 });
  return { L, R };
}

export function saveLaunch(path) {
  const { L, R } = renderLaunch();
  writeWavStereo(path, L, R);
  return L.length / SR;
}
