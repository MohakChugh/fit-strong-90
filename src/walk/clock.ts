/**
 * A walk's clock: what was observed, as a list of segments (board D18).
 *
 * Elapsed time is never a counter that ticks. It is the sum of segments, each
 * stamped from the device clock when it opened and closed, so a frozen tab, a
 * throttled timer or a page reload cannot make the figure drift. A segment is
 * a span the app could actually watch: it closes when the walk is paused, when
 * the app is hidden (iOS stops geolocation and motion then — there is no
 * background mode), when the walk screen is closed, and when the walk ends.
 * Coming back opens a new one, and the time in between is a stamped gap that
 * is never counted as walking unless the person says so (codex-vision §9).
 *
 * Everything here is pure: each transition takes the walk and the time and
 * returns the next walk. The live controller (`live.ts`) owns the real clock.
 */

import { toDateString } from '@/lib/utils';
import type { Meal } from '@/types/habits';
import type { GpsRun } from './gps';
import { dayAt, offsetAt } from './time';

export type WalkKind = 'walk' | 'afterMeal';

/** Where a walk was started from, for Done to return there (motion M12). */
export type WalkOrigin = '/home' | '/hub/walk';

export interface WalkPlan {
  kind: WalkKind;
  /** After a meal: which one, and when it started (epoch ms). */
  meal?: {
    which: Meal;
    startedAt: number;
    /** 'had': the person said when they had the meal (B-09), not when it started. Absent: when it started. */
    basis?: 'had';
  };
  /** The person's own target, in minutes. Absent means none. */
  targetMinutes?: number;
  /** Measure distance and pace with GPS. */
  gps: boolean;
  /** Count steps with the motion sensor. */
  steps: boolean;
  /** The person keeps routes on this phone (§9.1): the route is journalled while walking and saved with the walk. */
  keepRoute?: boolean;
  /** Motion access was turned down at the start (B-01): steps aren't counted, and the walk says so. */
  stepsDenied?: boolean;
  /** Where Done returns to. */
  from?: WalkOrigin;
}

/**
 * Why a segment closed. `midnight` is not a stop: a walk being watched at
 * midnight carries straight on in a new segment, so each segment belongs to
 * one local day and its time, distance and steps are credited to that day
 * (re-audit F17). Nor is `timeZone`: the phone's offset changed, travelling
 * or at a daylight-saving change, so each segment also keeps one offset
 * (H6-10).
 */
export type SegmentEnd = 'paused' | 'hidden' | 'left' | 'interrupted' | 'midnight' | 'clockChange' | 'timeZone' | 'finished';

export interface Segment {
  /** Epoch ms. */
  start: number;
  /** Absent while the segment is being recorded. */
  end?: number;
  endedBy?: SegmentEnd;
  /**
   * Each unbroken stretch of GPS signal inside this segment: when, and how
   * far. Distance never crosses a gap between them, and their spans are the
   * time GPS was measuring. A run with no span (one fix) measured nothing.
   */
  gps: GpsRun[];
  steps: number;
  /** Motion samples arrived, so `steps` is a count rather than a blank. */
  motion: boolean;
  /** Time observed in this segment (B-19), accrued tick by tick: a change to the clock never stretches or shrinks it. */
  accruedMs: number;
  /** The device-clock moment the accrual has reached. */
  accruedAt: number;
  /** The local day the segment began on and its UTC offset in minutes (B-19, F17): what its records carry, wherever they are saved. */
  day: string;
  offsetMin: number;
}

/** Why recording stopped without the person pausing it. */
export type GapCause = 'hidden' | 'interrupted' | 'left';

/** Time between two segments that nobody was watching. */
export interface Gap {
  start: number;
  end: number;
  cause: GapCause;
  /**
   * The person said they kept walking. Stored as time they entered, never as
   * observed time: a correction, not a retroactive observation.
   */
  added: boolean;
}

/**
 * `running` records into an open segment. `paused` is the person's choice.
 * `away` is recording stopped by the platform: the app was hidden or the
 * screen was closed, and the walk waits for them to come back.
 */
export type WalkStatus = 'running' | 'paused' | 'away' | 'finished';

/** How a walk ended: the Finish button, the stop guidance, a low, or left open too long. */
/** `emergency`: ended for symptoms that need help now, said on this walk or arriving during it. */
/** `interrupted`: the app closed or crashed mid-walk, and Home saved what the journal kept (journey §9.4). */
export type EndedBy = 'finish' | 'stop' | 'low' | 'emergency' | 'stale' | 'interrupted';

/** A 0–10 answer and when it was given. */
export interface PainAnswer {
  value: number;
  at: number;
}

