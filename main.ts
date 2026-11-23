// Arcane Duel — hand-in program (Node 22, standard library only).
// Arcane Duel is an original 1v1 card battler: 20 life each, growing mana,
// creatures with summoning sickness and Guard, targeted spells, and an AI
// opponent (Malachar) whose heuristics the player can read and counter.
// The game itself is the static site in game/ (game/index.html plus its ES
// modules under game/src/, no library, no network request). This program
// copies game/ and screenshots/ from beside this file to the output directory
// and writes dossier.json there with the vendored make.fun library, exactly
// as the competition requires. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

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

// The caps below mirror the gate's own limits (at most 4 screenshots of at
// most 256 KiB each; game/ at most 993 entries and 48 MiB; dossier text
// capped at 160 KiB), so an entry this program accepts is one the scorer
// accepts too.
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
