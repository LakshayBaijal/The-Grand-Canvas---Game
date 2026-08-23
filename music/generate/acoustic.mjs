// Acoustic / toy-box instrument set.
//
// The EDM engine's supersaws pile energy into the 400-900Hz nasal band, which
// is why they read as "brass" and why you'd want to mute them after two
// minutes. Everything here is plucked or struck instead: the note has a
// transient and then gets out of the way, so a loop can run for ten minutes
// under someone who is trying to think.
//
// Same rule as before — every sample is generated here from noise and
// oscillators. Nothing is recorded or sampled.

import { SR, SVF, percEnv } from "./engine.mjs";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// --- plucked strings (Karplus-Strong) --------------------------------------

/**
 * Karplus-Strong plucked string — ukulele, nylon guitar, harp.
 *
 * A noise burst is pushed into a delay line one wavelength long, and each pass
 * is slightly lowpassed. That feedback loop *is* the physics of a vibrating
 * string: high partials lose energy faster than low ones, so the note starts
 * bright and mellows as it rings. It genuinely sounds plucked in a way no
 * amount of filtered sawtooth does.
 *
 * The delay line is read with linear interpolation so fractional wavelengths
 * are in tune — rounding to whole samples detunes high notes badly.
 */
export function ksPluck(L, R, startS, freq, durS, amp, opts = {}) {
  const {
    damping = 0.5,     // 0 = ring forever, 1 = thud
    brightness = 0.5,  // spectral content of the initial burst
    pan = 0,
    pick = 0.28,       // pick position: comb-filters the excitation
    body = 0.35,       // resonant body colouration
  } = opts;

  const delay = SR / Math.max(freq, 20);
  const size = Math.ceil(delay) + 4;
  const buf = new Float32Array(size);

  // Excitation: noise shaped by brightness, then comb-filtered by pick
  // position — plucking near the bridge is thin and bright, near the middle
  // round and warm. This is what stops every note sounding identical.
  const pickOffset = Math.max(1, Math.round(delay * clamp(pick, 0.05, 0.5)));
  const raw = new Float32Array(size);
  let lp = 0;
  for (let i = 0; i < Math.floor(delay); i++) {
    const white = Math.random() * 2 - 1;
    lp = lp * (1 - brightness) + white * brightness;
    raw[i] = lp;
  }
  for (let i = 0; i < Math.floor(delay); i++) {
    const j = i - pickOffset;
    buf[i] = raw[i] - (j >= 0 ? raw[j] * 0.6 : 0);
  }

  const n = Math.min(Math.round(durS * SR), L.length - startS);
  if (n <= 0) return;

  // Feedback loss per pass. Lower notes should ring longer than high ones,
  // as they do on a real instrument.
  const loss = clamp(0.996 - damping * 0.02 - freq / 90000, 0.90, 0.9995);

  const bodyFilt = new SVF();
  let readPos = 0;
  let prev = 0;

  for (let i = 0; i < n; i++) {
    const i0 = Math.floor(readPos);
    const frac = readPos - i0;
    const a = buf[i0 % size];
    const b = buf[(i0 + 1) % size];
    const s = a + (b - a) * frac;

    // One-pole lowpass in the feedback loop = string damping.
    const filtered = (s + prev) * 0.5;
    prev = filtered;
    buf[i0 % size] = filtered * loss;

    readPos += 1;
    if (readPos >= size) readPos -= size;

    // A little resonant body so it isn't a bare string in a vacuum.
    const out = s * (1 - body) + bodyFilt.process(s, 380, 1.6, "bp") * body * 1.6;
    // Gentle fade at the tail so releasing a note never clicks.
    const tail = i > n - 400 ? (n - i) / 400 : 1;
    const g = out * amp * tail;
    L[startS + i] += g * (0.5 - 0.5 * pan);
    R[startS + i] += g * (0.5 + 0.5 * pan);
  }
}

// --- struck bars and bells -------------------------------------------------

/**
 * Mallet percussion. Tuned bars aren't harmonic like strings — a marimba bar's
 * overtones sit at roughly 4x and 10x the fundamental, not 2x and 3x. Using
 * those real inharmonic ratios is the whole difference between "marimba" and
 * "sine beep".
 */
const MALLET_VOICES = {
  marimba:      { partials: [[1, 1], [3.9, 0.28], [9.2, 0.1]],   decay: 0.5,  tone: 0.55, click: 0.25 },
  glockenspiel: { partials: [[1, 1], [2.76, 0.5], [5.4, 0.22], [8.9, 0.08]], decay: 1.6, tone: 0.9, click: 0.4 },
  vibraphone:   { partials: [[1, 1], [3.98, 0.32], [9.1, 0.12]], decay: 2.2,  tone: 0.5, click: 0.15, tremolo: 5.2 },
  toyPiano:     { partials: [[1, 1], [4.1, 0.45], [10.4, 0.2], [16, 0.06]], decay: 0.85, tone: 0.75, click: 0.5 },
  kalimba:      { partials: [[1, 1], [5.4, 0.22], [13.2, 0.07]], decay: 0.9, tone: 0.6, click: 0.3 },
};

