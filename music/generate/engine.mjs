// A small electronic-music synthesis engine.
//
// Everything here generates samples from scratch — oscillators, noise, filters.
// No recordings, no samples, no third-party audio of any kind, so every track
// it renders is original work with no licensing question attached.
//
// The style target is the melodic-EDM space (future bass, melodic dubstep,
// progressive house, DnB). Genre conventions, tempos and chord archetypes
// aren't ownable; specific songs are. Nothing here reproduces a specific song.

import { writeFileSync } from "node:fs";

export const SR = 44100;

// --- utility ---------------------------------------------------------------

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Deterministic RNG (mulberry32) so a given seed always renders the identical
 *  track — same reason the doodle engine seeds its own RNG. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// --- oscillators -----------------------------------------------------------
//
// Saw and square use PolyBLEP band-limiting. A naive saw is just `2*phase-1`,
// which aliases badly — every harmonic above Nyquist folds back down as
// inharmonic grit, and supersaw leads sit exactly in the register where that
// is most audible. PolyBLEP rounds the discontinuity at the wrap point and
// removes most of it for very little cost.

function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export function sawSample(phase, dt) {
  return 2 * phase - 1 - polyBlep(phase, dt);
}

export function squareSample(phase, dt, width = 0.5) {
  let v = phase < width ? 1 : -1;
  v += polyBlep(phase, dt);
  let p2 = phase + (1 - width);
  if (p2 >= 1) p2 -= 1;
  v -= polyBlep(p2, dt);
  return v;
}

// --- filter ----------------------------------------------------------------

/** Topology-preserving-transform state variable filter (Andrew Simper's
 *  design). Stable when the cutoff is modulated fast, which a naive
 *  Chamberlin SVF is not — and cutoff sweeps are the whole point here. */
export class SVF {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
  }
  reset() {
    this.ic1 = 0;
    this.ic2 = 0;
  }
  process(v0, cutoffHz, q, mode = "lp") {
    const fc = clamp(cutoffHz, 20, SR * 0.45);
    const g = Math.tan((Math.PI * fc) / SR);
    const k = 1 / clamp(q, 0.35, 20);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = v0 - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (mode === "lp") return v2;
    if (mode === "hp") return v0 - k * v1 - v2;
    if (mode === "bp") return v1;
    return v2;
  }
}

// --- envelopes -------------------------------------------------------------

/** Linear-attack / exponential-decay envelope value at time t. */
export function ampEnv(t, dur, { attack = 0.005, decay = 0.2, sustain = 0.6, release = 0.15 } = {}) {
  if (t < 0 || t > dur + release) return 0;
  if (t < attack) return t / attack;
  const held = dur;
  if (t < held) {
    const dt = t - attack;
    const decayed = sustain + (1 - sustain) * Math.exp(-dt / Math.max(decay, 1e-4));
    return decayed;
  }
  const rt = t - held;
  const tail = sustain * Math.exp(-rt / Math.max(release / 3, 1e-4));
  return tail;
}

/** Percussive envelope: instant attack, exponential fall to silence. */
export function percEnv(t, decay) {
  if (t < 0) return 0;
  const a = 0.0015;
  const atk = t < a ? t / a : 1;
  return atk * Math.exp(-t / decay);
}

// --- voices ----------------------------------------------------------------

/**
 * Supersaw: several detuned saws stacked. This is the signature melodic-EDM
 * lead/chord sound. Detune spread is in cents; the centre voice sits slightly
 * louder so the pitch still reads clearly.
 *
 * Writes into a stereo pair, panning the detuned copies outward for width.
 */
export function supersaw(L, R, startS, durS, freq, amp, opts = {}) {
  const {
    voices = 7,
    detuneCents = 18,
    attack = 0.01,
    decay = 0.25,
    sustain = 0.75,
    release = 0.22,
    cutoff = 4200,
    cutoffEnv = 2600,
    q = 0.9,
    stereo = 0.85,
    sub = 0.0,
  } = opts;

  const n = Math.min(Math.round((durS + release) * SR), L.length - startS);
  if (n <= 0) return;

  const phases = new Float64Array(voices);
  const incs = new Float64Array(voices);
  const gains = new Float64Array(voices);
  const pans = new Float64Array(voices);
  for (let v = 0; v < voices; v++) {
    const spread = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1; // -1..1
    const cents = spread * detuneCents;
    const f = freq * Math.pow(2, cents / 1200);
    incs[v] = f / SR;
    phases[v] = (v * 0.137) % 1; // decorrelated start phases
    gains[v] = v === (voices - 1) / 2 ? 1 : 0.72;
    pans[v] = spread * stereo;
  }
  let subPhase = 0;
  const subInc = freq / 2 / SR;

  const fL = new SVF();
  const fR = new SVF();

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = ampEnv(t, durS, { attack, decay, sustain, release });
    if (env <= 0.00005 && t > durS) break;
    const fc = cutoff + cutoffEnv * Math.exp(-t / 0.5);

    let l = 0;
    let r = 0;
    for (let v = 0; v < voices; v++) {
      const s = sawSample(phases[v], incs[v]) * gains[v];
      phases[v] += incs[v];
      if (phases[v] >= 1) phases[v] -= 1;
      const p = pans[v];
      l += s * (0.5 - 0.5 * p);
      r += s * (0.5 + 0.5 * p);
    }
    if (sub > 0) {
      const sv = Math.sin(2 * Math.PI * subPhase) * sub;
      subPhase += subInc;
      if (subPhase >= 1) subPhase -= 1;
      l += sv;
      r += sv;
    }
    const g = (amp * env) / Math.sqrt(voices);
    L[startS + i] += fL.process(l, fc, q) * g;
    R[startS + i] += fR.process(r, fc, q) * g;
  }
}

