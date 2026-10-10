/**
 * The planner's alternatives for one exercise, for the swap sheet.
 *
 * The planner already knows what may fill each slot of the day: ranked
 * candidates, filtered by equipment, safety flags, the nerve gate and the
 * spinal-loading ladder (`selectForSlot`). Rather than keep a second copy of
 * those rules here, this asks the planner itself — "if this exercise were not
 * an option, what would you put in this slot?" — by rebuilding the day's plan
 * with it among the profile's dislikes, the planner's own word for "avoid".
 * Asking again with that answer avoided too gives the next choice. Every
 * answer arrives dosed for today, with its load suggested from the history.
 *
 * Only the question is temporary: nothing here writes the profile.
 */

import type { SessionPlan } from '@/types/plan';
import { getStrength } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { slotsFor } from '@/engine/templates';
import { checkpointIds, plannedFrom, type Planned } from './model';

/** A short sheet, not a catalogue. */
export const MAX_ALTERNATIVES = 3;

/** A pick that cannot be offered still costs a rebuild, so the asking is bounded. */
const MAX_BUILDS = 8;

/** "Lower calves" and "lower calf" are the same muscle. */
const muscle = (m: string) => m.toLowerCase().trim().replace(/ves$/, 'f').replace(/s$/, '');

const muscles = (id: string) => new Set((getCoaching(id)?.muscles.primary ?? []).map(muscle));

/**
 * Whether `alt` honestly stands in for `original`: the slot ranks it, or it
 * moves the same way, or it works the same muscles. When nothing better is
 * safe, the planner falls back on any drill to keep a slot filled — an
 * incline push-up in place of a squat. That keeps a guided session on time;
 * as a swap it would be a different exercise, so it is not offered.
 */
export function standsIn(alt: string, original: string, slotCandidates: readonly string[]): boolean {
  if (slotCandidates.includes(alt)) return true;
  const patterns = getStrength(original)?.patterns ?? [];
  if (getStrength(alt)?.patterns.some(p => patterns.includes(p))) return true;
  const worked = muscles(original);
  return [...muscles(alt)].some(m => worked.has(m));
}

export interface SlotQuestion {
  slotId: string;
  /** The plan's own exercise for the slot: what an alternative must stand in for. */
  planned: string;
  /** Never offered: the exercise there now, and the planned one (offered separately, as "back"). */
  avoid: string[];
  /**
   * The workout's other exercises: not offered, since doing one twice is not
   * a swap. They are only avoided once the planner picks one, so the rest of
   * the day's plan is disturbed as little as possible.
   */
  inWorkout: readonly string[];
}

/**
 * @param build the day's plan with some exercises avoided: `planFor` with them
 *   added to `profile.dislikes`.
 */
export function plannerAlternatives(build: (avoid: string[]) => SessionPlan, q: SlotQuestion, max = MAX_ALTERNATIVES): Planned[] {
  const found: Planned[] = [];
  const avoid = [...new Set(q.avoid)];
  for (let n = 0; n < MAX_BUILDS && found.length < max; n++) {
    const plan = build(avoid);
    const ex = plan.exercises.find(e => e.slotId === q.slotId);
    // The slot was cut to fit the time, or the planner fell back to repeating
    // something already ruled out: it has nothing new to offer.
    if (!ex || avoid.includes(ex.exerciseId)) break;
    avoid.push(ex.exerciseId);
    const candidates = slotsFor(plan.focus).find(s => s.id === q.slotId)?.candidates ?? [];
    if (q.inWorkout.includes(ex.exerciseId) || !standsIn(ex.exerciseId, q.planned, candidates)) continue;
    found.push(plannedFrom(ex, checkpointIds(plan).has(ex.exerciseId)));
  }
  return found;
}

/**
 * What the planner offered when the user swapped `planned` out for
 * `exerciseId` — asked again the same way, to restore a swap after a reload.
 */
export function findAlternative(
  build: (avoid: string[]) => SessionPlan,
  slotId: string,
  planned: string,
  exerciseId: string,
): Planned | undefined {
  return plannerAlternatives(build, { slotId, planned, avoid: [planned], inWorkout: [] }, MAX_BUILDS)
    .find(p => p.exerciseId === exerciseId);
}
