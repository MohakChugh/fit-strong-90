/**
 * The one record type for every measurement the app holds (PLAN.md Task 1).
 *
 * An `Observation` is append-only history: a fact the user or the device
 * stated at a moment. Nothing here knows how to combine two of them — that is
 * `aggregate.ts`, deliberately the only place, so D10 cannot be broken by
 * accident from a screen.
 */

import { format } from 'date-fns';

/**
 * What a value means in time, and therefore how it may be combined (D10).
 *
 * - `pointInTime` — an instantaneous state (a glucose reading). Never summable:
 *   two readings do not make a bigger reading.
 * - `dayTotal` — a statement about a whole local day ("8,000 steps today").
 *   A newer one *replaces* the previous one of the same kind and source.
 * - `sessionObserved` — measured over a stated interval (`coverageMs`).
 *   Non-overlapping intervals add; overlapping ones are flagged, never added.
 */
export type Scope = 'pointInTime' | 'dayTotal' | 'sessionObserved';

/** Where the number came from. Shown next to every record (PLAN.md Task 6). */
export type ObservationSource = 'manual' | 'measured' | 'imported';

export type ObservationKind =
  | 'glucose'
  | 'bloodPressureSystolic'
  | 'bloodPressureDiastolic'
  | 'weight'
  | 'waist'
  | 'steps'
  | 'walkDistance'
  | 'walkDuration'
  | 'movementMinutes'
  | 'water'
  | 'sleep'
  | 'backPain'
  | 'legPain'
  | 'mood'
  | 'hba1c'
  | 'b12'
  | 'vitaminD';

/**
 * When a reading was taken, relative to the thing that moves it.
 *
 * Not provenance and not a note: a glucose number cannot be judged without
 * it. ADA's targets are 80–130 mg/dL before a meal and under 180 at the peak
 * after one, so an untagged 150 is neither good nor bad. Home blood pressure
 * is a morning-and-evening protocol for the same reason.
 *
 * Absent means unknown, and unknown is never read as `fasting`.
 */
export type ObservationTag =
  // glucose
  | 'fasting'
  | 'beforeMeal'
  | 'afterMeal'
  | 'bedtime'
  | 'beforeExercise'
  | 'duringExercise'
  | 'afterExercise'
  // blood pressure
  | 'morning'
  | 'evening'
  | 'other';

export interface Observation {
  id: string;
  kind: ObservationKind;
  /** ISO 8601 with an explicit offset, e.g. `2026-10-08T00:30:00+05:30`. */
  at: string;
  /** The local calendar day of `at`, `YYYY-MM-DD`. Always `at.slice(0, 10)`. */
  day: string;
  value: number;
  unit: string;
  scope: Scope;
  source: ObservationSource;
  /** Free-form provenance: `walk:<id>`, `checkIn:<date>`, `bp:<readingId>`. */
  context?: string;
  /** When the reading was taken, where that changes what it means. */
  tag?: ObservationTag;
  /**
   * The start of the meal an `afterMeal` glucose reading follows, ISO with
   * offset. Guidelines time the peak from the first mouthful, so without this
   * "two hours after eating" is a guess; with it the minutes are arithmetic.
   */
  mealStartedAt?: string;
  note?: string;
  /** For `sessionObserved`: the span `at` covers, so overlaps are detectable. */
  coverageMs?: number;
  /** Set when a stored record is corrected; `at` keeps the original moment. */
  editedAt?: string;
  /**
   * Commit order, stamped by the store on every write and shared by every open
   * copy of the app. It breaks ties between statements made at the same
   * instant, so "the later one wins" means the later *commit*, not whichever
   * id happens to sort last. Absent on records the store has not written.
   */
  seq?: number;
  /**
   * The clock time in `at` is a stand-in: the source recorded only a date
   * (a v4 check-in, a body measurement). The day is exact; the time is not.
   */
  timeUnknown?: true;
}

