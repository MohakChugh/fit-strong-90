/**
 * The food answers setup keeps while "How do you eat?" waits (H5R-10,
 * K5R-01, H5-20; board D192), through the real screens over the real store:
 * whatever sets the pattern later takes the allergies, the logging level and
 * the screening answer into the new food record. How meal ideas read the
 * waiting allergies meanwhile is Plan 7's (its D205). Only the router, the
 * sheet and the browser's globals are stand-ins.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

const where = vi.hoisted(() => ({ pathname: '/hub/food/ideas' }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: where.pathname, search: '', state: null }),
    useParams: () => ({ mealId: 'b-poha' }),
    useSearchParams: () => [new URLSearchParams('chapter=food'), () => {}],
    useViewTransitionState: () => false,
    Navigate: () => null,
    Link: ({ children, to }: { children?: unknown; to: string }) => h('a', { href: `#${to}` }, children as never),
    // Me's editor asks before leaving with health answers not stored (board D198); nothing here leaves.
    useBlocker: () => ({ state: 'unblocked', proceed() {}, reset() {} }),
  };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => false }));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock('sonner', () => ({ toast: Object.assign((text: string) => void toasts.push(text), { success() {}, warning() {}, error() {} }) }));

const title = { focused: 0, focus() { title.focused += 1; } };
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: {
    title: '', activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, body: { nodeType: 1 },
    // The screen's title, where focus goes once a row it was on has gone.
    querySelector: (selector: string) => (selector === 'main h1' ? title : null),
  },
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  Element: class {}, HTMLElement: class {},
});

const store = await import('@/store/useStore');
const { completedSetup } = await import('@/setup/assemble');
const { MINIMAL } = await import('@/setup/fixtures');
const { resetSetupSessionForTests } = await import('@/setup/draft');
const { resetClinicalUnsavedForTests } = await import('@/setup/effective');
const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026, hasSteps: false };
/** "How do you eat?" skipped; a peanut allergy, meals only, and "Yes" to food having been hard. */
const { pattern: _skipped, ...WAITING } = { ...MINIMAL, allergies: ['peanut' as const], foodLevel: 'meals' as const, hardBefore: 'yes' as const };
void _skipped;

const radioIn = (host: Host, label: string): HostNode => {
  const found = host.all().find(n => n.type === 'label' && n.children.some(c => typeof c !== 'string' && c.children.some(x => typeof x !== 'string' && x.children.includes(label))));
  if (!found) throw new Error(`no choice “${label}”`);
  return found;
};

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
  resetClinicalUnsavedForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  expect((await store.update(d => completedSetup(d, WAITING, NOW, CTX))).ok).toBe(true);
  expect(store.getState().profile?.food).toBeUndefined();
});

describe('the food answers waiting for an eating pattern go into the record that takes one (H5R-10, K5R-01, H5-20; board D192)', () => {
  it('Meal ideas’ own food question makes a record with every waiting answer in it', async () => {
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    await host.click(radioIn(host, 'Vegetarian'));
    const form = host.all().find(n => n.type === 'form')!;
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
    await host.settle();
    expect(store.getState().profile?.food).toMatchObject({ pattern: 'vegetarian', allergies: ['peanut'], level: 'meals', hardBefore: 'yes' });
    host.unmount();
  });

  it('so does the Sample week’s', async () => {
    const { default: SampleWeekScreen } = await import('./SampleWeekScreen');
    const host = render(createElement(SampleWeekScreen));
    await host.settle();
    await host.click(host.all().find(n => n.props.onClick && JSON.stringify(n.children).includes('What you eat'))!);
    await host.click(radioIn(host, 'Vegetarian'));
    const form = host.all().find(n => n.type === 'form')!;
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
    await host.settle();
    expect(store.getState().profile?.food).toMatchObject({ pattern: 'vegetarian', allergies: ['peanut'], level: 'meals', hardBefore: 'yes' });
    host.unmount();
  });

  it('Me → Food makes a record with every waiting answer in it', async () => {
    const { FoodScreen } = await import('@/screens/you/FoodScreen');
    const host = render(createElement(FoodScreen));
    await host.settle();
    const group = host.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === 'What you eat')!;
    const vegetarian = host.all().find(n => n.props.role === 'radio' && group && JSON.stringify(n.children).includes('Vegetarian'))!;
    await host.click(vegetarian);
    await host.settle();
    expect(store.getState().profile?.food).toMatchObject({ pattern: 'vegetarian', allergies: ['peanut'], level: 'meals', hardBefore: 'yes' });
    host.unmount();
  });

  it('Profile & health’s food chapter does too', async () => {
    const { ChapterEditor } = await import('@/screens/setup/ChapterEditor');
    const host = render(createElement(ChapterEditor, { chapter: 'food' }));
    await host.settle();
    const option = host.all().find(n => n.props.role === 'radio' && JSON.stringify(n.children).includes('Vegetarian'))!;
    await host.click(option);
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.food).toMatchObject({ pattern: 'vegetarian', allergies: ['peanut'], level: 'meals', hardBefore: 'yes' });
    host.unmount();
  });
});

