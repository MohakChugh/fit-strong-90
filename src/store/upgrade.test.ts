/**
 * B-21's other copies and an interrupted upgrade, through the real store
 * (board D107). Each copy is its own module instance, built as the app is or
 * as the suite's successor (D121), over one fake IndexedDB: an older copy
 * meeting a database a newer one upgraded (P8R-09); one open while it is
 * upgraded; a newer copy waiting for an old connection; a newer schema; and a
 * migration interrupted, with a walk still to recover, finished at the next
 * start (P8R-08). One that loses its storage while it runs goes read-only,
 * and starts nothing new (P8S-04). The readers open the database at whatever
 * version it has (P8R-17). A real browser's upgrade given up half-way, and
 * the whole app kept on screen through one, are V-J38's (Task 15).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn } from '@/engine/readiness';
import { toDateString } from '@/lib/utils';
import type { DailyCheckIn } from '@/types/checkin';
import { startWalk } from '@/walk/clock';
import { peekWalk, storeWalk } from '@/walk/persist';
import { DB_NAME } from './db';
import { fakeIndexedDB } from './fakeIdb';

function memory(): Storage {
  const rows = new Map<string, string>();
  return {
    getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => void rows.set(k, v),
    removeItem: (k: string) => void rows.delete(k), clear: () => rows.clear(), key: (i: number) => [...rows.keys()][i] ?? null,
    get length() { return rows.size; },
  } as Storage;
}
globalThis.localStorage = memory();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const glucose = (value: number) => ({ kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30' }) as const;
const STALE = 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again.';
const copies: { resetForTests(): void }[] = [];

/** A copy of the app: its own store module, as the app builds it, or as the suite's successor (D121). */
async function copy(factory: IDBFactory, build: 'this' | 'successor' = 'this') {
  vi.resetModules();
  if (build === 'successor') vi.stubEnv('VITE_ACCEPTANCE_SUCCESSOR', '1');
  else vi.unstubAllEnvs();
  const store = await import('./useStore');
  const { DB_VERSION } = await import('./db');
  const { SCHEMA_VERSION } = await import('./migrate');
  const gate = await import('@/session/gate');
  const workout = await import('@/screens/workout/gate');
  copies.push(store);
  return { store, gate, workout, DB_VERSION, SCHEMA_VERSION, started: store.start({ factory, broadcast: null }) };
}

/** The database as it stands, at whatever version it has: a reader never asks for an older one (P8R-17). */
function rawOpen(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function rawAll(factory: IDBFactory, store: string): Promise<Record<string, unknown>[]> {
  const db = await rawOpen(factory);
  const rows = await new Promise<Record<string, unknown>[]>(resolve => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
  });
  db.close();
  return rows;
}

