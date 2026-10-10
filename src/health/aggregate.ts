/**
 * The only place observations are combined (PLAN.md Task 1, D10).
 *
 * Three rules, and the type system is arranged so a screen cannot route
 * around them:
 *
 * 1. Records of different `scope` are never added. `sum` throws instead of
 *    returning a plausible-looking wrong number.
 * 2. A `dayTotal` *replaces* the previous one of the same kind and source. A
 *    second source's total for the same day is reported, never added to it.
 * 3. `sessionObserved` intervals that overlap are excluded from the total and
 *    reported. A double-counted hour of exercise is a clinical claim. So is a
 *    session whose span is unknown, which cannot be shown not to overlap: it
 *    is reported and left out of the total rather than trusted.
 *
 * `sum` is the strict primitive: it throws. `summariseDay` and `series` are
 * the defensive callers: they group so that `sum` is only ever given a
 * coherent set, and anything left that cannot be combined becomes a flag with
 * no total rather than an exception in a render path. Either way the number is
 * never quietly wrong, and no record is ever hidden.
 *
 * Time is compared as instants throughout. Two records in different offsets —
 * a daylight-saving change, a trip — sort wrongly as strings.
 */

import {
  KINDS,
  OBSERVATION_KINDS,
  bpReadingId,
  compareObservations,
  compareStatements,
  isBpKind,
  isDay,
  type Observation,
  type ObservationKind,
  type ObservationSource,
  type ObservationTag,
  type Scope,
} from './observation';

export type AggregationFault =
  /** Nothing to combine: no kind, no unit, no answer. */
  | 'empty'
  | 'mixedKind'
  | 'mixedScope'
  | 'mixedUnit'
  /** Instantaneous readings: two of them do not make a third. */
  | 'notSummable'
  /** An earlier day total of the same kind and source was superseded. */
  | 'replaced'
  /** More than one source states a total for this day. */
  | 'conflictingSources'
  /** Observed intervals intersect; the later one is not in the total. */
  | 'overlap'
  /** A `sessionObserved` record with no positive span: overlap is unknowable, so it is not counted. */
  | 'missingCoverage'
  /** An interval that runs past local midnight. It counts, whole, on the day it started. */
  | 'spansMidnight'
  /** A record that breaks the rules for its kind (an illegal scope, a negative value). Shown, never totalled. */
  | 'invalidRecord'
  | 'badRange';

export class AggregationError extends Error {
  readonly fault: AggregationFault;

  constructor(fault: AggregationFault, message: string) {
    super(message);
    this.name = 'AggregationError';
    this.fault = fault;
  }
}

/** Two observed intervals that intersect. `excluded` is not in the total. */
export interface Overlap {
  kept: string;
  excluded: string;
  overlapMs: number;
}

/** Something the user should be told, rather than silently absorbed. */
export interface Flag {
  fault: AggregationFault;
  kind: ObservationKind;
  scope: Scope;
  /** Set when every record involved falls on the same local day. */
  day?: string;
  message: string;
  ids: string[];
}

export interface SumResult {
  kind: ObservationKind;
  scope: Scope;
  unit: string;
  value: number;
  /** The records actually in `value`. */
  contributed: Observation[];
  /** Replaced by a newer statement from the same source. */
  superseded: Observation[];
  /** A different source's total for the same day, deliberately not added. */
  conflicting: Observation[];
  overlaps: Overlap[];
  flags: Flag[];
}

function uniqueDay(observations: readonly Observation[]): string | undefined {
  const first = observations[0]?.day;
  return observations.every(o => o.day === first) ? first : undefined;
}

function flag(
  fault: AggregationFault,
  kind: ObservationKind,
  scope: Scope,
  records: readonly Observation[],
  message: string,
  day = uniqueDay(records),
): Flag {
  return { fault, kind, scope, ...(day !== undefined ? { day } : {}), message, ids: records.map(o => o.id) };
}

/**
 * Whether a record can stand in a total: a scope its kind may have, a unit it
 * is measured in, and a value it could take. Anything else got past the
 * validator somehow (an older build, a hand-edited file) and is shown, flagged
 * and left out — never added.
 */
