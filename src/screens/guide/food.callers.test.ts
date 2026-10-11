/**
 * The food answers setup holds while "How do you eat?" waits (H5R-10,
 * K5R-01; board D192), through the real screens over the real store: meal
 * ideas leave the allergies out, and whatever sets the pattern later takes
 * the allergies, the logging level and the screening answer into the new
 * food record. Only the router, the sheet and the browser's globals are
 * stand-ins.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/guide/meals', search: '', state: null }),
    useParams: () => ({ mealId: 'b-poha' }),
    useSearchParams: () => [new URLSearchParams('chapter=food')],
    Navigate: () => null,
    Link: ({ children, to }: { children?: unknown; to: string }) => h('a', { href: `#${to}` }, children as never),
  };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => false }));
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {} }) }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: { title: '', activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, body: { nodeType: 1 } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  Element: class {}, HTMLElement: class {},
});

const store = await import('@/store/useStore');
const { completedSetup } = await import('@/setup/assemble');
const { MINIMAL } = await import('@/setup/fixtures');
const { resetSetupSessionForTests } = await import('@/setup/draft');
const { resetPendingEditsForTests } = await import('@/setup/effective');
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
  resetPendingEditsForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  expect((await store.update(d => completedSetup(d, WAITING, NOW, CTX))).ok).toBe(true);
  expect(store.getState().profile?.food).toBeUndefined();
});

describe('the food answers waiting for an eating pattern (H5R-10, K5R-01; board D192)', () => {
  it('Meal ideas leave the allergy out before a pattern is chosen, and say so', async () => {
    const { default: MealIdeasScreen } = await import('./MealIdeasScreen');
    const host = render(createElement(MealIdeasScreen));
    await host.settle();
    expect(host.text()).toContain('Not chosen yet — every meal is shown, without your allergies');
    expect(host.text()).not.toContain('Vegetable poha');
    host.unmount();
  });

  it('a meal opened directly says it has the allergy in it', async () => {
    const { default: MealDetailScreen } = await import('./MealDetailScreen');
    const host = render(createElement(MealDetailScreen));
    await host.settle();
    expect(host.text()).toContain('Has something you’re allergic to');
    host.unmount();
  });

  it('search leaves the allergy out too', async () => {
    const { contextFromProfile, search } = await import('@/content');
    const { waitingFood } = await import('@/setup/state');
    const { settings, profile } = store.getState();
    const found = (ctx: Parameters<typeof search>[1]) => search('poha', ctx).map(r => r.title);
    expect(found(contextFromProfile(profile))).toContain('Vegetable poha');
    expect(found(contextFromProfile(profile, undefined, undefined, waitingFood(settings, profile)))).not.toContain('Vegetable poha');
  });

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
