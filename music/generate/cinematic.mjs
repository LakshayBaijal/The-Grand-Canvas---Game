// The big voices: the ones the reveal and leaderboard screens lean on.
//
// `acoustic.mjs` covers the small end of the palette — things you could carry
// in one hand. This file is the other half: a string section, a felt piano, a
// choir, sub bass, and the orchestral percussion that makes a score reveal
// feel like a result rather than a number changing.
//
// Same conventions as every other voice file here: each function mixes
// additively into a stereo pair of Float32Arrays at a sample offset, never
// allocates a buffer of its own, and takes amplitude as a plain 0..1 gain.
// Nothing normalises — `master()` in engine.mjs does that once at the end.

import { SR, SVF, percEnv } from "./engine.mjs";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Writes one sample to both channels at [pan] (-1 left, +1 right). */
function mix(L, R, i, s, pan) {
  L[i] += s * (0.5 - 0.5 * pan);
  R[i] += s * (0.5 + 0.5 * pan);
}

// --- sustained -------------------------------------------------------------

/**
 * Sub bass: a near-sine an octave below the upright, for weight rather than
 * pitch. Deliberately almost pure — anything with harmonics down here turns to
 * mud on a phone speaker while adding nothing on headphones.
 */
export function subBass(L, R, startS, freq, durS, amp, opts = {}) {
  const { attack = 0.04, release = 0.25 } = opts;
  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env;
    if (t < attack) env = t / attack;
    else if (t > durS) env = Math.max(0, 1 - (t - durS) / release);
    else env = 1;
    if (env <= 0) continue;
    p += freq / SR;
    if (p >= 1) p -= 1;
    // A trace of third harmonic, so it is still audible on a speaker that
    // cannot reproduce the fundamental at all.
    const s = Math.sin(2 * Math.PI * p) + Math.sin(6 * Math.PI * p) * 0.07;
    const g = s * amp * env * 0.9;
    L[startS + i] += g * 0.5;
    R[startS + i] += g * 0.5;
  }
}

/**
 * String ensemble. Several detuned saw voices with independent, slightly
 * different vibrato rates, panned across the stereo field.
 *
 * The per-voice vibrato detune is what separates this from a synth pad: a real
 * section is never quite in unison, and that beating is most of the sound.
 */
export function stringEnsemble(L, R, startS, freq, durS, amp, opts = {}) {
  const {
    voices = 7, attack = 0.25, release = 0.6, cutoff = 2200,
    pan = 0, spread = 0.6, vibrato = 5.1,
  } = opts;
  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;

  const ph = new Float64Array(voices);
  const det = [];
  const rate = [];
  for (let v = 0; v < voices; v++) {
    // Spread symmetrically around the centre in cents.
    const k = voices === 1 ? 0 : v / (voices - 1) - 0.5;
    det.push(k * 22);
    rate.push(vibrato * (0.86 + 0.28 * (v / Math.max(1, voices - 1))));
    ph[v] = Math.random();
  }
  const fl = new SVF();
  const fr = new SVF();

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env;
    if (t < attack) env = t / attack;
    else if (t > durS) env = Math.max(0, 1 - (t - durS) / release);
    else env = 1;
    if (env <= 0) continue;

    const vibAmt = 0.005 * Math.min(1, t / 0.4);
    let sl = 0;
    let sr = 0;
    for (let v = 0; v < voices; v++) {
      const vib = 1 + Math.sin(2 * Math.PI * rate[v] * t + v) * vibAmt;
      const f = freq * Math.pow(2, det[v] / 1200) * vib;
      ph[v] += f / SR;
      if (ph[v] >= 1) ph[v] -= 1;
      const saw = 2 * ph[v] - 1;
      // Soft-clipped saw: rich, but without the buzz of a raw one.
      const s = saw - Math.pow(saw, 3) * 0.24;
      const vp = clamp(pan + (voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2 * spread), -1, 1);
      sl += s * (0.5 - 0.5 * vp);
      sr += s * (0.5 + 0.5 * vp);
    }
    const norm = 0.34 / Math.sqrt(voices);
    const g = amp * env * norm;
    L[startS + i] += fl.process(sl, cutoff, 0.7) * g;
    R[startS + i] += fr.process(sr, cutoff * 1.03, 0.7) * g;
  }
}

/**
 * Choir pad: filtered saws under a formant-ish band, breathy rather than
 * wordless-synth. Used instead of `warmPad` on the "epic" tracks, where the
 * pad has to hold up under timpani.
 */
export function choirPad(L, R, startS, freq, durS, amp, opts = {}) {
  const { attack = 0.7, release = 1.0, pan = 0 } = opts;
  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;
  const det = [-9, -3, 4, 11];
  const ph = det.map(() => Math.random());
  const fl = new SVF();
  const fr = new SVF();
  const form = new SVF();

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env;
    if (t < attack) env = t / attack;
    else if (t > durS) env = Math.max(0, 1 - (t - durS) / release);
    else env = 1;
    if (env <= 0) continue;

    const vib = 1 + Math.sin(2 * Math.PI * 4.4 * t) * 0.0035 * Math.min(1, t / 0.6);
    let s = 0;
    for (let v = 0; v < det.length; v++) {
      const f = freq * Math.pow(2, det[v] / 1200) * vib;
      ph[v] += f / SR;
      if (ph[v] >= 1) ph[v] -= 1;
      const saw = 2 * ph[v] - 1;
      s += (saw - Math.pow(saw, 3) * 0.3) * 0.4;
    }
    // Breath, and a vowel-ish resonant peak that stops it reading as a synth.
    s += (Math.random() * 2 - 1) * 0.03;
    s += form.process(s, 760, 3.4, "bp") * 0.45;

    const g = amp * env * 0.3;
    L[startS + i] += fl.process(s, 2000, 0.8) * g * (0.5 - 0.5 * pan);
    R[startS + i] += fr.process(s, 2080, 0.8) * g * (0.5 + 0.5 * pan);
  }
}

