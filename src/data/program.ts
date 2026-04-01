import type { DayPlan, Phase, DayOfWeek, WorkoutExercise } from '@/types';

export const PHASES: {
  phase: Phase;
  name: string;
  weeks: [number, number];
  description: string;
  focus: string;
}[] = [
  {
    phase: 'foundation',
    name: 'Foundation',
    weeks: [1, 4],
    description: 'Build proper form and movement patterns',
    focus: 'Machine-supported, form-focused, moderate volume'
  },
  {
    phase: 'hypertrophy',
    name: 'Hypertrophy',
    weeks: [5, 8],
    description: 'Increase muscle size with progressive overload',
    focus: 'Moderate weight, higher reps, more free weights'
  },
  {
    phase: 'strength',
    name: 'Strength',
    weeks: [9, 12],
    description: 'Build maximal strength and power',
    focus: 'Heavier weights, lower reps, compound movements'
  },
];

export const weeklyPlan: DayPlan[] = [
  // MONDAY - BACK
  {
    dayOfWeek: 'monday',
    muscleGroup: 'back',
    label: 'Back Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'lat-pulldown',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Focus on squeezing shoulder blades together at the bottom',
        difficulty: 'beginner',
        targetMuscles: ['lats', 'upper back'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'seated-cable-row',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Keep torso upright, pull to lower abdomen',
        difficulty: 'beginner',
        targetMuscles: ['mid back', 'lats'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'one-arm-dumbbell-row',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Keep torso stable, avoid rotating',
        difficulty: 'intermediate',
        targetMuscles: ['lats', 'mid back'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'face-pull',
        sets: 3,
        reps: 15,
        restSeconds: 60,
        notes: 'Pull to face level, separate rope ends',
        difficulty: 'beginner',
        targetMuscles: ['rear delts', 'upper back'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'deadlift',
        sets: 3,
        reps: 8,
        restSeconds: 120,
        notes: 'Only in strength phase - focus on form',
        difficulty: 'advanced',
        targetMuscles: ['lower back', 'glutes', 'hamstrings'],
        phaseOverrides: {
          foundation: { sets: 0, reps: 0 }, // Skip in foundation
          hypertrophy: { sets: 3, reps: 8 },
          strength: { sets: 5, reps: 6 }
        }
      }
    ]
  },

  // TUESDAY - CHEST
  {
    dayOfWeek: 'tuesday',
    muscleGroup: 'chest',
    label: 'Chest Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'machine-chest-press',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Adjust seat for mid-chest alignment',
        difficulty: 'beginner',
        targetMuscles: ['chest', 'pectorals'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'dumbbell-bench-press',
        sets: 3,
        reps: 10,
        restSeconds: 90,
        notes: 'Control descent, press with power',
        difficulty: 'intermediate',
        targetMuscles: ['chest', 'pectorals'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 5, reps: 6 }
        }
      },
      {
        exerciseId: 'incline-dumbbell-press',
        sets: 3,
        reps: 10,
        restSeconds: 90,
        notes: 'Target upper chest, 30-45 degree angle',
        difficulty: 'intermediate',
        targetMuscles: ['upper chest'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'cable-fly',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Focus on chest stretch and squeeze',
        difficulty: 'intermediate',
        targetMuscles: ['chest', 'pectorals'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 3, reps: 10 }
        }
      },
      {
        exerciseId: 'push-ups',
        sets: 3,
        reps: 15,
        restSeconds: 60,
        notes: 'Finish with bodyweight burnout',
        difficulty: 'beginner',
        targetMuscles: ['chest', 'triceps'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 3, reps: 15 },
          strength: { sets: 3, reps: 20 }
        }
      }
    ]
  },

  // WEDNESDAY - LEGS
  {
    dayOfWeek: 'wednesday',
    muscleGroup: 'legs',
    label: 'Leg Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'leg-press',
        sets: 3,
        reps: 12,
        restSeconds: 120,
        notes: 'Control descent, press through heels',
        difficulty: 'beginner',
        targetMuscles: ['quads', 'glutes'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'goblet-squat',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Keep chest up, sit back into squat',
        difficulty: 'beginner',
        targetMuscles: ['quads', 'glutes'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 0, reps: 0 } // Replace with barbell squat
        }
      },
      {
        exerciseId: 'barbell-squat',
        sets: 4,
        reps: 8,
        restSeconds: 120,
        notes: 'Only in strength phase - prioritize form',
        difficulty: 'advanced',
        targetMuscles: ['quads', 'glutes'],
        phaseOverrides: {
          foundation: { sets: 0, reps: 0 },
          hypertrophy: { sets: 3, reps: 10 },
          strength: { sets: 5, reps: 6 }
        }
      },
      {
        exerciseId: 'romanian-deadlift',
        sets: 3,
        reps: 10,
        restSeconds: 90,
        notes: 'Feel stretch in hamstrings, keep back flat',
        difficulty: 'intermediate',
        targetMuscles: ['hamstrings', 'glutes'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'hip-thrust',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Squeeze glutes hard at top',
        difficulty: 'intermediate',
        targetMuscles: ['glutes'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'hamstring-curl',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Control the weight, avoid swinging',
        difficulty: 'beginner',
        targetMuscles: ['hamstrings'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 3, reps: 10 }
        }
      },
      {
        exerciseId: 'calf-raises',
        sets: 3,
        reps: 15,
        restSeconds: 60,
        notes: 'Full range of motion, pause at top',
        difficulty: 'beginner',
        targetMuscles: ['calves'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 20 },
          hypertrophy: { sets: 4, reps: 15 },
          strength: { sets: 4, reps: 12 }
        }
      }
    ]
  },

  // THURSDAY - SHOULDERS
  {
    dayOfWeek: 'thursday',
    muscleGroup: 'shoulders',
    label: 'Shoulder Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'machine-shoulder-press',
        sets: 3,
        reps: 12,
        restSeconds: 90,
        notes: 'Adjust seat for proper shoulder alignment',
        difficulty: 'beginner',
        targetMuscles: ['front delts', 'middle delts'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'dumbbell-shoulder-press',
        sets: 3,
        reps: 10,
        restSeconds: 90,
        notes: 'Press up and slightly together',
        difficulty: 'intermediate',
        targetMuscles: ['front delts', 'middle delts'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 5, reps: 6 }
        }
      },
      {
        exerciseId: 'lateral-raises',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Control weight, avoid swinging',
        difficulty: 'beginner',
        targetMuscles: ['middle delts'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'rear-delt-fly',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Focus on rear delts, squeeze shoulder blades',
        difficulty: 'intermediate',
        targetMuscles: ['rear delts'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'face-pulls-shoulder',
        sets: 3,
        reps: 15,
        restSeconds: 60,
        notes: 'External rotation at end, high rep finisher',
        difficulty: 'beginner',
        targetMuscles: ['rear delts', 'upper back'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 3, reps: 15 },
          strength: { sets: 3, reps: 12 }
        }
      }
    ]
  },

  // FRIDAY - ARMS
  {
    dayOfWeek: 'friday',
    muscleGroup: 'arms',
    label: 'Arm Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'barbell-curl',
        sets: 3,
        reps: 10,
        restSeconds: 75,
        notes: 'Keep elbows stationary, avoid swinging',
        difficulty: 'beginner',
        targetMuscles: ['biceps'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'rope-pushdown',
        sets: 3,
        reps: 12,
        restSeconds: 75,
        notes: 'Separate rope at bottom, squeeze triceps',
        difficulty: 'beginner',
        targetMuscles: ['triceps'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'incline-dumbbell-curl',
        sets: 3,
        reps: 10,
        restSeconds: 75,
        notes: 'Full stretch at bottom, control weight',
        difficulty: 'intermediate',
        targetMuscles: ['biceps'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      },
      {
        exerciseId: 'overhead-tricep-extension',
        sets: 3,
        reps: 12,
        restSeconds: 75,
        notes: 'Keep elbows close to head',
        difficulty: 'intermediate',
        targetMuscles: ['triceps'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 12 },
          strength: { sets: 4, reps: 10 }
        }
      },
      {
        exerciseId: 'hammer-curl',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Neutral grip throughout, target brachialis',
        difficulty: 'beginner',
        targetMuscles: ['biceps', 'brachialis'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 12 },
          hypertrophy: { sets: 4, reps: 10 },
          strength: { sets: 3, reps: 10 }
        }
      },
      {
        exerciseId: 'skull-crushers',
        sets: 3,
        reps: 10,
        restSeconds: 75,
        notes: 'Only hypertrophy and strength phases',
        difficulty: 'advanced',
        targetMuscles: ['triceps'],
        phaseOverrides: {
          foundation: { sets: 0, reps: 0 },
          hypertrophy: { sets: 3, reps: 10 },
          strength: { sets: 4, reps: 8 }
        }
      }
    ]
  },

  // SATURDAY - CORE + CARDIO
  {
    dayOfWeek: 'saturday',
    muscleGroup: 'core',
    label: 'Core & Cardio Day',
    isRestDay: false,
    exercises: [
      {
        exerciseId: 'plank',
        sets: 3,
        reps: 60, // seconds
        restSeconds: 60,
        notes: 'Hold for time - reps represent seconds',
        difficulty: 'beginner',
        targetMuscles: ['core', 'abs'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 45 },
          hypertrophy: { sets: 3, reps: 60 },
          strength: { sets: 4, reps: 75 }
        }
      },
      {
        exerciseId: 'dead-bug',
        sets: 3,
        reps: 12,
        restSeconds: 60,
        notes: 'Each rep is one full cycle (both sides)',
        difficulty: 'beginner',
        targetMuscles: ['core', 'abs'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 10 },
          hypertrophy: { sets: 3, reps: 12 },
          strength: { sets: 3, reps: 15 }
        }
      },
      {
        exerciseId: 'cable-crunch',
        sets: 3,
        reps: 15,
        restSeconds: 60,
        notes: 'Crunch with abs, not hip flexors',
        difficulty: 'intermediate',
        targetMuscles: ['abs'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 15 },
          hypertrophy: { sets: 4, reps: 15 },
          strength: { sets: 4, reps: 12 }
        }
      },
      {
        exerciseId: 'hanging-knee-raise',
        sets: 3,
        reps: 10,
        restSeconds: 75,
        notes: 'Control movement, avoid swinging',
        difficulty: 'intermediate',
        targetMuscles: ['lower abs'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 8 },
          hypertrophy: { sets: 3, reps: 10 },
          strength: { sets: 3, reps: 12 }
        }
      },
      {
        exerciseId: 'russian-twist',
        sets: 3,
        reps: 20,
        restSeconds: 60,
        notes: 'Each rep is one full cycle (both sides)',
        difficulty: 'intermediate',
        targetMuscles: ['obliques'],
        phaseOverrides: {
          foundation: { sets: 3, reps: 20 },
          hypertrophy: { sets: 3, reps: 25 },
          strength: { sets: 3, reps: 30 }
        }
      },
      {
        exerciseId: 'brisk-walking',
        sets: 1,
        reps: 20, // minutes
        restSeconds: 0,
        notes: 'Cardio finisher - 20-30 minutes',
        difficulty: 'beginner',
        targetMuscles: ['cardiovascular'],
        phaseOverrides: {
          foundation: { sets: 1, reps: 20 },
          hypertrophy: { sets: 1, reps: 25 },
          strength: { sets: 1, reps: 30 }
        }
      }
    ]
  },

  // SUNDAY - REST
  {
    dayOfWeek: 'sunday',
    muscleGroup: 'mobility',
    label: 'Rest & Recovery',
    isRestDay: true,
    exercises: [
      {
        exerciseId: 'hip-opener-stretch',
        sets: 2,
        reps: 30, // seconds per side
        restSeconds: 0,
        notes: 'Optional recovery stretches',
        difficulty: 'beginner',
        targetMuscles: ['hip flexors', 'glutes'],
        phaseOverrides: {
          foundation: { sets: 2, reps: 30 },
          hypertrophy: { sets: 2, reps: 30 },
          strength: { sets: 2, reps: 30 }
        }
      },
      {
        exerciseId: 'hamstring-stretch',
        sets: 2,
        reps: 30,
        restSeconds: 0,
        notes: 'Optional recovery stretches',
        difficulty: 'beginner',
        targetMuscles: ['hamstrings'],
        phaseOverrides: {
          foundation: { sets: 2, reps: 30 },
          hypertrophy: { sets: 2, reps: 30 },
          strength: { sets: 2, reps: 30 }
        }
      },
      {
        exerciseId: 'thoracic-opener',
        sets: 2,
        reps: 30,
        restSeconds: 0,
        notes: 'Optional recovery stretches',
        difficulty: 'beginner',
        targetMuscles: ['upper back', 'chest'],
        phaseOverrides: {
          foundation: { sets: 2, reps: 30 },
          hypertrophy: { sets: 2, reps: 30 },
          strength: { sets: 2, reps: 30 }
        }
      },
      {
        exerciseId: 'breathing-cooldown',
        sets: 1,
        reps: 5, // minutes
        restSeconds: 0,
        notes: 'Optional recovery breathing',
        difficulty: 'beginner',
        targetMuscles: ['respiratory'],
        phaseOverrides: {
          foundation: { sets: 1, reps: 5 },
          hypertrophy: { sets: 1, reps: 5 },
          strength: { sets: 1, reps: 5 }
        }
      }
    ]
  }
];

