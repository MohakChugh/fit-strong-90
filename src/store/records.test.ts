import { describe, expect, it } from 'vitest';
import type { UserSettings } from '@/types';
import { routeRecord, type RouteLine } from '@/walk/routeRecord';
import { DEFAULT_BACKUP_STORES, RECORD_RULES, RECORD_STORES, emptyRecords, recordKey, recordProblem, type StoredRecord } from './records';
import { emptySnapshot, prepare } from './snapshot';

const LINE: RouteLine = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
const route = (walkId: string): StoredRecord => routeRecord(walkId, '2026-10-08T09:00:00.000+05:30', [LINE])! as unknown as StoredRecord;
const settings = (walk: UserSettings['walk']) => ({ walk }) as UserSettings;

describe('the v2 record stores', () => {
  it('are the four the journey names, each with a key, a limit and a backup rule', () => {
    expect([...RECORD_STORES]).toEqual(['routes', 'meals', 'savedMeals', 'customFoods']);
    expect(RECORD_RULES.routes).toMatchObject({ keyPath: 'walkId', backup: 'optIn' });
    for (const s of ['meals', 'savedMeals', 'customFoods'] as const) expect(RECORD_RULES[s]).toMatchObject({ keyPath: 'id', backup: 'always' });
    expect(DEFAULT_BACKUP_STORES).toEqual(['meals', 'savedMeals', 'customFoods']);
  });

  it('read a route by its walk, and refuse a record with no key', () => {
    expect(recordKey('routes', route('walk-aaaa'))).toBe('walk-aaaa');
    expect(recordProblem('routes', { version: 1 })).toMatch(/walkId/);
    expect(recordProblem('routes', 'a string')).toMatch(/object/);
    expect(recordProblem('routes', route('walk-aaaa'))).toBeUndefined();
  });

  it('refuse a food record they can’t read, saying why (Plan 7)', () => {
    expect(recordProblem('meals', { id: 'm1' })).toMatch(/when it was eaten/);
  });

  it('take a file’s routes only onto a phone that has not said No (Review Focus 4)', () => {
    const accepts = RECORD_RULES.routes.accepts!;
    expect(accepts(undefined)).toBe(true);
    expect(accepts(settings({ saveRoutes: 'unasked', map: 'unasked' }))).toBe(true);
    expect(accepts(settings({ saveRoutes: true, map: 'off' }))).toBe(true);
    expect(accepts(settings({ saveRoutes: false, map: 'off' }))).toBe(false);
  });
});

describe('prepare, for records and the journal', () => {
  it('puts, replaces by key and removes, keeping each store in key order', () => {
    let s = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-bbbb'), route('walk-aaaa')] } } }).next;
    expect(s.records.routes.map(r => r.walkId)).toEqual(['walk-aaaa', 'walk-bbbb']);
    s = prepare(s, { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(s.records.routes.map(r => r.walkId)).toEqual(['walk-bbbb']);
  });

  it('remembers a removed key as deleted, and forgets it when the key is written again (D-06)', () => {
    let s = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    s = prepare(s, { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(s.settings?.deleted?.records?.routes).toEqual(['walk-aaaa']);
    s = prepare(s, { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    expect(s.settings?.deleted).toBeUndefined();
  });

  it('puts a key both put and removed in one change, without remembering it as deleted', () => {
    const base = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    const { next, writes } = prepare(base, { records: { routes: { put: [route('walk-aaaa')], remove: ['walk-aaaa'] } } });
    expect(next.records.routes.map(r => r.walkId)).toEqual(['walk-aaaa']);
    expect(next.settings?.deleted).toBeUndefined();
    expect(writes.filter(w => w.store === 'routes').map(w => w.op)).toEqual(['put']);
  });

  it('writes exactly the rows it changed, the journal included, in one change', () => {
    const { writes } = prepare(emptySnapshot(), {
      records: { routes: { put: [route('walk-aaaa')] } },
      journal: { remove: ['walk-aaaa'] },
    });
    expect(writes.filter(w => w.store === 'routes').map(w => w.op)).toEqual(['put']);
    expect(writes).toContainEqual({ op: 'delete', store: 'walkJournal', key: 'walk-aaaa' });
  });

  it('keeps the records the same object when a change does not touch them', () => {
    const base = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    expect(prepare(base, { content: { put: { a: 1 } } }).next.records).toBe(base.records);
  });

  it('clears every store, the journal too, on a reset', () => {
    const { writes } = prepare(emptySnapshot(), { reset: true });
    for (const store of ['observations', 'sessions', 'settings', 'content-state', ...RECORD_STORES, 'walkJournal']) {
      expect(writes).toContainEqual({ op: 'clear', store });
    }
  });

  it('starts empty', () => {
    expect(emptySnapshot().records).toEqual(emptyRecords());
  });
});
