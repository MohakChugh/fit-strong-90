import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from './fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('./useStore');
let factory = fakeIndexedDB();

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  factory = fakeIndexedDB();
  await store.start({ factory });
  await store.setSettings({ onboardingComplete: true });
  await store.setProfile(createDefaultProfile({ weightKg: 80 }));
});

describe('clearing everything (J18)', () => {
  it('shows nothing as cleared until the clear is stored', async () => {
    factory.control.hold();
    const clearing = store.clearAll();
    await Promise.resolve();
    // Still the person's record on screen: the onboarding gate must not see an empty one.
    expect(store.getState().settings.onboardingComplete).toBe(true);
    expect(store.getState().profile).toBeDefined();
    factory.control.release();
    expect((await clearing).ok).toBe(true);
    expect(store.getState().profile).toBeUndefined();
    expect(store.getState().settings.onboardingComplete).toBe(false);
  });

  it('never publishes a cleared state when the clear fails', async () => {
    const seen: boolean[] = [];
    const stop = store.subscribe(() => seen.push(store.getState().settings.onboardingComplete));
    factory.control.setWriteError(() => new DOMException('The transaction was aborted.', 'AbortError'));
    const cleared = await store.clearAll();
    stop();
    expect(cleared.ok).toBe(false);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
    expect(store.getState().profile).toBeDefined();
  });
});

describe('a held update (D-04, D-09)', () => {
  it('is not shown until it is stored', async () => {
    await store.setSettings({ onboardingComplete: false });
    factory.control.hold();
    const finishing = store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true } }), { hold: true });
    await Promise.resolve();
    expect(store.getState().settings.onboardingComplete).toBe(false);
    factory.control.release();
    expect((await finishing).ok).toBe(true);
    expect(store.getState().settings.onboardingComplete).toBe(true);
  });

  it('is never shown when it is refused, and what was there stays', async () => {
    await store.setSettings({ onboardingComplete: false });
    const seen: boolean[] = [];
    const stop = store.subscribe(() => seen.push(store.getState().settings.onboardingComplete));
    factory.control.setWriteError(() => new DOMException('The transaction was aborted.', 'AbortError'));
    const finished = await store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true } }), { hold: true });
    stop();
    expect(finished.ok).toBe(false);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some(Boolean)).toBe(false);
    expect(store.getState().profile).toBeDefined();
  });

  it('an ordinary update is shown at once, as before', async () => {
    await store.setSettings({ onboardingComplete: false });
    factory.control.hold();
    const finishing = store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true } }));
    await Promise.resolve();
    expect(store.getState().settings.onboardingComplete).toBe(true);
    factory.control.release();
    expect((await finishing).ok).toBe(true);
  });
});

describe('an import is held until stored (D-09)', () => {
  const backup = () => ({
    format: 'fit-strong-backup', version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
    settings: { onboardingComplete: true, focus: 'move' },
    profile: createDefaultProfile({ weightKg: 70 }),
    observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
  });

  beforeEach(async () => {
    await store.setSettings({ onboardingComplete: false });
  });

  it('shows nothing of the file until it is stored', async () => {
    const { TRANSFER_FORMAT } = await import('./transfer');
    factory.control.hold();
    const restoring = store.importRecord({ ...backup(), format: TRANSFER_FORMAT }, 'replace');
    await Promise.resolve();
    expect(store.getState().settings.onboardingComplete).toBe(false);
    factory.control.release();
    expect((await restoring).ok).toBe(true);
    expect(store.getState().settings.onboardingComplete).toBe(true);
    expect(store.getState().profile?.weightKg).toBe(70);
  });

  it('never shows a refused file', async () => {
    const { TRANSFER_FORMAT } = await import('./transfer');
    const seen: boolean[] = [];
    const stop = store.subscribe(() => seen.push(store.getState().settings.onboardingComplete));
    factory.control.setWriteError(() => new DOMException('The transaction was aborted.', 'AbortError'));
    const restored = await store.importRecord({ ...backup(), format: TRANSFER_FORMAT }, 'replace');
    stop();
    expect(restored.ok).toBe(false);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some(Boolean)).toBe(false);
    expect(store.getState().profile?.weightKg).toBe(80);
  });
});

