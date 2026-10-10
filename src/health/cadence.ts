/**
 * What is due: the Cadence model in docs/research/clinical-tracking-protocols.md,
 * applied to this person's profile and records.
 *
 * Each item is guidance with its source, never an alarm. Anything the model
 * leaves to a clinician stays out: glucose has no recurring check without a
 * recorded monitoring plan, and vitamin D has no routine test at all. Weight
 * is weekly only "if useful and acceptable" and can cause distress, so it is
 * never prompted unasked.
 *
 * Pure: the caller passes `now`, the profile and the records.
 */

import { addMonths, addYears, endOfMonth, format, parseISO } from 'date-fns';
import type { UserProfile } from '@/types/profile';
import { pairBloodPressure, type BpReading } from './aggregate';
import { compareObservations, type Observation } from './observation';
import { daysBetween, shiftDay } from './status';

export type DueKind = 'bpCheckDay' | 'bpWeek' | 'hba1c' | 'b12' | 'hba1cFirst';

export interface DueItem {
  kind: DueKind;
  /**
   * A blood-pressure day that has just come round in a routine the person
   * keeps: about today, with a time attached, so it may lead Today. An
   * ignored or diagnostic prompt is not timely and waits behind others.
   */
  timely?: true;
  title: string;
  detail: string;
  /** Where the interval comes from, in plain words. Shown with the item. */
  source: string;
  action: { label: string; to: string };
}

export interface CadenceInput {
  now: Date;
  /** The stored profile. Without one there is nothing to base a schedule on. */
  profile?: UserProfile;
  observations: readonly Observation[];
}

/** Where each item's action lands: Track's quick log, opened on the right kind. */
export const TRACK_ADD = {
  bloodPressure: '/track?add=bloodPressure',
  hba1c: '/track?add=hba1c',
  b12: '/track?add=b12',
} as const;

/** ADA 2026, 6.3a: under 7% for many adults. */
export const ADA_HBA1C_GOAL = { value: 7, unit: '%' } as const;

/**
 * The care team's HbA1c goal from the profile, in %. A number that cannot be
 * one, such as a goal typed in mmol/mol (53) or a zero from an import, is
 * not a goal, and ADA's applies instead.
 */
export function clinicianHba1cGoal(profile: UserProfile): number | undefined {
  const goal = profile.health.clinicianTargets?.hba1cPercent;
  return typeof goal === 'number' && goal >= 4 && goal <= 15 ? goal : undefined;
}

/**
 * Everything due today, most relevant first. A blood-pressure day that has
 * just come round is about today and has a time attached, so it leads; a lab
 * test due this month waits behind it. A blood-pressure prompt that has gone
 * unanswered for days, or the one-off diagnostic week, gives way to a lab test
 * that is due, so one ignored prompt never hides every other. A missing first
 * result is the least urgent of all.
 */
export function dueItems(input: CadenceInput): DueItem[] {
  const { profile } = input;
  if (!profile) return [];
  const bp = bloodPressureItem(input, profile);
  const hba1c = hba1cItem(input, profile);
  const ranked: [number, DueItem | undefined][] = [
    [bp?.fresh ? 0 : 3, bp && (bp.fresh ? { ...bp.item, timely: true as const } : bp.item)],
    [hba1c?.kind === 'hba1cFirst' ? 4 : 1, hba1c],
    [2, b12Item(input, profile)],
  ];
  return ranked
    .filter((r): r is [number, DueItem] => r[1] !== undefined)
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
}

/** The single most relevant item, or nothing. Today shows at most one. */
export function mostRelevantDue(input: CadenceInput): DueItem | undefined {
  return dueItems(input)[0];
}

function dayOf(now: Date): string {
  return format(now, 'yyyy-MM-dd');
}

/** "2 April", or "3 March 2025" when it was another year. */
function spoken(day: string, today: string): string {
  return format(parseISO(day), day.slice(0, 4) === today.slice(0, 4) ? 'd MMMM' : 'd MMMM yyyy');
}

/**
 * The most recent record of a kind, in the store's one order (codex F24): by
 * the instant taken, compared as an instant, then a correction after what it
 * corrects, then the order entered. Two results for the same lab date share
 * its noon stamp, and the one entered later is the newer result.
 */
