/**
 * What the You screens say about the person's own settings, as plain lines.
 * Pure, so every sentence the screens show can be tested without a screen.
 */

import type { DayOfWeek } from '@/types';
import type { HabitSettings, Meal } from '@/types/habits';
import type { FoodPreferences, MedicineAnswer, UserProfile } from '@/types/profile';
import { KINDS, OBSERVATION_KINDS, isBpKind, isDay, type Observation, type ObservationKind } from '@/health/observation';
import { pairBloodPressure } from '@/health/aggregate';
import { kgToDisplay } from '@/lib/utils';
import { timeOf } from '@/lib/time';
import { answeredOnOpen, type WizardStep } from '@/components/profile/wizardSteps';
import { bpMedicinesAsked, bpMedicinesUnknown, deriveHealth, profileGaps } from '@/engine/health';
import { MEAL_LABEL } from '@/reminders/copy';
import { dailyTimes, inWindowOrder, type HabitId } from '@/reminders/schedule';
import { waterBlock } from '@/reminders/water';
import { movementBlock } from '@/reminders/advice';
import type { ImportPreview } from '@/store/transfer';
import { shortDay } from './dates';

/** Formats minutes after midnight for display, in the phone's own style. */
export type ClockFormat = (minute: number) => string;

export const clockFormat: ClockFormat = minute => timeOf(new Date(2026, 0, 1, 0, minute));

/** "and"-joined, the way a person lists things. */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

// ============================================================================
// Profile and health
// ============================================================================

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};
const WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const PAIN: Record<UserProfile['pain']['areas'][number], string> = {
  lowerBack: 'Lower back', sciatica: 'Sciatica', neck: 'Neck', shoulder: 'Shoulder',
  hip: 'Hip', knee: 'Knee', hamstring: 'Hamstring', calf: 'Calf',
};
const EQUIPMENT: Record<UserProfile['equipment'], string> = {
  fullGym: 'Full gym', homeDumbbells: 'Home, dumbbells', homeNone: 'Home, no equipment',
};
const EXPERIENCE: Record<UserProfile['experience'], string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
};
const DIABETES: Record<UserProfile['health']['diabetes'], string> = {
  none: 'None', prediabetes: 'Prediabetes', type1: 'Type 1', type2: 'Type 2', other: 'Other',
};
const BP: Record<UserProfile['health']['hypertension'], string> = {
  none: 'None', treated: 'Treated', untreated: 'Untreated', unsure: 'Not sure',
};
const WORSE: Record<UserProfile['pain']['worseWith'], string> = {
  flexion: 'Sitting or bending forward', extension: 'Standing, walking or arching back', unknown: 'Not sure',
};
const INSULIN: Record<UserProfile['health']['insulin'], string> = {
  none: 'None', injections_or_pump: 'Injections or pump', automated_delivery: 'Closed-loop system', unsure: 'Not sure',
};
const REGIMEN: Record<NonNullable<UserProfile['health']['insulinRegimen']>, string> = {
  basalOnly: 'long-acting only', multipleDaily: 'several times a day', pump: 'pump',
};
const MONITOR: Record<UserProfile['health']['glucoseMonitor'], string> = { none: 'None', meter: 'Meter', cgm: 'CGM' };
const CLEARANCE: Record<UserProfile['health']['clearance'], string> = {
  none: 'Not yet', moderate: 'For moderate exercise', vigorous: 'For vigorous exercise',
};
const KIDNEY: Record<UserProfile['health']['kidneyDisease'], string> = {
  none: '', ckd: 'Kidney disease', dialysis_or_transplant: 'Dialysis or transplant', unsure: 'Kidney disease, not sure',
};

const yes = (on: boolean) => (on ? 'Yes' : 'No');

/** A medicine answer as it was given. Unanswered says so rather than reading as "no". */
function answer(value: MedicineAnswer | undefined): string {
  if (value === undefined) return 'Not answered yet';
  return value === 'unsure' ? 'Not sure' : yes(value);
}

function diabetic(profile: UserProfile): boolean {
  return deriveHealth(profile.health).diabetic;
}

/**
 * Answers that need looking at again, as the health engine judges it: defaults
 * left by a migration, or diabetes medicines never actually answered. Until
 * they are, the safety check holds every session, so the screens say so.
 */
export function reviewNeeded(profile: UserProfile | undefined): 'health' | 'medicines' | 'sglt2' | undefined {
  if (!profile) return undefined;
  const gaps = profileGaps(profile);
  if (gaps.healthUnreviewed) return 'health';
  if (gaps.medicinesUnknown) return 'medicines';
  // Without diabetes, the SGLT2 question was never answered: its untouched
  // default No is not an answer (B08).
  if (!diabetic(profile) && !answeredOnOpen(profile.health).has('sglt2i')) return 'sglt2';
  return undefined;
}

