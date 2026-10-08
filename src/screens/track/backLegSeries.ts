/**
 * The signature screen's data (board D21): back pain and leg pain over time,
 * how far leg symptoms reached, and the spinal-loading level each session
 * actually used — on one time axis, so a person can see whether loading went
 * up while symptoms stayed calm, or whether a flare followed a change.
 *
 * Everything is a recorded fact: a pain number someone gave, a reach they
 * chose in a check-in, the ladder level of the exercises they completed.
 * Nothing is smoothed or interpolated. A line breaks wherever a day has no
 * reading, and the loading line breaks after a long gap between sessions.
 */

import type { WorkoutSession } from '@/types';
import type { LadderLevel } from '@/types/catalog';
import type { CheckInRecord, SymptomReach } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import type { DayRange } from '@/health/aggregate';
import type { Observation } from '@/health/observation';
import { getCardio, getStrength } from '@/data/catalog';
import { hasClockTime, localAt, sourceLabel } from './format';
import { daysBetween } from './periods';
import { sessionTitle } from '@/screens/workout/summary';

export const REACH_ORDER: readonly SymptomReach[] = ['back', 'buttock', 'thigh', 'belowKnee', 'foot'];

export const REACH_LABELS: Record<SymptomReach, string> = {
  back: 'Back only',
  buttock: 'Buttock',
  thigh: 'Thigh',
  belowKnee: 'Below knee',
  foot: 'Foot',
};

/**
 * Days with a pain reading before the chart is drawn. The ladder moves at most
 * once a fortnight and only after four sessions' checkpoints (engine
 * `updateLadder`), so fewer than four days of readings cannot show symptoms
 * against a change in loading — the chart would be a line with nothing to
 * compare it to. App policy, stated on screen.
 */
export const PAIN_DAYS_NEEDED = 4;

/**
 * Longest gap the loading line holds across. A fortnight is the ladder's own
 * unit of change, so after two weeks without a session the last level is no
 * longer a description of current loading, and the line stops.
 */
export const LOADING_GAP_DAYS = 14;

export interface PainPoint {
  id: string;
  day: string;
  /** Position within the day, 0 to 1. A reading with no clock time sits at midday. */
  dayFraction: number;
  value: number;
  source: string;
  timed: boolean;
  at: string;
}

export interface ReachPoint {
  day: string;
  reach: SymptomReach;
}

export interface LoadPoint {
  sessionId: string;
  day: string;
  dayFraction: number;
  title: string;
  /** Highest spinal-loading level used, or null for a session that loaded neither track. */
  level: LadderLevel | null;
  hinge: LadderLevel | null;
  squat: LadderLevel | null;
  /** An in-session symptom checkpoint was answered "worse". */
  worse: boolean;
  /**
   * Which track each "worse" answer belongs to: the ladder track of the
   * exercise it was asked after, or `other` for one off the ladder.
   */
  worseOn: ('hinge' | 'squat' | 'other')[];
}

export interface BackLegData {
  range: DayRange;
  back: PainPoint[];
  leg: PainPoint[];
  reach: ReachPoint[];
  sessions: LoadPoint[];
  /** Distinct days in the range with a back or leg reading. */
  painDays: number;
  enough: boolean;
  /** The ladder as it stands now, from the profile. */
  ladderNow?: { hinge: LadderLevel; squat: LadderLevel; changedOn?: string };
}

function fractionOf(at: string): number {
  const h = Number(at.slice(11, 13));
  const m = Number(at.slice(14, 16));
  return (h * 60 + m) / 1440;
}

/**
 * The spinal-loading levels a session actually used: the highest ladder rung
 * among its completed sets, per track. A rowing machine is hinge level 3 in
 * the catalogue, so a completed rowing block counts too.
 */
export function loadingOf(session: Pick<WorkoutSession, 'sets' | 'cardio'>): { hinge: LadderLevel | null; squat: LadderLevel | null } {
  let hinge: LadderLevel | null = null;
  let squat: LadderLevel | null = null;
  const take = (track: 'hinge' | 'squat', level: LadderLevel) => {
    if (track === 'hinge') hinge = hinge === null || level > hinge ? level : hinge;
    else squat = squat === null || level > squat ? level : squat;
  };
  for (const set of session.sets) {
    if (set.status !== 'completed') continue;
    const rung = getStrength(set.exerciseId)?.ladder;
    if (rung) take(rung.track, rung.level);
  }
  const cardio = session.cardio ? getCardio(session.cardio.modality)?.ladder : undefined;
  if (cardio) take(cardio.track, cardio.level);
  return { hinge, squat };
}

function painPoint(o: Observation): PainPoint {
  const timed = hasClockTime(o);
  return { id: o.id, day: o.day, dayFraction: timed ? fractionOf(o.at) : 0.5, value: o.value, source: sourceLabel(o), timed, at: o.at };
}

