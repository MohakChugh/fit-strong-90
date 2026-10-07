import { useReducer, useCallback, useEffect } from 'react';
import { formatDuration } from '@/lib/utils';
import type { SupersetGroup } from '@/types';
import { countdown, secondsLeft, startCountdown, tickCountdown, type Countdown } from './useTimer';

export interface SupersetState {
  activeGroup: SupersetGroup | null;
  currentExerciseIndex: number;
  /** The rest before the next exercise, while one is running. */
  rest: Countdown | null;
}

export type SupersetAction =
  | { type: 'start'; group: SupersetGroup }
  | { type: 'completeSet'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'skipRest' }
  | { type: 'end' };

export const SUPERSET_IDLE: SupersetState = { activeGroup: null, currentExerciseIndex: 0, rest: null };

/** On to the next exercise, back to the first after the last. */
function advance(state: SupersetState): SupersetState {
  if (!state.activeGroup) return state;
  return { ...state, rest: null, currentExerciseIndex: (state.currentExerciseIndex + 1) % state.activeGroup.exerciseIds.length };
}

export function supersetReducer(state: SupersetState, action: SupersetAction): SupersetState {
  switch (action.type) {
    case 'start':
      return { ...SUPERSET_IDLE, activeGroup: action.group };
    case 'end':
      return SUPERSET_IDLE;
    case 'skipRest':
      return advance(state);
    case 'completeSet': {
      const group = state.activeGroup;
      if (!group) return state;
      // Finishing the last exercise of a round earns the after-round rest.
      const roundDone = (state.currentExerciseIndex + 1) % group.exerciseIds.length === 0;
      const seconds = roundDone ? group.restAfterRoundSeconds : group.restBetweenSeconds;
      return seconds > 0 ? { ...state, rest: startCountdown(countdown(seconds), action.now) } : advance(state);
    }
    case 'tick': {
      if (!state.rest) return state;
      const rest = tickCountdown(state.rest, action.now);
      if (rest.endsAt === null) return advance(state);
      return rest === state.rest ? state : { ...state, rest };
    }
  }
}

export function useSupersetTimer() {
  const [state, dispatch] = useReducer(supersetReducer, SUPERSET_IDLE);
  const isResting = state.rest !== null;

  const startSuperset = useCallback((group: SupersetGroup) => dispatch({ type: 'start', group }), []);
  const completeSet = useCallback(() => dispatch({ type: 'completeSet', now: Date.now() }), []);
  const skipRest = useCallback(() => dispatch({ type: 'skipRest' }), []);
  const endSuperset = useCallback(() => dispatch({ type: 'end' }), []);

  // Countdown for rest periods, from the clock (see `Countdown`).
  useEffect(() => {
    if (!isResting) return;
    const tick = () => dispatch({ type: 'tick', now: Date.now() });
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isResting]);

  const group = state.activeGroup;
  const restSeconds = state.rest ? secondsLeft(state.rest.leftMs) : 0;
  const currentExerciseId = group?.exerciseIds[state.currentExerciseIndex] ?? null;
  const nextExerciseIndex = group ? (state.currentExerciseIndex + 1) % group.exerciseIds.length : 0;
  const nextExerciseId = group?.exerciseIds[nextExerciseIndex] ?? null;

  return {
    activeGroup: group,
    currentExerciseIndex: state.currentExerciseIndex,
    isActive: group !== null,
    isResting,
    restSeconds,
    currentExerciseId,
    nextExerciseId,
    formatted: formatDuration(restSeconds),
    startSuperset,
    completeSet,
    skipRest,
    endSuperset,
  };
}