describe('a food record that never answered allergies, as v1’s, asks first, with “No food allergies” one tap away (owner decision; board D194)', () => {
  const V1 = { pattern: 'vegetarian' as const, avoid: [], region: 'north' as const };
  /** A record from v1: food chosen there, and setup's answers with no allergy answer in them. */
  const withV1Record = async () => {
    expect((await store.update(d => {
      const { allergies: _a, customAllergies: _c, ...answers } = d.settings.setup!.answers!;
      void _a;
      void _c;
      return { ...d, profile: { ...d.profile!, food: V1 }, settings: { ...d.settings, setup: { ...d.settings.setup!, answers } } };
    })).ok).toBe(true);
  };
  const MEAL = 'Vegetable poha';

  it('Meal ideas show none until then, and every one after the tap', async () => {
    await withV1Record();
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    expect(host.text()).toContain('Tell us about food allergies first');
    expect(host.text()).not.toContain(MEAL);
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.food).toEqual({ ...V1, allergies: [] });
    expect(host.text()).toContain(MEAL);
    expect(host.text()).not.toContain('Tell us about food allergies first');
    host.unmount();
  });

  it('an idea opened directly says so, and the tap answers it there', async () => {
    await withV1Record();
    const { default: MealDetailScreen } = await import('./MealDetailScreen');
    const host = render(createElement(MealDetailScreen));
    await host.settle();
    expect(host.text()).toContain('Tell us about food allergies first');
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.food?.allergies).toEqual([]);
    expect(host.buttons('No food allergies')).toHaveLength(0);
    host.unmount();
  });

  it('Learn’s search holds meal ideas back until then, and offers the tap', async () => {
    await withV1Record();
    const { default: GuideScreen } = await import('./GuideScreen');
    const host = render(createElement(GuideScreen));
    await host.settle();
    await host.change(host.all().find(n => n.type === 'input' && n.props.type === 'search')!, { value: 'poha' });
    expect(host.text()).not.toContain(MEAL);
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    expect(host.text()).toContain(MEAL);
    host.unmount();
  });

  it('the Food hub’s ideas for this meal ask first too, and show after the tap', async () => {
    await withV1Record();
    where.pathname = '/hub/food';
    try {
      const { default: FoodHubScreen } = await import('@/screens/food/FoodHubScreen');
      const host = render(createElement(FoodHubScreen));
      await host.settle();
      expect(host.text()).toContain('Tell us about food allergies first');
      await host.click(host.button('No food allergies', { exact: true }));
      await host.settle();
      expect(host.text()).not.toContain('Tell us about food allergies first');
      expect(host.all().filter(n => n.type === 'a' && /^#\/hub\/food\/ideas\/./.test(String(n.props.href))).length).toBeGreaterThan(0);
      host.unmount();
    } finally {
      where.pathname = '/hub/food/ideas';
    }
  });

  it('Me → Food offers it while the record never answered, and not after', async () => {
    await withV1Record();
    const { FoodScreen } = await import('@/screens/you/FoodScreen');
    const host = render(createElement(FoodScreen));
    await host.settle();
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    expect(store.getState().profile?.food).toEqual({ ...V1, allergies: [] });
    expect(host.buttons('No food allergies')).toHaveLength(0);
    host.unmount();
  });

  it('with no record and no answer anywhere, the tap is setup’s answer, kept for the record to come', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    store.resetForTests();
    resetSetupSessionForTests();
    await store.start({ factory: fakeIndexedDB(), broadcast: null });
    expect((await store.update(lookedAround)).ok).toBe(true);
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    expect(host.text()).not.toContain(MEAL);
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    expect(store.getState().settings.setup?.draft?.answers?.allergies).toEqual([]);
    expect(host.text()).toContain(MEAL);
    host.unmount();
  });
});

