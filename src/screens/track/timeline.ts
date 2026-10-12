/**
 * One day's record, assembled for My Day: every reading, walk, session and
 * check-in, in the order they happened, each with its source.
 *
 * Two shapes, because they are two kinds of fact:
 *
 * - **Day totals** (water, steps, sleep) are statements about the whole day.
 *   "+1 glass" writes a larger total rather than a second entry, so the day
 *   shows one figure per kind — the current statement — and says when it
 *   replaced an earlier one. `aggregate.summariseDay` decides which statement
 *   counts; nothing here adds numbers.
 * - **Timeline rows** are things that happened at a time. A record that
 *   belongs to another (a check-in's glucose, a walk's distance) is shown
 *   inside it, not again beside it.
 *
 * Pure and synchronous, so it is tested on its own and safe in a render.
 */

import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { pairBloodPressure, summariseDay, type BpReading } from '@/health/aggregate';
import { OBSERVATION_KINDS, bpReadingId, checkInDayOf, isBpKind, type Observation } from '@/health/observation';
import { walkRecords, type WalkRecord } from '@/walk/record';
import { stepsGoalOn, stepsProgress, type StepsGoalSettings } from './stepsGoal';
import { STATUS_LABEL, sessionTitle, sourceLabel as sessionSource } from '@/screens/workout/summary';
import {
  formatClock, formatDuration, formatObservation, hasClockTime, isLabKind, kindTitle, localAt,
  sourceLabel, tagLabel, type DisplayPrefs,
} from './format';
import { glucoseFlag, pressureFlag } from './escalation';
import { formatNumber, type GlucoseUnit } from './units';

/** Where a row leads. Each kind of record has its own detail screen. */
export type RecordRef =
  | { type: 'reading'; id: string }
  | { type: 'pressure'; id: string }
  | { type: 'walk'; id: string }
  | { type: 'session'; id: string }
  /** A hand-logged workout: its record lives in the Workout Log, where its sets are corrected. */
  | { type: 'workout'; id: string }
  | { type: 'checkIn'; date: string };

export function recordPath(ref: RecordRef): string {
  switch (ref.type) {
    case 'reading': return `/track/reading/${encodeURIComponent(ref.id)}`;
    case 'pressure': return `/track/pressure/${encodeURIComponent(ref.id)}`;
    case 'walk': return `/track/walk/${encodeURIComponent(ref.id)}`;
    case 'session': return `/track/session/${encodeURIComponent(ref.id)}`;
    case 'workout': return `/track/workout/${encodeURIComponent(ref.id)}`;
    case 'checkIn': return `/track/check-in/${ref.date}`;
  }
}

export interface DayTotalRow {
  key: string;
  title: string;
  value: string;
  detail: string;
  /** The statement that counts, which is what its detail screen corrects. */
  ref: RecordRef;
  /** Every statement for this kind and day. */
  ids: string[];
}

export interface TimelineRow {
  key: string;
  ref: RecordRef;
  title: string;
  value?: string;
  detail: string;
  /** Records behind the row, so a just-saved one can be found. */
  ids: string[];
  /** Milliseconds since the epoch; `undefined` for a record with no clock time. */
  at?: number;
  /** Tie-break between records at the same moment: the kinds' registry order. */
  order: number;
  /** Then the order they were saved in (the store's commit order), for two readings of one kind at one moment. */
  seq?: number;
}

export interface DayView {
  day: string;
  totals: DayTotalRow[];
  rows: TimelineRow[];
  /** Nothing at all recorded on this day. */
  empty: boolean;
}

export interface DayData {
  observations: readonly Observation[];
  sessions: readonly WorkoutSession[];
  checkIns: readonly CheckInRecord[];
  /** For a steps goal: each day is read against its own (J07). */
  settings?: StepsGoalSettings;
}

const join = (...parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p).join(' · ');

