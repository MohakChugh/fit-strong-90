/**
 * Reproductions for docs/reimagine/codex-review-data.md, one `describe` per
 * finding, each written from the review's own trigger. Every one of these was
 * run against the implementation the review exercised and failed there.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppData, WorkoutSession } from '@/types';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import { dayOf, isAt, newObservation, nowAt, type Observation } from '@/health/observation';
import { entryFor, isOrphanedReading, pairBloodPressure, summariseDay } from '@/health/aggregate';
import { DB_NAME, DB_VERSION, StoreFailure, doc, openDb, readDoc, toFailure } from './db';
import { fakeIndexedDB, type FakeOptions } from './fakeIdb';

/** The test runner's environment, without pulling node's types into the app build. */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

// ---------------------------------------------------------------------------
// A localStorage whose individual calls can be made to fail.
// ---------------------------------------------------------------------------

const local = new Map<string, string>();
const faults: { getItem?: (key: string) => void; length?: () => void } = {};
globalThis.localStorage = {
  getItem: (k: string) => { faults.getItem?.(k); return local.get(k) ?? null; },
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { faults.length?.(); return local.size; },
} as Storage;

const store = await import('./useStore');
const { V4_KEY, SCHEMA_VERSION, migrateToV5 } = await import('./migrate');
const { TRANSFER_FORMAT, applyImport, collect, decode, deliver, encode, previewImport } = await import('./transfer');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

function checkIn(date: string, over: Partial<CheckInRecord> = {}): CheckInRecord {
  return { date, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness, ...over };
}

function session(id: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id, date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1,
    status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0, ...over,
  };
}

const settings: AppData['settings'] = {
  startDate: '2026-09-28', currentWeight: 82, targetGoal: 'Pain-free back', defaultRestSeconds: 90,
  useMetric: true, theme: 'system', onboardingComplete: true,
  gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
};

function v4Blob(over: Partial<AppData> = {}): string {
  return JSON.stringify({
    version: 4,
    settings,
    sessions: [session('legacy', { notes: 'legacy original' })],
    bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }],
    personalRecords: [],
    profile: { weightKg: 82 },
    checkIns: [checkIn('2026-10-01', { glucose: { value: 120, unit: 'mg/dL' } })],
    focusOverrides: {},
    ...over,
  });
}

function file(over: Record<string, unknown> = {}) {
  return {
    format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T09:00:00.000+05:30', schemaVersion: 5,
    observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {},
    ...over,
  };
}

const glucose = (id: string, day: string, value: number): Observation => newObservation({
  id, kind: 'glucose', value, scope: 'pointInTime', source: 'manual', at: `${day}T07:30:00.000+05:30`,
});

const quota = () => new DOMException('The operation failed.', 'QuotaExceededError');
const ids = (rows: { id: string }[]) => rows.map(r => r.id).sort();
const today = () => dayOf(nowAt());
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** A check-in saved as the app saves one: through `update`, replacing that day's summary (C2-10). */
const saveCheckIn = (copy: Pick<typeof store, 'update'>, record: CheckInRecord, options: { readings?: 'append' | 'correct' } = {}) =>
  copy.update(previous => ({ ...previous, checkIns: [...(previous.checkIns ?? []).filter(c => c.date !== record.date), record] }), options);

async function booted(options: FakeOptions = {}) {
  const fake = fakeIndexedDB(options);
  await store.start({ factory: fake, broadcast: null });
  return fake;
}

/** Two copies of the app, each with its own store, sharing one database: two tabs. */
async function twoCopies(fake: IDBFactory, broadcast: ((name: string) => unknown) | null = null) {
  vi.resetModules();
  const a = await import('./useStore');
  vi.resetModules();
  const b = await import('./useStore');
  await a.start({ factory: fake, broadcast: broadcast as never });
  await b.start({ factory: fake, broadcast: broadcast as never });
  return { a, b };
}

/** An in-memory BroadcastChannel: every other member hears each message. */
function bus() {
  const members = new Set<{ onmessage: ((event: { data: unknown }) => void) | null }>();
  return () => {
    const channel = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage(data: unknown) {
        for (const m of members) if (m !== channel) queueMicrotask(() => m.onmessage?.({ data }));
      },
      close() { members.delete(channel); },
    };
    members.add(channel);
    return channel;
  };
}

beforeEach(() => {
  local.clear();
  faults.getItem = undefined;
  faults.length = undefined;
  store.resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('F01 — a failed replace-import must leave the old record intact', () => {
  it('keeps every existing record when a replacement write fails', async () => {
    const fake = fakeIndexedDB({ failWrite: (s, v) => (s === 'observations' && v.id === 'incoming' ? quota() : undefined) });
    const db = await openDb(fake);
    await db.put('sessions', [session('saved-session')]);
    await db.put('observations', [glucose('saved-glucose', '2026-10-01', 120)]);

    const result = await applyImport(db, file({ observations: [glucose('incoming', '2026-10-05', 140)] }), 'replace');

    expect(result.ok).toBe(false);
    expect(ids(await db.getAll('sessions'))).toEqual(['saved-session']);
    expect(ids(await db.getAll('observations'))).toEqual(['saved-glucose']);
    db.close();
  });

  it('shows what the device actually holds after a failed import', async () => {
    await booted({ failWrite: (s, v) => (s === 'observations' && v.id === 'incoming' ? quota() : undefined) });
    await store.putSession(session('saved-session'));

    const result = await store.importRecord(file({ observations: [glucose('incoming', '2026-10-05', 140)] }), 'replace');
    expect(result.ok).toBe(false);

    const shown = ids(store.getState().sessions);
    await store.reload();
    expect(ids(store.getState().sessions)).toEqual(shown);
    expect(shown).toEqual(['saved-session']);
  });
});

describe('F02 — queued updates must not overwrite one another', () => {
  it('keeps all three settings changes when updates overlap', async () => {
    await booted();
    const first = store.update(prev => ({ ...prev, settings: { ...prev.settings, startDate: '2026-09-28' } }));
    const second = store.update(prev => ({ ...prev, settings: { ...prev.settings, defaultRestSeconds: 111 } }));
    expect((await first).ok).toBe(true);
    const third = store.update(prev => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }));
    expect([(await second).ok, (await third).ok]).toEqual([true, true]);

    const want = { startDate: '2026-09-28', defaultRestSeconds: 111, theme: 'dark' };
    expect(store.getState().settings).toMatchObject(want);
    await store.reload();
    expect(store.getState().settings).toMatchObject(want);
  });

  it('keeps a direct setting when an adapter update follows it in the same tick', async () => {
    await booted();
    const direct = store.setSettings({ theme: 'dark' });
    const adapted = store.update(prev => ({ ...prev, settings: { ...prev.settings, useMetric: false } }));
    expect([(await direct).ok, (await adapted).ok]).toEqual([true, true]);

    expect(store.getState().settings).toMatchObject({ theme: 'dark', useMetric: false });
    await store.reload();
    expect(store.getState().settings).toMatchObject({ theme: 'dark', useMetric: false });
  });
});

describe('F03 — a failed predecessor must not reappear when its successor succeeds', () => {
  it('shows only the session that was actually saved', async () => {
    await booted({ failWrite: (s, v) => (s === 'sessions' && v.id === 'A' ? quota() : undefined) });
    const first = store.update(prev => ({ ...prev, sessions: [...prev.sessions, session('A')] }));
    const second = store.update(prev => ({ ...prev, sessions: [...prev.sessions, session('B', { date: '2026-10-02' })] }));

    expect([(await first).ok, (await second).ok]).toEqual([false, true]);
    expect(ids(store.getState().sessions)).toEqual(['B']);
    await store.reload();
    expect(ids(store.getState().sessions)).toEqual(['B']);
  });
});

