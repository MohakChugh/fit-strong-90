/**
 * Quick Log's decisions: what can be logged, in what order for this person,
 * what a `?add=` link asks for, and how a typed time becomes an instant.
 */

import { atOnDay, compareStatements, isAt, isDay, nowAt, type ObservationKind, type ObservationTag } from '@/health/observation';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { Observation } from '@/health/observation';
import { prefersHour12, type DisplayPrefs } from './format';
import { labUnit } from './metrics';
import { addDays } from './periods';
import type { GlucoseUnit } from './units';

export type LogKind = 'glucose' | 'bloodPressure' | 'weight' | 'water' | 'steps' | 'sleep' | 'backLeg' | 'waist' | 'lab';
export type LabKind = 'hba1c' | 'b12' | 'vitaminD';

export interface LogOption {
  kind: LogKind;
  title: string;
  /** What it records, in a few words. */
  detail: string;
}

export const LOG_OPTIONS: Record<LogKind, LogOption> = {
  glucose: { kind: 'glucose', title: 'Glucose', detail: 'A meter or sensor reading' },
  bloodPressure: { kind: 'bloodPressure', title: 'Blood pressure', detail: 'One or two readings' },
  backLeg: { kind: 'backLeg', title: 'Back & leg pain', detail: 'How it feels now, 0 to 10' },
  weight: { kind: 'weight', title: 'Weight', detail: 'From your scale' },
  water: { kind: 'water', title: 'Water', detail: 'Add a glass to the day' },
  steps: { kind: 'steps', title: 'Steps', detail: 'The day’s total from your phone' },
  sleep: { kind: 'sleep', title: 'Sleep', detail: 'Hours slept last night' },
  waist: { kind: 'waist', title: 'Waist', detail: 'A tape measurement' },
  lab: { kind: 'lab', title: 'Lab result', detail: 'HbA1c, vitamin B12 or vitamin D' },
};

export const LAB_OPTIONS: readonly { kind: LabKind; title: string }[] = [
  { kind: 'hba1c', title: 'HbA1c' },
  { kind: 'b12', title: 'Vitamin B12' },
  { kind: 'vitaminD', title: 'Vitamin D' },
];

const DEFAULT_ORDER: readonly LogKind[] = ['glucose', 'bloodPressure', 'backLeg', 'weight', 'water', 'steps', 'sleep', 'waist', 'lab'];

/**
 * The list, with what this person's profile makes likely first: glucose for
 * diabetes, blood pressure for hypertension or a home monitor, back and leg
 * for a back or sciatica history. Everything else keeps its usual order.
 */
