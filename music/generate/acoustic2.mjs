// Additional instruments + arrangement tools.
//
// The first acoustic pass proved the palette but every bar was arranged the
// same way, so a 30-second loop sounded like one idea repeated. Real songs
// vary three things over time: WHO is playing, WHAT they're playing, and HOW
// LOUD. Everything below exists to make those three change.

import { SR, SVF, percEnv, SCALES } from "./engine.mjs";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// --- bowed strings ---------------------------------------------------------

/**
 * Bowed string section (cello / viola). Unlike a pluck this sustains, so it's
 * the instrument that makes a chorus feel bigger without adding busyness —
 * it fills the space *between* the plucked notes rather than competing.
 *
 * Built from stacked saws with slow attack, vibrato and a gentle lowpass, plus
 * a touch of bow noise on the attack.
 */
export function bowedString(L, R, startS, freq, durS, amp, opts = {}) {
  const { attack = 0.18, release = 0.4, vibrato = 4.8, vibDepth = 0.006, cutoff = 1500, pan = 0 } = opts;
  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;
  const voices = 3;
  const ph = new Float64Array(voices);
  const det = [-7, 0, 7];
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env;
    if (t < attack) env = t / attack;
    else if (t > durS) env = Math.max(0, 1 - (t - durS) / release);
    else env = 1;
    if (env <= 0) continue;
    // Vibrato eases in — players don't start it instantly.
    const vibAmt = vibDepth * Math.min(1, t / 0.35);
    const vib = 1 + Math.sin(2 * Math.PI * vibrato * t) * vibAmt;
    let s = 0;
    for (let v = 0; v < voices; v++) {
      const f = freq * Math.pow(2, det[v] / 1200) * vib;
      ph[v] += f / SR;
      if (ph[v] >= 1) ph[v] -= 1;
      // Slightly rounded saw: bowed strings are rich but not buzzy.
      const saw = 2 * ph[v] - 1;
      s += (saw - Math.pow(saw, 3) * 0.22) * (v === 1 ? 1 : 0.55);
    }
    s *= 0.3;
    if (t < 0.05) s += (Math.random() * 2 - 1) * 0.05 * (1 - t / 0.05); // bow noise
    const g = amp * env;
    L[startS + i] += fl.process(s, cutoff, 0.8) * g * (0.5 - 0.5 * pan);
    R[startS + i] += fr.process(s, cutoff * 1.02, 0.8) * g * (0.5 + 0.5 * pan);
  }
}

/** Whistle / recorder — breathy sine with vibrato. Reads as playful and human,
 *  and cuts through a mix at very low volume because nothing else up there is
 *  a pure tone. */
export function whistle(L, R, startS, freq, durS, amp, opts = {}) {
  const { pan = 0, breath = 0.055, vibrato = 5.4 } = opts;
  const n = Math.min(Math.round((durS + 0.12) * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  const f = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const atk = Math.min(1, t / 0.045);
    const rel = t > durS ? Math.max(0, 1 - (t - durS) / 0.1) : 1;
    const env = atk * rel;
    if (env <= 0) continue;
    const vib = 1 + Math.sin(2 * Math.PI * vibrato * t) * 0.004 * Math.min(1, t / 0.25);
    p += (freq * vib) / SR;
    if (p >= 1) p -= 1;
    // A whistle is nearly a pure sine with a little second harmonic.
    let s = Math.sin(2 * Math.PI * p) + Math.sin(4 * Math.PI * p) * 0.06;
    s += f.process(Math.random() * 2 - 1, freq * 2, 1.2, "bp") * breath;
    const g = s * amp * env * 0.5;
    L[startS + i] += g * (0.5 - 0.5 * pan);
    R[startS + i] += g * (0.5 + 0.5 * pan);
  }
}

// --- extra percussion ------------------------------------------------------

export function tambourine(L, R, startS, amp = 0.16, shake = false) {
  const dur = shake ? 0.16 : 0.07;
  const n = Math.min(Math.round(dur * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = shake ? Math.sin(Math.PI * (t / dur)) * 0.8 : percEnv(t, 0.03);
    if (e < 0.0002) continue;
    // Jingles: bright, metallic, slightly different per side.
    const nl = fl.process(Math.random() * 2 - 1, 9000, 1.1, "hp");
    const nr = fr.process(Math.random() * 2 - 1, 9400, 1.1, "hp");
    L[startS + i] += nl * e * amp;
    R[startS + i] += nr * e * amp;
  }
}

export function triangle(L, R, startS, amp = 0.12) {
  const n = Math.min(Math.round(1.4 * SR), L.length - startS);
  if (n <= 0) return;
  // Inharmonic partials, very long decay — the little shimmer that says
  // "something good just happened".
  const parts = [2350, 3720, 5180, 6900];
  const ph = parts.map(() => Math.random());
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-t / 0.5);
    if (e < 0.0002) break;
    let s = 0;
    for (let p = 0; p < parts.length; p++) {
      ph[p] += parts[p] / SR;
      if (ph[p] >= 1) ph[p] -= 1;
      s += Math.sin(2 * Math.PI * ph[p]) / (p + 1.5);
    }
    const g = s * e * amp * 0.4;
    L[startS + i] += g * 0.45;
    R[startS + i] += g * 0.55;
  }
}