export interface KindSpec {
  /** Allowed units; the first is canonical and what new records should use. */
  readonly units: readonly [string, ...string[]];
  /** Scopes this kind may legitimately be recorded in. */
  readonly scopes: readonly Scope[];
  /** Timing tags this kind may carry. Absent means the kind takes none. */
  readonly tags?: readonly ObservationTag[];
  /** For a scale, its lowest and highest points: a pain of 40 is not a pain score. */
  readonly range?: readonly [number, number];
  readonly label: string;
}

const GLUCOSE_TAGS = [
  'fasting', 'beforeMeal', 'afterMeal', 'bedtime', 'beforeExercise', 'duringExercise', 'afterExercise', 'other',
] as const;

const BP_TAGS = ['morning', 'evening', 'other'] as const;

/**
 * The registry: units and legal scopes per kind.
 *
 * Only genuinely dual-unit clinical measures list a second unit (glucose,
 * HbA1c, B12, vitamin D). Everything else is single-unit so that a sum can
 * never need a conversion — see `aggregate.ts`, which refuses mixed units
 * rather than guessing a factor.
 *
 * Water is a `dayTotal`, not a stream of increments: "+1 glass" reads the
 * day's total and writes a larger one, which keeps the replace rule intact.
 */
export const KINDS: Record<ObservationKind, KindSpec> = {
  glucose: { units: ['mg/dL', 'mmol/L'], scopes: ['pointInTime'], tags: GLUCOSE_TAGS, label: 'Blood glucose' },
  bloodPressureSystolic: { units: ['mmHg'], scopes: ['pointInTime'], tags: BP_TAGS, label: 'Systolic' },
  bloodPressureDiastolic: { units: ['mmHg'], scopes: ['pointInTime'], tags: BP_TAGS, label: 'Diastolic' },
  weight: { units: ['kg'], scopes: ['pointInTime'], label: 'Weight' },
  waist: { units: ['cm'], scopes: ['pointInTime'], label: 'Waist' },
  steps: { units: ['steps'], scopes: ['dayTotal', 'sessionObserved'], tags: ['afterMeal'], label: 'Steps' },
  walkDistance: { units: ['km'], scopes: ['sessionObserved', 'dayTotal'], tags: ['afterMeal'], label: 'Walking distance' },
  walkDuration: { units: ['min'], scopes: ['sessionObserved', 'dayTotal'], tags: ['afterMeal'], label: 'Walking time' },
  movementMinutes: { units: ['min'], scopes: ['sessionObserved', 'dayTotal'], tags: ['afterMeal'], label: 'Recorded movement' },
  water: { units: ['ml'], scopes: ['dayTotal'], label: 'Water' },
  sleep: { units: ['h'], scopes: ['dayTotal'], label: 'Sleep' },
  backPain: { units: ['0-10'], scopes: ['pointInTime'], range: [0, 10], label: 'Back pain' },
  legPain: { units: ['0-10'], scopes: ['pointInTime'], range: [0, 10], label: 'Leg pain' },
  mood: { units: ['1-5'], scopes: ['pointInTime'], range: [1, 5], label: 'Mood' },
  hba1c: { units: ['%', 'mmol/mol'], scopes: ['pointInTime'], label: 'HbA1c' },
  b12: { units: ['pg/mL', 'pmol/L'], scopes: ['pointInTime'], label: 'Vitamin B12' },
  vitaminD: { units: ['ng/mL', 'nmol/L'], scopes: ['pointInTime'], label: 'Vitamin D' },
};

/** Kinds a walk records, which may carry the meal it followed. */
const WALK_MEAL_KINDS: ReadonlySet<ObservationKind> = new Set(['steps', 'walkDistance', 'walkDuration', 'movementMinutes']);

export const OBSERVATION_KINDS = Object.keys(KINDS) as ObservationKind[];

export function isObservationKind(value: unknown): value is ObservationKind {
  return typeof value === 'string' && Object.hasOwn(KINDS, value);
}

/** The canonical unit a new record of this kind should carry. */
export function canonicalUnit(kind: ObservationKind): string {
  return KINDS[kind].units[0];
}

