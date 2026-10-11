/**
 * B-19 after a change to the phone's clock, held by the device (H6R-02,
 * H6R-03, board D174), driven through the real callers: the store's
 * `markClockChange`, the shared check-in and report paths, Track's own
 * readings and edits, and the gates' effective records, over a fake
 * IndexedDB. Only a reading taken on this phone since the change, of its new
 * clock generation, lets someone who can go low move again: never one
 * resubmitted, retimed or corrected, whatever its time says.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { effectiveCheckIns, reportSymptoms, resetPendingCheckInsForTests, saveCheckInRecord } = await import('./pending');
const { buildCheckIn, formFromRecord } = await import('./form');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { permission, PERMISSION_TEXT } = await import('@/engine/permission');

const onInsulin = createDefaultProfile({
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});
const DAY = '2026-10-09';
const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0);
const reading = (h: number, m: number, value = 140) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m).toISOString(), source: 'meter' as const });
const day = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });

let fake = fakeIndexedDB();
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(9, 10));
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
  const first = day({ glucose: reading(9, 0) });
  await store.update(prev => ({ ...prev, profile: onInsulin, checkIns: [{ ...first, readiness: evaluateCheckIn(onInsulin, first) }] }));
});
afterEach(() => vi.useRealTimers());

const deps = { profile: onInsulin, update: store.update };
const today = () => store.getState().checkIns.find(c => c.date === DAY)!;
/** Every movement, asked of what the device holds now, as every gate asks. */
const held = () => {
  const s = store.getState();
  const all = effectiveCheckIns(s.checkIns, onInsulin, s.observations, s.settings.walk?.clock);
  return (['guided', 'stretch', 'walk'] as const).map(mode =>
    permission({ profile: onInsulin, checkIn: all.find(c => c.date === DAY), recent: all, now: new Date() }, mode).reasons.includes(PERMISSION_TEXT.clockChanged));
};
const NONE = [false, false, false];
const ALL = [true, true, true];

describe('a change to the phone’s clock, held by the device until a reading taken since (H6R-02, H6R-03, board D174)', () => {
  it('holds every movement, and outlasts the walk that saw it and a restart of the app', async () => {
    expect(held()).toEqual(NONE);
    await store.markClockChange([DAY]);
    expect(held()).toEqual(ALL);
    // The app closed and opened again: the change is the device's, kept with its settings.
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().settings.walk?.clock).toEqual({ generation: 1, days: [DAY] });
    expect(held()).toEqual(ALL);
  });

  it('a check-in resubmitted, or its reading retimed, releases nothing; a new reading, stamped as it is saved, does', async () => {
    await store.markClockChange([DAY]);
    vi.setSystemTime(at(9, 20));
    const form = () => formFromRecord(today(), onInsulin);
    // The same answers again.
    await saveCheckInRecord(buildCheckIn(form(), { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(held()).toEqual(ALL);
    // The 09:00 reading given the time it reads now, "09:18".
    await saveCheckInRecord(buildCheckIn({ ...form(), glucoseAt: at(9, 18).toISOString() }, { date: DAY, profile: onInsulin, now: new Date(), previous: today(), timeChosen: true }), deps);
    expect(today().glucose).toMatchObject({ value: 140, measuredAt: at(9, 18).toISOString(), gen: 0 });
    expect(held()).toEqual(ALL);
    // A new reading, typed now.
    await saveCheckInRecord(buildCheckIn({ ...form(), glucose: '132', glucoseAt: at(9, 20).toISOString() }, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(today().glucose).toMatchObject({ value: 132, gen: 1 });
    expect(held()).toEqual(NONE);
  });

  it('a reading reported during movement is one taken now, so it is stamped too', async () => {
    await store.markClockChange([DAY]);
    await reportSymptoms({ glucose: { value: 118, unit: 'mg/dL', source: 'meter' } }, { ...deps, date: DAY }, at(9, 12));
    expect(today().glucose).toMatchObject({ value: 118, gen: 1 });
    expect(held()).toEqual(NONE);
  });

  it('Track’s reading from before, corrected to a time after the change, releases nothing; one recorded since does', async () => {
    const before = await store.addObservation({ kind: 'glucose', value: 128, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:05:00+05:30' });
    expect(before.ok && before.value.gen).toBeUndefined();
    await store.markClockChange([DAY]);
    const moved = await store.editObservation(before.ok ? before.value.id : '', { at: '2026-10-09T09:15:00+05:30' });
    expect(moved.ok && moved.value.gen).toBeUndefined();
    expect(held()).toEqual(ALL);
    const since = await store.addObservation({ kind: 'glucose', value: 126, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:16:00+05:30' });
    expect(since.ok && since.value.gen).toBe(1);
    expect(held()).toEqual(NONE);
  });

  it('Track’s readings saved together are stamped too, the glucose only', async () => {
    await store.markClockChange([DAY]);
    const both = await store.addObservations([
      { kind: 'glucose', value: 124, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:16:00+05:30' },
      { kind: 'steps', value: 900, scope: 'dayTotal', source: 'manual', at: '2026-10-09T09:16:00+05:30' },
    ]);
    expect(both.ok && both.value.map(o => o.gen)).toEqual([1, undefined]);
    expect(held()).toEqual(NONE);
  });

  it('each change moves the generation on, against the settings the write finds, and keeps this phone’s other walk answers', async () => {
    await store.setSettings({ walk: { saveRoutes: true, map: 'off' } });
    await Promise.all([store.markClockChange([DAY]), store.markClockChange([DAY, '2026-10-10'])]);
    expect(store.getState().settings.walk).toEqual({ saveRoutes: true, map: 'off', clock: { generation: 2, days: [DAY, '2026-10-10'] } });
  });
});
