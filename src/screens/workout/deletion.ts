/**
 * A workout deleted at once, and put back (B-04, B-05; board D110, D111),
 * through the store's `update`: the session and the personal records its
 * sets set change together, as `withWorkout` and `withoutWorkout` have them,
 * and everything recorded with it goes and comes back with it, as it is when
 * deleted, a pain score corrected since included (Codex P8S-06). The Recently
 * deleted entry is written in the same change. A restore is checked against
 * what is stored as it commits, and keeps the renaming as lineage, so a pain
 * rating deleted on its own and restored later finds it (P8R-05).
 */
import { generateId } from '@/lib/utils';
import { StoreFailure, type StoreResult } from '@/store/db';
import { NOT_RECENT, lineageKey, recentKey, restorable, sessionEntry, type Restored } from '@/store/recent';
import type { Snapshot } from '@/store/snapshot';
import { freshId, getState, update } from '@/store/useStore';
import { nowAt, type Observation } from '@/health/observation';
import type { WorkoutSession } from '@/types';
import { withWorkoutBack, withoutWorkout } from './records';

/** What was recorded with a session (`session:<id>`), as it is stored now. */
const recordedWith = (sessionId: string) => (base: Snapshot): Observation[] => base.observations.filter(o => o.context === `session:${sessionId}`);

/** One of a session's records, moved to the session's new id with `restoredFrom`; its value, times, `editedAt` and `order` as they were. */
function movedTo(o: Observation, from: string, to: string): Observation {
  const own = `session:${from}:`;
  return { ...o, id: o.id.startsWith(own) ? `session:${to}:${o.id.slice(own.length)}` : `session:${to}:${o.id}`, context: `session:${to}`, restoredFrom: o.id };
}

/** Delete a workout at once; resolves with the entry's id. */
export async function deleteWorkout(sessionId: string): Promise<StoreResult<string>> {
  const entry = freshId('deleted-');
  const at = nowAt();
  const rows = recordedWith(sessionId);
  let doomed: WorkoutSession | undefined;
  const result = await update(prev => {
    doomed = prev.sessions.find(s => s.id === sessionId);
    return withoutWorkout(prev, sessionId);
  }, {
    edit: false,
    removeObservations: base => rows(base).map(o => o.id),
    content: base => (doomed ? { put: { [recentKey(entry)]: sessionEntry(doomed, { entry, at }, rows(base)) } } : undefined),
  });
  if (!result.ok) return result;
  return doomed ? { ok: true, value: entry } : { ok: false, failure: new StoreFailure('invalid', 'That workout is no longer on this device.') };
}

/** Undo, or Restore in Recently deleted: back under a fresh id with what was recorded with it, the entry used up, in one change. */
export async function restoreWorkout(entryId: string): Promise<StoreResult<Restored>> {
  const entry = restorable(getState().contentState, entryId, Date.now());
  if (!entry || entry.kind !== 'session' || !entry.session) return { ok: false, failure: new StoreFailure('invalid', NOT_RECENT) };
  const session = entry.session;
  const id = generateId();
  const rows = (entry.observations ?? []).map(o => movedTo(o, session.id, id));
  // The session says the score its record came back with, so nothing works the old one out again (P8S-06).
  const pain = rows.find(o => o.kind === 'backPain')?.value;
  const result = await update(prev => withWorkoutBack(prev, session, id, pain), {
    edit: false,
    entry: entryId,
    restored: () => rows,
    content: () => ({ put: { [lineageKey(`session:${session.id}`)]: { to: `session:${id}`, at: nowAt() } } }),
  });
  return result.ok ? { ok: true, value: { kind: 'session', id } } : result;
}
