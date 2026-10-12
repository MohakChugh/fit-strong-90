/**
 * The measures Track can show over time, and how each one is charted.
 *
 * A metric is what a person thinks of as one thing — "blood pressure" — which
 * may be stored as more than one observation kind. Charts get one slot per
 * day, plus one per extra reading on a day that has several, so a day with
 * nothing recorded still takes its space and shows as a gap (D14).
 */

import { format } from 'date-fns';
import type { ChartPoint } from '@/components/hig/Chart';
import { pairBloodPressure, series, type DayRange } from '@/health/aggregate';
import { compareObservations, isObservationKind, type Observation, type ObservationKind } from '@/health/observation';
import type { HabitSettings } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { walkRecords, type WalkRecord } from '@/walk/record';
import { glucoseFlag, pressureFlag } from './escalation';
import {
  formatClock, formatDayShort, formatObservation, hasClockTime, inDisplayUnit, kindTitle, shownDecimals, sourceLabel, tagLabel,
  type DisplayPrefs,
} from './format';
import { daysIn, today } from './periods';
import {
  BMI_FRAMEWORKS_NOTE, HBA1C_CADENCE, HBA1C_CADENCE_SOURCE, STEPS_NOTE, ageForTargets, bmiOf, clinicianOverrides, interpretB12, interpretBmi,
  interpretHba1c, interpretVitaminD, pressureReference, waistFrameworksNote, waistNote, waterNote, type GlucoseGroup, type Interpretation,
} from './targets';
import { formatPressure, type RecordRef } from './timeline';
import { convert, roundTo, type GlucoseUnit } from './units';

export type MetricId =
  | 'glucose'
  | 'bloodPressure'
  | 'backLeg'
  | 'weight'
  | 'waist'
  | 'water'
  | 'steps'
  | 'sleep'
  | 'hba1c'
  | 'b12'
  | 'vitaminD'
  | 'walking'
  | 'mood';

export type ChartKind = 'line' | 'bar' | 'pressure' | 'backLeg';

export interface MetricSpec {
  id: MetricId;
  title: string;
  kinds: readonly ObservationKind[];
  chart: ChartKind;
}

export const METRICS: Record<MetricId, MetricSpec> = {
  glucose: { id: 'glucose', title: 'Glucose', kinds: ['glucose'], chart: 'line' },
  bloodPressure: { id: 'bloodPressure', title: 'Blood pressure', kinds: ['bloodPressureSystolic', 'bloodPressureDiastolic'], chart: 'pressure' },
  backLeg: { id: 'backLeg', title: 'Back & leg', kinds: ['backPain', 'legPain'], chart: 'backLeg' },
  weight: { id: 'weight', title: 'Weight', kinds: ['weight'], chart: 'line' },
  waist: { id: 'waist', title: 'Waist', kinds: ['waist'], chart: 'line' },
  water: { id: 'water', title: 'Water', kinds: ['water'], chart: 'bar' },
  steps: { id: 'steps', title: 'Steps', kinds: ['steps'], chart: 'bar' },
  sleep: { id: 'sleep', title: 'Sleep', kinds: ['sleep'], chart: 'bar' },
  hba1c: { id: 'hba1c', title: 'HbA1c', kinds: ['hba1c'], chart: 'line' },
  b12: { id: 'b12', title: 'Vitamin B12', kinds: ['b12'], chart: 'line' },
  vitaminD: { id: 'vitaminD', title: 'Vitamin D', kinds: ['vitaminD'], chart: 'line' },
  walking: { id: 'walking', title: 'Walking', kinds: ['walkDuration'], chart: 'bar' },
  mood: { id: 'mood', title: 'Mood', kinds: ['mood'], chart: 'line' },
};

/** The order metrics are listed in, most often needed first for this audience. */
export const METRIC_ORDER: readonly MetricId[] = [
  'glucose', 'bloodPressure', 'backLeg', 'weight', 'waist', 'steps', 'walking', 'water', 'sleep', 'hba1c', 'b12', 'vitaminD', 'mood',
];

