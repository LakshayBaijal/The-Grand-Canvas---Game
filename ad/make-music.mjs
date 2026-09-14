/**
 * The two backing tracks the videos use.
 *
 *   node ad/make-music.mjs
 *
 *   assets/promo_bed.mp3   10.2s, 110bpm, Am -> F -> G -> C.
 *                          Deliberately quiet and simple: a soft kick, a
 *                          brushed hat, a four-note pluck. Somebody watching a
 *                          store listing is usually in public with the volume
 *                          wherever they last left it, and a track that shouts
 *                          is a track they mute -- and a muted video sells
 *                          nothing.
 *
 *   assets/daily_bed.mp3   10.4s, 92bpm, warm and almost drumless, with the
 *                          notification chime and the hearts baked in.
 *
 *   assets/rapid_bed.mp3   10.2s, 146bpm. The gallery cuts every two beats, so
 *                          the music is what the cuts are locked to rather
 *                          than the other way round: four-on-the-floor, a clap
 *                          on two and four, a bass walking a bar per pair of
 *                          drawings, and a pen-swish laid on every cut so the
 *                          edit lands on something.
 *
 * Both are synthesised rather than sampled, and the noise is seeded, so two
 * runs give the same file. Needs ffmpeg on PATH for the WAV -> MP3 step.
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 48000;

/** mulberry32, so the hats and swishes are the same noise every run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let noiseRng = rng(4242);

const N = { C2: 65.41, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00,
            C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.00,
            A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
            F4: 349.23, G4: 392.00, A4: 440.00, C5: 523.25, E5: 659.25, G5: 783.99 };

// --- voices -----------------------------------------------------------------
/** Marimba-ish: a sine plus two quiet harmonics, struck and gone. */
function pluck(out, at, freq, amp = 1, decay = 0.42) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.min(1, t / 0.004) * Math.exp(-t / decay);
    out[i0 + i] += (Math.sin(2 * Math.PI * freq * t)
      + 0.28 * Math.sin(2 * Math.PI * freq * 2 * t)
      + 0.10 * Math.sin(2 * Math.PI * freq * 3.01 * t)) * amp * 0.22 * e;
  }
}

/** A soft kick: a sine swept down, more felt than heard. */
function kick(out, at, amp = 1, punch = 1) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(0.30 * SR));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 48 + 62 * Math.exp(-t / (0.030 / punch));
    phase += 2 * Math.PI * f / SR;
    out[i0 + i] += Math.sin(phase) * amp * 0.50 * Math.exp(-t / (0.085 * punch));
  }
}

/** A brushed hat, kept quiet -- it is the pulse, not the point. */
function hat(out, at, amp = 1, decay = 0.016) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  let hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = noiseRng() * 2 - 1;
    hp = w - prev + 0.94 * hp; prev = w;
    out[i0 + i] += hp * amp * 0.055 * Math.exp(-t / decay);
  }
}

/** A clap: noise with a little body, for two and four. */
function clap(out, at, amp = 1) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(0.22 * SR));
  let bp = 0, lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = noiseRng() * 2 - 1;
    lp = w * 0.18 + lp * 0.82;
    bp = (w - prev) - 0.55 * bp; prev = w;
    // three quick slaps then the tail, which is what a clap actually is
    const slaps = Math.exp(-t / 0.007) + 0.8 * Math.exp(-Math.abs(t - 0.011) / 0.006) + 0.6 * Math.exp(-Math.abs(t - 0.022) / 0.006);
    const e = slaps + 0.45 * Math.exp(-t / 0.075);
    out[i0 + i] += (bp * 0.75 + lp * 0.25) * amp * 0.115 * e;
  }
}

/** A held chord under everything, with a slow swell. */
function pad(out, at, freqs, amp, dur) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil((dur + 0.8) * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.35) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.45));
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t) + 0.12 * Math.sin(2 * Math.PI * f * 2 * t);
    out[i0 + i] += (v / freqs.length) * amp * 0.10 * e;
  }
}

