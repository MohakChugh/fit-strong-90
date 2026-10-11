/**
 * The page's own watch on the phone's clock, with no walk recording (P8S-02,
 * board D185): a change seen at a check, while in view, on hiding, or, set
 * back, on coming back, is marked once on the device; normal drift and a
 * phone that slept are not. Then the real store and gates: the hold it sets
 * lets go only for a reading taken since.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { CLOCK_CHECK_MS, watchClock, type ClockWatchPorts } from './clockWatch';
import { CLOCK_JUMP_MS } from './clock';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { effectiveCheckIns, saveCheckInRecord, resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { permission, PERMISSION_TEXT } = await import('@/engine/permission');
const { clockGeneration } = await import('./consent');

/** A page: its two clocks, whether it is in view, its minute's check, and what it marks. */
function page(start = new Date(2026, 9, 9, 9, 0).getTime()) {
  let wall = start;
  let mono = 0;
  let visible = true;
  let ready = true;
  let generation = 0;
  let tick: (() => void) | undefined;
  let heard: ((visible: boolean) => void) | undefined;
  const marked: (readonly string[])[] = [];
  const ports: ClockWatchPorts = {
    now: () => wall,
    monotonic: () => mono,
    visible: () => visible,
    ready: () => ready,
    generation: () => generation,
    every: (fn, ms) => { expect(ms).toBe(CLOCK_CHECK_MS); tick = fn; return () => { tick = undefined; }; },
    onVisibility: fn => { heard = fn; return () => { heard = undefined; }; },
    changed: days => { marked.push(days); generation += 1; },
  };
  return {
    ports, marked,
    /** Time passing as it does: both clocks together. */
    pass(ms: number) { wall += ms; mono += ms; },
    /** The phone's clock moved by `ms`; the monotonic one doesn't. */
    setClock(ms: number) { wall += ms; },
    /** Asleep: on an iPhone the monotonic clock stands still. */
    sleep(ms: number) { wall += ms; },
    minute() { wall += CLOCK_CHECK_MS; mono += CLOCK_CHECK_MS; tick?.(); },
    hide() { visible = false; heard?.(false); },
    show() { visible = true; heard?.(true); },
    loading(on: boolean) { ready = !on; },
    walkMarked() { generation += 1; },
  };
}

describe('the page’s own watch on the phone’s clock (P8S-02, board D185)', () => {
  it('marks a clock set forward or back between two checks while in view, once', () => {
    const p = page();
    const stop = watchClock(p.ports);
    p.pass(10_000);
    p.setClock(-3_600_000);
    p.minute();
    expect(p.marked).toEqual([['2026-10-08', '2026-10-09', '2026-10-10']]);
    p.setClock(2 * 3_600_000);
    p.minute();
    expect(p.marked).toHaveLength(2);
    // Nothing changed since: nothing more.
    p.minute();
    expect(p.marked).toHaveLength(2);
    stop();
  });

  it('marks nothing for the small corrections a phone makes to its clock', () => {
    const p = page();
    watchClock(p.ports);
    for (let i = 0; i < 10; i++) {
      p.setClock(i % 2 ? CLOCK_JUMP_MS - 1000 : -(CLOCK_JUMP_MS - 1000));
      p.minute();
    }
    expect(p.marked).toEqual([]);
  });

  it('marks a clock set while the page was in view when it is hidden, and one set back while it was out of view when it comes back', () => {
    const p = page();
    watchClock(p.ports);
    p.pass(20_000);
    p.setClock(-600_000);
    p.hide();
    expect(p.marked).toHaveLength(1);
    // Out of view, the person sets it back again in Settings.
    p.pass(30_000);
    p.setClock(-900_000);
    p.show();
    expect(p.marked).toHaveLength(2);
  });

  it('takes no phone that slept, nor one set forward while out of view, for a change', () => {
    const p = page();
    watchClock(p.ports);
    p.hide();
    p.sleep(3 * 3_600_000);
    // A minute's check that runs while out of view looks at nothing.
    p.minute();
    p.show();
    p.hide();
    p.setClock(3_600_000);
    p.show();
    expect(p.marked).toEqual([]);
  });

  it('keeps looking from before the record was read, so a change made meanwhile is still seen', () => {
    const p = page();
    p.loading(true);
    watchClock(p.ports);
    p.setClock(-3_600_000);
    p.minute();
    expect(p.marked).toEqual([]);
    p.loading(false);
    p.minute();
    expect(p.marked).toHaveLength(1);
  });

  it('marks nothing a walk recording now has already marked', () => {
    const p = page();
    watchClock(p.ports);
    p.setClock(-3_600_000);
    p.walkMarked();
    p.minute();
    expect(p.marked).toEqual([]);
  });

  it('stops looking when stopped', () => {
    const p = page();
    const stop = watchClock(p.ports);
    stop();
    p.setClock(-3_600_000);
    p.minute();
    p.show();
    expect(p.marked).toEqual([]);
  });
});

describe('a change the page saw, held by the device until a reading taken since (P8S-02, H6R-02)', () => {
  const onInsulin = createDefaultProfile({
    health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
  });
  const DAY = '2026-10-09';
  const at = (h: number, m: number) => new Date(2026, 9, 9, h, m);
  const day = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
  const reading = (h: number, m: number, value = 140) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m).toISOString(), source: 'meter' as const });
  const held = () => {
    const s = store.getState();
    const all = effectiveCheckIns(s.checkIns, onInsulin, s.observations, s.settings.walk?.clock);
    return permission({ profile: onInsulin, checkIn: all.find(c => c.date === DAY), recent: all, now: new Date() }, 'walk').reasons.includes(PERMISSION_TEXT.clockChanged);
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(9, 10));
    store.resetForTests();
    resetPendingCheckInsForTests();
    await store.start({ factory: fakeIndexedDB(), broadcast: null });
    const first = day({ glucose: reading(9, 0) });
    await store.update(prev => ({ ...prev, profile: onInsulin, checkIns: [{ ...first, readiness: evaluateCheckIn(onInsulin, first) }] }));
  });
  afterEach(() => vi.useRealTimers());

  it('sets the hold with no walk running, and only a new reading lets go', async () => {
    const p = page(at(9, 10).getTime());
    watchClock({ ...p.ports, generation: () => clockGeneration(store.getState().settings), changed: days => void store.markClockChange(days) });
    expect(held()).toBe(false);
    // Set back 20 minutes with the app in view: the 09:00 reading now reads 9:00 at "08:50".
    p.setClock(-20 * 60_000);
    p.minute();
    await vi.waitFor(() => expect(store.getState().settings.walk?.clock?.generation).toBe(1));
    expect(held()).toBe(true);
    // The same reading saved again releases nothing; one taken since does.
    await saveCheckInRecord(day({ glucose: reading(9, 0) }), { profile: onInsulin, update: store.update });
    expect(held()).toBe(true);
    await saveCheckInRecord(day({ glucose: reading(9, 12, 128) }), { profile: onInsulin, update: store.update });
    expect(held()).toBe(false);
  });
});