function latest(observations: readonly Observation[], kind: Observation['kind']): Observation | undefined {
  let found: Observation | undefined;
  for (const o of observations) {
    if (o.kind === kind && (found === undefined || compareObservations(o, found) > 0)) found = o;
  }
  return found;
}

// ============================================================================
// Blood pressure
// ============================================================================

type Session = 'morning' | 'evening' | 'unknown';

/**
 * Which half of the morning-and-evening protocol a reading belongs to. The
 * tag says so when the person chose one; otherwise the reading's own clock
 * does. Midday belongs to neither, which is also where a reading whose time
 * was never recorded sits (v4 kept only the date, so its stand-in is noon):
 * an unknown half stays unknown rather than guessed.
 */
export function sessionOf(reading: Pick<BpReading, 'at' | 'tag'>): Session {
  if (reading.tag === 'morning') return 'morning';
  if (reading.tag === 'evening') return 'evening';
  if (reading.tag === 'other') return 'unknown';
  const hour = Number(reading.at.slice(11, 13));
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 17) return 'evening';
  return 'unknown';
}

/**
 * A session as both protocols ask for it (codex F23): two readings at least a
 * minute apart, morning and evening (NICE NG136 1.2.7; ESH 2021). The minute
 * is read from the readings' own times, so two saved at one moment, or
 * seconds apart, are taken but not yet the session; no gap is ever assumed.
 * A reading counts once however often it was saved, half a reading not at
 * all, and a reading whose half of the day is unknown is claimed for neither.
 */
const APART_MS = 60_000;

interface Sitting {
  /** Distinct complete readings. */
  readings: number;
  /** Two of them at least a minute apart. */
  done: boolean;
}

type Day = Record<'morning' | 'evening', Sitting>;

const NONE: Sitting = { readings: 0, done: false };

function byDay(readings: readonly BpReading[]): Map<string, Day> {
  const times = new Map<string, Record<'morning' | 'evening', Map<string, number>>>();
  for (const r of readings) {
    const half = sessionOf(r);
    if (half === 'unknown' || r.systolic === null || r.diastolic === null) continue;
    const day = times.get(r.day) ?? { morning: new Map<string, number>(), evening: new Map<string, number>() };
    if (!day[half].has(r.id)) day[half].set(r.id, Date.parse(r.at));
    times.set(r.day, day);
  }
  const sitting = (at: number[]): Sitting => ({ readings: at.length, done: at.length >= 2 && Math.max(...at) - Math.min(...at) >= APART_MS });
  return new Map([...times].map(([d, t]) => [d, { morning: sitting([...t.morning.values()]), evening: sitting([...t.evening.values()]) }]));
}

const fullDay = (d: Day | undefined) => d !== undefined && d.morning.done && d.evening.done;

/** Readings taken, but none of them a minute apart. */
const tooClose = (s: Sitting) => s.readings >= 2 && !s.done;

/** What is left of today, or nothing once the evening is done: the morning cannot be done again. */
function todaysAsk(d: Day | undefined, evening: boolean): string | undefined {
  const morning = d?.morning ?? NONE;
  const late = d?.evening ?? NONE;
  if (late.done) return undefined;
  if (tooClose(late)) return 'Your two readings this evening were less than a minute apart. Take one more, a minute after the last.';
  if (late.readings === 1) return 'One more reading this evening, a minute after the last.';
  if (morning.done) return 'Two more readings this evening, a minute apart.';
  if (evening) return 'Two readings this evening, a minute apart.';
  if (tooClose(morning)) return 'Your two readings this morning were less than a minute apart. Take one more, a minute after the last, then two this evening.';
  if (morning.readings === 1) return 'One more reading this morning, a minute after the last, then two this evening.';
  return 'Two readings this morning and two this evening, a minute apart.';
}

/** Why days this past week did not count, when their readings were too close together. */
function closeNote(days: Map<string, Day>, today: string): string | undefined {
  const weekAgo = shiftDay(today, -7);
  const n = [...days].filter(([d, s]) => d >= weekAgo && d < today && (tooClose(s.morning) || tooClose(s.evening))).length;
  if (n === 0) return undefined;
  return n === 1
    ? 'On 1 day this week your two readings were less than a minute apart, so it was not counted.'
    : `On ${n} days this week your two readings were less than a minute apart, so they were not counted.`;
}

