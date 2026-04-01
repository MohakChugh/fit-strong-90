export type Phase = 'foundation' | 'hypertrophy' | 'strength';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type MuscleGroup = 'back' | 'chest' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'mobility';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'partial';
export type SetStatus = 'pending' | 'completed' | 'skipped';
export type WorkoutPhase = 'warmup' | 'main' | 'cooldown';

export interface WarmupCooldownEntry {
  exerciseId: string;
  completed: boolean;
  durationSeconds?: number; // for timed exercises like treadmill
}

export interface SupersetGroup {
  id: string;
  exerciseIds: string[];       // 2-3 exercises
  restBetweenSeconds: number;  // rest between exercises in group
  restAfterRoundSeconds: number; // rest after completing one round
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  instructions: string[];
  commonMistakes: string[];
  beginnerAlternative?: string;
  advancedAlternative?: string;
  youtubeSearchQuery: string;
  difficulty: Difficulty;
  category: MuscleGroup;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  plannedReps: number;
  actualReps: number | null;
  weight: number | null;
  status: SetStatus;
  rpe: number | null;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes: string;
  difficulty: Difficulty;
  targetMuscles: string[];
  phaseOverrides?: Partial<Record<Phase, { sets: number; reps: number }>>;
}

export interface DayPlan {
  dayOfWeek: DayOfWeek;
  muscleGroup: MuscleGroup;
  label: string;
  exercises: WorkoutExercise[];
  isRestDay: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  muscleGroup: MuscleGroup;
  phase: Phase;
  week: number;
  status: WorkoutStatus;
  sets: WorkoutSet[];
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  totalVolume: number;
  warmup?: WarmupCooldownEntry[];
  cooldown?: WarmupCooldownEntry[];
  supersetGroups?: SupersetGroup[];
}

export interface PersonalRecord {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string;
  volume: number;
}

export interface BodyMetric {
  date: string;
  weight: number | null;
  waist: number | null;
  notes: string;
}

export interface UserSettings {
  startDate: string;
  currentWeight: number;
  targetGoal: string;
  defaultRestSeconds: number;
  useMetric: boolean;
  theme: 'light' | 'dark' | 'system';
  onboardingComplete: boolean;
  gymDays: Record<DayOfWeek, MuscleGroup | 'rest'>;
  warmupEnabled?: boolean;
  cooldownEnabled?: boolean;
  defaultWarmupExercises?: string[];
  defaultCooldownExercises?: string[];
  supersetRestSeconds?: number;
}

export interface AppData {
  version: number;
  settings: UserSettings;
  sessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  personalRecords: PersonalRecord[];
}