/** What the review prompt says, by what needs reviewing. */
export const REVIEW_LABEL: Record<NonNullable<ReturnType<typeof reviewNeeded>>, string> = {
  health: 'Your health answers need a review',
  medicines: 'Medicines: not yet reviewed',
  sglt2: 'One medicine question to answer',
};

/** The conditions that shape the app, in one line, for the You list. */
export function conditionsLine(profile: UserProfile | undefined): string {
  if (!profile) return 'Not set up yet';
  const h = profile.health;
  const parts: string[] = [];
  if (h.diabetes === 'prediabetes') parts.push('Prediabetes');
  else if (h.diabetes === 'other') parts.push('Diabetes');
  else if (h.diabetes !== 'none') parts.push(`${DIABETES[h.diabetes]} diabetes`);
  if (h.hypertension === 'treated') parts.push('Blood pressure, treated');
  else if (h.hypertension === 'untreated') parts.push('High blood pressure');
  else if (h.hypertension === 'unsure') parts.push('Blood pressure, not sure');
  if (profile.pain.areas.includes('lowerBack')) parts.push('Lower back');
  if (profile.pain.areas.includes('sciatica')) {
    const side = profile.pain.sciaticaSide;
    parts.push(side === 'both' ? 'Sciatica, both legs' : `Sciatica, ${side ?? 'left'} leg`);
  }
  if (h.heartOrVascularDisease) parts.push('Heart or circulation');
  if (h.kidneyDisease !== 'none') parts.push(KIDNEY[h.kidneyDisease]);
  return parts.length > 0 ? parts.join(' · ') : 'No conditions recorded';
}

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummarySection {
  title: string;
  rows: SummaryRow[];
  /** The wizard step that edits this section. */
  step: WizardStep;
}

/**
 * The wizard's answers, grouped as the wizard asks them, for reading back.
 * Training answers belong to the 12-week programme: for someone not in it
 * they are defaults nobody chose, so they are not shown as if they were said.
 */
