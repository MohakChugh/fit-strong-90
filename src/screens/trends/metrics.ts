/**
 * A trend for each category that declares one (journey §5.1, B-14), and for
 * Mood, which v4 backups can carry but no category owns (D74): what kind of
 * measure it is, its unit and precision, and how its records become the day
 * figures or readings the statistics count (`records.ts`, through v1's
 * aggregation only). Food's trend is Plan 7's: its address goes to the Food
 * hub until then (D74).
 */
import { CATEGORIES, categoryById } from '@/categories';
import { pairBloodPressure, type DayRange } from '@/health/aggregate';
import type { Observation, ObservationKind } from '@/health/observation';
import { HYPO_LEVEL_1_MGDL, glucoseFlag, pressureFlag } from '@/screens/track/escalation';
import { formatClock, hasClockTime, inDisplayUnit, shownDecimals, tagLabel, unitLabel, type DisplayPrefs } from '@/screens/track/format';
import type { LabKind } from '@/screens/track/logKinds';
import { glucoseGroup } from '@/screens/track/targets';
import { formatPressure } from '@/screens/track/timeline';
import { decimalsFor, formatNumber, glucoseMgdl, roundTo, type GlucoseUnit } from '@/screens/track/units';
import { dayTotals, meterReadings, sessionMinutes, sessionsOf, stepsDays, stretchedDays, walkFigures, type TrendData } from './records';
import { mayBeIn, type DayFigure, type LabPoint, type MeterReading, type ReadingPoint } from './stats';

export type { TrendData } from './records';

export type TrendId = 'workout' | 'stretch' | 'walk' | 'steps' | 'glucose' | 'bp' | 'back' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs' | 'mood';
export type Family = 'counted' | 'stated' | 'readings' | 'labs';
export type Shape = 'circle' | 'square' | 'triangle';

export interface TrendDef {
  id: TrendId;
  title: string;
  family: Family;
  /** Movement charts shade rest and status days (J§12.2). */
  movement: boolean;
  /** The CSS colour token its chart draws in: `--cat-{id}`. */
  colour: string;
  /** The unit after a figure, in the person's own units. */
  unit: (prefs: DisplayPrefs) => string;
  /** Decimals a figure is shown and compared to. */
  decimals: (prefs: DisplayPrefs) => number;
  /** A stated trend's average is "a day" or "a night". */
  per: 'day' | 'night';
  /** What a day of data is called, one and many: "day with steps", "days with steps". */
  coverage: [string, string];
  /** The hub that holds its records and corrections. Mood has none. */
  hub?: string;
}

const days = (one: string, many: string): [string, string] => [one, many];

function fromRegistry(id: Exclude<TrendId, 'mood'>, rest: Omit<TrendDef, 'id' | 'title' | 'colour' | 'hub'>): TrendDef {
  const c = categoryById(id);
  return { id, title: c.title, colour: c.colour, hub: c.hub, ...rest };
}

const MINUTES = { unit: () => 'min', decimals: () => 0, per: 'day' as const, coverage: days('day', 'days') };
const READINGS = { family: 'readings' as const, movement: false, per: 'day' as const, coverage: days('day with readings', 'days with readings') };

export const TRENDS: Record<TrendId, TrendDef> = {
  workout: fromRegistry('workout', { family: 'counted', movement: true, ...MINUTES }),
  stretch: fromRegistry('stretch', { family: 'counted', movement: true, ...MINUTES }),
  walk: fromRegistry('walk', { family: 'counted', movement: true, ...MINUTES }),
  steps: fromRegistry('steps', { family: 'stated', movement: true, unit: () => 'steps', decimals: () => 0, per: 'day', coverage: days('day with steps', 'days with steps') }),
  glucose: fromRegistry('glucose', { ...READINGS, unit: p => p.glucose, decimals: p => decimalsFor('glucose', p.glucose) }),
  bp: fromRegistry('bp', { ...READINGS, unit: () => 'mmHg', decimals: () => 0 }),
  back: fromRegistry('back', { ...READINGS, unit: () => 'of 10', decimals: () => 1 }),
  weight: fromRegistry('weight', { ...READINGS, unit: p => p.mass, decimals: () => 1 }),
  water: fromRegistry('water', { family: 'stated', movement: false, unit: () => 'ml', decimals: () => 0, per: 'day', coverage: days('day with water entered', 'days with water entered') }),
  sleep: fromRegistry('sleep', { family: 'stated', movement: false, unit: () => 'h', decimals: () => 1, per: 'night', coverage: days('night recorded', 'nights recorded') }),
  waist: fromRegistry('waist', { ...READINGS, unit: p => p.length, decimals: () => 1 }),
  labs: fromRegistry('labs', { family: 'labs', movement: false, unit: () => '', decimals: () => 1, per: 'day', coverage: days('result', 'results') }),
  mood: { id: 'mood', title: 'Mood', ...READINGS, colour: '--tint', unit: () => 'of 5', decimals: () => 1 },
};

