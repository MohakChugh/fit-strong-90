/**
 * A finished walk: what it says, and the observations it becomes.
 *
 * Every record claims exactly the interval it describes (`at` is when it
 * started, `coverageMs` how long), so `aggregate.ts` can detect overlaps and
 * no record covers time nobody observed:
 *
 * - time: one record per segment — a span the app actually watched — cut
 *   again at each local midnight, so every day is credited with its own
 *   minutes (re-audit F17);
 * - distance: one record per run of GPS signal, over the time GPS was
 *   measuring, so a pace read back from the record is the pace the walk
 *   showed (F16) and distance never crosses a signal gap (F15);
 * - steps: one record per segment, counted while it ran.
 *
 * Distance or steps that cannot be divided between two days are kept whole
 * and said to be undivided, never split by a guess. Time the person added for
 * a gap is `manual`, over the gap's own interval: a correction, not an
 * observation (codex-vision §9). Everything carries `context: walk:<id>`,
 * which is how the records of one walk are found again.
 *
 * No position is ever written. The track is used to measure and forgotten.
 */

import { nowAt, type Observation, type ObservationInput } from '@/health/observation';
import { sum } from '@/health/aggregate';
import { StoreFailure, type StoreResult } from '@/store/db';
import { measuredRuns, nextMidnight, type Walk } from './clock';
import { afterMealTitle } from './plan';
import { timeOfDay } from './format';

/** A segment shorter than this observed nothing worth a record. */
export const MIN_RECORD_MS = 1000;

/** Below these, an average pace would be noise rather than a pace. */
const PACE_MIN_DISTANCE_M = 100;
const PACE_MIN_COVERED_MS = 60_000;

/**
 * Seconds per km over the time GPS was measuring — the one pace calculation,
 * used by the walk's summary and by every screen reading a saved walk, so the
 * same walk never shows two paces. Nothing when the basis is too thin.
 */
export function averagePace(distanceM: number | undefined, gpsMs: number): number | undefined {
  if (distanceM === undefined || distanceM < PACE_MIN_DISTANCE_M || gpsMs < PACE_MIN_COVERED_MS) return undefined;
  return gpsMs / 1000 / (distanceM / 1000);
}

export interface WalkSummary {
  /** Time observed while the app was open. */
  observedMs: number;
  /** Time the person added for gaps they say they were walking through. */
  addedMs: number;
  /** Gaps not added: time the app was away and nothing was recorded. */
  awayMs: number;
  /** First moment observed, and the last. */
  from: number;
  to: number;
  /** Absent when GPS was off or never had two usable fixes. */
  distanceM?: number;
  /** Share of observed time with usable GPS, 0–1. Absent when GPS was off. */
  gpsCoverage?: number;
  /** Seconds per km over the time GPS covered. */
  paceSecPerKm?: number;
  /** Absent when steps were off or no motion samples arrived. */
  steps?: number;
}

const segmentMs = (s: { start: number; end?: number }) => Math.max(0, (s.end ?? s.start) - s.start);

export function summarise(walk: Walk): WalkSummary {
  const observedMs = walk.segments.reduce((t, s) => t + segmentMs(s), 0);
  const addedMs = walk.gaps.filter(g => g.added).reduce((t, g) => t + (g.end - g.start), 0);
  const awayMs = walk.gaps.filter(g => !g.added).reduce((t, g) => t + (g.end - g.start), 0);
  const last = walk.segments[walk.segments.length - 1];

  const runs = walk.plan.gps ? walk.segments.flatMap(measuredRuns) : [];
  const distanceM = runs.length ? runs.reduce((t, r) => t + r.distanceM, 0) : undefined;
  const coveredMs = runs.reduce((t, r) => t + (r.end - r.start), 0);
  const counted = walk.segments.filter(s => s.motion);
  const pace = averagePace(distanceM, coveredMs);

  return {
    observedMs,
    addedMs,
    awayMs,
    from: walk.segments[0].start,
    to: last.end ?? last.start,
    ...(distanceM !== undefined ? { distanceM } : {}),
    ...(walk.plan.gps ? { gpsCoverage: observedMs > 0 ? Math.min(1, coveredMs / observedMs) : 0 } : {}),
    ...(pace !== undefined ? { paceSecPerKm: pace } : {}),
    ...(walk.plan.steps && counted.length ? { steps: counted.reduce((t, s) => t + s.steps, 0) } : {}),
  };
}