describe('F04 — two open copies must not erase each other', () => {
  it("keeps both copies' check-ins when one saves after the other", async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    expect((await saveCheckIn(a, checkIn('2026-10-08', { glucose: { value: 110, unit: 'mg/dL' } }))).ok).toBe(true);
    expect((await saveCheckIn(b, checkIn('2026-10-09'))).ok).toBe(true);

    const db = await openDb(fake);
    expect((await readDoc<CheckInRecord[]>(db, 'checkIns'))?.map(c => c.date)).toEqual(['2026-10-08', '2026-10-09']);
    db.close();
    a.resetForTests();
    b.resetForTests();
  });

  it('keeps both when the two save at the same moment', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    const results = await Promise.all([saveCheckIn(a, checkIn('2026-10-08')), saveCheckIn(b, checkIn('2026-10-09'))]);
    expect(results.map(r => r.ok)).toEqual([true, true]);

    const db = await openDb(fake);
    expect((await readDoc<CheckInRecord[]>(db, 'checkIns'))?.map(c => c.date).sort()).toEqual(['2026-10-08', '2026-10-09']);
    db.close();
    a.resetForTests();
    b.resetForTests();
  });

  it('keeps both through the screens that save with update', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    await a.update(prev => ({ ...prev, sessions: [...prev.sessions, session('from-a')] }));
    await b.update(prev => ({ ...prev, sessions: [...prev.sessions, session('from-b', { date: '2026-10-02' })] }));
    await a.update(prev => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }));
    await b.update(prev => ({ ...prev, settings: { ...prev.settings, useMetric: false } }));

    const db = await openDb(fake);
    expect(ids(await db.getAll('sessions'))).toEqual(['from-a', 'from-b']);
    expect(await readDoc(db, 'settings')).toMatchObject({ theme: 'dark', useMetric: false });
    db.close();
    a.resetForTests();
    b.resetForTests();
  });
});

describe('F05 — an incomplete migration must not leave room for a save it later overwrites', () => {
  it('writes all of its data and its marker, or nothing at all', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 6, quotaStore: 'settings' }));
    const result = await migrateToV5(db, v4Blob());
    expect(result.ok).toBe(false);
    expect(await db.getAll('sessions')).toEqual([]);
    expect(await db.getAll('observations')).toEqual([]);
    expect(await db.getAll('settings')).toEqual([]);
    db.close();
  });

  it('never acknowledges a save that the next start would overwrite', async () => {
    local.set(V4_KEY, v4Blob());
    const fake = await booted({ quotaAfter: 6, quotaStore: 'settings' });
    const saved = await store.putSession(session('legacy', { notes: 'new acknowledged correction' }));

    // Space is freed and the app is opened again.
    fake.control.setQuota(undefined);
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });

    const notes = store.getState().sessions.find(s => s.id === 'legacy')?.notes;
    if (saved.ok) expect(notes).toBe('new acknowledged correction');
    expect(saved.ok || notes === 'legacy original').toBe(true);
  });
});

describe('F06 — a failed read of the old record must not be taken for an empty one', () => {
  it('leaves the migration retryable when localStorage could not be read', async () => {
    local.set(V4_KEY, v4Blob());
    faults.getItem = key => { if (key === V4_KEY) throw new DOMException('denied', 'SecurityError'); };
    const db = await openDb(fakeIndexedDB());

    const first = await migrateToV5(db);
    expect(first.ok).toBe(false);
    expect(await readDoc(db, 'schemaVersion')).toBeUndefined();

    faults.getItem = undefined;
    const second = await migrateToV5(db);
    expect(second.ok && second.value.sessions).toBe(1);
    expect(ids(await db.getAll('sessions'))).toEqual(['legacy']);
    db.close();
  });
});

