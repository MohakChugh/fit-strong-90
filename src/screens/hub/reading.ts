/**
 * The reading hubs (journey §8.2), for Glucose, Blood pressure, Weight,
 * Water, Sleep, Waist and Labs:
 * - Latest, with when it was measured and what it means;
 * - "Add reading", straight into that metric's own form;
 * - this week's values;
 * - every record, each opening where it is corrected.
 * Steps and Back & leg have their own hubs, on the same parts. Plain
 * functions over v1's tested pieces, so a hub only lays them out.
 */
import { entryFor, pairBloodPressure, summariseDay } from '@/health/aggregate';
import { compareObservations, isBpKind, type Observation, type ObservationKind, type ObservationTag } from '@/health/observation';
import type { UserProfile } from '@/types/profile';
import { glucoseFlag, pressureFlag } from '@/screens/track/escalation';
import {
  formatClock, formatDayLong, formatDayRelative, formatObservation, hasClockTime, inDisplayUnit, sourceLabel, tagLabel, type DisplayPrefs,
} from '@/screens/track/format';
import { parseAddParam, type AddRequest, type LabKind } from '@/screens/track/logKinds';
import { METRICS, type MetricId } from '@/screens/track/metrics';
import { addDays, weekOf } from '@/screens/track/periods';
import { clinicianOverrides, interpretGlucose, interpretPressure, type Interpretation } from '@/screens/track/targets';
import { formatPressure, type RecordRef } from '@/screens/track/timeline';
import type { GlucoseUnit } from '@/screens/track/units';

export type ReadingHubId = 'glucose' | 'bp' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs';

export interface ReadingSpec {
  id: ReadingHubId;
  /** v1's metric: its kinds, record rows, notes and trend. For Labs, the lab `?metric=` names. */
  metric: MetricId;
  /** The form "Add reading" opens (QuickLog's `initial`). */
  add: AddRequest;
  addLabel: string;
  /** "Add your first …", with why (journey §8.4, "Nothing recorded yet"). */
  first: string;
  why: string;
}

const SPECS: Record<ReadingHubId, Omit<ReadingSpec, 'id'>> = {
  glucose: { metric: 'glucose', add: { kind: 'glucose' }, addLabel: 'Add reading', first: 'Add your first glucose reading', why: 'Each reading shows here with when it was taken and what it means. A reading from today also counts in today’s check-in.' },
  bp: { metric: 'bloodPressure', add: { kind: 'bloodPressure' }, addLabel: 'Add reading', first: 'Add your first blood pressure reading', why: 'Readings show here with their time, so you and your clinician can see the pattern.' },
  weight: { metric: 'weight', add: { kind: 'weight' }, addLabel: 'Add reading', first: 'Add your first weight', why: 'Weight shows here with its date, and your BMI once your height is known.' },
  water: { metric: 'water', add: { kind: 'water' }, addLabel: 'Add water', first: 'Add water', why: 'Each glass adds to the day’s total.' },
  sleep: { metric: 'sleep', add: { kind: 'sleep' }, addLabel: 'Add sleep', first: 'Add last night’s sleep', why: 'Your best estimate is fine. Each night counts on the day you woke up.' },
  waist: { metric: 'waist', add: { kind: 'waist' }, addLabel: 'Add reading', first: 'Add your first waist measurement', why: 'Measurements show here with their date.' },
  labs: { metric: 'hba1c', add: { kind: 'lab', lab: 'hba1c' }, addLabel: 'Add a result', first: 'Add a result', why: 'Results show here with their test date, and when the next test is usually due.' },
};

/** Labs keeps its kind (B-14): `?metric=b12` or `vitaminD`, and HbA1c otherwise. */
export function labFrom(value: string | null | undefined): LabKind {
  if (value === 'b12') return 'b12';
  if (value === 'vitaminD' || value === 'vitd') return 'vitaminD';
  return 'hba1c';
}

