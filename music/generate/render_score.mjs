import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCORE, renderScore, saveScore } from "./score.mjs";

// Relative to this script, not hardcoded to one machine.
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "v5_wav");
mkdirSync(OUT, { recursive: true });
const sp = "▁▂▃▄▅▆▇█";
for (const t of SCORE) {
  const t0 = Date.now();
  const { L, R, totalSec, totalBars } = renderScore(t);
  let peak = 0; const secs = Math.floor(L.length / 44100), env = [];
  for (let s = 0; s < secs; s++) {
    let acc = 0;
    for (let i = 0; i < 44100; i += 8) {
      const v = (L[s * 44100 + i] + R[s * 44100 + i]) * 0.5;
      acc += v * v; if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    env.push(Math.sqrt(acc / (44100 / 8)));
  }
  const mx = Math.max(...env), nrm = env.map(v => v / mx);
  const rms = Math.sqrt(env.reduce((a,v)=>a+v*v,0)/env.length);
  saveScore(`${OUT}/${t.file}.wav`, L, R);
  console.log(`${t.file.padEnd(20)} ${t.screen.padEnd(30)} ${totalSec.toFixed(1)}s peak ${peak.toFixed(2)} rms ${rms.toFixed(3)} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  console.log(`  ${nrm.map(v => sp[Math.min(7, Math.floor(v * 8))]).join("")}`);
}