/** "138/86 mmHg", keeping a missing half visibly missing. */
export function formatPressure(r: Pick<BpReading, 'systolic' | 'diastolic'>): string {
  const s = r.systolic === null ? 'Not entered' : formatNumber(r.systolic);
  const d = r.diastolic === null ? 'Not entered' : formatNumber(r.diastolic);
  return `${s}/${d} mmHg`;
}

/** The Workout Log's own words for a session's status, so one record reads the same everywhere. */
export function sessionStatus(s: Pick<WorkoutSession, 'status'>): string {
  return STATUS_LABEL[s.status];
}

/** The check-in for a day: the stored record, or the copy a v4 session carried. */
export function checkInFor(day: string, data: Pick<DayData, 'checkIns' | 'sessions'>): CheckInRecord | undefined {
  return data.checkIns.find(c => c.date === day)
    ?? data.sessions.find(s => s.checkIn?.date === day)?.checkIn;
}

function readingRow(o: Observation, prefs: DisplayPrefs): TimelineRow {
  const timed = hasClockTime(o);
  return {
    key: `reading:${o.id}`,
    ref: { type: 'reading', id: o.id },
    title: kindTitle(o.kind),
    value: formatObservation(o, prefs),
    detail: join(
      isLabKind(o.kind) ? 'Lab result' : timed ? formatClock(o.at, prefs.hour12) : 'Time not recorded',
      o.tag !== undefined && tagLabel(o.tag),
      o.kind === 'glucose' && glucoseFlag(o.value, o.unit as GlucoseUnit),
      o.scope === 'sessionObserved' && typeof o.coverageMs === 'number' && `Over ${formatDuration(o.coverageMs / 1000)}`,
      sourceLabel(o),
    ),
    ids: [o.id],
    ...(timed && !isLabKind(o.kind) ? { at: Date.parse(o.at) } : {}),
    order: OBSERVATION_KINDS.indexOf(o.kind),
    ...(o.seq !== undefined ? { seq: o.seq } : {}),
  };
}

function pressureRow(r: BpReading, prefs: DisplayPrefs): TimelineRow {
  const first = r.halves[0];
  const timed = hasClockTime(first);
  // A half-missing reading shows the number it has, and says which one is
  // missing in words, rather than a long value that would crowd out the title.
  const value = r.systolic !== null && r.diastolic !== null
    ? formatPressure(r)
    : `${formatNumber((r.systolic ?? r.diastolic) as number)} mmHg`;
  const missing = r.systolic === null ? 'Top number not entered' : r.diastolic === null ? 'Bottom number not entered' : undefined;
  return {
    key: `pressure:${r.id}|${r.at}`,
    ref: { type: 'pressure', id: r.id },
    title: 'Blood pressure',
    value,
    detail: join(
      timed ? formatClock(r.at, prefs.hour12) : 'Time not recorded',
      missing,
      r.tag !== undefined && tagLabel(r.tag),
      pressureFlag(r.systolic, r.diastolic),
      sourceLabel(first),
    ),
    ids: r.halves.map(h => h.id),
    ...(timed ? { at: Date.parse(r.at) } : {}),
    order: OBSERVATION_KINDS.indexOf('bloodPressureSystolic'),
    ...(first.seq !== undefined ? { seq: first.seq } : {}),
  };
}

/**
 * The readings a check-in holds, in a line: "Back 4 of 10 · Glucose 52 mg/dL,
 * Serious low". A reading the contract singles out says so here too, as it
 * does on its own row.
 */
