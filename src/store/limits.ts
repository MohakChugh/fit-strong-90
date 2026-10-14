/**
 * What a restore takes (B-26, board D108), in one place. `transfer.ts`
 * refuses a file past any of these before reading its records or converting
 * it; Me → Data lists them in these words; and an export says plainly when
 * the record it writes is past one. Each refusal names the limit and the
 * file's own figure, and says nothing was changed, because nothing was.
 *
 * Sized from a lifetime: a heavy day is about twenty readings, 7,300 a year
 * and under half a million in sixty, about 100 MB of text; 128 MB covers it
 * and stays below what an iPhone's web content process can parse. Route
 * points are bounded by that size too: as this app writes them, 128 MB holds
 * fewer than 50,00,000. No text the app writes comes near 1,00,000
 * characters. None of this promises that every record fits: one past a
 * limit still exports whole, and says so (D108).
 */
import { StoreFailure } from './db';
import { RECORD_RULES, RECORD_STORES, type RecordStore } from './records';

export const IMPORT_LIMITS = {
  bytes: 128 * 1024 * 1024,
  observations: 1_000_000,
  sessions: 100_000,
  checkIns: 100_000,
  personalRecords: 10_000,
  bodyMetrics: 100_000,
  focusOverrides: 100_000,
  contentState: 100_000,
  ...(Object.fromEntries(RECORD_STORES.map(s => [s, RECORD_RULES[s].limit])) as Record<RecordStore, number>),
  /** Every route's points together. */
  routePoints: 5_000_000,
  /** The longest single text anywhere in a file, a key included. */
  textChars: 100_000,
  /** How deep a file's lists and objects nest. This app's own go about 8 deep. */
  depth: 32,
} as const;

export type CountLimit = 'observations' | 'sessions' | 'checkIns' | 'personalRecords' | 'bodyMetrics' | 'focusOverrides' | 'contentState' | RecordStore;