function totalable(o: Observation): boolean {
  const spec = KINDS[o.kind];
  if (!spec || !spec.scopes.includes(o.scope) || !spec.units.includes(o.unit)) return false;
  if (typeof o.value !== 'number' || !Number.isFinite(o.value) || o.value < 0) return false;
  return !spec.range || (o.value >= spec.range[0] && o.value <= spec.range[1]);
}

function hasSpan(o: Observation): boolean {
  return typeof o.coverageMs === 'number' && Number.isFinite(o.coverageMs) && o.coverageMs > 0;
}

function addDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Midnight at the end of a record's own local day, in its own offset. */
function endOfLocalDay(o: Observation): number {
  const offset = o.at.endsWith('Z') ? 'Z' : o.at.slice(-6);
  return Date.parse(`${addDay(o.day)}T00:00:00.000${offset}`);
}

/** Earliest start first; for the same start, the earlier statement is the one kept. */
function byStart(a: Observation, b: Observation): number {
  const d = Date.parse(a.at) - Date.parse(b.at);
  return d !== 0 && Number.isFinite(d) ? Math.sign(d) : compareStatements(a, b);
}

interface Sweep {
  kept: Observation[];
  overlaps: Overlap[];
  /** No positive span: not counted, because overlap cannot be ruled out. */
  uncovered: Observation[];
  /** Kept intervals that run past their local midnight. */
  spanning: Observation[];
}

/**
 * One pass over intervals of one kind, earliest first, holding the furthest
 * end any *counted* interval reaches. An interval starting before that reach
 * overlaps something counted and is left out. O(n log n), so it can run over
 * a lifetime of walks — and it has to, because an overlap does not stop at
 * midnight.
 *
 * Only counted intervals extend the reach: if A is counted and B overlaps it,
 * a C that overlaps only B is counted, because B's time was never added.
 */
function sweep(records: readonly Observation[]): Sweep {
  const timed: Observation[] = [];
  const uncovered: Observation[] = [];
  for (const o of records) (hasSpan(o) ? timed : uncovered).push(o);
  timed.sort(byStart);

  const kept: Observation[] = [];
  const overlaps: Overlap[] = [];
  const spanning: Observation[] = [];
  let reach = -Infinity;
  let reachId = '';
  for (const o of timed) {
    const start = Date.parse(o.at);
    const end = start + (o.coverageMs as number);
    if (start < reach) {
      overlaps.push({ kept: reachId, excluded: o.id, overlapMs: Math.min(reach, end) - start });
      continue;
    }
    kept.push(o);
    reach = end;
    reachId = o.id;
    if (end > endOfLocalDay(o)) spanning.push(o);
  }
  return { kept, overlaps, uncovered, spanning };
}

function intervalFlags(kind: ObservationKind, s: Sweep, all: readonly Observation[], day?: string): Flag[] {
  const flags: Flag[] = [];
  if (s.overlaps.length > 0) {
    const excluded = new Set(s.overlaps.map(o => o.excluded));
    const records = all.filter(o => excluded.has(o.id));
    flags.push(flag('overlap', kind, 'sessionObserved', records, 'Two recorded sessions overlap, so only the first is counted.', day ?? uniqueDay(records)));
  }
  if (s.uncovered.length > 0) {
    flags.push(flag('missingCoverage', kind, 'sessionObserved', s.uncovered,
      'A recorded session does not say how long it covered, so it cannot be checked for overlap and is not counted.', day ?? uniqueDay(s.uncovered)));
  }
  if (s.spanning.length > 0) {
    flags.push(flag('spansMidnight', kind, 'sessionObserved', s.spanning,
      'A session ran past midnight; it is counted on the day it started.', day ?? uniqueDay(s.spanning)));
  }
  return flags;
}

/**
 * Add a coherent set of observations, or refuse.
 *
 * Throws `AggregationError` on anything that would produce a wrong number:
 * more than one kind, more than one scope, more than one unit, a scope that
 * has no meaningful sum, or a record that breaks its kind's rules.
 */
