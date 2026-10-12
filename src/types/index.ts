import type { UserProfile } from './profile';
import type { CheckInRecord, ClockHold } from './checkin';
import type { DayFocus } from './plan';
import type { HabitSettings } from './habits';
import type { SetupRecord } from './setup';
import type { RecordStore } from '@/store/records';

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

/** v2 (journey §5.1): the categories Home can show, by group. */
export type CategoryId =
  | 'workout' | 'stretch' | 'walk' | 'steps'
  | 'food'
  | 'glucose' | 'bp' | 'back' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs'
  | 'learn';
export type GroupId = 'move' | 'eat' | 'check' | 'learn';

/** v2: Home's tiles as the person arranged them. Absent until set up, when `defaultHome()` gives the first layout. */
export interface HomeLayout {
  /** Tiles shown, in order, per group. */
  order: Record<GroupId, CategoryId[]>;
  /** Tiles the person hid, so "Hidden" can offer them back. */
  hidden: CategoryId[];
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
  /** v5: "What would you most like to do?" (setup's Your movement). Not an identity; Home's suggestions use it as a default. */
  focus?: 'strength' | 'stretch' | 'move' | 'explore';
  /**
   * v5: the weekly recorded-movement goal the user chose, in minutes. Weekly,
   * not daily: a daily ring pushes people to overdo it on a day meant for rest
   * (board D31). WHO's 150 minutes is offered as a suggestion, never set for them.
   */
  weeklyMovementGoalMinutes?: number;
  /**
   * v2 (B-16): each change to the weekly goal and the Monday it took effect,
   * oldest first. `from: ''` is a goal v1 set before goals were dated: it
   * holds for every week before the first dated change. An entry with no
   * `goal` removed it.
   */
  weeklyMovementGoalHistory?: { from: string; goal?: number }[];
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
  /** v2: Home's tile layout (journey §7.6). The person's edits always win over the defaults. */
  home?: HomeLayout;
  /** v2 (journey §5.1): categories Me has offered for Home, added or "Not now", so none is offered twice. */
  homeOffered?: CategoryId[];
  /**
   * v2 (journey §6, §18.1): first run, "Set up once", and what Me's
   * "Finish setting up" was told (`declined`, Plan 4). Absent on a v1
   * record: `setupStateOf` reads its state from what v1 kept.
   */
  setup?: SetupRecord;
  /** v2 (journey §16 Display): the app's own settings, since Safari doesn't report Reduce Transparency and the system's motion setting isn't everyone's choice. */
  display?: {
    reduceMotion?: boolean;
    reduceTransparency?: boolean;
    /** v2: the app's own text size, one of TEXT_SCALES (src/lib/textSize.ts). */
    textScale?: number;
  };
  /**
   * v2 (journey §9.1, §18.1): this phone's own walk choices. Each starts
   * unasked and is asked once, on the first walk that needs it. An import
   * never switches either on (B-26).
   */
  walk?: {
    /** "Keep a record of your route on this phone?" */
    saveRoutes: boolean | 'unasked';
    /** "Show map pictures under your saved routes?" */
    map: 'on' | 'off' | 'unasked';
    /** The one-time card on how steps are counted has been shown (K-29, B-24). */
    stepCardSeen?: boolean;
    /**
     * B-05: "Erase all routes" on this phone. `generation` counts the erases,
     * and a walk keeps its route only if it began since the latest
     * (`WalkPlan.routeGen`), whatever the clock says; `walks` are the walks
     * whose routes it erased, by id, so no file brings one back. This
     * phone's own: an import or a Replace never changes it (H6R-08, K6R-12,
     * board D176). `before`: an erase made before board D176, which kept
     * only when it ran: every route of a walk begun by then is erased
     * (H6F-07, board D210).
     */
    erased?: { generation: number; walks: string[]; before?: number };
    /**
     * B-19: changes to this phone's clock, seen by a walk or the page.
     * `generation` counts them, and a reading acquired here carries the count
     * it was acquired in (`gen`). Until the current reading is one of the
     * latest generation, a reading from before the change on `days` can't be
     * timed, and every movement gate holds someone who can go low. This
     * phone's own: an import never brings it (board D174, D186).
     */
    clock?: ClockHold;
  };
  /**
   * The ids of readings and sessions deleted on this record, kept so that
   * merging a backup made before the deletion cannot bring them back (D-06).
   * Written by the store whenever it deletes, cleared when an id is written
   * again, and carried in a backup with the rest of the settings.
   */
  deleted?: {
    observations?: string[];
    sessions?: string[];
    /** Check-in readings deleted, as what was measured (`readingKey`), so no record names one back into the series (R5-01). */
    readings?: string[];
    /** The v2 record stores' deleted keys, by store (Plan 6 Task 1), kept for the same reason. */
    records?: Partial<Record<RecordStore, string[]>>;
  };
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
export type { ChapterId } from './setup';
export type { PageId, SetupAnswers, SetupRecord, SetupState, Tri } from './setup';
