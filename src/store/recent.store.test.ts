/**
 * Recently deleted through the real store, read back from IndexedDB itself:
 * "Erase all routes" with a deleted walk and a planted `settings.deleted.recent`
 * (Review Focus 3, D93, D109, P8-11); expiry at a start, on a return and on
 * time while the page runs, with nothing else deleted, and never on a clock
 * set back (P8-12, P8R-14, K8-01); every kind of restore refusing an entry
 * past its 7 days, one whose 7 days end while it waits behind another write
 * included (P8R-14, P8S-09); a check-in's reading back in its check-in and in
 * the series under fresh ids (P8R-03), a blood pressure's still that day's
 * for its detail's correction and delete (P8S-07), or, with nothing to put
 * back, its entry gone with words to say so (K8-06); and a session's pain
 * score, corrected since, back as it was (P8S-06).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { routeRecord } from '@/walk/routeRecord';
import { DB_NAME, STORE_NAMES } from './db';
import { fakeIndexedDB } from './fakeIdb';
import { RECENT_MS, isRecentKey } from './recent';
import type { StoredRecord } from './records';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
const heard: (() => void)[] = [];
const doc = { visibilityState: 'visible', addEventListener: (_t: string, fn: () => void) => void heard.push(fn), removeEventListener() {} };
Object.assign(globalThis, { document: doc });

const store = await import('./useStore');
const { decode } = await import('./transfer');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { ALREADY_BACK, correctCheckInPressure, removeCheckInReading, resetPendingCheckInsForTests, restoreCheckInReading } = await import('@/components/checkin/pending');
const { checkInDayOf } = await import('@/health/observation');
const { asRecent, recentKey } = await import('./recent');
const { deleteWorkout, restoreWorkout } = await import('@/screens/workout/deletion');

const NOW = new Date('2026-10-08T09:00:00+05:30');
const AT = '2026-10-08T09:00:00.000+05:30';
const DAY = '2026-10-08';
const W = 'mgh3k2x1-1a2b3c4d';
const ROUTE = routeRecord(W, AT, [{ start: NOW.getTime(), end: NOW.getTime() + 20_000, coords: [[12.97, 77.59], [12.971, 77.5905]], ms: [0, 20_000] }])! as unknown as StoredRecord;
const walked = (['walkDuration', 'movementMinutes'] as const).map(kind =>
  ({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved' as const, source: 'measured' as const, at: AT, coverageMs: 1_200_000, context: `walk:${W}` }));
const PROFILE = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', diabetes: 'type2' } });
let fake: ReturnType<typeof fakeIndexedDB>;

/** Every row of every store, as IndexedDB holds them now, at whatever version it has. */
async function rawRows(): Promise<Record<string, unknown[]>> {
  const db = await new Promise<IDBDatabase>(resolve => {
    const req = fake.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
  });
  const out: Record<string, unknown[]> = {};
  for (const name of STORE_NAMES) {
    out[name] = await new Promise<unknown[]>(resolve => {
      const req = db.transaction(name).objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
    });
  }
  db.close();
  return out;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const recentRows = async () => (await rawRows())['content-state'].filter(r => isRecentKey((r as { key: string }).key));
const DAY_MS = 24 * 60 * 60 * 1000;
const reading = (i: number) => ({ kind: 'glucose' as const, value: 100 + i, unit: 'mg/dL', scope: 'pointInTime' as const, source: 'manual' as const, at: `2026-10-08T0${i % 9}:00:00+05:30`, id: `g${i}` });

async function boot() {
  store.resetForTests();
  resetPendingCheckInsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  local.clear();
  heard.length = 0;
  await boot();
});
afterEach(() => {
  store.resetForTests();
  vi.useRealTimers();
});

