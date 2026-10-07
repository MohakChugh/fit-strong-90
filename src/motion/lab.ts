/**
 * Dev-only motion lab (served at /fit-strong-90/motion-lab.html, never built).
 *   ?clip=goblet-squat&phases=0,0.5&views=side,front     one clip, a cell per phase × view
 *   &mistakes=1                                          …plus a row per fault (red)
 *   &mistake=goblet-squat.knees-caving-in                …or just that fault
 *   ?clips=a,b,c&phases=0.5                               overview: a row per clip
 *   &sex=female  &side=right  &play=1  &work=glutes,quads  &stretch=hamstrings
 * scripts/motion/shot.mjs screenshots it.
 */
import { MotionViewer } from './viewer';
import { repTimeline } from './clip';
import { getClip } from './clips';
import type { CameraView, Clip, MuscleName } from './types';

const q = new URLSearchParams(location.search);
const list = (k: string, d = '') => (q.get(k) ?? d).split(',').map(s => s.trim()).filter(Boolean);
const clips = (q.get('clips') ? list('clips') : [q.get('clip') ?? 'stand']).map(id => getClip(id) ?? ({ id, duration: 1, keys: [] } as Clip));
const phases = list('phases', '0');
const sex = q.get('sex') === 'female' ? 'female' : 'male';
const side = q.get('side') === 'right' ? 'right' : 'left';
const still = q.get('play') !== '1';
const highlight: Partial<Record<MuscleName, number>> = Object.fromEntries([...list('work').map(m => [m, 1]), ...list('stretch').map(m => [m, -1])]);

const rows: { clip: Clip; mistake: string | null }[] = [];
for (const clip of clips) {
  rows.push({ clip, mistake: q.get('mistake') });
  if (q.get('mistakes') === '1') for (const m of clip.mistakes ?? []) rows.push({ clip, mistake: m.id });
}
const grid = document.getElementById('grid')!;
const viewsFor = (c: Clip) => list('views', c.view ?? 'threeQuarter') as CameraView[];
const perRow = Math.max(...rows.map(r => viewsFor(r.clip).length * phases.length));
// Overview sheets pack several clips per row; single-clip views give each row its own line.
const cols = q.get('clips') ? 4 : Math.min(6, perRow);
grid.style.setProperty('--cols', String(cols));
grid.style.gridAutoRows = `${Math.max(180, Math.floor((innerHeight - 12) / Math.ceil(rows.length * perRow / cols)) - 6)}px`;

const ready: Promise<void>[] = [];
for (const { clip, mistake } of rows) for (const view of viewsFor(clip)) for (const p of phases) {
  // 'peak' = the clip's hardest point (first full-depth key).
  const phase = p === 'peak' ? Number((repTimeline(clip)?.a ?? 0.5).toFixed(3)) : Number(p);
  const cell = document.createElement('div');
  cell.className = 'cell';
  const label = document.createElement('span');
  const m = clip.mistakes?.find(x => x.id === mistake);
  label.textContent = `${clip.id} · ${view} · t=${phase}${m ? ` · ✗ ${m.label}` : mistake ? ` · ✗ ${mistake} (missing)` : ''}`;
  if (m) label.style.color = '#c22';
  cell.append(label);
  grid.append(cell);
  if (!clip.keys.length) { label.textContent += ' · NO CLIP'; continue; }
  const v = new MotionViewer(cell, { modelUrl: `${import.meta.env.BASE_URL}models/coach-${sex}.bin`, still, pixelRatio: 1.25 });
  ready.push(v.load().then(() => {
    v.setClip({ ...clip, view }, { side, mistake, highlight });
    v.setPlaying(!still);
    v.setPhase(phase);
  }));
}
Promise.all(ready).then(() => { (window as unknown as { __labReady: boolean }).__labReady = true; }, e => { document.body.dataset.error = String(e); console.error(e); });
