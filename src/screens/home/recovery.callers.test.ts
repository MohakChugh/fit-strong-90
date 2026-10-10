/**
 * Home's recovery row through its real callers (journey §9.4, V-J34, Review
 * Focus 2): the row, the real store over a fake IndexedDB, and its journal.
 * Nothing is replaced but the browser globals node lacks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { WalkRecoveryRow } = await import('./WalkRecoveryRow');
const { accrueOpen, startWalk } = await import('@/walk/clock');
const { journalEntry } = await import('@/walk/journal');
const { clearWalk, sessionWalkStorage, storeWalk } = await import('@/walk/persist');
const { interruptedWalk } = await import('@/walk/recovery');
const { walkSave } = await import('@/walk/save');

const ID = 'mgh3k2x1-1a2b3c4d';
const MIN = 60_000;
const START = new Date(2026, 9, 8, 8, 0).getTime();
const LINE = { start: START, end: START + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
const tap = (h: Host, name: string) => (h.button(name, { exact: true }).props.onClick as (e: unknown) => void)({ preventDefault() {}, stopPropagation() {} });
const ofWalk = () => store.getState().observations.filter(o => o.context === `walk:${ID}`);
let host: Host | undefined;
/** Write transactions the database has been asked for. */
let writes = 0;

/** Eighteen minutes recorded with its route kept, then the app went away. */
async function lost() {
  const walk = accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 18 * MIN, START + 18 * MIN);
  await store.putWalkJournal(journalEntry(walk, START + 18 * MIN, [LINE]));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START + 30 * MIN);
  local.clear();
  store.resetForTests();
  writes = 0;
  await store.start({ factory: fakeIndexedDB({ onTransaction: (_scope, mode) => { if (mode === 'readwrite') writes += 1; } }), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  clearWalk(sessionWalkStorage());
  vi.useRealTimers();
});

describe('Home’s recovery row (journey §9.4, V-J34)', () => {
  it('saves the walk with its route once, however often Save is tapped, and retires the journal (Review Focus 2)', async () => {
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    expect(h.text()).toContain('Your walk today was interrupted at 18 min. Save it?');
    const before = writes;
    tap(h, 'Save');
    tap(h, 'Save');
    await h.settle();
    // One write for both taps: the walk, its route and the journal's retirement together.
    expect(writes - before).toBe(1);
    expect(ofWalk().length).toBeGreaterThan(0);
    expect(new Set(ofWalk().map(o => o.id)).size).toBe(ofWalk().length);
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual([ID]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
    expect(h.text()).toContain('Walk saved.');
    expect(h.text()).not.toContain('was interrupted');
  });

  it('keeps the journal, and the offer, when the save fails (V-J34, A-55)', async () => {
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ quotaAfter: 0, quotaStore: 'observations' }), broadcast: null });
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    tap(h, 'Save');
    await h.settle();
    expect(h.text()).toContain('The walk did not save.');
    expect(ofWalk()).toEqual([]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value.map(e => e.id)).toEqual([ID]);
    expect(h.text()).toContain('was interrupted at 18 min');
  });

  it('never tidies a journal away while a save of its walk is still on its way, which may fail (A-55)', async () => {
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ quotaAfter: 0, quotaStore: 'observations' }), broadcast: null });
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    const read = await store.readWalkJournals();
    const entry = read.ok ? read.value[0] : undefined;
    // A save from elsewhere: its records show at once, before the device has them.
    const pending = store.saveWalk(walkSave(interruptedWalk(entry!.walk), { route: [LINE] }));
    await h.settle();
    expect((await pending).ok).toBe(false);
    await h.settle();
    const left = await store.readWalkJournals();
    expect(left.ok && left.value.map(e => e.id)).toEqual([ID]);
  });

  it('discards on request, keeping nothing of the walk', async () => {
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    tap(h, 'Discard');
    await h.settle();
    tap(h, 'Discard walk');
    await h.settle();
    expect(ofWalk()).toEqual([]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
    expect(h.text()).not.toContain('was interrupted');
  });

  it('offers nothing this tab’s draft still holds: the Walk hub offers it already (Review Focus 2)', async () => {
    await lost();
    const draft = accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 18 * MIN, START + 18 * MIN);
    storeWalk(sessionWalkStorage(), draft);
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    expect(h.text()).not.toContain('was interrupted');
  });

  it('offers nothing while the walk may still be recording in another tab (Review Focus 2)', async () => {
    await lost();
    vi.setSystemTime(START + 18 * MIN + 30_000);
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    expect(h.text()).not.toContain('was interrupted');
  });
});
