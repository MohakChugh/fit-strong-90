/**
 * F-safety-01 (journey §4.1, §4.5): an answer the device hasn't confirmed
 * stored can tighten what the gates allow, never loosen it. A stored low,
 * then a recovery whose write is still on its way, or refused: Resume on a
 * paused walk asks the store's own gate (`storeGate`, through the live
 * controller), and holds until the recovery is stored. Driven through the
 * real callers: the check-in save path (`saveCheckInRecord`, as
 * `useGuided().saveCheckIn` calls it), the live walk controller and the real
 * store over a fake IndexedDB whose commits the test holds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import type { LiveWalk } from '@/walk/live';
import type { Observation } from '@/health/observation';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
});

const store = await import('@/store/useStore');
const { createLiveWalk } = await import('@/walk/live');
const { storeGate, storeStartPermission, watchClinical, deviceClinical, walkInput } = await import('@/walk/gate');
const { startGate } = await import('@/session/gate');
const { pauseWalk, startWalk } = await import('@/walk/clock');
const { storeWalk } = await import('@/walk/persist');
const { newWalkId } = await import('@/walk/plan');
const { resetPendingCheckInsForTests, saveCheckInRecord } = await import('./pending');
const { evaluateCheckIn } = await import('@/engine/readiness');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } } satisfies ProfileInput;
const DAY = '2026-10-09';
const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0);
const iso = (h: number, m = 0) => at(h, m).toISOString();
const clock = (h: number, m = 0) => vi.setSystemTime(at(h, m));

let db = fakeIndexedDB();
let live: LiveWalk | undefined;
const kept = new Map<string, string>();
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(13, 30);
  local.clear();
  kept.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  db = fakeIndexedDB();
  await store.start({ factory: db, broadcast: null });
});
afterEach(() => {
  live?.detach();
  live = undefined;
  db.control.release();
  vi.useRealTimers();
});

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
async function seed(profile: UserProfile, records: DailyCheckIn[]) {
  const recs: CheckInRecord[] = records.map(c => ({ ...c, readiness: evaluateCheckIn(profile, c, []) }));
  const done = await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: '2026-09-28', onboardingComplete: true }, checkIns: recs }));
  expect(done.ok).toBe(true);
}

/** A walk paused at 13:20, kept as the tab keeps one, and taken up again by the one live controller asking the store's gate. */
function pausedWalk(): LiveWalk {
  const t0 = at(13, 10).getTime();
  const walk = pauseWalk(startWalk(newWalkId(t0), { kind: 'walk', gps: false, steps: false }, t0), at(13, 20).getTime());
  const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  storeWalk(storage, walk);
  live = createLiveWalk({
    mayRun: intent => storeGate(intent),
    watchClinical,
    now: () => Date.now(),
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
    storage,
    visibility: { visible: () => true, subscribe: () => () => {} },
  });
  expect(live.attach()).toBe('resumed');
  return live;
}
const status = () => live?.getSnapshot()?.walk.status;

/** What the person said at 13:46 on the check-in: 130 mg/dL, symptoms gone, and the care plan allows exercise. */
const recovery = ci({ glucose: { value: 130, unit: 'mg/dL', measuredAt: iso(13, 46), source: 'meter' }, lowRecovered: true });
const lowAt1330 = ci({ glucose: { value: 60, unit: 'mg/dL', measuredAt: iso(13, 30), source: 'meter' } });