export function sum(observations: readonly Observation[]): SumResult {
  if (observations.length === 0) {
    throw new AggregationError('empty', 'Nothing to add: an empty set has no kind and no unit.');
  }

  const kind = observations[0].kind;
  if (observations.some(o => o.kind !== kind)) {
    const kinds = [...new Set(observations.map(o => o.kind))].join(', ');
    throw new AggregationError('mixedKind', `Cannot add different kinds together: ${kinds}.`);
  }

  const scope = observations[0].scope;
  if (observations.some(o => o.scope !== scope)) {
    const scopes = [...new Set(observations.map(o => o.scope))].join(', ');
    throw new AggregationError(
      'mixedScope',
      `Cannot add ${kind} across scopes (${scopes}): an observed session is not part of a day total.`,
    );
  }

  const unit = observations[0].unit;
  if (observations.some(o => o.unit !== unit)) {
    const units = [...new Set(observations.map(o => o.unit))].join(', ');
    throw new AggregationError('mixedUnit', `Cannot add ${kind} in different units (${units}).`);
  }

  if (scope === 'pointInTime') {
    throw new AggregationError(
      'notSummable',
      `${kind} is an instantaneous reading: two readings do not add up to one.`,
    );
  }

  const invalid = observations.filter(o => !totalable(o));
  if (invalid.length > 0) {
    throw new AggregationError('invalidRecord', `Cannot add ${kind}: ${invalid.length} record(s) break the rules for it.`);
  }

  const day = uniqueDay(observations);

  if (scope === 'dayTotal') {
    // Latest statement per source wins (the replace rule), then the latest of
    // those is what the day shows. Totals from two sources are never added:
    // 8,100 typed and 7,800 imported is one day of walking, not 15,900.
    const bySource = new Map<ObservationSource, Observation>();
    const superseded: Observation[] = [];
    for (const o of [...observations].sort(compareStatements)) {
      const held = bySource.get(o.source);
      if (held !== undefined) superseded.push(held);
      bySource.set(o.source, o);
    }
    const winners = [...bySource.values()].sort(compareStatements);
    const winner = winners[winners.length - 1];
    const conflicting = winners.slice(0, -1);

    const flags: Flag[] = [];
    if (superseded.length > 0) {
      flags.push(flag('replaced', kind, scope, superseded, 'An earlier entry for this day was replaced.', day));
    }
    if (conflicting.length > 0) {
      flags.push(flag(
        'conflictingSources',
        kind,
        scope,
        conflicting,
        'More than one source recorded a total for this day; showing the most recent.',
        day,
      ));
    }

    return {
      kind,
      scope,
      unit,
      value: winner.value,
      contributed: [winner],
      superseded: superseded.sort(compareObservations),
      conflicting,
      overlaps: [],
      flags,
    };
  }

  const s = sweep(observations);
  return {
    kind,
    scope,
    unit,
    value: s.kept.reduce((total, o) => total + o.value, 0),
    contributed: s.kept,
    superseded: [],
    conflicting: [],
    overlaps: s.overlaps,
    flags: intervalFlags(kind, s, observations, day),
  };
}

// ----------------------------------------------------------------------------
// Interval decisions across every day
// ----------------------------------------------------------------------------

interface IntervalDecisions {
  /** The array's length when these were made: a guard against a caller that appends to it. */
  length: number;
  kept: Set<string>;
  overlapOf: Map<string, Overlap>;
  uncovered: Set<string>;
  spanning: Set<string>;
}

/**
 * Per kind, which intervals count — decided once over *every* interval the
 * caller holds, so that a walk from 23:50 and an import from 00:00 are checked
 * against each other even though they sit on different days. Memoised on the
 * array: the store publishes a new array when anything changes, so between
 * changes every render asks for the same, already-computed answer. Treat the
 * array as immutable; one that grows in place is recomputed, one edited in
 * place is not.
 */
const decided = new WeakMap<readonly Observation[], Map<ObservationKind, IntervalDecisions>>();

