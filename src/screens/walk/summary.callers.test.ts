/**
 * The walk's summary through its real callers: `WalkSummary`, the real store
 * over a fake IndexedDB, the walk's draft and its journal. Replaced are only
 * the router and the vendored sheet, which node can't run and decide nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: '/walk/summary', search: '', state: null, key: 'k0' }),
    Navigate: () => null,
    Link: ({ to, children, viewTransition, ...rest }: { to: string; children?: ReactNode; viewTransition?: boolean }) =>
      h('a', { ...rest, href: `#${to}`, 'data-transition': viewTransition ? 'yes' : 'no' }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement: h, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? h(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => h('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => h('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => h('button', { type: 'button' }, children),
  };
});

/** A journal that can't be read, when a test says so; the real one otherwise. */
const journalFail = vi.hoisted(() => ({ on: false }));
vi.mock('@/walk/journalPort', async importOriginal => {
  const real = await importOriginal<typeof import('@/walk/journalPort')>();
  return {
    ...real,
    journalPort: () => {
      const port = real.journalPort();
      return { ...port, read: (id: string) => (journalFail.on ? Promise.reject(new Error('unreadable')) : port.read(id)) };
    },
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
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { WalkSummary } = await import('./WalkSummary');
const { accrueOpen, finishWalk, startWalk } = await import('@/walk/clock');
const { clearWalk, sessionWalkStorage, storeWalk } = await import('@/walk/persist');
const { backPending, record, resetNavigationForTests } = await import('@/components/hig/navigation');

const ID = 'mgh3k2x1-1a2b3c4d';
const MIN = 60_000;
const START = new Date(2026, 9, 8, 8, 0).getTime();
let host: Host | undefined;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START + 30 * MIN);
  local.clear();
  store.resetForTests();
  resetNavigationForTests();
  router.navigate = vi.fn();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  clearWalk(sessionWalkStorage());
  journalFail.on = false;
  vi.useRealTimers();
});

/** A finished 20-minute walk waiting to be saved, for someone set up as `profile`, started from `from`. */
async function summary(profile: ReturnType<typeof createDefaultProfile>, from?: '/home' | '/hub/walk', minutes = 20) {
  await store.setProfile(profile);
  const walk = finishWalk(accrueOpen(startWalk(ID, { kind: 'walk', gps: false, steps: false, ...(from ? { from } : {}) }, START), minutes * MIN, START + minutes * MIN), START + minutes * MIN, 'finish');
  storeWalk(sessionWalkStorage(), walk);
  const h = (host = render(createElement(WalkSummary)));
  await h.settle();
  return h;
}

describe('the summary’s energy line (KH-13)', () => {
  const someone = { weightKg: 70, health: { diabetes: 'none' as const, medicinesReviewed: true } };

  it('links a missing birth year to Me → Profile & health, at About you', async () => {
    const h = await summary(createDefaultProfile(someone));
    expect(h.text()).toContain('Add your birth year for an estimate.');
    const link = h.all().find(n => n.type === 'a' && /Add your birth year/.test(JSON.stringify(n.children)));
    expect(link?.props.href).toBe('#/me/profile?chapter=about');
  });

  it('offers no link when the estimate is made', async () => {
    const h = await summary(createDefaultProfile({ ...someone, birthYear: 1975 }));
    expect(h.text()).toMatch(/about \d+ kcal/);
    expect(h.all().some(n => n.type === 'a' && /birth year/.test(JSON.stringify(n.children)))).toBe(false);
  });
});

describe('the summary’s route, on this phone’s consent as it is now (H6-04)', () => {
  const LINE = { start: START, end: START + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
  async function kept(saveRoutes: boolean) {
    const { journalEntry } = await import('@/walk/journal');
    await store.setProfile(createDefaultProfile({ weightKg: 70, birthYear: 1975, health: { diabetes: 'none', medicinesReviewed: true } }));
    await store.setSettings({ walk: { saveRoutes, map: 'off' } });
    const walk = finishWalk(accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 20 * MIN, START + 20 * MIN), START + 20 * MIN, 'finish');
    await store.putWalkJournal(journalEntry(walk, START + 20 * MIN, [LINE]));
    storeWalk(sessionWalkStorage(), walk);
    const h = (host = render(createElement(WalkSummary)));
    await h.settle();
    return h;
  }
  const drawn = (h: Host) => h.all().some(n => n.type === 'svg' && n.props['aria-label'] === 'Your route');

  it('draws the kept route while the answer is yes', async () => {
    expect(drawn(await kept(true))).toBe(true);
  });

  it('shows no route, and says why, once the answer is no', async () => {
    const h = await kept(false);
    expect(drawn(h)).toBe(false);
    expect(h.text()).toContain('No route: routes aren’t kept on this phone.');
  });
});

