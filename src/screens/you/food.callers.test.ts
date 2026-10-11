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

const params = vi.hoisted(() => ({ mealId: 'd-khichdi', q: '' }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/me/food', search: '', state: null, key: 'k0' }),
    useParams: () => ({ mealId: params.mealId }),
    useSearchParams: () => [new URLSearchParams(params.q ? { q: params.q } : {}), () => {}],
    Link: ({ children, to }: { children?: unknown; to?: string }) => h('a', { href: to }, children as never),
    Navigate: () => null,
  };
});
/** Every toast raised, with its id and action, and every one dismissed. */
const toasts = vi.hoisted(() => ({ shown: [] as { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } }[], dismissed: [] as unknown[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, opts: Record<string, unknown> = {}) => void toasts.shown.push({ text, ...opts }), { dismiss: (id?: unknown) => void toasts.dismissed.push(id) }),
}));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
vi.mock('@/screens/hub/HubFrame', async () => {
  const { createElement: h } = await import('react');
  return { HubFrame: ({ children }: { children?: unknown }) => h('main', null, children as never) };
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
  toasts.shown.length = 0;
  toasts.dismissed.length = 0;
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

describe('removing an allergy offers Undo, until you leave Me → Food (K7R-01; board D201)', () => {
  const undo = async (h: Host, text: string) => {
    const t = toasts.shown.find(x => x.text === text);
    if (!t?.action) throw new Error(`no Undo for “${text}”: ${toasts.shown.map(x => x.text).join(' | ')}`);
    expect(t.action.label).toBe('Undo');
    t.action.onClick({ preventDefault() {} });
    await h.settle();
    await new Promise(r => setTimeout(r, 0));
    await h.settle();
    return t;
  };
  it('for a chip: “Peanut removed from your allergies”, and Undo puts it back', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: [], allergies: ['peanut', 'milk'] });
    await h.click(h.all().find(n => n.props.role === 'checkbox' && textOf(n.children) === 'Peanuts')!);
    expect(store.getState().profile?.food?.allergies).toEqual(['milk']);
    await undo(h, 'Peanut removed from your allergies');
    expect(store.getState().profile?.food?.allergies).toEqual(['peanut', 'milk']);
    expect(toasts.shown.map(t => t.text)).toContain('Peanut is back in your allergies');
  });
  it('for your own words, in their place', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: [], customAllergies: ['brinjal', 'chaach'] });
    await h.click(h.button('Remove brinjal'));
    expect(store.getState().profile?.food?.customAllergies).toEqual(['chaach']);
    await undo(h, 'Brinjal removed from your allergies');
    expect(store.getState().profile?.food?.customAllergies).toEqual(['brinjal', 'chaach']);
  });
  it('never twice, when the word was typed in again before Undo', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: [], customAllergies: ['brinjal', 'chaach'] });
    await h.click(h.button('Remove brinjal'));
    await h.change(h.field('Something else'), { value: 'brinjal' });
    // The allergies' own form, the first on the screen: its Add.
    const form = h.all().find(n => n.type === 'form')!;
    await (form.props.onSubmit as (e: { preventDefault(): void }) => Promise<void> | void)({ preventDefault() {} });
    await h.settle();
    expect(store.getState().profile?.food?.customAllergies).toEqual(['chaach', 'brinjal']);
    await undo(h, 'Brinjal removed from your allergies');
    expect(store.getState().profile?.food?.customAllergies).toEqual(['chaach', 'brinjal']);
  });
  it('never for adding one, and ends once you leave the screen', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: [], allergies: ['peanut'] });
    await h.click(h.all().find(n => n.props.role === 'checkbox' && textOf(n.children) === 'Milk')!);
    expect(toasts.shown).toEqual([]);
    await h.click(h.all().find(n => n.props.role === 'checkbox' && textOf(n.children) === 'Peanuts')!);
    const offered = toasts.shown.find(t => t.text === 'Peanut removed from your allergies')!;
    expect(offered.id).toBeDefined();
    host?.unmount();
    host = undefined;
    await new Promise(r => setTimeout(r, 0));
    expect(toasts.dismissed).toContain(offered.id);
  });
});