async function rawPut(factory: IDBFactory, store: string, row: Record<string, unknown>) {
  const db = await rawOpen(factory);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const marker = async (factory: IDBFactory) => (await rawAll(factory, 'settings')).find(r => r.key === 'schemaVersion')?.value;
const values = async (factory: IDBFactory) => (await rawAll(factory, 'observations')).map(o => o.value);

beforeEach(() => { globalThis.localStorage.clear(); });
afterEach(() => {
  for (const c of copies.splice(0)) c.resetForTests();
  vi.unstubAllEnvs();
});

describe('an older copy meets a database a newer one upgraded (B-21, D107, P8R-09)', () => {
  it('says so, saves nothing, and keeps what it is told for this window only; trying again changes nothing, with no loop', async () => {
    const fake = fakeIndexedDB();
    const newer = await copy(fake, 'successor');
    await newer.started;
    expect(newer.DB_VERSION).toBe(3);
    // Its schema is one higher too, stamped by its empty migration (D121).
    expect(newer.SCHEMA_VERSION).toBe(7);
    expect(await marker(fake)).toBe(7);
    newer.store.resetForTests();

    const older = await copy(fake);
    await older.started;
    // A first open that can't reach the records: the storage screen's, never a read-only app.
    expect(older.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' }, readOnly: false });
    expect(older.store.storageNotice()).toMatchObject({ tone: 'warning', title: 'A newer version of FitStrong is open', detail: expect.stringContaining(STALE) });
    const low = await older.store.addObservation(glucose(52));
    expect(low.ok).toBe(false);
    expect(older.store.getState().observations.map(o => o.value)).toEqual([52]);
    expect(await values(fake)).toEqual([]);

    // Try again is a fresh start of the same build: the same words, and still nothing written.
    older.store.resetForTests();
    const again = await copy(fake);
    await again.started;
    expect(again.store.getState().failure?.code).toBe('stale');
    expect(await values(fake)).toEqual([]);
  });

  it('one open while a newer copy upgrades lets go at once, keeps what it saved, goes read-only, and starts nothing new (P8S-04)', async () => {
    const fake = fakeIndexedDB();
    const older = await copy(fake);
    await older.started;
    expect((await older.store.addObservation(glucose(112))).ok).toBe(true);
    const newer = await copy(fake, 'successor');
    await newer.started;
    expect(newer.store.getState().status).toBe('ready');
    expect(older.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' }, readOnly: true });
    expect(older.store.getState().observations.map(o => o.value)).toEqual([112]);
    // A reading entered now is kept for this window's gates, and nowhere else.
    expect((await older.store.addObservation(glucose(52))).ok).toBe(false);
    expect(older.store.getState().observations.map(o => o.value)).toEqual([112, 52]);
    expect(await values(fake)).toEqual([112]);
    // Nothing new starts here, whatever the engine would say.
    const input = { profile: createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } }), now: new Date() };
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      expect(older.gate.arrivalGate(input, mode, false)).toMatchObject({ allowed: false, reasons: [older.gate.READ_ONLY_REASON] });
      expect(older.gate.startGate(input, mode)).toMatchObject({ allowed: false, reasons: [older.gate.READ_ONLY_REASON] });
    }
    // Nor a workout, begun here or begun again (the Workout screen's own gate).
    for (const stage of ['start', 'restart'] as const) {
      expect(older.workout.logGate(input, stage)).toMatchObject({ kind: 'stop', permission: { allowed: false, reasons: [older.gate.READ_ONLY_REASON] } });
    }
    // An emergency stays first, as it does through every other hold (Plan 5's board D197): its words, never these.
    const emergency: DailyCheckIn = { date: toDateString(input.now), urgentSymptoms: true, emergency: ['chest'], news: [] };
    const urgent = { ...input, checkIn: { ...emergency, readiness: evaluateCheckIn(input.profile, emergency, []) } };
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      expect(older.gate.arrivalGate(urgent, mode, false)).toMatchObject({ allowed: false, disposition: 'emergency' });
      expect(older.gate.startGate(urgent, mode)).toMatchObject({ allowed: false, disposition: 'emergency' });
    }
    expect((await newer.store.addObservation(glucose(130))).ok).toBe(true);
    // A fresh store in this window, as a test's reset makes one, is read-only no longer.
    older.store.resetForTests();
    expect(older.gate.startGate(input, 'walk').reasons).not.toContain(older.gate.READ_ONLY_REASON);
  });
});

describe('a newer copy waits for an old connection (B-21, D107)', () => {
  it('says to close the other tabs, saves nothing meanwhile, and carries on by itself once it closes', async () => {
    const fake = fakeIndexedDB();
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    // An old tab that hasn't let go: frozen in the background, it never ran its `versionchange`.
    const held = await rawOpen(fake);
    held.onversionchange = () => undefined;
    const newer = await copy(fake, 'successor');
    await delay(5);
    expect(newer.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'blocked' } });
    expect(newer.store.storageNotice()?.title).toBe('Close FitStrong’s other tabs');
    held.close();
    await newer.started;
    expect(newer.store.getState().status).toBe('ready');
    expect((await newer.store.addObservation(glucose(112))).ok).toBe(true);
  });
});

describe('a newer schema, and an interrupted migration (B-21, D107, P8R-08)', () => {
  it('a copy that finds a schema newer than its own saves nothing, and says so', async () => {
    const fake = fakeIndexedDB();
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    await rawPut(fake, 'settings', { key: 'schemaVersion', value: first.SCHEMA_VERSION + 1 });
    const next = await copy(fake);
    await next.started;
    expect(next.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' } });
    expect((await next.store.addObservation(glucose(112))).ok).toBe(false);
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION + 1);
  });

  it('keeps working where it was, a walk still recoverable, and the next start finishes it', async () => {
    let failing = false;
    const fake = fakeIndexedDB({
      failWrite: (store, row) => (failing && store === 'settings' && row.key === 'schemaVersion' ? new DOMException('The write was stopped.', 'AbortError') : undefined),
    });
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    await rawPut(fake, 'settings', { key: 'schemaVersion', value: first.SCHEMA_VERSION - 1 });
    // Unfinished work to recover: a walk's draft in this window, and its checkpoint on the device (Plan 6's journal).
    const W = 'mgh3k2x1-1a2b3c4d';
    const drafts = memory();
    storeWalk(drafts, startWalk(W, { kind: 'walk', gps: false, steps: false, keepRoute: false }, Date.now()));
    await rawPut(fake, 'walkJournal', { id: W, walkId: W });
    failing = true;
    const interrupted = await copy(fake);
    await interrupted.started;
    expect(interrupted.store.getState().status).toBe('ready');
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION - 1);
    interrupted.store.resetForTests();
    failing = false;
    const again = await copy(fake);
    await again.started;
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION);
    expect((await rawAll(fake, 'walkJournal')).map(r => r.id)).toEqual([W]);
    expect(peekWalk(drafts)?.id).toBe(W);
  });
});