/**
 * ISO 8601 with a required offset. Without an offset the local day would be a
 * guess, and `day` is the key every screen groups by.
 */
const AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class ObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObservationError';
  }
}

/** True when `YYYY-MM-DD` names a day that exists (rejects 2026-02-30). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DAY_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** True when `at` is ISO 8601 with an offset and names a real instant. */
export function isAt(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = AT_PATTERN.exec(value);
  if (!m) return false;
  if (!isDay(value.slice(0, 10))) return false;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? '0') > 59) return false;
  // Offsets run to ±14:00 (Line Islands); anything larger is a typo or a bug.
  if (m[7] !== 'Z' && Math.abs(Number(m[7].slice(1, 3))) > 14) return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * The local calendar day of an instant.
 *
 * `at` already carries its own offset, so the local wall-clock date is the
 * string's own prefix — no `Date` arithmetic, no dependence on where the code
 * runs. A reading at 00:30+05:30 belongs to that day even if the record is
 * later read in London, and a traveller's history keeps the day it happened on.
 */
export function dayOf(at: string): string {
  if (!isAt(at)) throw new ObservationError(`Not an ISO instant with an offset: ${String(at)}`);
  return at.slice(0, 10);
}

/**
 * Now, as an ISO instant carrying this device's current offset.
 *
 * Milliseconds are included deliberately. Two taps a few hundred milliseconds
 * apart must be distinguishable, because for a `dayTotal` the later statement
 * is the one that counts — at second resolution, logging two glasses of water
 * quickly left the day's total ambiguous.
 */
export function nowAt(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

/**
 * An instant on a given local day, for a record whose clock time is unknown —
 * a v4 check-in stored only `date`.
 *
 * The string is built from the day itself rather than through a local `Date`,
 * because a `Date` silently normalises a day the device's time zone skipped
 * (Samoa went from 29 to 31 December 2011) into the next one, and a date-only
 * record must never move day. The offset is the one that applied at that time
 * on that day where the day exists locally, and the device's current offset
 * where it does not; either way the instant is a stand-in and the record says
 * so with `timeUnknown`.
 *
 * Midday is the default so the stand-in sits inside the day under every
 * offset, and screens recognise exactly `T12:00:00.000` as "time not recorded".
 */
export function atOnDay(day: string, time = '12:00:00'): string {
  if (!isDay(day)) throw new ObservationError(`Not a YYYY-MM-DD day: ${String(day)}`);
  const m = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(time);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? '0') > 59) {
    throw new ObservationError(`Not a HH:MM[:SS] time: ${String(time)}`);
  }
  const [hh, mm, ss, ms] = [m[1], m[2], m[3] ?? '00', (m[4] ?? '0').padEnd(3, '0')];
  const [y, mo, d] = day.split('-').map(Number);
  const local = new Date(y, mo - 1, d, Number(hh), Number(mm), Number(ss), Number(ms));
  const exists = local.getFullYear() === y && local.getMonth() === mo - 1 && local.getDate() === d;
  const offset = format(exists ? local : new Date(), 'XXX');
  return `${day}T${hh}:${mm}:${ss}.${ms}${offset}`;
}

export interface ObservationInput {
  kind: ObservationKind;
  value: number;
  scope: Scope;
  source: ObservationSource;
  /** Defaults to now. */
  at?: string;
  /** Defaults to the kind's canonical unit. */
  unit?: string;
  id?: string;
  context?: string;
  tag?: ObservationTag;
  mealStartedAt?: string;
  note?: string;
  coverageMs?: number;
  /** The time in `at` is a stand-in for a date-only record. */
  timeUnknown?: boolean;
}

let lastStamp = 0;
let withinStamp = 0;

/**
 * A generated id that sorts in creation order within one copy of the app.
 *
 * Ordering between copies is the store's job (`seq`); this only keeps a single
 * copy's ids from colliding and from sorting at random.
 */