/** The hub for `/hub/{id}`, or nothing for an id that is no reading hub here. */
export function readingSpec(id: string, metric?: string | null): ReadingSpec | undefined {
  if (!Object.hasOwn(SPECS, id)) return undefined;
  const hub = id as ReadingHubId;
  if (hub !== 'labs') return { id: hub, ...SPECS[hub] };
  const lab = labFrom(metric);
  return { id: hub, ...SPECS.labs, metric: lab, add: { kind: 'lab', lab } };
}

/** The form a link's `?add=` asks for on arrival (v1's parameter, `parseAddParam`): this hub's own, never another's. */
export function hubAdd(spec: ReadingSpec, add: string | null | undefined): AddRequest | undefined {
  const asked = parseAddParam(add);
  if (!asked || asked.kind !== spec.add.kind) return undefined;
  if (asked.kind === 'lab' && asked.lab !== undefined && asked.lab !== spec.add.lab) return undefined;
  return spec.add;
}

export interface Latest {
  /** "112 mg/dL", "132/84 mmHg", "1,500 ml". */
  value: string;
  /** "Today · 9:05 am", "Yesterday", or the long date. */
  when: string;
  /** "Fasting", "Morning". */
  context?: string;
  /** "Manual entry", "From your check-in". */
  source: string;
  /** The safety contract's word for it, never colour alone: "Low", "Very high". */
  flag?: string;
  /** v1's reading of this one value, with its framework. */
  reading?: Interpretation;
  /** The record behind it, where it is corrected. */
  ref: RecordRef;
}

const whenOf = (o: Pick<Observation, 'day' | 'at' | 'context' | 'kind'>, prefs: DisplayPrefs, current: string) =>
  `${formatDayRelative(o.day, current)}${hasClockTime(o) ? ` · ${formatClock(o.at, prefs.hour12)}` : ''}`;
const latestOf = (observations: readonly Observation[], kinds: readonly ObservationKind[]) =>
  observations.filter(o => kinds.includes(o.kind) && o.scope === 'pointInTime').sort(compareObservations).at(-1);

/** The latest value, as Latest shows it (journey §8.2, §4.10), or nothing yet. */
export function latestFor(
  spec: ReadingSpec, observations: readonly Observation[], { prefs, profile, current }: { prefs: DisplayPrefs; profile: UserProfile | undefined; current: string },
): Latest | undefined {
  const kinds = METRICS[spec.metric].kinds;
  if (spec.id === 'bp') {
    const r = pairBloodPressure(observations.filter(o => isBpKind(o.kind))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1);
    if (!r) return undefined;
    const first = r.halves[0];
    const severe = r.systolic !== null && r.diastolic !== null ? interpretPressure(r.systolic, r.diastolic) : undefined;
    const flag = pressureFlag(r.systolic, r.diastolic);
    return {
      value: formatPressure(r), when: whenOf({ ...first, at: r.at }, prefs, current), source: sourceLabel(first),
      ...(r.tag !== undefined ? { context: tagLabel(r.tag) } : {}), ...(flag ? { flag } : {}), ...(severe ? { reading: severe } : {}),
      ref: { type: 'pressure', id: r.id },
    };
  }
  if (spec.id === 'water' || spec.id === 'sleep') {
    const kind = kinds[0];
    const day = [...new Set(observations.filter(o => o.kind === kind && o.scope === 'dayTotal').map(o => o.day))].sort().at(-1);
    const e = day ? entryFor(summariseDay(day, observations), kind, 'dayTotal') : undefined;
    if (!e || e.total === null) return undefined;
    return {
      value: formatObservation({ kind, value: e.total, unit: e.unit ?? e.latest.unit }, prefs), when: formatDayRelative(e.latest.day, current),
      source: sourceLabel(e.latest), ref: { type: 'reading', id: e.latest.id },
    };
  }
  const o = latestOf(observations, kinds);
  if (!o) return undefined;
  const base: Latest = {
    value: formatObservation(o, prefs), when: whenOf(o, prefs, current), source: sourceLabel(o),
    ...(o.tag !== undefined ? { context: tagLabel(o.tag) } : {}), ref: { type: 'reading', id: o.id },
  };
  if (spec.id !== 'glucose') return base;
  const flag = glucoseFlag(o.value, o.unit as GlucoseUnit);
  const timing = { at: o.at, ...(o.mealStartedAt ? { mealStartedAt: o.mealStartedAt } : {}) };
  return { ...base, ...(flag ? { flag } : {}), reading: interpretGlucose(inDisplayUnit(o, prefs).value, prefs.glucose, o.tag, timing, clinicianOverrides(profile)) };
}