describe('F-safety-01: a recovery releases movement only once it is stored', () => {
  it('while its write is on its way, Resume holds; once stored, Resume goes', async () => {
    const profile = createDefaultProfile(INSULIN);
    await seed(profile, [lowAt1330]);
    clock(13, 46);
    pausedWalk();
    live!.resume();
    expect(status()).toBe('paused');

    db.control.hold();
    const saving = saveCheckInRecord(recovery, { profile: store.getState().profile!, update: store.update });
    await Promise.resolve();
    // The store shows the recovery at once; the gates must not take it as stored.
    expect(store.getState().saving).toBe(true);
    expect(storeGate('restart')).toBe(false);
    live!.resume();
    expect(status()).toBe('paused');
    // The session player's Resume asks the same question of the same records.
    const input = walkInput(deviceClinical(store.getState()), new Date());
    expect(startGate(input, 'guided').allowed && !startGate(input, 'guided').needsCheckIn).toBe(false);

    db.control.release();
    expect((await saving).stored).toBe(true);
    live!.resume();
    expect(status()).toBe('running');
  });

  it('refused once it arrives, it never released anything, before or after', async () => {
    const profile = createDefaultProfile(INSULIN);
    await seed(profile, [lowAt1330]);
    clock(13, 46);
    pausedWalk();

    db.control.hold();
    const saving = saveCheckInRecord(recovery, { profile: store.getState().profile!, update: store.update });
    await Promise.resolve();
    live!.resume();
    expect(status()).toBe('paused');
    db.control.setWriteError(() => new DOMException('The operation failed.', 'QuotaExceededError'));
    db.control.release();
    expect((await saving).stored).toBe(false);
    live!.resume();
    expect(status()).toBe('paused');
    expect(storeGate('restart')).toBe(false);
  });

  it('with nothing stored for the day, a refused recovery never releases a refused low: each unstored answer counts on its own', async () => {
    const profile = createDefaultProfile(INSULIN);
    await seed(profile, []);
    const quota = () => new DOMException('The operation failed.', 'QuotaExceededError');
    db.control.setWriteError(quota);
    expect((await saveCheckInRecord(lowAt1330, { profile: store.getState().profile!, update: store.update })).stored).toBe(false);
    expect(storeGate('start')).toBe(false);
    clock(13, 46);
    expect((await saveCheckInRecord(recovery, { profile: store.getState().profile!, update: store.update })).stored).toBe(false);
    expect(storeGate('start')).toBe(false);
    expect(storeStartPermission().allowed).toBe(false);
    // Space freed, and the same answers checked in again: stored, so the recovery counts.
    db.control.setWriteError(undefined);
    expect((await saveCheckInRecord(recovery, { profile: store.getState().profile!, update: store.update })).stored).toBe(true);
    expect(storeGate('start')).toBe(true);
    // What that stored write holds no longer waits: a later answer on its way brings none of it back.
    db.control.hold();
    const later = saveCheckInRecord({ ...recovery, energy: 3 }, { profile: store.getState().profile!, update: store.update });
    await Promise.resolve();
    expect(storeGate('start')).toBe(true);
    db.control.release();
    expect((await later).stored).toBe(true);
  });

  it('a stored recovery isn’t held back by the refused low before it, while a later answer waits', async () => {
    store.resetForTests();
    let full = true;
    // Refused: everything while the device is full, and afterwards only the answer changing energy to 3.
    const quota = () => new DOMException('The operation failed.', 'QuotaExceededError');
    db = fakeIndexedDB({
      failWrite: (name, row) => (name === 'settings' && row.key === 'checkIns'
        && (full || (row.value as CheckInRecord[]).some(c => c.date === DAY && c.energy === 3)) ? quota() : undefined),
    });
    await store.start({ factory: db, broadcast: null });
    full = false;
    const profile = createDefaultProfile(INSULIN);
    await seed(profile, []);
    full = true;
    expect((await saveCheckInRecord(lowAt1330, { profile: store.getState().profile!, update: store.update })).stored).toBe(false);
    full = false;
    clock(13, 46);
    db.control.hold();
    const recovered = saveCheckInRecord(recovery, { profile: store.getState().profile!, update: store.update });
    const later = saveCheckInRecord({ ...recovery, energy: 3 }, { profile: store.getState().profile!, update: store.update });
    db.control.release();
    expect((await recovered).stored).toBe(true);
    expect((await later).stored).toBe(false);
    // The stored recovery holds the low and everything said before it; only the energy answer waits.
    expect(storeGate('start')).toBe(true);
  });

  it('in a session that can’t save (the v1 record shown while it can’t be moved), a Track re-check never releases the hold it answers', async () => {
    store.resetForTests();
    const profile = createDefaultProfile(INSULIN);
    const below = ci({ glucose: { value: 85, unit: 'mg/dL', measuredAt: iso(13, 30), source: 'meter' } });
    local.set('fit-strong-90-data', JSON.stringify({
      version: 4, settings: { onboardingComplete: true, startDate: '2026-09-28' }, profile, sessions: [], bodyMetrics: [], personalRecords: [],
      checkIns: [{ ...below, readiness: evaluateCheckIn(profile, below, []) }],
    }));
    await store.start({ factory: fakeIndexedDB({ writeError: () => new DOMException('The operation failed.', 'QuotaExceededError') }), broadcast: null });
    expect(store.getState().status).toBe('unavailable');
    expect(store.getState().checkIns.map(c => c.date)).toContain(DAY);
    clock(13, 46);
    expect(storeGate('start')).toBe(false);
    expect((await store.addObservation({ kind: 'glucose', value: 140, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: iso(13, 46) })).ok).toBe(false);
    expect(store.getState().observations.some((o: Observation) => o.value === 140)).toBe(true);
    expect(storeGate('start')).toBe(false);
  });

  it('a Track reading still on its way releases nothing either (N-01 for logged readings)', async () => {
    const profile = createDefaultProfile(INSULIN);
    // Below this person's 90 mg/dL start level at 13:30: wait 15 minutes, then check again.
    await seed(profile, [ci({ glucose: { value: 85, unit: 'mg/dL', measuredAt: iso(13, 30), source: 'meter' } })]);
    clock(13, 46);
    pausedWalk();
    live!.resume();
    expect(status()).toBe('paused');

    db.control.hold();
    // Track's Quick Log: a meter reading of 140 at 13:46, 16 minutes on.
    const saving = store.addObservation({ kind: 'glucose', value: 140, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: iso(13, 46) });
    await Promise.resolve();
    expect(store.getState().observations.some((o: Observation) => o.value === 140)).toBe(true);
    live!.resume();
    expect(status()).toBe('paused');

    db.control.release();
    expect((await saving).ok).toBe(true);
    live!.resume();
    expect(status()).toBe('running');
  });
});
