/**
 * Me → Food, driven through its real handlers over the real store and a
 * fake IndexedDB. Replaced are only the router, the screen's frame and the
 * sheet's frame, which decide nothing here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { FoodPreferences } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host } from '@/test/host';

vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/me/food', search: '', state: null, key: 'k0' }),
    Link: ({ children }: { children?: unknown }) => h('a', null, children as never),
    Navigate: () => null,
  };
});
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { dismiss: () => {} }) }));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, title, children }: { open: boolean; title?: string; children?: unknown }) => (open ? h('div', { role: 'dialog', 'aria-label': title }, children as never) : null) };
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
const { FoodScreen } = await import('./FoodScreen');
const { default: UsualMealsScreen } = await import('@/screens/food/UsualMealsScreen');
const food = await import('@/food/store');

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 13, 20, 0));
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function screen(food: FoodPreferences) {
  await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, food }) }));
  host = render(createElement(FoodScreen));
  await host.settle();
  return host;
}

const FULL: FoodPreferences = {
  pattern: 'jain', avoid: ['mushroom'], region: 'west', allergies: ['peanut'], customAllergies: ['brinjal'], level: 'estimates', hardBefore: 'yes',
  careTeamTargets: { kcal: 1600, setOn: '2026-10-01' }, logReminder: { meal: 'lunch', at: '14:30' },
};

describe('“Clear food preferences” (K7-03; board D137)', () => {
  it('asks once, with a specific label, before it clears anything', async () => {
    const h = await screen(FULL);
    await h.click(h.button('Clear food preferences', { exact: true }));
    expect(store.getState().profile?.food).toEqual(FULL);
    expect(h.text()).toContain('Your allergies stay');
    await h.click(h.button('Cancel', { exact: true }));
    expect(store.getState().profile?.food).toEqual(FULL);
  });
  it('never clears allergies or the screening answer, keeping what you eat with them', async () => {
    const h = await screen(FULL);
    await h.click(h.button('Clear food preferences', { exact: true }));
    await h.click(h.button('Clear food choices', { exact: true }));
    expect(store.getState().profile?.food).toEqual({ pattern: 'jain', avoid: [], allergies: ['peanut'], customAllergies: ['brinjal'], hardBefore: 'yes' });
  });
  it('clears the whole record when it holds no allergy and no answer to keep', async () => {
    const { allergies, customAllergies, hardBefore, ...rest } = FULL;
    void allergies; void customAllergies; void hardBefore;
    const h = await screen(rest);
    await h.click(h.button('Clear food preferences', { exact: true }));
    expect(h.text()).not.toContain('Your allergies stay');
    await h.click(h.button('Clear food choices', { exact: true }));
    expect(store.getState().profile?.food).toBeUndefined();
  });
});

describe('removing a word, with a visible “Remove” (H7-17, K7-09; board D141)', () => {
  it('labels each allergy and food left out “Remove”, its name kept for VoiceOver, at 48 px', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: ['mushroom'], customAllergies: ['brinjal'] });
    const removes = h.all().filter(n => n.type === 'button' && textOf(n.children) === 'Remove');
    expect(removes.map(n => n.props['aria-label'])).toEqual(['Remove brinjal', 'Remove mushroom']);
    for (const n of removes) expect(String(n.props.className).split(' ')).toEqual(expect.arrayContaining(['min-h-12', 'min-w-12']));
    await h.click(removes[0]);
    expect(store.getState().profile?.food?.customAllergies).toBeUndefined();
  });
});

describe('removing a usual meal, with a visible “Remove” (H7-17, K7-09; board D141)', () => {
  it('labels it “Remove”, its name kept for VoiceOver, at 48 px, and removes it at once', async () => {
    const at = '2026-10-07T13:00:00.000+05:30';
    const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti (whole-wheat)', unit: 'piece', count: 2, gramsPerPortion: 40 } as const;
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], level: 'meals' } }) }));
    expect((await food.saveMeal({ id: 'meal-1', at, day: '2026-10-07', meal: 'lunch', items: [roti], level: 'meals', loggedAt: at, edits: [] }, { usual: { id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: at, updatedAt: at } })).ok).toBe(true);
    host = render(createElement(UsualMealsScreen));
    await host.settle();
    const remove = host.all().find(n => n.type === 'button' && textOf(n.children) === 'Remove');
    expect(remove?.props['aria-label']).toBe('Remove Weekday lunch');
    expect(String(remove?.props.className).split(' ')).toEqual(expect.arrayContaining(['min-h-12', 'min-w-12']));
    await host.click(remove!);
    expect(store.getState().records.savedMeals).toEqual([]);
  });
});