export interface WeekValue {
  day: string;
  /** "Monday". */
  name: string;
  /** "Monday, 5 October": the day its values were measured on. */
  date: string;
  /** The day's values in words, with their units, or "Not entered" (D14). */
  text: string;
  entered: boolean;
  /**
   * Glucose and blood pressure: every reading in full, each with when it was
   * measured and its context (journey §4.10), for the day's labelled detail
   * when `text` shows only the first two (codex H2-04).
   */
  readings?: string[];
}

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Two in full, then how many more: a day's line stays a line. Readings carry commas of their own, so semicolons set them apart. */
const someReadings = (parts: string[]) => (parts.length <= 2 ? parts.join('; ') : `${parts.slice(0, 2).join('; ')}; and ${parts.length - 2} more`);

/** One clinical reading as the week lists it: its value, when it was measured, and its context (§4.10). "132/84 mmHg at 7:30 am, morning". */
function measured(value: string, o: Pick<Observation, 'at' | 'context' | 'kind'>, tag: ObservationTag | undefined, prefs: DisplayPrefs): string {
  const at = hasClockTime(o) ? ` at ${formatClock(o.at, prefs.hour12)}` : '';
  return `${value}${at}${tag ? `, ${tagLabel(tag).toLowerCase()}` : ''}`;
}

/** This week, Monday to today, one line a day (journey §8.2). Labs have none: they are dated points (A-45). */
export function weekValues(spec: ReadingSpec, observations: readonly Observation[], prefs: DisplayPrefs, current: string): WeekValue[] {
  const { from } = weekOf(current);
  const kinds = METRICS[spec.metric].kinds;
  const out: WeekValue[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    if (day > current) break;
    const own = observations.filter(o => o.day === day && kinds.includes(o.kind));
    let text: string | undefined;
    let readings: string[] | undefined;
    if (spec.id === 'bp') {
      const pairs = pairBloodPressure(own).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      if (pairs.length) readings = pairs.map(r => measured(formatPressure(r), { ...r.halves[0], at: r.at }, r.tag, prefs));
    } else if (spec.id === 'water' || spec.id === 'sleep') {
      const e = entryFor(summariseDay(day, observations), kinds[0], 'dayTotal');
      if (e && e.total !== null) text = formatObservation({ kind: kinds[0], value: e.total, unit: e.unit ?? e.latest.unit }, prefs);
    } else if (spec.id === 'glucose') {
      const values = own.filter(o => o.scope === 'pointInTime').sort(compareObservations);
      if (values.length) readings = values.map(o => measured(formatObservation(o, prefs), o, o.tag, prefs));
    } else {
      const last = own.filter(o => o.scope === 'pointInTime').sort(compareObservations).at(-1);
      if (last) text = formatObservation(last, prefs);
    }
    if (readings) text = someReadings(readings);
    out.push({ day, name: NAMES[i], date: formatDayLong(day, current), text: text ?? 'Not entered', entered: text !== undefined, ...(readings ? { readings } : {}) });
  }
  return out;
}

/** Every day with a record of the hub's kinds, up to today: the range History lists (journey §8.2). */
export function historyRange(spec: Pick<ReadingSpec, 'metric'>, observations: readonly Observation[], current: string): { from: string; to: string } {
  const kinds = METRICS[spec.metric].kinds;
  let from = current;
  for (const o of observations) if (kinds.includes(o.kind) && o.day < from) from = o.day;
  return { from, to: current };
}