function decisions(all: readonly Observation[], kind: ObservationKind): IntervalDecisions {
  let byKind = decided.get(all);
  if (!byKind) {
    byKind = new Map();
    decided.set(all, byKind);
  }
  const held = byKind.get(kind);
  if (held && held.length === all.length) return held;

  const s = sweep(all.filter(o => o.kind === kind && o.scope === 'sessionObserved' && totalable(o)));
  const made: IntervalDecisions = {
    length: all.length,
    kept: new Set(s.kept.map(o => o.id)),
    overlapOf: new Map(s.overlaps.map(o => [o.excluded, o])),
    uncovered: new Set(s.uncovered.map(o => o.id)),
    spanning: new Set(s.spanning.map(o => o.id)),
  };
  byKind.set(kind, made);
  return made;
}

/** The interval verdicts for one group of records, as a partial sweep. */
function verdictFor(group: readonly Observation[], d: IntervalDecisions): Sweep {
  return {
    kept: group.filter(o => d.kept.has(o.id)),
    overlaps: group.flatMap(o => (d.overlapOf.has(o.id) ? [d.overlapOf.get(o.id)!] : [])),
    uncovered: group.filter(o => d.uncovered.has(o.id)),
    spanning: group.filter(o => d.spanning.has(o.id)),
  };
}

export interface DayEntry {
  kind: ObservationKind;
  scope: Scope;
  /** `null` when the group holds more than one unit and cannot be combined. */
  unit: string | null;
  /** `null` for instantaneous readings, and whenever the group cannot be combined. */
  total: number | null;
  /** Everything in this group, chronological. Never filtered. */
  observations: Observation[];
  /** The records behind `total`; every valid reading, for an instantaneous kind. */
  contributed: Observation[];
  superseded: Observation[];
  conflicting: Observation[];
  overlaps: Overlap[];
  /** The most recent record in the group. */
  latest: Observation;
  flags: Flag[];
}

export interface DaySummary {
  day: string;
  /** One entry per (kind, scope) present. Never merged across scopes (D10). */
  entries: DayEntry[];
  flags: Flag[];
}

/**
 * Everything recorded on one local day, grouped so that nothing incomparable
 * is combined. A day with no records has no entries — never a zero (D14).
 *
 * Pass every observation, not only the day's: intervals are checked for
 * overlap against their neighbours across midnight. Records from other days
 * are used for that check and nothing else.
 *
 * Pure: the caller supplies the records, so this is testable without storage
 * and callable from a render pass without a read.
 */
export function summariseDay(day: string, observations: readonly Observation[]): DaySummary {
  const groups = new Map<string, Observation[]>();
  for (const o of observations) {
    if (o.day !== day) continue;
    const key = `${o.kind}|${o.scope}`;
    const held = groups.get(key);
    if (held) held.push(o);
    else groups.set(key, [o]);
  }

  const entries = [...groups.values()].map(group => entry(group, observations)).sort(byKindThenScope);
  return { day, entries, flags: entries.flatMap(e => e.flags) };
}

function byKindThenScope(a: DayEntry, b: DayEntry): number {
  return (
    OBSERVATION_KINDS.indexOf(a.kind) - OBSERVATION_KINDS.indexOf(b.kind) ||
    KINDS[a.kind].scopes.indexOf(a.scope) - KINDS[b.kind].scopes.indexOf(b.scope)
  );
}

