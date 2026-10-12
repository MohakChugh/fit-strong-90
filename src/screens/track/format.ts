/**
 * How Track writes dates, times and values.
 *
 * A record's time is read from its own `at` string — the wall clock where it
 * was taken — not converted to wherever the phone is now. A reading at 07:42
 * in Pune still says 07:42 when read in London, which is the day and time the
 * person remembers.
 */

import { format } from 'date-fns';
import { nowAt, type Observation, type ObservationKind, type ObservationTag } from '@/health/observation';
import { formatTime } from '@/lib/time';
import { wholeMinutes } from './movement';
import { addDays, today } from './periods';
import { displayBoundaries } from './targets';
import {
  convert, decimalsFor, formatNumber, safeDecimals, type GlucoseUnit, type LengthUnit, type MassUnit,
} from './units';

/** The units this person reads in. Lab units follow their own lab's reports. */
export interface DisplayPrefs {
  glucose: GlucoseUnit;
  mass: MassUnit;
  length: LengthUnit;
  hba1c: '%' | 'mmol/mol';
  b12: 'pg/mL' | 'pmol/L';
  vitaminD: 'ng/mL' | 'nmol/L';
  /** 12-hour clock ("7:42 am") rather than 24-hour ("07:42"). */
  hour12: boolean;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  glucose: 'mg/dL', mass: 'kg', length: 'cm', hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL', hour12: false,
};

/** The unit a kind is shown in, given the person's preferences. */
export function displayUnitOf(kind: ObservationKind, prefs: DisplayPrefs, stored: string): string {
  switch (kind) {
    case 'glucose': return prefs.glucose;
    case 'weight': return prefs.mass;
    case 'waist': return prefs.length;
    case 'hba1c': return prefs.hba1c;
    case 'b12': return prefs.b12;
    case 'vitaminD': return prefs.vitaminD;
    default: return stored;
  }
}

/** A record's value in the display unit, unrounded. */
export function inDisplayUnit(o: Pick<Observation, 'kind' | 'value' | 'unit'>, prefs: DisplayPrefs): { value: number; unit: string } {
  const unit = displayUnitOf(o.kind, prefs, o.unit);
  return { value: convert(o.kind, o.value, o.unit, unit), unit };
}

/** How a unit is written after a number. */
export function unitLabel(unit: string): string {
  switch (unit) {
    case 'ml': return 'ml';
    case 'h': return 'h';
    case 'min': return 'min';
    case '0-10': return 'of 10';
    case '1-5': return 'of 5';
    default: return unit;
  }
}

/**
 * How many decimals a value is shown with: the unit's reading precision,
 * unless that would round it across a threshold it is judged against — then
 * as many more as it takes (53.9 mg/dL, never "54", the first value that is
 * not a serious low; acceptance J06).
 */
export function shownDecimals(value: number, kind: ObservationKind, unit: string): number {
  return safeDecimals(value, decimalsFor(kind, unit), displayBoundaries(kind, unit));
}

/** "112 mg/dL", "4 of 10", "7.5 h", "12,480 steps". */
export function formatValue(value: number, kind: ObservationKind, unit: string): string {
  const figure = formatNumber(value, shownDecimals(value, kind, unit));
  return unit === '%' ? `${figure}%` : `${figure} ${unitLabel(unit)}`;
}

/** A record's value as shown, in the display unit. */
export function formatObservation(o: Pick<Observation, 'kind' | 'value' | 'unit'>, prefs: DisplayPrefs): string {
  const { value, unit } = inDisplayUnit(o, prefs);
  return formatValue(value, o.kind, unit);
}

/** The wall-clock HH:mm inside an ISO instant, as written. */
export function wallClock(at: string): { hours: number; minutes: number } {
  return { hours: Number(at.slice(11, 13)), minutes: Number(at.slice(14, 16)) };
}

/** "07:42" or "7:42 am": the wall clock the reading was recorded in, written as the whole app writes times (J2-14). */
export function formatClock(at: string, hour12: boolean): string {
  const { hours, minutes } = wallClock(at);
  return formatTime(hours, minutes, hour12);
}

/** Any instant (including a UTC `Z` one from a session) as a local ISO string with offset. */
export function localAt(instant: string): string {
  return nowAt(new Date(instant));
}