function randomId(): string {
  const now = Date.now();
  if (now === lastStamp) withinStamp += 1;
  else {
    lastStamp = now;
    withinStamp = 0;
  }
  const noise = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${now.toString(36).padStart(9, '0')}-${withinStamp.toString(36).padStart(4, '0')}-${noise}`;
}

const SCOPES: readonly Scope[] = ['pointInTime', 'dayTotal', 'sessionObserved'];
const SOURCES: readonly ObservationSource[] = ['manual', 'measured', 'imported'];

/**
 * Why a record could not be stored, or `undefined` when it can.
 *
 * The one statement of the rules. A record built here, a record corrected
 * later and a record arriving in an import file are all held to it, so nothing
 * that `aggregate.ts` would have to second-guess can reach the store.
 */
export function observationProblem(o: Observation): string | undefined {
  if (typeof o.id !== 'string' || o.id === '') return 'A record needs an id.';
  if (!isObservationKind(o.kind)) return `Unknown kind: ${String(o.kind)}`;
  const spec = KINDS[o.kind];
  const kind = o.kind;

  if (!isAt(o.at)) return `Not an ISO instant with an offset: ${String(o.at)}`;
  if (o.day !== o.at.slice(0, 10)) return `${String(o.day)} is not the local day of ${o.at}`;
  if (!SCOPES.includes(o.scope)) return `Unknown scope: ${String(o.scope)}`;
  if (!spec.scopes.includes(o.scope)) return `${kind} cannot be recorded as ${o.scope} (allowed: ${spec.scopes.join(', ')})`;
  if (!SOURCES.includes(o.source)) return `Unknown source: ${String(o.source)}`;
  if (typeof o.unit !== 'string' || !spec.units.includes(o.unit)) {
    return `${kind} is not measured in ${String(o.unit)} (allowed: ${spec.units.join(', ')})`;
  }
  if (typeof o.value !== 'number' || !Number.isFinite(o.value) || o.value < 0) {
    return `${kind} needs a finite, non-negative value, got ${String(o.value)}`;
  }
  if (spec.range && (o.value < spec.range[0] || o.value > spec.range[1])) {
    return `${kind} runs from ${spec.range[0]} to ${spec.range[1]}, got ${o.value}`;
  }

  if (o.scope === 'sessionObserved') {
    // Without the span, two sessions cannot be checked for overlap, and the
    // day's total could silently double-count. Claim an interval or don't
    // claim to have observed one.
    if (typeof o.coverageMs !== 'number' || !Number.isFinite(o.coverageMs) || o.coverageMs <= 0) {
      return `${kind} recorded as sessionObserved needs a positive coverageMs`;
    }
  } else if (o.coverageMs !== undefined) {
    return `coverageMs only applies to sessionObserved, not ${o.scope}`;
  }

  if (o.tag !== undefined && !(spec.tags ?? []).includes(o.tag)) {
    return spec.tags === undefined
      ? `${kind} does not take a timing tag`
      : `${kind} cannot be tagged ${String(o.tag)} (allowed: ${spec.tags.join(', ')})`;
  }
  if (o.mealStartedAt !== undefined) {
    // Only an after-meal glucose reading has a meal to be after. Allowing it
    // anywhere else would let a screen compute "minutes after eating" for a
    // reading that was never about a meal.
    // An after-meal glucose reading, or a walk taken after a meal (board D26).
    if (o.tag !== 'afterMeal' || !(kind === 'glucose' || WALK_MEAL_KINDS.has(kind))) return 'mealStartedAt only applies to a glucose reading or a walk tagged afterMeal';
    if (!isAt(o.mealStartedAt)) return `mealStartedAt is not an ISO instant with an offset: ${String(o.mealStartedAt)}`;
  }

  if (o.context !== undefined && typeof o.context !== 'string') return 'context must be text';
  if (o.note !== undefined && typeof o.note !== 'string') return 'note must be text';
  if (o.editedAt !== undefined && !isAt(o.editedAt)) return `editedAt is not an ISO instant with an offset: ${String(o.editedAt)}`;
  if (o.seq !== undefined && !(Number.isSafeInteger(o.seq) && o.seq >= 0)) return 'seq must be a whole number';
  if (o.timeUnknown !== undefined && o.timeUnknown !== true) return 'timeUnknown is either true or absent';
  return undefined;
}

/**
 * Build a validated record. Every write goes through here or through
 * `reviseObservation`, so a stored observation is always one `aggregate.ts`
 * can reason about: real instant, known unit, legal scope, and an interval
 * whenever one is claimed.
 */
export function newObservation(input: ObservationInput): Observation {
  const { kind, scope, source } = input;
  if (!isObservationKind(kind)) throw new ObservationError(`Unknown kind: ${String(kind)}`);
  const at = input.at ?? nowAt();
  if (!isAt(at)) throw new ObservationError(`Not an ISO instant with an offset: ${String(at)}`);

  const record: Observation = {
    id: input.id ?? randomId(),
    kind,
    at,
    day: at.slice(0, 10),
    value: input.value,
    unit: input.unit ?? canonicalUnit(kind),
    scope,
    source,
    ...(input.context !== undefined ? { context: input.context } : {}),
    ...(input.tag !== undefined ? { tag: input.tag } : {}),
    ...(input.mealStartedAt !== undefined ? { mealStartedAt: input.mealStartedAt } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.coverageMs !== undefined ? { coverageMs: input.coverageMs } : {}),
    ...(input.timeUnknown === true ? { timeUnknown: true as const } : {}),
  };
  const problem = observationProblem(record);
  if (problem !== undefined) throw new ObservationError(problem);
  return record;
}

/**
 * A correction to a stored record. Fields not named keep their value — a
 * corrected number keeps its timing tag, meal start, note and provenance —
 * and `null` clears an optional one.
 */
export interface ObservationRevision {
  value?: number;
  unit?: string;
  /** Correcting the time also moves the record to the right day, and makes the time known. */
  at?: string;
  note?: string | null;
  tag?: ObservationTag | null;
  mealStartedAt?: string | null;
}

/**
 * Apply a correction, held to the same rules as a new record.
 *
 * `at` keeps the moment observed and `editedAt` records when the correction
 * was made, which is what decides whose day total is current. Moving a glucose
 * reading off `afterMeal` drops its meal start, which means nothing without it.
 */
export function reviseObservation(existing: Observation, patch: ObservationRevision, editedAt: string = nowAt()): Observation {
  const next: Observation = { ...existing };
  if (patch.value !== undefined) next.value = patch.value;
  if (patch.unit !== undefined) next.unit = patch.unit;
  if (patch.at !== undefined) {
    next.at = patch.at;
    if (typeof patch.at === 'string') next.day = patch.at.slice(0, 10);
    delete next.timeUnknown;
  }
  if (patch.note === null) delete next.note;
  else if (patch.note !== undefined) next.note = patch.note;
  if (patch.tag === null) delete next.tag;
  else if (patch.tag !== undefined) next.tag = patch.tag;
  if (patch.mealStartedAt === null) delete next.mealStartedAt;
  else if (patch.mealStartedAt !== undefined) next.mealStartedAt = patch.mealStartedAt;
  if (next.tag !== 'afterMeal' && patch.mealStartedAt === undefined) delete next.mealStartedAt;
  next.editedAt = editedAt;
  // A correction is a new statement; the store stamps its commit order.
  delete next.seq;

  const problem = observationProblem(next);
  if (problem !== undefined) throw new ObservationError(problem);
  return next;
}

/**
 * The check for data from outside the app — an import file, or a row an older
 * build wrote. The same rules as `newObservation`: a record the app could not
 * have made is not one it should accept from a file.
 */
export function isObservation(value: unknown): value is Observation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return observationProblem(value as Observation) === undefined;
}

// ============================================================================
// Blood pressure: one reading, stored as two numbers
// ============================================================================

/**
 * The `context` both halves of a blood-pressure reading share.
 *
 * A reading is one event — "138 over 86 this morning" — but systolic and
 * diastolic are different kinds, so it is stored as two observations. Making
 * the pairing a convention in `context` keeps it visible, testable, and
 * impossible to lose: `pairBloodPressure` puts the halves back together and
 * reports a half with no partner instead of inventing the other number.
 *
 * The reading id doubles as provenance: a check-in's first reading of the day
 * is `bp:checkIn:2026-10-01`, a recheck that day `bp:checkIn:2026-10-01#1`, and
 * a reading typed on its own `bp:<generated id>`.
 */
export function bpContext(readingId: string): string {
  return `bp:${readingId}`;
}

/** The reading id inside a `bp:` context, or undefined if it is not one. */
export function bpReadingId(context: unknown): string | undefined {
  return typeof context === 'string' && context.startsWith('bp:') ? context.slice(3) : undefined;
}

export const BP_KINDS = ['bloodPressureSystolic', 'bloodPressureDiastolic'] as const;

export function isBpKind(kind: ObservationKind): boolean {
  return kind === 'bloodPressureSystolic' || kind === 'bloodPressureDiastolic';
}

/**
 * The date of the check-in an observation was recorded with, or undefined.
 * Matches every reading event of that day — the first (`checkIn:<date>`),
 * each recheck (`bp:checkIn:<date>#1`, …) and an event named on one device
 * (`checkIn:<date>#<token>`, D-02) — which an exact string match on the
 * context would miss.
 */
export function checkInDayOf(o: Pick<Observation, 'context'>): string | undefined {
  const m = typeof o.context === 'string' ? /^(?:bp:)?checkIn:(\d{4}-\d{2}-\d{2})(?:#[0-9a-z]+)?$/.exec(o.context) : null;
  return m ? m[1] : undefined;
}

// ============================================================================
// Order
// ============================================================================

/** -1, 0 or 1. NaN and equal values are ties, so the next key decides. */
function order(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Code-unit order: the same on every device, unlike `localeCompare`. */
function byId(a: Observation, b: Observation): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Commit order, when both records have one. */
function bySeq(a: Observation, b: Observation): number {
  return a.seq !== undefined && b.seq !== undefined ? order(a.seq, b.seq) : 0;
}

/**
 * Chronological order by the moment observed, newest last — display order.
 *
 * Instants are compared as instants. Comparing the strings is wrong as soon as
 * two records carry different offsets: at the US fall-back, 01:10-05:00 is
 * twenty minutes *after* 01:50-04:00.
 *
 * Records that share an instant — the readings in one check-in, or anything
 * from a date-only v4 record — fall back to the order the kinds are declared
 * in above, which puts a blood pressure's systolic before its diastolic.
 */
export function compareObservations(a: Observation, b: Observation): number {
  return (
    order(Date.parse(a.at), Date.parse(b.at)) ||
    order(a.editedAt === undefined ? -Infinity : Date.parse(a.editedAt), b.editedAt === undefined ? -Infinity : Date.parse(b.editedAt)) ||
    OBSERVATION_KINDS.indexOf(a.kind) - OBSERVATION_KINDS.indexOf(b.kind) ||
    bySeq(a, b) ||
    byId(a, b)
  );
}

/**
 * Order by when the user last *said* it, newest last.
 *
 * Different from `compareObservations`, and the difference matters for the
 * day-total replace rule: correcting this morning's entry at 23:00 is a newer
 * statement about today than the one typed at 22:00, even though the moment it
 * refers to is earlier. Two statements at the same instant are ordered by
 * commit, which is the same in every open copy of the app.
 */
export function compareStatements(a: Observation, b: Observation): number {
  return (
    order(Date.parse(a.editedAt ?? a.at), Date.parse(b.editedAt ?? b.at)) ||
    bySeq(a, b) ||
    order(Date.parse(a.at), Date.parse(b.at)) ||
    byId(a, b)
  );
}