/** Warm hand clap — a group of people, not a drum machine. */
export function handClap(L, R, startS, amp = 0.3) {
  for (const off of [0, 0.007, 0.014, 0.023]) {
    const s0 = startS + Math.round(off * SR);
    const n = Math.min(Math.round(0.07 * SR), L.length - s0);
    if (n <= 0) continue;
    const fl = new SVF();
    const fr = new SVF();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = percEnv(t, off === 0.023 ? 0.055 : 0.01);
      L[s0 + i] += fl.process(Math.random() * 2 - 1, 1500, 1.4, "bp") * e * amp;
      R[s0 + i] += fr.process(Math.random() * 2 - 1, 1560, 1.4, "bp") * e * amp * 0.94;
    }
  }
}

/** Low tom / conga — for fills. */
export function tom(L, R, startS, freq = 160, amp = 0.32, pan = 0) {
  const n = Math.min(Math.round(0.35 * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.11);
    if (e < 0.0002) break;
    const f = freq * (1 + 0.35 * Math.exp(-t / 0.02));
    p += f / SR;
    if (p >= 1) p -= 1;
    const s = (Math.sin(2 * Math.PI * p) + (Math.random() * 2 - 1) * 0.1) * e * amp;
    L[startS + i] += s * (0.5 - 0.5 * pan);
    R[startS + i] += s * (0.5 + 0.5 * pan);
  }
}

// --- arrangement helpers ---------------------------------------------------

export function degToMidi(root, scaleName, deg) {
  const s = SCALES[scaleName];
  const d = deg - 1;
  const oct = Math.floor(d / s.length);
  const idx = ((d % s.length) + s.length) % s.length;
  return root + s[idx] + oct * 12;
}

/**
 * Walking bass: instead of hitting the root twice a bar, step through the
 * chord and approach the next chord's root by a half-step. This single change
 * does more for "there's something going on" than any added instrument —
 * the bass stops being a foundation and becomes a second melody.
 */
export function walkingBassLine(rootMidi, scaleName, progression, bar, nextDeg) {
  const deg = progression[bar % progression.length];
  const chordRoot = degToMidi(rootMidi, scaleName, deg + 1);
  const third = degToMidi(rootMidi, scaleName, deg + 3);
  const fifth = degToMidi(rootMidi, scaleName, deg + 5);
  const nextRoot = degToMidi(rootMidi, scaleName, nextDeg + 1);
  // Chromatic approach note into the next chord — the jazz signature.
  const approach = nextRoot > chordRoot ? nextRoot - 1 : nextRoot + 1;
  return [chordRoot, third, fifth, approach];
}

/** Ornaments a melody: adds grace notes and passing tones on repeats, so the
 *  second time through a phrase isn't literally identical. */
export function ornamentMelody(melody, scaleName, seedFn, amount = 0.3) {
  const out = [];
  for (const note of melody) {
    const [bar, step, deg, len] = note;
    out.push(note);
    // Only ornament longer notes, and only sometimes.
    if (len >= 4 && seedFn() < amount) {
      // A quick grace note a scale step above, just before the beat.
      if (step >= 1) out.push([bar, step - 1, deg + 1, 1]);
    }
    if (len >= 8 && seedFn() < amount * 0.7) {
      // Fill the tail of a long note with a passing step.
      out.push([bar, step + len - 2, deg + 1, 2]);
    }
  }
  return out;
}

/** Transposes a melody by scale steps (for modulation / octave lifts). */
export function transposeMelody(melody, steps) {
  return melody.map(([bar, step, deg, len]) => [bar, step, deg + steps, len]);
}

/** Shifts a melody's bar numbers so a phrase can be reused later in the song. */
export function shiftMelody(melody, barOffset) {
  return melody.map(([bar, step, deg, len]) => [bar + barOffset, step, deg, len]);
}

/**
 * Counter-melody: a sparse line that moves *against* the main tune, using
 * chord tones and mostly long notes. Contrary motion is what makes two lines
 * sound like an arrangement rather than a pile-up.
 */
export function makeCounterMelody(mainMelody, progression, bars, startBar = 0) {
  const out = [];
  for (let b = startBar; b < bars; b++) {
    const inBar = mainMelody.filter((m) => m[0] === b);
    if (inBar.length === 0) continue;
    // Where the tune is busy, the counter-line holds; where it rests, it moves.
    const busy = inBar.length >= 4;
    if (busy) {
      out.push([b, 0, 3, 16]);
    } else {
      out.push([b, 0, 5, 8]);
      out.push([b, 8, 3, 8]);
    }
  }
  return out;
}