/** The trend at `/trends/{id}`, or nothing: Food's comes in Plan 7, and Learn has none. */
export function trendDef(id: string | undefined): TrendDef | undefined {
  return id !== undefined && Object.hasOwn(TRENDS, id) ? TRENDS[id as TrendId] : undefined;
}

/** Trends lists them in the registry's order, then Mood (J§12.1). */
export const TREND_ORDER: readonly TrendId[] = [
  ...CATEGORIES.flatMap(c => (c.trend !== undefined && Object.hasOwn(TRENDS, c.id) ? [c.id as TrendId] : [])),
  'mood',
];

/** Glucose under this is low (ADA level 1); over this is the high the check-in asks about. */
export const HIGH_GLUCOSE_MGDL = 250;

/** The lines as ADA writes them in each unit (Table 6.4), and 250 mg/dL as 13.9 mmol/L. */
export const GLUCOSE_LINES: Record<GlucoseUnit, { low: string; high: string }> = {
  'mg/dL': { low: '70 mg/dL', high: '250 mg/dL' },
  'mmol/L': { low: '3.9 mmol/L', high: '13.9 mmol/L' },
};

export interface SeriesInfo {
  id: string;
  label: string;
  shape: Shape;
}

/** One reading in words, for the chart's callout and its list: "112 mg/dL at 7:30 am, fasting". */
export interface ReadingText {
  day: string;
  at: string;
  text: string;
  /** "Low", "Very high", "Below what the meter can show". */
  note?: string;
}

export interface Readings {
  points: ReadingPoint[];
  meters: MeterReading[];
  /** The series present in the range, in a fixed order. */
  series: SeriesInfo[];
  /** Every reading in words, oldest first, a meter's HI and LO among them. */
  texts: ReadingText[];
}

const GLUCOSE_SERIES: readonly SeriesInfo[] = [
  { id: 'beforeMeal', label: 'Fasting or before a meal', shape: 'circle' },
  { id: 'afterMeal', label: 'After a meal', shape: 'triangle' },
  { id: 'other', label: 'Other times', shape: 'square' },
];
const BP_SERIES: readonly SeriesInfo[] = [
  { id: 'systolic', label: 'Top number (systolic)', shape: 'circle' },
  { id: 'diastolic', label: 'Bottom number (diastolic)', shape: 'square' },
];
const PAIN_SERIES: readonly SeriesInfo[] = [
  { id: 'back', label: 'Back pain', shape: 'circle' },
  { id: 'leg', label: 'Leg pain', shape: 'square' },
];
const SINGLE: Partial<Record<TrendId, ObservationKind>> = { weight: 'weight', waist: 'waist', mood: 'mood' };

const inside = (range: DayRange) => (x: { day: string }) => x.day >= range.from && x.day <= range.to;
const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at);

/** A record's value in the display unit, at the precision it is shown. */
function shown(o: Observation, prefs: DisplayPrefs): { value: number; unit: string; decimals: number } {
  const v = inDisplayUnit(o, prefs);
  const decimals = shownDecimals(v.value, o.kind, v.unit);
  return { value: roundTo(v.value, decimals), unit: v.unit, decimals };
}

const at = (o: Observation, prefs: DisplayPrefs) => (hasClockTime(o) ? ` at ${formatClock(o.at, prefs.hour12)}` : '');