describe('F07 — an imported schema marker must not trigger the migration again', () => {
  it('keeps the imported record across the next start', async () => {
    local.set(V4_KEY, v4Blob({ settings: { ...settings, startDate: '2026-01-01' } }));
    const fake = await booted();
    const imported = await store.importRecord(file({
      schemaVersion: 4,
      settings: { ...settings, startDate: '2026-09-01' },
      sessions: [session('legacy', { notes: 'corrected in the backup' })],
    }), 'replace');
    expect(imported.ok).toBe(true);

    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().settings.startDate).toBe('2026-09-01');
    expect(store.getState().sessions.find(s => s.id === 'legacy')?.notes).toBe('corrected in the backup');

    const db = await openDb(fake);
    expect(await readDoc(db, 'schemaVersion')).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('refuses a file from a newer schema before anything is written', async () => {
    expect(previewImport(file({ schemaVersion: SCHEMA_VERSION + 1 })).ok).toBe(false);
    const db = await openDb(fakeIndexedDB());
    await db.put('sessions', [session('kept')]);
    expect((await applyImport(db, file({ schemaVersion: SCHEMA_VERSION + 1 }), 'replace')).ok).toBe(false);
    expect(ids(await db.getAll('sessions'))).toEqual(['kept']);
    db.close();
  });
});

describe('F08 — a merge must not silently undo a newer correction', () => {
  it('keeps the corrected reading over an older copy of it', async () => {
    const db = await openDb(fakeIndexedDB());
    const corrected: Observation = { ...glucose('g', '2026-10-08', 155), editedAt: '2026-10-09T07:00:00.000+05:30' };
    await db.put('observations', [corrected]);

    const result = await applyImport(db, file({ observations: [glucose('g', '2026-10-08', 110)] }), 'merge');
    expect(result.ok).toBe(true);
    expect(await db.get('observations', 'g')).toMatchObject({ value: 155, editedAt: corrected.editedAt });
    db.close();
  });

  it("keeps this device's version of a conflicting record unless told otherwise, and says so first", async () => {
    const db = await openDb(fakeIndexedDB());
    await db.put('sessions', [session('s', { notes: 'on this device' })]);
    const backup = file({ sessions: [session('s', { notes: 'from the backup' })] });

    const preview = previewImport(backup, { sessions: [session('s', { notes: 'on this device' })] } as never);
    expect(preview.ok && preview.conflicts?.sessions).toBe(1);

    expect((await applyImport(db, backup, 'merge')).ok).toBe(true);
    expect(await db.get('sessions', 's')).toMatchObject({ notes: 'on this device' });

    expect((await applyImport(db, backup, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    expect(await db.get('sessions', 's')).toMatchObject({ notes: 'from the backup' });
    db.close();
  });
});

describe('F09 — a session counts as saved only once it is durably stored', () => {
  it('says so only after the write commits', async () => {
    await booted();
    const pending = store.update(prev => ({ ...prev, sessions: [session('guided-1')] }));
    // Shown at once, so the next screen sees it...
    expect(store.getState().sessions.map(s => s.id)).toContain('guided-1');
    // ...but not yet something its recovery copy may be deleted for.
    expect(store.isSessionSaved('guided-1')).toBe(false);
    expect((await pending).ok).toBe(true);
    expect(store.isSessionSaved('guided-1')).toBe(true);
  });

  it('never when the write failed', async () => {
    await booted({ quotaAfter: 0, quotaStore: 'sessions' });
    expect((await store.update(prev => ({ ...prev, sessions: [session('guided-1')] }))).ok).toBe(false);
    expect(store.isSessionSaved('guided-1')).toBe(false);
  });

  it('never while nothing can be saved at all', async () => {
    await store.start({ factory: undefined, broadcast: null });
    await store.update(prev => ({ ...prev, sessions: [session('guided-1')] }));
    expect(store.getState().sessions.map(s => s.id)).toContain('guided-1');
    expect(store.isSessionSaved('guided-1')).toBe(false);
  });
});

describe('F10 — a same-day recheck must keep the earlier reading', () => {
  it('keeps both glucose readings, each with its own record', async () => {
    await booted();
    const day = today();
    await saveCheckIn(store, checkIn(day, { glucose: { value: 50, unit: 'mg/dL' } }));
    await saveCheckIn(store, checkIn(day, { glucose: { value: 110, unit: 'mg/dL' } }));

    const readings = () => store.getState().observations.filter(o => o.kind === 'glucose' && o.day === day);
    expect(readings().map(o => o.value)).toEqual([50, 110]);
    expect(new Set(readings().map(o => o.id)).size).toBe(2);
    await store.reload();
    expect(readings().map(o => o.value)).toEqual([50, 110]);
  });

  it("records today's readings when they were entered, not at a made-up midday", async () => {
    await booted();
    const day = today();
    const before = Date.now();
    await saveCheckIn(store, checkIn(day, { glucose: { value: 132, unit: 'mg/dL' } }));
    const after = Date.now();

    const [reading] = store.getState().observations.filter(o => o.kind === 'glucose');
    expect(Date.parse(reading.at)).toBeGreaterThanOrEqual(before - 1);
    expect(Date.parse(reading.at)).toBeLessThanOrEqual(after + 1);
    expect(reading.timeUnknown).toBeUndefined();
  });

  it('keeps both through the screens that save with update', async () => {
    await booted();
    const day = today();
    const save = (value: number) => store.update(prev => ({
      ...prev,
      checkIns: [...(prev.checkIns ?? []).filter(c => c.date !== day), checkIn(day, { glucose: { value, unit: 'mg/dL' } })],
    }));
    await save(50);
    await save(110);
    expect(store.getState().observations.filter(o => o.kind === 'glucose').map(o => o.value)).toEqual([50, 110]);
  });

  it('does not duplicate a reading when the same check-in is saved again', async () => {
    await booted();
    const day = today();
    const record = checkIn(day, { glucose: { value: 132, unit: 'mg/dL' }, bp: { sys: 138, dia: 86 }, back: { pain: 4, newNeuro: false, caudaEquinaFlag: false } });
    await saveCheckIn(store, record);
    await saveCheckIn(store, { ...record, energy: 3 });
    expect(store.getState().observations.map(o => o.kind).sort())
      .toEqual(['backPain', 'bloodPressureDiastolic', 'bloodPressureSystolic', 'glucose']);
  });
});

describe('F11 — editing a reading must keep its timing', () => {
  it('keeps the tag, the meal start and the note when the value is corrected', async () => {
    await booted();
    const added = await store.addObservation({
      kind: 'glucose', value: 152, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00.000+05:30',
      tag: 'afterMeal', mealStartedAt: '2026-10-08T07:30:00.000+05:30', note: 'Two parathas.',
    });
    if (!added.ok) return expect.unreachable('add failed');

    const edited = await store.editObservation(added.value.id, { value: 151 });
    expect(edited.ok && edited.value).toMatchObject({
      value: 151, tag: 'afterMeal', mealStartedAt: '2026-10-08T07:30:00.000+05:30', note: 'Two parathas.',
    });
    await store.reload();
    expect(store.getState().observations[0]).toMatchObject({ value: 151, tag: 'afterMeal', mealStartedAt: '2026-10-08T07:30:00.000+05:30' });
  });

  it("keeps a blood pressure half's morning tag", async () => {
    await booted();
    const reading = await store.putBloodPressure({ systolic: 138, diastolic: 86, tag: 'morning', at: '2026-10-08T07:15:00.000+05:30' });
    if (!reading.ok) return expect.unreachable('BP failed');
    const half = reading.value.halves[0];
    const edited = await store.editObservation(half.id, { value: half.value + 2 });
    expect(edited.ok && edited.value.tag).toBe('morning');
  });
});

describe('F12 — the backup must hold every store', () => {
  it('carries content-state through export and replace-import', async () => {
    const source = await openDb(fakeIndexedDB());
    const row = { key: 'saved-guidance', value: { bookmarked: true, readAt: '2026-10-08' } };
    await source.put('content-state', [row]);

    const collected = await collect(source);
    if (!collected.ok) return expect.unreachable('collect failed');
    const target = await openDb(fakeIndexedDB());
    const applied = await applyImport(target, await decode((await encode(collected.value)).bytes), 'replace');
    expect(applied.ok).toBe(true);
    expect(await target.getAll('content-state')).toEqual([row]);

    // And replacing a device from its own export keeps it too.
    expect((await applyImport(source, collected.value, 'replace')).ok).toBe(true);
    expect(await source.getAll('content-state')).toEqual([row]);
    source.close();
    target.close();
  });
});

describe('F13 — one logical save must commit across stores together', () => {
  it('saves a check-in and its reading together or not at all', async () => {
    await booted({ failWrite: (s, v) => (s === 'observations' && v.value === 150 ? quota() : undefined) });
    const day = '2026-10-01';
    await saveCheckIn(store, checkIn(day, { glucose: { value: 110, unit: 'mg/dL' } }));
    expect((await saveCheckIn(store, checkIn(day, { glucose: { value: 150, unit: 'mg/dL' } }))).ok).toBe(false);

    await store.reload();
    expect(store.getState().checkIns.find(c => c.date === day)?.glucose?.value).toBe(110);
    expect(store.getState().observations.filter(o => o.kind === 'glucose').map(o => o.value)).toEqual([110]);
  });

  it('saves an update that touches sessions and settings together or not at all', async () => {
    let fail = false;
    await booted({ failWrite: (s, v) => (fail && s === 'settings' && v.key === 'settings' ? quota() : undefined) });
    fail = true;
    const result = await store.update(prev => ({ ...prev, sessions: [session('s1')], settings: { ...prev.settings, theme: 'dark' } }));
    expect(result.ok).toBe(false);
    await store.reload();
    expect(store.getState().sessions).toEqual([]);
  });
});

describe('F14 — live measurements must keep their series in step', () => {
  it('a corrected body measurement updates its series, and a cleared one leaves it', async () => {
    local.set(V4_KEY, v4Blob({ bodyMetrics: [{ date: '2026-10-08', weight: 80, waist: 90, notes: '' }] }));
    await booted();
    const on = (kind: string) => store.getState().observations.filter(o => o.kind === kind && o.day === '2026-10-08').map(o => o.value);
    expect([on('weight'), on('waist')]).toEqual([[80], [90]]);

    await store.putBodyMetric({ date: '2026-10-08', weight: 82, waist: 92, notes: '' });
    expect([on('weight'), on('waist')]).toEqual([[82], [92]]);

    await store.putBodyMetric({ date: '2026-10-08', weight: null, waist: 92, notes: '' });
    expect([on('weight'), on('waist')]).toEqual([[], [92]]);
  });

  it('a new body measurement appears in its series, through either route', async () => {
    await booted();
    await store.putBodyMetric({ date: '2026-10-08', weight: 81.5, waist: null, notes: '' });
    await store.update(prev => ({ ...prev, bodyMetrics: [...prev.bodyMetrics, { date: '2026-10-09', weight: 81.2, waist: null, notes: '' }] }));
    expect(store.getState().observations.filter(o => o.kind === 'weight').map(o => [o.day, o.value]))
      .toEqual([['2026-10-08', 81.5], ['2026-10-09', 81.2]]);
  });

  it('pain recorded after a session is in the pain series, through either route', async () => {
    await booted();
    await store.putSession(session('s9', { date: '2026-10-08', painAfter: 3 }));
    await store.update(prev => ({ ...prev, sessions: [...prev.sessions, session('s10', { date: '2026-10-09', painAfter: 5 })] }));
    expect(store.getState().observations.filter(o => o.kind === 'backPain').map(o => [o.context, o.value]))
      .toEqual([['session:s9', 3], ['session:s10', 5]]);
  });
});

// A past day, so both readings carry a stand-in time and the order between
// them is decided by their reading ids, not by the clock the test runs at.
describe('F15 — a corrected migrated blood pressure must show the corrected pair', () => {
  it('replaces it when the check-in is corrected', async () => {
    local.set(V4_KEY, v4Blob({ checkIns: [checkIn('2026-09-20', { bp: { sys: 140, dia: 90 } })] }));
    await booted();
    await saveCheckIn(store, checkIn('2026-09-20', { bp: { sys: 130, dia: 80 } }), { readings: 'correct' });
    const readings = pairBloodPressure(store.getState().observations.filter(o => o.day === '2026-09-20'));
    expect(readings.map(r => [r.systolic, r.diastolic])).toEqual([[130, 80]]);
  });

  it('keeps both readings of a recheck, each whole, never a mix of the two', async () => {
    local.set(V4_KEY, v4Blob({ checkIns: [checkIn('2026-09-20', { bp: { sys: 140, dia: 90 } })] }));
    await booted();
    await saveCheckIn(store, checkIn('2026-09-20', { bp: { sys: 130, dia: 80 } }));
    const readings = pairBloodPressure(store.getState().observations.filter(o => o.day === '2026-09-20'));
    expect(readings.map(r => [r.systolic, r.diastolic])).toEqual([[140, 90], [130, 80]]);
    expect(readings.some(isOrphanedReading)).toBe(false);
  });
});

describe("F16 — adding to a source's total must start from that source's total", () => {
  it('keeps counting manual steps after an imported total arrives', async () => {
    await booted();
    await store.addToDayTotal('steps', 4000, { source: 'manual' });
    await store.addObservation({ kind: 'steps', value: 7800, scope: 'dayTotal', source: 'imported' });
    const result = await store.addToDayTotal('steps', 1000, { source: 'manual' });
    expect(result.ok && result.value.value).toBe(5000);
  });
});

describe('F18 — a tap must not mix one day’s total with another day’s time', () => {
  it('counts a tap just before midnight towards the day it was made on', async () => {
    const zone = env.TZ;
    env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-08T23:59:59.000+05:30'));
      // The write ahead of the tap fails, so the tap is planned again — after
      // midnight — against what is stored.
      const fake = await booted({ failWrite: (s, v) => (s === 'sessions' && v.id === 's1' ? quota() : undefined) });
      await store.addObservation({ kind: 'water', value: 1000, scope: 'dayTotal', source: 'manual', at: '2026-10-08T20:00:00.000+05:30' });

      fake.control.hold();
      const occupy = store.putSession(session('s1'));
      const tap = store.addToDayTotal('water', 250);
      vi.setSystemTime(new Date('2026-10-09T00:00:01.000+05:30'));
      fake.control.release();
      expect((await occupy).ok).toBe(false);

      const result = await tap;
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect([result.value.day, result.value.value]).toEqual(['2026-10-08', 1250]);
    } finally {
      vi.useRealTimers();
      if (zone === undefined) delete env.TZ; else env.TZ = zone;
    }
  });
});

describe('F22 — a malformed record must be refused before anything is replaced', () => {
  it('refuses a null check-in and keeps the device as it was', async () => {
    const db = await openDb(fakeIndexedDB());
    await db.put('sessions', [session('saved')]);
    const bad = file({ checkIns: [null] });

    const preview = previewImport(bad);
    expect(preview.ok && preview.rejected?.checkIns).toBe(1);
    expect((await applyImport(db, bad, 'replace')).ok).toBe(false);
    expect(ids(await db.getAll('sessions'))).toEqual(['saved']);
    db.close();
  });

  it('refuses a null session even with a valid reading beside it', async () => {
    const db = await openDb(fakeIndexedDB());
    await db.put('sessions', [session('saved')]);
    const bad = file({ sessions: [null], observations: [glucose('g', '2026-10-01', 120)] });
    expect((await applyImport(db, bad, 'replace')).ok).toBe(false);
    expect(ids(await db.getAll('sessions'))).toEqual(['saved']);
    expect(await db.getAll('observations')).toEqual([]);
    db.close();
  });

  it('imports the readable rest only when explicitly asked to', async () => {
    const db = await openDb(fakeIndexedDB());
    const bad = file({ checkIns: [null, checkIn('2026-10-02')] });
    const result = await applyImport(db, bad, 'replace', { allowRejected: true });
    expect(result.ok).toBe(true);
    expect((await readDoc<CheckInRecord[]>(db, 'checkIns'))?.map(c => c.date)).toEqual(['2026-10-02']);
    db.close();
  });
});

describe('F23 — one id must mean one record, on disk and on screen', () => {
  it('refuses a second record with an id already in use', async () => {
    await booted();
    const walk = (value: number, at: string) => store.addObservation({
      id: 'same-id', kind: 'walkDuration', value, scope: 'sessionObserved', source: 'measured', at, coverageMs: value * 60_000,
    });
    expect((await walk(10, '2026-10-08T07:00:00.000+05:30')).ok).toBe(true);
    expect((await walk(20, '2026-10-08T18:00:00.000+05:30')).ok).toBe(false);

    const total = () => entryFor(summariseDay('2026-10-08', store.getState().observations), 'walkDuration')?.total;
    expect(store.getState().observations).toHaveLength(1);
    expect(total()).toBe(10);
    await store.reload();
    expect(total()).toBe(10);
  });
});

describe('F24 — clearing all data must be all or nothing, and say what happened', () => {
  it('leaves everything in place when the clear cannot finish', async () => {
    let fail = false;
    await booted({ failWrite: (s, v) => (fail && s === 'settings' && v.key === 'schemaVersion' ? quota() : undefined) });
    await store.putSession(session('s1'));
    fail = true;
    expect((await store.clearAll()).ok).toBe(false);

    const shown = ids(store.getState().sessions);
    await store.reload();
    expect(ids(store.getState().sessions)).toEqual(shown);
  });

  it('reports, rather than throws, when the browser will not let it tidy up afterwards', async () => {
    await booted();
    await store.putSession(session('s1'));
    faults.length = () => { throw new DOMException('denied', 'SecurityError'); };

    const result = await store.clearAll();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toMatch(/deleted/i);
    expect(store.getState().sessions).toEqual([]);
    await store.reload();
    expect(store.getState().sessions).toEqual([]);
  });
});

describe('F25 — every failure must come back as a result', () => {
  it('turns an updater that throws into a failed result', async () => {
    await booted();
    const result = await store.update(() => { throw new Error('boom'); });
    expect(result.ok).toBe(false);
    expect(store.getState().failure).toBeDefined();
  });

  it('refuses data that cannot be stored before showing it, and a same-tick update still works', async () => {
    await booted();
    // A changed value inside something structured cloning cannot copy.
    const first = store.update(prev => ({
      ...prev,
      settings: { ...prev.settings, theme: 'dark', gymDays: new Proxy({ ...prev.settings.gymDays, monday: 'rest' }, {}) },
    }));
    const second = store.update(prev => ({ ...prev, settings: { ...prev.settings, useMetric: false } }));
    expect((await first).ok).toBe(false);
    expect((await second).ok).toBe(true);
    expect(store.getState().settings).toMatchObject({ theme: 'system', useMetric: false });
  });

  it('falls back to plain JSON when compression exists but fails', async () => {
    const real = globalThis.CompressionStream;
    globalThis.CompressionStream = class {
      constructor() {
        return new TransformStream({ transform() { throw new Error('compression failed'); } });
      }
    } as never;
    try {
      const db = await openDb(fakeIndexedDB());
      const collected = await collect(db);
      if (!collected.ok) return expect.unreachable('collect failed');
      const encoded = await encode(collected.value);
      expect(encoded.gzip).toBe(false);
      expect(await decode(encoded.bytes)).toEqual(collected.value);
      db.close();
    } finally {
      globalThis.CompressionStream = real;
    }
  });

  it('turns a download that throws into a failed result', async () => {
    const f = new File([new Uint8Array([1])], 'record.json', { type: 'application/json' });
    const result = await deliver(f, {
      document: { createElement: () => { throw new Error('no links here'); } } as never,
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
    });
    expect(result.ok).toBe(false);
  });
});

describe('F26 — an export must be one consistent moment', () => {
  it('never mixes a reading from before another tab’s write with a check-in from after it', async () => {
    let armed = false;
    let peerWrite = () => {};
    const fake = fakeIndexedDB({ onTransaction: (_scope, mode) => { if (armed && mode === 'readonly') { armed = false; peerWrite(); } } });
    const mine = await openDb(fake);
    const peer = await openDb(fake);
    const D = '2026-10-08';
    await mine.put('observations', [glucose('g', D, 110)]);
    await mine.put('settings', [doc('checkIns', [checkIn(D, { glucose: { value: 110, unit: 'mg/dL' } })])]);

    peerWrite = () => {
      void peer.put('observations', [glucose('g', D, 150)]);
      void peer.put('settings', [doc('checkIns', [checkIn(D, { glucose: { value: 150, unit: 'mg/dL' } })])]);
    };
    armed = true;
    const exported = await collect(mine);
    if (!exported.ok) return expect.unreachable('collect failed');
    const reading = exported.value.observations.find(o => o.id === 'g')?.value;
    const summary = exported.value.checkIns[0]?.glucose?.value;
    expect(reading).toBe(summary);
    mine.close();
    peer.close();
  });
});

describe('F27 — opening must recover from a blocked or upgraded database', () => {
  it('closes a connection that arrives after a blocked open was given up on', async () => {
    const fake = fakeIndexedDB({ openFails: 'blocked' });
    await expect(openDb(fake)).rejects.toMatchObject({ code: 'blocked' });
    fake.control.unblock();
    await delay(5);
    expect(fake.control.openConnections()).toBe(0);
  });

  it('lets another copy upgrade the database instead of blocking it forever', async () => {
    const fake = await booted();
    await store.putSession(session('kept-on-screen'));
    const upgraded = new Promise<string>(resolve => {
      const req = fake.open(DB_NAME, DB_VERSION + 1);
      req.onsuccess = () => { (req.result as IDBDatabase).close(); resolve('opened'); };
    });
    expect(await Promise.race([upgraded, delay(50).then(() => 'still blocked')])).toBe('opened');
    expect(store.getState().status).toBe('unavailable');
    expect(store.getState().failure?.code).toBe('stale');
    // What was stored stays on screen; only new changes go unsaved.
    expect(ids(store.getState().sessions)).toEqual(['kept-on-screen']);
    expect(store.isSessionSaved('kept-on-screen')).toBe(true);
  });

});

describe('F28 — the first-paint theme must match the stored one', () => {
  it('does not keep a theme whose save failed', async () => {
    let fail = false;
    await booted({ failWrite: (s, v) => (fail && s === 'settings' && v.key === 'settings' ? quota() : undefined) });
    fail = true;
    expect((await store.setSettings({ theme: 'dark' })).ok).toBe(false);
    expect(store.readStoredTheme()).not.toBe('dark');
    expect(store.getState().settings.theme).toBe('system');
  });

  it('applies a theme chosen while nothing can be saved, for this session', async () => {
    await store.start({ factory: undefined, broadcast: null });
    await store.setSettings({ theme: 'dark' });
    expect(store.displayTheme(store.getState(), 'light')).toBe('dark');
  });
});

describe('Unconfirmed: quota detection that survives realms and engines', () => {
  it('recognises a quota error from another realm by its name or legacy code', () => {
    expect(toFailure({ name: 'QuotaExceededError', message: '' }).code).toBe('quotaExceeded');
    expect(toFailure({ name: 'Error', code: 22, message: '' }).code).toBe('quotaExceeded');
  });

  it('reads the failed request when the transaction has no error yet', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 0 }));
    const result = await db.put('observations', [glucose('g', '2026-10-01', 120)]);
    expect(!result.ok && result.failure.code).toBe('quotaExceeded');
    db.close();
  });

  it('recognises a quota abort at commit, with no request error at all', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 0, quota: 'commit' }));
    const result = await db.put('observations', [glucose('g', '2026-10-01', 120)]);
    expect(!result.ok && result.failure.code).toBe('quotaExceeded');
    db.close();
  });
});

