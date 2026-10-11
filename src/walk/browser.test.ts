/**
 * The real ports, as `liveWalk()` builds them: wiring only (B-19, H6-02).
 * The store is the only thing replaced, so the gate is the production one.
 */
import { describe, expect, it, vi } from 'vitest';
import type { CheckInRecord } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn } from '@/engine/readiness';
import { toDateString } from '@/lib/utils';
import { walkSettings, withClockChange } from './consent';

const NOW = new Date();
const TODAY = toDateString(NOW);
const reading = { value: 140, unit: 'mg/dL' as const, measuredAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(), source: 'meter' as const };
const profile = createDefaultProfile({
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});
const day = { date: TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7' as const, energy: 4 as const, glucose: reading };
const state = vi.hoisted(() => ({ value: undefined as unknown, listeners: new Set<() => void>(), marked: [] as (readonly string[])[] }));
vi.mock('@/store/useStore', async importOriginal => {
  const real = await importOriginal<typeof import('@/store/useStore')>();
  const { walkSettings: walkOf, withClockChange: changed } = await import('./consent');
  return {
    ...real,
    getState: () => state.value as ReturnType<typeof real.getState>,
    subscribe: (l: () => void) => { state.listeners.add(l); return () => void state.listeners.delete(l); },
    // The device's own change, as the store's transaction makes it.
    markClockChange: (days: readonly string[]) => {
      state.marked.push(days);
      const was = state.value as { settings: { walk?: ReturnType<typeof walkOf> } };
      state.value = { ...was, settings: { ...was.settings, walk: changed(walkOf(was.settings), days) } };
      for (const l of [...state.listeners]) l();
      return Promise.resolve({ ok: true });
    },
  };
});
state.value = {
  status: 'ready', profile, settings: { currentWeight: 80 }, observations: [],
  checkIns: [{ ...day, readiness: evaluateCheckIn(profile, day) } satisfies CheckInRecord],
};

// What attaching a walk touches of the page: no sensors, a visible document.
Object.assign(globalThis, {
  window: globalThis, addEventListener() {}, removeEventListener() {},
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
});
const { browserPorts, liveWalk } = await import('./browser');
const { cachedJournal, journalPort } = await import('./journalPort');

describe('the browser’s live walk ports (B-19)', () => {
  it('tell the device of a change to the clock, then ask the gate of the device: held until a reading taken since (H6R-02)', () => {
    const ports = browserPorts();
    const was = state.value;
    expect(ports.mayRun('live')).toBe(true);
    ports.clockChanged!([TODAY]);
    expect(state.marked).toEqual([[TODAY]]);
    for (const intent of ['start', 'restart', 'live'] as const) expect(ports.mayRun(intent), intent).toBe(false);
    // A reading taken here since, in the phone's new clock generation: on again.
    const since = { ...day, glucose: { ...reading, measuredAt: new Date().toISOString(), gen: 1 }, glucoseEarlier: [reading] };
    state.value = { ...(state.value as object), checkIns: [{ ...since, readiness: evaluateCheckIn(profile, since) }] };
    expect(ports.mayRun('restart')).toBe(true);
    expect(walkSettings((state.value as { settings: object }).settings).clock).toEqual(withClockChange(walkSettings({}), [TODAY]).clock);
    state.value = was;
  });

  it('ask this phone’s own route consent, as it is now, at each journal write (H6-04)', () => {
    const ports = browserPorts();
    const was = state.value as { settings: object };
    expect(ports.keepsRoutes!()).toBe(false);
    for (const [saveRoutes, keeps] of [['unasked', false], [false, false], [true, true]] as const) {
      state.value = { ...was, settings: { ...was.settings, walk: { saveRoutes, map: 'off' } } };
      expect(ports.keepsRoutes!()).toBe(keeps);
    }
    state.value = was;
  });
});

describe('“Erase all routes”, heard by this tab’s live walk (B-05)', () => {
  it('forgets the route it is recording, and this page’s copies, on an erase made after it read the store', async () => {
    const was = state.value as { settings: { walk?: object } };
    const heard = () => { for (const l of [...state.listeners]) l(); };
    // Made while the store is still being read: nothing is known yet, so nothing counts as news.
    state.value = { ...was, status: 'loading', settings: { ...was.settings, walk: { saveRoutes: true, map: 'off' } } };
    const live = liveWalk();
    expect(live.attach({ id: 'mgh3k2x1-9z8y7x6w', plan: { kind: 'walk', gps: true, steps: false, keepRoute: true } })).toBe('created');
    // The store arrives holding an erase from long ago: no news to a walk begun since.
    state.value = { ...was, settings: { ...was.settings, walk: { saveRoutes: true, map: 'off', routesErasedAt: 1 } } };
    heard();
    expect(live.getSnapshot()!.walk.plan.keepRoute).toBe(true);
    // Another walk's copy in this page, with its route.
    const line = { start: 1, end: 2, coords: [[1, 1], [1, 1.0001]] as [number, number][], ms: [0, 1] };
    await journalPort().checkpoint({ ...cachedJournal('mgh3k2x1-9z8y7x6w')!, id: 'mgh3k2x1-0a0a0a0a', walk: { ...cachedJournal('mgh3k2x1-9z8y7x6w')!.walk, id: 'mgh3k2x1-0a0a0a0a' }, route: [line] });
    // Then an erase, here or in another tab.
    state.value = { ...was, settings: { ...was.settings, walk: { saveRoutes: true, map: 'off', routesErasedAt: Date.now() } } };
    heard();
    expect(live.getSnapshot()!.walk.plan.keepRoute).toBe(false);
    expect(cachedJournal('mgh3k2x1-9z8y7x6w')?.route).toBeUndefined();
    expect(cachedJournal('mgh3k2x1-0a0a0a0a')?.route).toBeUndefined();
    live.detach();
    state.value = was;
  });
});
