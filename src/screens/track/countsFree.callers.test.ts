/**
 * Counts-free hides every energy figure from movement (B-11, KH-09; board
 * D101), through the real callers: a walk's summary, a walk kept from before
 * on its own Track screen, and My Day. The estimate is kept all the same, so
 * choosing estimates again shows it. The real store over a fake IndexedDB;
 * replaced are only the router, the screen frame and the sheet, which decide
 * nothing here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { FoodPreferences } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ id: '', navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useParams: () => ({ id: router.id }),
    useLocation: () => ({ pathname: `/track/walk/${router.id}`, search: '', state: null, key: 'k0' }),
    useNavigate: () => router.navigate,
    useSearchParams: () => [new URLSearchParams(), () => {}],
    // A plain anchor with its text: My Day's rows are links.
    Link: ({ children }: { children?: unknown }) => h('a', null, children as never),
    Navigate: () => null,
  };
});
// sonner styles the page as it loads, and no toast is shown here.
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { dismiss: () => {} }) }));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
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
const { WalkSummary } = await import('@/screens/walk/WalkSummary');
const { WalkDetail } = await import('./RecordDetails');
const { MyDay } = await import('./MyDay');
const { saveMeal } = await import('@/food/store');
const { nowAt } = await import('@/health/observation');
const { finishWalk, startWalk } = await import('@/walk/clock');
const { clearWalk, sessionWalkStorage, storeWalk } = await import('@/walk/persist');

const START = new Date(2026, 9, 9, 7, 0, 0).getTime();
const WALK_ID = 'mgh3k2x1-1a2b3c4d';
const person = (level: FoodPreferences['level']) =>
  createDefaultProfile({ birthYear: 1970, weightKg: 78, food: { pattern: 'vegetarian', avoid: [], ...(level ? { level } : {}) } });
/** A figure, or the row that carries one. */
const ENERGY = /kcal|Energy \(estimate\)/;

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START + 11 * 60_000);
  local.clear();
  store.resetForTests();
  router.id = WALK_ID;
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  // Ten minutes, no GPS: at 78 kg, about 20 kcal (walk/energy.test.ts).
  storeWalk(sessionWalkStorage(), finishWalk(startWalk(WALK_ID, { kind: 'walk', gps: false, steps: false }, START), START + 600_000, 'finish'));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  clearWalk(sessionWalkStorage());
  vi.useRealTimers();
});

async function show(screen: () => unknown, level: FoodPreferences['level']) {
  await store.update(prev => ({ ...prev, profile: person(level) }));
  host?.unmount();
  host = render(createElement(screen as never));
  await host.settle();
  return host;
}

const energyKept = () => store.getState().observations.filter(o => o.kind === 'activeEnergy' && o.context === `walk:${WALK_ID}`);

describe('a walk’s energy estimate, counts-free (B-11, KH-09)', () => {
  it('shows on the summary with estimates, and with meal ideas only', async () => {
    for (const level of ['estimates', 'ideas', undefined] as const) {
      const text = (await show(WalkSummary, level)).text();
      expect(text).toContain('Energy (estimate)');
      expect(text).toMatch(/about \d+ kcal/);
    }
  });

  it('leaves the energy out for meal ideas only after “Yes” or “Prefer not to say” to the screening question (K7-04; board D133)', async () => {
    for (const hardBefore of ['yes', 'preferNot'] as const) {
      await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 78, food: { pattern: 'vegetarian', avoid: [], level: 'ideas', hardBefore } }) }));
      host?.unmount();
      host = render(createElement(WalkSummary as never));
      await host.settle();
      expect(host.text(), hardBefore).toContain('Your walk');
      expect(host.text(), hardBefore).not.toMatch(ENERGY);
    }
  });

  it('leaves the summary’s energy row out, and Save still keeps the estimate (board D101)', async () => {
    const h = await show(WalkSummary, 'meals');
    expect(h.text()).not.toMatch(ENERGY);
    await h.click(h.button('Save walk'));
    await h.settle();
    expect(h.text()).toContain('Saved on this device');
    expect(h.text()).not.toMatch(ENERGY);
    expect(energyKept()).toHaveLength(1);
    expect(energyKept()[0].value).toBeGreaterThan(0);
  });

  it('hides a walk kept from before on its own screen, and shows it again once estimates are chosen', async () => {
    const summary = await show(WalkSummary, 'estimates');
    await summary.click(summary.button('Save walk'));
    await summary.settle();
    expect(energyKept()).toHaveLength(1);

    const before = await show(WalkDetail, 'meals');
    expect(before.text()).toContain('Started');
    expect(before.text()).not.toMatch(ENERGY);

    await store.update(prev => ({ ...prev, profile: person('estimates') }));
    await before.settle();
    expect(before.text()).toContain('Energy (estimate)');
    expect(before.text()).toMatch(/about \d+ kcal/);
  });
});

describe('My Day, counts-free (B-11, KH-09)', () => {
  it('shows a meal’s estimate, and one whose walk is gone, only with estimates', async () => {
    const at = nowAt();
    const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
    expect((await saveMeal({ id: 'meal-1', at, day: at.slice(0, 10), meal: 'breakfast', items: [roti], level: 'estimates', loggedAt: at, edits: [] })).ok).toBe(true);
    // Its walk is gone: a backup restored without it, say. Nothing else would show it.
    expect((await store.addObservation({ kind: 'activeEnergy', value: 21.4, scope: 'sessionObserved', source: 'measured', at, coverageMs: 600_000, context: 'walk:gone' })).ok).toBe(true);
    const day = () => createElement(MyDay, { day: at.slice(0, 10) });

    const free = await show(day, 'meals');
    expect(free.text()).toContain('Roti ×2');
    expect(free.text()).not.toMatch(/kcal|Active energy/);

    await store.update(prev => ({ ...prev, profile: person('estimates') }));
    await free.settle();
    expect(free.text()).toContain('Estimated 200 kcal');
    expect(free.text()).toContain('Active energy');
  });
});
