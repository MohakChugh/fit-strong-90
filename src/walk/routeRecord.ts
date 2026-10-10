/**
 * A walk's route as the `routes` store keeps it (journey §18.2, B-17).
 *
 * One line per unbroken stretch of counted GPS movement, never joined across
 * a gap: a dropout, a screen lock or a jump no walker could make each starts
 * a new line, so the drawing never invents a path. Every point keeps its
 * time, so splits read distance and time off the same intervals. Kept only
 * when the person said yes to keeping routes on this phone (§9.1).
 */
import { isAt } from '@/health/observation';
import { isWalkId } from './plan';

/** [latitude, longitude] in degrees, kept to 6 decimal places (about 0.1 m). */
export type LatLon = [number, number];

export interface RouteLine {
  /** Epoch ms of the first point and of the last. */
  start: number;
  end: number;
  coords: LatLon[];
  /** For each point, ms after `start`: 0 first, never decreasing, `end - start` last. */
  ms: number[];
}

/** [south, west, north, east], in degrees. */
export type Bbox = [number, number, number, number];

export interface RouteRecord {
  walkId: string;
  version: 1;
  /** The walk's first observed moment, ISO with its offset. */
  startedAt: string;
  segments: RouteLine[];
  bbox: Bbox;
}

/** The most one route holds: about 100 km of walking at a point every 5 m. */
export const ROUTE_LIMITS = { lines: 1_000, points: 20_000 } as const;

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A coordinate as the store keeps it. */
export const roundCoord = (d: number): number => Math.round(d * 1e6) / 1e6;

/** The box around every point, or nothing when there are none. */
export function bboxOf(lines: readonly RouteLine[]): Bbox | undefined {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const line of lines) {
    for (const [lat, lon] of line.coords) {
      s = Math.min(s, lat); n = Math.max(n, lat);
      w = Math.min(w, lon); e = Math.max(e, lon);
    }
  }
  return Number.isFinite(s) ? [s, w, n, e] : undefined;
}

/**
 * At most `limit` points in all, the earliest kept: a walk longer than the
 * limit keeps its first 100 km. Lines left with fewer than two points go.
 */
export function capLines(lines: readonly RouteLine[], limit: number = ROUTE_LIMITS.points): RouteLine[] {
  const out: RouteLine[] = [];
  let left = limit;
  for (const l of lines) {
    if (left < 2 || out.length >= ROUTE_LIMITS.lines) break;
    if (l.coords.length <= left) {
      out.push(l);
      left -= l.coords.length;
      continue;
    }
    out.push({ start: l.start, end: l.start + l.ms[left - 1], coords: l.coords.slice(0, left), ms: l.ms.slice(0, left) });
    break;
  }
  return out.filter(l => l.coords.length >= 2);
}

/** Why one line is not one a walk could have recorded, or nothing. */
export function lineProblem(x: unknown): string | undefined {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return 'a route line is not an object';
  const l = x as Record<string, unknown>;
  if (!finite(l.start) || !finite(l.end) || l.start < 0 || l.end < l.start) return 'a route line has impossible times';
  if (!Array.isArray(l.coords) || !Array.isArray(l.ms) || l.coords.length !== l.ms.length || l.coords.length < 2) {
    return 'a route line needs at least two timed points';
  }
  for (const p of l.coords) {
    if (!Array.isArray(p) || p.length !== 2 || !finite(p[0]) || !finite(p[1]) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180) {
      return 'a route point has an impossible coordinate';
    }
  }
  let last = 0;
  for (const [i, t] of l.ms.entries()) {
    if (!finite(t) || (i === 0 ? t !== 0 : t < last)) return 'a route line has points out of time order';
    last = t;
  }
  if (last !== l.end - l.start) return 'a route line’s times do not match its span';
  return undefined;
}

/** Why a stored or imported route cannot be read, or nothing (journey §18.3). */
export function routeProblem(r: Record<string, unknown>): string | undefined {
  if (!isWalkId(r.walkId)) return 'a route needs the walk it belongs to';
  if (r.version !== 1) return 'a route of an unknown version';
  if (!isAt(r.startedAt)) return 'a route needs its startedAt, ISO with an offset';
  if (!Array.isArray(r.segments) || r.segments.length === 0 || r.segments.length > ROUTE_LIMITS.lines) {
    return `a route needs between 1 and ${ROUTE_LIMITS.lines} lines`;
  }
  let points = 0;
  for (const line of r.segments) {
    const problem = lineProblem(line);
    if (problem) return problem;
    points += (line as RouteLine).coords.length;
  }
  if (points > ROUTE_LIMITS.points) return `a route holds more than ${ROUTE_LIMITS.points} points`;
  const box = bboxOf(r.segments as RouteLine[])!;
  if (!Array.isArray(r.bbox) || r.bbox.length !== 4 || r.bbox.some((v, i) => !finite(v) || Math.abs(v - box[i]) > 1e-9)) {
    return 'a route’s box does not match its points';
  }
  return undefined;
}

/** The route kept for a walk: its lines of two points or more, within the limits. Nothing when none is left. */
export function routeRecord(walkId: string, startedAt: string, lines: readonly RouteLine[]): RouteRecord | undefined {
  const segments = capLines(lines);
  const bbox = bboxOf(segments);
  return bbox ? { walkId, version: 1, startedAt, segments, bbox } : undefined;
}