/** A wash of high partials for the last card. */
function shimmer(out, at, amp, dur) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(dur * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.min(1, t / 0.25) * Math.exp(-t / (dur * 0.6));
    let v = 0;
    for (const f of [2093, 2637, 3136, 4186]) v += Math.sin(2 * Math.PI * f * t + f);
    out[i0 + i] += (v / 4) * amp * 0.030 * e;
  }
}

/** A short filtered-noise sweep: the sound of a pen crossing paper, used to
 *  land each cut. Without it the edit is just a jump. */
function swish(out, at, amp = 1, dur = 0.13) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(dur * SR));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    const k = 0.03 + 0.55 * u;                    // opens up as it passes
    const w = noiseRng() * 2 - 1;
    lp = w * k + lp * (1 - k);
    out[i0 + i] += lp * amp * 0.12 * Math.sin(Math.PI * u);
  }
}

/** A bass note with a bit of bite. */
function bass(out, at, freq, amp, decay = 0.26) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.min(1, t / 0.006) * Math.exp(-t / decay);
    out[i0 + i] += (Math.sin(2 * Math.PI * freq * t) * 0.9
      + 0.22 * Math.sin(2 * Math.PI * freq * 2 * t)
      + 0.08 * Math.sin(2 * Math.PI * freq * 3 * t)) * amp * 0.30 * e;
  }
}

// --- writing ----------------------------------------------------------------
function write(out, name, peakTarget) {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? peakTarget / peak : 1;
  const n = out.length;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const x = Math.tanh(out[i] * gain * 1.05);
    const v = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
    data.writeInt16LE(v, i * 4); data.writeInt16LE(v, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  writeFileSync('/tmp/_bed.wav', Buffer.concat([head, data]));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', '/tmp/_bed.wav',
    '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', String(SR), join(HERE, 'assets', name)]);
  unlinkSync('/tmp/_bed.wav');
}

// ---------------------------------------------------------------------------
// The store video's bed: 110bpm, and the chord changes sit on the film's cuts
// rather than on a metronome, so the music turns when the picture does.
// ---------------------------------------------------------------------------
function promoBed() {
  noiseRng = rng(4242);
  const out = new Float32Array(Math.ceil(10.2 * SR));
  const BEAT = 60 / 110;
  const SECTIONS = [
    { at: 0.00, to: 1.40, pad: [N.A2, N.E3, N.A3], walk: [N.A3, N.C4, N.E4, N.C4], amp: 0.55 },
    { at: 1.40, to: 5.00, pad: [N.A2, N.E3, N.A3], walk: [N.A3, N.C4, N.E4, N.A4], amp: 0.80 },
    { at: 5.00, to: 6.40, pad: [N.F3, N.C4, N.F4], walk: [N.F4, N.A4, N.C5, N.A4], amp: 0.90 },
    { at: 6.40, to: 8.60, pad: [N.G3, N.D4, N.G4], walk: [N.G4, N.B3, N.D4, N.G4], amp: 1.00 },
    { at: 8.60, to: 10.2, pad: [N.C3, N.G3, N.C4, N.E4], walk: [], amp: 1.00 },
  ];
  for (const s of SECTIONS) {
    pad(out, s.at, s.pad, s.amp, s.to - s.at);
    let k = 0;
    for (let t = s.at; t < s.to - 0.05 && s.walk.length; t += BEAT / 2) {
      pluck(out, t, s.walk[k % s.walk.length], s.amp * (k % 2 ? 0.42 : 0.72), 0.38);
      k++;
    }
  }
  for (let t = 1.40, i = 0; t < 8.60; t += BEAT / 2, i++) {
    const loud = t >= 5.00;
    hat(out, t, loud ? 1.0 : 0.62);
    if (i % 4 === 0) kick(out, t, loud ? 1.0 : 0.7);
    if (loud && i % 4 === 2) kick(out, t, 0.55);
  }
  kick(out, 8.60, 1.0);
  shimmer(out, 8.60, 1.0, 1.6);
  write(out, 'promo_bed.mp3', 0.50);
  console.log('promo_bed.mp3   10.2s, 110bpm, Am -> F -> G -> C  (quiet)');
}

