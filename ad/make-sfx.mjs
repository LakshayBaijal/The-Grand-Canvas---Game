/**
 * Generates the two money sounds the spot needs, as MP3s in assets/.
 *
 *   node ad/make-sfx.mjs
 *
 *   sfx_coins.mp3    nine coins landing, one per backer, each a semitone
 *                    higher than the last -- the "counting up" feeling, baked
 *                    at the exact spacing the notes land on screen.
 *   sfx_kaching.mp3  a cash register for the moment it gets funded.
 *
 * Written by hand rather than sampled: a real register sample is somebody
 * else's copyright, and a game whose whole look is hand-drawn shouldn't be
 * paying licence fees for a "ding". These are built from the same kind of
 * partials the game's own music engine uses, so they sit in the same world.
 *
 * Needs ffmpeg on PATH for the WAV -> MP3 step.
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 48000;

// --- a tiny synth ----------------------------------------------------------
const buf = (seconds) => new Float32Array(Math.ceil(seconds * SR));

/** Adds a decaying sine at [freq] starting at [at] seconds. */
function partial(out, at, freq, amp, decay, { detune = 0, phase = 0 } = {}) {
  const i0 = Math.round(at * SR);
  const len = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    // A 3ms attack, so nothing clicks on the way in.
    const attack = Math.min(1, t / 0.003);
    const env = attack * Math.exp(-t / decay);
    out[i0 + i] += Math.sin(2 * Math.PI * (freq + detune) * t + phase) * amp * env;
  }
}

/** Filtered noise — the mechanical part of a register, the clack of the drawer. */
function noise(out, at, amp, decay, cutoff) {
  const i0 = Math.round(at * SR);
  const len = Math.min(out.length - i0, Math.ceil(decay * 6 * SR));
  let lp = 0, hp = 0, prev = 0;
  const k = Math.exp(-2 * Math.PI * cutoff / SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.exp(-t / decay);
    const white = Math.random() * 2 - 1;
    lp = white * (1 - k) + lp * k;          // low-passed body
    hp = white - prev + 0.97 * hp; prev = white;   // high-passed edge
    out[i0 + i] += (lp * 0.5 + hp * 0.5) * amp * env;
  }
}

/**
 * One coin: two quick notes, the second a fourth above the first, on a
 * metallic partial stack. Two notes is what makes a sound read as "coin"
 * rather than "bell" — it is the oldest trick in arcade audio.
 */
function coin(out, at, freq, amp = 1) {
  const stack = [
    [1.0, 1.00, 0.16],
    [2.0, 0.42, 0.11],
    [2.97, 0.24, 0.08],
    [4.13, 0.12, 0.05],
  ];
  for (const [mult, a, d] of stack) partial(out, at, freq * mult, a * amp * 0.34, d);
  const up = freq * (4 / 3);                     // the flick upward
  for (const [mult, a, d] of stack) partial(out, at + 0.055, up * mult, a * amp * 0.34, d * 1.6);
}

/** A struck bell: inharmonic partials, long tail. The chime of the register. */
function bell(out, at, freq, amp, decay) {
  const stack = [
    [0.56, 0.62, 0.9], [0.92, 0.78, 0.8], [1.00, 1.00, 1.0],
    [1.71, 0.44, 0.5], [2.00, 0.36, 0.45], [2.74, 0.22, 0.3], [3.76, 0.14, 0.2],
  ];
  for (const [mult, a, d] of stack) {
    partial(out, at, freq * mult, a * amp * 0.22, decay * d, { detune: (mult % 1) * 1.4 });
  }
}

// --- WAV writing -----------------------------------------------------------
function writeWav(path, mono) {
  // Normalise to -1.5dBFS, then a gentle soft-clip so nothing ever squares off.
  let peak = 0;
  for (const v of mono) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.84 / peak : 1;
  const n = mono.length;
  const data = Buffer.alloc(n * 4);              // 16-bit stereo
  for (let i = 0; i < n; i++) {
    const x = Math.tanh(mono[i] * gain * 1.1) * 0.94;
    const s = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
    data.writeInt16LE(s, i * 4);
    data.writeInt16LE(s, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([head, data]));
}

function toMp3(wav, mp3) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame',
    '-b:a', '192k', '-ar', String(SR), mp3]);
  unlinkSync(wav);
}

// --- the two sounds --------------------------------------------------------

// Nine coins, spaced exactly as the notes land on the paper (see NOTES in
// engine.js: 4.1 + i*0.072, landing 0.30s later). The run starts at zero here
// and is delayed into place at mixdown.
const COIN_GAP = 0.072, COINS = 9;
{
  const out = buf(COIN_GAP * COINS + 1.0);
  const base = 880;                               // A5
  for (let i = 0; i < COINS; i++) {
    // A semitone per coin: the pitch climbing is the money climbing.
    const f = base * Math.pow(2, i / 12);
    coin(out, i * COIN_GAP, f, 0.9 - i * 0.015);
  }
  writeWav('/tmp/_coins.wav', out);
  toMp3('/tmp/_coins.wav', join(HERE, 'assets', 'sfx_coins.mp3'));
  console.log(`sfx_coins.mp3   ${COINS} coins, ${(COIN_GAP * COINS).toFixed(2)}s run`);
}

// The register: the drawer clacks, then two chimes a fifth apart. That gap
// between the clack and the chime is the whole "ka-CHING".
{
  const out = buf(2.2);
  noise(out, 0.000, 0.55, 0.030, 3200);           // ka
  noise(out, 0.012, 0.30, 0.055, 1400);           // the drawer body
  bell(out, 0.055, 1046.5, 1.00, 0.95);           // CHING  (C6)
  bell(out, 0.080, 1568.0, 0.72, 0.85);           // a fifth above
  bell(out, 0.300, 2093.0, 0.30, 0.70);           // a sparkle on the tail
  partial(out, 0.055, 261.6, 0.30, 0.40);         // a low thump so it has weight
  writeWav('/tmp/_kaching.wav', out);
  toMp3('/tmp/_kaching.wav', join(HERE, 'assets', 'sfx_kaching.mp3'));
  console.log('sfx_kaching.mp3  register, ~1.2s tail');
}
