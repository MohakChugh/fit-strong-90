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
import { measuredStamp } from '@/health/observation';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useSearchParams: () => [router.params],
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: '/walk/live', search: '', state: null, key: 'k0' }),
    Link: ({ to, children }: { to: string; children?: ReactNode }) => h('a', { href: `#${to}` }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement: h, createContext, useContext } = await import('react');
  // Close closes, as the vendored sheet's does: through the sheet's own `onOpenChange`.
  const Closing = createContext<(open: boolean) => void>(() => {});
  return {
    Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children?: ReactNode }) =>
      (open ? h(Closing.Provider, { value: onOpenChange }, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => h('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => h('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => {
      const close = useContext(Closing);
      return h('button', { type: 'button', onClick: () => close(false) }, children);
    },
  };
});
/** The one live walk, as the browser builds it, minus the sensors: the store's gate decides. */
const walk = vi.hoisted(() => ({ live: undefined as LiveWalk | undefined, kept: new Map<string, string>() }));
vi.mock('@/walk/browser', async () => {
  const { createLiveWalk } = await import('@/walk/live');
  const { storeGate, watchClinical } = await import('@/walk/gate');
  const { markClockChange } = await import('@/store/useStore');
  return {
    liveWalk: () => (walk.live ??= createLiveWalk({
      mayRun: intent => storeGate(intent),
      clockChanged: days => void markClockChange(days),
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
const { startedHref } = await import('@/walk/started');
const { statusOn } = await import('@/health/status');
const { NEWS_LABEL } = await import('@/components/checkin/copy');
/** A walk the shared start flow has just started, as the live screen's address: how every new walk arrives (H6-04). */
const startedParams = () => new URLSearchParams(startedHref({ kind: 'walk', gps: false, steps: false }).split('?')[1]);

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } } satisfies ProfileInput;
const DAY = '2026-10-09';
const iso = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0).toISOString();
// A meter's HI or LO is kept in this phone's offset, written out (H3-01): the same instant as `iso`.
const stamped = (h: number, m = 0) => measuredStamp(new Date(2026, 9, 9, h, m, 0));
const clock = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 9, h, m, 0));

let host: Host | undefined;
let db = fakeIndexedDB();
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9, 5);
  local.clear();
  walk.kept.clear();
  walk.live = undefined;
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.navigate = vi.fn();
  db = fakeIndexedDB();
  await store.start({ factory: db, broadcast: null });
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
  await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [rec] }));
  router.params = startedParams();
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
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'LO', measuredAt: stamped(9, 10), source: 'meter' });
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
    expect(today()?.glucoseDisplay).toMatchObject({ display: 'HI', measuredAt: stamped(9, 10) });
    expect(answer(p)).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(answer(p).reasons.join(' ')).toMatch(/Your meter says HI, higher than it can measure/);
    clock(9, 14);
    await meterShows('HI');
    expect(today()?.glucoseEarlier?.some(e => 'display' in e && e.display === 'HI' && e.measuredAt === stamped(9, 10))).toBe(true);
    expect(answer(p)).toMatchObject({ allowed: false, disposition: 'today' });
    expect(answer(p).reasons.join(' ')).toMatch(/Your meter has read HI more than once/);
  });
});