// ---------------------------------------------------------------------------
// The gallery's bed: 146bpm, and the film cuts every two beats. The cuts were
// chosen to fit the music rather than the music stretched to fit the cuts,
// which is why a drawing lands exactly on a kick every time.
// ---------------------------------------------------------------------------
const RAPID_BPM = 146;
export const RAPID_BEAT = 60 / RAPID_BPM;          // 0.4110s
export const RAPID_CUT = RAPID_BEAT * 2;           // 0.8219s -- one drawing
export const RAPID_CUTS = 10;
export const RAPID_REVEAL = RAPID_CUT * RAPID_CUTS; // 8.2192s -- the wall

function rapidBed() {
  noiseRng = rng(909);
  const out = new Float32Array(Math.ceil(10.4 * SR));
  const B = RAPID_BEAT, END = RAPID_REVEAL;

  // A bar per two drawings: Am, F, C, G, Am.
  const ROOTS = [N.A2, N.F2, N.C2, N.G2, N.A2];
  const WALKS = [
    [N.A3, N.C4, N.E4, N.C4], [N.F4, N.A3, N.C4, N.A3],
    [N.C4, N.E4, N.G4, N.E4], [N.G4, N.B3, N.D4, N.B3], [N.A3, N.C4, N.E4, N.A4],
  ];
  for (let bar = 0; bar < 5; bar++) {
    const at = bar * B * 4;
    pad(out, at, [ROOTS[bar], ROOTS[bar] * 2, ROOTS[bar] * 3], 0.85, B * 4);
    for (let b = 0; b < 4; b++) bass(out, at + b * B, ROOTS[bar] * (b === 2 ? 1.5 : 1), 0.95);
    for (let e = 0; e < 8; e++) pluck(out, at + e * (B / 2), WALKS[bar][e % 4], e % 2 ? 0.34 : 0.60, 0.30);
  }
  for (let b = 0; b * B < END; b++) {
    kick(out, b * B, 1.0, 1.0);
    if (b % 2 === 1) clap(out, b * B, 0.92);
    hat(out, b * B + B / 2, 0.9);
    hat(out, b * B, 0.55);
  }
  // A pen crossing the paper on every cut, so the edit lands on something.
  for (let i = 0; i < RAPID_CUTS; i++) swish(out, i * RAPID_CUT - 0.05, i === 0 ? 0.6 : 1.0);

  // The last drawing rises into the wall.
  for (let i = 0; i < 16; i++) hat(out, END - 0.82 + i * 0.051, 0.35 + i * 0.05, 0.012);

  // The wall: everything stops and a C major rings out.
  kick(out, END, 1.25, 1.2);
  clap(out, END, 1.1);
  swish(out, END - 0.06, 1.3, 0.20);
  pad(out, END, [N.C3, N.G3, N.C4, N.E4, N.G4], 1.35, 1.15);
  bass(out, END, N.C2, 1.25, 0.85);
  shimmer(out, END, 1.25, 1.9);
  for (const [i, f] of [N.C5, N.E5, N.G5].entries()) pluck(out, END + i * 0.075, f, 0.75, 0.9);

  write(out, 'rapid_bed.mp3', 0.62);
  console.log(`rapid_bed.mp3   10.4s, ${RAPID_BPM}bpm, a cut every ${RAPID_CUT.toFixed(3)}s`);
}

