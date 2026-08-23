// Renders the launch signature (pencil stroke -> motif) to WAV.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { saveLaunch } from "./launch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "v5_wav");
mkdirSync(OUT, { recursive: true });

const sec = saveLaunch(join(OUT, "s00_launch.wav"));
console.log(`s00_launch           ${sec.toFixed(2)}s`);