describe('a repeat of a write still waiting to be stored (M-06)', () => {
  const session = {
    id: 'session-done', date: '2026-10-08', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1,
    status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
  } as const;
  const save = () => store.update(previous => ({ ...previous, sessions: [...previous.sessions.filter(s => s.id !== session.id), { ...session, sets: [] }] }));

  it('is not called saved until the first is, and is written itself when the first is refused', async () => {
    factory.control.hold();
    const first = save();
    const second = save();
    let settled = false;
    void second.then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    // Identical to what is on screen, but nothing of it is stored yet.
    expect(settled).toBe(false);

    // The first write is refused; the second is then a real write of its own.
    factory.control.setWriteError(() => {
      factory.control.setWriteError(undefined);
      return new DOMException('The transaction was aborted.', 'AbortError');
    });
    factory.control.release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(true);
    expect(store.isSessionSaved(session.id)).toBe(true);
  });

  it('is saved, and nothing is written twice, when the first lands', async () => {
    factory.control.hold();
    const first = save();
    const second = save();
    factory.control.release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok && b.ok).toBe(true);
    expect(store.isSessionSaved(session.id)).toBe(true);
    expect(store.getState().sessions.filter(s => s.id === session.id)).toHaveLength(1);
  });

  it('with nothing waiting, a write that changes nothing is done at once', async () => {
    await save();
    let settled = false;
    void save().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(true);
  });
});

describe('a write that changes nothing, with nothing stored (M-06)', () => {
  it('is not called saved while the app is not storing data', async () => {
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    expect(store.getState().status).toBe('unavailable');
    await store.setSettings({ onboardingComplete: true });
    // On screen already, but only in this session: nothing to write is not "saved".
    const again = await store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true } }));
    expect(again.ok).toBe(false);
  });

  it('waits behind a write held until it is stored', async () => {
    factory.control.hold();
    const clearing = store.clearAll();
    let settled = false;
    void store.update(previous => ({ ...previous, settings: { ...previous.settings, onboardingComplete: true } })).then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    factory.control.release();
    await clearing;
  });
});

describe('a clear waiting its turn when storage goes away (R5-03)', () => {
  it('is refused without emptying the screen, though it was planned while storage was there', async () => {
    const { DB_NAME, DB_VERSION } = await import('./db');
    factory.control.hold();
    const first = store.setSettings({ theme: 'dark' });
    const clearing = store.clearAll();
    // Another tab upgrades the app: this copy lets go of its storage.
    const upgraded = new Promise<void>(resolve => {
      const req = factory.open(DB_NAME, DB_VERSION + 1);
      req.onsuccess = () => { (req.result as IDBDatabase).close(); resolve(); };
    });
    factory.control.release();
    await first;
    const cleared = await clearing;
    await upgraded;
    expect(cleared.ok).toBe(false);
    expect(store.getState().status).toBe('unavailable');
    // Nothing was deleted, and nothing on screen says otherwise.
    expect(store.getState().profile).toBeDefined();
    expect(store.getState().settings.onboardingComplete).toBe(true);
  });
});

describe('an import while nothing can be saved (R5-03)', () => {
  it('is refused, and shows nothing of the file', async () => {
    const { TRANSFER_FORMAT } = await import('./transfer');
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    await store.setSettings({ onboardingComplete: false });
    const restored = await store.importRecord({
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
      settings: { onboardingComplete: true }, profile: createDefaultProfile({ weightKg: 70 }),
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    }, 'replace');
    expect(restored.ok).toBe(false);
    if (!restored.ok) expect(restored.failure.message).toMatch(/not restored/);
    expect(store.getState().settings.onboardingComplete).toBe(false);
    expect(store.getState().profile).toBeUndefined();
  });
});
