/**
 * Manual (non-guided) tracking of today's generated plan: the Workout page
 * logs the same exercises and doses the guided session would run.
 */

import type { DayOfWeek, DayPlan, WorkoutExercise } from '@/types';
import type { DayFocus, LoadSuggestion, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { getStrength } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { focusMuscleGroup, weekFocus, WEEK } from '@/engine/templates';
import { formatWeight, getDayOfWeekFromDate } from '@/lib/utils';

/** The coach's load advice in words. */
export function loadAdvice(load: LoadSuggestion, useMetric: boolean): string {
  const w = load.kg === null ? '' : formatWeight(load.kg, useMetric);
  switch (load.note) {
    case 'bodyweight': return 'Bodyweight.';
    case 'firstTime': return 'First time: pick a weight you can move smoothly with reps to spare.';
    case 'same': return `Same weight as last time: ${w}.`;
    case 'increase': return `Add a little: ${w}.`;
    case 'decrease': return `Lighter today: ${w}.`;
  }
}

/** The plan's strength block in the shape the manual tracker uses. */
export function manualDayPlan(plan: SessionPlan, useMetric: boolean): DayPlan {
  return {
    dayOfWeek: getDayOfWeekFromDate(plan.date),
    muscleGroup: focusMuscleGroup(plan.focus),
    label: plan.label,
    isRestDay: plan.exercises.length === 0,
    exercises: plan.exercises.map(({ exerciseId, rx }): WorkoutExercise => {
      const seconds = rx.holdSeconds ?? rx.carrySeconds;
      const each = rx.sideOrder ? ' each side' : '';
      const dose = seconds ? `${seconds} s per set${each}.`
        : `${rx.reps[0] === rx.reps[1] ? rx.reps[0] : `${rx.reps[0]}–${rx.reps[1]}`} reps${each}.`;
      const ramp = rx.rampSets ? `Start with ${rx.rampSets} lighter warm-up set${rx.rampSets > 1 ? 's' : ''}.` : '';
      return {
        exerciseId,
        sets: rx.sets,
        reps: seconds ?? rx.targetReps,
        ...(seconds ? { unit: 'seconds' as const } : {}),
        restSeconds: rx.restSeconds,
        notes: [dose, ramp, loadAdvice(rx.load, useMetric), ...rx.caps].filter(Boolean).join(' '),
        difficulty: getStrength(exerciseId)?.level ?? 'beginner',
        targetMuscles: getCoaching(exerciseId)?.muscles.primary.slice(0, 3).map(m => m.toLowerCase()) ?? [],
      };
    }),
  };
}

/** Workouts the user can swap to: one per training day of their week, in week order. */
export function swapOptions(profile: Pick<UserProfile, 'trainingDays'>): { focus: DayFocus; day?: DayOfWeek }[] {
  const map = weekFocus(profile);
  const seen = new Set<DayFocus>();
  const options = WEEK.flatMap(day => {
    const focus = map[day];
    if (focus === 'rest' || focus === 'activeRecovery' || seen.has(focus)) return [];
    seen.add(focus);
    return [{ focus, day }];
  });
  return options.length ? options : (['fullA', 'fullB', 'fullC'] as const).map(focus => ({ focus }));
}