const COUNTS: readonly CountLimit[] = ['observations', 'sessions', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides', 'contentState', ...RECORD_STORES];

/** What each count is called, in a refusal and in Me → Data. */
export const COUNT_NAMES: Record<CountLimit, string> = {
  observations: 'readings',
  sessions: 'sessions',
  checkIns: 'check-ins',
  personalRecords: 'personal records',
  bodyMetrics: 'body measurements',
  focusOverrides: 'workout swaps',
  // The content-state store, as a backup holds it: what has been read in Learn. This device's own rows
  // (Recently deleted, the lineage, expiry's clock) never travel (D109), so they are never counted here.
  contentState: 'Learn progress entries',
  ...(Object.fromEntries(RECORD_STORES.map(s => [s, RECORD_RULES[s].label.many])) as Record<RecordStore, string>),
};

export const countLabel = (name: CountLimit): string => `${COUNT_NAMES[name].charAt(0).toUpperCase()}${COUNT_NAMES[name].slice(1)}`;

export const NOTHING_CHANGED = 'Nothing was changed.';

const n = (x: number) => x.toLocaleString('en-IN');

/** "1 KB", "1.3 MB", "128 MB": a file's size near enough as Files shows it. */
export function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${n(Math.max(1, Math.ceil(bytes / 1024)))} KB`;
  return `${n(Number(mb.toFixed(1)))} MB`;
}

/** What a file, or a record about to be written as one, holds past a limit. */
export type Excess =
  | { kind: 'bytes'; bytes: number; max: number }
  | { kind: 'unpacked'; max: number }
  | { kind: 'count'; name: CountLimit; count: number }
  | { kind: 'points'; count: number }
  | { kind: 'text'; chars: number }
  | { kind: 'depth' };

/** The excess in words, after "it". */
function past(e: Excess): string {
  switch (e.kind) {
    case 'bytes': return `is ${sizeText(e.bytes)}, and a restore takes at most ${sizeText(e.max)}`;
    case 'unpacked': return `unpacks to over ${sizeText(e.max)}, and a restore takes at most ${sizeText(e.max)}`;
    case 'count': return `holds ${n(e.count)} ${COUNT_NAMES[e.name]}, and a restore takes at most ${n(IMPORT_LIMITS[e.name])}`;
    case 'points': return `holds ${n(e.count)} route points, and a restore takes at most ${n(IMPORT_LIMITS.routePoints)}`;
    case 'text': return `holds a text ${n(e.chars)} characters long, and a restore takes none longer than ${n(IMPORT_LIMITS.textChars)}`;
    case 'depth': return 'is built in a way this app never writes';
  }
}

/** A file refused (B-26): "That file holds 10,00,001 readings, and a restore takes at most 10,00,000. Nothing was changed." */
export function refusal(e: Excess): string {
  const lead = e.kind === 'bytes' || e.kind === 'unpacked' ? 'That file is too large to restore: it' : 'That file';
  return `${lead} ${past(e)}. ${NOTHING_CHANGED}`;
}

/** A backup past a limit, said when it is made (D108, P8-17): it still holds every record. */
export function exportWarning(e: Excess): string {
  return `This backup holds everything, but it ${past(e)}, so this version of the app can’t restore it. Keep it: nothing was left out of it.`;
}

export const tooLarge = (bytes: number, max: number = IMPORT_LIMITS.bytes): string => refusal({ kind: 'bytes', bytes, max });
export const unpacksTooLarge = (max: number = IMPORT_LIMITS.bytes): string => refusal({ kind: 'unpacked', max });
export const tooMany = (name: CountLimit, count: number): string => refusal({ kind: 'count', name, count });
export const tooManyPoints = (count: number): string => refusal({ kind: 'points', count });
export const textTooLong = (chars: number): string => refusal({ kind: 'text', chars });
export const tooDeep = (): string => refusal({ kind: 'depth' });

/** Every route's points, from whatever a file holds: a damaged route counts none, and validation refuses it later. */
export function routePoints(routes: unknown): number {
  if (!Array.isArray(routes)) return 0;
  let points = 0;
  for (const route of routes) {
    const segments = (route as { segments?: unknown } | null | undefined)?.segments;
    if (!Array.isArray(segments)) continue;
    for (const segment of segments) {
      const coords = (segment as { coords?: unknown } | null | undefined)?.coords;
      if (Array.isArray(coords)) points += coords.length;
    }
  }
  return points;
}

/** What the walk held: a test's proof that it keeps one frame per level, however broad the document (P8-16). */
export interface ShapeStats {
  /** The most frames it held at once: one per level. */
  frames: number;
}

type Frame = { list: readonly unknown[]; at: number; depth: number } | { object: Record<string, unknown>; keys: readonly string[]; at: number; depth: number };

/**
 * A text too long, or nesting too deep, anywhere in a document (Review Focus
 * 5). One frame per level, each going through its list by index or its
 * object's keys in turn, with no call stack, so no document is deep enough to
 * overflow it (P8-16). `JSON.parse` has already put the whole document in
 * memory, so the walk adds at most memory in proportion to it, which the
 * file-size limit bounds (P8R-13, rejected with that reason).
 */
export function shapeExcess(root: unknown, stats?: ShapeStats): Excess | undefined {
  const look = (value: unknown, depth: number): Excess | Frame | undefined => {
    if (typeof value === 'string') return value.length > IMPORT_LIMITS.textChars ? { kind: 'text', chars: value.length } : undefined;
    if (typeof value !== 'object' || value === null) return undefined;
    if (depth > IMPORT_LIMITS.depth) return { kind: 'depth' };
    return Array.isArray(value) ? { list: value, at: 0, depth } : { object: value as Record<string, unknown>, keys: Object.keys(value), at: 0, depth };
  };
  const first = look(root, 1);
  if (!first || 'kind' in first) return first;
  const stack: Frame[] = [first];
  if (stats) stats.frames = 1;
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    let child: unknown;
    if ('list' in top) {
      if (top.at >= top.list.length) { stack.pop(); continue; }
      child = top.list[top.at++];
    } else {
      if (top.at >= top.keys.length) { stack.pop(); continue; }
      const key = top.keys[top.at++];
      if (key.length > IMPORT_LIMITS.textChars) return { kind: 'text', chars: key.length };
      child = top.object[key];
    }
    const next = look(child, top.depth + 1);
    if (!next) continue;
    if ('kind' in next) return next;
    stack.push(next);
    if (stats && stack.length > stats.frames) stats.frames = stack.length;
  }
  return undefined;
}

export const shapeProblem = (root: unknown, stats?: ShapeStats): string | undefined => {
  const e = shapeExcess(root, stats);
  return e ? refusal(e) : undefined;
};

/** The first count past its limit. */
export function countExcess(counts: Readonly<Partial<Record<CountLimit, number>>>): Excess | undefined {
  for (const name of COUNTS) {
    const count = counts[name] ?? 0;
    if (count > IMPORT_LIMITS[name]) return { kind: 'count', name, count };
  }
  return undefined;
}

/**
 * A legacy (v4) backup's own counts, before it is converted (P8-15): the
 * conversion makes readings out of its sessions and check-ins, so one past a
 * limit is refused before any of that work begins.
 */
export function legacyExcess(raw: Readonly<Record<string, unknown>>): Excess | undefined {
  const length = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  const overrides = raw.focusOverrides;
  return countExcess({
    sessions: length(raw.sessions),
    checkIns: length(raw.checkIns),
    personalRecords: length(raw.personalRecords),
    bodyMetrics: length(raw.bodyMetrics),
    focusOverrides: typeof overrides === 'object' && overrides !== null ? Object.keys(overrides).length : 0,
  });
}

/** The parts of a backup document the limits read. */
export interface CountedDoc {
  observations: readonly unknown[];
  sessions: readonly unknown[];
  checkIns: readonly unknown[];
  personalRecords: readonly unknown[];
  bodyMetrics: readonly unknown[];
  focusOverrides: Readonly<Record<string, unknown>>;
  contentState?: readonly unknown[];
  records?: Partial<Record<RecordStore, readonly unknown[]>>;
}

/** A record about to be written as a backup, against the same limits a restore applies (D108, P8-17). */
export function exportExcess(doc: CountedDoc, size: { packed: number; unpacked: number }): Excess | undefined {
  if (size.packed > IMPORT_LIMITS.bytes) return { kind: 'bytes', bytes: size.packed, max: IMPORT_LIMITS.bytes };
  if (size.unpacked > IMPORT_LIMITS.bytes) return { kind: 'unpacked', max: IMPORT_LIMITS.bytes };
  const counted = countExcess({
    observations: doc.observations.length,
    sessions: doc.sessions.length,
    checkIns: doc.checkIns.length,
    personalRecords: doc.personalRecords.length,
    bodyMetrics: doc.bodyMetrics.length,
    focusOverrides: Object.keys(doc.focusOverrides).length,
    contentState: doc.contentState?.length ?? 0,
    ...(Object.fromEntries(RECORD_STORES.map(s => [s, doc.records?.[s]?.length ?? 0])) as Record<RecordStore, number>),
  });
  if (counted) return counted;
  const points = routePoints(doc.records?.routes);
  if (points > IMPORT_LIMITS.routePoints) return { kind: 'points', count: points };
  return shapeExcess(doc);
}

/** The part of a `File` a restore reads. */
export interface BackupFile {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** A chosen file's bytes, refused by its size before a byte of it is read (P8-15). */
export async function readBackupFile(file: BackupFile, max: number = IMPORT_LIMITS.bytes): Promise<ArrayBuffer> {
  if (file.size > max) throw new StoreFailure('invalid', tooLarge(file.size, max));
  return file.arrayBuffer();
}

/** Me → Data's "What a backup can hold", in this order. */
export function limitLines(): { label: string; value: string }[] {
  return [
    { label: 'File size', value: `${sizeText(IMPORT_LIMITS.bytes)}, packed or unpacked` },
    ...COUNTS.map(name => ({ label: countLabel(name), value: n(IMPORT_LIMITS[name]) })),
    { label: 'Route points, all routes together', value: n(IMPORT_LIMITS.routePoints) },
    { label: 'Longest single text', value: `${n(IMPORT_LIMITS.textChars)} characters` },
  ];
}
