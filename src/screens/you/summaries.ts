/**
 * What the You screens say about the person's own settings, as plain lines.
 * Pure, so every sentence the screens show can be tested without a screen.
 */

import type { ChapterId, UserSettings } from '@/types';
import type { HabitSettings, Meal } from '@/types/habits';
import type { FoodPreferences, MedicineAnswer, UserProfile } from '@/types/profile';
import { KINDS, OBSERVATION_KINDS, isBpKind, isDay, type Observation, type ObservationKind } from '@/health/observation';
import { pairBloodPressure } from '@/health/aggregate';
import { kgToDisplay } from '@/lib/utils';
import { timeOf } from '@/lib/time';
import { answeredOnOpen } from '@/components/profile/wizardSteps';
import { bpMedicinesAsked, bpMedicinesUnknown, deriveHealth, profileGaps } from '@/engine/health';
import { MEAL_LABEL } from '@/reminders/copy';
import { dailyTimes, inWindowOrder, type HabitId } from '@/reminders/schedule';
import { waterBlock } from '@/reminders/water';
import { movementBlock } from '@/reminders/advice';
import type { StaleCopy } from '@/reminders/calendarNotice';
import type { ImportPreview } from '@/store/transfer';
import { isEnrolled } from '@/health/recommend';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { allergyName } from '@/setup/allergies';
import { answersOf, setupStateOf } from '@/setup/state';
import { shortDate, shortDay } from './dates';

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

