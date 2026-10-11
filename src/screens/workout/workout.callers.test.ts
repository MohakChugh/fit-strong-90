/**
 * The Workout Log, driven through its real callers: the screen, its logging
 * view and Finish sheet, the shell's safety surface and the real store over
 * the fake IndexedDB, which can hold a write before it commits or refuse it.
 * Replaced: the router, the dialog primitives (plain stand-ins keep the hig
 * Sheet's own markup) and the 3D figure.
 *
 * With an emergency standing, the day's plan has no lifting, so only the
 * workout under way keeps the logging view on screen. Finishing it shows it
 * finished at once, before the device has stored it: the view, and the sheet
 * saying "Saving…", must stay until the save settles, its failure with them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

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

// What the browser would have: storage, a window, a document.
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
const { default: TodayWorkoutScreen } = await import('./TodayWorkoutScreen');

const DAY = '2026-10-08';
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'none' as const, glucoseUnit: 'mg/dL' as const };
const profile = createDefaultProfile({ health: known });
const answered = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
  back: { pain: 0, legPain: 0, reach: 'back', newNeuro: false, caudaEquinaFlag: false }, ...over,
});
const record = (p: UserProfile, c: DailyCheckIn): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c, []) });

let refuse = false;
let fake: ReturnType<typeof fakeIndexedDB>;
let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
  local.clear();
  refuse = false;
  router.navigate = vi.fn();
  store.resetForTests();
  fake = fakeIndexedDB({ failWrite: (name, row) => (refuse && name === 'sessions' && row.status !== 'in_progress' ? new DOMException('Full', 'QuotaExceededError') : undefined) });
  await store.start({ factory: fake, broadcast: null });
  await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: '2026-09-24', onboardingComplete: true }, checkIns: [record(profile, answered())] }));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const h0 = () => host!;
const settle = () => h0().settle(12);
/** The shared safety surface, wherever it is drawn. */
const surfaces = () => h0().all().filter(n => n.props['data-urgent-kind'] !== undefined).length;
const dialog = () => h0().all().find(n => n.props.role === 'dialog');

/** A set logged in the real Workout Log, then an emergency answered on another screen. */
async function underWayThenEmergency() {
  host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
  await settle();
  await h0().click(h0().button('Done set', { exact: true }));
  await settle();
  expect(store.getState().sessions.some(s => s.status === 'in_progress' && !s.guided)).toBe(true);
  await store.update(prev => ({ ...prev, checkIns: [record(profile, answered({ urgentSymptoms: true, emergency: ['chest'] }))] }));
  await settle();
  // The emergency is the decision on screen, logging has stopped, and the workout under way is still there to finish.
  expect(surfaces()).toBeGreaterThanOrEqual(1);
  expect(h0().text()).toContain('Get help now');
  expect(h0().buttons('Done set', { exact: true })).toHaveLength(0);
  await h0().click(h0().button('Finish workout', { exact: true }));
  await settle();
  expect(dialog()).toBeDefined();
}

describe('finishing a workout with an emergency standing: the logging view and its Finish sheet stay until the save settles', () => {
  it('while the device holds the write: "Saving…" stays on screen, over the logging view; once stored, the saved workout opens', async () => {
    await underWayThenEmergency();
    fake.control.hold();
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    expect(dialog()).toBeDefined();
    expect(h0().buttons('Saving…', { exact: true })).toHaveLength(1);
    expect(h0().text()).toContain('Get help now');
    expect(surfaces()).toBeGreaterThanOrEqual(1);
    expect(router.navigate).not.toHaveBeenCalled();
    fake.control.release();
    await settle();
    expect(router.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/track\/workout\/.+/), expect.objectContaining({ replace: true }));
    expect(store.getState().sessions.filter(s => !s.guided && s.id !== undefined).every(s => s.status !== 'in_progress')).toBe(true);
  });

  it('a refused write keeps the sheet open with what went wrong and Try again; Try again stores it', async () => {
    await underWayThenEmergency();
    refuse = true;
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    expect(dialog()).toBeDefined();
    expect(h0().text()).toMatch(/That did not save\./);
    expect(h0().buttons('Try again', { exact: true })).toHaveLength(1);
    expect(router.navigate).not.toHaveBeenCalled();
    // The workout is still under way, as stored; nothing could start movement meanwhile.
    expect(store.getState().sessions.some(s => s.status === 'in_progress' && !s.guided)).toBe(true);
    expect(h0().buttons('Done set', { exact: true })).toHaveLength(0);
    refuse = false;
    await h0().click(h0().button('Try again', { exact: true }));
    await settle();
    expect(router.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/track\/workout\/.+/), expect.objectContaining({ replace: true }));
  });

  it('an emergency answered on another screen while the finish is saving takes nothing away mid-save', async () => {
    host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
    await settle();
    await h0().click(h0().button('Done set', { exact: true }));
    await settle();
    await h0().click(h0().button('Finish workout', { exact: true }));
    await settle();
    fake.control.hold();
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    // The day's plan loses its lifting now: the workout being saved keeps its own. (Queued behind the
    // held write in this one store, the answer is on screen at once, as every change is.)
    const emergency = store.update(prev => ({ ...prev, checkIns: [record(profile, answered({ urgentSymptoms: true, emergency: ['chest'] }))] }));
    await settle();
    expect(h0().text()).toContain('Get help now');
    expect(dialog()).toBeDefined();
    expect(h0().buttons('Saving…', { exact: true })).toHaveLength(1);
    expect(surfaces()).toBeGreaterThanOrEqual(1);
    fake.control.release();
    await settle();
    expect((await emergency).ok).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/track\/workout\/.+/), expect.objectContaining({ replace: true }));
  });

  it('closed after a refusal ("Keep going"), the workout under way is still there, and logging stays stopped', async () => {
    await underWayThenEmergency();
    refuse = true;
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    await h0().click(h0().button('Keep going', { exact: true }));
    await settle();
    expect(dialog()).toBeUndefined();
    expect(h0().text()).toContain('Get help now');
    expect(h0().buttons('Finish workout', { exact: true })).toHaveLength(1);
    expect(h0().buttons('Done set', { exact: true })).toHaveLength(0);
  });
});