describe('a food record with no allergy answer of its own is filtered by setup’s (H5R-10; board D205)', () => {
  const V1 = { pattern: 'vegetarian' as const, avoid: [], region: 'north' as const };
  const MEAL = 'Vegetable poha';
  // Setup's finished answer, Peanuts; the food record, from v1, never answered allergies.
  beforeEach(async () => {
    expect((await store.update(d => ({ ...d, profile: { ...d.profile!, food: V1 } }))).ok).toBe(true);
    expect(store.getState().settings.setup?.answers?.allergies).toEqual(['peanut']);
  });

  it('meal ideas leave out a dish with peanuts', async () => {
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    expect(host.text()).not.toContain('Tell us about food allergies first');
    expect(host.text()).toContain('Moong dal chilla');
    expect(host.text()).not.toContain(MEAL);
    host.unmount();
  });

  it('so does Learn’s search', async () => {
    const { default: GuideScreen } = await import('./GuideScreen');
    const host = render(createElement(GuideScreen));
    await host.settle();
    await host.change(host.all().find(n => n.type === 'input' && n.props.type === 'search')!, { value: 'poha' });
    expect(host.text()).not.toContain(MEAL);
    await host.change(host.all().find(n => n.type === 'input' && n.props.type === 'search')!, { value: 'chilla' });
    expect(host.text()).toContain('Moong dal chilla');
    host.unmount();
  });
});

describe('a “No food allergies” tap answers only what it was shown (H5F-07, H5F-12; board D221)', () => {
  const V1 = { pattern: 'vegetarian' as const, avoid: [], region: 'north' as const };
  /** A record whose food, from v1, never answered allergies, nor did setup; and the store's database, for another window to write to. */
  const v1Record = async () => {
    store.resetForTests();
    resetSetupSessionForTests();
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    expect((await store.update(d => {
      const done = completedSetup(d, WAITING, NOW, CTX);
      const { allergies: _a, customAllergies: _c, ...answers } = done.settings.setup!.answers!;
      void [_a, _c];
      return { ...done, profile: { ...done.profile!, food: V1 }, settings: { ...done.settings, setup: { ...done.settings.setup!, answers } } };
    })).ok).toBe(true);
    return fake;
  };
  /** Another window of FitStrong writing this record, unseen here until reloaded. */
  const elsewhere = async (fake: ReturnType<typeof fakeIndexedDB>, change: Record<string, unknown>) => {
    const { openDb } = await import('@/store/db');
    const { commitChange } = await import('@/store/snapshot');
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change }))).ok).toBe(true);
    tab.close();
  };
  const open = async () => {
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    return host;
  };

  it('a peanut allergy another window added meanwhile stays, and the tap says why it wasn’t saved', async () => {
    const { ALLERGIES_CHANGED } = await import('@/setup/draft');
    const fake = await v1Record();
    const host = await open();
    const tap = host.button('No food allergies', { exact: true });
    await elsewhere(fake, { profile: { ...store.getState().profile!, food: { ...V1, allergies: ['peanut'] } } });
    toasts.length = 0;
    await host.click(tap);
    await host.settle();
    expect(host.text()).toContain(ALLERGIES_CHANGED);
    expect(toasts).toEqual([]);
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().profile?.food?.allergies).toEqual(['peanut']);
    host.unmount();
  });

  it('so does one in a backup restored meanwhile with Replace', async () => {
    const { REPLACED } = await import('@/store/useStore');
    const fake = await v1Record();
    const host = await open();
    const tap = host.button('No food allergies', { exact: true });
    const s = store.getState();
    await elsewhere(fake, { reset: true, schemaVersion: 6, settings: { replace: s.settings }, profile: { ...s.profile!, food: { ...V1, allergies: ['peanut'] } } });
    await host.click(tap);
    await host.settle();
    expect(host.text()).toContain(REPLACED);
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().profile?.food?.allergies).toEqual(['peanut']);
    host.unmount();
  });

  it('and setup’s waiting answer: one added there meanwhile stays', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    const { ALLERGIES_CHANGED } = await import('@/setup/draft');
    store.resetForTests();
    resetSetupSessionForTests();
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    expect((await store.update(lookedAround)).ok).toBe(true);
    const host = await open();
    const tap = host.button('No food allergies', { exact: true });
    const s = store.getState();
    await elsewhere(fake, { settings: { patch: { setup: { ...s.settings.setup!, draft: { at: 'food.allergies', answers: { allergies: ['peanut'] } } } } } });
    await host.click(tap);
    await host.settle();
    expect(host.text()).toContain(ALLERGIES_CHANGED);
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft?.answers?.allergies).toEqual(['peanut']);
    host.unmount();
  });

  it('and own words another window typed that aren’t an answer yet stay too', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    const { ALLERGIES_CHANGED } = await import('@/setup/draft');
    store.resetForTests();
    resetSetupSessionForTests();
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    expect((await store.update(lookedAround)).ok).toBe(true);
    const host = await open();
    const tap = host.button('No food allergies', { exact: true });
    const s = store.getState();
    const typed = `peanut, ${'k'.repeat(61)}`;
    await elsewhere(fake, { settings: { patch: { setup: { ...s.settings.setup!, draft: { at: 'food.allergies', answers: {}, raw: { customAllergies: typed } } } } } });
    await host.click(tap);
    await host.settle();
    expect(host.text()).toContain(ALLERGIES_CHANGED);
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft?.raw?.customAllergies).toBe(typed);
    host.unmount();
  });

  it('and setup’s on a record replaced meanwhile', async () => {
    const { lookedAround } = await import('@/setup/assemble');
    const { REPLACED } = await import('@/store/useStore');
    store.resetForTests();
    resetSetupSessionForTests();
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    expect((await store.update(lookedAround)).ok).toBe(true);
    const host = await open();
    const tap = host.button('No food allergies', { exact: true });
    const s = store.getState();
    await elsewhere(fake, { reset: true, schemaVersion: 6, settings: { replace: { ...s.settings, setup: { ...s.settings.setup!, draft: { at: 'food.allergies', answers: { allergies: ['peanut'] } } } } } });
    await host.click(tap);
    await host.settle();
    expect(host.text()).toContain(REPLACED);
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft?.answers?.allergies).toEqual(['peanut']);
    host.unmount();
  });

  it('stored, the row goes, focus goes to the screen’s title, and it says so (H5F-12)', async () => {
    await v1Record();
    const { FoodScreen } = await import('@/screens/you/FoodScreen');
    const host = render(createElement(FoodScreen));
    await host.settle();
    toasts.length = 0;
    title.focused = 0;
    await host.click(host.button('No food allergies', { exact: true }));
    await host.settle();
    await new Promise(r => setTimeout(r, 10));
    expect(host.buttons('No food allergies')).toHaveLength(0);
    expect(toasts).toEqual(['Saved: no food allergies.']);
    expect(title.focused).toBe(1);
    host.unmount();
  });
});