export function mallet(L, R, startS, freq, amp, kind = "marimba", opts = {}) {
  const v = MALLET_VOICES[kind] ?? MALLET_VOICES.marimba;
  const { pan = 0, decayScale = 1 } = opts;
  const decay = v.decay * decayScale * (kind === "glockenspiel" ? 1 : clamp(440 / freq, 0.5, 1.8));
  const n = Math.min(Math.round((decay * 3.2 + 0.05) * SR), L.length - startS);
  if (n <= 0) return;

  const phases = v.partials.map(() => Math.random() * 0.02);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (let p = 0; p < v.partials.length; p++) {
      const [ratio, gain] = v.partials[p];
      // Higher partials die away faster, as they do on a real bar.
      const pd = decay / (1 + p * 1.1);
      const e = Math.exp(-t / pd);
      if (e < 0.0002) continue;
      phases[p] += (freq * ratio) / SR;
      if (phases[p] >= 1) phases[p] -= 1;
      s += Math.sin(2 * Math.PI * phases[p]) * gain * e;
    }
    // Mallet contact noise: the wooden "tok" before the pitch speaks.
    if (t < 0.004) s += (Math.random() * 2 - 1) * v.click * (1 - t / 0.004);
    let env = 1;
    if (v.tremolo) env *= 0.82 + 0.18 * Math.sin(2 * Math.PI * v.tremolo * t);
    const atk = t < 0.0015 ? t / 0.0015 : 1;
    const g = s * amp * env * atk * 0.5;
    L[startS + i] += g * (0.5 - 0.5 * pan);
    R[startS + i] += g * (0.5 + 0.5 * pan);
  }
}

// --- upright bass ----------------------------------------------------------

/** Fingered upright/acoustic bass: round, woody, decays quickly enough to
 *  leave the downbeat clear. */
export function uprightBass(L, R, startS, freq, durS, amp, opts = {}) {
  const { decay = 0.55, cutoff = 520 } = opts;
  const n = Math.min(Math.round((durS + 0.12) * SR), L.length - startS);
  if (n <= 0) return;
  const f = new SVF();
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, decay) * (t < durS ? 1 : Math.exp(-(t - durS) / 0.05));
    if (e < 0.0002) break;
    // Fundamental plus a soft octave and a touch of second harmonic gives it
    // body without turning into a synth bass.
    const s =
      Math.sin(2 * Math.PI * p1) * 1.0 +
      Math.sin(2 * Math.PI * p2) * 0.22 * Math.exp(-t / 0.12);
    p1 += freq / SR; if (p1 >= 1) p1 -= 1;
    p2 += (freq * 2) / SR; if (p2 >= 1) p2 -= 1;
    // Finger noise on attack.
    const noise = t < 0.008 ? (Math.random() * 2 - 1) * 0.18 * (1 - t / 0.008) : 0;
    const out = f.process(s + noise, cutoff, 0.9) * amp * e;
    L[startS + i] += out;
    R[startS + i] += out;
  }
}

// --- soft percussion -------------------------------------------------------

/** A soft, felt-beater kick. Round and low, nothing like the clicky EDM kick. */
export function softKick(L, R, startS, amp = 0.7) {
  const n = Math.min(Math.round(0.4 * SR), L.length - startS);
  if (n <= 0) return;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.13);
    if (e < 0.0002) break;
    const f = 52 + 70 * Math.exp(-t / 0.022);
    phase += f / SR;
    if (phase >= 1) phase -= 1;
    const s = Math.sin(2 * Math.PI * phase) * e * amp;
    L[startS + i] += s;
    R[startS + i] += s;
  }
}

/** Brushed snare: a swirl rather than a crack. */
export function brush(L, R, startS, amp = 0.28, sweep = false) {
  const dur = sweep ? 0.26 : 0.09;
  const n = Math.min(Math.round(dur * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // A swept brush swells; a tap just decays.
    const e = sweep
      ? Math.sin(Math.PI * (t / dur)) * 0.9
      : percEnv(t, 0.05);
    if (e < 0.0002) continue;
    L[startS + i] += fl.process(Math.random() * 2 - 1, 2600, 0.7, "bp") * e * amp;
    R[startS + i] += fr.process(Math.random() * 2 - 1, 2750, 0.7, "bp") * e * amp * 0.95;
  }
}

/** Finger snap / rim click — the small dry accent that gives a lounge groove
 *  its backbeat without a drum kit. */
export function snap(L, R, startS, amp = 0.3, pan = 0.15) {
  const n = Math.min(Math.round(0.09 * SR), L.length - startS);
  if (n <= 0) return;
  const f = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.014);
    if (e < 0.0002) break;
    const s = f.process(Math.random() * 2 - 1, 2100, 2.2, "bp") * e * amp * 1.5;
    L[startS + i] += s * (0.5 - 0.5 * pan);
    R[startS + i] += s * (0.5 + 0.5 * pan);
  }
}