export function profileSections(
  profile: UserProfile,
  useMetric: boolean,
  { programme = true, startDate }: { programme?: boolean; startDate?: string } = {},
): SummarySection[] {
  const h = profile.health;
  const about: SummaryRow[] = [
    { label: 'Weight', value: profile.weightKg > 0 ? `${kgToDisplay(profile.weightKg, useMetric)} ${useMetric ? 'kg' : 'lb'}` : 'Not entered' },
    ...(profile.heightCm ? [{ label: 'Height', value: useMetric ? `${Math.round(profile.heightCm)} cm` : `${Math.round(profile.heightCm / 2.54)} in` }] : []),
    ...(profile.birthYear ? [{ label: 'Born', value: String(profile.birthYear) }] : []),
    ...(programme ? [{ label: 'Experience', value: EXPERIENCE[profile.experience] }] : []),
  ];

  const days = WEEK.filter(d => profile.trainingDays.includes(d)).map(d => DAY_SHORT[d]);
  const training: SummaryRow[] = [
    ...(startDate && isDay(startDate) ? [{ label: 'Started', value: shortDay(startDate) }] : []),
    { label: 'Training days', value: days.length > 0 ? days.join(', ') : 'None' },
    { label: 'Session length', value: `${profile.sessionMinutes} min` },
    { label: 'Where you train', value: EQUIPMENT[profile.equipment] },
  ];

  const areas = profile.pain.areas;
  const back = areas.includes('lowerBack') || areas.includes('sciatica');
  const body: SummaryRow[] = [
    { label: 'Pain or past injury', value: areas.length > 0 ? areas.map(a => PAIN[a]).join(', ') : 'None' },
    ...(areas.includes('sciatica') ? [{ label: 'Which leg', value: { left: 'Left', right: 'Right', both: 'Both' }[profile.pain.sciaticaSide ?? 'left'] }] : []),
    ...(back ? [{ label: 'Worse with', value: WORSE[profile.pain.worseWith] }] : []),
  ];

  const other = [
    h.heartOrVascularDisease && 'Heart or circulation',
    h.kidneyDisease !== 'none' && KIDNEY[h.kidneyDisease],
    h.dizzyOnStandingOrAutonomicNeuropathy && 'Dizzy when standing',
  ].filter((x): x is string => Boolean(x));

  // Until the medicines are reviewed, what is stored may be a default nobody
  // chose, so it is shown as unconfirmed rather than as a plain "no".
  const unconfirmed = profileGaps(profile).medicinesUnknown;
  const medicine = (value: string) => (unconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);
  // Answers saved before these questions were required are defaults, not
  // answers — with high blood pressure, and with heart or kidney disease (B08).
  const bpUnconfirmed = bpMedicinesUnknown(h);
  const bpMedicine = (value: string) => (bpUnconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);

  const FEET = { healthy: 'Healthy', past_ulcer_or_charcot: 'Past ulcer or Charcot', current_wound_or_active_charcot: 'Current wound' } as const;
  const RETINA = {
    none_or_mild: 'None or mild', moderate: 'Moderate', severe_or_proliferative: 'Severe', recent_eye_treatment: 'Recent eye treatment', unknown: 'Don’t know',
  } as const;
  const health: SummaryRow[] = [
    { label: 'Diabetes', value: DIABETES[h.diabetes] },
    ...(diabetic(profile)
      ? [
        { label: 'Insulin', value: medicine(h.insulinRegimen && h.insulin !== 'none' ? `${INSULIN[h.insulin]}, ${REGIMEN[h.insulinRegimen]}` : INSULIN[h.insulin]) },
        { label: 'Sulfonylurea or meglitinide', value: medicine(answer(h.sulfonylureaOrMeglitinide)) },
        { label: 'SGLT2 inhibitor', value: medicine(answer(h.sglt2i)) },
        { label: 'Metformin', value: medicine(h.metformin === true && h.metforminSince ? `Yes, since ${h.metforminSince}` : answer(h.metformin)) },
        ...(h.priorDkaOrInsulinDeficiency !== undefined ? [{ label: 'Ketoacidosis, or low insulin', value: medicine(answer(h.priorDkaOrInsulinDeficiency)) }] : []),
        { label: 'Glucose monitoring', value: MONITOR[h.glucoseMonitor] },
        { label: 'Nerve damage in your feet', value: { no: 'No', yes: 'Yes', unsure: 'Not sure' }[h.peripheralNeuropathy] },
        // These two stop vigorous effort, and standing and walking prompts, so they are read back too.
        { label: 'Your feet today', value: FEET[h.footStatus] },
        { label: 'Diabetic eye disease (retinopathy)', value: RETINA[h.retinopathy] },
      ]
      : []),
    { label: 'High blood pressure', value: BP[h.hypertension] },
    ...(bpMedicinesAsked(h)
      ? [
        { label: 'Beta-blocker', value: bpMedicine(answer(h.betaBlocker)) },
        { label: 'Diuretic or water pill', value: bpMedicine(answer(h.diuretic)) },
      ]
      : []),
    { label: 'Anything else', value: other.length > 0 ? other.join(', ') : 'None' },
    // Asked of everyone now: also prescribed for heart and kidney conditions.
    // An untouched default No reads as not answered (B08).
    ...(!diabetic(profile) ? [{ label: 'SGLT2 inhibitor', value: answeredOnOpen(h).has('sglt2i') ? answer(h.sglt2i) : 'Not answered yet' }] : []),
    { label: 'Fluid limit from your care team', value: answer(h.fluidRestriction) },
    { label: 'Cleared for exercise', value: CLEARANCE[h.clearance] },
  ];

  return [
    { title: 'About you', rows: about, step: 'about' as const },
    ...(programme ? [{ title: 'Training', rows: training, step: 'about' as const }] : []),
    { title: 'Back and legs', rows: body, step: 'body' as const },
    { title: 'Health', rows: health, step: 'health' as const },
  ];
}

// ============================================================================
// Food
// ============================================================================

export const FOOD_PATTERN: Record<FoodPreferences['pattern'], string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Vegetarian, with eggs',
  nonVegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
};

export const FOOD_REGION: Record<NonNullable<FoodPreferences['region']>, string> = {
  north: 'North Indian',
  south: 'South Indian',
  east: 'East Indian',
  west: 'West Indian',
  mixed: 'A mix',
};

export function foodLine(food: FoodPreferences | undefined): string {
  if (!food) return 'Not set';
  const avoid = food.avoid.length > 0 ? `leaves out ${listOf(food.avoid)}` : undefined;
  return [FOOD_PATTERN[food.pattern], avoid].filter(Boolean).join(' · ');
}

/** The longest a "leave out" entry may be, and how many there may be. */
export const AVOID_MAX_LENGTH = 60;
export const AVOID_MAX_ITEMS = 30;

/**
 * Add a food to leave out, as typed. Trimmed, never duplicated (case aside),
 * bounded in length and number. Returns the list unchanged when the entry adds
 * nothing, so a stray tap on Add is harmless.
 */
export function addAvoid(list: readonly string[], typed: string): string[] {
  const entry = typed.replace(/\s+/g, ' ').trim().slice(0, AVOID_MAX_LENGTH);
  if (!entry || list.length >= AVOID_MAX_ITEMS) return [...list];
  if (list.some(item => item.toLocaleLowerCase() === entry.toLocaleLowerCase())) return [...list];
  return [...list, entry];
}

