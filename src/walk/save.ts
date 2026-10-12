/**
 * What saving a walk writes (journey §18.3): its records, its route when the
 * person keeps routes, and its energy estimate when one can be made (Task 5).
 * One shape for the summary's Save and Home's recovery row, so both save the
 * same walk the same way.
 */
import type { SaveWalkInput } from '@/store/useStore';
import type { Walk } from './clock';
import { walkObservations, type WalkInput } from './record';
import { routeRecord, type RouteLine } from './routeRecord';
import { isoAt } from './time';

export function walkSave(walk: Walk, extra: { route?: readonly RouteLine[]; energy?: WalkInput } = {}): SaveWalkInput {
  const first = walk.segments[0];
  const startedAt = isoAt(first.start, first.offsetMin);
  const route = walk.plan.keepRoute && extra.route ? routeRecord(walk.id, startedAt, extra.route) : undefined;
  return {
    walkId: walk.id,
    observations: [...walkObservations(walk), ...(extra.energy ? [extra.energy] : [])],
    ...(route ? { route } : {}),
    // Without the lines in hand, the save reads them from the journal in its own transaction (H6-06).
    ...(walk.plan.keepRoute && !route ? { routeStartedAt: startedAt } : {}),
  };
}