describe('"Erase all routes" reaches every carrier (Review Focus 3, D93, D109, P8-11)', () => {
  it('leaves no coordinate in the store, its raw rows or the next backup, and the walk comes back without one', async () => {
    expect((await store.setSettings({ walk: { saveRoutes: true, map: 'off' } } as never)).ok).toBe(true);
    expect((await store.addObservations(walked)).ok).toBe(true);
    expect((await store.putRecords('routes', [ROUTE])).ok).toBe(true);
    const deleted = await store.deleteRecord({ kind: 'walk', walkId: W });
    if (!deleted.ok) throw deleted.failure;
    // A file an older build kept: coordinates under settings.deleted.recent, where this app never writes.
    await store.setSettings({ deleted: { ...store.getState().settings.deleted, recent: [{ at: AT, store: 'routes', record: ROUTE }] } } as never);
    expect(JSON.stringify((await rawRows()).settings)).toMatch(/12\.97/);
    expect(JSON.stringify((await rawRows())['content-state'])).toMatch(/12\.97/);
    expect((await store.eraseRoutes()).ok).toBe(true);
    expect(JSON.stringify(await rawRows())).not.toMatch(/12\.97|77\.59/);
    expect(JSON.stringify(store.getState())).not.toMatch(/12\.97|77\.59/);
    const backup = await store.exportRecord({ include: ['routes'] });
    if (!backup.ok) throw backup.failure;
    expect(JSON.stringify(await decode(backup.value.bytes))).not.toMatch(/12\.97|77\.59/);
    const back = await store.restoreDeleted(deleted.value);
    if (!back.ok) throw back.failure;
    expect(store.getState().records.routes).toEqual([]);
    expect(store.getState().observations.filter(o => o.context === `walk:${back.value.id}`)).toHaveLength(2);
  });

  it('drops a planted `settings.deleted.recent` at the next start, and keeps every other deletion record', async () => {
    await store.setSettings({ deleted: { observations: ['gone-1'], recent: [{ at: AT, store: 'routes', record: ROUTE }] } } as never);
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    await settle();
    const settings = (await rawRows()).settings.find(r => (r as { key: string }).key === 'settings') as { value: { deleted?: Record<string, unknown> } };
    expect(settings.value.deleted).toEqual({ observations: ['gone-1'] });
  });
});

