/**
 * The Walk hub's card for a walk still on this device, on both sides of the
 * point where the live screen finishes a walk as left open (STALE_AFTER_MS,
 * board D184), driven through the real hub, the walk kept in this tab's
 * storage, and the real store over a fake IndexedDB. Replaced are only the
 * router and the vendored sheet, which cannot run in node and decide nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useSearchParams: () => [new URLSearchParams(), () => {}],
    useViewTransitionState: () => false,
    useLocation: () => ({ pathname: '/hub/walk', search: '', state: null, key: 'k0' }),
    Link: ({ to, children }: { to: string; children?: ReactNode }) => createElement('a', { href: `#${to}` }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => createElement('button', { type: 'button' }, children),
  };
});

const storage = (map = new Map<string, string>()) => ({
  getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v),
  removeItem: (k: string) => void map.delete(k), clear: () => map.clear(), key: (i: number) => [...map.keys()][i] ?? null,
  get length() { return map.size; },
}) as Storage;
Object.assign(globalThis, {
  localStorage: storage(),
  // This tab's walk, as the live screen keeps it.
  sessionStorage: storage(),
  window: globalThis,
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  scrollTo() {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { default: WalkHub } = await import('./WalkHub');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { accrueOpen, leaveWalk, STALE_AFTER_MS, startWalk } = await import('@/walk/clock');
const { loadWalk, sessionWalkStorage, storeWalk } = await import('@/walk/persist');

const plain = createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } });
const MIN = 60_000;
const START = new Date(2026, 9, 9, 9, 0).getTime();
/** Left for another screen twelve minutes in. */
const LEFT = START + 12 * MIN;
const day = (date: string): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 });

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(LEFT);
  localStorage.clear();
  sessionStorage.clear();
  router.navigate = vi.fn();
  store.resetForTests();
  resetPendingCheckInsForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  const today = day('2026-10-09');
  await store.update(prev => ({ ...prev, profile: plain, checkIns: [{ ...today, readiness: evaluateCheckIn(plain, today, []) }] }));
  const walk = accrueOpen(startWalk('mgk1walk-0001aaaa', { kind: 'walk', gps: false, steps: false }, START), 12 * MIN, LEFT);
  storeWalk(sessionWalkStorage(), leaveWalk(walk, LEFT, 'left'));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const x = () => host!;
async function openHub(at: number) {
  vi.setSystemTime(at);
  host = render(h(WalkHub));
  await x().settle();
}

describe('a walk left open on this device, on both sides of the live screen’s threshold (board D184)', () => {
  it('at the threshold: Return to walk, as before', async () => {
    await openHub(LEFT + STALE_AFTER_MS);
    expect(x().buttons('Return to walk', { exact: true })).toHaveLength(1);
    expect(x().text()).not.toContain('A walk was left open');
  });

  it('past it: Review and save, which ends the walk as left open, when it was left, and opens its summary', async () => {
    await openHub(LEFT + STALE_AFTER_MS + MIN);
    expect(x().buttons('Return to walk', { exact: true })).toHaveLength(0);
    expect(x().text()).toContain('A walk was left open');
    await x().click(x().button('Review and save', { exact: true }));
    expect(loadWalk(sessionWalkStorage())).toMatchObject({ status: 'finished', endedBy: 'stale', finishedAt: LEFT });
    expect(router.navigate).toHaveBeenCalledWith('/walk/summary', expect.anything());
  });

  it('open as it passes: the card turns to Review and save then, not a minute later', async () => {
    await openHub(LEFT + STALE_AFTER_MS - 100);
    expect(x().buttons('Return to walk', { exact: true })).toHaveLength(1);
    vi.setSystemTime(LEFT + STALE_AFTER_MS + 50);
    await new Promise(r => setTimeout(r, 300));
    await x().settle();
    expect(x().buttons('Return to walk', { exact: true })).toHaveLength(0);
    expect(x().text()).toContain('A walk was left open');
  });
});
