import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDuration } from '@/lib/utils';
import type { SupersetGroup } from '@/types';

interface SupersetTimerState {
  activeGroup: SupersetGroup | null;
  currentExerciseIndex: number;
  isResting: boolean;
  restSeconds: number;
  isActive: boolean;
}

export function useSupersetTimer() {
  const [state, setState] = useState<SupersetTimerState>({
    activeGroup: null,
    currentExerciseIndex: 0,
    isResting: false,
    restSeconds: 0,
    isActive: false,
  });
  const intervalRef = useRef<number | null>(null);

  const startSuperset = useCallback((group: SupersetGroup) => {
    setState({
      activeGroup: group,
      currentExerciseIndex: 0,
      isResting: false,
      restSeconds: 0,
      isActive: true,
    });
  }, []);

  const completeSet = useCallback(() => {
    setState((prev) => {
      if (!prev.activeGroup || !prev.isActive) return prev;
      // Start rest timer before moving to next exercise
      return {
        ...prev,
        isResting: true,
        restSeconds: prev.activeGroup.restBetweenSeconds,
      };
    });
  }, []);

  const skipRest = useCallback(() => {
    setState((prev) => {
      if (!prev.activeGroup || !prev.isActive) return prev;
      const nextIndex = (prev.currentExerciseIndex + 1) % prev.activeGroup.exerciseIds.length;
      return {
        ...prev,
        isResting: false,
        restSeconds: 0,
        currentExerciseIndex: nextIndex,
      };
    });
  }, []);

  const endSuperset = useCallback(() => {
    setState({
      activeGroup: null,
      currentExerciseIndex: 0,
      isResting: false,
      restSeconds: 0,
      isActive: false,
    });
  }, []);

  // Countdown timer for rest periods
  useEffect(() => {
    if (state.isResting && state.restSeconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setState((prev) => {
          if (prev.restSeconds <= 1) {
            // Rest complete, advance to next exercise
            if (!prev.activeGroup) return { ...prev, isResting: false, restSeconds: 0 };
            const nextIndex = (prev.currentExerciseIndex + 1) % prev.activeGroup.exerciseIds.length;
            return {
              ...prev,
              isResting: false,
              restSeconds: 0,
              currentExerciseIndex: nextIndex,
            };
          }
          return { ...prev, restSeconds: prev.restSeconds - 1 };
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isResting, state.restSeconds]);

  const currentExerciseId = state.activeGroup?.exerciseIds[state.currentExerciseIndex] ?? null;
  const nextExerciseIndex = state.activeGroup
    ? (state.currentExerciseIndex + 1) % state.activeGroup.exerciseIds.length
    : 0;
  const nextExerciseId = state.activeGroup?.exerciseIds[nextExerciseIndex] ?? null;

  return {
    ...state,
    currentExerciseId,
    nextExerciseId,
    formatted: formatDuration(state.restSeconds),
    startSuperset,
    completeSet,
    skipRest,
    endSuperset,
  };
}