/** A readings trend's readings over `range`: numbers in the display unit, the meter's HI and LO, and each in words. */
export function readingsFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): Readings {
  const own = data.observations.filter(o => o.scope === 'pointInTime').filter(inside(range));
  const points: ReadingPoint[] = [];
  const texts: ReadingText[] = [];

  if (id === 'glucose') {
    for (const o of own) {
      if (o.kind !== 'glucose') continue;
      const v = shown(o, prefs);
      const mg = glucoseMgdl(o.value, o.unit as GlucoseUnit);
      const low = mg < HYPO_LEVEL_1_MGDL;
      const high = mg > HIGH_GLUCOSE_MGDL;
      points.push({ id: o.id, day: o.day, at: o.at, value: v.value, series: glucoseGroup(o.tag), ...(low ? { low: true as const } : {}), ...(high ? { high: true as const } : {}) });
      // v1's own words for a low and an extreme reading, as Today's log lists them; then the high the check-in asks about.
      const note = glucoseFlag(o.value, o.unit as GlucoseUnit) ?? (high ? `Above ${GLUCOSE_LINES[prefs.glucose].high}` : undefined);
      texts.push({ day: o.day, at: o.at, text: `${formatNumber(v.value, v.decimals)} ${v.unit}${at(o, prefs)}${o.tag ? `, ${tagLabel(o.tag).toLowerCase()}` : ''}`, ...(note ? { note } : {}) });
    }
    // Every HI and LO that may have been measured in the range: one whose zone was lost, wherever it could have been (H3-01).
    const meters = meterReadings(data.checkIns).filter(m => mayBeIn(m, range));
    for (const m of meters.filter(inside(range))) {
      texts.push({
        day: m.day, at: m.at ?? `${m.day}T12:00:00`, text: `Meter showed ${m.display}${m.at ? ` at ${formatClock(m.at, prefs.hour12)}` : ''}`,
        note: m.display === 'LO' ? 'Below what the meter can show' : 'Above what the meter can show',
      });
    }
    return { points, meters, series: GLUCOSE_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  if (id === 'bp') {
    for (const r of pairBloodPressure(own)) {
      if (r.systolic !== null) points.push({ id: `${r.id}:sys`, day: r.day, at: r.at, value: r.systolic, series: 'systolic' });
      if (r.diastolic !== null) points.push({ id: `${r.id}:dia`, day: r.day, at: r.at, value: r.diastolic, series: 'diastolic' });
      const flag = pressureFlag(r.systolic, r.diastolic);
      const timed = hasClockTime(r.halves[0]) ? ` at ${formatClock(r.at, prefs.hour12)}` : '';
      texts.push({ day: r.day, at: r.at, text: `${formatPressure(r)}${timed}`, ...(flag ? { note: flag } : {}) });
    }
    return { points, meters: [], series: BP_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  if (id === 'back') {
    for (const o of own) {
      if (o.kind !== 'backPain' && o.kind !== 'legPain') continue;
      const series = o.kind === 'backPain' ? 'back' : 'leg';
      points.push({ id: o.id, day: o.day, at: o.at, value: o.value, series });
      texts.push({ day: o.day, at: o.at, text: `${series === 'back' ? 'Back' : 'Leg'} ${o.value} of 10${at(o, prefs)}` });
    }
    return { points, meters: [], series: PAIN_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  const kind = SINGLE[id];
  if (kind) {
    for (const o of own) {
      if (o.kind !== kind) continue;
      const v = shown(o, prefs);
      points.push({ id: o.id, day: o.day, at: o.at, value: v.value, series: 'value' });
      texts.push({ day: o.day, at: o.at, text: `${formatNumber(v.value, v.decimals)} ${unitLabel(v.unit)}${at(o, prefs)}` });
    }
    const label = TRENDS[id].title;
    return { points, meters: [], series: points.length ? [{ id: 'value', label, shape: 'circle' }] : [], texts: texts.sort(byTime) };
  }
  return { points: [], meters: [], series: [], texts: [] };
}

/** A counted or stated trend's day figures over `range`. */
export function figuresFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): DayFigure[] {
  switch (id) {
    case 'workout': return sessionMinutes(sessionsOf('programme', data.sessions), data.observations, range);
    case 'stretch': return sessionMinutes(sessionsOf('stretch', data.sessions), data.observations, range);
    case 'walk': return walkFigures('walkDuration', range, data.observations);
    case 'steps': return stepsDays(range, data.observations, prefs.hour12);
    case 'water': return dayTotals('water', range, data.observations);
    case 'sleep': return dayTotals('sleep', range, data.observations);
    default: return [];
  }
}

/** One lab's results in the unit the person reads that lab in, oldest first. */
export function labPoints(lab: LabKind, observations: readonly Observation[], prefs: DisplayPrefs): LabPoint[] {
  return observations
    .filter(o => o.kind === lab && o.scope === 'pointInTime')
    .map(o => {
      const v = shown(o, prefs);
      return { id: o.id, day: o.day, value: v.value, unit: v.unit };
    })
    .sort((a, b) => a.day.localeCompare(b.day));
}

const KINDS_OF: Partial<Record<TrendId, readonly ObservationKind[]>> = {
  walk: ['walkDuration'], steps: ['steps'], glucose: ['glucose'], bp: ['bloodPressureSystolic', 'bloodPressureDiastolic'],
  back: ['backPain', 'legPain'], weight: ['weight'], water: ['water'], sleep: ['sleep'], waist: ['waist'],
  labs: ['hba1c', 'b12', 'vitaminD'], mood: ['mood'],
};

/** Whether a category has anything to show: Trends lists every category with data, on Home or not (J§12.1, A-29). */
export function hasData(id: TrendId, data: TrendData): boolean {
  if (id === 'workout') return sessionsOf('programme', data.sessions).length > 0;
  if (id === 'stretch') return stretchedDays(data.sessions).size > 0;
  const kinds = KINDS_OF[id] ?? [];
  return data.observations.some(o => kinds.includes(o.kind)) || (id === 'glucose' && meterReadings(data.checkIns).length > 0);
}