/** Which metric a stored kind belongs to. `movementMinutes` has none: it is counted by the week on My Day. */
export function metricOfKind(kind: ObservationKind): MetricId | undefined {
  switch (kind) {
    case 'bloodPressureSystolic':
    case 'bloodPressureDiastolic':
      return 'bloodPressure';
    case 'backPain':
    case 'legPain':
      return 'backLeg';
    case 'walkDuration':
    case 'walkDistance':
      return 'walking';
    case 'movementMinutes':
      return undefined;
    default:
      return kind;
  }
}

/**
 * Read a `/track/metric/:kind` parameter. Takes a metric id or any stored
 * kind name, so a link from elsewhere can use whichever it has.
 */
export function metricFromParam(param: string | undefined): MetricId | undefined {
  if (!param) return undefined;
  if (Object.hasOwn(METRICS, param)) return param as MetricId;
  return isObservationKind(param) ? metricOfKind(param) : undefined;
}

export function metricPath(id: MetricId): string {
  return id === 'backLeg' ? '/track/back' : `/track/metric/${id}`;
}

/** Profile facts that make a metric worth listing before there is any data for it. */
export function profileMetrics(profile: UserProfile | undefined): MetricId[] {
  if (!profile) return [];
  const h = profile.health;
  const out: MetricId[] = [];
  if (h.diabetes !== 'none') out.push('glucose');
  if (h.hypertension !== 'none' || h.bpMonitor) out.push('bloodPressure');
  if (profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica')) out.push('backLeg');
  return out;
}

/** The metrics this person tracks: any with data, plus the ones their profile makes relevant. */
export function trackedMetrics(observations: readonly Observation[], profile: UserProfile | undefined): MetricId[] {
  const present = new Set<MetricId>(profileMetrics(profile));
  for (const o of observations) {
    const m = metricOfKind(o.kind);
    if (m) present.add(m);
  }
  return METRIC_ORDER.filter(id => present.has(id));
}

/** A point on a chart with the instant behind it, before labels are attached. */
export interface Reading {
  day: string;
  at: string;
  value: number;
}

/**
 * Chart slots for instantaneous readings: every reading in order, and one
 * empty slot for each day in the range that has none.
 */
export function readingSlots(readings: readonly Reading[], range: DayRange, current: string = today()): ChartPoint[] {
  const byDay = new Map<string, Reading[]>();
  for (const r of readings) {
    if (r.day < range.from || r.day > range.to) continue;
    const held = byDay.get(r.day);
    if (held) held.push(r);
    else byDay.set(r.day, [r]);
  }
  const points: ChartPoint[] = [];
  for (const day of daysIn(range)) {
    const label = formatDayShort(day, current);
    const held = byDay.get(day);
    if (!held) {
      points.push({ label, value: null });
      continue;
    }
    for (const r of [...held].sort((a, b) => a.at.localeCompare(b.at))) points.push({ label, value: r.value });
  }
  return points;
}

/** One kind's readings in the display unit, rounded to reading precision. */
export function readingsOf(kind: ObservationKind, observations: readonly Observation[], prefs: DisplayPrefs, filter?: (o: Observation) => boolean): Reading[] {
  return observations
    .filter(o => o.kind === kind && o.scope === 'pointInTime' && (!filter || filter(o)))
    .map(o => {
      const shown = inDisplayUnit(o, prefs);
      return { day: o.day, at: o.at, value: roundTo(shown.value, shownDecimals(shown.value, kind, shown.unit)) };
    });
}

/**
 * Chart slots for day totals: one per day, the day's total or nothing. The
 * total comes from `aggregate.series`, which applies the replace rule; a day
 * with only a different scope (steps seen on a walk) is not a day total.
 */
export function dayTotalSlots(kind: ObservationKind, observations: readonly Observation[], range: DayRange, current: string = today()): ChartPoint[] {
  const totals = new Map<string, number>();
  for (const p of series(kind, range, [...observations]).points) {
    if (p.scope === 'dayTotal') totals.set(p.day, p.value);
  }
  return daysIn(range).map(day => ({ label: formatDayShort(day, current), value: totals.get(day) ?? null }));
}

/**
 * Chart slots for observed time per day — walking minutes. Overlapping walks
 * count once (aggregate.series), and a day with no walk shows nothing.
 */
export function observedSlots(kind: ObservationKind, observations: readonly Observation[], range: DayRange, current: string = today()): ChartPoint[] {
  const totals = new Map<string, number>();
  for (const p of series(kind, range, [...observations]).points) {
    if (p.scope === 'sessionObserved') totals.set(p.day, roundTo(p.value, 0));
  }
  return daysIn(range).map(day => ({ label: formatDayShort(day, current), value: totals.get(day) ?? null }));
}

export interface PressureSlot {
  label: string;
  systolic: number | null;
  diastolic: number | null;
}

/** Blood-pressure readings as slots, paired, with an empty slot for each day without one. */
export function pressureSlots(observations: readonly Observation[], range: DayRange, current: string = today()): PressureSlot[] {
  const readings = pairBloodPressure([...observations]).filter(r => r.day >= range.from && r.day <= range.to);
  const byDay = new Map<string, typeof readings>();
  for (const r of readings) {
    const held = byDay.get(r.day);
    if (held) held.push(r);
    else byDay.set(r.day, [r]);
  }
  const slots: PressureSlot[] = [];
  for (const day of daysIn(range)) {
    const label = formatDayShort(day, current);
    const held = byDay.get(day);
    if (!held) {
      slots.push({ label, systolic: null, diastolic: null });
      continue;
    }
    for (const r of held) slots.push({ label, systolic: r.systolic, diastolic: r.diastolic });
  }
  return slots;
}

/** The unit a lab result is shown in: the one its lab used most recently, or the usual Indian one. */
export function labUnit<U extends string>(kind: 'hba1c' | 'b12' | 'vitaminD', observations: readonly Observation[], fallback: U): U {
  let latest: Observation | undefined;
  for (const o of observations) if (o.kind === kind && (!latest || Date.parse(o.at) > Date.parse(latest.at))) latest = o;
  return (latest?.unit as U | undefined) ?? fallback;
}

// ============================================================================
// The readings list under a chart
// ============================================================================

/**
 * How many rows a readings list shows before "Show all". Newest first, so the
 * first rows are the ones a person is checking; a year of glucose is a
 * thousand rows that nobody scrolls past the chart for.
 */
export const LIST_PREVIEW = 20;

export interface ListRow {
  key: string;
  /** The value, which is what a person scans a list of readings for. */
  label: string;
  detail: string;
  ref: RecordRef;
  ids: string[];
}

const join = (...parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p).join(' · ');

function dayLabel(day: string, current: string): string {
  const sameYear = day.slice(0, 4) === current.slice(0, 4);
  return format(new Date(`${day}T12:00:00`), sameYear ? 'EEE d MMM' : 'EEE d MMM yyyy');
}

/** The walks that started in a range, each whole (walk/record.ts), not one row per segment. */
function walksIn(observations: readonly Observation[], range: DayRange): WalkRecord[] {
  return walkRecords(observations).filter(w => w.day >= range.from && w.day <= range.to);
}

/**
 * Every record behind a metric in a range, newest first, one row each: a
 * reading, a paired blood pressure, a day's current total, or a walk. Takes
 * every observation, not only the metric's own kinds: a walk's row needs its
 * distance and steps beside its minutes.
 */
export function metricRows(
  metric: MetricId,
  observations: readonly Observation[],
  range: DayRange,
  prefs: DisplayPrefs,
  current: string = today(),
  filter?: (o: Observation) => boolean,
): ListRow[] {
  const spec = METRICS[metric];
  const inRange = observations.filter(o => o.day >= range.from && o.day <= range.to && spec.kinds.includes(o.kind) && (!filter || filter(o)));
  const newestFirst = <T extends { at: string }>(a: T, b: T) => Date.parse(b.at) - Date.parse(a.at);

  if (spec.chart === 'pressure') {
    return pairBloodPressure(inRange).sort(newestFirst).map(r => {
      const first = r.halves[0];
      const missing = r.systolic === null ? 'Top number not entered' : r.diastolic === null ? 'Bottom number not entered' : undefined;
      return {
        key: `pressure:${r.id}|${r.at}`,
        label: formatPressure(r),
        detail: join(dayLabel(r.day, current), hasClockTime(first) && formatClock(r.at, prefs.hour12), missing, r.tag !== undefined && tagLabel(r.tag), pressureFlag(r.systolic, r.diastolic), sourceLabel(first)),
        ref: { type: 'pressure', id: r.id },
        ids: r.halves.map(h => h.id),
      };
    });
  }

  if (metric === 'walking') {
    const walks = walksIn(observations, range);
    const inWalk = new Set(walks.flatMap(w => w.observations.map(o => o.id)));
    const minutes = (value: number) => formatObservation({ kind: 'walkDuration', value, unit: 'min' }, prefs);
    const rows: (ListRow & { at: string })[] = walks.map(w => ({
      key: `walk:${w.id}`,
      label: minutes(w.minutes),
      detail: join(
        dayLabel(w.day, current),
        formatClock(w.at, prefs.hour12),
        w.distanceKm !== undefined && formatObservation({ kind: 'walkDistance', value: w.distanceKm, unit: 'km' }, prefs),
        w.addedMinutes > 0 && `${minutes(w.addedMinutes)} added by you`,
        sourceLabel(w.observations.find(o => o.source === 'measured') ?? w.observations[0]),
      ),
      ref: { type: 'walk', id: w.id },
      ids: w.observations.filter(o => o.kind === 'walkDuration').map(o => o.id),
      at: w.at,
    }));
    // Walking time that did not come from a walk recording (an import) is listed as it is.
    for (const o of inRange.filter(x => x.scope === 'sessionObserved' && !inWalk.has(x.id))) {
      rows.push({
        key: `observed:${o.id}`,
        label: formatObservation(o, prefs),
        detail: join(dayLabel(o.day, current), formatClock(o.at, prefs.hour12), sourceLabel(o)),
        ref: { type: 'reading', id: o.id },
        ids: [o.id],
        at: o.at,
      });
    }
    return rows.sort(newestFirst);
  }

  if (spec.chart === 'bar') {
    const kind = spec.kinds[0];
    const rows: ListRow[] = [];
    // Day totals: one row per day, the statement that counts.
    const totals = series(kind, range, inRange).points.filter(p => p.scope === 'dayTotal');
    for (const p of totals) {
      const winner = p.observations[0];
      const statements = inRange.filter(o => o.day === p.day && o.scope === 'dayTotal' && o.source === winner.source).length;
      rows.push({
        key: `total:${p.day}`,
        label: formatObservation({ kind, value: p.value, unit: winner.unit }, prefs),
        detail: join(
          dayLabel(p.day, current),
          sourceLabel(winner),
          kind === 'water' ? `${statements} ${statements === 1 ? 'entry' : 'entries'}` : statements > 1 && 'Replaces an earlier total',
        ),
        ref: { type: 'reading', id: winner.id },
        ids: inRange.filter(o => o.day === p.day && o.scope === 'dayTotal').map(o => o.id),
      });
    }
    // Steps seen during a walk are the walk's, one row a walk, never added to the day's total.
    const walks = walksIn(observations, range).filter(w => kind === 'steps' && w.steps !== undefined);
    const inWalk = new Set(walks.flatMap(w => w.observations.map(o => o.id)));
    for (const w of walks) {
      rows.push({
        key: `walk:${w.id}`,
        label: formatObservation({ kind: 'steps', value: w.steps!, unit: 'steps' }, prefs),
        detail: join(dayLabel(w.day, current), formatClock(w.at, prefs.hour12), 'During a walk', sourceLabel(w.observations.find(o => o.kind === 'steps') ?? w.observations[0])),
        ref: { type: 'walk', id: w.id },
        ids: w.observations.filter(o => o.kind === 'steps').map(o => o.id),
      });
    }
    for (const o of inRange.filter(x => x.scope === 'sessionObserved' && !inWalk.has(x.id))) {
      rows.push({
        key: `observed:${o.id}`,
        label: formatObservation(o, prefs),
        detail: join(dayLabel(o.day, current), formatClock(o.at, prefs.hour12), sourceLabel(o)),
        ref: { type: 'reading', id: o.id },
        ids: [o.id],
      });
    }
    const dayOf = (r: ListRow) => observations.find(o => o.id === r.ids[0])?.day ?? '';
    return rows.sort((a, b) => dayOf(b).localeCompare(dayOf(a)) || a.key.localeCompare(b.key));
  }

  // A metric of two kinds (back and leg) names each reading's kind.
  const named = spec.kinds.length > 1;
  return inRange.filter(o => o.scope === 'pointInTime').sort(newestFirst).map(o => ({
    key: `reading:${o.id}`,
    label: named ? `${kindTitle(o.kind)} ${formatObservation(o, prefs)}` : formatObservation(o, prefs),
    detail: join(
      dayLabel(o.day, current),
      hasClockTime(o) && formatClock(o.at, prefs.hour12),
      o.tag !== undefined && tagLabel(o.tag),
      o.kind === 'glucose' && glucoseFlag(o.value, o.unit as GlucoseUnit),
      sourceLabel(o),
    ),
    ref: { type: 'reading', id: o.id },
    ids: [o.id],
  }));
}

// ============================================================================
// The interpretive lines under a chart
// ============================================================================

export interface MetricNote {
  key: string;
  reading: Interpretation;
  extra?: string;
}

export interface NotesContext {
  prefs: DisplayPrefs;
  profile: UserProfile | undefined;
  habits: HabitSettings | undefined;
  glucoseView: GlucoseGroup | 'all';
  current: string;
}

/**
 * The interpretive lines for a metric, each with its framework. A result is
 * judged on the latest by the shared ordering (`compareObservations`): two
 * results at the same moment are told apart by when they were saved, so this
 * panel and the testing cadence always judge the same one (F24).
 */
export function metricNotes(metric: MetricId, own: readonly Observation[], ctx: NotesContext): MetricNote[] {
  const { prefs, profile, habits, glucoseView, current } = ctx;
  const latest = own.filter(o => o.scope === 'pointInTime').sort(compareObservations).at(-1);
  const notes: MetricNote[] = [];

  if (metric === 'weight' && latest) {
    const bmi = profile?.heightCm ? bmiOf(latest.value, profile.heightCm) : undefined;
    if (bmi !== undefined) notes.push({ key: 'bmi', reading: interpretBmi(bmi), extra: BMI_FRAMEWORKS_NOTE });
  }
  if (metric === 'waist') notes.push({ key: 'waist', reading: waistNote(prefs.length), extra: waistFrameworksNote(prefs.length) });
  if (metric === 'water') notes.push({ key: 'water', reading: waterNote(profile, habits) });
  if (metric === 'steps') notes.push({ key: 'steps', reading: STEPS_NOTE });
  if (metric === 'hba1c' && latest) {
    const shown = convert('hba1c', latest.value, latest.unit, prefs.hba1c);
    notes.push({
      key: 'hba1c',
      reading: interpretHba1c(shown, prefs.hba1c, clinicianOverrides(profile)),
      // The testing cadence's own source, the one Today cites, whatever the goal's.
      extra: `${HBA1C_CADENCE} ${HBA1C_CADENCE_SOURCE}. Last test: ${formatDayShort(latest.day, current)}.`,
    });
  }
  if (metric === 'b12' && latest) notes.push({ key: 'b12', reading: interpretB12(inDisplayUnit(latest, prefs).value, prefs.b12) });
  if (metric === 'vitaminD' && latest) notes.push({ key: 'vitD', reading: interpretVitaminD(inDisplayUnit(latest, prefs).value, prefs.vitaminD) });
  if (metric === 'bloodPressure') {
    const ref = pressureReference(ageForTargets(profile?.birthYear, current), profile?.health.hypertension);
    notes.push({ key: 'bp', reading: { text: ref.note, tone: 'default', framework: ref.framework } });
  }
  if (metric === 'glucose' && glucoseView === 'afterMeal') {
    notes.push({ key: 'after', reading: { text: 'The after-meal limit is for readings 1 to 2 hours after the meal started. A reading at another time is not a missed target.', tone: 'default', framework: 'ADA Standards of Care 2026, Table 6.3' } });
  }
  return notes;
}