function summaryOf(observations: Observation[], display: 'HI' | 'LO' | undefined, prefs: DisplayPrefs): string {
  const parts: string[] = [];
  const flagged = (text: string, flag: string | undefined) => (flag ? `${text}, ${flag}` : text);
  const pressure = pairBloodPressure(observations.filter(o => isBpKind(o.kind)));
  for (const kind of OBSERVATION_KINDS) {
    if (isBpKind(kind)) {
      if (kind === 'bloodPressureSystolic') {
        for (const r of pressure) parts.push(flagged(`BP ${formatPressure(r)}`, pressureFlag(r.systolic, r.diastolic)));
      }
      continue;
    }
    for (const o of observations.filter(x => x.kind === kind)) {
      parts.push(flagged(`${kindTitle(kind)} ${formatObservation(o, prefs)}`, kind === 'glucose' ? glucoseFlag(o.value, o.unit as GlucoseUnit) : undefined));
    }
    // A meter's HI or LO has no number, and is said as the meter said it.
    if (kind === 'glucose' && display) parts.push(`Glucose ${display}, past the meter’s range`);
  }
  return parts.join(' · ');
}

/**
 * A walk, however many segments it was recorded in: the walk's own totals
 * (`walkRecords`), never its first segment. Minutes the person added for a
 * gap are named as theirs, beside the measured ones (codex-vision §9).
 */
function walkRow(w: WalkRecord, prefs: DisplayPrefs): TimelineRow {
  const minutes = (value: number) => formatObservation({ kind: 'walkDuration', value, unit: 'min' }, prefs);
  const pain = [w.backPain !== undefined && `back ${w.backPain}`, w.legPain !== undefined && `leg ${w.legPain}`].filter(Boolean);
  const measured = w.observations.find(o => o.source === 'measured') ?? w.observations[0];
  return {
    key: `walk:${w.id}`,
    ref: { type: 'walk', id: w.id },
    title: 'Walk',
    ...(w.minutes > 0 ? { value: minutes(w.minutes) } : {}),
    detail: join(
      formatClock(w.at, prefs.hour12),
      w.mealStartedAt !== undefined && tagLabel('afterMeal'),
      w.distanceKm !== undefined && formatObservation({ kind: 'walkDistance', value: w.distanceKm, unit: 'km' }, prefs),
      w.steps !== undefined && formatObservation({ kind: 'steps', value: w.steps, unit: 'steps' }, prefs),
      w.addedMinutes > 0 && `${minutes(w.addedMinutes)} added by you`,
      pain.length > 0 && `Pain afterwards ${pain.join(', ')} of 10`,
      sourceLabel(measured),
    ),
    // A day total that came from a walk is shown with the day's totals, not here.
    ids: w.observations.filter(o => o.scope !== 'dayTotal').map(o => o.id),
    at: Date.parse(w.at),
    order: OBSERVATION_KINDS.indexOf('walkDuration'),
  };
}

function sessionRow(s: WorkoutSession, folded: Observation[], prefs: DisplayPrefs): TimelineRow {
  // Its active time — measured by the player, or entered — never the span
  // from first set to finish, which may be hours of a locked phone (F20, R01).
  const seconds = s.durationSeconds;
  const local = s.startedAt ? localAt(s.startedAt) : undefined;
  return {
    key: `session:${s.id}`,
    // A guided session's summary (loading, checkpoints) is Track's; a workout
    // written down by hand opens straight in the Workout Log.
    ref: s.guided ? { type: 'session', id: s.id } : { type: 'workout', id: s.id },
    // Named the way the Workout Log names it, so a record has one name.
    title: sessionTitle(s),
    ...(seconds !== undefined && seconds > 0 ? { value: formatDuration(seconds) } : {}),
    detail: join(
      local ? formatClock(local, prefs.hour12) : 'Time not recorded',
      sessionStatus(s),
      sessionSource(s),
    ),
    ids: [s.id, ...folded.map(o => o.id)],
    ...(local ? { at: Date.parse(local) } : {}),
    order: -1,
  };
}

/**
 * Untimed records first (a check-in leads them), then everything by time.
 * Records with no time keep the registry's order — weight before waist —
 * rather than the alphabet's.
 */