/** A weekly check day stays at the front for its first two days; after that it has been seen and set aside. */
const FRESH_DAYS = 2;

function bloodPressureItem(input: CadenceInput, profile: UserProfile): { item: DueItem; fresh: boolean } | undefined {
  const { hypertension, bpMonitor } = profile.health;
  // Home monitoring needs a home monitor; without one these are clinic readings.
  if (hypertension === 'none' || !bpMonitor) return undefined;

  const today = dayOf(input.now);
  const days = byDay(pairBloodPressure([...input.observations]));
  const evening = input.now.getHours() >= 17;

  if (hypertension !== 'treated') {
    const item = diagnosticWeek(days, today, evening);
    return item && { item, fresh: false };
  }
  const last = [...days].filter(([d, s]) => d < today && fullDay(s)).map(([d]) => d).sort().at(-1);
  const item = weeklyCheck(days, last, today, evening);
  return item && { item, fresh: last !== undefined && daysBetween(last, today) < 7 + FRESH_DAYS };
}

/**
 * Stable treated hypertension: one check day a week, two readings in the
 * morning and two in the evening (Cadence model; ESH 2021, Box 15). Any
 * complete day resets the week, so someone already checking more often is
 * never asked for more.
 */
function weeklyCheck(days: Map<string, Day>, last: string | undefined, today: string, evening: boolean): DueItem | undefined {
  if (last !== undefined && daysBetween(last, today) < 7) return undefined;
  const ask = todaysAsk(days.get(today), evening);
  if (ask === undefined) return undefined;
  return {
    kind: 'bpCheckDay',
    title: 'Blood pressure check day',
    detail: [ask, closeNote(days, today)].filter(Boolean).join(' '),
    source: 'Once a week is a low-effort routine within the European Society of Hypertension’s home monitoring advice (2021).',
    action: { label: 'Add a reading', to: TRACK_ADD.bloodPressure },
  };
}

/**
 * High blood pressure not yet confirmed or not treated: one diagnostic block
 * of at least 4 full days in a row, which a clinician then reads (NICE NG136,
 * 1.2.7). Once the block is on record the app stops asking: repeats are the
 * clinician's call, and daily readings for life are not a guideline.
 */
function diagnosticWeek(days: Map<string, Day>, today: string, evening: boolean): DueItem | undefined {
  const full = (d: string) => fullDay(days.get(d));
  const complete = [...days.keys()].some(d => [0, 1, 2, 3].every(i => full(shiftDay(d, i))));
  if (complete) return undefined;
  const ask = todaysAsk(days.get(today), evening);
  if (ask === undefined) return undefined;

  let done = 0;
  while (full(shiftDay(today, -1 - done))) done += 1;
  return {
    kind: 'bpWeek',
    title: 'Blood pressure week',
    detail: [ask, done === 0 ? 'Aim for at least 4 days in a row, ideally 7.' : `${done} of at least 4 days in a row done.`, closeNote(days, today)]
      .filter(Boolean).join(' '),
    source: 'NICE guideline NG136, 1.2.7: readings at home over at least 4 days, ideally 7, which your clinician then reviews.',
    action: { label: 'Add a reading', to: TRACK_ADD.bloodPressure },
  };
}

// ============================================================================
// HbA1c
// ============================================================================

/** IFCC (mmol/mol) and NGSP (%) are related by a fixed line, never rounded here. */
export function hba1cIn(value: number, from: string, to: '%' | 'mmol/mol'): number {
  if (from === to) return value;
  return to === '%' ? value / 10.929 + 2.15 : (value - 2.15) * 10.929;
}

function hba1cText(value: number, unit: string): string {
  return unit === 'mmol/mol' ? `${Math.round(value)} mmol/mol` : `${Math.round(value * 10) / 10}%`;
}

/**
 * ADA 6.2: at least twice a year when stable and at goal, about every three
 * months when not. "At goal" means under the clinician's goal when one is
 * recorded, otherwise under ADA's usual 7% (53 mmol/mol).
 *
 * The result is compared at the precision labs report in the goal's unit (one
 * decimal for %, whole numbers for mmol/mol): 53 mmol/mol is how a lab writes
 * 7.0%, so it is not under 7%, although the raw line gives 6.9995.
 */
