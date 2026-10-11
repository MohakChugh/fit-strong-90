/**
 * The "Log a meal" sheet, driven through its real handlers over the real
 * store and a fake IndexedDB: what it warns of, what it saves, and what it
 * refuses. Replaced are only the router, the toasts and the sheet's frame,
 * which decide nothing here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { FoodPreferences, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';
import type { MealRecord } from '@/food/types';

vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/hub/food/log', search: '', state: null, key: 'k0' }),
    Link: ({ children }: { children?: unknown }) => h('a', null, children as never),
    Navigate: () => null,
  };
});
const toasts = vi.hoisted(() => [] as string[]);
vi.mock('sonner', () => ({ toast: Object.assign((text: string) => void toasts.push(text), { dismiss: () => {} }) }));
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, title, children }: { open: boolean; title?: string; children?: unknown }) => (open ? h('div', { role: 'dialog', 'aria-label': title }, children as never) : null) };
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
const { LogMealSheet } = await import('./LogMealSheet');
const food = await import('@/food/store');
const { corrected, mealsIn, stored } = await import('@/food/records');

/** Every host node under one, depth first. */
const allIn = (node: HostNode): HostNode[] => node.children.flatMap(c => (typeof c === 'string' ? [] : [c, ...allIn(c)]));

/** 13:20 on Thursday 8 October: lunch by the sheet's clock. */
const NOW = new Date(2026, 9, 8, 13, 20, 0).getTime();
const person = (food: Partial<FoodPreferences>): UserProfile =>
  createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no', ...food } });

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  local.clear();
  toasts.length = 0;
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function open(food: Partial<FoodPreferences>, request: Parameters<typeof LogMealSheet>[0]['request'] = {}) {
  await store.update(prev => ({ ...prev, profile: person(food) }));
  host = render(createElement(LogMealSheet, { request, onClose: () => {} }));
  await host.settle();
  return host;
}

/** Search, then add what was typed as your own food, as the person would: nothing ticked unless said. */
async function addOwn(h: Host, name: string, tick: string[] = []) {
  await h.change(h.field('Search foods'), { value: name });
  await h.click(h.button(`Add “${name}” as your own food`));
  for (const label of tick) await h.click(h.button(label, { exact: true }));
  await h.click(h.button('Add to meal', { exact: true }));
}

/** One tray item's text, by its name. */
const item = (h: Host, name: string) => {
  const node = h.all().find(n => n.props['data-item'] === name);
  if (!node) throw new Error(`no tray item ${name}: ${h.text()}`);
  return textOf(node.children);
};

describe('your own food’s allergens, in the tray (H7-04)', () => {
  it('warns a peanut allergy of "Peanut chutney" with nothing ticked, from its name', async () => {
    const h = await open({ allergies: ['peanut'] });
    await addOwn(h, 'Peanut chutney');
    expect(item(h, 'Peanut chutney')).toContain('May contain peanut, which you listed as an allergy');
  });
  it('says what isn’t known about your own food with nothing ticked, and nothing once “None of these” is', async () => {
    const h = await open({ allergies: ['peanut'] });
    await addOwn(h, 'Bhel puri');
    expect(item(h, 'Bhel puri')).toContain('What’s in it isn’t known. Check it for peanut.');
    await addOwn(h, 'Thepla', ['None of these']);
    expect(item(h, 'Thepla')).not.toMatch(/isn’t known|peanut/);
  });
});

describe('a correction made against a meal that changed underneath it (H7-08; board D135)', () => {
  const AT = '2026-10-08T13:10:00.000+05:30';
  const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti (whole-wheat)', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
  const lunch: MealRecord = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [roti], level: 'estimates', loggedAt: AT, edits: [] };
  const stepMore = async (h: Host) => {
    const row = h.all().find(n => n.props['data-item'] === 'Roti (whole-wheat)')!;
    const more = row && allIn(row).find(n => n.type === 'button' && textOf(n.children).includes('More'));
    await h.click(more!);
  };

  it('keeps the other correction and its history, keeps the draft, and says what changed', async () => {
    await store.update(prev => ({ ...prev, profile: person({}) }));
    expect((await food.saveMeal(lunch)).ok).toBe(true);
    const h = await open({}, { edit: 'meal-1' });
    // Another screen moves it to dinner while this sheet is open.
    const elsewhere = corrected(lunch, { at: AT, meal: 'dinner', items: lunch.items }, '2026-10-08T13:15:00.000+05:30');
    expect((await store.writeRecords({ put: { meals: [stored(elsewhere)] } })).ok).toBe(true);
    await stepMore(h);
    await h.click(h.button('Save meal', { exact: true }));
    expect(mealsIn(store.getState().records)).toEqual([elsewhere]);
    expect(h.text()).toMatch(/changed elsewhere at 1:15 pm.*It’s now Dinner, Roti \(whole-wheat\) ×2/);
    expect(item(h, 'Roti (whole-wheat)')).toContain('3 rotis');
    expect(toasts).toEqual([]);
  });

  it('never brings back a meal deleted underneath it, and keeps its deletion record', async () => {
    await store.update(prev => ({ ...prev, profile: person({}) }));
    expect((await food.saveMeal(lunch)).ok).toBe(true);
    const h = await open({}, { edit: 'meal-1' });
    expect((await food.deleteMeal('meal-1')).ok).toBe(true);
    await stepMore(h);
    await h.click(h.button('Save meal', { exact: true }));
    expect(mealsIn(store.getState().records)).toEqual([]);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    expect(h.text()).toMatch(/deleted/);
    expect(toasts).toEqual([]);
  });
});