export interface Walk {
  version: 1;
  id: string;
  plan: WalkPlan;
  startedAt: number;
  status: WalkStatus;
  segments: Segment[];
  gaps: Gap[];
  /** While `away`: when recording stopped, and why. */
  awaySince?: number;
  awayCause?: GapCause;
  /** The last moment the walk screen was alive, for recovering after a reload. */
  seenAt: number;
  finishedAt?: number;
  endedBy?: EndedBy;
  /** "How is your back and leg now?", both optional. */
  pain?: { back?: PainAnswer; leg?: PainAnswer };
  /** B-19: when this walk saw the phone's clock change. A restart then asks for a fresh reading. */
  clockChangedAt?: number;
  /**
   * B-19, walks recorded before board D174: the glucose readings the device
   * knew at each change, by identity. Still read, so such a walk isn't lost;
   * the device keeps the change now (`settings.walk.clock`), and nothing
   * reads this.
   */
  untimedReadings?: string[];
}

/**
 * Past this, a walk nobody has seen is offered as "finish and save what was
 * recorded" rather than resumed. Long enough for a real walk with a long
 * pause, short enough that last night's forgotten walk is not resumed today.
 */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Whether a walk last seen recording at `since` is left open at `now`:
 * coming back then finishes it, when it was last seen, rather than carrying
 * it on. The one threshold the live screen and the Walk hub both read.
 */
export const leftOpen = (since: number, now: number): boolean => now - since > STALE_AFTER_MS;

/** When this device last saw the walk recording: what `leftOpen` counts from. */
export function lastSeen(walk: Walk): number {
  return walk.status === 'away' && walk.awaySince !== undefined ? walk.awaySince : walk.seenAt;
}

/**
 * Closing and reopening the walk screen this fast is not a real absence — it
 * is React's development double-mount, or a route bouncing — so the segment
 * simply carries on. Only for a closed screen: a hidden app always leaves a
 * gap, however short, because nothing was observing during it.
 */
export const REMOUNT_GRACE_MS = 250;

/** B-19: the device clock and the monotonic one disagreeing by more than this in one step is a change to the clock. */
export const CLOCK_JUMP_MS = 120_000;

/** The two clocks at one moment. */
export interface Clocks { wall: number; mono: number }

/**
 * One accrual step (B-19, H6-09): always the monotonic step, which only time
 * passing moves. The device clock's step only tells whether the clock was
 * changed: by more than two minutes against the monotonic one, it was. A
 * smaller change, however often, adds and takes away nothing.
 */
export function stepOf(from: Clocks, to: Clocks): { ms: number; jumped: boolean } {
  const wall = to.wall - from.wall;
  const mono = to.mono - from.mono;
  return { ms: Math.max(0, mono), jumped: Math.abs(wall - mono) > CLOCK_JUMP_MS };
}

function emptySegment(start: number): Segment {
  const offsetMin = offsetAt(start);
  return { start, gps: [], steps: 0, motion: false, accruedMs: 0, accruedAt: start, day: dayAt(start, offsetMin), offsetMin };
}