/**
 * Get all non-rest day plans (for swap workout picker)
 */
export const getTrainingDays = (): DayPlan[] => {
  return weeklyPlan.filter(day => !day.isRestDay);
};

/**
 * Get a day plan by muscle group (for workout swaps)
 */
export const getDayPlanByMuscleGroup = (muscleGroup: string): DayPlan | undefined => {
  return weeklyPlan.find(day => day.muscleGroup === muscleGroup && !day.isRestDay);
};

/**
 * Get the day plan for a specific day of week
 */
export const getDayPlan = (dayOfWeek: DayOfWeek): DayPlan => {
  const plan = weeklyPlan.find(day => day.dayOfWeek === dayOfWeek);
  if (!plan) {
    throw new Error(`No plan found for ${dayOfWeek}`);
  }
  return plan;
};

/**
 * Get the current phase based on week number (1-12)
 */
export const getPhaseForWeek = (week: number): Phase => {
  if (week < 1 || week > 12) {
    throw new Error('Week must be between 1 and 12');
  }

  if (week <= 4) return 'foundation';
  if (week <= 8) return 'hypertrophy';
  return 'strength';
};

/**
 * Get the sets and reps for an exercise in a specific phase
 */
export const getExerciseSetsAndReps = (
  exercise: WorkoutExercise,
  phase: Phase
): { sets: number; reps: number } => {
  // Check if there are phase overrides
  if (exercise.phaseOverrides && exercise.phaseOverrides[phase]) {
    const override = exercise.phaseOverrides[phase];
    return {
      sets: override.sets,
      reps: override.reps
    };
  }

  // Return default values
  return {
    sets: exercise.sets,
    reps: exercise.reps
  };
};

/**
 * Get all exercises for a day plan in a specific phase, filtering out exercises with 0 sets
 */
export const getActiveExercisesForPhase = (
  dayPlan: DayPlan,
  phase: Phase
): WorkoutExercise[] => {
  return dayPlan.exercises.filter(exercise => {
    const { sets } = getExerciseSetsAndReps(exercise, phase);
    return sets > 0;
  });
};

/**
 * Get phase info for a week number
 */
export const getPhaseInfo = (week: number) => {
  const phase = getPhaseForWeek(week);
  return PHASES.find(p => p.phase === phase);
};

/**
 * Calculate which week of the program a date falls into based on start date
 */
export const getWeekNumber = (startDate: string, currentDate: string): number => {
  const start = new Date(startDate);
  const current = new Date(currentDate);
  const diffTime = Math.abs(current.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.ceil(diffDays / 7);
  return Math.min(Math.max(week, 1), 12); // Clamp between 1 and 12
};

/**
 * Get day of week from date string
 */
export const getDayOfWeekFromDate = (dateString: string): DayOfWeek => {
  const date = new Date(dateString);
  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
};