describe('every deletion is kept its 7 days, and not a moment longer (D109, P8-12, P8R-14, K8-01)', () => {
  it('drops an entry past 7 days at the next start, with nothing else deleted, from IndexedDB itself', async () => {
    expect((await store.addObservation(reading(1))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g1' })).ok).toBe(true);
    store.resetForTests();
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    await store.start({ factory: fake, broadcast: null });
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('drops it on a return to the app, too', async () => {
    expect((await store.addObservation(reading(2))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g2' })).ok).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('drops it when its 7 days end while the page runs, with nothing else happening', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    await boot();
    expect((await store.addObservation(reading(3))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g3' })).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(RECENT_MS - 60_000);
    expect(await recentRows()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await recentRows()).toEqual([]);
  });

  it('never ends anything while the clock reads earlier than the last time expiry ran', async () => {
    expect((await store.addObservation(reading(4))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g4' })).ok).toBe(true);
    // The clock set a month ahead: g4's entry ends, and expiry runs at that time.
    vi.setSystemTime(new Date(NOW.getTime() + 30 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
    // Set back, a reading deleted, and the clock a week and a day on: still behind that run, so nothing ends.
    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    expect((await store.addObservation(reading(5))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g5' })).ok).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + 8 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect((await recentRows()).map(r => (r as { value: { of: string } }).value.of)).toEqual(['g5']);
    // Past that run again, it ends as it should.
    vi.setSystemTime(new Date(NOW.getTime() + 31 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('is refused by every kind of restore once its 7 days are over, though expiry hasn’t run yet', async () => {
    const day: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...day, readiness: evaluateCheckIn(PROFILE, day, []) }] }));
    expect((await store.addObservation(reading(7))).ok).toBe(true);
    const reading7 = await store.deleteRecord({ kind: 'reading', id: 'g7' });
    expect((await store.putSession({ id: 's1', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: AT, completedAt: AT, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    const workout = await deleteWorkout('s1');
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    if (!reading7.ok || !workout.ok) throw new Error('not deleted');
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 1));
    expect(await store.restoreDeleted(reading7.value)).toMatchObject({ ok: false, failure: { message: expect.stringMatching(/no longer in Recently deleted/) } });
    expect(await restoreWorkout(workout.value)).toMatchObject({ ok: false });
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    expect(await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps)).toMatchObject({ stored: false, failure: expect.stringMatching(/no longer in Recently deleted/) });
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
    expect(await recentRows()).toHaveLength(3);
  });

  it('is refused as it commits when its 7 days end while it waits behind another write, whichever kind it is (P8S-09)', async () => {
    const day: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...day, readiness: evaluateCheckIn(PROFILE, day, []) }] }));
    expect((await store.addObservation(reading(6))).ok).toBe(true);
    const plain = await store.deleteRecord({ kind: 'reading', id: 'g6' });
    expect((await store.putSession({ id: 's2', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: AT, completedAt: AT, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    const workout = await deleteWorkout('s2');
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci2', at: AT, observations: [lifted] });
    if (!plain.ok || !workout.ok) throw new Error('not deleted');
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci2')])!;
    // A minute before the 7 days end: a write held just before it commits, and every restore asked for behind it.
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS - 60_000));
    fake.control.hold();
    const held = store.addObservation(reading(8));
    const restores = Promise.all([
      store.restoreDeleted(plain.value),
      restoreWorkout(workout.value),
      restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps),
    ]);
    await settle();
    // The 7 days end while they wait.
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    fake.control.release();
    expect((await held).ok).toBe(true);
    const [one, two, three] = await restores;
    expect(one).toMatchObject({ ok: false, failure: { message: expect.stringMatching(/no longer in Recently deleted/) } });
    expect(two).toMatchObject({ ok: false });
    expect(three).toMatchObject({ stored: false });
    expect(store.getState().observations.some(o => o.restoredFrom)).toBe(false);
    expect(store.getState().sessions.some(s => s.restoredFrom)).toBe(false);
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
  });
});

describe('a restore asks as it commits, with nothing changed before it (P8S-09)', () => {
  it('a workout restore planned within its 7 days, committed after them behind a write that failed, is refused', async () => {
    store.resetForTests();
    // A device that runs out of space only as a transaction commits (as engines do), when the test says.
    fake = fakeIndexedDB({ quota: 'commit' });
    await store.start({ factory: fake, broadcast: null });
    expect((await store.putSession({ id: 's3', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: AT, completedAt: AT, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    const workout = await deleteWorkout('s3');
    if (!workout.ok) throw workout.failure;
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS - 60_000));
    // A write shown only once stored, held, and then refused: what is stored, and on screen, stays as it was.
    fake.control.hold();
    const ahead = store.eraseRoutes();
    const restore = restoreWorkout(workout.value);
    await settle();
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    // The write ahead commits, out of space, as it is let go; the restore behind it then finds room.
    fake.control.setQuota(0);
    fake.control.release();
    fake.control.setQuota(undefined);
    expect((await ahead).ok).toBe(false);
    expect(await restore).toMatchObject({ ok: false, failure: { message: expect.stringMatching(/no longer in Recently deleted/) } });
    expect(store.getState().sessions.some(s => s.restoredFrom)).toBe(false);
  });
});

describe('a check-in’s reading, out and back (D110, P8R-03, K8-06)', () => {
  const checkIn: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };

  it('comes back into its check-in and into the series under a fresh id, the entry used up, in IndexedDB itself', async () => {
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    const removed = await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    expect(removed.stored).toBe(true);
    expect(store.getState().observations.some(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)).toBe(false);
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    const back = await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps);
    expect(back).toMatchObject({ matched: true, stored: true });
    expect(store.getState().checkIns[0].glucose).toMatchObject({ value: 118 });
    const rows = (await rawRows()).observations as { id: string; kind: string; value: number; context?: string; restoredFrom?: string }[];
    const series = rows.filter(o => o.kind === 'glucose' && o.context === `checkIn:${DAY}`);
    expect(series).toEqual([expect.objectContaining({ value: 118, restoredFrom: lifted.id })]);
    expect(series[0].id).not.toBe(lifted.id);
    expect(await recentRows()).toEqual([]);
  });

  it('with nothing to put back, drops the entry and says so, never that it didn’t save', async () => {
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    // The same reading answered again in the check-in meanwhile.
    await store.update(prev => ({ ...prev, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const back = await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps);
    expect(back).toMatchObject({ matched: true, stored: true, unchanged: 'already' });
    expect(ALREADY_BACK).toBe('Already back in your check-in.');
    expect(await recentRows()).toEqual([]);
  });

  it('a blood pressure out and back is that day’s again: its detail corrects and deletes it as the check-in’s, and nothing brings it back (P8S-07)', async () => {
    const bpDay: DailyCheckIn = { ...checkIn, bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: '2026-10-08T08:52:00.000+05:30' }] };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...bpDay, readiness: evaluateCheckIn(PROFILE, bpDay, []) }] }));
    const halves = () => store.getState().observations.filter(o => (o.kind === 'bloodPressureSystolic' || o.kind === 'bloodPressureDiastolic') && checkInDayOf(o) === DAY);
    const values = () => halves().map(o => o.value).sort((a, b) => a - b);
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    const at = halves()[0].at;
    expect((await removeCheckInReading({ kind: 'pressure', at, sys: 124, dia: 78 }, halves().map(o => o.id), deps, { entry: 'deleted-bp', at: AT, observations: halves() })).stored).toBe(true);
    expect(halves()).toEqual([]);
    const entry = asRecent(store.getState().contentState[recentKey('deleted-bp')])!;
    expect((await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps)).stored).toBe(true);
    // Both halves read as that day's check-in's, under one fresh context of their own: one reading (P8S-07).
    expect(halves()).toHaveLength(2);
    expect(halves()[0].context).toMatch(new RegExp(`^bp:checkIn:${DAY}#[0-9a-z]+$`));
    expect(halves()[0].context).not.toBe(entry.observations![0].context);
    expect(halves().every(o => checkInDayOf(o) === DAY && o.context === halves()[0].context && o.restoredFrom)).toBe(true);
    // Its detail's correction finds them: the check-in and the series corrected together, still one reading.
    expect((await correctCheckInPressure({ at, was: { sys: 124, dia: 78 }, to: { sys: 126, dia: 78 } }, deps)).stored).toBe(true);
    expect(store.getState().checkIns[0].bpReadings).toEqual([expect.objectContaining({ sys: 126, dia: 78 })]);
    expect(values()).toEqual([78, 126]);
    // And its delete takes it out of both, so a later save of the check-in brings nothing back.
    expect((await removeCheckInReading({ kind: 'pressure', at, sys: 126, dia: 78 }, halves().map(o => o.id), deps)).stored).toBe(true);
    await store.update(prev => ({ ...prev, checkIns: (prev.checkIns ?? []).map(c => ({ ...c, energy: 3 })) }));
    expect(halves()).toEqual([]);
    expect(store.getState().checkIns[0].bpReadings ?? []).toEqual([]);
  });
});

describe('a session and what was recorded with it, out and back as they were (P8S-06)', () => {
  it('a pain score corrected since comes back corrected, under the session’s new id, with its own times and place, and no later save undoes it', async () => {
    const earlier = { id: 's9', date: '2026-10-06', dayOfWeek: 'tuesday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: '2026-10-06T08:00:00.000+05:30', completedAt: '2026-10-06T08:40:00.000+05:30', notes: '', totalVolume: 0, painAfter: 2 };
    const pain = () => store.getState().observations.filter(o => o.kind === 'backPain');
    expect((await store.putSession(earlier as never)).ok).toBe(true);
    expect(pain()).toEqual([expect.objectContaining({ id: 'session:s9:backPain', value: 2 })]);
    // Corrected in Track since: the session itself still says 2.
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    expect((await store.editObservation('session:s9:backPain', { value: 4 })).ok).toBe(true);
    const corrected = pain()[0];
    const deleted = await deleteWorkout('s9');
    if (!deleted.ok) throw deleted.failure;
    expect(pain()).toEqual([]);
    const back = await restoreWorkout(deleted.value);
    if (!back.ok) throw back.failure;
    expect(pain()).toEqual([expect.objectContaining({
      id: `session:${back.value.id}:backPain`, context: `session:${back.value.id}`, value: 4, restoredFrom: 'session:s9:backPain',
      editedAt: corrected.editedAt, order: corrected.order,
    })]);
    const again = store.getState().sessions.find(s => s.id === back.value.id)!;
    expect(again.painAfter).toBe(4);
    // Saved again, the session works out nothing new from an older score.
    expect((await store.putSession({ ...again, notes: 'felt fine' })).ok).toBe(true);
    expect(pain()).toEqual([expect.objectContaining({ value: 4, editedAt: corrected.editedAt })]);
  });
});
