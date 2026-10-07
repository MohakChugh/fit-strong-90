import type { Exercise } from '@/types';
import type { CatalogMeta } from '@/types/catalog';
import { CATALOG, nameOf } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';

/**
 * The exercise list the Library, Workout, History and Progress pages read.
 * Derived from the catalogue (engine metadata) and the coaching records, so
 * there is one source of truth for every exercise, stretch and cardio protocol.
 */

/** Ids the pre-v3 library shipped with; stored history may reference any of them. */
export const LEGACY_IDS = [
  'lat-pulldown', 'seated-cable-row', 'one-arm-dumbbell-row', 'chest-supported-row', 'face-pull', 'deadlift',
  'rack-pull', 'machine-chest-press', 'dumbbell-bench-press', 'incline-dumbbell-press', 'cable-fly', 'push-ups',
  'assisted-dips', 'leg-press', 'goblet-squat', 'barbell-squat', 'romanian-deadlift', 'hip-thrust', 'hamstring-curl',
  'calf-raises', 'walking-lunges', 'machine-shoulder-press', 'dumbbell-shoulder-press', 'lateral-raises',
  'rear-delt-fly', 'face-pulls-shoulder', 'arnold-press', 'barbell-curl', 'incline-dumbbell-curl', 'hammer-curl',
  'rope-pushdown', 'overhead-tricep-extension', 'skull-crushers', 'plank', 'dead-bug', 'cable-crunch',
  'hanging-knee-raise', 'russian-twist', 'brisk-walking', 'treadmill-walk', 'stationary-bike', 'hip-opener-stretch',
  'hamstring-stretch', 'thoracic-opener', 'breathing-cooldown',
];

function toExercise(m: CatalogMeta): Exercise {
  // Retired duplicates (e.g. hip-opener-stretch) keep their id and name but show the replacement's coaching.
  const c = getCoaching(m.id);
  const easier = m.kind === 'strength' ? m.regressionId : m.kind === 'mobility' ? m.irritableSwap : undefined;
  const harder = m.kind === 'strength' ? m.progressionId : undefined;
  return {
    id: m.id,
    name: m.name,
    primaryMuscles: c?.muscles.primary ?? [],
    secondaryMuscles: c?.muscles.secondary ?? [],
    equipment: c?.equipment ?? '',
    instructions: c?.steps ?? [],
    tips: c?.cues ?? [],
    commonMistakes: c?.mistakes.map(x => x.mistake) ?? [],
    ...(easier ? { beginnerAlternative: nameOf(easier) } : {}),
    ...(harder ? { advancedAlternative: nameOf(harder) } : {}),
    youtubeSearchQuery: c?.youtube.tutorial ?? `${m.name} proper form`,
    difficulty: m.kind === 'strength' ? m.level : 'beginner',
    category: m.kind === 'strength' ? m.category : m.kind,
  };
}

const byId = new Map(CATALOG.map(m => [m.id, toExercise(m)]));

/** Every active exercise, stretch and cardio protocol (what the Library lists). */
export const exercises: Exercise[] = CATALOG.filter(m => !('retired' in m && m.retired)).map(m => byId.get(m.id)!);

/** Resolves active and retired ids, so old history entries keep their names. */
export const getExerciseById = (id: string): Exercise | undefined => byId.get(id);
