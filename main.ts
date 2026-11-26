// MERIDIAN RUN — hand-in program for make.fun best-flight-game-20261126-0057.
// Node 22, standard library only, erasable TypeScript. It copies game/ and
// screenshots/ from this repository into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function main(): void {
  // Empty the output directory's contents, never the directory itself:
  // the grader bind-mounts it, and removing it kills the run.
  mkdirSync(outDir, { recursive: true });
  for (const entry of ['game', 'screenshots', 'dossier.json']) {
    const target = join(outDir, entry);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }

  cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