const PAIN: Record<UserProfile['pain']['areas'][number], string> = {
  lowerBack: 'Lower back', sciatica: 'Sciatica', neck: 'Neck', shoulder: 'Shoulder',
  hip: 'Hip', knee: 'Knee', hamstring: 'Hamstring', calf: 'Calf',
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

const FEET: Record<UserProfile['health']['footStatus'], string> = {
  healthy: 'Healthy', past_ulcer_or_charcot: 'Past ulcer or Charcot', current_wound_or_active_charcot: 'Current wound',
};
const RETINA: Record<UserProfile['health']['retinopathy'], string> = {
  none_or_mild: 'None or mild', moderate: 'Moderate', severe_or_proliferative: 'Severe', recent_eye_treatment: 'Recent eye treatment', unknown: 'Don’t know',
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

/** B-24's privacy sentence, for this device. Plan 6 adds the one about map pictures when they arrive. */
export function privacyLine(device: string): string {
  return `Your records are stored on this ${device}. Backups and calendar files leave only when you share them.`;
}

const perDay = (n: number) => (n === 1 ? 'Once a day' : `${n} a day`);
const perDayInline = (n: number) => (n === 1 ? 'once a day' : `${n} a day`);

/** A calendar copy as Reminders lists it (A-78): its events' names, how many a day, when the file was added, and until when. */
export function copyLine(copy: { names: readonly string[]; events: number; at: string; until: string }): { title: string; detail: string } {
  return { title: copy.names.join(' and '), detail: `${perDay(copy.events)} · added ${shortDate(copy.at)} · until ${shortDay(copy.until)}` };
}

/** What changed, for each copy that may be out of date, in one paragraph. */
export function staleLine(stale: readonly StaleCopy[]): string {
  return stale.map(s => `${s.names.join(' and ')}: ${perDayInline(s.inCalendar)} in Calendar, ${s.now === 0 ? 'none now' : `${perDayInline(s.now)} now`}.`).join(' ');
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

// ============================================================================
// Food
// ============================================================================

export const FOOD_PATTERN: Record<FoodPreferences['pattern'], string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Vegetarian, with eggs',
  nonVegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
  jain: 'Jain',
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

// ============================================================================
// Profile & health, by setup chapter (journey §16; Plan 5)
// ============================================================================

const FIGURE = { male: 'Male figure', female: 'Female figure' } as const;
const KIDNEY_ANSWER: Record<UserProfile['health']['kidneyDisease'], string> = {
  none: 'No', ckd: 'Yes', dialysis_or_transplant: 'Dialysis or transplant', unsure: 'Not sure',
};
/**
 * The logging level, in Plan 7's own words (`LEVEL_LABEL`, src/food/copy.ts),
 * so Profile & health, Review and Me → Food say it alike. That module isn't on
 * this branch; once merged, this can be `LEVEL_LABEL` itself.
 */
const LEVEL: Record<NonNullable<FoodPreferences['level']>, string> = {
  ideas: 'Meal ideas only', meals: 'Meals only, no numbers', estimates: 'Meals with estimates',
};
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export interface ChapterSection {
  chapter: ChapterId;
  rows: SummaryRow[];
}

/** The allergies as the person gave them: the chips' names, then their own words (board D82). */
function allergiesLine(food: FoodPreferences | undefined): string {
  const given = [...(food?.allergies ?? []).map(allergyName), ...(food?.customAllergies ?? [])];
  if (given.length > 0) return given.join(', ');
  // An empty list is the answer "No food allergies"; no list was never asked.
  return food?.allergies ? 'None' : 'None given';
}

/**
 * Each setup chapter's answers, read back from the record the engine reads
 * (journey §16): Profile & health's groups and Review's cards. In v1's words
 * where v1 named them, so a row reads as it always has.
 */
export function chapterSections(profile: UserProfile, settings: UserSettings, today: string, format: ClockFormat = clockFormat): ChapterSection[] {
  const h = profile.health;
  const metric = settings.useMetric;
  // Until the medicines are reviewed, what is stored may be a default nobody chose (B08).
  const unconfirmed = profileGaps(profile).medicinesUnknown;
  const medicine = (value: string) => (unconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);
  const bpUnconfirmed = bpMedicinesUnknown(h);
  const bpMedicine = (value: string) => (bpUnconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);
  const inches = (cm: number) => Math.round(cm / 2.54);

  const about: SummaryRow[] = [
    { label: 'Name', value: profile.name ?? 'Not given' },
    ...(profile.birthYear ? [{ label: 'Born', value: String(profile.birthYear) }] : []),
    { label: 'Body for the exercise demos', value: profile.figure ? FIGURE[profile.figure] : 'Either' },
    { label: 'Height', value: !profile.heightCm ? 'Not entered' : metric ? `${Math.round(profile.heightCm)} cm` : `${Math.floor(inches(profile.heightCm) / 12)} ft ${inches(profile.heightCm) % 12} in` },
    { label: 'Weight', value: profile.weightKg > 0 ? `${kgToDisplay(profile.weightKg, metric)} ${metric ? 'kg' : 'lb'}` : 'Not entered' },
    ...(profile.waistCm ? [{ label: 'Waist', value: metric ? `${Math.round(profile.waistCm)} cm` : `${inches(profile.waistCm)} in` }] : []),
  ];

  const eyesOrFeet = diabetic(profile) || h.retinopathy !== 'none_or_mild' || h.footStatus !== 'healthy' || h.peripheralNeuropathy !== 'no';
  const health: SummaryRow[] = [
    { label: 'Diabetes', value: DIABETES[h.diabetes] },
    { label: 'High blood pressure', value: BP[h.hypertension] },
    { label: 'Heart or circulation', value: yes(h.heartOrVascularDisease) },
    { label: 'Kidney disease', value: KIDNEY_ANSWER[h.kidneyDisease] },
    { label: 'Fluid limit from your care team', value: answer(h.fluidRestriction) },
    ...(eyesOrFeet ? [
      { label: 'Diabetic eye disease (retinopathy)', value: RETINA[h.retinopathy] },
      { label: 'Nerve damage in your feet', value: { no: 'No', yes: 'Yes', unsure: 'Not sure' }[h.peripheralNeuropathy] },
      { label: 'Your feet today', value: FEET[h.footStatus] },
    ] : []),
    { label: 'Cleared for exercise', value: CLEARANCE[h.clearance] },
  ];

  const medicines: SummaryRow[] = [
    ...(diabetic(profile) ? [
      { label: 'Insulin', value: medicine(h.insulinRegimen && h.insulin !== 'none' ? `${INSULIN[h.insulin]}, ${REGIMEN[h.insulinRegimen]}` : INSULIN[h.insulin]) },
      { label: 'A tablet that can cause lows', value: medicine(answer(h.sulfonylureaOrMeglitinide)) },
    ] : []),
    // Asked of everyone: also prescribed for the heart and kidneys. An untouched default No reads as not answered (B08).
    { label: 'A “-gliflozin” medicine', value: diabetic(profile) ? medicine(answer(h.sglt2i)) : answeredOnOpen(h).has('sglt2i') ? answer(h.sglt2i) : 'Not answered yet' },
    ...(diabetic(profile) ? [
      { label: 'Metformin', value: medicine(h.metformin === true && h.metforminSince ? `Yes, since ${h.metforminSince}` : answer(h.metformin)) },
      ...(h.priorDkaOrInsulinDeficiency !== undefined ? [{ label: 'Ketoacidosis, or low insulin', value: medicine(answer(h.priorDkaOrInsulinDeficiency)) }] : []),
    ] : []),
    ...(bpMedicinesAsked(h) ? [
      { label: 'Beta-blocker', value: bpMedicine(answer(h.betaBlocker)) },
      { label: 'Water tablet (diuretic)', value: bpMedicine(answer(h.diuretic)) },
    ] : []),
    { label: 'Dizzy when you stand up', value: yes(h.dizzyOnStandingOrAutonomicNeuropathy) },
    { label: 'Glucose meter or sensor', value: MONITOR[h.glucoseMonitor] },
    { label: 'Home blood-pressure cuff', value: yes(h.bpMonitor) },
  ];

  const areas = profile.pain.areas;
  const back = areas.includes('lowerBack') || areas.includes('sciatica');
  const backFeet: SummaryRow[] = [
    { label: 'Pain or past injury', value: areas.length > 0 ? areas.map(a => PAIN[a]).join(', ') : 'None' },
    ...(areas.includes('sciatica') ? [{ label: 'Which leg', value: { left: 'Left', right: 'Right', both: 'Both' }[profile.pain.sciaticaSide ?? 'left'] }] : []),
    ...(back ? [{ label: 'Worse with', value: WORSE[profile.pain.worseWith] }] : []),
    ...(profile.pain.neuroHistory !== undefined ? [{ label: 'A nerve damaged in the past', value: answer(profile.pain.neuroHistory) }] : []),
  ];

  const goal = weeklyGoalOn(settings, today);
  const movement: SummaryRow[] = [
    { label: 'What you’d most like to do', value: FOCUS_CHOICES.find(f => f.value === settings.focus)?.label ?? 'Not chosen' },
    { label: 'Exercise now', value: yes(h.currentlyActive) },
    { label: 'Weekly goal', value: goal === undefined ? 'No goal' : `${goal} minutes a week` },
    { label: 'The 12-week programme', value: isEnrolled(settings, profile) && isDay(settings.startDate) ? `Joined, from ${shortDay(settings.startDate)}` : 'Not joined' },
  ];

  const food = profile.food;
  const foodRows: SummaryRow[] = [
    { label: 'What you eat', value: food ? FOOD_PATTERN[food.pattern] : 'Not chosen' },
    { label: 'Allergies', value: allergiesLine(food) },
    // A level chosen after the pattern was skipped waits in setup's own answers, until the pattern is answered (H5-20, D164).
    { label: 'Logging what you eat', value: LEVEL[food?.level ?? answersOf(setupStateOf(settings, profile)).foodLevel ?? 'ideas'] },
  ];

  const hb = settings.habits;
  const quiet = hb?.quietHours;
  const day: SummaryRow[] = [
    { label: 'Reminders', value: habitsLine(hb, profile) },
    { label: 'Quiet hours', value: quiet ? `${format(minutesOf(quiet.from))} to ${format(minutesOf(quiet.to))}` : 'None' },
    { label: 'Reminders come', value: hb?.inApp === false ? 'As a calendar file' : 'In the app' },
    { label: 'Voice coach', value: profile.voice.muted ? 'Off' : 'On' },
  ];

  return [
    { chapter: 'about', rows: about },
    { chapter: 'health', rows: health },
    { chapter: 'medicines', rows: medicines },
    { chapter: 'backFeet', rows: backFeet },
    { chapter: 'movement', rows: movement },
    { chapter: 'food', rows: foodRows },
    { chapter: 'day', rows: day },
  ];
}
