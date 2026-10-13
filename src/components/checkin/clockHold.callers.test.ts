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
import { createElement, useEffect } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import type { SymptomReport } from './pending';
import { render } from '@/test/host';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { reportSymptoms, resetPendingCheckInsForTests, saveCheckInRecord } = await import('./pending');
const { useGuided } = await import('@/hooks/useGuided');
const { acquiredIn } = await import('@/walk/consent');
const { buildCheckIn, formFromRecord } = await import('./form');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { permission, PERMISSION_TEXT } = await import('@/engine/permission');
const { deviceClinical } = await import('@/walk/gate');
const { CLOCK_REFUSAL } = await import('@/store/db');
const { CLOCK_RETRY_MS } = store;

const onInsulin = createDefaultProfile({
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});
const DAY = '2026-10-09';
const at = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0);
const reading = (h: number, m: number, value = 140) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m).toISOString(), source: 'meter' as const });
const day = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });

/** Whether the device refuses to store its settings, the clock's marker among them. */
let refuseSettings = false;
let fake = fakeIndexedDB();
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(9, 10));
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  refuseSettings = false;
  fake = fakeIndexedDB({ failWrite: (name, row) => (refuseSettings && name === 'settings' && row.key === 'settings' ? new DOMException('Full', 'QuotaExceededError') : undefined) });
  await store.start({ factory: fake, broadcast: null });
  const first = day({ glucose: reading(9, 0) });
  await store.update(prev => ({ ...prev, profile: onInsulin, checkIns: [{ ...first, readiness: evaluateCheckIn(onInsulin, first) }] }));
});
afterEach(() => vi.useRealTimers());