/** A soft sine/triangle pluck — bell/keys texture for intros and breakdowns. */
export function pluck(L, R, startS, durS, freq, amp, opts = {}) {
  const { decay = 0.6, pan = 0, bright = 0.25 } = opts;
  const n = Math.min(Math.round(durS * SR), L.length - startS);
  if (n <= 0) return;
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  const i1 = freq / SR;
  const i2 = (freq * 2) / SR;
  const i3 = (freq * 3.01) / SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = percEnv(t, decay);
    if (env < 0.00005) break;
    const v =
      Math.sin(2 * Math.PI * p1) +
      Math.sin(2 * Math.PI * p2) * bright * Math.exp(-t / (decay * 0.4)) +
      Math.sin(2 * Math.PI * p3) * bright * 0.4 * Math.exp(-t / (decay * 0.25));
    p1 += i1; if (p1 >= 1) p1 -= 1;
    p2 += i2; if (p2 >= 1) p2 -= 1;
    p3 += i3; if (p3 >= 1) p3 -= 1;
    const g = amp * env;
    L[startS + i] += v * g * (0.5 - 0.5 * pan);
    R[startS + i] += v * g * (0.5 + 0.5 * pan);
  }
}

/** Warm sustained pad: stacked detuned saws through a gentle lowpass, slow
 *  attack and release so it beds under everything else. */
export function padVoice(L, R, startS, durS, freq, amp, opts = {}) {
  const { cutoff = 1800, attack = 0.6, release = 0.9, detuneCents = 10, voices = 5 } = opts;
  supersaw(L, R, startS, durS, freq, amp, {
    voices,
    detuneCents,
    attack,
    decay: 0.9,
    sustain: 0.95,
    release,
    cutoff,
    cutoffEnv: 250,
    q: 0.7,
    stereo: 0.95,
  });
}

/** Sub/reese bass. `reese` adds the classic detuned-beating character. */
export function bass(L, R, startS, durS, freq, amp, opts = {}) {
  const { reese = 0, cutoff = 900, decay = 0.35, sustain = 0.85, drive = 1.6 } = opts;
  const n = Math.min(Math.round((durS + 0.06) * SR), L.length - startS);
  if (n <= 0) return;
  let p1 = 0;
  let p2 = 0;
  let pSub = 0;
  const i1 = freq / SR;
  const i2 = (freq * Math.pow(2, reese * 14 / 1200)) / SR;
  const iSub = freq / 2 / SR;
  const f = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = ampEnv(t, durS, { attack: 0.004, decay, sustain, release: 0.05 });
    if (env < 0.00005 && t > durS) break;
    let v = sawSample(p1, i1);
    if (reese > 0) v = v * 0.6 + sawSample(p2, i2) * 0.6;
    v = v * 0.7 + Math.sin(2 * Math.PI * pSub) * 0.9;
    p1 += i1; if (p1 >= 1) p1 -= 1;
    p2 += i2; if (p2 >= 1) p2 -= 1;
    pSub += iSub; if (pSub >= 1) pSub -= 1;
    let s = f.process(v, cutoff, 0.9) * amp * env;
    s = Math.tanh(s * drive) / Math.tanh(drive);
    L[startS + i] += s;
    R[startS + i] += s;
  }
}

// --- drums -----------------------------------------------------------------

export function kick(L, R, startS, amp = 1, opts = {}) {
  const { fStart = 155, fEnd = 46, pitchTau = 0.032, decay = 0.34, click = 0.5 } = opts;
  const n = Math.min(Math.round(0.7 * SR), L.length - startS);
  if (n <= 0) return;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = percEnv(t, decay);
    if (env < 0.00004) break;
    const f = fEnd + (fStart - fEnd) * Math.exp(-t / pitchTau);
    phase += f / SR;
    if (phase >= 1) phase -= 1;
    let v = Math.sin(2 * Math.PI * phase);
    if (t < 0.006) v += (Math.random() * 2 - 1) * click * (1 - t / 0.006);
    let s = Math.tanh(v * env * amp * 2.1) * 0.72;
    L[startS + i] += s;
    R[startS + i] += s;
  }
}

