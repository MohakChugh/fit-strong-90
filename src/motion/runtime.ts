/**
 * Lazy entry for the 3D form demo: everything that pulls in three.js is
 * reached through this module so the main bundle stays small.
 */
import { getMeta } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { getClip } from './clips';
import { musclesFor } from './muscles';
import type { Highlight } from './viewer';

export { MotionViewer } from './viewer';
export { getClip };
export { repTimeline } from './clip';

/**
 * Muscle tint for an exercise: strength and activation work glows orange,
 * stretches and nerve glides blue; secondary muscles at half strength.
 */
export function highlightFor(exerciseId: string): Highlight {
  const c = getCoaching(exerciseId);
  const meta = getMeta(exerciseId);
  if (!c) return {};
  const stretch = meta?.kind === 'mobility' && (meta.mode === 'hold' || meta.mode === 'reps' || meta.mode === 'slider');
  const sign = stretch ? -1 : 1;
  const out: Highlight = {};
  for (const m of musclesFor(c.muscles.secondary)) out[m] = 0.45 * sign;
  const soft = meta?.kind === 'cardio' || (meta?.kind === 'mobility' && meta.mode === 'breathing');
  for (const m of musclesFor(c.muscles.primary)) out[m] = (soft ? 0.7 : 1) * sign;
  return out;
}
