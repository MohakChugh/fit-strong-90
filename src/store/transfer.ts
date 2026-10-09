/**
 * Export and import the whole record (PLAN.md Task 1, D17).
 *
 * Local-only data has one failure mode: the device. There is no File System
 * Access API and no Web Share Target on iOS, so a round trip is always an
 * explicit user action — one gzipped JSON file, handed to the share sheet
 * where that exists and to a download link where it does not.
 *
 * Import is deliberately two steps: `previewImport` validates and counts what
 * is in the file — including what it would conflict with — so the user is
 * told what they are about to do, and only then does `applyImport` write,
 * with merge or replace chosen by them. Everything is checked before anything
 * is touched, and the write is one transaction: a file that fails half-way
 * leaves the device exactly as it was (review F01, F22).
 */

import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import type { AppData, BodyMetric, PersonalRecord, UserSettings, WorkoutSession } from '@/types';
import type { CheckInRecord, DailyCheckIn, EmergencyFlag, EpisodeAnswer, EpisodeKind, GlucoseUnit, RedFlag, UrineKetoneCategory } from '@/types/checkin';
import type { DayFocus } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import {
  bpContext,
  bpReadingId,
  checkInDayOf,
  compareObservations,
  isAt,
  isDay,
  isObservation,
  nowAt,
  type Observation,
  type ObservationKind,
} from '@/health/observation';
import { StoreFailure, toFailure, type Db, type StoreResult } from './db';
import { SCHEMA_VERSION, projectV4 } from './migrate';
import { withReadingRemoved, type CheckInReading } from '@/components/checkin/pending';
import { evaluateCheckIn } from '@/engine/readiness';
import { readProfile, readSettings } from './importCheck';
import { liftBodyMetric, liftSessionPain, readingKey } from './project';
import { commitChange, readSnapshot, type Change, type Snapshot } from './snapshot';

export const TRANSFER_FORMAT = 'fit-strong-health-record';

/** The shape of the file, not the shape of the database. */
export const TRANSFER_VERSION = 1;

export interface ContentRow {
  key: string;
  value: unknown;
}

export interface TransferDoc {
  format: typeof TRANSFER_FORMAT;
  version: number;
  /** ISO with offset, so the file says when and where it was made. */
  exportedAt: string;
  /** The database schema the records came from. Never stored as this device's marker. */
  schemaVersion: number;
  observations: Observation[];
  sessions: WorkoutSession[];
  settings?: UserSettings;
  profile?: UserProfile;
  checkIns: CheckInRecord[];
  personalRecords: PersonalRecord[];
  bodyMetrics: BodyMetric[];
  focusOverrides: Record<string, DayFocus>;
  /** The `content-state` store. Absent in files from before it was exported. */
  contentState?: ContentRow[];
}

/**
 * The most an import will read, checked before anything is decompressed past
 * it or written.
 *
 * Sized from a lifetime, not a guess. A heavy day is about twenty readings —
 * a check-in's handful, a few glasses of water (each a new statement), a walk
 * — which is 7,300 a year and under half a million in sixty. At roughly 220
 * bytes of JSON each, that is about 100 MB of text. 128 MiB covers it with
 * room, and stays below what an iPhone's web content process can parse: the
 * text, its parsed form and the store's copy together are several times the
 * file. The record caps are generous multiples of the same estimate and exist
 * so a malformed file is refused by its counts before any of it is processed.
 */
export const IMPORT_LIMITS = {
  bytes: 128 * 1024 * 1024,
  observations: 1_000_000,
  sessions: 100_000,
  checkIns: 100_000,
  personalRecords: 10_000,
  bodyMetrics: 100_000,
  focusOverrides: 100_000,
  contentState: 100_000,
} as const;

/** A snapshot as the file that carries it. */
export function toTransferDoc(snapshot: Snapshot, exportedAt: string = nowAt()): TransferDoc {
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt,
    schemaVersion: SCHEMA_VERSION,
    observations: [...snapshot.observations].sort(compareObservations),
    sessions: snapshot.sessions,
    ...(snapshot.settings !== undefined ? { settings: snapshot.settings } : {}),
    ...(snapshot.profile !== undefined ? { profile: snapshot.profile } : {}),
    checkIns: snapshot.checkIns,
    personalRecords: snapshot.personalRecords,
    bodyMetrics: snapshot.bodyMetrics,
    focusOverrides: snapshot.focusOverrides,
    contentState: Object.entries(snapshot.content).map(([key, value]) => ({ key, value })),
  };
}

/** Everything on the device, as one document read in one transaction (F26). */
export async function collect(db: Db): Promise<StoreResult<TransferDoc>> {
  try {
    return { ok: true, value: toTransferDoc(await readSnapshot(db)) };
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }
}

export interface EncodedTransfer {
  bytes: Uint8Array;
  /** False when the browser cannot compress, or compression failed; the file is plain JSON. */
  gzip: boolean;
  name: string;
  type: string;
}

/**
 * The document as a file. Gzipped where the browser can, plain JSON where it
 * cannot or where compressing fails — a 10× smaller file is worth having, an
 * export that does not happen is not (F25).
 */