export function snare(L, R, startS, amp = 0.8, opts = {}) {
  const { decay = 0.16, tone = 0.35, hp = 1400 } = opts;
  const n = Math.min(Math.round(0.5 * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = percEnv(t, decay);
    if (env < 0.00004) break;
    const nl = Math.random() * 2 - 1;
    const nr = Math.random() * 2 - 1;
    const body =
      (Math.sin(2 * Math.PI * p1) + Math.sin(2 * Math.PI * p2) * 0.7) * tone * Math.exp(-t / 0.05);
    p1 += 185 / SR; if (p1 >= 1) p1 -= 1;
    p2 += 330 / SR; if (p2 >= 1) p2 -= 1;
    L[startS + i] += (fl.process(nl, hp, 0.8, "hp") + body) * env * amp;
    R[startS + i] += (fr.process(nr, hp, 0.8, "hp") + body) * env * amp;
  }
}

export function hat(L, R, startS, amp = 0.35, open = false) {
  const decay = open ? 0.22 : 0.033;
  const n = Math.min(Math.round((open ? 0.5 : 0.12) * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = percEnv(t, decay);
    if (env < 0.00004) break;
    L[startS + i] += fl.process(Math.random() * 2 - 1, 7800, 0.7, "hp") * env * amp * 0.55;
    R[startS + i] += fr.process(Math.random() * 2 - 1, 7800, 0.7, "hp") * env * amp * 0.55;
  }
}

export function clap(L, R, startS, amp = 0.6) {
  // Several closely-spaced noise bursts then a short tail — that stack of
  // near-repeats is what separates a clap from a plain noise hit.
  const offsets = [0, 0.009, 0.018, 0.028];
  for (let b = 0; b < offsets.length; b++) {
    const s0 = startS + Math.round(offsets[b] * SR);
    const n = Math.min(Math.round(0.06 * SR), L.length - s0);
    const fl = new SVF();
    const fr = new SVF();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = percEnv(t, b === offsets.length - 1 ? 0.11 : 0.012);
      L[s0 + i] += fl.process(Math.random() * 2 - 1, 1200, 1.2, "bp") * env * amp;
      R[s0 + i] += fr.process(Math.random() * 2 - 1, 1250, 1.2, "bp") * env * amp;
    }
  }
}

export function crash(L, R, startS, amp = 0.4) {
  const n = Math.min(Math.round(1.8 * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = percEnv(t, 0.75);
    if (env < 0.00003) break;
    L[startS + i] += fl.process(Math.random() * 2 - 1, 5200, 0.6, "hp") * env * amp * 0.5;
    R[startS + i] += fr.process(Math.random() * 2 - 1, 5400, 0.6, "hp") * env * amp * 0.5;
  }
}

/** White-noise sweep used to lead into a drop. */
export function riser(L, R, startS, durS, amp = 0.3) {
  const n = Math.min(Math.round(durS * SR), L.length - startS);
  if (n <= 0) return;
  const fl = new SVF();
  const fr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const prog = t / durS;
    const fc = 300 + Math.pow(prog, 2) * 9000;
    const env = Math.pow(prog, 1.4) * amp;
    L[startS + i] += fl.process(Math.random() * 2 - 1, fc, 2.4, "bp") * env;
    R[startS + i] += fr.process(Math.random() * 2 - 1, fc * 1.02, 2.4, "bp") * env;
  }
}

// --- effects ---------------------------------------------------------------

/**
 * Sidechain ducking — the "pump". Everything dips on each kick and breathes
 * back. More than any single sound, this rhythmic pumping is what makes a
 * track read as modern electronic music rather than as layered synth parts.
 */
export function applySidechain(buf, kickTimesS, depth = 0.72, releaseS = 0.28) {
  if (kickTimesS.length === 0) return;
  const times = [...kickTimesS].sort((a, b) => a - b);
  let idx = 0;
  let nextKick = times[0] * SR;
  let lastKick = -1e9;
  for (let i = 0; i < buf.length; i++) {
    while (idx < times.length && i >= nextKick) {
      lastKick = nextKick;
      idx++;
      nextKick = idx < times.length ? times[idx] * SR : Infinity;
    }
    const dt = (i - lastKick) / SR;
    if (dt >= 0 && dt < releaseS * 4) {
      // Fast duck, curved recovery.
      const g = 1 - depth * Math.exp(-dt / releaseS);
      buf[i] *= g;
    }
  }
}

/** Schroeder reverb: parallel combs into series allpasses. Cheap, and plenty
 *  for the wash of space this style leans on. */
export class Reverb {
  constructor(sizeScale = 1, damp = 0.35) {
    const combTunings = [1116, 1188, 1277, 1356, 1422, 1491];
    const apTunings = [556, 441, 341, 225];
    this.combs = combTunings.map((t) => ({
      buf: new Float32Array(Math.max(4, Math.round(t * sizeScale))),
      idx: 0,
      store: 0,
      feedback: 0.82,
      damp,
    }));
    this.aps = apTunings.map((t) => ({
      buf: new Float32Array(Math.max(4, Math.round(t * sizeScale))),
      idx: 0,
      feedback: 0.5,
    }));
  }
  process(x) {
    let out = 0;
    for (const c of this.combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - c.damp) + c.store * c.damp;
      c.buf[c.idx] = x + c.store * c.feedback;
      c.idx = (c.idx + 1) % c.buf.length;
      out += y;
    }
    out /= this.combs.length;
    for (const a of this.aps) {
      const y = a.buf[a.idx];
      const v = out + y * a.feedback;
      a.buf[a.idx] = v;
      a.idx = (a.idx + 1) % a.buf.length;
      out = y - out;
    }
    return out;
  }
}