function entry(group: Observation[], all: readonly Observation[]): DayEntry {
  const observations = [...group].sort(compareObservations);
  const latest = observations[observations.length - 1];
  const { kind, scope } = latest;
  const units = [...new Set(observations.map(o => o.unit))];

  const base = {
    kind,
    scope,
    observations,
    latest,
    superseded: [] as Observation[],
    conflicting: [] as Observation[],
    overlaps: [] as Overlap[],
  };

  if (units.length > 1) {
    return {
      ...base,
      unit: null,
      total: null,
      contributed: [],
      flags: [flag('mixedUnit', kind, scope, observations, `Recorded in more than one unit (${units.join(', ')}).`)],
    };
  }

  const valid = observations.filter(totalable);
  const invalid = observations.filter(o => !totalable(o));
  const invalidFlags = invalid.length > 0
    ? [flag('invalidRecord', kind, scope, invalid, 'A record breaks the rules for its kind, so it is shown but not counted.')]
    : [];

  // An instantaneous kind has readings, not a total. Saying so with `null` is
  // the point: a UI cannot accidentally render the sum of three glucose values.
  if (scope === 'pointInTime') {
    return { ...base, unit: units[0], total: null, contributed: valid, flags: invalidFlags };
  }
  if (valid.length === 0) {
    return { ...base, unit: units[0], total: null, contributed: [], flags: invalidFlags };
  }

  if (scope === 'dayTotal') {
    const result = sum(valid);
    return {
      ...base,
      unit: result.unit,
      total: result.value,
      contributed: result.contributed,
      superseded: result.superseded,
      conflicting: result.conflicting,
      flags: [...result.flags, ...invalidFlags],
    };
  }

  const v = verdictFor(valid, decisions(all, kind));
  return {
    ...base,
    unit: units[0],
    total: v.kept.reduce((t, o) => t + o.value, 0),
    contributed: v.kept,
    overlaps: v.overlaps,
    flags: [...intervalFlags(kind, v, all, latest.day), ...invalidFlags],
  };
}

/** The entry for a kind, or for one specific scope of it. */
export function entryFor(summary: DaySummary, kind: ObservationKind, scope?: Scope): DayEntry | undefined {
  return summary.entries.find(e => e.kind === kind && (scope === undefined || e.scope === scope));
}

export interface SeriesPoint {
  day: string;
  /** The reading's instant, or the latest instant behind a total. */
  at: string;
  value: number;
  scope: Scope;
  source: ObservationSource;
  /** The records behind this point. */
  observations: Observation[];
}

export interface Series {
  kind: ObservationKind;
  /** `null` when the range holds no records, or more than one unit. */
  unit: string | null;
  /** Chronological. Days with no record are absent, not zero (D14). */
  points: SeriesPoint[];
  flags: Flag[];
}

export interface DayRange {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, inclusive. */
  to: string;
}

/**
 * One kind over a span of days: every reading for an instantaneous kind, one
 * aggregated point per day and scope for a total.
 *
 * Gaps stay gaps. A chart that draws a line across three missing weeks is
 * telling the user something that did not happen.
 *
 * Intervals are checked for overlap across every record passed in, not only
 * those in the range, so a walk that started the evening before the range
 * still excludes the import that duplicates it.
 */
export function series(kind: ObservationKind, range: DayRange, observations: readonly Observation[]): Series {
  if (!isDay(range.from) || !isDay(range.to)) {
    throw new AggregationError('badRange', `Not a YYYY-MM-DD range: ${String(range.from)}..${String(range.to)}`);
  }
  if (range.from > range.to) {
    throw new AggregationError('badRange', `Inverted range: ${range.from} is after ${range.to}.`);
  }

  const inRange = observations
    .filter(o => o.kind === kind && o.day >= range.from && o.day <= range.to)
    .sort(compareObservations);

  const units = [...new Set(inRange.map(o => o.unit))];
  const scopeOrder = KINDS[kind].scopes;

  const groups = new Map<string, Observation[]>();
  for (const o of inRange) {
    const key = `${o.day}|${o.scope}`;
    const held = groups.get(key);
    if (held) held.push(o);
    else groups.set(key, [o]);
  }

  const points: SeriesPoint[] = [];
  const flags: Flag[] = [];

  for (const group of groups.values()) {
    const { day, scope } = group[0];
    const valid = group.filter(totalable);
    const invalid = group.filter(o => !totalable(o));
    if (invalid.length > 0) {
      flags.push(flag('invalidRecord', kind, scope, invalid, 'A record breaks the rules for its kind, so it is shown but not counted.', day));
    }

    if (scope === 'pointInTime') {
      points.push(...valid.map(o => ({
        day,
        at: o.at,
        value: o.value,
        scope,
        source: o.source,
        observations: [o],
      })));
      continue;
    }
    if (valid.length === 0) continue;

    const groupUnits = new Set(valid.map(o => o.unit));
    if (groupUnits.size > 1) {
      flags.push(flag('mixedUnit', kind, scope, valid, `Recorded in more than one unit (${[...groupUnits].join(', ')}).`, day));
      continue;
    }

    if (scope === 'dayTotal') {
      const result = sum(valid);
      const latest = result.contributed[result.contributed.length - 1];
      points.push({ day, at: latest.at, value: result.value, scope, source: latest.source, observations: result.contributed });
      flags.push(...result.flags);
      continue;
    }

    const v = verdictFor(valid, decisions(observations, kind));
    flags.push(...intervalFlags(kind, v, observations, day));
    if (v.kept.length === 0) continue;
    const latest = v.kept[v.kept.length - 1];
    points.push({ day, at: latest.at, value: v.kept.reduce((t, o) => t + o.value, 0), scope, source: latest.source, observations: v.kept });
  }

  points.sort((a, b) =>
    a.day.localeCompare(b.day) ||
    scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope) ||
    Date.parse(a.at) - Date.parse(b.at));

  return { kind, unit: units.length === 1 ? units[0] : null, points, flags };
}