export function shaker(L, R, startS, amp = 0.16) {
  const n = Math.min(Math.round(0.07 * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.016);
    if (e < 0.0002) break;
    L[startS + i] += fl.process(Math.random() * 2 - 1, 8200, 0.9, "hp") * e * amp;
    R[startS + i] += fr.process(Math.random() * 2 - 1, 8600, 0.9, "hp") * e * amp;
  }
}

/** Woodblock / clave — a dry pitched tick. */
export function woodblock(L, R, startS, amp = 0.22, freq = 1180, pan = -0.2) {
  const n = Math.min(Math.round(0.09 * SR), L.length - startS);
  if (n <= 0) return;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = percEnv(t, 0.018);
    if (e < 0.0002) break;
    p += freq / SR; if (p >= 1) p -= 1;
    const s = (Math.sin(2 * Math.PI * p) + (Math.random() * 2 - 1) * 0.25) * e * amp;
    L[startS + i] += s * (0.5 - 0.5 * pan);
    R[startS + i] += s * (0.5 + 0.5 * pan);
  }
}

// --- soft sustained texture -------------------------------------------------

/** A warm breathy pad built from triangle-ish tones, deliberately dark. It
 *  fills space under the melody without adding the bite a saw pad would. */
export function warmPad(L, R, startS, durS, freq, amp, opts = {}) {
  const { cutoff = 900, attack = 0.9, release = 1.4, detune = 6 } = opts;
  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;
  const voices = 3;
  const phases = new Float64Array(voices);
  const incs = new Float64Array(voices);
  for (let v = 0; v < voices; v++) {
    const cents = (v - 1) * detune;
    incs[v] = (freq * Math.pow(2, cents / 1200)) / SR;
    phases[v] = v * 0.31;
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
    let s = 0;
    for (let v = 0; v < voices; v++) {
      // Triangle from a folded sine — soft, few harmonics.
      const ph = phases[v];
      s += (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * ph)) * (v === 1 ? 1 : 0.6);
      phases[v] += incs[v];
      if (phases[v] >= 1) phases[v] -= 1;
    }
    s *= 0.4;
    const g = amp * env;
    L[startS + i] += fl.process(s, cutoff, 0.7) * g;
    R[startS + i] += fr.process(s, cutoff * 1.03, 0.7) * g;
  }
}

// --- glue ------------------------------------------------------------------

/** Chorus: a short modulated delay per side. Widens plucked instruments and
 *  softens their attack, which is most of what makes a synthesized uke sound
 *  like an instrument in a room rather than a maths expression. */
export function applyChorus(L, R, depthMs = 6, rateHz = 0.5, mix = 0.28) {
  const maxD = Math.ceil((depthMs / 1000) * SR) + 4;
  const bl = new Float32Array(maxD * 4);
  const br = new Float32Array(maxD * 4);
  let w = 0;
  for (let i = 0; i < L.length; i++) {
    bl[w % bl.length] = L[i];
    br[w % br.length] = R[i];
    const t = i / SR;
    const dl = (depthMs / 1000) * SR * (0.5 + 0.5 * Math.sin(2 * Math.PI * rateHz * t));
    const dr = (depthMs / 1000) * SR * (0.5 + 0.5 * Math.sin(2 * Math.PI * rateHz * t + 1.9));
    const rl = w - dl;
    const rr = w - dr;
    const readL = bl[((Math.floor(rl) % bl.length) + bl.length) % bl.length];
    const readR = br[((Math.floor(rr) % br.length) + br.length) % br.length];
    L[i] = L[i] * (1 - mix) + readL * mix;
    R[i] = R[i] * (1 - mix) + readR * mix;
    w++;
  }
}

/** Tilt EQ — pull down the nasal mids and lift a little air. This is the
 *  direct antidote to the "brass" character: most of that lives at 500-900Hz. */
export function tameMids(L, R, amount = 0.5) {
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < L.length; i++) {
    const ml = fl.process(L[i], 700, 0.9, "bp");
    const mr = fr.process(R[i], 700, 0.9, "bp");
    L[i] -= ml * amount * 0.5;
    R[i] -= mr * amount * 0.5;
  }
}