export async function encode(record: TransferDoc): Promise<EncodedTransfer> {
  const json = new TextEncoder().encode(JSON.stringify(record));
  const day = typeof record.exportedAt === 'string' ? record.exportedAt.slice(0, 10) : nowAt().slice(0, 10);
  const stem = `${TRANSFER_FORMAT}-${day}`;
  const plain = (): EncodedTransfer => ({ bytes: json, gzip: false, name: `${stem}.json`, type: 'application/json' });

  if (typeof CompressionStream !== 'function') return plain();
  try {
    const gzipped = new Blob([json as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(gzipped).arrayBuffer());
    return { bytes, gzip: true, name: `${stem}.json.gz`, type: 'application/gzip' };
  } catch {
    return plain();
  }
}

/** gzip's magic number. */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

const TOO_LARGE = 'That file is too large to be a record from this app.';

/** Decompress, stopping the moment the text passes `max` — a small file can unpack to gigabytes. */
async function gunzip(bytes: Uint8Array, max: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new StoreFailure('invalid', TOO_LARGE);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

export interface DecodeOptions {
  /** The largest file, and the largest decompressed text, to accept. Defaults to `IMPORT_LIMITS.bytes`. */
  maxBytes?: number;
}

/**
 * Read a file back.
 *
 * Returns `unknown`: a file off the user's phone has not been validated by
 * anything, so the shape check belongs to `previewImport` and `applyImport`
 * rather than to a cast here.
 */
export async function decode(input: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): Promise<unknown> {
  const max = options.maxBytes ?? IMPORT_LIMITS.bytes;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > max) throw new StoreFailure('invalid', TOO_LARGE);
  try {
    const text = isGzip(bytes) ? await gunzip(bytes, max) : bytes;
    return JSON.parse(new TextDecoder().decode(text));
  } catch (error) {
    if (error instanceof StoreFailure) throw error;
    throw new StoreFailure('invalid', 'That file could not be read. It may be damaged, or not an export from this app.', error);
  }
}

// ============================================================================
// Validation: every record, before anything is written (F21, F22)
// ============================================================================

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string';
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const optional = (x: unknown, ok: (v: unknown) => boolean) => x === undefined || ok(x);
const isNumberOrNull = (x: unknown) => x === null || isNumber(x);
const isTextOrNull = (x: unknown) => x === null || isText(x);

/**
 * Strict where a screen would crash or a number would be wrong, lenient where
 * an older build may simply not have written a field: every field that is
 * present must have its type, and the ones code dereferences must be present.
 */
function isWorkoutSet(x: unknown): boolean {
  return isRecord(x) && isText(x.exerciseId) && isText(x.status)
    && optional(x.id, isText) && optional(x.setNumber, isNumber) && optional(x.plannedReps, isNumber)
    && optional(x.actualReps, isNumberOrNull) && optional(x.weight, isNumberOrNull) && optional(x.rpe, isNumberOrNull);
}

export function isSessionRecord(x: unknown): x is WorkoutSession {
  return isRecord(x) && isText(x.id) && x.id !== '' && isDay(x.date) && isText(x.status)
    && Array.isArray(x.sets) && x.sets.every(isWorkoutSet)
    && optional(x.dayOfWeek, isText) && optional(x.muscleGroup, isText) && optional(x.phase, isText)
    && optional(x.week, isNumber) && optional(x.startedAt, isTextOrNull) && optional(x.completedAt, isTextOrNull)
    && optional(x.notes, isText) && optional(x.totalVolume, isNumber)
    && optional(x.warmup, Array.isArray) && optional(x.cooldown, Array.isArray) && optional(x.supersetGroups, Array.isArray)
    && optional(x.exerciseNotes, isRecord) && optional(x.guided, v => typeof v === 'boolean')
    && optional(x.mobility, Array.isArray) && optional(x.cardio, isRecord)
    && optional(x.checkIn, isCheckInRecord) && optional(x.painAfter, isNumber)
    && optional(x.symptomChecks, isRecord) && optional(x.durationSeconds, isNumber);
}

const listOf = (ok: (x: unknown) => boolean) => (x: unknown) => Array.isArray(x) && x.every(ok);
/** One of the names a type allows, held as a table so the compiler keeps it to the type. */
const named = (names: Readonly<Record<string, true>>) => (x: unknown) => isText(x) && Object.hasOwn(names, x);
const isBool = (x: unknown) => typeof x === 'boolean';

/*
 * Readings: what makes one unreadable, in words for the person, or nothing.
 * The engine passes over a reading it cannot read, so a dangerous one would
 * be lost without a word; a file holding one is refused whole instead,
 * naming it (`unreadableReading`).
 *
 * Every time in a check-in is an instant with its offset, as every build
 * writes it. Any other text is still read as a moment, some other one: "5" is
 * a day in 2001, so a serious reading is years old, a stale one looks fresh,
 * and an answer given today is not today's.
 */
type Problem = string | undefined;
const GLUCOSE_UNITS: Record<GlucoseUnit, true> = { 'mg/dL': true, 'mmol/L': true };
const URINE: Record<UrineKetoneCategory, true> = { negative: true, trace: true, small: true, moderate: true, large: true };
/** What the file says, briefly, so the person can find it. */
const quoted = (x: unknown) => (isText(x) ? ` ("${x.slice(0, 20)}")` : '');
const timeProblem = (at: unknown, what: string): Problem => (optional(at, isAt) ? undefined : `${what} whose time cannot be read`);

/** As the engine reads one: a meter's HI or LO where there is a `display`, a number in its unit otherwise. */
function glucoseProblem(x: unknown, as: 'number' | 'display' | 'either'): Problem {
  if (!isRecord(x)) return 'a glucose reading this app cannot read';
  if (as === 'display' || (as === 'either' && 'display' in x)) {
    if (x.display !== 'HI' && x.display !== 'LO') return `a glucose meter display other than HI or LO${quoted(x.display)}`;
    return timeProblem(x.measuredAt, 'a glucose meter display');
  }
  if (!isNumber(x.value)) return 'a glucose reading whose number cannot be read';
  if (!named(GLUCOSE_UNITS)(x.unit)) return `a glucose reading in a unit this app does not know${quoted(x.unit)}`;
  return timeProblem(x.measuredAt, 'a glucose reading');
}

function ketoneProblem(x: unknown): Problem {
  if (!isRecord(x)) return 'a ketone reading this app cannot read';
  if (x.kind === 'blood') {
    if (!isNumber(x.value)) return 'a blood ketone reading whose number cannot be read';
  } else if (x.kind === 'urine') {
    // A strip is its colour; before v5 it was stored as the number the old sheet gave that colour.
    if (!optional(x.category, named(URINE))) return `a urine ketone strip reading this app does not know${quoted(x.category)}`;
    if (!optional(x.value, isNumber)) return 'a urine ketone strip reading whose number cannot be read';
  } else {
    return `a ketone reading of a kind this app does not know${quoted(x.kind)}`;
  }
  return timeProblem(x.measuredAt, 'a ketone reading');
}

/** A partial reading is one severe number with the other box left empty (B07). */
function pressureProblem(x: unknown, partial = false): Problem {
  if (!isRecord(x)) return 'a blood pressure reading this app cannot read';
  const number = partial ? (n: unknown) => optional(n, isNumber) : isNumber;
  if (!number(x.sys) || !number(x.dia)) return 'a blood pressure reading whose numbers cannot be read';
  return timeProblem(x.at, 'a blood pressure reading');
}

/** Every reading a check-in holds: the field, what is wrong with one, and whether the field is a list of them. */
const READINGS: [string, (x: unknown) => Problem, boolean][] = [
  ['glucose', x => glucoseProblem(x, 'number'), false],
  ['glucoseDisplay', x => glucoseProblem(x, 'display'), false],
  ['glucoseEarlier', x => glucoseProblem(x, 'either'), true],
  ['ketones', ketoneProblem, false],
  ['ketonesEarlier', ketoneProblem, true],
  ['bp', x => pressureProblem(x), false],
  ['bpReadings', x => pressureProblem(x), true],
  ['bpEarlier', x => pressureProblem(x), true],
  ['bpPartial', x => pressureProblem(x, true), true],
];

/** The first reading in a check-in this app cannot read, in words; nothing when every one can be read. */
function unreadableReading(c: Record<string, unknown>): Problem {
  for (const [field, problem, list] of READINGS) {
    const value = c[field];
    if (value === undefined) continue;
    // A list that is not one holds nothing that can be read.
    for (const reading of list ? (Array.isArray(value) ? value : [null]) : [value]) {
      const found = problem(reading);
      if (found) return found;
    }
  }
  return undefined;
}
/** Every red flag this build names: the engine reads each one a day carries by its name (R5-01). */
const RED_FLAGS: Record<RedFlag, true> = { newWeakness: true, backFever: true, backSudden: true, footProblem: true, hotSwollenFoot: true };
const isRedFlag = named(RED_FLAGS);
/** An emergency answer this build cannot name would count as "None of these". */
const EMERGENCY: Record<EmergencyFlag, true> = {
  chest: true, stroke: true, collapse: true, breathless: true, bladderBowel: true, saddle: true, bothLegs: true,
  lowCantTreat: true, dka: true, accident: true, heatConfusion: true,
};
const EPISODE_KINDS: Record<EpisodeKind, true> = { extremeGlucose: true, severeBp: true, ketones: true, severeLow: true, redFlag: true, foot: true, news: true };
const RESOLUTIONS: Record<EpisodeAnswer['resolution'], true> = { mistake: true, assessed: true, resolved: true, reopened: true };
/**
 * An answer about serious readings, as its type says. Without the names of
 * the readings it settles, every gate stops on it; with an answer this build
 * does not know, it would settle a reading nobody answered for.
 */
const isAnswer = (x: unknown) => isRecord(x) && named(EPISODE_KINDS)(x.kind) && listOf(isText)(x.readings)
  && named(RESOLUTIONS)(x.resolution) && isAt(x.at);

export function isCheckInRecord(x: unknown): x is CheckInRecord {
  if (!isRecord(x) || !isDay(x.date)) return false;
  const r = x.readiness;
  if (!isRecord(r) || !isText(r.outcome)) return false;
  for (const list of [r.modifiers, r.actions, r.notices]) if (!optional(list, Array.isArray)) return false;
  // The day's details list the suggestion made at the time, reason by reason.
  if (!listOf(isRecord)(r.reasons)) return false;
  const back = x.back;
  // Every build writes `news`, and every rule reads it.
  return Array.isArray(x.news) && optional(x.newsEarlier, listOf(isText))
    && optional(x.urgentSymptoms, isBool) && optional(x.emergency, listOf(named(EMERGENCY)))
    // Read as true or false, where a word would say the opposite: recovered from a low.
    && optional(x.lowRecovered, isBool)
    // Never stored: the gates attach them to a day for themselves. Stored, they
    // would act as readings nobody took, or skip the day's red flags.
    && x.logged === undefined && x.readingsOnly === undefined
    && optional(x.sleep, isText) && optional(x.energy, isNumber) && optional(x.lowSymptomsAt, isAt)
    // A pain slider left untouched is not an answer, so back answers can come
    // without a score (J03, J16). Any value at all for the newer weakness and
    // numbness answers says they were asked, which sets an older record's
    // weakness aside.
    && optional(back, b => isRecord(b) && optional(b.pain, isNumber) && optional(b.legPain, isNumber)
      && optional(b.newWeakness, isBool) && optional(b.newSensory, isBool))
    && unreadableReading(x) === undefined
    && optional(x.resolutions, listOf(isAnswer))
    && optional(x.provoked, listOf(isText))
    && optional(x.flagsEarlier, listOf(isRedFlag));
}

export function isPersonalRecord(x: unknown): x is PersonalRecord {
  return isRecord(x) && isText(x.exerciseId) && isNumber(x.weight) && isNumber(x.reps) && isNumber(x.volume) && isText(x.date);
}

export function isBodyMetric(x: unknown): x is BodyMetric {
  return isRecord(x) && isDay(x.date) && isNumberOrNull(x.weight) && isNumberOrNull(x.waist) && optional(x.notes, isText);
}

const isContentRow = (x: unknown): x is ContentRow => isRecord(x) && isText(x.key) && x.key !== '';

/** Counts by collection. */
export interface CollectionCounts {
  observations: number;
  sessions: number;
  checkIns: number;
  personalRecords: number;
  bodyMetrics: number;
  focusOverrides: number;
  contentState: number;
}

const zero = (): CollectionCounts => ({
  observations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0, contentState: 0,
});

/** A file, checked and normalised, with what had to be left out. */
interface Parsed {
  file: TransferDoc;
  rejected: CollectionCounts;
  /** Settings and profile fields that could not be read, and are left out, by name (D-08). */
  unreadableFields: string[];
  /** A v4 backup from the old app, converted on the way in. */
  legacy: boolean;
}

/**
 * A backup made by the previous version of the app (Settings → Export) is a
 * v4 `AppData` blob, not a transfer document. It is converted through the
 * same tested ladder and projection the migration uses, so the owner's
 * existing backups stay restorable.
 */
function fromLegacyBackup(raw: Record<string, unknown>): TransferDoc | undefined {
  if (raw.format !== undefined || !isRecord(raw.settings) || !Array.isArray(raw.sessions)) return undefined;
  const version = Number(raw.version);
  if (Number.isFinite(version) && version > CURRENT_VERSION) return undefined;
  const data = migrateData(raw as unknown as AppData);
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: '',
    schemaVersion: SCHEMA_VERSION,
    observations: projectV4(data).observations,
    sessions: data.sessions,
    settings: data.settings,
    ...(data.profile !== undefined ? { profile: data.profile } : {}),
    checkIns: data.checkIns ?? [],
    personalRecords: data.personalRecords,
    bodyMetrics: data.bodyMetrics,
    focusOverrides: data.focusOverrides ?? {},
    contentState: [],
  };
}

