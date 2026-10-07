/**
 * Authoring probe: solve a clip at a few phases and print where the body is.
 *   npx tsx --tsconfig tsconfig.app.json scripts/motion/probe.ts <clipId> [phases=0,0.5]
 */
import fs from 'node:fs';
import { parseCharacter } from '../../src/motion/character';
import { Rig } from '../../src/motion/rig';
import { samplePose } from '../../src/motion/clip';
import { getClip } from '../../src/motion/clips';
import { skin, surface } from '../../src/motion/probe';

const [id = 'stand', phasesArg = '0'] = process.argv.slice(2);
const buf = fs.readFileSync('public/models/coach-male.bin');
const data = parseCharacter(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const rig = new Rig(data.bones);
const clip = getClip(id);
if (!clip) { console.error(`no clip ${id}`); process.exit(1); }
const f = (v: { x: number; y: number; z: number }) => `[${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}]`;
for (const ph of phasesArg.split(',').map(Number)) {
  rig.solve(samplePose(clip, ph));
  const s = surface(data, skin(data, rig));
  console.log(`\n${id} @ ${ph}: body min y ${s.minY.toFixed(3)}`);
  console.log('  joints', ['pelvis', 'spine_03', 'neck_01', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l']
    .map(n => `${n}=${f(rig.joint(n))}`).join(' '));
  console.log('  grip L', f(rig.grip('L')), 'R', f(rig.grip('R')));
  console.log('  lowest by region', Object.entries(s.regionMinY).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([k, v]) => `${k}:${v.toFixed(3)}`).join(' '));
}