const deps = { profile: onInsulin, update: store.update };
const today = () => store.getState().checkIns.find(c => c.date === DAY)!;
/** Every movement, asked of what the device holds now, as every gate asks (`deviceClinical`). */
const held = () => {
  const all = [...deviceClinical(store.getState()).checkIns];
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

  it('a check-in resubmitted, or its reading retimed or corrected in its box, releases nothing; a new reading, typed into the cleared box, does (H6F-06, H6R-03, board D186)', async () => {
    await store.markClockChange([DAY]);
    vi.setSystemTime(at(9, 20));
    const form = () => formFromRecord(today(), onInsulin);
    // The same answers again.
    await saveCheckInRecord(buildCheckIn(form(), { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(held()).toEqual(ALL);
    // The 09:00 reading given the time it reads now, "09:18".
    await saveCheckInRecord(buildCheckIn({ ...form(), glucoseAt: at(9, 18).toISOString() }, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(today().glucose).toMatchObject({ value: 140, measuredAt: at(9, 18).toISOString() });
    expect(today().glucose?.gen ?? 0).toBe(0);
    expect(held()).toEqual(ALL);
    // Its number corrected where it stands: still that measurement.
    await saveCheckInRecord(buildCheckIn({ ...form(), glucose: '138' }, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(today().glucose?.value).toBe(138);
    expect(today().glucose?.gen ?? 0).toBe(0);
    expect(held()).toEqual(ALL);
    // A new reading: the box cleared and the number measured now typed in, as the sheet stamps it.
    const typed = { ...form(), glucose: '132', glucoseGen: store.acquisitionStamp(), glucoseAt: at(9, 20).toISOString() };
    await saveCheckInRecord(buildCheckIn(typed, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(today().glucose).toMatchObject({ value: 132, gen: 1 });
    expect(held()).toEqual(NONE);
    // That one retimed, or corrected where it stands, is still the reading taken since.
    vi.setSystemTime(at(9, 22));
    await saveCheckInRecord(buildCheckIn({ ...form(), glucoseAt: at(9, 21).toISOString() }, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    await saveCheckInRecord(buildCheckIn({ ...form(), glucose: '131' }, { date: DAY, profile: onInsulin, now: new Date(), previous: today() }), deps);
    expect(today().glucose).toMatchObject({ value: 131, gen: 1 });
    expect(held()).toEqual(NONE);
  });

  it('a reading reported during movement is stamped as it is given, through the shared path; the save itself stamps nothing (H6R-03, board D186)', async () => {
    const seen: { report?: (r: SymptomReport, at?: Date) => Promise<unknown> } = {};
    const Harness = () => {
      const g = useGuided();
      useEffect(() => { seen.report = g.reportSymptoms; });
      return null;
    };
    const host = render(createElement(Harness));
    await host.settle();
    await store.markClockChange([DAY]);
    await host.settle();
    await seen.report!({ glucose: { value: 118, unit: 'mg/dL', source: 'meter' } }, at(9, 12));
    expect(today().glucose).toMatchObject({ value: 118, gen: 1 });
    expect(held()).toEqual(NONE);
    // Given straight to the save, with no stamp: one from before, so it holds.
    await reportSymptoms({ glucose: { value: 116, unit: 'mg/dL', source: 'meter' } }, { ...deps, date: DAY }, at(9, 13));
    expect(today().glucose?.gen).toBeUndefined();
    expect(held()).toEqual(ALL);
    host.unmount();
  });

  it('Track’s reading from before, retimed to after the change, is refused and releases nothing; one acquired since, as Quick Log stamps it, does (H6R-03, board D186, D119)', async () => {
    const before = await store.addObservation({ kind: 'glucose', value: 128, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:05:00+05:30' });
    expect(before.ok && before.value.gen).toBeUndefined();
    await store.markClockChange([DAY]);
    // While the phone's clock change holds the device, no reading is changed: none's age can be known (D119, P8S-02).
    const moved = await store.editObservation(before.ok ? before.value.id : '', { at: '2026-10-09T09:15:00+05:30' });
    expect(!moved.ok && moved.failure.message).toBe(CLOCK_REFUSAL);
    const kept = store.getState().observations.find(o => before.ok && o.id === before.value.id);
    expect(kept && Date.parse(kept.at)).toBe(Date.parse('2026-10-09T09:05:00+05:30'));
    expect(kept?.gen).toBeUndefined();
    expect(held()).toEqual(ALL);
    // Stored with no stamp, the store adds none.
    const unstamped = await store.addObservation({ kind: 'glucose', value: 127, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:15:30+05:30' });
    expect(unstamped.ok && unstamped.value.gen).toBeUndefined();
    expect(held()).toEqual(ALL);
    const since = await store.addObservation(acquiredIn({ kind: 'glucose', value: 126, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:16:00+05:30' }, store.acquisitionStamp()));
    expect(since.ok && since.value.gen).toBe(1);
    expect(held()).toEqual(NONE);
  });

  it('Track’s readings saved together keep the stamps they were acquired with, and gain none as they are stored (H6R-03, board D186)', async () => {
    await store.markClockChange([DAY]);
    const both = await store.addObservations([
      acquiredIn({ kind: 'glucose' as const, value: 124, unit: 'mg/dL', scope: 'pointInTime' as const, source: 'manual' as const, at: '2026-10-09T09:16:00+05:30' }, store.acquisitionStamp()),
      { kind: 'steps', value: 900, scope: 'dayTotal', source: 'manual', at: '2026-10-09T09:16:00+05:30' },
      { kind: 'glucose', value: 122, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-09T09:15:00+05:30' },
    ]);
    expect(both.ok && both.value.map(o => o.gen)).toEqual([1, undefined, undefined]);
    expect(held()).toEqual(NONE);
  });

  it('holds every movement from the moment a change is seen, through a refused write, as the hubs and Home read it too (H6F-02, board D188)', async () => {
    const seen: { checkIn?: DailyCheckIn; checkIns?: DailyCheckIn[] } = {};
    const Harness = () => {
      const g = useGuided();
      useEffect(() => { seen.checkIn = g.checkIn; seen.checkIns = g.checkIns; });
      return null;
    };
    const host = render(createElement(Harness));
    await host.settle();
    /** As the hubs and Home ask it, through `useGuided`. */
    const shown = () => permission({ profile: onInsulin, checkIn: seen.checkIn as never, recent: seen.checkIns, now: new Date() }, 'walk').reasons.includes(PERMISSION_TEXT.clockChanged);
    expect(shown()).toBe(false);
    refuseSettings = true;
    void store.markClockChange([DAY]);
    // Held at once, before any write replies, and still once the write is refused: nothing rolls it back.
    expect(held()).toEqual(ALL);
    // Never shown as stored before it is: a reading acquired now is stamped by what is kept.
    expect(store.getState().settings.walk?.clock).toBeUndefined();
    expect(store.acquisitionStamp()).toBe(0);
    await host.settle();
    expect(store.getState().settings.walk?.clock).toBeUndefined();
    expect(held()).toEqual(ALL);
    expect(shown()).toBe(true);
    host.unmount();
  });

  it('writes a refused marker again until it is stored; nothing acquired meanwhile releases it (H6F-02, board D188)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(at(9, 10));
    refuseSettings = true;
    const marked = store.markClockChange([DAY]);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().settings.walk?.clock).toBeUndefined();
    // A reading acquired while the change waits to be kept is of the generation kept so far: it releases nothing.
    await saveCheckInRecord(day({ glucose: acquiredIn(reading(9, 12, 126), store.acquisitionStamp()) }), deps);
    expect(today().glucose?.gen).toBeUndefined();
    expect(held()).toEqual(ALL);
    // Still refused at the first retry; kept at a later one.
    await vi.advanceTimersByTimeAsync(CLOCK_RETRY_MS);
    expect(store.getState().settings.walk?.clock).toBeUndefined();
    expect(held()).toEqual(ALL);
    refuseSettings = false;
    await vi.advanceTimersByTimeAsync(CLOCK_RETRY_MS);
    expect((await marked).ok).toBe(true);
    // Stored, it holds as the device's own, and nothing else is waiting.
    expect(store.getState().settings.walk?.clock).toEqual({ generation: 1, days: [DAY] });
    expect(store.getState().clockHold).toEqual({ generation: 1, days: [DAY] });
    expect(held()).toEqual(ALL);
    // Only a reading acquired since then lets go.
    await saveCheckInRecord(day({ glucose: acquiredIn(reading(9, 13, 124), store.acquisitionStamp()) }), deps);
    expect(held()).toEqual(NONE);
  });

  it('with nowhere to store anything, holds a change for the session, as everything is, and writes it once (H6F-02)', async () => {
    store.resetForTests();
    await store.start({ factory: undefined, broadcast: null });
    const result = await store.markClockChange([DAY]);
    expect(result.ok).toBe(false);
    expect(store.getState().settings.walk?.clock).toEqual({ generation: 1, days: [DAY] });
    expect(store.getState().clockHold).toEqual({ generation: 1, days: [DAY] });
  });

  it('writes nothing into a store started afresh, as a test starts one (H6F-02)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    refuseSettings = true;
    void store.markClockChange([DAY]);
    await vi.advanceTimersByTimeAsync(0);
    store.resetForTests();
    refuseSettings = false;
    await store.start({ factory: fakeIndexedDB(), broadcast: null });
    await vi.advanceTimersByTimeAsync(CLOCK_RETRY_MS * 2);
    expect(store.getState().settings.walk?.clock).toBeUndefined();
  });

  it('each change moves the generation on, against the settings the write finds, and keeps this phone’s other walk answers', async () => {
    await store.setSettings({ walk: { saveRoutes: true, map: 'off' } });
    await Promise.all([store.markClockChange([DAY]), store.markClockChange([DAY, '2026-10-10'])]);
    expect(store.getState().settings.walk).toEqual({ saveRoutes: true, map: 'off', clock: { generation: 2, days: [DAY, '2026-10-10'] } });
  });
});
