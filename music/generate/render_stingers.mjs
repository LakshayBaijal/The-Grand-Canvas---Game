// Renders the UI stingers (win, lose, correct, round-start, trophy) to WAV.
// The launch signature is separate — see render_launch.mjs.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STINGERS, saveWav } from "./songs3.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "v5_wav");
mkdirSync(OUT, { recursive: true });

for (const s of STINGERS) {
  const t0 = Date.now();
  const { L, R } = s.render();
  saveWav(join(OUT, `${s.file}.wav`), L, R);
  console.log(`${s.file.padEnd(20)} ${(L.length / 44100).toFixed(2)}s  (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
}
