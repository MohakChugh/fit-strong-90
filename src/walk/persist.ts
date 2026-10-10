/**
 * The walk in progress, kept in `sessionStorage` so it survives a reload of
 * the tab without becoming part of the lifelong record before it is saved.
 *
 * What is kept is the clock and the totals per segment — never a position.
 * The GPS track is used to measure and then forgotten (codex-vision §9), so a
 * walk in progress cannot leak where someone lives.
 *
 * Anything read back is validated in full. A walk that fails validation is
 * not repaired by guessing; it is dropped, because a wrong walk saved as
 * measured would be worse than no walk.
 */

import type { EndedBy, Gap, PainAnswer, Segment, Walk, WalkPlan, WalkStatus } from './clock';
import { isMeal, isWalkId } from './plan';

export const WALK_KEY = 'fit-strong-walk';
/** The last walk id the live screen started, so going back in history cannot start it twice. */
export const LAST_WALK_KEY = 'fit-strong-walk-last';

export type WalkStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STATUSES: readonly WalkStatus[] = ['running', 'paused', 'away', 'finished'];
const ENDINGS: readonly EndedBy[] = ['finish', 'stop', 'low', 'emergency', 'stale'];
const SEGMENT_ENDS: readonly string[] = ['paused', 'hidden', 'left', 'interrupted', 'midnight', 'finished'];
const CAUSES: readonly Gap['cause'][] = ['hidden', 'interrupted', 'left'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function isPlan(v: unknown): v is WalkPlan {
  if (!isObject(v)) return false;
  if (v.kind !== 'walk' && v.kind !== 'afterMeal') return false;
  if (typeof v.gps !== 'boolean' || typeof v.steps !== 'boolean') return false;
  if (v.targetMinutes !== undefined && !(Number.isInteger(v.targetMinutes) && (v.targetMinutes as number) > 0)) return false;
  if (v.kind === 'afterMeal') {
    if (!isObject(v.meal) || !isMeal(v.meal.which) || !isTime(v.meal.startedAt)) return false;
  } else if (v.meal !== undefined) {
    return false;
  }
  return true;
}

/** A stretch of GPS signal: times and a distance, never a position. */
function isRun(v: unknown): boolean {
  return isObject(v) && isTime(v.start) && isTime(v.end) && v.end >= v.start && isAmount(v.distanceM) &&
    Object.keys(v).every(k => k === 'start' || k === 'end' || k === 'distanceM');
}

function isSegment(v: unknown): v is Segment {
  if (!isObject(v) || !isTime(v.start)) return false;
  if (v.end !== undefined && !(isTime(v.end) && v.end >= v.start)) return false;
  if ((v.end === undefined) !== (v.endedBy === undefined)) return false;
  if (v.endedBy !== undefined && !SEGMENT_ENDS.includes(v.endedBy as string)) return false;
  return (
    Array.isArray(v.gps) && v.gps.every(isRun) &&
    Number.isInteger(v.steps) && (v.steps as number) >= 0 && typeof v.motion === 'boolean'
  );
}

function isGap(v: unknown): v is Gap {
  return isObject(v) && isTime(v.start) && isTime(v.end) && v.end >= v.start &&
    CAUSES.includes(v.cause as Gap['cause']) && typeof v.added === 'boolean';
}

function isPain(v: unknown): v is PainAnswer {
  return isObject(v) && Number.isInteger(v.value) && (v.value as number) >= 0 && (v.value as number) <= 10 && isTime(v.at);
}

/** A stored walk, or nothing if any part of it cannot be trusted. */
export function parseWalk(raw: unknown): Walk | null {
  if (!isObject(raw) || raw.version !== 1 || !isWalkId(raw.id) || !isPlan(raw.plan)) return null;
  if (!isTime(raw.startedAt) || !isTime(raw.seenAt)) return null;
  if (!STATUSES.includes(raw.status as WalkStatus)) return null;
  const status = raw.status as WalkStatus;

  if (!Array.isArray(raw.segments) || raw.segments.length === 0 || !raw.segments.every(isSegment)) return null;
  const segments = raw.segments as Segment[];
  // In order, not overlapping, and open only at the end while running.
  for (let i = 1; i < segments.length; i++) {
    const before = segments[i - 1];
    if (before.end === undefined || segments[i].start < before.end) return null;
  }
  const open = segments[segments.length - 1].end === undefined;
  if (open !== (status === 'running')) return null;

  if (!Array.isArray(raw.gaps) || !raw.gaps.every(isGap)) return null;

  if (status === 'away') {
    if (!isTime(raw.awaySince) || !CAUSES.includes(raw.awayCause as Gap['cause'])) return null;
  } else if (raw.awaySince !== undefined || raw.awayCause !== undefined) {
    return null;
  }
  if (status === 'finished') {
    if (!isTime(raw.finishedAt) || !ENDINGS.includes(raw.endedBy as EndedBy)) return null;
  } else if (raw.finishedAt !== undefined || raw.endedBy !== undefined) {
    return null;
  }

  if (raw.pain !== undefined) {
    if (!isObject(raw.pain)) return null;
    if (raw.pain.back !== undefined && !isPain(raw.pain.back)) return null;
    if (raw.pain.leg !== undefined && !isPain(raw.pain.leg)) return null;
  }

  return raw as unknown as Walk;
}

/**
 * The walk as last kept, for this page, whatever the storage did. A browser
 * that refuses `sessionStorage`, or a write that fails part-way through a
 * walk, must not lose the walk between the live screen and its summary; the
 * storage only has to carry it across a reload.
 */
const kept = new WeakMap<WalkStorage, Walk>();
let keptWithoutStorage: Walk | null = null;
const lastIds = new WeakMap<WalkStorage, string>();
let lastIdWithoutStorage: string | null = null;

/** The walk kept for this page, else the stored one, else nothing. Never throws. */
export function loadWalk(storage: WalkStorage | undefined): Walk | null {
  const held = storage ? kept.get(storage) : keptWithoutStorage;
  if (held) return held;
  try {
    const raw = storage?.getItem(WALK_KEY);
    return raw ? parseWalk(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Keep the walk. False when the browser would not store it; it is still kept for this page. */
export function storeWalk(storage: WalkStorage | undefined, walk: Walk): boolean {
  if (storage) kept.set(storage, walk);
  else keptWithoutStorage = walk;
  try {
    if (!storage) return false;
    storage.setItem(WALK_KEY, JSON.stringify(walk));
    return true;
  } catch {
    return false;
  }
}

/**
 * Would a reload bring back the walk as this page holds it? False when the
 * latest write was refused, so the page alone holds the walk — which a screen
 * arriving after that write must say at once (F08). Nothing held by the page
 * means what is stored is what a reload finds.
 */
export function draftStored(storage: WalkStorage | undefined): boolean {
  const held = storage ? kept.get(storage) : keptWithoutStorage;
  if (!held) return true;
  try {
    return storage?.getItem(WALK_KEY) === JSON.stringify(held);
  } catch {
    return false;
  }
}

export function clearWalk(storage: WalkStorage | undefined): void {
  if (storage) kept.delete(storage);
  else keptWithoutStorage = null;
  try {
    storage?.removeItem(WALK_KEY);
  } catch {
    // Kept nowhere now for this page; a storage that refuses removal refused the write too.
  }
}

export function lastStartedId(storage: WalkStorage | undefined): string | null {
  const held = storage ? lastIds.get(storage) : lastIdWithoutStorage;
  if (held) return held;
  try {
    return storage?.getItem(LAST_WALK_KEY) ?? null;
  } catch {
    return null;
  }
}

export function markStarted(storage: WalkStorage | undefined, id: string): void {
  if (storage) lastIds.set(storage, id);
  else lastIdWithoutStorage = id;
  try {
    storage?.setItem(LAST_WALK_KEY, id);
  } catch {
    // Kept for this page above; only a reload could forget it.
  }
}

/** The tab's own storage, if this browser offers it. */
export function sessionWalkStorage(): WalkStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

export interface WalkPeek {
  id: string;
  plan: WalkPlan;
  startedAt: number;
  /** `inProgress`: return to it at `/walk/live`. `unsaved`: finished, review and save it at `/walk/summary`. */
  state: 'inProgress' | 'unsaved';
  href: '/walk/live' | '/walk/summary';
}

/**
 * Is there a walk the person has not finished with? For Today and Move, to
 * offer a way back to it rather than a second walk.
 */
export function peekWalk(storage: WalkStorage | undefined = sessionWalkStorage()): WalkPeek | null {
  const walk = loadWalk(storage);
  if (!walk) return null;
  const unsaved = walk.status === 'finished';
  return {
    id: walk.id,
    plan: walk.plan,
    startedAt: walk.startedAt,
    state: unsaved ? 'unsaved' : 'inProgress',
    href: unsaved ? '/walk/summary' : '/walk/live',
  };
}