describe('your own food in a logged meal, after it was redefined (H7-09; board D134)', () => {
  it('reads and steps as it was logged: one plate, 300 kcal, and 1½ plates is 450 kcal', async () => {
    const T1 = '2026-10-07T09:00:00.000+05:30';
    const v1 = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: T1, updatedAt: T1 };
    const at = '2026-10-08T13:10:00.000+05:30';
    const logged = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: { kcal: 300 }, version: T1, kcal: 300 } as const;
    expect((await food.saveMeal({ id: 'meal-1', at, day: '2026-10-08', meal: 'lunch', items: [logged], level: 'estimates', loggedAt: at, edits: [] }, { customFoods: [v1] })).ok).toBe(true);
    // A newer definition under the same id, merged in from another phone.
    const v2 = { ...v1, per: { qty: 100, unit: 'g' }, kcal: 150, updatedAt: '2026-10-08T12:00:00.000+05:30' };
    expect((await store.writeRecords({ put: { customFoods: [v2] } })).ok).toBe(true);
    const h = await open({}, { edit: 'meal-1' });
    expect(item(h, 'Bhel puri')).toContain('1 × 1 plate · Estimated 300 kcal');
    const row = h.all().find(n => n.props['data-item'] === 'Bhel puri')!;
    await h.click(allIn(row).find(n => n.type === 'button' && textOf(n.children).includes('More'))!);
    expect(item(h, 'Bhel puri')).toContain('1½ × 1 plate · Estimated 450 kcal');
  });
});

describe('your own food in a meal whose food is gone (H7-10; board D134)', () => {
  it('reads its portion from its snapshot, and warns from its name, with what isn’t known', async () => {
    const at = '2026-10-08T13:10:00.000+05:30';
    const snap = { per: { qty: 1, unit: 'katori' }, basis: {}, version: at } as const;
    const items = [
      { kind: 'custom', customId: 'food-gone', name: 'Peanut chutney', count: 1, ...snap },
      { kind: 'custom', customId: 'food-gone-2', name: 'Bhel puri', count: 1, ...snap },
    ] as const;
    expect((await food.saveMeal({ id: 'meal-1', at, day: '2026-10-08', meal: 'lunch', items: [...items], level: 'estimates', loggedAt: at, edits: [] })).ok).toBe(true);
    const h = await open({ allergies: ['peanut'] }, { edit: 'meal-1' });
    expect(item(h, 'Peanut chutney')).toContain('1 × 1 katori');
    expect(item(h, 'Peanut chutney')).toContain('May contain peanut, which you listed as an allergy');
    expect(item(h, 'Bhel puri')).toContain('What’s in it isn’t known. Check it for peanut.');
  });
});

const { PortionPage } = await import('./parts');
const { foodById } = await import('@/food/data');

describe('a food’s portion page, weighed (H7-12)', () => {
  const roti = foodById('roti')!;
  const page = (onSave: (item: unknown) => void) => {
    host = render(createElement(PortionPage, {
      food: roti, numbers: { show: true, ranges: false }, allergies: { known: [], custom: [] },
      look: { food: foodById, custom: () => undefined }, onBack() {}, onSave,
    }));
    return host;
  };
  it('applies a weight typed in when the page’s own action is tapped', async () => {
    const saved: unknown[] = [];
    const h = page(item => saved.push(item));
    await h.settle();
    await h.click(h.button('Weigh yours'));
    await h.change(h.field('One roti weighs, in grams'), { value: '70' });
    await h.click(h.button('Add to meal', { exact: true }));
    expect(saved).toEqual([expect.objectContaining({ gramsPerPortion: 70, weighed: true, kcal: 179 })]);
  });
  it('leaves the standard portion as it is when “Weigh yours” was opened and nothing typed', async () => {
    const saved: unknown[] = [];
    const h = page(item => saved.push(item));
    await h.settle();
    await h.click(h.button('Weigh yours'));
    await h.click(h.button('Add to meal', { exact: true }));
    expect(saved).toEqual([expect.objectContaining({ gramsPerPortion: 40 })]);
    expect(saved[0]).not.toHaveProperty('weighed');
  });
  it('refuses a weight that can’t be right, saying so, and saves nothing', async () => {
    const saved: unknown[] = [];
    const h = page(item => saved.push(item));
    await h.settle();
    await h.click(h.button('Weigh yours'));
    await h.change(h.field('One roti weighs, in grams'), { value: '0' });
    await h.click(h.button('Add to meal', { exact: true }));
    expect(saved).toEqual([]);
    expect(h.text()).toContain('That figure can’t be right');
  });
});