/** Check-ins with a reach answer, one per day, including those a v4 session carried. */
function reachPoints(range: DayRange, checkIns: readonly CheckInRecord[], sessions: readonly WorkoutSession[]): ReachPoint[] {
  const byDay = new Map<string, SymptomReach>();
  for (const s of sessions) {
    const reach = s.checkIn?.back?.reach;
    if (s.checkIn && reach) byDay.set(s.checkIn.date, reach);
  }
  // A stored check-in is the record of that day; a session's copy only fills a gap.
  for (const c of checkIns) if (c.back?.reach) byDay.set(c.date, c.back.reach);
  return [...byDay.entries()]
    .filter(([day]) => day >= range.from && day <= range.to)
    .map(([day, reach]) => ({ day, reach }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function assembleBackLeg(
  range: DayRange,
  observations: readonly Observation[],
  sessions: readonly WorkoutSession[],
  checkIns: readonly CheckInRecord[],
  profile?: UserProfile,
): BackLegData {
  const inRange = (day: string) => day >= range.from && day <= range.to;
  const byTime = (a: { day: string; dayFraction: number }, b: { day: string; dayFraction: number }) =>
    a.day.localeCompare(b.day) || a.dayFraction - b.dayFraction;

  const pain = observations.filter(o => (o.kind === 'backPain' || o.kind === 'legPain') && o.scope === 'pointInTime' && inRange(o.day));
  const back = pain.filter(o => o.kind === 'backPain').map(painPoint).sort(byTime);
  const leg = pain.filter(o => o.kind === 'legPain').map(painPoint).sort(byTime);

  const loads: LoadPoint[] = sessions
    .filter(s => inRange(s.date))
    .map(s => {
      const { hinge, squat } = loadingOf(s);
      const levels = [hinge, squat].filter((l): l is LadderLevel => l !== null);
      const local = s.startedAt ? localAt(s.startedAt) : undefined;
      return {
        sessionId: s.id,
        day: s.date,
        dayFraction: local && local.slice(0, 10) === s.date ? fractionOf(local) : 0.5,
        title: sessionTitle(s),
        level: levels.length > 0 ? (Math.max(...levels) as LadderLevel) : null,
        hinge,
        squat,
        worse: Object.values(s.symptomChecks ?? {}).includes('worse'),
        worseOn: [...new Set(Object.entries(s.symptomChecks ?? {})
          .filter(([, answer]) => answer === 'worse')
          .map(([id]) => getStrength(id)?.ladder?.track ?? 'other'))],
      };
    })
    .sort(byTime);

  const painDays = new Set(pain.map(o => o.day)).size;
  const ladder = profile?.ladder;
  return {
    range,
    back,
    leg,
    reach: reachPoints(range, checkIns, sessions),
    sessions: loads,
    painDays,
    enough: painDays >= PAIN_DAYS_NEEDED,
    ...(ladder ? { ladderNow: { hinge: ladder.hinge, squat: ladder.squat, ...(ladder.changedOn ? { changedOn: ladder.changedOn } : {}) } } : {}),
  };
}

/**
 * Split pain readings into the runs a line may join: consecutive readings on
 * the same or the next day. A day with no reading between two others ends the
 * run, so the chart shows the gap instead of drawing through it.
 */
export function painRuns<T extends { day: string }>(points: readonly T[]): T[][] {
  const runs: T[][] = [];
  let run: T[] = [];
  for (const p of points) {
    const last = run.at(-1);
    if (last && daysBetween(last.day, p.day) > 1) {
      runs.push(run);
      run = [];
    }
    run.push(p);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/**
 * One track's loading line: the sessions that loaded that track, joined as
 * steps until the next such session, broken after `LOADING_GAP_DAYS` without
 * one. A session that did not load the track is marked on the axis but does
 * not move its line — it is not evidence of a different level.
 */
export function loadingRuns(points: readonly LoadPoint[], track: 'hinge' | 'squat'): LoadPoint[][] {
  const loaded = points.filter(p => p[track] !== null);
  const runs: LoadPoint[][] = [];
  let run: LoadPoint[] = [];
  for (const p of loaded) {
    const last = run.at(-1);
    if (last && daysBetween(last.day, p.day) > LOADING_GAP_DAYS) {
      runs.push(run);
      run = [];
    }
    run.push(p);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** Position on the time axis, in days from the range's first day. */
export function dayOffset(range: DayRange, point: { day: string; dayFraction: number }): number {
  return daysBetween(range.from, point.day) + point.dayFraction;
}

export interface BackLegTableRow {
  day: string;
  back: number[];
  leg: number[];
  reach?: SymptomReach;
  /** "Hinge 2, squat 3" for each session that day that loaded the spine; "No spinal loading" otherwise. */
  sessions: string[];
  worse: boolean;
}

/**
 * The chart's text equivalent: one row per day that has anything on it, in
 * date order. A screen reader gets the same facts the lines show, and days
 * with nothing are left out rather than listed as zero.
 */
export function backLegTable(data: BackLegData): BackLegTableRow[] {
  const rows = new Map<string, BackLegTableRow>();
  const row = (day: string) => {
    let r = rows.get(day);
    if (!r) {
      r = { day, back: [], leg: [], sessions: [], worse: false };
      rows.set(day, r);
    }
    return r;
  };
  for (const p of data.back) row(p.day).back.push(p.value);
  for (const p of data.leg) row(p.day).leg.push(p.value);
  for (const p of data.reach) row(p.day).reach = p.reach;
  for (const s of data.sessions) {
    const r = row(s.day);
    const parts = [s.hinge !== null && `hinge ${s.hinge}`, s.squat !== null && `squat ${s.squat}`].filter(Boolean) as string[];
    const text = parts.join(', ');
    r.sessions.push(text ? text.charAt(0).toUpperCase() + text.slice(1) : 'No spinal loading');
    if (s.worse) r.worse = true;
  }
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day));
}
