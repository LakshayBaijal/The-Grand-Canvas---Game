/**
 * The ten-second store video's backing track.
 *
 *   node ad/make-music.mjs   ->  assets/promo_bed.mp3
 *
 * Deliberately quiet and deliberately simple: a soft kick, a brushed hat, and
 * a four-note pluck that walks Am -> F -> G -> C. Somebody watching a store
 * listing is usually in public with the volume wherever they last left it, and
 * a track that shouts is a track they mute -- and a muted video sells nothing.
 * So this sits under the pictures and gets out of the way, and the only things
 * that poke above it are the coins and the register.
 *
 * Needs ffmpeg on PATH for the WAV -> MP3 step.
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const LEN = 10.2;                 // a beat of tail past the 10s cut
const out = new Float32Array(Math.ceil(LEN * SR));

// --- voices -----------------------------------------------------------------
function env(i, t, attack, decay) {
  return Math.min(1, t / attack) * Math.exp(-t / decay);
}

/** Marimba-ish: a sine plus two quiet harmonics, struck and gone. */
function pluck(at, freq, amp = 1, decay = 0.42) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = env(i, t, 0.004, decay);
    out[i0 + i] += (Math.sin(2 * Math.PI * freq * t)
      + 0.28 * Math.sin(2 * Math.PI * freq * 2 * t)
      + 0.10 * Math.sin(2 * Math.PI * freq * 3.01 * t)) * amp * 0.22 * e;
  }
}

/** A soft kick: a sine swept down, more felt than heard. */
function kick(at, amp = 1) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(0.30 * SR));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 48 + 62 * Math.exp(-t / 0.030);       // 110Hz down to 48Hz
    phase += 2 * Math.PI * f / SR;
    out[i0 + i] += Math.sin(phase) * amp * 0.50 * Math.exp(-t / 0.085);
  }
}

/** A brushed hat, kept very quiet -- it is the pulse, not the point. */
function hat(at, amp = 1) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(0.09 * SR));
  let hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = Math.random() * 2 - 1;
    hp = w - prev + 0.94 * hp; prev = w;
    out[i0 + i] += hp * amp * 0.055 * Math.exp(-t / 0.016);
  }
}

/** A held chord under everything, with a slow swell. */
function pad(at, freqs, amp, dur) {
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
function shimmer(at, amp, dur) {
  const i0 = Math.round(at * SR), n = Math.min(out.length - i0, Math.ceil(dur * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.min(1, t / 0.25) * Math.exp(-t / (dur * 0.6));
    let v = 0;
    for (const f of [2093, 2637, 3136, 4186]) v += Math.sin(2 * Math.PI * f * t + f);
    out[i0 + i] += (v / 4) * amp * 0.030 * e;
  }
}

// --- the arrangement ---------------------------------------------------------
// 110bpm: a beat is 0.545s, a bar 2.18s. The chord changes are placed on the
// video's cuts rather than on a metronome, so the music turns when the picture
// does -- which is the only reason it reads as scored rather than stuck under.
const BEAT = 60 / 110;

const N = { A2: 110.00, C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.00,
            A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
            F4: 349.23, G4: 392.00, A4: 440.00, C5: 523.25, E5: 659.25, G5: 783.99 };

// chord, from-time, to-time, and the four notes the pluck walks
const SECTIONS = [
  { at: 0.00, to: 1.40, pad: [N.A2, N.E3, N.A3], walk: [N.A3, N.C4, N.E4, N.C4], amp: 0.55 },  // the prompt
  { at: 1.40, to: 5.00, pad: [N.A2, N.E3, N.A3], walk: [N.A3, N.C4, N.E4, N.A4], amp: 0.80 },  // four papers
  { at: 5.00, to: 6.40, pad: [N.F3, N.C4, N.F4], walk: [N.F4, N.A4, N.C5, N.A4], amp: 0.90 },  // the pitch
  { at: 6.40, to: 8.60, pad: [N.G3, N.D4, N.G4], walk: [N.G4, N.B3, N.D4, N.G4], amp: 1.00 },  // funded
  { at: 8.60, to: 10.2, pad: [N.C3, N.G3, N.C4, N.E4], walk: [], amp: 1.00 },                  // the card
];

for (const s of SECTIONS) {
  pad(s.at, s.pad, s.amp, s.to - s.at);
  // eighth-note pluck, walking the chord
  let k = 0;
  for (let t = s.at; t < s.to - 0.05; t += BEAT / 2) {
    if (s.walk.length === 0) break;
    const note = s.walk[k % s.walk.length];
    // Every other note is softer, so the line has a lilt instead of a march.
    pluck(t, note, s.amp * (k % 2 ? 0.42 : 0.72), 0.38);
    k++;
  }
}

// The pulse only arrives when the game does, and steps up when the money does.
for (let t = 1.40, i = 0; t < 8.60; t += BEAT / 2, i++) {
  const loud = t >= 5.00;
  hat(t, loud ? 1.0 : 0.62);
  if (i % 4 === 0) kick(t, t >= 5.00 ? 1.0 : 0.7);          // beats 1 and 3
  if (loud && i % 4 === 2) kick(t, 0.55);                    // a little push
}
kick(8.60, 1.0);
shimmer(8.60, 1.0, 1.6);

// --- write ------------------------------------------------------------------
// Peaks at -6dBFS in the file and gets mixed in quieter still, so the coins and
// the register have room to sit on top without anything being shouted.
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const gain = peak > 0 ? 0.50 / peak : 1;
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
  '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', String(SR),
  join(HERE, 'assets', 'promo_bed.mp3')]);
unlinkSync('/tmp/_bed.wav');
console.log(`promo_bed.mp3  ${LEN}s, 110bpm, Am -> F -> G -> C`);
