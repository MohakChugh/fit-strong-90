/**
 * F-data-01: "Delete everything" in another tab erases the walk this tab is
 * recording too. Driven through the real callers: this tab's one live walk
 * (`liveWalk`, with the browser's own ports), its journal port and the real
 * store over a fake IndexedDB; the other tab's erase is written straight to
 * the database, as that tab's store writes it, and announced over the
 * store's channel. Nothing of the erased walk may come back: not from the
 * walk screen leaving, a checkpoint on its way, a save, or a reload.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastLike } from '@/store/useStore';
import type { CheckInRecord } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';

const local = new Map<string, string>();
const session = new Map<string, string>();
const storage = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
  get length() { return m.size; },
}) as Storage;
Object.assign(globalThis, {
  localStorage: storage(local),
  sessionStorage: storage(session),
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
});

const store = await import('@/store/useStore');
const { liveWalk } = await import('./browser');
const { cachedJournal, journalPort } = await import('./journalPort');
const { createLiveWalk } = await import('./live');
const { startWalk } = await import('./clock');
const { storeWalk } = await import('./persist');
const { journalEntry } = await import('./journal');
const { walkSave } = await import('./save');
const { WALK_KEY } = await import('./persist');
const { openDb } = await import('@/store/db');
const { commitChange } = await import('@/store/snapshot');
const { SCHEMA_VERSION } = await import('@/store/migrate');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');

const DAY = '2026-10-09';
const profile = createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } });
let fake = fakeIndexedDB();
/** This tab's end of the store's channel: what the other tab's write announces. */
let channel: BroadcastLike | undefined;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 9, 9, 0));
  local.clear();
  session.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: () => (channel = { postMessage() {}, onmessage: null, close() {} }) });
  const morning = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7' as const, energy: 4 as const };
  const checkIns: CheckInRecord[] = [{ ...morning, readiness: evaluateCheckIn(profile, morning) }];
  expect((await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, onboardingComplete: true }, checkIns }))).ok).toBe(true);
});
afterEach(() => {
  vi.useRealTimers();
});

/** "Delete everything" in the other tab: every store cleared and the record's generation moved on, in one transaction, then announced. */
async function eraseElsewhere() {
  const tab = await openDb(fake);
  expect((await commitChange(tab, undefined, () => ({ change: { reset: true, schemaVersion: SCHEMA_VERSION } }))).ok).toBe(true);
  tab.close();
  channel?.onmessage?.({ data: { revision: Number.MAX_SAFE_INTEGER } });
  // This tab reads what is stored, in its turn.
  await store.whenSettled();
}
const journals = async () => {
  const kept = await store.readWalkJournals();
  return kept.ok ? kept.value : [];
};

describe('F-data-01: a walk recorded in this tab, erased by "Delete everything" in another', () => {
  it('leaves nothing behind: no draft, no journal, nothing from the walk screen leaving, and no checkpoint or save on its way', async () => {
    const live = liveWalk();
    expect(live.attach({ id: 'mgh3k2x1-1e1e1e1e', plan: { kind: 'walk', gps: false, steps: false } })).toBe('created');
    vi.setSystemTime(new Date(2026, 9, 9, 9, 2));
    live.pause();
    await store.whenSettled();
    expect(session.get(WALK_KEY)).toBeTruthy();
    expect(await journals()).toHaveLength(1);
    const walk = live.getSnapshot()!.walk;

    await eraseElsewhere();
    expect(store.getState().epoch).toBeGreaterThan(0);
    // The walk screen leaves, as it does once this tab's record is gone.
    live.detach();
    await store.whenSettled();
    expect(session.get(WALK_KEY)).toBeUndefined();
    expect(live.getSnapshot()).toBeNull();
    expect(await journals()).toEqual([]);
    // Nor does this page hold a copy of its checkpoints for a summary or a recovery to read back.
    expect(cachedJournal(walk.id)).toBeUndefined();

    // A checkpoint, and a save, made for the walk before this tab heard: refused inside their own transactions.
    expect((await journalPort().checkpoint(journalEntry(walk, Date.now()))).ok).toBe(false);
    expect(await journals()).toEqual([]);
    expect((await store.saveWalk(walkSave(walk))).ok).toBe(false);
    expect(store.getState().observations).toEqual([]);

    // Opened again in this tab, the walk isn't there to come back to.
    expect(live.attach()).toBe('none');
  });
});

describe('F-data-01: the live controller lets another record’s walk go by itself', () => {
  /** A controller over a tab's draft, whose record generation the test moves. */
  function controller(gen: { now: number }, kept = new Map<string, string>()) {
    const checkpoints: string[] = [];
    const live = createLiveWalk({
      mayRun: () => true,
      now: () => Date.now(),
      later: () => () => {},
      recordGeneration: () => gen.now,
      storage: { getItem: k => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v), removeItem: k => void kept.delete(k) },
      visibility: { visible: () => true, subscribe: () => () => {} },
      journal: { checkpoint: async e => { checkpoints.push(e.id); return { ok: true as const, value: undefined }; }, read: async () => undefined },
    });
    return { live, kept, checkpoints };
  }

  it('writes nothing more of a walk once the record has moved on, before anything has told it to let go', () => {
    const gen = { now: 3 };
    const { live, kept, checkpoints } = controller(gen);
    expect(live.attach({ id: 'mgh3k2x1-2f2f2f2f', plan: { kind: 'walk', gps: false, steps: false } })).toBe('created');
    expect(live.getSnapshot()!.walk.recordGen).toBe(3);
    const draft = kept.get(WALK_KEY);
    const written = checkpoints.length;
    gen.now = 4;
    vi.setSystemTime(new Date(2026, 9, 9, 9, 5));
    live.pause();
    live.detach();
    expect(kept.get(WALK_KEY)).toBe(draft);
    expect(checkpoints).toHaveLength(written);
  });

  it('a draft another record left in this tab is cleared on opening, never restored', () => {
    const kept = new Map<string, string>();
    const at = new Date(2026, 9, 9, 8, 50).getTime();
    storeWalk({ getItem: k => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v), removeItem: k => void kept.delete(k) },
      { ...startWalk('mgh3k2x1-3a3a3a3a', { kind: 'walk', gps: false, steps: false }, at), recordGen: 1 });
    const { live } = controller({ now: 2 }, kept);
    expect(live.attach()).toBe('none');
    expect(kept.get(WALK_KEY)).toBeUndefined();
  });
});