export function logOrder(profile: UserProfile | undefined): LogKind[] {
  if (!profile) return [...DEFAULT_ORDER];
  const h = profile.health;
  const likely = new Set<LogKind>();
  if (h.diabetes !== 'none') likely.add('glucose');
  if (h.hypertension !== 'none' || h.bpMonitor) likely.add('bloodPressure');
  if (profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica')) likely.add('backLeg');
  return [...DEFAULT_ORDER.filter(k => likely.has(k)), ...DEFAULT_ORDER.filter(k => !likely.has(k))];
}

export interface AddRequest {
  kind: LogKind;
  lab?: LabKind;
}

/**
 * Read `?add=`. Accepts the log kinds, the lab names, and any stored kind name
 * (`bloodPressureSystolic`, `backPain`…), so Today can link with whichever it
 * holds. Anything else opens nothing rather than the wrong form.
 */
export function parseAddParam(value: string | null | undefined): AddRequest | undefined {
  if (!value) return undefined;
  if (Object.hasOwn(LOG_OPTIONS, value)) return { kind: value as LogKind };
  switch (value) {
    case 'hba1c':
    case 'b12':
    case 'vitaminD':
      return { kind: 'lab', lab: value };
    case 'bloodPressureSystolic':
    case 'bloodPressureDiastolic':
      return { kind: 'bloodPressure' };
    case 'backPain':
    case 'legPain':
      return { kind: 'backLeg' };
    default:
      return undefined;
  }
}

/** The stored kind a log form writes, for the forms that write one. */
export function storedKind(kind: LogKind, lab?: LabKind): ObservationKind | undefined {
  switch (kind) {
    case 'glucose':
    case 'weight':
    case 'water':
    case 'steps':
    case 'sleep':
    case 'waist':
      return kind;
    case 'lab':
      return lab;
    default:
      return undefined;
  }
}

/** When a glucose reading was taken. Offered in the order a day runs. */
export const GLUCOSE_WHEN: readonly { tag: ObservationTag; label: string }[] = [
  { tag: 'fasting', label: 'Fasting' },
  { tag: 'beforeMeal', label: 'Before a meal' },
  { tag: 'afterMeal', label: 'After a meal' },
  { tag: 'bedtime', label: 'Bedtime' },
  { tag: 'beforeExercise', label: 'Before exercise' },
  { tag: 'duringExercise', label: 'During exercise' },
  { tag: 'afterExercise', label: 'After exercise' },
];

/** How a person should read each glucose timing. Measurement technique, not a target. */
export const GLUCOSE_WHEN_HINT: Partial<Record<ObservationTag, string>> = {
  fasting: 'Fasting means nothing to eat or drink but water for at least 8 hours.',
  afterMeal: 'After-meal readings are usually taken 1 to 2 hours after the first bite.',
};

export const PRESSURE_WHEN: readonly { tag: 'morning' | 'evening'; label: string }[] = [
  { tag: 'morning', label: 'Morning' },
  { tag: 'evening', label: 'Evening' },
];

/**
 * The instant a meal started, from the clock time typed: the latest moment at
 * that time that is not after the reading. A reading at 00:30 after a meal at
 * 23:15 belongs to a meal the evening before. Uses the reading's own offset.
 */
export function mealStart(readingAt: string, clock: string): string | undefined {
  if (!isAt(readingAt) || !/^\d{2}:\d{2}$/.test(clock)) return undefined;
  const offset = /(Z|[+-]\d{2}:\d{2})$/.exec(readingAt)?.[1] ?? 'Z';
  const sameDay = `${readingAt.slice(0, 10)}T${clock}:00.000${offset}`;
  if (!isAt(sameDay)) return undefined;
  if (Date.parse(sameDay) <= Date.parse(readingAt)) return sameDay;
  const dayBefore = `${addDays(readingAt.slice(0, 10), -1)}T${clock}:00.000${offset}`;
  return isAt(dayBefore) ? dayBefore : undefined;
}

/** The value a `datetime-local` input shows for an instant: its own wall clock. */
export function toLocalInput(at: string): string {
  return at.slice(0, 16);
}

/**
 * The instant a `datetime-local` value names, on this device's clock. A
 * malformed value (or one the browser could not parse) is undefined, never
 * a guess at what was meant.
 */
export function fromLocalInput(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  const at = nowAt(date);
  // `Date` rolls 30 February into March, and a clock time skipped by a
  // daylight-saving change into the next hour. Either way the instant would
  // not be the time typed, so it is refused rather than moved.
  return isAt(at) && at.slice(0, 16) === value ? at : undefined;
}

/** A small allowance for the clock ticking while the form was open. */
const FUTURE_SLACK_MS = 60_000;

export function isInFuture(at: string, now: Date = new Date()): boolean {
  return Date.parse(at) > now.getTime() + FUTURE_SLACK_MS;
}

/** The glucose unit a new reading starts in: the profile's, else mg/dL, the usual unit in India. */
export function defaultGlucoseUnit(profile: UserProfile | undefined): GlucoseUnit {
  return profile?.health.glucoseUnit ?? 'mg/dL';
}

/** The display units for this person: their glucose unit, metric or not, and their labs' own units. */
export function displayPrefs(
  settings: Pick<UserSettings, 'useMetric'>,
  profile: UserProfile | undefined,
  observations: readonly Observation[],
  hour12: boolean = prefersHour12(),
): DisplayPrefs {
  return {
    glucose: defaultGlucoseUnit(profile),
    mass: settings.useMetric === false ? 'lb' : 'kg',
    length: settings.useMetric === false ? 'in' : 'cm',
    hba1c: labUnit<DisplayPrefs['hba1c']>('hba1c', observations, '%'),
    b12: labUnit<DisplayPrefs['b12']>('b12', observations, 'pg/mL'),
    vitaminD: labUnit<DisplayPrefs['vitaminD']>('vitaminD', observations, 'ng/mL'),
    hour12,
  };
}

/** The glass size for "+1 glass": the person's own, from their water habit, or 250 ml. */
export function glassMl(settings: Pick<UserSettings, 'habits'>): number {
  const own = settings.habits?.water?.glassMl;
  return typeof own === 'number' && own > 0 ? own : 250;
}

export type Resolved = { ok: true; at: string } | { ok: false; message: string };

/**
 * The instant a form's time row stands for: now when untouched, the typed
 * moment otherwise — refused if it is not a real time or is in the future.
 */
export function resolveTime(value: string | undefined, now: Date = new Date()): Resolved {
  if (value === undefined) return { ok: true, at: nowAt(now) };
  const at = fromLocalInput(value);
  if (!at) return { ok: false, message: 'Check the time: that date and time do not exist.' };
  if (isInFuture(at, now)) return { ok: false, message: 'That time is in the future. Choose a time that has passed.' };
  return { ok: true, at };
}

/**
 * A corrected time, read in the clock the reading was recorded in. The edit
 * field shows the reading's own wall time (`toLocalInput`), so a change is
 * read in that same offset — not the device's, which after travel or a
 * restore elsewhere would move the moment by hours (F13). A time that does
 * not exist, or lies in the future, is refused.
 */
export function resolveEditedTime(value: string, original: string, now: Date = new Date()): Resolved {
  const zone = /(Z|[+-]\d{2}:\d{2})$/.exec(original)?.[1];
  if (!zone || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { ok: false, message: 'Check the time: that date and time do not exist.' };
  const at = `${value}:00.000${zone}`;
  const ms = Date.parse(at);
  const offset = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  // 30 February parses as 2 March: the wall time read back must be the one typed.
  if (!isAt(at) || !Number.isFinite(ms) || new Date(ms + offset * 60_000).toISOString().slice(0, 16) !== value) {
    return { ok: false, message: 'Check the time: that date and time do not exist.' };
  }
  if (isInFuture(at, now)) return { ok: false, message: 'That time is in the future. Choose a time that has passed.' };
  return { ok: true, at };
}

export type RepeatTimes = { ok: true; first: string; second: string } | { ok: false; which: 1 | 2; message: string };

/**
 * The times of a blood-pressure reading and its repeat (F23). Each is the time
 * the person typed — kept as typed, for a pair entered afterwards — or, left at
 * Now, when it was entered: the first when the person moved on to the second
 * (`firstEntered`), the second when Save is tapped — or, for a pair kept from
 * a save that did not go through, when Save was first tapped (`secondEntered`).
 * They are never both the Save moment, and no interval between them is invented.
 */
export function repeatTimes(
  { first, firstEntered, second, secondEntered }: { first?: string; firstEntered?: string; second?: string; secondEntered?: string },
  now: Date = new Date(),
): RepeatTimes {
  const one = first !== undefined ? resolveTime(first, now) : { ok: true as const, at: firstEntered ?? nowAt(now) };
  if (!one.ok) return { ok: false, which: 1, message: one.message };
  const two = second !== undefined ? resolveTime(second, now) : { ok: true as const, at: secondEntered ?? nowAt(now) };
  if (!two.ok) return { ok: false, which: 2, message: two.message };
  return { ok: true, first: one.at, second: two.at };
}

export type ResolvedDay = { ok: true; day: string } | { ok: false; message: string };

/** The day a form's day row stands for: today when untouched; never the future. */
export function resolveDay(value: string | undefined, current: string): ResolvedDay {
  if (value === undefined) return { ok: true, day: current };
  if (!isDay(value)) return { ok: false, message: 'Check the date.' };
  if (value > current) return { ok: false, message: 'That day is in the future. Choose today or a day before.' };
  return { ok: true, day: value };
}

/**
 * How to state a new day total. Today, a new statement at this moment replaces
 * the earlier one by being later (D10). For a past day, a new statement would
 * be stamped at that day's midday and could sort *before* an entry made later
 * that day, so it would not count; correcting that day's own manual total
 * instead marks it edited now, which is what makes it the current statement.
 */
export type DayTotalWrite =
  | { action: 'add'; at: string }
  | { action: 'edit'; id: string };

export function dayTotalWrite(
  kind: ObservationKind,
  day: string,
  observations: readonly Observation[],
  current: string,
  now: Date = new Date(),
): DayTotalWrite {
  if (day === current) return { action: 'add', at: nowAt(now) };
  const own = observations.filter(o => o.kind === kind && o.day === day && o.scope === 'dayTotal' && o.source === 'manual');
  if (own.length > 0) {
    const latest = [...own].sort(compareStatements).at(-1)!;
    return { action: 'edit', id: latest.id };
  }
  return { action: 'add', at: atOnDay(day) };
}