export function applyReverb(L, R, mix = 0.18, sizeScale = 1, damp = 0.35) {
  const rl = new Reverb(sizeScale, damp);
  const rr = new Reverb(sizeScale * 1.017, damp);
  for (let i = 0; i < L.length; i++) {
    const wl = rl.process(L[i]);
    const wr = rr.process(R[i]);
    L[i] = L[i] * (1 - mix) + wl * mix;
    R[i] = R[i] * (1 - mix) + wr * mix;
  }
}

/** Feedback delay, tuned to the beat grid for rhythmic echoes. */
export function applyDelay(L, R, delaySec, feedback = 0.34, mix = 0.16) {
  const d = Math.max(1, Math.round(delaySec * SR));
  const bl = new Float32Array(d);
  const br = new Float32Array(d);
  let idx = 0;
  for (let i = 0; i < L.length; i++) {
    const yl = bl[idx];
    const yr = br[idx];
    // Cross-feed the channels so repeats bounce across the stereo field.
    bl[idx] = L[i] + yr * feedback;
    br[idx] = R[i] + yl * feedback;
    idx = (idx + 1) % d;
    L[i] += yl * mix;
    R[i] += yr * mix;
  }
}

// --- master ----------------------------------------------------------------

/** Normalize, glue with soft saturation, and fade the very edges so a loop
 *  can't click. */
export function master(L, R, { targetPeak = 0.89, drive = 1.15, fadeIn = 0.008, fadeOut = 0.05 } = {}) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const pre = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * pre * drive) / Math.tanh(drive);
    R[i] = Math.tanh(R[i] * pre * drive) / Math.tanh(drive);
  }
  let peak2 = 0;
  for (let i = 0; i < L.length; i++) {
    peak2 = Math.max(peak2, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = peak2 > 0 ? targetPeak / peak2 : 1;
  const fi = Math.round(fadeIn * SR);
  const fo = Math.round(fadeOut * SR);
  for (let i = 0; i < L.length; i++) {
    let m = g;
    if (i < fi) m *= i / fi;
    const fromEnd = L.length - i;
    if (fromEnd < fo) m *= fromEnd / fo;
    L[i] *= m;
    R[i] *= m;
  }
}

// --- wav out ---------------------------------------------------------------

export function writeWavStereo(path, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), 44 + i * 4 + 2);
  }
  writeFileSync(path, buf);
}

// --- music theory ----------------------------------------------------------

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/** Chord as MIDI notes from a scale degree (0-indexed) with optional 7th/9th. */
export function chordFrom(rootMidi, scale, degree, { seventh = false, ninth = false } = {}) {
  const s = SCALES[scale];
  const at = (i) => {
    const oct = Math.floor(i / s.length);
    return rootMidi + s[((i % s.length) + s.length) % s.length] + oct * 12;
  };
  const notes = [at(degree), at(degree + 2), at(degree + 4)];
  if (seventh) notes.push(at(degree + 6));
  if (ninth) notes.push(at(degree + 8));
  return notes;
}

/** Nearest chord tone at or above a target pitch — keeps generated melodies
 *  locked to the harmony instead of wandering. */
export function nearestChordTone(chord, target) {
  let best = chord[0];
  let bestDist = Infinity;
  for (const c of chord) {
    for (let oct = -24; oct <= 24; oct += 12) {
      const n = c + oct;
      const d = Math.abs(n - target);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
  }
  return best;
}
