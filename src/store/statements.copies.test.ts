/**
 * Two copies of the app on one device (two tabs), each saying the day's water
 * total at the same instant, as J17's two tabs do under the suite's frozen
 * clock: the day's total is the one stored last, whichever copy had said more
 * before (board D110). A statement's place (`order`) is this device's own
 * count of what it has said, so one stored here is placed after everything
 * this database already holds.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newObservation, type Observation } from '@/health/observation';
import { fakeIndexedDB } from './fakeIdb';
import { emptySnapshot, prepare } from './snapshot';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const DAY = '2026-10-08';
const copies: { resetForTests(): void }[] = [];

/** A copy of the app: its own store and its own count of statements, over the device's one database. */
async function copy(factory: IDBFactory) {
  vi.resetModules();
  const store = await import('./useStore');
  const { entryFor, summariseDay } = await import('@/health/aggregate');
  copies.push(store);
  await store.start({ factory, broadcast: null });
  const water = () => entryFor(summariseDay(DAY, store.getState().observations), 'water')?.total;
  return { store, water };
}

afterEach(() => {
  for (const c of copies.splice(0)) c.resetForTests();
  vi.useRealTimers();
});

describe('two tabs, one instant: the total stored last is the day’s (J17, board D110)', () => {
  it('whichever tab had said more before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${DAY}T09:00:00.000+05:30`));
    const fake = fakeIndexedDB();
    const one = await copy(fake);
    // This tab has said a good deal already, at this same frozen instant.
    for (let i = 0; i < 5; i++) {
      expect((await one.store.addObservation({ kind: 'glucose', value: 100 + i, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' })).ok).toBe(true);
    }
    const two = await copy(fake);
    expect((await one.store.addToDayTotal('water', 250)).ok).toBe(true);
    // The other tab hasn't heard: its write is made against what is stored, 250 already.
    expect((await two.store.addToDayTotal('water', 250)).ok).toBe(true);
    expect(two.water()).toBe(500);
    // Read back from the database by a third copy.
    const three = await copy(fake);
    expect(three.water()).toBe(500);
  });
});

describe('a statement’s place, as a change stores it (board D110)', () => {
  const water = (id: string, value: number, order: number): Observation => ({ ...newObservation({ id, kind: 'water', value, scope: 'dayTotal', source: 'manual', at: `${DAY}T09:00:00.000+05:30` }), order });
  const base = prepare(emptySnapshot(), { observations: { put: [water('a', 250, 900)] } }).next;
  const placeOf = (id: string, change: Parameters<typeof prepare>[1]) => prepare(base, change).next.observations.find(o => o.id === id)!;

  it('one said here goes after every stored statement, however low its own count', () => {
    expect(placeOf('b', { observations: { put: [water('b', 500, 5)] } }).order).toBe(901);
    expect(placeOf('b', { observations: { put: [water('b', 500, 5_000)] } }).order).toBe(5_000);
    // Two in one change keep their order, both after it.
    const two = prepare(base, { observations: { put: [water('b', 500, 5), water('c', 750, 6)] } }).next.observations;
    expect([two.find(o => o.id === 'b')!.order, two.find(o => o.id === 'c')!.order]).toEqual([901, 902]);
  });

  it('a restore’s rows and an import’s keep the places they were said in', () => {
    expect(placeOf('b', { observations: { put: [{ ...water('b', 500, 5), seq: 1 }], kept: ['b'] } })).toMatchObject({ order: 5, seq: 1 });
    expect(placeOf('b', { observations: { put: [{ ...water('b', 500, 5), seq: 1 }], keepSeq: true } })).toMatchObject({ order: 5, seq: 1 });
    expect(placeOf('b', { observations: { put: [water('b', 500, 5)], keepOrder: true } }).order).toBe(5);
  });
});