function byTime(a: TimelineRow, b: TimelineRow): number {
  const rank = (r: TimelineRow) => (r.at !== undefined ? 2 : r.ref.type === 'checkIn' ? 0 : 1);
  return rank(a) - rank(b) || (a.at ?? 0) - (b.at ?? 0) || a.order - b.order || (a.seq ?? 0) - (b.seq ?? 0) || a.key.localeCompare(b.key);
}

/** Everything recorded on one local day. */
export function assembleDay(day: string, data: DayData, prefs: DisplayPrefs): DayView {
  const dayObs = data.observations.filter(o => o.day === day);
  const summary = summariseDay(day, dayObs);

  const totals: DayTotalRow[] = [];
  for (const entry of summary.entries) {
    if (entry.scope !== 'dayTotal') continue;
    const winner = entry.contributed[0];
    if (!winner || entry.total === null) continue;
    const replaced = entry.flags.some(f => f.fault === 'replaced');
    const conflict = entry.flags.some(f => f.fault === 'conflictingSources');
    const statements = entry.observations.length;
    totals.push({
      key: `total:${entry.kind}`,
      title: kindTitle(entry.kind),
      value: formatObservation({ kind: entry.kind, value: entry.total, unit: winner.unit }, prefs),
      detail: join(
        entry.kind === 'steps' && stepsProgress(entry.total, stepsGoalOn(data.settings, day)),
        sourceLabel(winner),
        entry.kind === 'water' ? (statements > 1 ? `${statements} entries` : '1 entry') : replaced && 'Replaces an earlier total',
        conflict && 'Another source gave a different total',
      ),
      ref: { type: 'reading', id: winner.id },
      ids: entry.observations.map(o => o.id),
    });
  }

  const rows: TimelineRow[] = [];
  const used = new Set<string>();

  // A check-in holds the readings typed into it.
  const checkIn = checkInFor(day, data);
  if (checkIn) {
    // Every reading lifted from it, rechecks included (`checkIn:D#1`, `bp:checkIn:D#1`).
    const held = dayObs.filter(o => checkInDayOf(o) === day);
    for (const o of held) used.add(o.id);
    const display = checkIn.glucoseDisplay?.display;
    rows.push({
      key: `checkIn:${day}`,
      ref: { type: 'checkIn', date: day },
      title: 'Check-in',
      detail: join(held.length > 0 || display ? summaryOf(held, display, prefs) : 'Your answers for the day', 'Your check-in'),
      ids: held.map(o => o.id),
      order: -2,
    });
  }

  // A session holds what was recorded about it.
  for (const s of data.sessions.filter(x => x.date === day)) {
    const folded = dayObs.filter(o => o.context === `session:${s.id}` && !used.has(o.id));
    for (const o of folded) used.add(o.id);
    rows.push(sessionRow(s, folded, prefs));
  }

  // A walk is one record, however many segments and measurements it produced.
  // It is listed on the day it started; a segment after midnight is still its own.
  const walks = walkRecords(data.observations);
  const walked = new Set(walks.map(w => `walk:${w.id}`));
  for (const w of walks) {
    if (w.day === day) rows.push(walkRow(w, prefs));
  }
  for (const o of dayObs) if (o.context !== undefined && walked.has(o.context)) used.add(o.id);

  const rest = dayObs.filter(o => !used.has(o.id) && o.scope !== 'dayTotal');
  for (const r of pairBloodPressure(rest.filter(o => isBpKind(o.kind)))) rows.push(pressureRow(r, prefs));
  for (const o of rest) if (!isBpKind(o.kind)) rows.push(readingRow(o, prefs));

  rows.sort(byTime);
  return { day, totals, rows, empty: totals.length === 0 && rows.length === 0 };
}

/** The `bp:` reading id a blood-pressure observation belongs to, or its own id. */
export function pressureIdOf(o: Pick<Observation, 'id' | 'context'>): string {
  return bpReadingId(o.context) ?? o.id;
}
