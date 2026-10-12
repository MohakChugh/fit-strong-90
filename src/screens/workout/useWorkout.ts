/**
 * The workout in progress, kept on the device as it changes.
 *
 * Every change that matters is written through the store (`putSession`) as it
 * happens, so a reload, a locked phone or the app being closed costs nothing
 * that was logged. What only the screen knows — which exercise is in front of
 * you, a running rest, what undo would take back — is held in memory across a
 * visit to another screen, and rebuilt from the record after a reload.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { WorkoutSession } from '@/types';
import type { SessionPlan } from '@/types/plan';
import { generateId } from '@/lib/utils';
import { putSession, update } from '@/store/useStore';
import type { StoreFailure, StoreResult } from '@/store/db';
import { planKey, restoreWorkout, resumed, startWorkout, toSession, workoutReducer, type WorkoutState } from './model';
import { findAlternative } from './alternatives';
import { finalise } from './finalise';
import { withWorkout } from './records';

export interface WorkoutInputs {
  plan: SessionPlan;
  /** The unfinished workout on the device to continue, if any. */
  active?: WorkoutSession;
  defaultRest: number;
  /** The day's plan with some exercises avoided: how the planner's alternatives are asked. */
  build: (avoid: string[]) => SessionPlan;
  /** A past day, written down now. */
  afterTheFact: boolean;
}

/**
 * The workout last on screen. It outlives the screen — a look at another tab
 * mid-rest keeps the rest running — but not a reload, which starts again from
 * the stored record.
 */
const memory: { live?: { key: string; state: WorkoutState } } = {};

/**
 * The workout this screen takes up. Either way a begun workout comes back as
 * a restart (`live` false): nothing here shows the exercise went on without a
 * break, so its next set asks the full readiness question (re-audit B03).
 */
function initial(inputs: WorkoutInputs): WorkoutState {
  const { live } = memory;
  if (inputs.active) {
    // Only ever the same record: one deleted elsewhere is not brought back.
    if (live?.state.id === inputs.active.id && live.state.begun && live.state.status === 'in_progress') return resumed(live.state);
    return restoreWorkout(inputs.active, inputs.plan, {
      defaultRest: inputs.defaultRest,
      afterTheFact: inputs.afterTheFact,
      alternativeFor: (slotId, planned, exerciseId) => findAlternative(inputs.build, slotId, planned, exerciseId),
    });
  }
  // A swap made before the first set survives a look elsewhere, for the same plan.
  if (live && !live.state.begun && live.key === planKey(inputs.plan)) return live.state;
  return startWorkout(inputs.plan, { id: generateId(), defaultRest: inputs.defaultRest, afterTheFact: inputs.afterTheFact });
}

export function useWorkout(inputs: WorkoutInputs) {
  const [state, dispatch] = useReducer(workoutReducer, inputs, initial);
  const [failure, setFailure] = useState<StoreFailure | null>(null);
  const written = useRef(state.revision);
  const writing = useRef<Promise<void>>(Promise.resolve());
  const key = planKey(inputs.plan);

  useEffect(() => {
    memory.live = { key, state };
  }, [key, state]);

  // A hidden page ends the sitting, as on a walk: coming back is a restart,
  // so the next set asks the full question again (M-04).
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') dispatch({ type: 'away' }); };
    const gone = () => dispatch({ type: 'away' });
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', gone);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', gone);
    };
  }, []);

  useEffect(() => {
    if (!state.begun || state.status !== 'in_progress' || state.revision === written.current) return;
    written.current = state.revision;
    // Each write is the whole record, so a write that fails is made good by
    // the next one that works; until then the failure is on screen.
    writing.current = putSession(toSession(state)).then(result => setFailure(result.ok ? null : result.failure));
  }, [state]);

  /**
   * Save the finished workout — the record, the personal records it feeds and
   * the ladder its checkpoints move — as one change. `finalise` makes it the
   * last word on the record (F06); a failure reopens the workout, and the
   * finish sheet says what went wrong.
   */
  const finish = useCallback(async (notes: string, activeMinutes: number | null): Promise<StoreResult<WorkoutSession>> => {
    const result = await finalise(state, { type: 'finish', now: Date.now(), notes, activeMinutes }, {
      pending: writing.current,
      commit: session => update(prev => withWorkout(prev, session)),
      dispatch,
    });
    if (result.ok) memory.live = undefined;
    return result;
  }, [state]);

  return { state, dispatch, failure, finish };
}
