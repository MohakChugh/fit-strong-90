/**
 * Home's restart, through its real callers (D106; Codex P8S-12, P8S-13): a
 * manual workout under way keeps Restart off Home, its rest running, until
 * it is finished and saved; and a restart whose worker answers slowly lets in
 * no new work meanwhile, then, told no, lets it in again with nothing changed.
 * Replaced: the router, the dialog primitives and the 3D figure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';
import type { ContainerLike, RegistrationLike, WorkerLike } from './updates';

const router = vi.hoisted(() => ({ navigate: vi.fn(), params: new URLSearchParams() }));
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useSearchParams: () => [router.params],
    useLocation: () => ({ pathname: '/trends/workout', search: '', state: null, key: 'k0' }),
    useRouteError: () => undefined,
    Link: ({ children, to, onClick }: { children?: ReactNode; to: string; onClick?: () => void }) => createElement('a', { href: `#${to}`, onClick }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-slot': 'sheet-content', role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => createElement('button', { type: 'button' }, children),
  };
});
vi.mock('@/components/exercise/ExerciseFigure', () => ({ ExerciseFigure: () => null }));

const local = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
  },
  window: globalThis,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  scrollTo() {},
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { UrgentProvider } = await import('@/screens/home/UrgentBanner');
const { default: TodayWorkoutScreen } = await import('@/screens/workout/TodayWorkoutScreen');
const updates = await import('./updates');
const { underWay } = await import('./underWay');

const DAY = '2026-10-08';
const profile = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'none', glucoseUnit: 'mg/dL' } });
const answered: DailyCheckIn = {
  date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
  back: { pain: 0, legPain: 0, reach: 'back', newNeuro: false, caudaEquinaFlag: false },
};
const WAITING = { waiting: true, windows: 1, restarting: false, updated: false };
let host: Host | undefined;
const h0 = () => host!;
const settle = () => h0().settle(12);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  const record: CheckInRecord = { ...answered, readiness: evaluateCheckIn(profile, answered, []) };
  await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: '2026-09-24', onboardingComplete: true }, checkIns: [record] }));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  updates.resetUpdatesForTests();
  vi.useRealTimers();
});

describe('a manual workout under way keeps Restart off Home until it is finished (P8S-12)', () => {
  it('a set logged and its rest running, Home: the update named with no Restart; the workout finished and saved: Restart', async () => {
    host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
    await settle();
    await h0().click(h0().button('Done set', { exact: true }));
    await settle();
    // Its write stored and its rest running: only the workout's own memory says it is under way.
    expect(store.getState().saving).toBe(false);
    host.unmount();
    host = undefined;
    expect(underWay()).toBe(true);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY });
    host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
    await settle();
    await h0().click(h0().button('Finish workout', { exact: true }));
    await settle();
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    host.unmount();
    host = undefined;
    expect(underWay()).toBe(false);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY, action: 'restart' });
  });
});

describe('a guided session or a stretch begun and not finished keeps Restart off Home too', () => {
  it('its progress saved part-way, as the session saves it as it runs: no Restart; finished, or discarded: Restart', async () => {
    const { saveProgress, clearProgress } = await import('@/session/persistence');
    const plan = { id: 'p', kind: 'full', date: DAY, steps: [] } as never;
    expect(underWay()).toBe(false);
    saveProgress(plan, { status: 'paused' } as never, 0);
    expect(underWay()).toBe(true);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY });
    // A run that has finished is no longer under way, and neither is one put aside.
    saveProgress(plan, { status: 'done' } as never, 0);
    expect(underWay()).toBe(false);
    saveProgress({ ...(plan as object), kind: 'stretch' } as never, { status: 'running' } as never, 0);
    expect(underWay()).toBe(true);
    clearProgress('stretch');
    expect(underWay()).toBe(false);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY, action: 'restart' });
  });
});

describe('a restart lets in no new work until its worker answers (P8S-13)', () => {
  it('a slow answer: a write asked for meanwhile is refused with nothing stored; told no, the app takes work again', async () => {
    const world = { windows: 1 };
    const pending: (() => void)[] = [];
    const worker = (build: string): WorkerLike => ({
      postMessage(message, transfer) {
        const type = (message as { type: string }).type;
        const answer = () => (transfer[0] as MessagePort).postMessage({ build, windows: world.windows, restarting: type === 'restart' && world.windows === 1 });
        if (type === 'restart') pending.push(answer);
        else answer();
      },
    });
    const registration: RegistrationLike = { waiting: worker('bbb'), installing: null, addEventListener() {} };
    const container: ContainerLike = { controller: worker('aaa'), register: async () => registration, addEventListener() {} };
    await updates.startUpdates({ container, swUrl: '/sw.js', reload: vi.fn(), underWay, hold: store.holdNewWork, settled: store.whenSettled });
    expect(updates.updateState().waiting).toBe(true);
    const how = updates.restartToUpdate();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updates.updateState().restarting).toBe(true);
    const water = { kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' } as const;
    expect((await store.addObservation(water)).ok).toBe(false);
    expect(store.getState().observations.some(o => o.kind === 'water')).toBe(false);
    // Another window opened while it waited: the worker says no.
    world.windows = 2;
    for (const answer of pending) answer();
    expect(await how).toBe('others');
    expect(updates.updateState().restarting).toBe(false);
    expect((await store.addObservation(water)).ok).toBe(true);
  });
});

describe('a change to the phone’s clock, seen around a restart, is kept (D106 with Plan 6’s H6F-02)', () => {
  it('one still waiting to be stored keeps Restart off Home: a reload would lose it', async () => {
    let failing = false;
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB({ failWrite: s => (failing && s === 'settings' ? new DOMException('The write was stopped.', 'AbortError') : undefined) }), broadcast: null });
    expect(store.getState().status).toBe('ready');
    failing = true;
    const marked = store.markClockChange([DAY]);
    await new Promise(resolve => setTimeout(resolve, 0));
    // Refused once and waiting to try again: no write is queued, yet the change is held here only.
    expect(store.getState().saving).toBe(false);
    expect(store.getState().clockHold).toBeDefined();
    expect(underWay()).toBe(true);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY });
    failing = false;
    void marked;
  });

  it('one seen while the restart waits for its worker is stored all the same, and the reload waits for it', async () => {
    const pending: (() => void)[] = [];
    const changes: (() => void)[] = [];
    const worker = (build: string): WorkerLike => ({
      postMessage(message, transfer) {
        const type = (message as { type: string }).type;
        const answer = () => (transfer[0] as MessagePort).postMessage({ build, windows: 1, restarting: type === 'restart' });
        if (type === 'restart') pending.push(answer);
        else answer();
      },
    });
    const registration: RegistrationLike = { waiting: worker('bbb'), installing: null, addEventListener() {} };
    const container: ContainerLike = { controller: worker('aaa'), register: async () => registration, addEventListener: (_t, fn) => void changes.push(fn) };
    const reload = vi.fn();
    await updates.startUpdates({ container, swUrl: '/sw.js', reload, underWay, hold: store.holdNewWork, settled: store.whenSettled });
    const how = updates.restartToUpdate();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updates.updateState().restarting).toBe(true);
    // New work is refused, a change to the clock is not.
    const water = { kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' } as const;
    expect((await store.addObservation(water)).ok).toBe(false);
    const marked = store.markClockChange([DAY]);
    for (const answer of pending) answer();
    expect(await how).toBe('restarting');
    // The takeover, with the change still being written: the reload waits for it.
    for (const fn of changes) fn();
    expect(reload).not.toHaveBeenCalled();
    expect((await marked).ok).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.getState().settings.walk?.clock).toBeDefined();
  });
});
