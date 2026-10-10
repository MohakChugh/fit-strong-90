/**
 * A walk's recovery state, kept in IndexedDB while it is recorded (journey
 * §9.4, §18.2). It always holds the walk's clock and totals, and holds its
 * route only when the person keeps routes. It isn't part of the record and is
 * never in a backup. It is retired in the transaction that saves the walk
 * (A-55), so a crash leaves the journal or the saved walk, never both.
 */
import type { Walk } from './clock';
import { parseWalk } from './persist';
import { lineProblem, type RouteLine } from './routeRecord';

export const JOURNAL_VERSION = 1;
/** Written at least this often while the walk screen is open, and at every change of state. */
export const CHECKPOINT_MS = 15_000;
/** Older than this, nothing is recording the walk: a desktop tab in the background still writes about once a minute. */
export const JOURNAL_STALE_MS = 120_000;

export interface JournalEntry {
  /** The walk's id. */
  id: string;
  version: 1;
  /** The device-clock moment of this checkpoint. */
  at: number;
  walk: Walk;
  /** Only while the person keeps routes. */
  route?: RouteLine[];
}

const copy = (l: RouteLine): RouteLine => ({ ...l, coords: [...l.coords], ms: [...l.ms] });

export function journalEntry(walk: Walk, at: number, route?: readonly RouteLine[]): JournalEntry {
  return { id: walk.id, version: JOURNAL_VERSION, at, walk, ...(route ? { route: route.filter(l => l.coords.length >= 2).map(copy) } : {}) };
}

export const checkpointDue = (last: number | undefined, now: number): boolean => last === undefined || now - last >= CHECKPOINT_MS;

/** A stored checkpoint, or nothing if any part of it can't be trusted. */
export function parseJournalEntry(raw: unknown): JournalEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== JOURNAL_VERSION || typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  const walk = parseWalk(r.walk);
  if (!walk || walk.id !== r.id) return null;
  if (r.route !== undefined && !(Array.isArray(r.route) && r.route.every(l => lineProblem(l) === undefined))) return null;
  return { id: walk.id, version: JOURNAL_VERSION, at: r.at, walk, ...(r.route ? { route: r.route as RouteLine[] } : {}) };
}