/** The first local midnight after `t`. `setHours(24)` keeps it right across a clock change. */
export function nextMidnight(t: number): number {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** GPS distance in a segment: the sum of its runs. */
export function segmentDistance(s: Pick<Segment, 'gps'>): number {
  return s.gps.reduce((t, r) => t + r.distanceM, 0);
}

/** Time GPS was measuring in a segment. */
export function segmentGpsMs(s: Pick<Segment, 'gps'>): number {
  return s.gps.reduce((t, r) => t + Math.max(0, r.end - r.start), 0);
}

/** A run with a span: two fixes at different times, so a real measurement, even of 0 m. */
export function measuredRuns(s: Pick<Segment, 'gps'>): GpsRun[] {
  return s.gps.filter(r => r.end > r.start);
}

export function startWalk(id: string, plan: WalkPlan, now: number): Walk {
  return {
    version: 1,
    id,
    plan,
    startedAt: now,
    status: 'running',
    segments: [emptySegment(now)],
    gaps: [],
    seenAt: now,
  };
}

/** The segment being recorded, if there is one. */
export function openSegment(walk: Walk): Segment | undefined {
  const last = walk.segments[walk.segments.length - 1];
  return last && last.end === undefined ? last : undefined;
}

/** A segment closed at `at`: its accrual reaches `at` from where the last tick left it. */
function closed(s: Segment, at: number, endedBy: SegmentEnd): Segment {
  // A clock that stepped backwards must not produce a negative segment.
  return { ...s, end: Math.max(s.start, at), endedBy, accruedMs: s.accruedMs + Math.max(0, at - s.accruedAt), accruedAt: Math.max(s.accruedAt, at) };
}

function closeOpen(walk: Walk, at: number, endedBy: SegmentEnd): Segment[] {
  return walk.segments.map((s, i) => (i === walk.segments.length - 1 && s.end === undefined ? closed(s, at, endedBy) : s));
}

function segmentMs(s: Segment, now: number): number {
  return s.end !== undefined ? s.accruedMs : s.accruedMs + Math.max(0, now - s.accruedAt);
}

/** Time actually observed. Gaps and pauses are not in it. */
export function observedMs(walk: Walk, now: number): number {
  return walk.segments.reduce((total, s) => total + segmentMs(s, now), 0);
}

export function pauseWalk(walk: Walk, now: number): Walk {
  if (walk.status !== 'running') return walk;
  return { ...walk, status: 'paused', segments: closeOpen(walk, now, 'paused'), seenAt: now };
}

export function resumeWalk(walk: Walk, now: number): Walk {
  if (walk.status !== 'paused') return walk;
  return { ...walk, status: 'running', segments: [...walk.segments, emptySegment(now)], seenAt: now };
}

/**
 * Recording stops without the person choosing it: the app was hidden, or the
 * walk screen was closed. A paused walk has nothing to stop.
 */
export function leaveWalk(walk: Walk, now: number, cause: GapCause): Walk {
  if (walk.status !== 'running') return walk;
  const endedBy: SegmentEnd = cause === 'hidden' ? 'hidden' : cause === 'left' ? 'left' : 'interrupted';
  return {
    ...walk,
    status: 'away',
    segments: closeOpen(walk, now, endedBy),
    awaySince: now,
    awayCause: cause,
    seenAt: now,
  };
}

export interface Return {
  walk: Walk;
  /** The gap just stamped, if one was. */
  gap?: Gap;
}

/**
 * The person is back. A new segment starts — never a line drawn across the
 * gap — unless they were away so long that the walk is finished instead.
 */
export function returnToWalk(walk: Walk, now: number): Return {
  if (walk.status !== 'away' || walk.awaySince === undefined) return { walk };
  const since = walk.awaySince;
  const cause = walk.awayCause ?? 'hidden';
  const away = Math.max(0, now - since);
  const base = { ...walk, awaySince: undefined, awayCause: undefined };

  if (leftOpen(since, now)) {
    return { walk: { ...base, status: 'finished', finishedAt: since, endedBy: 'stale', seenAt: now } };
  }

  const last = walk.segments[walk.segments.length - 1];
  if (cause === 'left' && away <= REMOUNT_GRACE_MS && last?.endedBy === 'left') {
    const reopened = walk.segments.map((s, i) =>
      i === walk.segments.length - 1 ? { ...s, end: undefined, endedBy: undefined } : s,
    );
    return { walk: { ...base, status: 'running', segments: reopened, seenAt: now } };
  }

  const gap: Gap = { start: since, end: Math.max(since, now), cause, added: false };
  return {
    walk: { ...base, status: 'running', segments: [...walk.segments, emptySegment(now)], gaps: [...walk.gaps, gap], seenAt: now },
    gap,
  };
}

export function finishWalk(walk: Walk, now: number, endedBy: EndedBy): Walk {
  if (walk.status === 'finished') return walk;
  const finishedAt = walk.status === 'away' && walk.awaySince !== undefined ? walk.awaySince : now;
  return {
    ...walk,
    status: 'finished',
    segments: closeOpen(walk, now, 'finished'),
    awaySince: undefined,
    awayCause: undefined,
    finishedAt,
    endedBy,
    seenAt: now,
  };
}

/** The walk screen is alive: remember so, for a reload to recover from. */
export function heartbeat(walk: Walk, now: number): Walk {
  if (walk.status === 'finished' || walk.status === 'away') return walk;
  return { ...walk, seenAt: Math.max(walk.seenAt, now) };
}

/**
 * A walk read back after a reload. The page went away without closing its
 * segment, so the segment ends at the last moment the screen was seen alive,
 * and the time since is a gap like any other. A paused walk nobody has seen
 * for hours is finished rather than resumed.
 */
export function restoreWalk(walk: Walk, now: number): Walk {
  if (walk.status === 'running') {
    const seen = Math.min(walk.seenAt, now);
    return {
      ...walk,
      status: 'away',
      segments: closeOpen(walk, seen, 'interrupted'),
      awaySince: seen,
      awayCause: 'interrupted',
    };
  }
  if (walk.status === 'paused' && leftOpen(walk.seenAt, now)) {
    return { ...walk, status: 'finished', finishedAt: walk.seenAt, endedBy: 'stale' };
  }
  return walk;
}

/** Count a gap as walking, because the person said they kept walking. */
export function addGapTime(walk: Walk, index: number): Walk {
  if (!walk.gaps[index]) return walk;
  return { ...walk, gaps: walk.gaps.map((g, i) => (i === index ? { ...g, added: true } : g)) };
}

/**
 * Steps credited to the segments they happened in, by their own times: a
 * walking run is confirmed a few steps in, so a run confirmed just after
 * midnight can hold steps from before it (re-audit N03). A step outside every
 * segment — a sensor clock a little off — goes to the open segment, where it
 * was counted.
 */
export function creditSteps(walk: Walk, times: readonly number[]): Walk {
  if (times.length === 0) return walk;
  const segments = walk.segments.map(s => ({ ...s }));
  for (const t of times) {
    const i = segments.findIndex(s => t >= s.start && (s.end === undefined || t < s.end));
    const target = segments[i >= 0 ? i : segments.length - 1];
    target.steps += 1;
    target.motion = true;
  }
  return { ...walk, segments };
}

/**
 * A walk being recorded at local midnight: close its segment at midnight and
 * carry on in a new one from that instant. No gap, no pause — the walk was
 * watched throughout — only a boundary, so the record can credit each day
 * with its own time, distance and steps.
 */
export function splitAtMidnight(walk: Walk, now: number): Walk {
  let next = walk;
  for (;;) {
    const open = next.status === 'running' ? openSegment(next) : undefined;
    if (!open) return next;
    const boundary = nextMidnight(open.start);
    if (boundary > now) return next;
    // Time accrued past midnight belongs to the new day's segment.
    const reached = open.accruedMs + Math.max(0, boundary - open.accruedAt);
    const excess = Math.min(reached, Math.max(0, open.accruedAt - boundary));
    const before: Segment = { ...open, end: boundary, endedBy: 'midnight', accruedMs: reached - excess, accruedAt: boundary };
    const after: Segment = { ...emptySegment(boundary), accruedMs: excess, accruedAt: Math.max(boundary, open.accruedAt) };
    next = { ...next, segments: [...next.segments.slice(0, -1), before, after] };
  }
}

/** Apply a change to the segment being recorded. */
export function updateOpenSegment(walk: Walk, change: (s: Segment) => Segment): Walk {
  if (!openSegment(walk)) return walk;
  return { ...walk, segments: walk.segments.map((s, i) => (i === walk.segments.length - 1 ? change(s) : s)) };
}

/** Add `ms` to the segment being recorded, its accrual reaching `wall` (B-19). */
export function accrueOpen(walk: Walk, ms: number, wall: number): Walk {
  return updateOpenSegment(walk, s => ({ ...s, accruedMs: s.accruedMs + ms, accruedAt: wall }));
}

/**
 * The phone's clock changed (B-19): the open segment closes at the change, in
 * the clock it was recorded by, with `ms` (the monotonic step) counted; the
 * next opens at the new time. No gap: the walk was watched throughout.
 *
 * The walk keeps the latest change. Which readings it leaves untimed is the
 * device's to keep, not the walk's (`markClockChange`, board D174).
 */
export function splitAtClockChange(walk: Walk, wall: number, ms: number): Walk {
  const open = walk.status === 'running' ? openSegment(walk) : undefined;
  if (!open) return walk;
  const end = open.accruedAt + ms;
  const before: Segment = { ...open, end: Math.max(open.start, end), endedBy: 'clockChange', accruedMs: open.accruedMs + ms, accruedAt: end };
  return { ...walk, clockChangedAt: wall, segments: [...walk.segments.slice(0, -1), before, emptySegment(wall)] };
}

/**
 * The phone's offset from UTC changed (H6-10): it travelled to another time
 * zone, or daylight saving began or ended. Its clock didn't jump, so B-19's
 * check never sees this. The open segment, accrued to `now` by the caller,
 * closes at `now` in the offset it was recorded in; the next opens at `now`
 * in the new offset, with that zone's day. No gap: the walk was watched
 * throughout.
 */
export function splitAtOffsetChange(walk: Walk, now: number): Walk {
  // Only a walk recording has a segment open: a pause, a gap or the finish closed it.
  const open = openSegment(walk);
  if (!open || offsetAt(now) === open.offsetMin) return walk;
  // A clock set back a little as well never closes a segment before it began.
  const before: Segment = { ...open, end: Math.max(open.start, now), endedBy: 'timeZone' };
  return { ...walk, segments: [...walk.segments.slice(0, -1), before, emptySegment(now)] };
}

/** The local days on either side of these instants: where the readings a clock change leaves untimed are kept (B-19). */
export function daysAround(...instants: number[]): string[] {
  const DAY = 86_400_000;
  return [...new Set(instants.flatMap(t => [t - DAY, t, t + DAY].map(x => toDateString(new Date(x)))))].sort();
}
