import type { DayOfWeek, Difficulty } from './index';
import type { Meal } from './habits';
import type { AllergenId, EquipmentAccess, FoodPattern, PainArea, SessionMinutes, Side, VoiceSettings } from './profile';

/** The eight setup chapters, in order (journey §6.2). Plan 5 adds the pages and the setup state here. */
export const CHAPTER_IDS = ['welcome', 'about', 'health', 'medicines', 'backFeet', 'movement', 'food', 'day'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

// ---- Plan 5: the pages, the answers and setup's state ----------------------
// "Set up once" (journey §6): every answer as the person gave it. "Not sure"
// stays `'unsure'` here; `profileFrom` (src/setup/assemble.ts) is the one
// place that turns it into "may have" for the engine (§6.1, board D75).

/** Every page, in the order setup shows them. Each chapter shows only the ones that apply (§6.2). */
export const PAGE_IDS = [
  'welcome.start',
  'about.name', 'about.figure', 'about.body',
  'health.conditions', 'health.diabetes', 'health.bp', 'health.fluid', 'health.eyes', 'health.feet', 'health.limits',
  'medicines.regular', 'medicines.which', 'medicines.lows', 'medicines.ketones', 'medicines.standing', 'medicines.monitors',
  'backFeet.where', 'backFeet.side', 'backFeet.history',
  'movement.focus', 'movement.goal', 'movement.programme',
  'food.pattern', 'food.logging',
  'day.reminders', 'day.meals', 'day.voice',
  'review',
] as const;
export type PageId = (typeof PAGE_IDS)[number];

/** Yes, no, or "Not sure", which every safety rule reads as "may have" (§6.1). */
export type Tri = 'yes' | 'no' | 'unsure';

/** Chapter 3's chips (§6.2). `pain` is back pain, sciatica or other pain (board D77). */
export const CONDITION_IDS = ['diabetes', 'bp', 'heart', 'kidney', 'eyes', 'feet', 'pain', 'other'] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

/** Chapter 4's medicine classes, asked whatever the diagnosis (A-06, K-05). */
export const MEDICINE_CLASSES = ['insulin', 'lowsTablet', 'gliflozin', 'metformin', 'betaBlocker', 'diuretic', 'other'] as const;
export type MedicineClass = (typeof MEDICINE_CLASSES)[number];

/** The 12-week programme's Join flow (§6.2 ch. 6): the same answers wherever it's opened from (board D81). */
export interface JoinAnswers {
  experience: Difficulty;
  equipment: EquipmentAccess;
  days: DayOfWeek[];
  minutes: SessionMinutes;
  /** `YYYY-MM-DD`, today or later. */
  startDate: string;
}

export interface SetupAnswers {
  // ---- 2. About you
  name?: string;
  birthYear?: number;
  /** B-31: asked only when `birthYear` is this year minus 18. */
  adult?: boolean;
  figure?: 'male' | 'female' | 'either';
  /** cm and kg (true), or ft, in and lb; also the app's display unit (`settings.useMetric`). */
  metric?: boolean;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  // ---- 3. Your health
  /** A chip per condition. Rows left unticked become 'no' when the page is stored (`commitPage`). */
  conditions?: Partial<Record<ConditionId, Tri>>;
  diabetesType?: 'type1' | 'type2' | 'prediabetes' | 'other' | 'unsure';
  bpMedicine?: Tri;
  /** "Not sure" is read as dialysis or a transplant (K5-09, board D151). */
  kidneyTreatment?: Tri;
  fluidLimit?: Tri;
  /** "Not sure" is read as recent eye treatment (K5-09, board D151). */
  eyeTreatment?: Tri;
  eyeDisease?: 'mild' | 'moderate' | 'severe' | 'unsure';
  feetNumb?: Tri;
  /** "Not sure" is read as a wound now (K5-09, board D151). */
  footWound?: 'now' | 'past' | 'no' | 'unsure';
  clearance?: 'none' | 'moderate' | 'vigorous' | 'unsure';
  targets?: Tri;
  bpStopSystolic?: number;
  bpPermission?: { sys: number; dia: number };
  hba1cPercent?: number;
  // ---- 4. Your medicines
  regular?: Tri;
  /** A row per class. Rows left unticked become 'no' when the page is stored. */
  classes?: Partial<Record<MedicineClass, Tri>>;
  /** As typed; stored only once it reads as a year (the page's check). */
  metforminSince?: string;
  insulinHow?: 'basalOnly' | 'multipleDaily' | 'pump' | 'closedLoop' | 'unsure';
  lowsRisk?: Tri;
  glucoseStartMin?: number;
  glucoseStartUnit?: 'mg/dL' | 'mmol/L';
  priorDka?: Tri;
  ketoneTest?: 'none' | 'urine' | 'blood';
  dizzy?: Tri;
  glucoseMonitor?: 'none' | 'meter' | 'cgm';
  glucoseUnit?: 'mg/dL' | 'mmol/L';
  bpCuff?: boolean;
  // ---- 5. Your back and feet
  painAreas?: PainArea[];
  sciaticaSide?: Side;
  worseWith?: 'flexion' | 'extension' | 'unknown';
  /** Optional, and kept here only (board D77). */
  helps?: ('moving' | 'lying' | 'heat' | 'bendingForward' | 'archingBack')[];
  neuroHistory?: Tri;
  /** "Not sure" is read as a limit, which holds walking (K5-09, board D151). */
  footRestriction?: Tri;
  // ---- 6. Your movement
  focus?: 'stretch' | 'move' | 'strength' | 'explore';
  active?: 'yes' | 'no';
  weeklyGoal?: number | 'none';
  programme?: 'join' | 'notNow' | 'joined';
  join?: JoinAnswers;
  // ---- 7. Your food (the contract Plan 7 consumes, board D82)
  pattern?: FoodPattern;
  /** The chips' canonical ids. An empty list is "No food allergies". */
  allergies?: AllergenId[];
  /** "Something else", in the person's own words. */
  customAllergies?: string[];
  foodLevel?: 'ideas' | 'meals' | 'estimates';
  /** "Has food or weight ever been hard for you?", asked before estimates are stored (K-22), kept as `food.hardBefore` (D82). */
  hardBefore?: 'yes' | 'no' | 'preferNot';
  // ---- 8. Your day and coach
  water?: { on: boolean; glassMl: number; everyMinutes: number; from: string; to: string };
  sitting?: { on: boolean; everyMinutes: number; from: string; to: string };
  mealWalk?: { on: boolean; meals: Meal[] };
  /** When each walked-after meal usually finishes, `HH:MM` (`habits.mealWalk.finish`). */
  mealFinish?: Partial<Record<Meal, string>>;
  quiet?: { from: string; to: string } | 'none';
  delivery?: 'app' | 'calendar';
  voice?: Partial<VoiceSettings>;
  /** Pages answered with "Skip for now": their chapters wait in Me (§16). */
  skippedPages?: PageId[];
}

/**
 * What `settings.setup` holds. Every field may be missing: a v1 record holds
 * nothing, and one Plan 4 wrote holds only `declined`. `setupStateOf`
 * (src/setup/state.ts) reads it.
 */
export interface SetupRecord {
  /** 'open' while setup runs; 'lookAround' after "Look around first"; 'done' once finished (board D80). */
  stage?: 'open' | 'lookAround' | 'done';
  /** Unfinished setup: the page to resume on, and the answers so far (§6.1, §18.1). */
  draft?: { at?: PageId; answers?: SetupAnswers };
  /** Finished setup: the answers as given, for editing in Me with the same pages (§16). */
  answers?: SetupAnswers;
  /** When setup was finished here, ISO with offset. Absent for a record set up in v1. */
  completedAt?: string;
  /** Chapters skipped, or with questions new since v1: Me's "Finish setting up" lists them. */
  skipped?: ChapterId[];
  /** Chapters answered "Not now" in Me (Plan 4, D65). */
  declined?: ChapterId[];
  /** Set up in v1, before this build. */
  upgraded?: boolean;
  /** The one-time "FitStrong has a new Home" row was answered (§6.6). */
  newHomeSeen?: boolean;
}

/** Where setup stands, as `setupStateOf` reads it. */
export interface SetupState extends SetupRecord {
  stage: 'open' | 'lookAround' | 'done';
  skipped: ChapterId[];
}