/** Is there anything to save at all? */
export function hasRecord(walk: Walk): boolean {
  return walkObservations(walk).length > 0;
}

const minutes = (ms: number) => Math.round((ms / 60_000) * 100) / 100;

/** Notes joined into one, leaving out any that are absent. */
const joined = (...notes: (string | undefined)[]) => notes.filter(Boolean).join(' ') || undefined;

/** What the records say about the walk as a whole, for anyone reading them later. */
function noteFor(walk: Walk, time: (epochMs: number) => string): string | undefined {
  const parts: string[] = [];
  if (walk.plan.kind === 'afterMeal' && walk.plan.meal) {
    parts.push(`${afterMealTitle(walk.plan.meal.which)}, which started at ${time(walk.plan.meal.startedAt)}.`);
  }
  if (walk.endedBy === 'low') parts.push('Ended because you felt low.');
  if (walk.endedBy === 'emergency') parts.push('Ended because of symptoms that need emergency help.');
  return parts.length ? parts.join(' ') : undefined;
}

/** An interval cut at each local midnight inside it, so each day gets its own share. */
function byDay(start: number, end: number): { start: number; end: number }[] {
  const pieces: { start: number; end: number }[] = [];
  for (let from = start; from < end; ) {
    const to = Math.min(end, nextMidnight(from));
    pieces.push({ start: from, end: to });
    from = to;
  }
  return pieces;
}

const crossesMidnight = (start: number, end: number) => nextMidnight(start) < end;

const UNDIVIDED = 'Measured across midnight, so it is not divided between the two days.';

export interface ObservationOptions {
  /** How a time of day reads in a note. Defaults to the device's convention. */
  time?: (epochMs: number) => string;
}

/** A record of a walk: every one carries its stable id. */
export type WalkInput = ObservationInput & { id: string };

/** The observations a finished walk is saved as. Ids are stable, so a retry finds what is already saved. */
export function walkObservations(walk: Walk, options: ObservationOptions = {}): WalkInput[] {
  const context = `walk:${walk.id}`;
  const note = noteFor(walk, options.time ?? (t => timeOfDay(t)));
  const withNote = (text: string | undefined) => (text ? { note: text } : {});
  // The meal it followed, as data and not only words, so a walk after dinner
  // can be found as one (D26). The note still names which meal.
  const meal = walk.plan.kind === 'afterMeal' && walk.plan.meal
    ? { tag: 'afterMeal' as const, mealStartedAt: nowAt(new Date(walk.plan.meal.startedAt)) }
    : {};
  const out: WalkInput[] = [];

  walk.segments.forEach((s, i) => {
    const end = s.end ?? s.start;
    if (end - s.start < MIN_RECORD_MS) return;
    const measured = { scope: 'sessionObserved' as const, source: 'measured' as const, context, ...meal };

    // Time, a record per day the segment touched.
    byDay(s.start, end).forEach((piece, k) => {
      const ms = piece.end - piece.start;
      if (ms < MIN_RECORD_MS) return;
      const at = { at: nowAt(new Date(piece.start)), coverageMs: ms, ...withNote(note) };
      const id = (kind: string) => `${walk.id}:s${i}${k ? `.${k}` : ''}:${kind}`;
      out.push({ ...measured, ...at, id: id('walkDuration'), kind: 'walkDuration', value: minutes(ms) });
      out.push({ ...measured, ...at, id: id('movementMinutes'), kind: 'movementMinutes', value: minutes(ms) });
    });

    // Distance, a record per run of signal, over the time GPS was measuring.
    if (walk.plan.gps) {
      measuredRuns(s).forEach((run, j) => {
        const from = Math.max(run.start, s.start);
        const to = Math.min(run.end, end);
        if (to <= from) return;
        const undivided = crossesMidnight(from, to);
        out.push({
          ...measured, id: `${walk.id}:s${i}:r${j}:walkDistance`, kind: 'walkDistance', value: Math.round(run.distanceM) / 1000,
          at: nowAt(new Date(from)), coverageMs: to - from, ...withNote(joined(note, undivided ? UNDIVIDED : undefined)),
        });
      });
    }

    if (walk.plan.steps && s.motion) {
      const undivided = crossesMidnight(s.start, end);
      out.push({
        ...measured, id: `${walk.id}:s${i}:steps`, kind: 'steps', value: s.steps,
        at: nowAt(new Date(s.start)), coverageMs: end - s.start, ...withNote(joined(note, undivided ? UNDIVIDED : undefined)),
      });
    }
  });

  walk.gaps.forEach((g, i) => {
    if (!g.added || g.end - g.start < MIN_RECORD_MS) return;
    const added = joined('Added by you: time the app was away, which it could not record.', note);
    byDay(g.start, g.end).forEach((piece, k) => {
      const ms = piece.end - piece.start;
      if (ms < MIN_RECORD_MS) return;
      const shared = {
        scope: 'sessionObserved' as const, source: 'manual' as const, at: nowAt(new Date(piece.start)), coverageMs: ms, context, ...meal,
        ...withNote(added),
      };
      const id = (kind: string) => `${walk.id}:g${i}${k ? `.${k}` : ''}:${kind}`;
      out.push({ ...shared, id: id('walkDuration'), kind: 'walkDuration', value: minutes(ms) });
      out.push({ ...shared, id: id('movementMinutes'), kind: 'movementMinutes', value: minutes(ms) });
    });
  });

  const pain = walk.pain ?? {};
  const answered = (kind: 'backPain' | 'legPain', answer: { value: number; at: number }) => ({
    id: `${walk.id}:${kind}`, kind, value: answer.value, scope: 'pointInTime' as const, source: 'manual' as const,
    at: nowAt(new Date(answer.at)), context, note: 'After a walk.',
  });
  if (pain.back) out.push(answered('backPain', pain.back));
  if (pain.leg) out.push(answered('legPain', pain.leg));

  return out;
}