describe('Unconfirmed: import size limits, before anything destructive', () => {
  it('refuses a file larger than the limit', async () => {
    await expect(decode(new Uint8Array(11), { maxBytes: 10 })).rejects.toThrow(/too large/i);
  });

  it('stops decompressing as soon as the text passes the limit', async () => {
    const bomb = new Uint8Array(await new Response(
      new Blob([new Uint8Array(4 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer());
    expect(bomb.byteLength).toBeLessThan(64 * 1024);
    await expect(decode(bomb, { maxBytes: 1024 * 1024 })).rejects.toThrow(/too large/i);
  });

  it('refuses a file holding more records than a lifetime could', async () => {
    const { IMPORT_LIMITS } = await import('./transfer');
    const preview = previewImport(file({ sessions: Array.from({ length: IMPORT_LIMITS.sessions + 1 }, (_, i) => session(`s${i}`)) }));
    expect(preview.ok).toBe(false);
  });
});

describe('Unconfirmed: removing a check-in keeps the measurements taken with it', () => {
  it('removes the summary and keeps its readings', async () => {
    await booted();
    await saveCheckIn(store, checkIn('2026-10-01', { glucose: { value: 132, unit: 'mg/dL' } }));
    expect((await store.removeCheckIn('2026-10-01')).ok).toBe(true);
    expect(store.getState().checkIns).toEqual([]);
    expect(store.getState().observations.map(o => o.value)).toEqual([132]);
  });

  it('removes the readings too, but only those named', async () => {
    await booted();
    await saveCheckIn(store, checkIn('2026-10-01', { glucose: { value: 132, unit: 'mg/dL' }, back: { pain: 4, newNeuro: false, caudaEquinaFlag: false } }));
    const glucoseId = store.getState().observations.find(o => o.kind === 'glucose')!.id;
    expect((await store.removeCheckIn('2026-10-01', { observationIds: [glucoseId] })).ok).toBe(true);
    expect(store.getState().observations.map(o => o.kind)).toEqual(['backPain']);
  });
});

describe('Unconfirmed: two open copies agree on the latest statement', () => {
  it('lets the later commit win an exact tie, in both copies', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    const at = '2026-10-08T10:00:00.000+05:30';
    // Ids chosen so that comparing ids alone would pick the wrong one.
    await a.addObservation({ id: 'zzz', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at });
    await b.addObservation({ id: 'aaa', kind: 'water', value: 750, scope: 'dayTotal', source: 'manual', at });
    await a.reload();
    await b.reload();
    for (const copy of [a, b]) {
      expect(entryFor(summariseDay('2026-10-08', copy.getState().observations), 'water')?.total).toBe(750);
    }
    a.resetForTests();
    b.resetForTests();
  });

  it("counts both copies' increments", async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    await a.addToDayTotal('water', 250, { day: '2026-10-08' });
    await b.addToDayTotal('water', 250, { day: '2026-10-08' });
    await a.reload();
    expect(entryFor(summariseDay('2026-10-08', a.getState().observations), 'water')?.total).toBe(500);
    a.resetForTests();
    b.resetForTests();
  });

  it('tells the other copy to refresh after a write', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake, bus());
    await a.putSession(session('from-a'));
    await delay(5);
    expect(ids(b.getState().sessions)).toEqual(['from-a']);
    a.resetForTests();
    b.resetForTests();
  });
});