type ParseResult = { ok: true; parsed: Parsed } | { ok: false; reason: string };

function parse(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, reason: 'That file is not a health record export.' };

  let legacy = false;
  let source: Record<string, unknown> = raw;
  if (raw.format !== TRANSFER_FORMAT) {
    let converted: TransferDoc | undefined;
    try {
      converted = fromLegacyBackup(raw);
    } catch {
      converted = undefined;
    }
    if (!converted) return { ok: false, reason: 'That file was made by a different app.' };
    source = converted as unknown as Record<string, unknown>;
    legacy = true;
  }

  if (typeof source.version !== 'number' || source.version > TRANSFER_VERSION) {
    return { ok: false, reason: 'That file was made by a newer version of this app. Update the app and try again.' };
  }
  // The file's schema says where its records came from. A newer one may hold
  // records this build cannot read, so it is refused before anything is
  // touched; an older or current one is read as this format and stored under
  // this device's own marker, never the file's (F07).
  if (source.schemaVersion !== undefined && (typeof source.schemaVersion !== 'number' || source.schemaVersion > SCHEMA_VERSION)) {
    return { ok: false, reason: 'That file was made by a newer version of this app. Update the app and try again.' };
  }

  const array = (x: unknown) => (Array.isArray(x) ? x : x === undefined ? [] : null);
  const lists = {
    observations: array(source.observations),
    sessions: array(source.sessions),
    checkIns: array(source.checkIns),
    personalRecords: array(source.personalRecords),
    bodyMetrics: array(source.bodyMetrics),
    contentState: array(source.contentState),
  };
  for (const [name, list] of Object.entries(lists)) {
    if (list === null) return { ok: false, reason: `That file's ${name} are not a list. It may be damaged.` };
  }
  const overrides = source.focusOverrides ?? {};
  if (!isRecord(overrides)) return { ok: false, reason: "That file's workout swaps are not readable. It may be damaged." };

  const counts = {
    observations: lists.observations!.length,
    sessions: lists.sessions!.length,
    checkIns: lists.checkIns!.length,
    personalRecords: lists.personalRecords!.length,
    bodyMetrics: lists.bodyMetrics!.length,
    focusOverrides: Object.keys(overrides).length,
    contentState: lists.contentState!.length,
  };
  for (const [name, n] of Object.entries(counts) as [keyof CollectionCounts, number][]) {
    if (n > IMPORT_LIMITS[name]) return { ok: false, reason: `That file holds more ${name} than a lifetime record could (${n}). It is not a record from this app.` };
  }
  // A reading this app cannot read is never left out with its day, even when
  // asked to import the rest: a dangerous one would be lost without a word.
  // The file is refused, saying which day holds what. A session keeps its own
  // copy of its day's check-in, read the same way.
  const embedded = lists.sessions!.map(s => (isRecord(s) ? s.checkIn : undefined));
  for (const c of [...lists.checkIns!, ...embedded]) {
    if (!isRecord(c)) continue;
    const problem = unreadableReading(c);
    if (problem) return { ok: false, reason: `That file's check-in${isDay(c.date) ? ` for ${c.date}` : ''} holds ${problem}. It may be damaged.` };
  }

  const rejected = zero();
  const keep = <T>(list: unknown[], ok: (x: unknown) => x is T, slot: keyof CollectionCounts): T[] => {
    const good = list.filter(ok);
    rejected[slot] += list.length - good.length;
    return good;
  };

  const observations = keep(lists.observations!, isObservation, 'observations');
  const sessions = keep(lists.sessions!, isSessionRecord, 'sessions');
  const checkIns = keep(lists.checkIns!, isCheckInRecord, 'checkIns');
  const personalRecords = keep(lists.personalRecords!, isPersonalRecord, 'personalRecords');
  const bodyMetrics = keep(lists.bodyMetrics!, isBodyMetric, 'bodyMetrics');
  const contentState = keep(lists.contentState!, isContentRow, 'contentState');
  const focusOverrides: Record<string, DayFocus> = {};
  for (const [day, focus] of Object.entries(overrides)) {
    if (isDay(day) && isText(focus)) focusOverrides[day] = focus as DayFocus;
    else rejected.focusOverrides += 1;
  }

  // Duplicate ids within one file: the first is kept, the rest are refused,
  // so a file can never quietly overwrite part of itself.
  const unique = <T>(list: T[], key: (item: T) => string, slot: keyof CollectionCounts): T[] => {
    const seen = new Set<string>();
    return list.filter(item => {
      const k = key(item);
      if (seen.has(k)) { rejected[slot] += 1; return false; }
      seen.add(k);
      return true;
    });
  };

  const settings = source.settings;
  const profile = source.profile;
  if (settings !== undefined && !isRecord(settings)) return { ok: false, reason: "That file's settings are not readable. It may be damaged." };
  if (profile !== undefined && !isRecord(profile)) return { ok: false, reason: "That file's profile is not readable. It may be damaged." };
  // Field by field, so a wrong-typed one is named and left out rather than stored (D-08).
  const settingsRead = settings !== undefined ? readSettings(settings) : undefined;
  const profileRead = profile !== undefined ? readProfile(profile) : undefined;

  return {
    ok: true,
    parsed: {
      legacy,
      rejected,
      unreadableFields: [...(settingsRead?.unreadable ?? []), ...(profileRead?.unreadable ?? [])],
      file: {
        format: TRANSFER_FORMAT,
        version: TRANSFER_VERSION,
        exportedAt: isText(source.exportedAt) ? source.exportedAt : '',
        schemaVersion: SCHEMA_VERSION,
        // A record's commit order is kept as an order, not as numbers: the
        // import restamps it in this database's own sequence (J05).
        observations: unique(observations, o => o.id, 'observations'),
        sessions: unique(sessions, s => s.id, 'sessions'),
        // Settings are filled with defaults wherever they are read, so they are
        // kept as the file has them. A profile is not: a hand-made or older
        // file must not hand the planner an incomplete one. (Filling a complete
        // profile changes nothing, so a real export round-trips unchanged.)
        ...(settingsRead ? { settings: settingsRead.settings as unknown as UserSettings } : {}),
        ...(profileRead?.profile ? { profile: createDefaultProfile(profileRead.profile as ProfileInput) } : {}),
        checkIns,
        personalRecords: unique(personalRecords, r => r.exerciseId, 'personalRecords'),
        bodyMetrics: unique(bodyMetrics, m => m.date, 'bodyMetrics'),
        focusOverrides,
        contentState: unique(contentState, r => r.key, 'contentState'),
      },
    },
  };
}