describe('meal ideas with no food record yet: allergies not known, never none (Plan 5’s D166, D167; board D205)', () => {
  // What setup's 'food.allergies' page keeps when 'food.pattern' was skipped: no food record, the answer waiting.
  const WAITING = { stage: 'done' as const, answers: { allergies: ['peanut' as const], customAllergies: ['brinjal'], skippedPages: ['food.pattern' as const] } };
  const ASK = 'Tell us about food allergies first';
  const ideas = (h: Host) => h.all().map(n => n.props.href).filter((to): to is string => typeof to === 'string' && to.startsWith('/hub/food/ideas/'));
  const person = async (setup?: typeof WAITING) => {
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70 }), settings: { ...prev.settings, ...(setup ? { setup } : {}) } }));
    expect(store.getState().profile?.food).toBeUndefined();
  };
  const shown = async (load: () => Promise<{ default: () => unknown }>) => {
    host = render(createElement((await load()).default as never));
    await host.settle();
    return host;
  };
  it('leave out the allergies setup is keeping: no peanut idea, and nothing asked', async () => {
    await person(WAITING);
    const h = await shown(() => import('@/screens/guide/MealIdeasScreen'));
    expect(ideas(h).length).toBeGreaterThan(0);
    expect(ideas(h)).not.toContain('/hub/food/ideas/b-poha');
    expect(h.text()).not.toContain(ASK);
  });
  it('ask first, with no answer at all, and offer no idea until then', async () => {
    await person();
    const h = await shown(() => import('@/screens/guide/MealIdeasScreen'));
    expect(ideas(h)).toEqual([]);
    expect(h.text()).toContain(ASK);
  });
  it('in search too: no peanut poha with the waiting answer, and asked first with none', async () => {
    params.q = 'poha';
    try {
      await person(WAITING);
      let h = await shown(() => import('@/screens/guide/GuideScreen'));
      expect(ideas(h)).not.toContain('/hub/food/ideas/b-poha');
      expect(h.text()).not.toContain(ASK);
      h.unmount();
      store.resetForTests();
      await store.start({ factory: fakeIndexedDB(), broadcast: null });
      await person();
      h = await shown(() => import('@/screens/guide/GuideScreen'));
      expect(ideas(h)).toEqual([]);
      expect(h.text()).toContain(ASK);
    } finally {
      params.q = '';
    }
  });
  it('on a meal idea’s page: warns from the waiting answer, and asks with none', async () => {
    params.mealId = 'b-poha';
    await person(WAITING);
    let h = await shown(() => import('@/screens/guide/MealDetailScreen'));
    expect(h.text()).toContain('Contains peanut, which you listed as an allergy');
    h.unmount();
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB(), broadcast: null });
    await person();
    h = await shown(() => import('@/screens/guide/MealDetailScreen'));
    expect(h.text()).toContain(ASK);
  });
  it('start the picker from the waiting answer', async () => {
    await person(WAITING);
    const { FoodPicker } = await import('@/screens/guide/FoodPicker');
    host = render(createElement(FoodPicker, { open: true, onOpenChange() {}, canSave: true }));
    await host.settle();
    expect(host.all().find(n => n.props.role === 'checkbox' && textOf(n.children) === 'Peanuts')?.props['aria-checked']).toBe(true);
    expect(host.field('Something else').props.value).toBe('brinjal');
  });
});

