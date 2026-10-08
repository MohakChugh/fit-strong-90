/**
 * Finishing a workout so that a finish which saves is the last word on it
 * (review F06).
 *
 * The finish is applied to the screen's workout before anything is written.
 * From that moment the reducer refuses new sets, and the autosave — which only
 * ever writes a workout still in progress — has nothing more to write, so a
 * set tapped while the save is on its way cannot land behind it. The finished
 * record is committed after any autosave already on its way. If the commit
 * fails, the workout is reopened with every set and note, still in progress,
 * and the failure is handed back: no false success, and nothing typed is
 * lost. Finishing ended the sitting, though, so the next set after a failed
 * finish asks the restart question, not the live one (review R04).
 */

import type { WorkoutSession } from '@/types';
import { StoreFailure, type StoreResult } from '@/store/db';
import { toSession, workoutReducer, type WorkoutAction, type WorkoutState } from './model';

export interface FinaliseDeps {
  /** Autosaves already on their way; the finish waits so it is written last. */
  pending: Promise<unknown>;
  /** Commit the finished record, and everything it feeds, as one change. */
  commit: (session: WorkoutSession) => Promise<StoreResult>;
  /** Move the screen's workout: the finish now, and a reopen if the commit fails. */
  dispatch: (action: WorkoutAction) => void;
}

export async function finalise(
  state: WorkoutState,
  finish: Extract<WorkoutAction, { type: 'finish' }>,
  deps: FinaliseDeps,
): Promise<StoreResult<WorkoutSession>> {
  const finished = workoutReducer(state, finish);
  if (finished === state) {
    return { ok: false, failure: new StoreFailure('unknown', 'Nothing has been logged yet, so there is nothing to save.') };
  }
  deps.dispatch(finish);
  await deps.pending;
  const session = toSession(finished);
  const result = await deps.commit(session);
  if (!result.ok) {
    deps.dispatch({ type: 'reopen' });
    return result;
  }
  return { ok: true, value: session };
}