describe('"I need to stop", closed without an answer (journey §4.4, H6-01)', () => {
  const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });

  /** Walking on a normal check-in, with nobody on insulin: only the stop can hold this walk. */
  async function walking() {
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    expect(status()).toBe('running');
  }

  /** Resume however the screen offers it, and the controller's own Resume too: neither may move a held walk. */
  async function tryToResume() {
    if (h().buttons('Resume', { exact: true }).length) await h().click(h().button('Resume', { exact: true }));
    walk.live!.resume();
    await h().settle();
  }

  it('saves the stop at the tap; closing the guidance keeps it, and Resume waits for an answer', async () => {
    await walking();
    clock(9, 10);
    await h().click(h().button('I need to stop'));
    expect(status()).toBe('paused');
    expect(h().text()).toMatch(/What’s happening\?/);
    // The stop is in today's record at once, the one every gate reads.
    expect(today()?.news).toContain('stopped');

    await h().click(h().button('Close', { exact: true }));
    expect(h().text()).not.toMatch(/What’s happening\?/);
    expect(today()?.news).toContain('stopped');
    await tryToResume();
    expect(status()).toBe('paused');
    expect(deviceGate(() => store.getState())('restart')).toBe(false);
    expect(h().text()).toMatch(/You stopped and haven’t said what happened yet/);

    // The engine's release: an answer. "Just need a rest" is one, and then Resume carries on.
    await h().click(h().button('Say what happened'));
    await h().click(h().button('Just need a rest'));
    expect(today()?.news ?? []).not.toContain('stopped');
    await tryToResume();
    expect(status()).toBe('running');
  });

  it('the leg questions answer the stop when they are saved', async () => {
    await walking();
    await h().click(h().button('I need to stop'));
    await h().click(h().field(/a leg getting weaker/));
    await h().click(h().button('Save leg symptoms'));
    expect(today()?.news).not.toContain('stopped');
    expect(today()?.back).toMatchObject({ newWeakness: true });
    await tryToResume();
    expect(status()).toBe('paused');
  });

  it('a stop answer answers the stop, and holds for what it says', async () => {
    await walking();
    await h().click(h().button('I need to stop'));
    await h().click(h().button(/^Dizzy or faint/));
    expect(today()?.news).toContain('dizzy');
    expect(today()?.news).not.toContain('stopped');
    await tryToResume();
    expect(status()).toBe('paused');
    expect(answer(p).reasons.join(' ')).toMatch(/Dizzy or faint/);
    expect(answer(p).reasons.join(' ')).not.toMatch(/haven’t said what happened/);
  });
});

describe('Resume asks the status first, as the hubs’ Continue does (H2-01, journey §4.8)', () => {
  const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });

  it('stays paused while Unwell, says why in the hubs’ words, and carries on once the status is back to normal', async () => {
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    expect(status()).toBe('running');
    await h().click(h().button('Pause', { exact: true }));
    expect(status()).toBe('paused');
    // Off the walk screen, the person says they're unwell today.
    await store.setSettings({ statusPeriods: [{ kind: 'unwell', from: DAY }] });
    await h().settle();
    expect(h().text()).toMatch(/A walk isn’t carried on while you’re unwell\./);
    expect(h().buttons('Change status', { exact: true })).toHaveLength(1);
    expect(h().buttons('Check in', { exact: true })).toHaveLength(0);
    if (h().buttons('Resume', { exact: true }).length) await h().click(h().button('Resume', { exact: true }));
    walk.live!.resume();
    await h().settle();
    expect(status()).toBe('paused');
    // Back to normal, from the status sheet the hold offers: Resume carries on.
    await h().click(h().button('Change status', { exact: true }));
    await h().click(h().button(/^Normal/));
    await h().click(h().button('Back to normal', { exact: true }));
    await h().settle();
    expect(statusOn(store.getState().settings.statusPeriods, DAY)).toBe('normal');
    await h().click(h().button('Resume', { exact: true }));
    expect(status()).toBe('running');
  });
});