describe('Coordinator: storage copy that matches the cause', () => {
  it('tells the user to close other tabs when another copy is in the way', () => {
    const notice = store.storageNotice({ ...store.getState(), status: 'unavailable', failure: new StoreFailure('blocked', 'x') });
    expect(notice?.detail).toMatch(/close (the )?other tabs/i);
  });

  it('gives install advice only in a browser tab', () => {
    const unavailable = { ...store.getState(), status: 'unavailable' as const, failure: toFailure(new DOMException('no', 'SecurityError'), 'unavailable') };
    expect(store.storageNotice({ ...unavailable, installed: false })?.detail).toMatch(/home screen/i);
    for (const installed of [true, undefined]) {
      const detail = store.storageNotice({ ...unavailable, installed })?.detail ?? '';
      expect(detail).not.toMatch(/home screen/i);
      expect(detail).toMatch(/isn.t letting the app store data right now/i);
      expect(detail).toMatch(/restart the app/i);
    }
  });
});


// ---------------------------------------------------------------------------
// Guards for the mechanisms behind the fixes, found missing while writing
// mutants: each fails if its mechanism is removed.
// ---------------------------------------------------------------------------

describe('Mechanism: memory mode', () => {
  it('shows the history it cannot move, and says a change made meanwhile was not saved', async () => {
    local.set(V4_KEY, v4Blob());
    await booted({ quotaAfter: 6, quotaStore: 'settings' });
    expect(store.getState().status).toBe('unavailable');
    // The owner's history is still shown while it cannot be moved.
    expect(ids(store.getState().sessions)).toEqual(['legacy']);
    expect((await store.putSession(session('made-while-full', { date: '2026-10-07' }))).ok).toBe(false);
    expect(store.isSessionSaved('made-while-full')).toBe(false);
  });

  it('a stale copy whose write fails still learns what is stored', async () => {
    const fake = fakeIndexedDB({ quotaStore: 'sessions' });
    const { a, b } = await twoCopies(fake);
    await a.putSession(session('from-a'));
    fake.control.setQuota(1);
    expect((await b.putSession(session('from-b', { date: '2026-10-02' }))).ok).toBe(false);
    expect(ids(b.getState().sessions)).toEqual(['from-a']);
    a.resetForTests();
    b.resetForTests();
  });

  it('notices a write made through the low-level API by another connection', async () => {
    const fake = await booted();
    const other = await openDb(fake);
    expect((await other.put('settings', [doc('settings', { ...settings, theme: 'dark' })])).ok).toBe(true);
    other.close();
    expect((await store.setSettings({ useMetric: false })).ok).toBe(true);
    await store.reload();
    expect(store.getState().settings).toMatchObject({ theme: 'dark', useMetric: false });
  });
});

describe('Mechanism: what screens are told while saving', () => {
  it('says it is saving until the change is stored', async () => {
    await booted();
    const pending = store.putSession(session('s1'));
    expect(store.getState().saving).toBe(true);
    await pending;
    expect(store.getState().saving).toBe(false);
  });

  it('keeps the data a screen reads the same object when a commit goes as planned', async () => {
    await booted();
    const pending = store.update(prev => ({ ...prev, checkIns: [checkIn('2026-10-01')] }));
    const shown = store.projectAppData(store.getState());
    const checkIns = store.getState().checkIns;
    await pending;
    // The session plan a screen built from this is never rebuilt by the save.
    expect(store.getState().checkIns).toBe(checkIns);
    expect(store.projectAppData(store.getState())).toBe(shown);
  });

  it('keeps the projected app data the same object across changes it does not hold', async () => {
    await booted();
    const before = store.projectAppData(store.getState());
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    expect(store.projectAppData(store.getState())).toBe(before);
  });

  it('calls a refused record invalid, with the reason', async () => {
    await booted();
    const result = await store.addObservation({ kind: 'glucose', value: -1, scope: 'pointInTime', source: 'manual' });
    expect(!result.ok && result.failure.code).toBe('invalid');
    expect(!result.ok && result.failure.message).toMatch(/non-negative/);
  });

  it('names each cause it can detect', () => {
    const base = { ...store.getState(), status: 'unavailable' as const };
    const say = (code: 'stale' | 'readFailed' | 'quotaExceeded') => store.storageNotice({ ...base, failure: new StoreFailure(code, 'x') });
    expect(say('stale')?.detail).toMatch(/reload/i);
    expect(say('readFailed')?.detail).toMatch(/could not read/i);
    expect(say('quotaExceeded')?.detail).toMatch(/free some space/i);
    for (const code of ['stale', 'readFailed', 'quotaExceeded'] as const) expect(say(code)?.detail).not.toMatch(/home screen/i);
  });
});

