#!/usr/bin/env node
/**
 * Contact sheets of every exercise clip at its hardest point, 12 per page
 * (WebGL limits how many viewers one page can hold). Needs `npx vite` on :5173.
 *   node scripts/motion/sheets.mjs [phase=peak] [out=/tmp/motion/sheets]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [phase = 'peak', outDir = '/tmp/motion/sheets'] = process.argv.slice(2);
// Ask tsx for the clip ids (a temp module keeps quoting out of the shell).
const list = '/tmp/motion-clip-ids.ts';
fs.writeFileSync(list, "import { EXERCISE_CLIPS } from '" + process.cwd() + "/src/motion/clips';\nconsole.log('IDS=' + JSON.stringify(EXERCISE_CLIPS.map(c => c.id)));\n");
const out = execFileSync('npx', ['tsx', '--tsconfig', 'tsconfig.app.json', list], { encoding: 'utf8' });
const ids = JSON.parse(out.split('IDS=')[1].split('\n')[0]);
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < ids.length; i += 12) {
  const batch = ids.slice(i, i + 12);
  const file = `${outDir}/sheet-${String(i / 12 + 1).padStart(2, '0')}.png`;
  execFileSync('node', ['scripts/motion/shot.mjs', `clips=${batch.join(',')}&phases=${phase}`, file, '1600', '1000'], { stdio: 'inherit' });
}
console.log(`${ids.length} clips`);
