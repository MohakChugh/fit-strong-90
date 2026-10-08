import type { UserProfile } from './profile';
import type { CheckInRecord } from './checkin';
import type { DayFocus } from './plan';
import type { HabitSettings } from './habits';

export type Phase = 'foundation' | 'hypertrophy' | 'strength';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type MuscleGroup =
  | 'back' | 'chest' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'mobility'
  // Guided-plan day types (movement-pattern split)
  | 'upper' | 'lower' | 'fullBody';
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
  /** Short cues spoken during the set or hold. */
  tips?: string[];
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
  /** v5: what `actualReps` counts — seconds for a hold or a carry. Absent on older records, which meant reps. */
  unit?: 'reps' | 'seconds';
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes: string;
  difficulty: Difficulty;
  targetMuscles: string[];
  /** What `reps` counts: reps (default) or seconds for holds and carries. */
  unit?: 'reps' | 'seconds';
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
  /** Per-exercise notes, keyed by exerciseId */
  exerciseNotes?: Record<string, string>;
  /** Guided-session fields (absent for manually logged workouts). */
  guided?: boolean;
  focus?: DayFocus;
  planId?: string;
  /**
   * v5: which kind of guided plan this was. A stretch is recorded like any
   * guided session but never counts as the day's programme workout. Absent on
   * older records, which were all programme sessions.
   */
  planKind?: 'full' | 'recovery' | 'restDay' | 'stretch';
  mobility?: { exerciseId: string; seconds: number }[];
  cardio?: { modality: string; minutes: number; format: string };
  checkIn?: CheckInRecord;
  /** Back or leg pain after the session, 0–10. */
  painAfter?: number;
  /** Answers to in-session symptom checkpoints, keyed by exercise id. */
  symptomChecks?: Record<string, 'better' | 'same' | 'worse'>;
  durationSeconds?: number;
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
  /** v5: the first-run answer to "What would you like more of?". Not an identity; Today uses it as a default. */
  focus?: 'strength' | 'stretch' | 'move' | 'explore';
  /**
   * v5: the weekly recorded-movement goal the user chose, in minutes. Weekly,
   * not daily: a daily ring pushes people to overdo it on a day meant for rest
   * (board D31). WHO's 150 minutes is offered as a suggestion, never set for them.
   */
  weeklyMovementGoalMinutes?: number;
  /**
   * v5: the daily steps goal the user chose, if any. No default and no floor:
   * the goal is theirs (board D27, as revised). Changing it never re-scores a
   * past day, which is read against `dailyStepsGoalHistory`.
   */
  dailyStepsGoal?: number;
  /** Each change to the daily steps goal and the day it took effect, oldest first. An entry with no `goal` removed it. */
  dailyStepsGoalHistory?: { from: string; goal?: number }[];
  /** v5: reminders and habit prompts the user opted into. */
  habits?: HabitSettings;
  /**
   * v5: dated periods that were not a normal day (board D25). An open period
   * (no `to`) is the current status; none open means Normal. Kept, not
   * overwritten, so those days stay out of consistency figures afterwards.
   */
  statusPeriods?: StatusPeriod[];
  /** v5: the walk options last chosen, so GPS and step counting are not asked for every time. */
  walkDefaults?: { gps: boolean; steps: boolean };
  /**
   * The ids of readings and sessions deleted on this record, kept so that
   * merging a backup made before the deletion cannot bring them back (D-06).
   * Written by the store whenever it deletes, cleared when an id is written
   * again, and carried in a backup with the rest of the settings.
   */
  deleted?: { observations?: string[]; sessions?: string[] };
}

export interface StatusPeriod {
  kind: 'flare' | 'unwell' | 'away';
  /** YYYY-MM-DD, local. */
  from: string;
  /** YYYY-MM-DD, local, inclusive. Absent while the period is still going. */
  to?: string;
  /** Once answered: whether the plan was moved back for this period, so the offer is made only once. */
  planShift?: 'moved' | 'kept';
}

export interface AppData {
  version: number;
  settings: UserSettings;
  sessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  personalRecords: PersonalRecord[];
  /** v3: guided-training profile (absent until onboarding or migration). */
  profile?: UserProfile;
  /** v3: daily check-ins with the readiness the app computed. */
  checkIns?: CheckInRecord[];
  /** Workouts swapped in on the Workout page, by date (YYYY-MM-DD). No key means the scheduled focus. */
  focusOverrides?: Record<string, DayFocus>;
}

export type { UserProfile } from './profile';
export type { HabitSettings } from './habits';
export type { CheckInRecord, DailyCheckIn, Readiness } from './checkin';
