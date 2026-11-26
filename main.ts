// Skyline Courier — entry hand-in program (Node 22, standard library only).
//
// The game lives in game/ beside this file: plain static files a desktop
// browser loads offline (game/index.html plus its scripts and stylesheet,
// no libraries, no network requests). This program hands it in: it copies
// game/ and screenshots/ into the output directory and writes
// dossier.json there, the summary the judge reads, using the vendored
// make.fun library in vendor/makefun-game.ts.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice and the bytes must come out identical.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps match the bounty gate: only text_max_bytes changes the bytes the
// dossier holds; the rest refuse an entry the scorer would refuse (more than
// 4 screenshots, one over 256 KiB, game/ over 993 entries or 48 MiB, or a
// game path over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