function dateOf(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

/*
 * The day helpers take today's date as a string rather than reading the
 * clock, so a component can pass `useToday()` and render the same thing every
 * time it renders.
 */

/** "Thursday, 8 October", with the year only when it is not this year. */
export function formatDayLong(day: string, current: string = today()): string {
  const sameYear = day.slice(0, 4) === current.slice(0, 4);
  return format(dateOf(day), sameYear ? 'EEEE, d MMMM' : 'EEEE, d MMMM yyyy');
}

/** "8 Oct", or "8 Oct 2025" outside this year. */
export function formatDayShort(day: string, current: string = today()): string {
  const sameYear = day.slice(0, 4) === current.slice(0, 4);
  return format(dateOf(day), sameYear ? 'd MMM' : 'd MMM yyyy');
}

/** "Today", "Yesterday", or the long date. */
export function formatDayRelative(day: string, current: string = today()): string {
  if (day === current) return 'Today';
  if (day === addDays(current, -1)) return 'Yesterday';
  return formatDayLong(day, current);
}

const TAG_LABELS: Record<ObservationTag, string> = {
  fasting: 'Fasting',
  beforeMeal: 'Before a meal',
  afterMeal: 'After a meal',
  bedtime: 'At bedtime',
  beforeExercise: 'Before exercise',
  duringExercise: 'During exercise',
  afterExercise: 'After exercise',
  morning: 'Morning',
  evening: 'Evening',
  other: 'Other time',
};

export function tagLabel(tag: ObservationTag): string {
  return TAG_LABELS[tag];
}

/** Track's short noun for each kind; the registry's label is the formal one. */
const TITLES: Record<ObservationKind, string> = {
  glucose: 'Glucose',
  bloodPressureSystolic: 'Systolic',
  bloodPressureDiastolic: 'Diastolic',
  weight: 'Weight',
  waist: 'Waist',
  steps: 'Steps',
  walkDistance: 'Walking distance',
  walkDuration: 'Walking time',
  movementMinutes: 'Recorded movement',
  water: 'Water',
  sleep: 'Sleep',
  backPain: 'Back pain',
  legPain: 'Leg pain',
  mood: 'Mood',
  hba1c: 'HbA1c',
  b12: 'Vitamin B12',
  vitaminD: 'Vitamin D',
};

export function kindTitle(kind: ObservationKind): string {
  return TITLES[kind];
}

/** Lab results are dated, not timed: the clock time of a blood draw is not what a report says. */
export function isLabKind(kind: ObservationKind): boolean {
  return kind === 'hba1c' || kind === 'b12' || kind === 'vitaminD';
}

/**
 * Records whose clock time is a stand-in. v4 kept only dates, and a check-in
 * still does, so their readings are stored at midday (`atOnDay`) with a
 * context naming where they came from; showing "12:00" would state a time
 * nobody recorded. Both signs are required, so a reading the person really
 * took at noon keeps its time.
 */
export function hasClockTime(o: Pick<Observation, 'context' | 'kind' | 'at'>): boolean {
  if (isLabKind(o.kind)) return false;
  const c = o.context ?? '';
  const fromDateOnly = c.startsWith('checkIn:') || c.startsWith('bp:checkIn:') || c.startsWith('session:') || c.startsWith('bodyMetric:');
  return !(fromDateOnly && o.at.slice(11, 23) === '12:00:00.000');
}

/** Where a number came from, in words (the provenance label every record carries). */
export function sourceLabel(o: Pick<Observation, 'source' | 'context'> & Partial<Pick<Observation, 'scope'>>): string {
  const c = o.context ?? '';
  if (c.startsWith('checkIn:') || c.startsWith('bp:checkIn:')) return 'From your check-in';
  if (c.startsWith('session:')) return 'After a session';
  if (c.startsWith('walk:')) {
    if (o.source === 'measured') return 'Measured on a walk';
    // A pain rating given at the end of a walk, or time added to one for a gap.
    return o.scope === 'pointInTime' ? 'After a walk' : 'Added to a walk';
  }
  switch (o.source) {
    case 'manual': return 'Manual entry';
    case 'measured': return 'Measured';
    case 'imported': return 'Imported';
  }
}

/** "58 min", "1 h 5 min", "45 s" for a duration in seconds. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  // Rounded before choosing the unit, so 59.6 s reads "1 min", not "60 s".
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole} s`;
  // The one rule for movement minutes, as the weekly ring counts them (J2-10).
  const minutes = wholeMinutes(whole / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Whether this device writes times on a 12-hour clock: the app-wide rule, kept here for Track's callers. */
export { prefersHour12 } from '@/lib/time';