describe('"I feel low" for anyone who can go low, under any hold but an emergency (K6R-01)', () => {
  /** Walking on a fresh 140, with insulin. */
  async function walkingOnInsulin() {
    const p = createDefaultProfile(INSULIN);
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    expect(status()).toBe('running');
    return p;
  }

  it('stays on the walk screen once "I need to stop" holds it', async () => {
    await walkingOnInsulin();
    await h().click(h().button('I need to stop'));
    await h().click(h().button('Close', { exact: true }));
    expect(h().text()).toMatch(/You stopped and haven’t said what happened yet/);
    expect(h().buttons('I feel low', { exact: true })).toHaveLength(1);
    // Beside "I need to stop", as before the hold.
    const low = h().button('I feel low', { exact: true });
    const row = h().all().find(n => n.children.includes(low))!;
    expect(String(row.props.className)).toContain('min-[360px]:grid-cols-2');
  });

  it('is the stop question’s first answer, and answers the stop through the low path', async () => {
    await walkingOnInsulin();
    clock(9, 10);
    await h().click(h().button('I need to stop'));
    const dialog = h().all().find(n => n.props.role === 'dialog')!;
    const first = dialog && JSON.stringify(dialog).indexOf('I feel low');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(JSON.stringify(dialog).indexOf('Dizzy or faint'));
    // The sheet's own row: the screen behind it is inert while the sheet is open.
    const inside: HostNode[] = [];
    const collect = (n: HostNode) => { for (const c of n.children) if (typeof c !== 'string') { inside.push(c); collect(c); } };
    collect(dialog);
    const row = h().buttons('I feel low', { exact: true }).find(b => inside.includes(b))!;
    expect(row).toBeDefined();
    await h().click(row);
    await h().settle();
    expect(today()?.news).toContain('lowSymptoms');
    expect(today()?.news).not.toContain('stopped');
    expect(h().text()).not.toMatch(/You stopped and haven’t said what happened yet/);
    // What follows is the low's own guidance, as "I feel low" on the walk gives it.
    expect(h().text()).toMatch(/Check your glucose now|What the meter shows|Glucose now/);
  });

  it('goes for an emergency, which only Finish and save follows', async () => {
    await walkingOnInsulin();
    await h().click(h().button('I need to stop'));
    await h().click(h().button(/^Chest pain/));
    await h().settle();
    expect(h().buttons('I feel low', { exact: true })).toHaveLength(0);
  });
});

describe('the stop question waits for its answer to save, and keeps it when it doesn’t (H6R-11)', () => {
  const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });
  async function stopped() {
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    await h().click(h().button('I need to stop'));
    expect(today()?.news).toContain('stopped');
  }
  const refuse = () => db.control.setWriteError(() => new DOMException('The device is full.', 'QuotaExceededError'));

  it('stays open on a refused "Just need a rest", says so, and Try again saves it and closes', async () => {
    await stopped();
    refuse();
    await h().click(h().button('Just need a rest'));
    await h().settle();
    expect(h().text()).toMatch(/What’s happening\?/);
    expect(h().text()).toMatch(/didn’t save/);
    db.control.setWriteError(undefined);
    await h().click(h().button('Try again', { exact: true }));
    await h().settle();
    expect(h().text()).not.toMatch(/What’s happening\?/);
    expect(store.getState().checkIns.find(c => c.date === DAY)?.news ?? []).not.toContain('stopped');
  });

  it('can’t be closed, nor the walk ended from it, while an answer is still being stored: the answer, and its Try again, stay until the device has said (H6R-11, board D213)', async () => {
    await stopped();
    db.control.hold();
    await h().click(h().button('Just need a rest'));
    // Closed by its own Close, or a swipe, it stays.
    await h().click(h().buttons('Close', { exact: true }).at(-1)!);
    expect(h().text()).toMatch(/What’s happening\?/);
    expect(h().button('End walk').props.disabled).toBe(true);
    db.control.release();
    await h().settle();
    expect(h().text()).not.toMatch(/What’s happening\?/);
    expect(store.getState().checkIns.find(c => c.date === DAY)?.news ?? []).not.toContain('stopped');
  });

  it('keeps "Check your glucose now" open, its Close waiting, while "I feel low" is stored (H6R-11, board D213)', async () => {
    const insulin = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter' } });
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: new Date().toISOString(), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: insulin, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(insulin, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    await h().click(h().button('I need to stop'));
    await h().click(h().button(NEWS_LABEL.dizzy, { exact: true }));
    await h().settle();
    expect(h().text()).toMatch(/Check your glucose now/);
    db.control.hold();
    await h().click(h().buttons('I feel low', { exact: true }).at(-1)!);
    // Its own Close waits; the sheet's, or a swipe, closes nothing.
    expect(h().buttons('Close', { exact: true }).filter(b => b.props.disabled === true)).toHaveLength(1);
    await h().click(h().buttons('Close', { exact: true }).find(b => !b.props.disabled)!);
    expect(h().text()).toMatch(/Check your glucose now/);
    db.control.release();
    await h().settle();
    expect(h().text()).not.toMatch(/Sit down somewhere safe/);
  });

  it('keeps the leg answers given when saving them is refused', async () => {
    await stopped();
    await h().click(h().field(/a leg getting weaker/));
    refuse();
    await h().click(h().button('Save leg symptoms'));
    await h().settle();
    expect(h().text()).toMatch(/didn’t save/);
    expect(h().field(/a leg getting weaker/).props.checked).toBe(true);
    db.control.setWriteError(undefined);
    await h().click(h().button('Try again', { exact: true }));
    await h().settle();
    expect(store.getState().checkIns.find(c => c.date === DAY)?.back).toMatchObject({ newWeakness: true });
  });
});