/** How many batches one save tries before saying it did not save. */
export const SAVE_ATTEMPTS = 3;

/**
 * Save the walk's observations as one: every record, or none (re-audit F09).
 * Ids already on the device are left out — one id is one record, and the
 * store refuses a second — so "Try again" after any failure writes exactly
 * what is missing. `storedIds` is asked afresh before every batch.
 *
 * If records arrive between the look and the write, the store refuses the
 * batch and names them; they are this walk's own ids, so they are saved, and
 * the rest is tried again. It is saved only when every record is on the
 * device: running out of tries with any still missing is a failure, never a
 * success (N02), so the walk is kept and can be saved again.
 */
export async function saveObservations(
  inputs: readonly WalkInput[],
  storedIds: () => ReadonlySet<string>,
  addAll: (inputs: readonly ObservationInput[]) => Promise<StoreResult<Observation[]>>,
): Promise<StoreResult> {
  /** Named by the store as already on the device. */
  const named = new Set<string>();
  const missing = () => {
    const stored = storedIds();
    return inputs.filter(input => !stored.has(input.id) && !named.has(input.id));
  };
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const rest = missing();
    if (rest.length === 0) return { ok: true, value: undefined };
    const written = await addAll(rest);
    if (written.ok) return { ok: true, value: undefined };
    if (written.failure.code !== 'conflict') return { ok: false, failure: written.failure };
    for (const d of written.failure.details ?? []) if (d.id !== undefined) named.add(d.id);
  }
  if (missing().length === 0) return { ok: true, value: undefined };
  return { ok: false, failure: new StoreFailure('conflict', 'Part of it was being saved from somewhere else at the same moment.') };
}

/**
 * What a save comes to on screen. "Saved" only from a device that is saving:
 * after "Continue without saving" the store keeps writes in memory and says
 * so, and a second try then finds every record "already there". That walk is
 * kept for now — until the app closes — never saved, and its draft must stay
 * (M-07). Any other refusal is a failure to say.
 */
export type SaveOutcome = { kind: 'saved' } | { kind: 'kept' } | { kind: 'failed'; message: string };

export function saveOutcome(result: StoreResult, memoryOnly: boolean): SaveOutcome {
  if (memoryOnly && (result.ok || result.failure.code === 'unavailable')) return { kind: 'kept' };
  return result.ok ? { kind: 'saved' } : { kind: 'failed', message: result.failure.message };
}

/**
 * Every record of this walk on the device, found by its context rather than
 * by a list kept beside the draft: a reload in the middle of a save can lose
 * such a list, and a discarded walk must leave nothing behind (F09).
 */
export function walkObservationIds(walkId: string, observations: readonly Observation[]): string[] {
  const context = `walk:${walkId}`;
  return observations.filter(o => o.context === context).map(o => o.id);
}