describe('how each allergy in your own words is read (K7R-02; board D200)', () => {
  it('says “Read as milk”, or that we don’t know the word, under each', async () => {
    const h = await screen({ pattern: 'vegetarian', avoid: [], customAllergies: ['chaach', 'kumquat', 'jeera'] });
    // The smallest part of the screen that starts with the entry and says more: its row.
    const row = (label: string) => h.all().map(n => textOf(n.children)).filter(t => t.startsWith(label) && t !== label).sort((a, b) => a.length - b.length)[0] ?? '';
    expect(row('chaach')).toContain('Read as milk');
    expect(row('kumquat')).toContain('We don’t know this word, so check every meal yourself');
    expect(row('jeera')).not.toMatch(/Read as|don’t know/);
    const said = h.all().filter(n => n.type === 'span' && textOf(n.children) === 'We don’t know this word, so check every meal yourself');
    expect(said.some(n => String(n.props.className).split(' ').includes('text-caution'))).toBe(true);
  });
  it('says the same while the words are typed in setup’s “Your food”', async () => {
    const { FoodPicker } = await import('@/screens/guide/FoodPicker');
    host = render(createElement(FoodPicker, { open: true, onOpenChange() {}, canSave: true }));
    await host.settle();
    await host.change(host.field('Something else'), { value: 'chaach, kumquat' });
    const note = host.all().find(n => n.props.role === 'status' && textOf(n.children).includes('chaach'))!;
    expect(textOf(note.children)).toBe('chaach: Read as milk. kumquat: We don’t know this word, so check every meal yourself.');
    expect(String(note.props.className)).toContain('text-caution');
  });
  it('gives setup’s allergy and leave-out fields 48 px (K7R-08; §20.4 rule 1)', async () => {
    const { FoodPicker } = await import('@/screens/guide/FoodPicker');
    host = render(createElement(FoodPicker, { open: true, onOpenChange() {}, canSave: true }));
    await host.settle();
    for (const label of ['Something else', 'Leave out (optional)']) {
      expect(String(host.field(label).props.className).split(' '), label).toContain('h-12');
    }
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
    // 12 px from its row however narrow, when it goes below it (K7-08's partial; board D141).
    const row = host.all().find(n => String(n.props.className ?? '').includes('@max-[22rem]:flex-col'))!;
    expect(String(row.props.className).split(' ')).toContain('@max-[22rem]:gap-3');
    expect(String(row.props.className)).not.toContain('gap-0');
    await host.click(remove!);
    expect(store.getState().records.savedMeals).toEqual([]);
  });
});

describe('“Carb figures are rough estimates” on every food screen while carbs are ranges (K7-13)', () => {
  const ROUGH = 'Carb figures are rough estimates. Follow your care team’s plan.';
  const insulin = { diabetes: 'type2', insulin: 'injections_or_pump', medicinesReviewed: true } as const;
  const screens = async () => [
    (await import('@/screens/guide/MealIdeasScreen')).default,
    (await import('@/screens/guide/MealDetailScreen')).default,
    (await import('@/screens/guide/SampleWeekScreen')).default,
    UsualMealsScreen,
  ];
  it('says it on Meal ideas, a meal idea, the sample week and your usual meals', async () => {
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, health: insulin, food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } }) }));
    for (const s of await screens()) {
      host?.unmount();
      host = render(createElement(s));
      await host.settle();
      expect(host.text(), s.name).toContain(ROUGH);
    }
  });
  it('says nothing of the sort without ranges, or with no figures shown', async () => {
    for (const food of [{ level: 'estimates', hardBefore: 'no' }, { level: 'meals' }] as const) {
      await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, health: food.level === 'meals' ? insulin : { medicinesReviewed: true }, food: { pattern: 'vegetarian', avoid: [], ...food } }) }));
      for (const s of await screens()) {
        host?.unmount();
        host = render(createElement(s));
        await host.settle();
        expect(host.text(), s.name).not.toContain(ROUGH);
      }
    }
  });
});

describe('a meal idea outside your allergies says why, in caution ink (K7-14)', () => {
  const caution = (h: Host) => h.all().filter(n => /\btext-caution\b/.test(String(n.props.className ?? ''))).map(n => textOf(n.children));
  it('in the allergy’s own words: “Contains peanut, which you listed as an allergy”', async () => {
    params.mealId = 'b-poha';
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], allergies: ['peanut'] } }) }));
    host = render(createElement((await import('@/screens/guide/MealDetailScreen')).default));
    await host.settle();
    expect(caution(host)).toContain('Contains peanut, which you listed as an allergy');
  });
  it('and for a part whose make-up isn’t known', async () => {
    params.mealId = 's-salad-seeds';
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], allergies: ['soy'] } }) }));
    host = render(createElement((await import('@/screens/guide/MealDetailScreen')).default));
    await host.settle();
    expect(caution(host)).toContain('What’s in it isn’t known. Check it for soy.');
  });
  it('and says nothing for an idea that suits', async () => {
    params.mealId = 'b-idli-sambar';
    await store.update(prev => ({ ...prev, profile: createDefaultProfile({ birthYear: 1970, weightKg: 70, food: { pattern: 'vegetarian', avoid: [], allergies: ['peanut'] } }) }));
    host = render(createElement((await import('@/screens/guide/MealDetailScreen')).default));
    await host.settle();
    expect(caution(host).filter(t => /listed as an allergy|Check it for/.test(t))).toEqual([]);
  });
});
