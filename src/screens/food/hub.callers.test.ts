/**
 * The Food hub, driven through its real handlers over the real store and a
 * fake IndexedDB: Right now, Today, This week, and the level sheet it opens.
 * Replaced are only the router, the toasts, the hub's frame and the sheet's
 * frame, which decide nothing here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { MealItem, MealRecord } from '@/food/types';
import type { FoodPreferences, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ pathname: '/hub/food', search: '', navigate: vi.fn() }));
/** The router's blocker, as the sheet registers it: a test drives a Back through it (H7-19). */
const nav = vi.hoisted(() => ({
  shouldBlock: undefined as undefined | ((a: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string }; historyAction: string }) => boolean),
  state: 'unblocked' as 'unblocked' | 'blocked' | 'proceeding',
  proceeded: 0,
  resets: 0,
  redraw: new Set<() => void>(),
}));
vi.mock('react-router-dom', async () => {
  const { createElement: h, useEffect, useReducer } = await import('react');
  return {
    useBlocker: (shouldBlock: typeof nav.shouldBlock | boolean) => {
      nav.shouldBlock = typeof shouldBlock === 'function' ? shouldBlock : () => shouldBlock === true;
      const [, redraw] = useReducer((x: number) => x + 1, 0);
      useEffect(() => {
        nav.redraw.add(redraw);
        return () => void nav.redraw.delete(redraw);
      }, []);
      return {
        state: nav.state,
        proceed: () => { nav.proceeded += 1; nav.state = 'proceeding'; },
        reset: () => { nav.resets += 1; nav.state = 'unblocked'; nav.redraw.forEach(r => r()); },
      };
    },
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: router.pathname, search: router.search, state: null, key: 'k0' }),
    useParams: () => ({}),
    Link: ({ children, to }: { children?: unknown; to?: string }) => h('a', { href: to }, children as never),
    Navigate: () => null,
  };
});
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { dismiss: () => {} }) }));
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, title, children }: { open: boolean; title?: string; children?: unknown }) => (open ? h('div', { role: 'dialog', 'aria-label': title }, children as never) : null) };
});
vi.mock('@/screens/hub/HubFrame', async () => {
  const { createElement: h } = await import('react');
  return {
    HubFrame: ({ category, children }: { category: { title: string }; children?: unknown }) => h('main', null, h('h1', null, category.title), children as never),
    HubSection: ({ title, children }: { title: string; children?: unknown }) => h('section', { 'aria-label': title }, h('h2', null, title), children as never),
  };
});
// Base UI's switch calls its refs as it renders, which this host can't run: a plain switch stands in.
vi.mock('@/screens/you/controls', async importOriginal => {
  const real = await importOriginal<typeof import('@/screens/you/controls')>();
  const { createElement: h } = await import('react');
  return {
    ...real,
    Toggle: ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) =>
      h('button', { type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label, onClick: () => onChange(!checked) }),
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
const { default: FoodHubScreen } = await import('./FoodHubScreen');
const food = await import('@/food/store');

const person = (f: Partial<FoodPreferences>): UserProfile =>
  createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no', ...f } });
const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti (whole-wheat)', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
const plate = { kind: 'quick', size: 'normal', name: 'Normal plate' } as const;
const bhel = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: '2026-10-06T09:00:00.000+05:30' } as const;
const mealOn = (id: string, at: string, meal: MealRecord['meal'], items: readonly MealItem[]): MealRecord =>
  ({ id, at, day: at.slice(0, 10), meal, items: [...items], level: 'estimates', loggedAt: at, edits: [] });

let host: Host | undefined;
/** Refuse writes of the profile, as a full disk would. */
let refuseProfile = false;
beforeEach(async () => {
  refuseProfile = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  // Thursday 8 October, 13:20: lunch by the hub's clock.
  vi.setSystemTime(new Date(2026, 9, 8, 13, 20, 0));
  local.clear();
  store.resetForTests();
  router.pathname = '/hub/food';
  router.search = '';
  router.navigate.mockReset();
  await store.start({
    factory: fakeIndexedDB({ failWrite: (_store, row) => (refuseProfile && row.key === 'profile' ? new DOMException('Full', 'QuotaExceededError') : undefined) }),
    broadcast: null,
  });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function hub(f: Partial<FoodPreferences>, meals: MealRecord[] = []) {
  await store.update(prev => ({ ...prev, profile: person(f) }));
  for (const m of meals) expect((await food.saveMeal(m)).ok).toBe(true);
  host = render(createElement(FoodHubScreen));
  await host.settle();
  return host;
}

/** A region's text, by its heading. */
const region = (h: Host, title: string) => {
  const node = h.all().find(n => n.type === 'section' && n.props['aria-label'] === title);
  if (!node) throw new Error(`no region ${title}: ${h.text()}`);
  return textOf(node.children);
};
/** The links and buttons in a region: the choices it offers. */
const choices = (h: Host, title: string): string[] => {
  const node = h.all().find(n => n.type === 'section' && n.props['aria-label'] === title)!;
  const walk = (n: HostNode): HostNode[] => n.children.flatMap(c => (typeof c === 'string' ? [] : [c, ...walk(c)]));
  return walk(node).filter(n => n.type === 'a' || n.type === 'button').map(n => textOf(n.children));
};

describe('what has no estimate, on the hub (H7-14, K7-10, K7-17)', () => {
  it('says so on Today when nothing logged has a figure', async () => {
    const h = await hub({}, [mealOn('meal-1', '2026-10-08T13:00:00.000+05:30', 'lunch', [plate])]);
    expect(region(h, 'Today')).toContain('1 item has no estimate');
  });
  it('labels a day of This week partial, naming what has no figure', async () => {
    const h = await hub({}, [
      mealOn('meal-1', '2026-10-06T13:00:00.000+05:30', 'lunch', [roti, bhel]),
      mealOn('meal-2', '2026-10-07T13:00:00.000+05:30', 'lunch', [bhel]),
    ]);
    const week = region(h, 'This week');
    expect(week).toContain('1 meal · Estimated 200 kcal in logged foods · Partial: Bhel puri has no calorie estimate');
    expect(week).toContain('1 meal · Bhel puri has no calorie estimate');
  });
});

describe('choosing a level from “Log a meal” with logging off (H7-18)', () => {
  const dialog = (h: Host, name: string) => h.all().find(n => n.props.role === 'dialog' && n.props['aria-label'] === name);
  it('keeps the level sheet, the choice and its error while the choice isn’t stored', async () => {
    router.pathname = '/hub/food/log';
    const h = await hub({ level: undefined });
    expect(dialog(h, 'Log what you eat?')).toBeDefined();
    refuseProfile = true;
    await h.click(h.button('Yes, meals only, no numbers'));
    await h.settle();
    expect(dialog(h, 'Log a meal')).toBeUndefined();
    expect(textOf(dialog(h, 'Log what you eat?')!.children)).toContain('That didn’t save.');
  });
  it('opens “Log a meal” once the choice is stored', async () => {
    router.pathname = '/hub/food/log';
    const h = await hub({ level: undefined });
    await h.click(h.button('Yes, meals only, no numbers'));
    await h.settle();
    expect(store.getState().profile?.food?.level).toBe('meals');
    expect(dialog(h, 'Log what you eat?')).toBeUndefined();
    expect(dialog(h, 'Log a meal')).toBeDefined();
  });
});

export { choices };