export interface WalkRecord {
  /** The walk's id, from `walk:<id>`. */
  id: string;
  /** The local day the walk started on. */
  day: string;
  /** When the first observed segment started, ISO with offset. */
  at: string;
  /** Observed minutes; time the person added is separate. */
  minutes: number;
  addedMinutes: number;
  distanceKm?: number;
  steps?: number;
  backPain?: number;
  legPain?: number;
  /**
   * Seconds per km over the time GPS was measuring: the same figure the walk
   * showed when it finished. Absent when the records cannot establish it.
   */
  paceSecPerKm?: number;
  /** When the meal it followed started, ISO with offset, for a walk after a meal. */
  mealStartedAt?: string;
  /** The walk's own note, e.g. "After dinner, which started at 7:40 pm." */
  note?: string;
  observations: Observation[];
}

/**
 * Saved walks, put back together from their observations, oldest first — for
 * a Track timeline that should show one walk as one row, not one row per
 * segment. Totals go through `aggregate.sum`, the only place observations are
 * combined (D10); a group it refuses is left out of the figure, never guessed.
 */
export function walkRecords(observations: readonly Observation[]): WalkRecord[] {
  const groups = new Map<string, Observation[]>();
  for (const o of observations) {
    if (!o.context?.startsWith('walk:')) continue;
    const id = o.context.slice(5);
    const held = groups.get(id);
    if (held) held.push(o);
    else groups.set(id, [o]);
  }

  /** A total at the precision the parts were stored in, so 0.712 + 0.588 reads 1.3. */
  const total = (group: Observation[], kind: Observation['kind'], places: number, source?: Observation['source']) => {
    const picked = group.filter(o => o.kind === kind && o.scope === 'sessionObserved' && (source === undefined || o.source === source));
    if (!picked.length) return undefined;
    try {
      const scale = 10 ** places;
      return Math.round(sum(picked).value * scale) / scale;
    } catch {
      return undefined;
    }
  };
  const reading = (group: Observation[], kind: 'backPain' | 'legPain') => group.find(o => o.kind === kind)?.value;

  /**
   * A walk's distance records each cover exactly the time GPS measured them,
   * so their spans are the basis the summary used. Any record without that
   * basis — no interval, or not measured — and the pace is not stated.
   */
  const paceOf = (group: Observation[]) => {
    const distances = group.filter(o => o.kind === 'walkDistance' && o.scope === 'sessionObserved');
    if (!distances.length || distances.some(o => o.source !== 'measured' || !(typeof o.coverageMs === 'number' && o.coverageMs > 0))) return undefined;
    try {
      // Distance through `sum`, and the time of exactly the records it counted.
      const counted = sum(distances);
      return averagePace(counted.value * 1000, counted.contributed.reduce((t, o) => t + (o.coverageMs ?? 0), 0));
    } catch {
      return undefined;
    }
  };

  const records: WalkRecord[] = [];
  for (const [id, group] of groups) {
    const timed = group.filter(o => o.kind === 'walkDuration' && o.scope === 'sessionObserved');
    if (!timed.length) continue;
    const first = [...timed].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    const distanceKm = total(group, 'walkDistance', 3);
    const steps = total(group, 'steps', 0);
    const backPain = reading(group, 'backPain');
    const legPain = reading(group, 'legPain');
    // The walk's own note: a duration's, which never carries a per-record remark.
    const note = timed.find(o => o.source === 'measured' && o.note)?.note;
    const mealStartedAt = group.find(o => o.tag === 'afterMeal' && o.mealStartedAt)?.mealStartedAt;
    const pace = paceOf(group);
    records.push({
      id,
      day: first.day,
      at: first.at,
      minutes: total(group, 'walkDuration', 2, 'measured') ?? 0,
      addedMinutes: total(group, 'walkDuration', 2, 'manual') ?? 0,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
      ...(steps !== undefined ? { steps } : {}),
      ...(backPain !== undefined ? { backPain } : {}),
      ...(legPain !== undefined ? { legPain } : {}),
      ...(pace !== undefined ? { paceSecPerKm: pace } : {}),
      ...(mealStartedAt !== undefined ? { mealStartedAt } : {}),
      ...(note !== undefined ? { note } : {}),
      observations: group,
    });
  }
  return records.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