export function hba1cIntervalMonths(last: Pick<Observation, 'value' | 'unit'>, goal: { value: number; unit: '%' | 'mmol/mol' } = ADA_HBA1C_GOAL): 3 | 6 {
  const raw = hba1cIn(last.value, last.unit, goal.unit);
  const reported = goal.unit === '%' ? Math.round(raw * 10) / 10 : Math.round(raw);
  return reported < goal.value ? 6 : 3;
}

/** Where the HbA1c testing cadence comes from: the one wording Today and Track's HbA1c chart cite. */
export const HBA1C_CADENCE_CITATION = 'ADA Standards of Care 2026, recommendation 6.2';

function hba1cItem(input: CadenceInput, profile: UserProfile): DueItem | undefined {
  const { diabetes } = profile.health;
  if (diabetes !== 'type1' && diabetes !== 'type2' && diabetes !== 'other') return undefined;

  const today = dayOf(input.now);
  const source = `${HBA1C_CADENCE_CITATION}.`;
  const last = latest(input.observations, 'hba1c');
  if (!last) {
    return {
      kind: 'hba1cFirst',
      title: 'Add your last HbA1c',
      detail: 'With your last result, the app can tell you when the next test is usually due.',
      source,
      action: { label: 'Add a result', to: TRACK_ADD.hba1c },
    };
  }

  const target = clinicianHba1cGoal(profile);
  const months = hba1cIntervalMonths(last, target !== undefined ? { value: target, unit: '%' } : ADA_HBA1C_GOAL);
  const due = format(addMonths(parseISO(last.day), months), 'yyyy-MM-dd');
  if (due > today) return undefined;

  const goalText = target !== undefined ? `your clinician’s goal (under ${hba1cText(target, '%')})` : 'the usual goal (under 7%)';
  const result = `Your last result was ${hba1cText(last.value, last.unit)} on ${spoken(last.day, today)}`;
  return {
    kind: 'hba1c',
    title: 'HbA1c due',
    detail: months === 6
      ? `${result}, within ${goalText}. About every 6 months is usual.`
      : `${result}, not yet within ${goalText}. About every 3 months is usual until it is.`,
    source,
    action: { label: 'Add a result', to: TRACK_ADD.hba1c },
  };
}

// ============================================================================
// Vitamin B12
// ============================================================================

/**
 * The latest day metformin could have been started, from `YYYY` or `YYYY-MM`.
 * Using the latest possible day means "more than 4 years" is only claimed once
 * it is certain.
 */
export function latestStart(since: string | undefined): string | undefined {
  const m = since === undefined ? null : /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(since);
  if (!m) return undefined;
  if (!m[2]) return `${m[1]}-12-31`;
  return format(endOfMonth(parseISO(`${m[1]}-${m[2]}-01`)), 'yyyy-MM-dd');
}

/**
 * ADA 3.10 and its discussion: annual B12 assessment after more than 4 years
 * on metformin, or sooner with another risk such as a vegan diet. Shorter use
 * calls for "periodic" checks, which has no interval to remind on.
 */
function b12Item(input: CadenceInput, profile: UserProfile): DueItem | undefined {
  if (profile.health.metformin !== true) return undefined;

  const today = dayOf(input.now);
  const start = latestStart(profile.health.metforminSince);
  const longTerm = start !== undefined && format(addYears(parseISO(start), 4), 'yyyy-MM-dd') < today;
  const vegan = profile.food?.pattern === 'vegan';
  if (!longTerm && !vegan) return undefined;

  const last = latest(input.observations, 'b12');
  if (last && format(addMonths(parseISO(last.day), 12), 'yyyy-MM-dd') > today) return undefined;

  const why = longTerm ? 'after more than 4 years on metformin' : 'on metformin with a vegan diet';
  return {
    kind: 'b12',
    title: 'Vitamin B12 check',
    detail: `Once a year is usual ${why}. ${last
      ? `Your last result was ${Math.round(last.value)} ${last.unit} on ${spoken(last.day, today)}.`
      : 'No result recorded yet.'}`,
    source: 'ADA Standards of Care 2026, recommendation 3.10.',
    action: { label: 'Add a result', to: TRACK_ADD.b12 },
  };
}