function stripSeq(o: Observation): Observation {
  if (o.seq === undefined) return o;
  const { seq, ...rest } = o;
  void seq;
  return rest;
}

/** Deep equality for plain JSON-like values: key order, `undefined` fields and NaN handled. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => sameValue(x, bb[i]));
  }
  const ka = Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every(k => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** When a record was last said: the correction time where there is one. */
const statedAt = (o: Observation) => Date.parse(o.editedAt ?? o.at);

/** Records derived from a session or a body measurement; re-derived on merge rather than taken. */
const isProjection = (o: Observation) => o.id.startsWith('bodyMetric:') || /^session:.*:backPain$/.test(o.id);

/**
 * Check-in readings as the day's record names them, from their lifted
 * records: one blood pressure per pair of halves.
 */
function checkInReadingsOf(list: readonly Observation[]): CheckInReading[] {
  const out: CheckInReading[] = [];
  const pairs = new Map<string, Observation[]>();
  for (const o of list) {
    const at = o.timeUnknown ? {} : { at: o.at };
    if (o.kind === 'glucose' && o.unit !== undefined) out.push({ kind: 'glucose', ...at, value: o.value, unit: o.unit });
    else if (o.kind === 'backPain' || o.kind === 'legPain') out.push({ kind: o.kind, value: o.value });
    else if (o.kind === 'bloodPressureSystolic' || o.kind === 'bloodPressureDiastolic') {
      const key = bpReadingId(o.context) ?? o.id;
      pairs.set(key, [...(pairs.get(key) ?? []), o]);
    }
  }
  for (const halves of pairs.values()) {
    const sys = halves.find(h => h.kind === 'bloodPressureSystolic');
    const dia = halves.find(h => h.kind === 'bloodPressureDiastolic');
    if (sys && dia) out.push({ kind: 'pressure', ...(sys.timeUnknown ? {} : { at: sys.at }), sys: sys.value, dia: dia.value });
  }
  return out;
}