// ---------------------------------------------------------------------------
// The Daily's bed: 92bpm, warm, and no drums to speak of. The Daily is the one
// part of the game with no competition in it -- nothing is scored and nobody
// is judged -- so the music shouldn't sound like a race. The chord turns on
// each of the film's cuts, and the little bells are the notification and the
// hearts landing, baked in at the times daily.html uses.
// ---------------------------------------------------------------------------
export const DAILY_CUTS = { draw: 1.70, wall: 4.80, midnight: 7.20, card: 8.50 };
export const DAILY_HEARTS = [5.95, 6.20, 6.46, 6.74];

function dailyBed() {
  noiseRng = rng(5150);
  const out = new Float32Array(Math.ceil(10.4 * SR));
  const B = 60 / 92;
  const K = DAILY_CUTS;
  const SECTIONS = [
    { at: 0.00,       to: K.draw,     chord: [N.C3, N.G3, N.C4, N.E4], walk: [N.C4, N.E4, N.G4, N.E4], amp: 0.70 },
    { at: K.draw,     to: K.wall,     chord: [N.A2, N.E3, N.A3, N.C4], walk: [N.A3, N.C4, N.E4, N.C4], amp: 0.85 },
    { at: K.wall,     to: K.midnight, chord: [N.F2, N.C3, N.F3, N.A3], walk: [N.F4, N.A4, N.C5, N.A4], amp: 0.95 },
    { at: K.midnight, to: K.card,     chord: [N.G2, N.D4, N.G3, N.B3], walk: [N.G4, N.D4, N.B3, N.D4], amp: 1.00 },
    { at: K.card,     to: 10.4,       chord: [N.C3, N.G3, N.C4, N.E4, N.G4], walk: [], amp: 1.00 },
  ];
  for (const s of SECTIONS) {
    pad(out, s.at, s.chord, s.amp * 1.15, s.to - s.at);
    let k = 0;
    for (let t = s.at; t < s.to - 0.08 && s.walk.length; t += B) {
      pluck(out, t, s.walk[k % s.walk.length], s.amp * (k % 2 ? 0.46 : 0.72), 0.62);
      k++;
    }
  }
  // A pulse rather than a beat: one soft kick a bar, and brushes on the offs.
  for (let t = K.draw, i = 0; t < K.card; t += B, i++) {
    if (i % 2 === 0) kick(out, t, 0.55, 1.3);
    hat(out, t + B / 2, 0.38, 0.012);
  }
  // the notification, and the hearts
  bell(out, 0.10, 1046.5, 0.85, 0.55);
  bell(out, 0.20, 1568.0, 0.60, 0.50);
  for (const t of DAILY_HEARTS) bell(out, t, 1318.5, 0.42, 0.30);
  // midnight, and the names coming out
  bell(out, K.midnight, 880.0, 0.55, 0.85);
  bell(out, K.midnight + 0.10, 1318.5, 0.42, 0.75);
  shimmer(out, K.card, 0.9, 1.7);
  for (const [i, f] of [N.C5, N.E5, N.G5].entries()) pluck(out, K.card + i * 0.09, f, 0.60, 1.0);

  write(out, 'daily_bed.mp3', 0.50);
  console.log('daily_bed.mp3   10.4s, 92bpm, C -> Am -> F -> G -> C  (warm, no drums)');
}

/** A struck bell -- the notification and the hearts. */
function bell(out, at, freq, amp, decay) {
  for (const [mult, a, d] of [[0.56, 0.55, 0.9], [1.00, 1.00, 1.0], [1.71, 0.40, 0.5],
                              [2.00, 0.30, 0.45], [2.74, 0.18, 0.3]]) {
    const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(decay * d * 6 * SR));
    for (let i = 0; i < n; i++) {
      const t = i / SR, e = Math.min(1, t / 0.004) * Math.exp(-t / (decay * d));
      out[i0 + i] += Math.sin(2 * Math.PI * freq * mult * t) * a * amp * 0.16 * e;
    }
  }
}

promoBed();
rapidBed();
dailyBed();
