/**
 * Me → Food → "Your own foods" (board D111, K7-11) through the real screen,
 * the real store and a fake IndexedDB: Edit opens a food as it is, and Save
 * changes keeps it the same food, a new version of it, while a meal logged
 * with it keeps the copy it was logged with, and an edit of one deleted
 * meanwhile says so and brings nothing back; Delete removes one at once, with
 * Undo. Sonner, the sheet and the screen's frame are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { CustomFood } from '@/food/types';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

type Shown = { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));
vi.mock('react-router-dom', () => ({
  Link: () => null,
  useNavigate: () => () => undefined,
  useLocation: () => ({ pathname: '/me/food/own', search: '', state: null }),
}));
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
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { OwnFoodsScreen } = await import('./OwnFoodsScreen');
const { resetUndosForTests } = await import('@/components/hig/undo');
const { saveMeal } = await import('@/food/store');
const { customFoodsIn, mealsIn, stored } = await import('@/food/records');
const { customItem } = await import('@/food/estimate');
const { FOOD_COPY } = await import('@/food/copy');

const T0 = '2026-10-01T09:00:00.000+05:30';
const BHEL: CustomFood = { id: 'custom-bhel', name: 'bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: T0, updatedAt: T0 };
const THEPLA: CustomFood = { id: 'custom-thepla', name: 'methi thepla', per: { qty: 2, unit: 'piece' }, createdAt: T0, updatedAt: T0 };
const AT = '2026-10-07T08:30:00.000+05:30';
let host: Host;

const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const standing = () => [...new Set(sonner.shown.map(s => s.id!))].filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo');
const foods = () => customFoodsIn(store.getState().records);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T09:00:00.000+05:30'));
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
  resetUndosForTests();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  expect((await store.putRecords('customFoods', [stored(BHEL), stored(THEPLA)])).ok).toBe(true);
  // Yesterday's breakfast, logged with the thepla as it was then.
  expect((await saveMeal({ id: 'meal-1', at: AT, day: '2026-10-07', meal: 'breakfast', items: [customItem(THEPLA, 2)], level: 'meals', loggedAt: AT, edits: [] })).ok).toBe(true);
  host = render(createElement(OwnFoodsScreen));
  await host.settle();
});
afterEach(() => {
  host.unmount();
  store.resetForTests();
  vi.useRealTimers();
});

describe('your own foods, edited and deleted (D111, K7-11)', () => {
  it('Edit opens a food as it is; Save changes keeps it the same food, a new version, and a meal logged with it keeps its own copy', async () => {
    expect(host.text()).toContain('One portion: 2 piece');
    await host.click(host.button('Edit methi thepla'));
    expect(host.field(FOOD_COPY.ownName).props.value).toBe('methi thepla');
    expect(host.field(FOOD_COPY.ownPerQty).props.value).toBe('2');
    expect(host.field(FOOD_COPY.ownPerUnit).props.value).toBe('piece');
    expect(host.buttons(FOOD_COPY.addToMeal)).toEqual([]);
    await host.change(host.field(FOOD_COPY.ownName), { value: 'methi thepla, home' });
    await host.click(host.button('Save changes'));
    const edited = foods().find(f => f.id === THEPLA.id);
    expect(edited).toMatchObject({ name: 'methi thepla, home', per: { qty: 2, unit: 'piece' }, createdAt: T0 });
    expect(edited!.updatedAt).not.toBe(T0);
    expect(foods()).toHaveLength(2);
    expect(mealsIn(store.getState().records)[0].items[0]).toMatchObject({ name: 'methi thepla', version: T0 });
    expect(host.all().some(n => n.props.role === 'dialog')).toBe(false);
    expect(host.text()).toContain('methi thepla, home');
  });

  it('an edit of a food deleted meanwhile, in another tab, says it wasn’t changed and brings nothing back', async () => {
    await host.click(host.button('Edit methi thepla'));
    expect((await store.deleteRecord({ kind: 'ownFood', id: THEPLA.id })).ok).toBe(true);
    await host.settle();
    await host.change(host.field(FOOD_COPY.ownName), { value: 'methi thepla, home' });
    await host.click(host.button('Save changes'));
    expect(host.text()).toContain('methi thepla, home was not changed: That food was deleted elsewhere');
    expect(foods().map(f => f.id)).toEqual([BHEL.id]);
  });

  it('Delete removes one at once, with Undo, and Undo brings it back', async () => {
    await host.click(host.button('Delete bhel puri'));
    expect(foods().map(f => f.id)).toEqual([THEPLA.id]);
    const [offer] = standing();
    expect(latest(offer).text).toBe(FOOD_COPY.deleted('bhel puri'));
    latest(offer).action!.onClick({ preventDefault() {} });
    await host.settle();
    expect(foods()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'bhel puri', restoredFrom: BHEL.id })]));
  });
});