describe('Mechanism: blood pressure corrections leave one whole reading', () => {
  it('a correction clears a duplicate half', async () => {
    const fake = await booted();
    const other = await openDb(fake);
    const at = '2026-10-08T07:15:00.000+05:30';
    const half = (id: string, kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
      newObservation({ id, kind, value, scope: 'pointInTime', source: 'manual', at, context: 'bp:r1' });
    await other.put('observations', [half('r1:s', 'bloodPressureSystolic', 140), half('r1:d', 'bloodPressureDiastolic', 90), half('r1:s2', 'bloodPressureSystolic', 141)]);
    other.close();
    await store.reload();
    expect(pairBloodPressure(store.getState().observations)[0].ambiguous).toBe(true);

    expect((await store.putBloodPressure({ systolic: 130, diastolic: 80, readingId: 'r1' })).ok).toBe(true);
    const [reading] = pairBloodPressure(store.getState().observations);
    expect([reading.systolic, reading.diastolic, reading.ambiguous]).toEqual([130, 80, undefined]);
    expect(store.getState().observations).toHaveLength(2);
  });
});

describe('Mechanism: legacy sessions IndexedDB would refuse', () => {
  it('gives a session with no id, or a repeated one, a fresh id and reports it', async () => {
    const db = await openDb(fakeIndexedDB());
    const result = await migrateToV5(db, v4Blob({
      sessions: [session('same'), session('same', { date: '2026-10-02', notes: 'second' }), { ...session('x'), id: undefined } as never],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.renamedSessions).toEqual([['same', 'same~2'], ['undefined', 'legacy-session-2']]);
    const stored = await db.getAll<WorkoutSession>('sessions');
    expect(stored.map(s => s.id).sort()).toEqual(['legacy-session-2', 'same', 'same~2']);
    expect(stored.find(s => s.id === 'same~2')?.notes).toBe('second');
    db.close();
  });
});

describe('Mechanism: guards no public path reaches today', () => {
  it('a change that names no profile leaves the profile alone', async () => {
    const { emptySnapshot, prepare } = await import('./snapshot');
    const base = { ...emptySnapshot(), profile: { weightKg: 82 } as never };
    expect(prepare(base, { profile: undefined }).next.profile).toEqual({ weightKg: 82 });
    expect(prepare(base, {}).next.profile).toEqual({ weightKg: 82 });
    expect(prepare(base, { profile: null }).next.profile).toBeUndefined();
  });

  it('keeps the failed request\'s error when the engine aborts without one', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 0, quotaStore: 'observations', abortWithoutError: true }));
    const result = await db.put('observations', [glucose('g', '2026-10-01', 120)]);
    expect(!result.ok && result.failure.code).toBe('quotaExceeded');
    db.close();
  });

  it('a body measurement kept on merge keeps its own series, and one taken brings the file\'s', async () => {
    const db = await openDb(fakeIndexedDB());
    const day = '2026-10-08';
    const mine = { date: day, weight: 80, waist: null, notes: '' };
    const theirs = { date: day, weight: 82, waist: null, notes: '' };
    const series = (value: number, editedAt?: string) => ({
      ...newObservation({ id: `bodyMetric:${day}:weight`, kind: 'weight', value, scope: 'pointInTime', source: 'manual', at: `${day}T12:00:00.000+05:30`, timeUnknown: true, context: `bodyMetric:${day}` }),
      ...(editedAt ? { editedAt } : {}),
    });
    await db.put('settings', [doc('bodyMetrics', [mine])]);
    await db.put('observations', [series(80)]);
    // The file's series is a later statement, but its measurement lost the conflict.
    const backup = file({ bodyMetrics: [theirs], observations: [series(82, '2026-10-09T09:00:00.000+05:30')] });

    expect((await applyImport(db, backup, 'merge')).ok).toBe(true);
    expect((await db.get<Observation>('observations', `bodyMetric:${day}:weight`))?.value).toBe(80);

    expect((await applyImport(db, backup, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    expect((await db.get<Observation>('observations', `bodyMetric:${day}:weight`))?.value).toBe(82);
    expect(await readDoc(db, 'bodyMetrics')).toEqual([theirs]);
    db.close();
  });
});

describe('Mechanism: what is shown when storage cannot be opened', () => {
  it('does not show the old v4 copy when it cannot tell whether the device has moved', async () => {
    local.set(V4_KEY, v4Blob());
    await store.start({ factory: undefined, broadcast: null });
    expect(store.getState().status).toBe('unavailable');
    expect(store.getState().sessions).toEqual([]);
  });

  it('asks for a reload when the database is newer than this copy of the app', async () => {
    const fake = fakeIndexedDB();
    await new Promise<void>(resolve => {
      const req = fake.open(DB_NAME, DB_VERSION + 1);
      req.onsuccess = () => { (req.result as IDBDatabase).close(); resolve(); };
    });
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().failure?.code).toBe('stale');
    expect(store.storageNotice()?.detail).toMatch(/reload/i);
  });
});

describe('Coordinator: every reading a check-in holds, each on its own', () => {
  const zoned = async (run: () => Promise<void>) => {
    const zone = env.TZ;
    env.TZ = 'Asia/Kolkata';
    try { await run(); } finally { if (zone === undefined) delete env.TZ; else env.TZ = zone; }
  };

  it('records each blood pressure reading at its own time, and never the average', () => zoned(async () => {
    const { observationsFromCheckIn } = await import('./migrate');
    const record = checkIn('2026-10-08', {
      bp: { sys: 150, dia: 95 },
      bpReadings: [{ sys: 182, dia: 112, at: '2026-10-08T07:10:00.000+05:30' }, { sys: 118, dia: 78, at: '2026-10-08T07:12:00.000+05:30' }],
    });
    const readings = pairBloodPressure(observationsFromCheckIn(record).observations);
    expect(readings.map(r => [r.systolic, r.diastolic, Date.parse(r.at)])).toEqual([
      [182, 112, Date.parse('2026-10-08T07:10:00.000+05:30')],
      [118, 78, Date.parse('2026-10-08T07:12:00.000+05:30')],
    ]);
    // The severe reading is not averaged away into 150/95.
    expect(readings.some(r => r.systolic === 150)).toBe(false);
  }));

  it('records glucose when it was measured, and each earlier reading as its own', () => zoned(async () => {
    const { observationsFromCheckIn } = await import('./migrate');
    const record = checkIn('2026-10-08', {
      glucose: { value: 110, unit: 'mg/dL', measuredAt: '2026-10-08T07:40:00.000+05:30' },
      glucoseEarlier: [
        { value: 52, unit: 'mg/dL', measuredAt: '2026-10-08T07:20:00.000+05:30' },
        { display: 'LO', measuredAt: '2026-10-08T07:05:00.000+05:30' },
      ],
    });
    const glucose = observationsFromCheckIn(record).observations.filter(o => o.kind === 'glucose');
    expect(glucose.map(o => [o.value, Date.parse(o.at)])).toEqual([
      [52, Date.parse('2026-10-08T07:20:00.000+05:30')],
      [110, Date.parse('2026-10-08T07:40:00.000+05:30')],
    ]);
    // A meter that showed LO gave no number, and none is invented.
    expect(glucose).toHaveLength(2);
    expect(glucose.every(o => o.timeUnknown === undefined)).toBe(true);
  }));

  it('files a reading stamped in UTC under the local day it was taken', () => zoned(async () => {
    const { observationsFromCheckIn } = await import('./migrate');
    // 01:30 in Kolkata is 20:00 UTC the day before.
    const record = checkIn('2026-10-08', { glucose: { value: 120, unit: 'mg/dL', measuredAt: '2026-10-07T20:00:00.000Z' } });
    const [reading] = observationsFromCheckIn(record).observations;
    expect(reading.day).toBe('2026-10-08');
    expect(reading.at).toBe('2026-10-08T01:30:00.000+05:30');
  }));

  it('keeps two readings taken together apart, and saving again changes nothing', () => zoned(async () => {
    await booted();
    const day = today();
    const stamp = new Date().toISOString();
    const record = checkIn(day, { bpReadings: [{ sys: 142, dia: 91, at: stamp }, { sys: 136, dia: 88, at: stamp }], bp: { sys: 139, dia: 90 } });
    await saveCheckIn(store, record);
    const first = store.getState().observations;
    expect(pairBloodPressure(first).map(r => [r.systolic, r.diastolic])).toEqual([[142, 91], [136, 88]]);

    await saveCheckIn(store, { ...record, energy: 3 });
    expect(store.getState().observations).toEqual(first);
  }));

  it('does not record a reading again when the sheet moves it to the earlier list', () => zoned(async () => {
    await booted();
    const day = today();
    const low = { value: 52, unit: 'mg/dL' as const, measuredAt: new Date(Date.now() - 20 * 60_000).toISOString() };
    await saveCheckIn(store, checkIn(day, { glucose: low }));
    await saveCheckIn(store, checkIn(day, { glucose: { value: 110, unit: 'mg/dL', measuredAt: new Date().toISOString() }, glucoseEarlier: [low] }));
    expect(store.getState().observations.filter(o => o.kind === 'glucose').map(o => o.value)).toEqual([52, 110]);
  }));

  it('projects a check-in from before these fields exactly as before', async () => {
    const { observationsFromCheckIn } = await import('./migrate');
    const record = checkIn('2026-10-01', {
      glucose: { value: 148, unit: 'mg/dL' }, bp: { sys: 138, dia: 86 },
      back: { pain: 4, legPain: 3, newNeuro: false, caudaEquinaFlag: false },
    });
    const once = observationsFromCheckIn(record).observations;
    expect(once.map(o => [o.id, o.context, o.kind, o.value, o.at.slice(0, 23)])).toEqual([
      ['checkIn:2026-10-01:glucose', 'checkIn:2026-10-01', 'glucose', 148, '2026-10-01T12:00:00.000'],
      ['checkIn:2026-10-01:backPain', 'checkIn:2026-10-01', 'backPain', 4, '2026-10-01T12:00:00.000'],
      ['checkIn:2026-10-01:legPain', 'checkIn:2026-10-01', 'legPain', 3, '2026-10-01T12:00:00.000'],
      ['checkIn:2026-10-01:bloodPressureSystolic', 'bp:checkIn:2026-10-01', 'bloodPressureSystolic', 138, '2026-10-01T12:00:00.000'],
      ['checkIn:2026-10-01:bloodPressureDiastolic', 'bp:checkIn:2026-10-01', 'bloodPressureDiastolic', 86, '2026-10-01T12:00:00.000'],
    ]);
    // The one addition: the stand-in time now says it is one.
    expect(once.every(o => o.timeUnknown === true)).toBe(true);
    expect(observationsFromCheckIn(record).observations).toEqual(once);
  });
});

describe('Coordinator: readings that share a time stay separate records', () => {
  const at = '2026-10-08T07:10:00.000+05:30';

  it('correcting the second of two readings taken together leaves the first as it was', async () => {
    await booted();
    const record = checkIn('2026-10-08', { bpReadings: [{ sys: 142, dia: 91, at }, { sys: 136, dia: 88, at }] });
    await saveCheckIn(store, record);
    await saveCheckIn(store, { ...record, bpReadings: [{ sys: 142, dia: 91, at }, { sys: 130, dia: 85, at }] });
    const readings = pairBloodPressure(store.getState().observations).map(r => [r.systolic, r.diastolic]);
    expect(readings).toEqual([[142, 91], [130, 85]]);
  });

  it('matches readings by value, not by where they sit in the list', async () => {
    await booted();
    const record = checkIn('2026-10-08', { bpReadings: [{ sys: 142, dia: 91, at }, { sys: 136, dia: 88, at }] });
    await saveCheckIn(store, record);
    const first = store.getState().observations;
    await saveCheckIn(store, { ...record, bpReadings: [{ sys: 136, dia: 88, at }, { sys: 142, dia: 91, at }] });
    expect(store.getState().observations).toEqual(first);
  });
});

describe('Coordinator: glucose readings that share a time stay separate records', () => {
  it('correcting one of two glucose readings at the same time leaves the other as it was', async () => {
    await booted();
    const at = '2026-10-08T07:20:00.000+05:30';
    const record = checkIn('2026-10-08', { glucoseEarlier: [{ value: 52, unit: 'mg/dL', measuredAt: at }], glucose: { value: 110, unit: 'mg/dL', measuredAt: at } });
    await saveCheckIn(store, record);
    await saveCheckIn(store, { ...record, glucose: { value: 111, unit: 'mg/dL', measuredAt: at } });
    expect(store.getState().observations.map(o => o.value).sort((a, b) => a - b)).toEqual([52, 111]);
  });
});

describe('Coordinator: a correction lands on the reading it corrects', () => {
  it('correcting the earlier of two same-time readings changes that record, not the other', async () => {
    await booted();
    const at = '2026-10-08T07:20:00.000+05:30';
    const record = checkIn('2026-10-08', { glucoseEarlier: [{ value: 52, unit: 'mg/dL', measuredAt: at }], glucose: { value: 110, unit: 'mg/dL', measuredAt: at } });
    await saveCheckIn(store, record);
    const before = new Map(store.getState().observations.map(o => [o.value, o.id]));
    await saveCheckIn(store, { ...record, glucoseEarlier: [{ value: 53, unit: 'mg/dL', measuredAt: at }] });

    const after = store.getState().observations;
    expect(after.find(o => o.id === before.get(52))?.value).toBe(53);
    const untouched = after.find(o => o.id === before.get(110));
    expect(untouched?.value).toBe(110);
    expect(untouched?.editedAt).toBeUndefined();
  });

  it('the same for blood pressure', async () => {
    await booted();
    const at = '2026-10-08T07:10:00.000+05:30';
    const record = checkIn('2026-10-08', { bpReadings: [{ sys: 142, dia: 91, at }, { sys: 136, dia: 88, at }] });
    await saveCheckIn(store, record);
    const ids0 = new Map(pairBloodPressure(store.getState().observations).map(r => [r.systolic, r.id]));
    await saveCheckIn(store, { ...record, bpReadings: [{ sys: 140, dia: 90, at }, { sys: 136, dia: 88, at }] });

    const readings = pairBloodPressure(store.getState().observations);
    expect(readings.find(r => r.id === ids0.get(142))).toMatchObject({ systolic: 140, diastolic: 90 });
    const untouched = readings.find(r => r.id === ids0.get(136));
    expect(untouched).toMatchObject({ systolic: 136, diastolic: 88 });
    expect(untouched?.halves.every(h => h.editedAt === undefined)).toBe(true);
  });
});

describe('Coordinator: a walk is saved and removed as one record', () => {
  const at = '2026-10-08T07:00:00.000+05:30';
  const walk = (prefix: string) => [
    { id: `${prefix}:duration`, kind: 'walkDuration', value: 30, scope: 'sessionObserved', source: 'measured', at, coverageMs: 30 * 60_000, context: `walk:${prefix}` },
    { id: `${prefix}:movement`, kind: 'movementMinutes', value: 30, scope: 'sessionObserved', source: 'measured', at, coverageMs: 30 * 60_000, context: `walk:${prefix}` },
    { id: `${prefix}:distance`, kind: 'walkDistance', value: 2.4, scope: 'sessionObserved', source: 'measured', at, coverageMs: 30 * 60_000, context: `walk:${prefix}` },
  ] as const;

  it('adds every observation of a walk together, and returns them in order', async () => {
    await booted();
    const result = await store.addObservations([...walk('w1')]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map(o => o.id)).toEqual(['w1:duration', 'w1:movement', 'w1:distance']);
    expect(result.value.every(o => typeof o.seq === 'number')).toBe(true);
    await store.reload();
    expect(ids(store.getState().observations)).toEqual(['w1:distance', 'w1:duration', 'w1:movement']);
  });

  it('writes none of them when the device fills up part-way, and takes them back off the screen', async () => {
    await booted({ quotaAfter: 2, quotaStore: 'observations' });
    const pending = store.addObservations([...walk('w1')]);
    // Shown at once, as every change is…
    expect(ids(store.getState().observations)).toEqual(['w1:distance', 'w1:duration', 'w1:movement']);
    const result = await pending;
    expect(!result.ok && result.failure.code).toBe('quotaExceeded');
    // …and taken back when it could not be stored.
    expect(store.getState().observations).toEqual([]);
    await store.reload();
    expect(store.getState().observations).toEqual([]);
  });

  it('refuses the whole batch when one record is invalid, and says which', async () => {
    await booted();
    const bad = [...walk('w1')].map((o, i) => (i === 1 ? { ...o, value: -5 } : o));
    const result = await store.addObservations(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('invalid');
    expect(result.failure.details).toEqual([{ index: 1, id: 'w1:movement', reason: expect.stringMatching(/non-negative/) }]);
    expect(result.failure.message).toMatch(/record 2/i);
    expect(store.getState().observations).toEqual([]);
  });

  it('refuses the whole batch when an id is already stored, or used twice, and says which', async () => {
    await booted();
    await store.addObservations([walk('w1')[0]]);
    const stored = await store.addObservations([...walk('w1')]);
    expect(!stored.ok && stored.failure.code).toBe('conflict');
    expect(!stored.ok && stored.failure.details?.map(d => d.id)).toEqual(['w1:duration']);
    expect(ids(store.getState().observations)).toEqual(['w1:duration']);

    const twice = await store.addObservations([walk('w2')[0], walk('w2')[0]]);
    expect(!twice.ok && twice.failure.details).toEqual([{ index: 1, id: 'w2:duration', reason: expect.stringMatching(/twice/) }]);
    expect(ids(store.getState().observations)).toEqual(['w1:duration']);
  });

  it('accepts an empty batch without writing anything', async () => {
    await booted();
    expect(await store.addObservations([])).toEqual({ ok: true, value: [] });
    expect(await store.removeObservations([])).toEqual({ ok: true, value: undefined });
  });

  it('removes every observation of a walk together', async () => {
    await booted();
    await store.addObservations([...walk('w1'), ...walk('w2')]);
    expect((await store.removeObservations(walk('w1').map(o => o.id))).ok).toBe(true);
    expect(ids(store.getState().observations)).toEqual(['w2:distance', 'w2:duration', 'w2:movement']);
    await store.reload();
    expect(ids(store.getState().observations)).toEqual(['w2:distance', 'w2:duration', 'w2:movement']);
  });

  it('removes none of them when the removal fails part-way, and puts them back on the screen', async () => {
    let fail = false;
    await booted({ failDelete: (s, key) => (fail && s === 'observations' && key === 'w1:movement' ? new DOMException('no', 'UnknownError') : undefined) });
    await store.addObservations([...walk('w1')]);
    fail = true;
    const pending = store.removeObservations(walk('w1').map(o => o.id));
    expect(store.getState().observations).toEqual([]);
    expect((await pending).ok).toBe(false);
    expect(ids(store.getState().observations)).toEqual(['w1:distance', 'w1:duration', 'w1:movement']);
    await store.reload();
    expect(ids(store.getState().observations)).toEqual(['w1:distance', 'w1:duration', 'w1:movement']);
  });

  it('removes what is still there when part of the walk is already gone', async () => {
    await booted();
    await store.addObservations([...walk('w1')]);
    await store.removeObservation('w1:distance');
    expect((await store.removeObservations(walk('w1').map(o => o.id))).ok).toBe(true);
    expect(store.getState().observations).toEqual([]);
  });
});

describe('Coordinator: what a backup covers', () => {
  const storedRevision = async (fake: IDBFactory) => {
    const db = await openDb(fake);
    const revision = await readDoc<number>(db, 'revision');
    db.close();
    return revision;
  };

  it('state.revision is the stored revision, and moves only when a change is stored', async () => {
    const fake = await booted({ failWrite: (s, v) => (s === 'sessions' && v.id === 'refused' ? quota() : undefined) });
    const start = store.getState().revision;
    expect(start).toBe(await storedRevision(fake));

    const pending = store.putSession(session('s1'));
    expect(store.getState().revision).toBe(start); // shown, not yet stored
    await pending;
    expect(store.getState().revision).toBe(start + 1);
    expect(store.getState().revision).toBe(await storedRevision(fake));

    expect((await store.putSession(session('refused'))).ok).toBe(false);
    expect(store.getState().revision).toBe(start + 1);
  });

  it('is the same number in every open copy once it has caught up', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    await a.putSession(session('from-a'));
    await b.reload();
    expect(a.getState().revision).toBeGreaterThan(0);
    expect(b.getState().revision).toBe(a.getState().revision);
    a.resetForTests();
    b.resetForTests();
  });

  it('exportRecord says which revision and which moment the file covers', async () => {
    await booted();
    await store.putSession(session('s1'));
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    expect(exported.value.revision).toBe(store.getState().revision);
    expect(isAt(exported.value.exportedAt)).toBe(true);
    expect((await decode(exported.value.bytes) as { exportedAt: string }).exportedAt).toBe(exported.value.exportedAt);
  });

  it('returns the time the file carries, to the millisecond', async () => {
    await booted();
    // A clock that moves on every read, so two separate readings never agree by luck.
    const Real = Date;
    let tick = Real.parse('2026-10-08T09:00:00.000+05:30');
    class Moving extends Real {
      constructor(...args: unknown[]) {
        if (args.length > 0) super(...(args as [string]));
        else super((tick += 1));
      }
      static now() { return (tick += 1); }
    }
    globalThis.Date = Moving as DateConstructor;
    try {
      const exported = await store.exportRecord();
      if (!exported.ok) return expect.unreachable('export failed');
      expect((await decode(exported.value.bytes) as { exportedAt: string }).exportedAt).toBe(exported.value.exportedAt);
    } finally {
      globalThis.Date = Real;
    }
  });

  it('covers every change made before it was asked for', async () => {
    await booted();
    void store.putSession(session('pending-when-asked'));
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    expect(exported.value.revision).toBeGreaterThan(0);
    expect(exported.value.revision).toBe(store.getState().revision);
    expect((await decode(exported.value.bytes) as { sessions: { id: string }[] }).sessions.map(s => s.id)).toContain('pending-when-asked');
  });

  it('reports what is stored, even from a copy that has not caught up', async () => {
    const fake = fakeIndexedDB();
    const { a, b } = await twoCopies(fake);
    await a.putSession(session('from-a'));
    const exported = await b.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    expect(a.getState().revision).toBeGreaterThan(0);
    expect(exported.value.revision).toBe(a.getState().revision);
    expect((await decode(exported.value.bytes) as { sessions: { id: string }[] }).sessions.map(s => s.id)).toEqual(['from-a']);
    // And the copy now shows what it exported.
    expect(b.getState().revision).toBe(exported.value.revision);
    expect(ids(b.getState().sessions)).toEqual(['from-a']);
    a.resetForTests();
    b.resetForTests();
  });

  it('counts a backdated session, a past check-in, a profile or a settings edit as newer than the backup', async () => {
    await booted();
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    let last = exported.value.revision;
    const later = async (change: Promise<unknown>) => {
      await change;
      expect(store.getState().revision).toBeGreaterThan(last);
      last = store.getState().revision;
    };
    await later(store.putSession(session('backdated', { date: '2026-01-01' })));
    await later(saveCheckIn(store, checkIn('2026-01-02')));
    await later(store.setProfile({ weightKg: 81 } as never));
    await later(store.setSettings({ theme: 'dark' }));
  });

  // What a mark kept in settings can rely on: recording the backup is itself a
  // stored change, exactly one, and recording the same mark again is none.
  it('a backup mark written into settings is one commit, and the same mark again is none', async () => {
    await booted();
    await store.putSession(session('s1'));
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    const { revision, exportedAt } = exported.value;
    const mark = (previous: AppData): AppData => ({
      ...previous,
      settings: { ...previous.settings, habits: { ...previous.settings.habits, lastExportAt: exportedAt, lastExportSeq: revision } },
    });
    expect((await store.update(mark)).ok).toBe(true);
    expect(store.getState().revision).toBe(revision + 1);
    expect((await store.update(mark)).ok).toBe(true);
    expect(store.getState().revision).toBe(revision + 1);
  });

  it('covers what this session holds while nothing can be saved', async () => {
    await store.start({ factory: undefined, broadcast: null });
    await store.putSession(session('s1'));
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    expect(exported.value.revision).toBeGreaterThan(0);
    expect(exported.value.revision).toBe(store.getState().revision);
  });
});