// ============================================================================
// Habits
// ============================================================================

export function everyLabel(minutes: number): string {
  if (minutes === 60) return 'Every hour';
  if (minutes === 90) return 'Every 1½ hours';
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
  return `Every ${minutes} minutes`;
}

/** One line under a habit's row: when it reminds, or why it cannot. */
export function habitLine(habit: HabitId, habits: HabitSettings | undefined, profile: UserProfile | undefined, format: ClockFormat = clockFormat): string {
  const blocked = habit === 'water' ? waterBlock(profile, habits) : movementBlock(habit, profile);
  if (blocked) return blocked;
  const settings = habits?.[habit];
  if (!settings?.enabled) return 'Off';

  const times = dailyTimes(habits, profile).filter(t => t.habit === habit);
  if (times.length === 0) return 'On, but no reminder time is left outside quiet hours';

  if (habit === 'mealWalk') {
    return `After ${listOf(times.map(t => `${MEAL_LABEL[t.meal as Meal].toLowerCase()} (${format(t.minute)})`))}`;
  }
  const every = 'everyMinutes' in settings ? settings.everyMinutes : 0;
  if (times.length === 1) return `At ${format(times[0].minute)}`;
  // In the window's own order, which may cross midnight (D-11).
  const ordered = inWindowOrder(times.map(t => t.minute), 'from' in settings ? settings.from : undefined);
  return `${everyLabel(every)}, ${format(ordered[0])} to ${format(ordered[ordered.length - 1])}`;
}

/** The You list's line for every habit together. */
export function habitsLine(habits: HabitSettings | undefined, profile: UserProfile | undefined): string {
  const on = dailyTimes(habits, profile);
  const names: Record<HabitId, string> = { water: 'water', sittingBreak: 'sitting breaks', mealWalk: 'walks after meals' };
  const chosen = (['water', 'sittingBreak', 'mealWalk'] as const).filter(h => on.some(t => t.habit === h)).map(h => names[h]);
  if (chosen.length === 0) return 'All off';
  const line = listOf(chosen);
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// ============================================================================
// The record
// ============================================================================

export interface RecordCounts {
  /** A blood-pressure reading is one reading, though it is stored as two halves. */
  readings: number;
  sessions: number;
  checkIns: number;
  bodyMetrics: number;
  personalRecords: number;
}

export function recordCounts(state: {
  observations: Observation[];
  sessions: readonly unknown[];
  checkIns: readonly unknown[];
  bodyMetrics: readonly unknown[];
  personalRecords: readonly unknown[];
}): RecordCounts {
  return {
    readings: state.observations.filter(o => !isBpKind(o.kind)).length + pairBloodPressure(state.observations).length,
    sessions: state.sessions.length,
    checkIns: state.checkIns.length,
    bodyMetrics: state.bodyMetrics.length,
    personalRecords: state.personalRecords.length,
  };
}

/** "124 readings, 31 sessions and 40 check-ins" — only what there is. */
export function countsSentence(counts: RecordCounts): string {
  const parts = [
    counts.readings > 0 && plural(counts.readings, 'reading'),
    counts.sessions > 0 && plural(counts.sessions, 'session'),
    counts.checkIns > 0 && plural(counts.checkIns, 'check-in'),
    counts.bodyMetrics > 0 && plural(counts.bodyMetrics, 'body measurement'),
    counts.personalRecords > 0 && plural(counts.personalRecords, 'personal record'),
  ].filter((x): x is string => Boolean(x));
  return parts.length > 0 ? listOf(parts) : 'nothing yet';
}

export interface PreviewLine {
  label: string;
  count: number;
}

/**
 * What an import file holds, a line per kind. Blood pressure is one line of
 * readings rather than two lines of halves.
 */
export function previewLines(preview: ImportPreview): PreviewLine[] {
  const lines: PreviewLine[] = [];
  const count = (kind: ObservationKind) => preview.observations[kind] ?? 0;
  for (const kind of OBSERVATION_KINDS) {
    if (kind === 'bloodPressureDiastolic') continue;
    if (kind === 'bloodPressureSystolic') {
      lines.push({ label: 'Blood pressure', count: Math.max(count('bloodPressureSystolic'), count('bloodPressureDiastolic')) });
      continue;
    }
    lines.push({ label: KINDS[kind].label, count: count(kind) });
  }
  lines.push(
    { label: 'Sessions', count: preview.sessions },
    { label: 'Check-ins', count: preview.checkIns },
    { label: 'Body measurements', count: preview.bodyMetrics },
    { label: 'Personal records', count: preview.personalRecords },
  );
  return lines.filter(line => line.count > 0);
}
