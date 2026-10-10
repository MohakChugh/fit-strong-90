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

import type { Meal } from '@/types/habits';
import type { GpsRun } from './gps';

export type WalkKind = 'walk' | 'afterMeal';

export interface WalkPlan {
  kind: WalkKind;
  /** After a meal: which one, and when it started (epoch ms). */
  meal?: { which: Meal; startedAt: number };
  /** The person's own target, in minutes. Absent means none. */
  targetMinutes?: number;
  /** Measure distance and pace with GPS. */
  gps: boolean;
  /** Count steps with the motion sensor. */
  steps: boolean;
}

/**
 * Why a segment closed. `midnight` is not a stop: a walk being watched at
 * midnight carries straight on in a new segment, so each segment belongs to
 * one local day and its time, distance and steps are credited to that day
 * (re-audit F17).
 */
export type SegmentEnd = 'paused' | 'hidden' | 'left' | 'interrupted' | 'midnight' | 'finished';

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
export type EndedBy = 'finish' | 'stop' | 'low' | 'emergency' | 'stale';

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
}

/**
 * Past this, a walk nobody has seen is offered as "finish and save what was
 * recorded" rather than resumed. Long enough for a real walk with a long
 * pause, short enough that last night's forgotten walk is not resumed today.
 */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Closing and reopening the walk screen this fast is not a real absence — it
 * is React's development double-mount, or a route bouncing — so the segment
 * simply carries on. Only for a closed screen: a hidden app always leaves a
 * gap, however short, because nothing was observing during it.
 */
export const REMOUNT_GRACE_MS = 250;

function emptySegment(start: number): Segment {
  return { start, gps: [], steps: 0, motion: false };
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

function closeOpen(walk: Walk, at: number, endedBy: SegmentEnd): Segment[] {
  return walk.segments.map((s, i) =>
    i === walk.segments.length - 1 && s.end === undefined
      // A clock that stepped backwards must not produce a negative segment.
      ? { ...s, end: Math.max(s.start, at), endedBy }
      : s,
  );
}

function segmentMs(s: Segment, now: number): number {
  return Math.max(0, (s.end ?? now) - s.start);
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

  if (away > STALE_AFTER_MS) {
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
  if (walk.status === 'paused' && now - walk.seenAt > STALE_AFTER_MS) {
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
    next = { ...next, segments: [...closeOpen(next, boundary, 'midnight'), emptySegment(boundary)] };
  }
}

/** Apply a change to the segment being recorded. */
export function updateOpenSegment(walk: Walk, change: (s: Segment) => Segment): Walk {
  if (!openSegment(walk)) return walk;
  return { ...walk, segments: walk.segments.map((s, i) => (i === walk.segments.length - 1 ? change(s) : s)) };
}