describe('an unanswered stop while Away, Unwell or in a flare-up (K6R-02)', () => {
  it('offers "Say what happened" first, not "Change status"', async () => {
    const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    await h().click(h().button('I need to stop'));
    await h().click(h().button('Close', { exact: true }));
    await store.setSettings({ statusPeriods: [{ kind: 'unwell', from: DAY }] });
    await h().settle();
    expect(h().text()).toMatch(/You stopped and haven’t said what happened yet/);
    expect(h().buttons('Say what happened', { exact: true })).toHaveLength(1);
    expect(h().buttons('Change status', { exact: true })).toHaveLength(0);
  });
});

describe('the walking time while paused (M13)', () => {
  it('dims the time and leaves its label at full contrast', async () => {
    const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    await h().click(h().button('Pause', { exact: true }));
    const classes = (n: { props: Record<string, unknown> }) => String(n.props.className ?? '').split(/\s+/);
    const timer = h().all().find(n => n.props.role === 'timer')!;
    const inside: typeof timer[] = [];
    const walkIn = (n: typeof timer) => { for (const c of n.children) if (typeof c !== 'string') { inside.push(c); walkIn(c); } };
    walkIn(timer);
    expect(classes(timer)).not.toContain('opacity-60');
    const dimmed = inside.filter(n => classes(n).includes('opacity-60'));
    expect(dimmed).toHaveLength(1);
    expect(JSON.stringify(dimmed[0].children)).toContain('0:00');
    expect(JSON.stringify(dimmed[0].children)).not.toContain('Walking time');
  });
});

describe('a walk’s address is a choice, never authorisation (H6-04, KH-12)', () => {
  const p = createDefaultProfile({ health: { ...known, diabetes: 'none' } });
  async function checkedIn(walkSettings?: { saveRoutes: boolean | 'unasked'; map: 'on' | 'off' | 'unasked' }) {
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
    await store.update(prev => ({
      ...prev, profile: p, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }],
      settings: { ...prev.settings, onboardingComplete: true, ...(walkSettings ? { walk: walkSettings } : {}) },
    }));
  }

  it('sends an address the start flow didn’t make to the Walk hub, with its meal, and starts nothing', async () => {
    await checkedIn();
    router.params = new URLSearchParams({ id: newWalkId(Date.now()), gps: '1', route: '1', meal: 'lunch', mealAt: String(Date.now() - 10 * 60_000) });
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    expect(status()).toBeUndefined();
    expect(walk.kept.size).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith('/hub/walk?meal=lunch', { replace: true });
  });

  for (const consent of [false, 'unasked'] as const) {
    it(`keeps no route on this phone’s ${consent === false ? 'No' : 'unasked'}, whatever the address says`, async () => {
      await checkedIn({ saveRoutes: consent, map: 'off' });
      const href = startedHref({ kind: 'walk', gps: true, steps: false, keepRoute: true });
      router.params = new URLSearchParams(href.split('?')[1]);
      expect(router.params.get('route')).toBe('1');
      host = render(createElement(LiveWalkScreen));
      await host.settle();
      expect(status()).toBe('running');
      expect(walk.live!.getSnapshot()!.walk.plan.keepRoute).toBeUndefined();
    });
  }

  it('starts the walk the start flow made, once, keeping its route on this phone’s yes', async () => {
    await checkedIn({ saveRoutes: true, map: 'off' });
    const href = startedHref({ kind: 'walk', gps: true, steps: false });
    router.params = new URLSearchParams(href.split('?')[1]);
    host = render(createElement(LiveWalkScreen));
    await host.settle();
    expect(status()).toBe('running');
    expect(walk.live!.getSnapshot()!.walk.plan.keepRoute).toBe(true);
  });
});