// ============================================================================
// Blood pressure
// ============================================================================

/**
 * One blood-pressure reading, put back together from its two halves.
 *
 * A half with no partner keeps its number and leaves the other `null`. That is
 * deliberate: dropping it would hide a reading the user took, and filling it in
 * would be making up a clinical number.
 */
export interface BpReading {
  /** The reading id the two halves share, from their `bp:` context. */
  id: string;
  at: string;
  day: string;
  systolic: number | null;
  diastolic: number | null;
  tag?: ObservationTag;
  source: ObservationSource;
  note?: string;
  /** The observations behind it: two when complete, one when orphaned, more when ambiguous. */
  halves: Observation[];
  /**
   * More than one systolic or diastolic was recorded for this reading. The
   * figures shown are the latest statement of each; the screen should say the
   * reading was recorded twice rather than present it as clean.
   */
  ambiguous?: true;
}

/**
 * Pair up blood-pressure observations, chronologically.
 *
 * Halves pair only when they share a reading id *and* an instant — compared as
 * an instant, so 09:00+05:30 and 03:30Z are the same moment — and two readings
 * taken minutes apart can never be crossed over into one impossible 160/70.
 * Anything that is not a blood-pressure half is ignored.
 */
export function pairBloodPressure(observations: readonly Observation[]): BpReading[] {
  const groups = new Map<string, Observation[]>();

  for (const o of observations) {
    if (!isBpKind(o.kind)) continue;
    const reading = bpReadingId(o.context);
    // A half with no pairing context is its own reading rather than a record
    // we refuse to show: older or hand-edited data has no `bp:` context.
    const key = `${reading ?? `id:${o.id}`}|${Date.parse(o.at)}`;
    const held = groups.get(key);
    if (held) held.push(o);
    else groups.set(key, [o]);
  }

  const latest = (list: Observation[]) => (list.length === 0 ? undefined : [...list].sort(compareStatements)[list.length - 1]);

  const readings = [...groups.values()].map(group => {
    const halves = [...group].sort(compareObservations);
    const systolics = halves.filter(o => o.kind === 'bloodPressureSystolic');
    const diastolics = halves.filter(o => o.kind === 'bloodPressureDiastolic');
    const systolic = latest(systolics);
    const diastolic = latest(diastolics);
    const primary = (systolic ?? diastolic)!;
    const ambiguous = systolics.length > 1 || diastolics.length > 1;
    const reading: BpReading = {
      id: bpReadingId(primary.context) ?? primary.id,
      at: primary.at,
      day: primary.day,
      systolic: systolic?.value ?? null,
      diastolic: diastolic?.value ?? null,
      ...(primary.tag !== undefined ? { tag: primary.tag } : {}),
      source: primary.source,
      ...(primary.note !== undefined ? { note: primary.note } : {}),
      halves,
      ...(ambiguous ? { ambiguous: true as const } : {}),
    };
    return reading;
  });

  return readings.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A reading missing one of its two numbers. */
export function isOrphanedReading(reading: BpReading): boolean {
  return reading.systolic === null || reading.diastolic === null;
}
