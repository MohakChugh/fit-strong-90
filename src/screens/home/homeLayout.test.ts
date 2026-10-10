import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import type { HomeLayout } from '@/types';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { changeHome, layoutNow } = await import('./homeLayout');
const { addTile } = await import('./layout');

/** P02's defaults: no conditions, so Move, Food, then the fill-ins. */
const DEFAULTS: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'sleep'], learn: ['learn'] }, hidden: [] };

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB() });
});

describe('changing Home from Browse or Me (journey §5.1, §14; Review Focus 1)', () => {
  it('starts from the defaults while no layout is stored, never from an empty Home', async () => {
    expect(layoutNow(DEFAULTS)).toBe(DEFAULTS);
    const changed = changeHome(DEFAULTS, l => addTile(l, 'waist'));
    expect((await changed!.saved).ok).toBe(true);
    expect(store.getState().settings.home).toEqual({ ...DEFAULTS, order: { ...DEFAULTS.order, check: ['weight', 'sleep', 'waist'] } });
  });
  it('builds on the stored layout, a change still being written included', async () => {
    const first = changeHome(DEFAULTS, l => addTile(l, 'waist'));
    const second = changeHome(DEFAULTS, l => addTile(l, 'water'));
    await Promise.all([first!.saved, second!.saved]);
    expect(store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'waist', 'water']);
  });
  it('writes nothing when the operation changes nothing', () => {
    expect(changeHome(DEFAULTS, l => l)).toBeUndefined();
  });
});