// --- struck ----------------------------------------------------------------

/**
 * Felt piano. Additive: a handful of slightly stretched partials, each with
 * its own decay, since the top of a piano note dies long before the bottom
 * does. The "felt" part is the missing high end plus the soft attack.
 */
export function piano(L, R, startS, freq, amp, opts = {}) {
  const { decay = 1.6, pan = 0, brightness = 0.5 } = opts;
  const n = Math.min(Math.round((decay + 0.4) * SR), L.length - startS);
  if (n <= 0) return;

  // Real strings are stiff, so partials sit slightly sharp of exact multiples.
  const partials = [1, 2, 3, 4, 5, 6];
  const inharm = partials.map((k) => k * (1 + 0.00042 * k * k));
  const gains = partials.map((k) => Math.pow(k, -1.45) * (k > 3 ? brightness : 1));
  const decays = partials.map((k) => decay / (1 + (k - 1) * 0.55));
  const ph = partials.map(() => 0);
  const f = new SVF();

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // Hammer, not a click.
    const atk = t < 0.006 ? t / 0.006 : 1;
    let s = 0;
    let alive = false;
    for (let k = 0; k < partials.length; k++) {
      const e = Math.exp(-t / decays[k]);
      if (e < 0.0003) continue;
      alive = true;
      ph[k] += (freq * inharm[k]) / SR;
      if (ph[k] >= 1) ph[k] -= 1;
      s += Math.sin(2 * Math.PI * ph[k]) * gains[k] * e;
    }
    if (!alive) break;
    // Felt: a lowpass that opens for the first instant only.
    const cut = 2400 + 5200 * Math.exp(-t / 0.05);
    const g = f.process(s, cut, 0.7) * amp * atk * 0.5;
    mix(L, R, startS + i, g, pan);
  }
}

/** Timpani: a pitched drum. A sine that falls a little in pitch as it decays,
 *  which is what makes it read as a struck skin rather than a bass note. */
export function timpani(L, R, startS, freq, amp = 0.3, opts = {}) {
  const { decay = 1.1, pan = -0.1 } = opts;
  const n = Math.min(Math.round((decay + 0.3) * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, decay);
    if (e < 0.0003) break;
    const bend = 1 + 0.09 * Math.exp(-t / 0.06);
    p += (freq * bend) / SR;
    if (p >= 1) p -= 1;
    // A slightly detuned upper mode gives the skin its wobble.
    p2 += (freq * 1.504 * bend) / SR;
    if (p2 >= 1) p2 -= 1;
    let s = Math.sin(2 * Math.PI * p) + Math.sin(2 * Math.PI * p2) * 0.18;
    if (t < 0.02) s += (Math.random() * 2 - 1) * 0.5 * (1 - t / 0.02);
    mix(L, R, startS + i, s * e * amp * 0.7, pan);
  }
}

/** Taiko: a big, dry, mostly unpitched hit. Body plus stick, no ring. */
export function taiko(L, R, startS, amp = 0.4, opts = {}) {
  const { pan = 0.05 } = opts;
  const n = Math.min(Math.round(0.75 * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  const f = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.17);
    if (e < 0.0003) break;
    // Pitch drops fast and far — that fall is the whole character.
    const freq = 92 * (1 + 1.1 * Math.exp(-t / 0.035));
    p += freq / SR;
    if (p >= 1) p -= 1;
    let s = Math.sin(2 * Math.PI * p);
    // Stick attack on the skin.
    if (t < 0.03) s += f.process(Math.random() * 2 - 1, 2600, 0.9) * 0.7 * (1 - t / 0.03);
    mix(L, R, startS + i, s * e * amp, pan);
  }
}

// --- gestures --------------------------------------------------------------

/** Rising noise swell into the next bar — the "here it comes" before a hit. */
export function swell(L, R, startS, durS, amp = 0.2) {
  const n = Math.min(Math.round(durS * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = t / durS;
    // Quiet for most of the bar, then steeply up: a linear ramp reads as a
    // fade-in rather than as tension.
    const env = Math.pow(k, 2.6);
    const cut = 300 + 5200 * k;
    const nl = fl.process(Math.random() * 2 - 1, cut, 1.6, "bp");
    const nr = fr.process(Math.random() * 2 - 1, cut * 1.05, 1.6, "bp");
    L[startS + i] += nl * env * amp;
    R[startS + i] += nr * env * amp;
  }
}

/** The downbeat hit: sub drop, body, and a short bright transient over it. */
export function impact(L, R, startS, amp = 0.4) {
  const n = Math.min(Math.round(1.6 * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const body = Math.exp(-t / 0.5);
    if (body < 0.0002) break;
    // 58Hz down to about 32Hz.
    const freq = 32 + 26 * Math.exp(-t / 0.09);
    p += freq / SR;
    if (p >= 1) p -= 1;
    let s = Math.sin(2 * Math.PI * p) * body;
    if (t < 0.12) {
      const crack = Math.exp(-t / 0.03) * 0.4;
      s += fl.process(Math.random() * 2 - 1, 3200, 0.8, "hp") * crack;
    }
    const tail = fr.process(Math.random() * 2 - 1, 900, 0.7) * Math.exp(-t / 0.28) * 0.12;
    const g = (s + tail) * amp;
    L[startS + i] += g * 0.5;
    R[startS + i] += g * 0.5;
  }
}
