/**
 * The live walk after "I feel low", driven through its real callers:
 * `LiveWalkScreen`, the live controller asking the store's own gate
 * (`storeGate`), `useGuided().reportSymptoms` and the real store over a fake
 * IndexedDB. Replaced are only what cannot run in node and decides nothing:
 * the router, the sensors and timers' host, and the vendored sheet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import type { LiveWalk } from '@/walk/live';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [router.params],
  useNavigate: () => router.navigate,
  useLocation: () => ({ pathname: '/walk/live', search: '', state: null, key: 'k0' }),
}));
vi.mock('@/components/ui/sheet', async () => {
  const { createElement: h, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? h(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => h('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => h('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => h('button', { type: 'button' }, children),
  };
});
/** The one live walk, as the browser builds it, minus the sensors: the store's gate decides. */
const walk = vi.hoisted(() => ({ live: undefined as LiveWalk | undefined, kept: new Map<string, string>() }));
vi.mock('@/walk/browser', async () => {
  const { createLiveWalk } = await import('@/walk/live');
  const { storeGate, watchClinical } = await import('@/walk/gate');
  return {
    liveWalk: () => (walk.live ??= createLiveWalk({
      mayRun: storeGate,
      watchClinical,
      now: () => Date.now(),
      later(fn, ms) {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      },
      storage: { getItem: k => walk.kept.get(k) ?? null, setItem: (k, v) => void walk.kept.set(k, v), removeItem: k => void walk.kept.delete(k) },
      visibility: { visible: () => true, subscribe: () => () => {} },
    })),
  };
});

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  // No #app root, so a sheet's inert background is a no-op, as it is before the app mounts.
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { default: LiveWalkScreen } = await import('./LiveWalkScreen');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { permission } = await import('@/engine/permission');
const { deviceGate } = await import('@/walk/gate');
const { newWalkId } = await import('@/walk/plan');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } } satisfies ProfileInput;
const DAY = '2026-10-09';
const iso = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0).toISOString();
const clock = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 9, h, m, 0));

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9, 5);
  local.clear();
  walk.kept.clear();
  walk.live = undefined;
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.navigate = vi.fn();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  walk.live?.detach();
  vi.useRealTimers();
});

const h = () => host!;
const today = () => store.getState().checkIns.find(c => c.date === DAY);
const status = () => walk.live?.getSnapshot()?.walk.status;
const answer = (p: UserProfile) => permission({ profile: p, checkIn: today()!, now: new Date(), recent: store.getState().checkIns }, 'walk');

/** Walking on a fresh 140, then "I feel low" at 09:10. */
async function feelingLow(p: UserProfile) {
  const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } };
  const rec: CheckInRecord = { ...morning, readiness: evaluateCheckIn(p, morning) };
  await store.update(prev => ({ ...prev, profile: p, checkIns: [rec] }));
  router.params = new URLSearchParams({ id: newWalkId(Date.now()) });
  host = render(createElement(LiveWalkScreen));
  await host.settle();
  expect(status()).toBe('running');
  clock(9, 10);
  await h().click(h().button('I feel low'));
  expect(today()?.news).toContain('lowSymptoms');
}

/** "Meter shows HI or LO?", in Quick Log's and the check-in's words, then the choice and Save. */
async function meterShows(shows: 'HI' | 'LO') {
  if (h().buttons('Meter shows HI or LO?').length) await h().click(h().button('Meter shows HI or LO?'));
  expect(h().text()).toMatch(/What the meter shows/);
  await h().click(h().button(shows, { exact: true }));
  expect(() => h().field('Glucose now')).toThrow();
  await h().click(h().button('Save this reading'));
}

describe('a meter showing LO or HI after "I feel low" on a walk is recorded as the check-in records it', () => {
  it('LO is a severe low: recorded as LO and timed, the 140 kept; the walk cannot carry on, only be finished', async () => {
    const p = createDefaultProfile(INSULIN);
    await feelingLow(p);
    await meterShows('LO');
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'LO', measuredAt: iso(9, 10), source: 'meter' });
    expect(today()?.glucose).toBeUndefined();
    expect(today()?.glucoseEarlier?.some(e => !('display' in e) && e.value === 140)).toBe(true);
    expect(answer(p)).toMatchObject({ allowed: false, disposition: 'today' });
    expect(answer(p).reasons.join(' ')).toMatch(/Your meter shows LO/);
    expect(deviceGate(() => store.getState())('restart')).toBe(false);
    expect(h().buttons('Resume', { exact: true })).toHaveLength(0);
    expect(h().buttons('Finish and save')).toHaveLength(1);
    walk.live!.resume();
    expect(status()).not.toBe('running');
  });

  it('HI: check again, as the check-in says; HI a second time: no exercise today', async () => {
    const p = createDefaultProfile(INSULIN);
    await feelingLow(p);
    await meterShows('HI');
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'HI', measuredAt: iso(9, 10) });
    expect(answer(p)).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(answer(p).reasons.join(' ')).toMatch(/Your meter says HI, higher than it can measure/);
    clock(9, 14);
    await meterShows('HI');
    expect(today()?.glucoseEarlier?.some(e => 'display' in e && e.display === 'HI' && e.measuredAt === iso(9, 10))).toBe(true);
    expect(answer(p)).toMatchObject({ allowed: false, disposition: 'today' });
    expect(answer(p).reasons.join(' ')).toMatch(/Your meter has read HI more than once/);
  });
});