/** A check-in's answers, without the readiness worked out from them. */
function answersOf(c: CheckInRecord): DailyCheckIn {
  const { readiness: _derived, ...answers } = c;
  void _derived;
  return answers;
}

/** A short name for a text, the same on every device. */
function digest(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/**
 * Two records under one old-style check-in reading id that are different
 * measurements, not one of them corrected (D-02). Never corrected on either
 * device, any difference means two readings. A correction changes the
 * number or the time (R5-02), so two that differ in both were two readings,
 * one of them corrected later.
 */
function otherReading(here: Observation, o: Observation): boolean {
  if (sameValue(stripSeq(here), stripSeq(o))) return false;
  if (here.editedAt === undefined && o.editedAt === undefined) return true;
  const moved = Date.parse(here.at) !== Date.parse(o.at);
  const changed = here.value !== o.value || here.unit !== o.unit;
  return moved && changed;
}

/**
 * An id numbered per day, as check-in readings were before D-02: the only kind
 * two devices can give two different readings. Any other — named by its
 * device, or by a merge — is one reading wherever it is. `checkInEventId`
 * numbered a day's events from 1, and no day has thousands; a device's name
 * is ten characters, which can all be digits.
 */
const sharedOldId = (reading: string) => /^checkIn:\d{4}-\d{2}-\d{2}(?:#[1-9]\d{0,3})?$/.test(reading);

/** The event a check-in reading belongs to: a pressure pair's reading id, or a single's id without its kind. */
const eventOf = (o: Observation) => bpReadingId(o.context) ?? o.id.slice(0, o.id.length - o.kind.length - 1);

/**
 * The file's observations, with each check-in reading that is a different
 * measurement from the one this device holds under its id renamed (D-02).
 *
 * Check-in readings were numbered per day, so two devices could each name
 * their own first reading of a day `checkIn:<day>:glucose`, and a merge took
 * one for the other. The file's is kept as a reading of its own instead, with
 * its blood-pressure partner, so a pair is never split. Its new name comes
 * from the old one and its time, so merging the same file again names it the
 * same and adds nothing; a correction of it still lands on it. And a reading
 * this device already holds under another name — because backups went both
 * ways — is taken for that one, so it is never held twice.
 */
export function separateCheckInReadings(file: readonly Observation[], here: ReadonlyMap<string, Observation>): Observation[] {
  const reading = (o: Observation) => bpReadingId(o.context) ?? o.id;
  const groups = new Map<string, Observation[]>();
  for (const o of file) {
    if (checkInDayOf(o) !== undefined) groups.set(reading(o), [...(groups.get(reading(o)) ?? []), o]);
  }
  const renamed = (o: Observation, event: string): Observation =>
    ({ ...o, id: `${event}:${o.kind}`, ...(bpReadingId(o.context) !== undefined ? { context: bpContext(event) } : {}) });
  const clash = (members: readonly Observation[]) => members.some(o => {
    const held = here.get(o.id);
    return held !== undefined && otherReading(held, o);
  });
  // A reading held here under another name is that reading: one this device
  // took from the other's file, or gave to it, coming back (D-02).
  const what = (o: Observation) => JSON.stringify([checkInDayOf(o), o.kind, Date.parse(o.at), o.value, o.unit, o.tag, o.editedAt]);
  const held = new Map<string, Observation>();
  for (const h of here.values()) if (checkInDayOf(h) !== undefined) held.set(what(h), h);
  const out = new Map<Observation, Observation>();
  for (const [key, members] of groups) {
    const same = members.map(o => held.get(what(o)));
    if (same.every(h => h !== undefined) && new Set(same.map(h => reading(h!))).size === 1) {
      members.forEach((o, i) => out.set(o, { ...o, id: same[i]!.id, context: same[i]!.context }));
      continue;
    }
    // A shared id that cannot have been given twice is one reading, corrected or not.
    if (!sharedOldId(eventOf(members[0])) || !clash(members)) continue;
    const stem = `checkIn:${checkInDayOf(members[0])}#m${digest(`${key}|${members[0].at}`)}`;
    for (let n = 0; ; n += 1) {
      const event = n === 0 ? stem : `${stem}${n.toString(36)}`;
      const moved = members.map(o => renamed(o, event));
      if (!clash(moved)) {
        members.forEach((o, i) => out.set(o, moved[i]));
        break;
      }
    }
  }
  return file.map(o => out.get(o) ?? o);
}

/** The device's records, for working out what an import conflicts with. */
export type ImportBase = Partial<Pick<Snapshot, 'observations' | 'sessions' | 'checkIns' | 'personalRecords' | 'bodyMetrics' | 'focusOverrides' | 'content' | 'settings' | 'profile'>>;

export type ConflictPolicy = 'keepDevice' | 'takeFile';

export interface ImportOptions {
  /**
   * What a merge does when this device and the file both hold a record and
   * disagree, and neither is provably newer. Defaults to keeping this
   * device's: an old backup must never silently undo later work (F08).
   */
  onConflict?: ConflictPolicy;
  /**
   * Import the readable rest of a file some of whose records could not be
   * read. Without it such a file is refused whole, so a damaged backup never
   * half-replaces a good record.
   */
  allowRejected?: boolean;
}

interface MergePlan {
  change: Change;
  conflicts: CollectionCounts;
  /** Records in the file that were deleted on this device, and stay deleted. */
  deletedHere: number;
  replacedObservations: number;
  counts: { observations: number; sessions: number; checkIns: number; personalRecords: number; bodyMetrics: number; contentState: number };
}

/**
 * How a merge reconciles the file with the device.
 *
 * - An observation keeps whichever copy was stated later, by its correction
 *   time where it has one, compared as instants. Two copies stated at the same
 *   moment that still differ are a conflict.
 * - A personal record keeps the heavier lift: that is what the field means.
 * - Sessions, check-in summaries, body measurements, workout swaps and reading
 *   state carry no revision of their own, so a difference is a conflict.
 * - This device's settings and profile are preferences, not history, and are
 *   kept; a device that has none takes the file's.
 * - Measurements derived from a session or a body measurement are derived
 *   again from whichever version of that record the merge keeps, so the two
 *   can never disagree.
 */
function planMerge(file: TransferDoc, base: ImportBase, policy: ConflictPolicy): MergePlan {
  const conflicts = zero();
  const takeFile = policy === 'takeFile';

  const hereObs = new Map((base.observations ?? []).map(o => [o.id, o]));
  // What was deleted here stays deleted: the file may be older than the deletion (D-06).
  const goneHere = {
    observations: new Set(base.settings?.deleted?.observations ?? []),
    sessions: new Set(base.settings?.deleted?.sessions ?? []),
    // A check-in reading also by what was measured, so a copy under another id is known too (R5-01).
    readings: new Set(base.settings?.deleted?.readings ?? []),
  };
  // A check-in reading by what was measured, and by its id as well: a
  // correction keeps the id, so a backup from before it holds the deleted
  // reading under that id with its old number, and the previous version
  // remembered ids alone. Not by an old shared id, though: two devices once
  // gave different readings one, and a deleted one must not take the other
  // with it. Anything else by its id.
  const deletedObservation = (o: Observation) => {
    if (hereObs.has(o.id)) return false;
    const key = readingKey(o);
    if (key !== undefined && goneHere.readings.has(key)) return true;
    return (key === undefined || !sharedOldId(eventOf(o))) && goneHere.observations.has(o.id);
  };
  // As the merge will hold them, for the series and the day's record alike.
  const incoming = separateCheckInReadings(file.observations, hereObs);
  let deletedHere = 0;
  const observationPuts: Observation[] = [];
  let replacedObservations = 0;
  for (const o of incoming) {
    if (isProjection(o)) continue;
    const here = hereObs.get(o.id);
    if (deletedObservation(o)) { deletedHere += 1; continue; }
    if (!here) { observationPuts.push(o); continue; }
    // Commit order is each device's own: compare what was said, not when it was stored.
    if (sameValue(stripSeq(here), stripSeq(o))) continue;
    const theirs = statedAt(o);
    const ours = statedAt(here);
    if (theirs > ours || (theirs === ours && takeFile)) {
      observationPuts.push(o);
      replacedObservations += 1;
    }
    if (theirs === ours) conflicts.observations += 1;
  }

  const hereSessions = new Map((base.sessions ?? []).map(s => [s.id, s]));
  const sessionPuts: WorkoutSession[] = [];
  for (const s of file.sessions) {
    const here = hereSessions.get(s.id);
    if (!here && goneHere.sessions.has(s.id)) { deletedHere += 1; continue; }
    if (here && sameValue(here, s)) continue;
    if (here) {
      conflicts.sessions += 1;
      if (!takeFile) continue;
    }
    sessionPuts.push(s);
  }

  // A reading deleted here comes out of the file's record of its day as well:
  // that record is what every gate reads, and a later save of that day would
  // lift the reading back out of it (R5-01).
  const goneOn = new Map<string, Observation[]>();
  for (const o of incoming) {
    const day = checkInDayOf(o);
    if (day !== undefined && deletedObservation(o)) goneOn.set(day, [...(goneOn.get(day) ?? []), o]);
  }
  const withoutDeleted = (c: CheckInRecord): CheckInRecord => {
    let record = c;
    for (const r of checkInReadingsOf(goneOn.get(c.date) ?? [])) record = (withReadingRemoved(record, r) as CheckInRecord | undefined) ?? record;
    return record;
  };

  // One summary per day, folded into a map and listed once at the end: copying
  // the list for every day of a long history is quadratic (R5-04).
  const byDate = new Map<string, CheckInRecord>();
  for (const c of base.checkIns ?? []) byDate.set(c.date, c);
  let checkInsChanged = false;
  const cleaned = new Set<CheckInRecord>();
  for (const given of file.checkIns) {
    const c = withoutDeleted(given);
    if (c !== given) cleaned.add(c);
    const here = byDate.get(c.date);
    // Two records that say the same are one, whatever readiness each was
    // given: it is worked out from the answers, and a cleaned record's is
    // worked out again below, so it never matches the file's.
    if (here && sameValue(answersOf(here), answersOf(c))) continue;
    if (here) {
      conflicts.checkIns += 1;
      if (!takeFile) continue;
    }
    byDate.set(c.date, c);
    checkInsChanged = true;
  }
  // A record a reading was taken out of has its readiness worked out again
  // without it, as deleting the reading in Track does: what is stored is what
  // a gate acts on.
  const checkIns = [...byDate.values()].map(c => {
    if (!cleaned.has(c) || !base.profile) return c;
    const plain = answersOf(c);
    const recent = [...byDate.values()].filter(x => x.date < c.date);
    return { ...plain, readiness: evaluateCheckIn(base.profile, plain, recent) } as CheckInRecord;
  });

  let personalRecords = base.personalRecords ?? [];
  let recordsChanged = false;
  for (const r of file.personalRecords) {
    const at = personalRecords.findIndex(x => x.exerciseId === r.exerciseId);
    const here = at === -1 ? undefined : personalRecords[at];
    if (here && sameValue(here, r)) continue;
    if (here && (r.volume < here.volume || (r.volume === here.volume && !takeFile))) {
      if (r.volume === here.volume) conflicts.personalRecords += 1;
      continue;
    }
    if (here && r.volume === here.volume) conflicts.personalRecords += 1;
    personalRecords = at === -1 ? [...personalRecords, r] : personalRecords.map((x, i) => (i === at ? r : x));
    recordsChanged = true;
  }

  const metricByDate = new Map((base.bodyMetrics ?? []).map(m => [m.date, m]));
  let bodyMetrics = base.bodyMetrics ?? [];
  const metricDates: string[] = [];
  for (const m of file.bodyMetrics) {
    const here = metricByDate.get(m.date);
    if (here && sameValue(here, m)) continue;
    if (here) {
      conflicts.bodyMetrics += 1;
      if (!takeFile) continue;
    }
    bodyMetrics = [...bodyMetrics.filter(x => x.date !== m.date), m];
    metricByDate.set(m.date, m);
    metricDates.push(m.date);
  }

  const focusOverrides = { ...(base.focusOverrides ?? {}) };
  let overridesChanged = false;
  for (const [day, focus] of Object.entries(file.focusOverrides)) {
    if (focusOverrides[day] === focus) continue;
    if (focusOverrides[day] !== undefined) {
      conflicts.focusOverrides += 1;
      if (!takeFile) continue;
    }
    focusOverrides[day] = focus;
    overridesChanged = true;
  }

  const content = base.content ?? {};
  const contentPuts: Record<string, unknown> = {};
  for (const row of file.contentState ?? []) {
    if (row.key in content && sameValue(content[row.key], row.value)) continue;
    if (row.key in content) {
      conflicts.contentState += 1;
      if (!takeFile) continue;
    }
    contentPuts[row.key] = row.value;
  }

  // Re-derive what sessions and body measurements imply, from the versions kept.
  const derived: Observation[] = [];
  const derivedRemovals: string[] = [];
  const pool = [...(base.observations ?? []), ...observationPuts];
  for (const date of metricDates) {
    const lifted = liftBodyMetric(date, metricByDate.get(date), pool);
    derived.push(...lifted.put);
    derivedRemovals.push(...lifted.remove);
  }
  for (const s of sessionPuts) {
    const lifted = liftSessionPain(s.id, s, pool);
    derived.push(...lifted.put);
    derivedRemovals.push(...lifted.remove);
  }

  // Deletions the file knows of and this device does not, of records it does not hold, are learned.
  const theirs = file.settings?.deleted;
  const learn = (mine: Set<string>, list: unknown, holds: (id: string) => boolean) =>
    (Array.isArray(list) ? list : []).filter((id): id is string => typeof id === 'string' && !mine.has(id) && !holds(id));
  const learnedObservations = learn(goneHere.observations, theirs?.observations, id => hereObs.has(id));
  const learnedSessions = learn(goneHere.sessions, theirs?.sessions, id => hereSessions.has(id));
  const heldReadings = Array.isArray(theirs?.readings) && theirs.readings.length > 0
    ? new Set([...hereObs.values()].map(readingKey).filter(Boolean))
    : new Set<string | undefined>();
  const learnedReadings = learn(goneHere.readings, theirs?.readings, key => heldReadings.has(key));
  const learned = learnedObservations.length + learnedSessions.length + learnedReadings.length > 0
    ? {
      observations: [...goneHere.observations, ...learnedObservations],
      sessions: [...goneHere.sessions, ...learnedSessions],
      readings: [...goneHere.readings, ...learnedReadings],
    }
    : undefined;

  const change: Change = {
    observations: { put: [...observationPuts, ...derived], remove: derivedRemovals, keepOrder: true },
    sessions: { put: sessionPuts },
    ...(checkInsChanged ? { checkIns: [...checkIns].sort((a, b) => a.date.localeCompare(b.date)) } : {}),
    ...(recordsChanged ? { personalRecords } : {}),
    ...(metricDates.length > 0 ? { bodyMetrics: [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date)) } : {}),
    ...(overridesChanged ? { focusOverrides } : {}),
    ...(Object.keys(contentPuts).length > 0 ? { content: { put: contentPuts } } : {}),
    // A device with no settings or profile yet is being set up from this file.
    ...(base.settings === undefined && file.settings !== undefined
      ? { settings: { replace: file.settings } }
      : learned ? { settings: { patch: { deleted: learned } } } : {}),
    ...(base.profile === undefined && file.profile !== undefined ? { profile: file.profile } : {}),
  };

  return {
    change,
    conflicts,
    deletedHere,
    replacedObservations,
    counts: {
      observations: observationPuts.length + derived.length,
      sessions: sessionPuts.length,
      checkIns: checkInsChanged ? checkIns.length : (base.checkIns ?? []).length,
      personalRecords: personalRecords.length,
      bodyMetrics: bodyMetrics.length,
      contentState: Object.keys(contentPuts).length,
    },
  };
}

export interface ImportPreview {
  ok: true;
  exportedAt?: string;
  schemaVersion?: number;
  /** How many readable observations the file holds, per kind. */
  observations: Partial<Record<ObservationKind, number>>;
  /** Observation records in the file that cannot be read, and will not be imported. */
  unreadableObservations: number;
  sessions: number;
  checkIns: number;
  personalRecords: number;
  bodyMetrics: number;
  focusOverrides: number;
  /** Reading state rows (the `content-state` store). Always set by `previewImport`. */
  contentState?: number;
  hasSettings: boolean;
  hasProfile: boolean;
  /** The span the readings cover, for "records from … to …". */
  range?: { from: string; to: string };
  /** How many of the file's observations this device already holds, by id. */
  alreadyHere: number;
  /** Nothing in it at all: no records, no settings, no profile. Worth saying before someone replaces their record with it. */
  isEmpty: boolean;
  /**
   * Records in the file that cannot be read, by collection. Any at all and
   * `applyImport` refuses the file unless asked to `allowRejected`. Always set
   * by `previewImport`; optional only so older literals of this type compile.
   */
  rejected?: CollectionCounts;
  /**
   * Records both here and in the file that disagree with no way to tell which
   * is newer, by collection; a merge keeps this device's unless told otherwise.
   * Zero unless the device's records were passed in. Always set by `previewImport`.
   */
  conflicts?: CollectionCounts;
  /** A backup from the previous version of the app, which will be converted. Always set by `previewImport`. */
  legacy?: boolean;
  /** Records in the file deleted on this device since, which a merge leaves deleted (D-06). Always set by `previewImport`. */
  deletedHere?: number;
  /** Settings and profile fields that cannot be read, and are left out, by name (D-08). Always set by `previewImport`. */
  unreadableFields?: string[];
}

export interface ImportProblem {
  ok: false;
  reason: string;
}

function isIdList(x: unknown): x is Iterable<string> {
  return typeof x === 'object' && x !== null && Symbol.iterator in x;
}

/**
 * What is in this file, before anything is written.
 *
 * Pass this device's records (or, as before, just its observation ids) to
 * learn how much is already here and what a merge would conflict with.
 */
export function previewImport(raw: unknown, existing: Iterable<string> | ImportBase = []): ImportPreview | ImportProblem {
  const result = parse(raw);
  if (!result.ok) return { ok: false, reason: result.reason };
  const { file, rejected, legacy, unreadableFields } = result.parsed;

  const base: ImportBase = isIdList(existing) ? {} : existing;
  const here = isIdList(existing) ? new Set(existing) : new Set((existing.observations ?? []).map(o => o.id));
  // As the merge will hold them: a different measurement under a shared id is not "already here" (D-02).
  const incoming = isIdList(existing)
    ? file.observations
    : separateCheckInReadings(file.observations, new Map((existing.observations ?? []).map(o => [o.id, o])));

  const observations: Partial<Record<ObservationKind, number>> = {};
  for (const o of file.observations) observations[o.kind] = (observations[o.kind] ?? 0) + 1;
  const days = file.observations.map(o => o.day).sort();
  const merge = planMerge(file, base, 'keepDevice');
  const counts = {
    sessions: file.sessions.length,
    checkIns: file.checkIns.length,
    personalRecords: file.personalRecords.length,
    bodyMetrics: file.bodyMetrics.length,
    focusOverrides: Object.keys(file.focusOverrides).length,
    contentState: (file.contentState ?? []).length,
  };

  return {
    ok: true,
    ...(file.exportedAt ? { exportedAt: file.exportedAt } : {}),
    ...(isRecord(raw) && typeof raw.schemaVersion === 'number' ? { schemaVersion: raw.schemaVersion } : {}),
    observations,
    unreadableObservations: rejected.observations,
    ...counts,
    hasSettings: file.settings !== undefined,
    hasProfile: file.profile !== undefined,
    ...(days.length > 0 ? { range: { from: days[0], to: days[days.length - 1] } } : {}),
    alreadyHere: incoming.filter(o => here.has(o.id)).length,
    // Health answers and settings alone are worth restoring: they are what a new device needs most (D-07).
    isEmpty: file.observations.length === 0 && Object.values(counts).every(n => n === 0) && file.settings === undefined && file.profile === undefined,
    rejected,
    conflicts: merge.conflicts,
    deletedHere: merge.deletedHere,
    unreadableFields,
    legacy,
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  mode: ImportMode;
  /** Observations written. */
  observations: number;
  /** Of those, how many replaced a record already on the device. */
  replacedObservations: number;
  sessions: number;
  checkIns: number;
  personalRecords: number;
  bodyMetrics: number;
  /** Records in the file that could not be read, and were left out. */
  skipped: number;
  /** Merge only: records that disagreed, by collection, resolved by the conflict policy. */
  conflicts?: CollectionCounts;
}

export interface ImportPlan {
  change: Change;
  report: ImportReport;
}

/**
 * What importing this file into this snapshot would change. Pure; throws a
 * `StoreFailure` for a file that must not be imported, before anything is
 * written.
 */
export function planImport(raw: unknown, mode: ImportMode, base: Snapshot, options: ImportOptions = {}): ImportPlan {
  const result = parse(raw);
  if (!result.ok) throw new StoreFailure('invalid', result.reason);
  const { file, rejected, unreadableFields } = result.parsed;

  const refused = Object.values(rejected).reduce((t, n) => t + n, 0) + unreadableFields.length;
  if (refused > 0 && !options.allowRejected) {
    throw new StoreFailure(
      'invalid',
      `${refused} record${refused === 1 ? '' : 's'} in that file could not be read, so nothing was changed. You can import the rest, leaving ${refused === 1 ? 'it' : 'them'} out.`,
    );
  }

  if (mode === 'replace') {
    return {
      change: {
        reset: true,
        schemaVersion: SCHEMA_VERSION,
        observations: { put: file.observations, keepOrder: true },
        sessions: { put: file.sessions },
        ...(file.settings !== undefined ? { settings: { replace: file.settings } } : {}),
        ...(file.profile !== undefined ? { profile: file.profile } : {}),
        checkIns: file.checkIns,
        personalRecords: file.personalRecords,
        bodyMetrics: file.bodyMetrics,
        focusOverrides: file.focusOverrides,
        content: { put: Object.fromEntries((file.contentState ?? []).map(r => [r.key, r.value])) },
      },
      report: {
        mode,
        observations: file.observations.length,
        replacedObservations: 0,
        sessions: file.sessions.length,
        checkIns: file.checkIns.length,
        personalRecords: file.personalRecords.length,
        bodyMetrics: file.bodyMetrics.length,
        skipped: refused,
      },
    };
  }

  const merge = planMerge(file, base, options.onConflict ?? 'keepDevice');
  return {
    change: merge.change,
    report: {
      mode,
      observations: merge.counts.observations,
      replacedObservations: merge.replacedObservations,
      sessions: merge.counts.sessions,
      checkIns: merge.counts.checkIns,
      personalRecords: merge.counts.personalRecords,
      bodyMetrics: merge.counts.bodyMetrics,
      skipped: refused,
      conflicts: merge.conflicts,
    },
  };
}

/**
 * Write an imported file, in one transaction against what is really stored.
 *
 * `replace` leaves the device holding exactly what the file held; `merge`
 * reconciles the two (see `planMerge`). Either way a failure leaves the device
 * as it was.
 */
export async function applyImport(db: Db, raw: unknown, mode: ImportMode, options: ImportOptions = {}): Promise<StoreResult<ImportReport>> {
  let report: ImportReport | undefined;
  const committed = await commitChange(db, undefined, base => {
    const plan = planImport(raw, mode, base, options);
    report = plan.report;
    return { change: plan.change };
  });
  if (!committed.ok) return { ok: false, failure: committed.failure };
  return { ok: true, value: report! };
}

// ============================================================================
// Handing the file to the user (D17)
// ============================================================================

export type Delivery = 'share' | 'download' | 'cancelled';

export interface DeliveryEnv {
  navigator?: Navigator;
  document?: Document;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

/**
 * Whether this browser will take the file through the share sheet.
 *
 * `canShare({ files })` is the only reliable test: iOS Safari has `share` but
 * refuses file payloads in some versions, and claiming otherwise would mean an
 * export button that silently does nothing.
 */
export function deliveryMethod(file: File, nav: Navigator | undefined = globalThis.navigator): 'share' | 'download' {
  try {
    if (typeof nav?.share !== 'function' || typeof nav.canShare !== 'function') return 'download';
    return nav.canShare({ files: [file] }) ? 'share' : 'download';
  } catch {
    return 'download';
  }
}

/**
 * Hand the file over, however this browser allows.
 *
 * A cancelled share is not a failure — the user changed their mind. Any other
 * share failure falls through to a download, because the user asked for their
 * data and must end up with it.
 */
export async function deliver(file: File, env: DeliveryEnv = {}): Promise<StoreResult<Delivery>> {
  const nav = 'navigator' in env ? env.navigator : globalThis.navigator;

  if (nav && deliveryMethod(file, nav) === 'share') {
    try {
      await nav.share({ files: [file] });
      return { ok: true, value: 'share' };
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError') {
        return { ok: true, value: 'cancelled' };
      }
      // Fall through: sharing failing is not a reason to withhold the file.
    }
  }

  return download(file, env);
}

function download(file: File, env: DeliveryEnv): StoreResult<Delivery> {
  const host = 'document' in env ? env.document : globalThis.document;
  const makeUrl = env.createObjectURL ?? (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL : undefined);
  const cannot = (cause?: unknown) => ({
    ok: false as const,
    failure: new StoreFailure('unknown', 'This browser could not be given the file. Try again, or from the app on the Home Screen.', cause),
  });
  if (!host || typeof host.createElement !== 'function' || !makeUrl) return cannot();

  try {
    const url = makeUrl(file);
    const link = host.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    // Safari is more reliable downloading a link that is in the document.
    host.body?.appendChild?.(link);
    link.click();
    host.body?.removeChild?.(link);

    const revoke = env.revokeObjectURL ?? (typeof URL !== 'undefined' ? URL.revokeObjectURL : undefined);
    // Not in this tick: revoking before the browser has started the download
    // cancels it in Safari.
    if (revoke) setTimeout(() => revoke(url), 0);
    return { ok: true, value: 'download' };
  } catch (error) {
    return cannot(error);
  }
}