describe('the one tap, wherever the answer lives (owner decision; board D194)', () => {
  it('while setup goes on without saving, it is this session’s answer', async () => {
    const { answerNoAllergies, continueWithoutSaving, getSetupSession } = await import('@/setup/draft');
    continueWithoutSaving('food.allergies', { customAllergies: ['kiwi'] });
    expect(await answerNoAllergies()).toBeUndefined();
    expect(getSetupSession().answers).toMatchObject({ allergies: [] });
    expect(getSetupSession().answers.customAllergies).toBeUndefined();
  });

  it('with setup finished and no food record, it is setup’s finished answer', async () => {
    const { answerNoAllergies } = await import('@/setup/draft');
    expect((await store.update(d => {
      const { allergies: _a, ...answers } = d.settings.setup!.answers!;
      void _a;
      return { ...d, settings: { ...d.settings, setup: { ...d.settings.setup!, answers } } };
    })).ok).toBe(true);
    expect((await answerNoAllergies())?.ok).toBe(true);
    expect(store.getState().settings.setup?.answers?.allergies).toEqual([]);
  });

  it('with no profile, it goes with this visit’s food choices', async () => {
    const { saveFood, saveNoAllergies } = await import('./useGuide');
    store.resetForTests();
    resetSetupSessionForTests();
    await store.start({ factory: fakeIndexedDB(), broadcast: null });
    expect(await saveFood({ pattern: 'vegan', avoid: [] })).toBeUndefined();
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    expect(host.text()).toContain('Tell us about food allergies first');
    expect(await saveNoAllergies()).toBeUndefined();
    await host.settle();
    expect(host.text()).not.toContain('Tell us about food allergies first');
    expect(store.getState().profile).toBeUndefined();
    host.unmount();
  });
});