describe('the summary’s route while it is read back (H6-06)', () => {
  const LINE = { start: START, end: START + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
  /** A walk that kept its route, reopened after a reload: the route is only in IndexedDB's journal. */
  async function reloaded() {
    const { journalEntry } = await import('@/walk/journal');
    await store.setProfile(createDefaultProfile({ weightKg: 70, birthYear: 1975, health: { diabetes: 'none', medicinesReviewed: true } }));
    await store.setSettings({ walk: { saveRoutes: true, map: 'off' } });
    const walk = finishWalk(accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 20 * MIN, START + 20 * MIN), START + 20 * MIN, 'finish');
    await store.putWalkJournal(journalEntry(walk, START + 20 * MIN, [LINE]));
    storeWalk(sessionWalkStorage(), walk);
  }

  it('says it is finding the route, and a Save tapped meanwhile saves the route with the walk', async () => {
    await reloaded();
    const h = (host = render(createElement(WalkSummary)));
    expect(h.text()).toContain('Finding your route…');
    await h.click(h.button('Save walk'));
    await h.settle();
    expect(h.text()).toContain('Saved on this device');
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual([ID]);
    expect(store.getState().records.routes[0].segments).toEqual([LINE]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
  });

  it('says when the route can’t be read just now, and still saves it from the journal', async () => {
    await reloaded();
    journalFail.on = true;
    const h = (host = render(createElement(WalkSummary)));
    await h.settle();
    expect(h.text()).toContain('Your route couldn’t be read just now. It’s still kept, and it’s saved with the walk.');
    await h.click(h.button('Save walk'));
    await h.settle();
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual([ID]);
  });
});

describe('the summary after “Erase all routes” (B-05)', () => {
  const LINE = { start: START, end: START + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
  it('lets go of the route it showed, and saves the walk without it', async () => {
    const { journalEntry } = await import('@/walk/journal');
    await store.setProfile(createDefaultProfile({ weightKg: 70, birthYear: 1975, health: { diabetes: 'none', medicinesReviewed: true } }));
    await store.setSettings({ walk: { saveRoutes: true, map: 'off' } });
    const walk = finishWalk(accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 20 * MIN, START + 20 * MIN), START + 20 * MIN, 'finish');
    await store.putWalkJournal(journalEntry(walk, START + 20 * MIN, [LINE]));
    storeWalk(sessionWalkStorage(), walk);
    const h = (host = render(createElement(WalkSummary)));
    await h.settle();
    expect(h.all().some(n => n.type === 'svg' && n.props['aria-label'] === 'Your route')).toBe(true);
    expect((await store.eraseRoutes()).ok).toBe(true);
    await h.settle();
    expect(h.all().some(n => n.type === 'svg' && n.props['aria-label'] === 'Your route')).toBe(false);
    expect(h.text()).toContain('No route: every route on this phone was erased.');
    await h.click(h.button('Save walk'));
    await h.settle();
    expect(h.text()).toContain('Saved on this device');
    expect(store.getState().records.routes).toEqual([]);
  });
});

describe('Done closes back to where the walk came from, through history (M12)', () => {
  const someone = createDefaultProfile({ weightKg: 70, birthYear: 1975, health: { diabetes: 'none', medicinesReviewed: true } });
  /** Home → the Walk hub → the live walk, which Finish replaced with this summary. */
  function walkedFromTheHub() {
    record({ pathname: '/home', search: '', state: null, key: 'h' }, 'PUSH', 0);
    record({ pathname: '/hub/walk', search: '', state: null, key: 'w' }, 'PUSH', 1);
    record({ pathname: '/walk/live', search: `?id=${ID}`, state: null, key: 'l' }, 'PUSH', 2);
    record({ pathname: '/walk/summary', search: '', state: null, key: 's' }, 'REPLACE', 2);
  }

  it('after the save, pops back to the hub as it was, so its Back names Home, never this summary', async () => {
    walkedFromTheHub();
    const h = await summary(someone, '/hub/walk');
    await h.click(h.button('Save walk'));
    await h.settle();
    await h.click(h.button('Done', { exact: true }));
    expect(router.navigate.mock.calls).toEqual([[-1]]);
  });

  it('with nothing behind it, as after a fresh launch, shows the hub in place of the summary', async () => {
    record({ pathname: '/walk/summary', search: '', state: null, key: 's' }, 'LAUNCH', undefined);
    const h = await summary(someone, '/hub/walk');
    await h.click(h.button('Save walk'));
    await h.settle();
    await h.click(h.button('Done', { exact: true }));
    expect(router.navigate.mock.calls).toEqual([['/hub/walk', { replace: true }]]);
    // A Back with nothing to pop to: it moves as Back does.
    expect(backPending()).toBe(true);
  });

  it('a walk with nothing recorded goes back the same way once it is discarded', async () => {
    walkedFromTheHub();
    const h = await summary(someone, '/hub/walk', 0);
    expect(h.text()).toContain('Nothing was recorded on this walk');
    await h.click(h.button('Done', { exact: true }));
    await h.settle();
    expect(router.navigate.mock.calls).toEqual([[-1]]);
  });
});
