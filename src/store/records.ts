/**
 * The v2 record stores (journey §18.2–18.3): one registry, so the snapshot,
 * the deletion records (D-06), backups, merges and import validation treat a
 * route and a meal the same way. Each store's own rule says how its records
 * are keyed, read, merged and backed up. Plan 7 fills in the food stores'
 * rules; nothing else in the store changes for them.
 */
import type { UserSettings } from '@/types';
import { routeProblem } from '@/walk/routeRecord';

export const RECORD_STORES = ['routes', 'meals', 'savedMeals', 'customFoods'] as const;
export type RecordStore = (typeof RECORD_STORES)[number];

/** A stored v2 record: a plain object, keyed by its store's key path. */
export type StoredRecord = Record<string, unknown>;
export type Records = Record<RecordStore, StoredRecord[]>;

export interface RecordRule {
  /** The IndexedDB key path, and the field that names a record in merges and deletion records. */
  keyPath: 'id' | 'walkId';
  /** For counts and refusals: "1 walk route", "12 walk routes". */
  label: { one: string; many: string };
  /** The most a backup file may hold, checked before anything in it is read. */
  limit: number;
  /** In every backup, or only when the person includes it (routes, §18.3). */
  backup: 'always' | 'optIn';
  /** Why a record from a file or the store can't be read; nothing when it can. Runs after the key check. */
  problem(record: StoredRecord): string | undefined;
  /** Two different copies of one record: >0 takes the file's, <0 keeps this device's, 0 is a conflict. Absent: always a conflict. */
  newer?(here: StoredRecord, file: StoredRecord): number;
  /** Whether this device takes the store's records from a file at all. Absent: always. */
  accepts?(device: UserSettings | undefined): boolean;
  /** Whether this device takes one record from a file, the store taken. Absent: every one. */
  keeps?(device: UserSettings | undefined, record: StoredRecord): boolean;
}

const notYet = (what: string) => (): string => `This version of the app cannot read ${what} yet.`;

export const RECORD_RULES: Record<RecordStore, RecordRule> = {
  routes: {
    keyPath: 'walkId',
    label: { one: 'walk route', many: 'walk routes' },
    limit: 100_000,
    backup: 'optIn',
    problem: routeProblem,
    // Saved routes never change; two different copies are a conflict, and this phone's is kept.
    // Only a phone whose person said Yes to keeping routes takes them from a file: not asked
    // yet is not a yes, and a new phone asks on its first walk with location (§9.1, B-26, H6-05).
    accepts: device => device?.walk?.saveRoutes === true,
    // Erased for good (B-05): no route of a walk that began before the last "Erase all routes" comes back from a file.
    keeps: (device, record) => {
      const at = device?.walk?.routesErasedAt;
      return at === undefined || Date.parse(String(record.startedAt)) > at;
    },
  },
  // Plan 7 replaces these three with its record types and rules.
  meals: { keyPath: 'id', label: { one: 'meal', many: 'meals' }, limit: 200_000, backup: 'always', problem: notYet('meals') },
  savedMeals: { keyPath: 'id', label: { one: 'saved meal', many: 'saved meals' }, limit: 10_000, backup: 'always', problem: notYet('saved meals') },
  customFoods: { keyPath: 'id', label: { one: 'custom food', many: 'custom foods' }, limit: 10_000, backup: 'always', problem: notYet('custom foods') },
};

/** The stores a backup holds unless the person chooses otherwise. */
export const DEFAULT_BACKUP_STORES: readonly RecordStore[] = RECORD_STORES.filter(s => RECORD_RULES[s].backup === 'always');

export const isRecordStore = (x: unknown): x is RecordStore => typeof x === 'string' && (RECORD_STORES as readonly string[]).includes(x);

export function emptyRecords(): Records {
  return { routes: [], meals: [], savedMeals: [], customFoods: [] };
}

/** A record's key in its store; empty when it has none. */
export function recordKey(store: RecordStore, record: StoredRecord): string {
  const key = record[RECORD_RULES[store].keyPath];
  return typeof key === 'string' ? key : '';
}

/** Why a record can't be kept in its store, or nothing. */
export function recordProblem(store: RecordStore, record: unknown): string | undefined {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return 'A record must be an object.';
  const rule = RECORD_RULES[store];
  const key = (record as StoredRecord)[rule.keyPath];
  if (typeof key !== 'string' || key === '') return `A ${rule.label.one} needs its ${rule.keyPath}.`;
  return rule.problem(record as StoredRecord);
}

/** By key, so a store's order never depends on when a row was written. */
export function sortRecords(store: RecordStore, list: readonly StoredRecord[]): StoredRecord[] {
  return [...list].sort((a, b) => {
    const x = recordKey(store, a);
    const y = recordKey(store, b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