describe('F-walk-03: a low reading the device refused stays on the walk, to try again as it was given (journey §4.5)', () => {
  it('refused: the number, its answers and its time kept with Try again; tried again and stored, the same reading, then the box clears', async () => {
    const p = createDefaultProfile(INSULIN);
    await feelingLow(p);
    db.control.setWriteError(() => new DOMException('The operation failed.', 'QuotaExceededError'));
    await h().change(h().field('Glucose now'), { value: '65' });
    await h().click(h().field(/Someone else had to help me treat this low/));
    await h().click(h().button('Save this reading'));
    expect(h().field('Glucose now').props.value).toBe('65');
    expect(h().field(/Someone else had to help me treat this low/).props.checked).toBe(true);
    expect(h().buttons('Try again', { exact: true })).toHaveLength(1);
    expect(h().text()).toMatch(/couldn’t be saved/);
    db.control.setWriteError(undefined);
    clock(9, 12);
    await h().click(h().button('Try again', { exact: true }));
    expect(today()?.glucose).toMatchObject({ value: 65, measuredAt: iso(9, 10) });
    expect(today()?.news).toContain('lowSevere');
    expect(h().field('Glucose now').props.value).toBe('');
    expect(h().buttons('Try again', { exact: true })).toHaveLength(0);
  });
});

const { UrgentProvider } = await import('@/screens/home/UrgentBanner');
const { TaskFrame } = await import('@/components/hig/StorageBanner');

describe('F-walk-04: a held walk says a timed decision whole, its time and what is due (journey §4.7, B-02, D224)', () => {
  /** What is on screen to see: the shell's spoken announcement, outside the page, is not. */
  const seen = () => {
    const walkTree = (list: (HostNode | string)[]): string => list.map(c => (typeof c === 'string' ? c
      : String(c.props.className ?? '').includes('sr-only') ? '' : walkTree(c.children))).join(' ');
    return walkTree(h().tree).replace(/\s+/g, ' ');
  };
  const framed = () => {
    // The shell's surface marks the root and speaks from outside #app, as the app's document has them.
    Object.assign(document, { body: { nodeType: 1 }, documentElement: { dataset: {} }, querySelector: () => null, activeElement: null });
    return render(createElement(UrgentProvider, null, createElement(TaskFrame, null, createElement(LiveWalkScreen))));
  };
  it('a 65 logged elsewhere at 13:30: the walk holds, and says when it was measured and when to re-check, then Re-check now', async () => {
    const p = createDefaultProfile(INSULIN);
    clock(13, 0);
    const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(13), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: p, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...morning, readiness: evaluateCheckIn(p, morning) }] }));
    router.params = startedParams();
    host = framed();
    await host.settle();
    expect(status()).toBe('running');
    clock(13, 31);
    expect((await store.addObservation({ kind: 'glucose', value: 65, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: iso(13, 30) })).ok).toBe(true);
    await h().settle();
    expect(status()).not.toBe('running');
    expect(seen()).toMatch(/Re-check your glucose/);
    expect(seen()).toMatch(/Low glucose at .*· Re-check at/);
    clock(13, 46);
    host.unmount();
    host = framed();
    await host.settle();
    expect(seen()).toMatch(/Re-check now/);
  });
});
