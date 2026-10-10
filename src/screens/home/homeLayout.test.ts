import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const { answerOffer, changeHome, layoutNow } = await import('./homeLayout');
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

/** P01's Check, full: Glucose, BP, Back & leg, Labs, then Weight as the fill-in. */
const FULL: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'bp', 'back', 'labs', 'weight'], learn: [] }, hidden: [] };

describe('answerOffer: offered once, never added silently (journey §5.1)', () => {
  it('“Not now” records the offer and leaves Home alone', async () => {
    await store.setSettings({ home: DEFAULTS });
    expect((await answerOffer(DEFAULTS, 'water', false)!).ok).toBe(true);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
    expect(store.getState().settings.home).toEqual(DEFAULTS);
  });
  it('“Add” puts the tile at the end of its group, and records the offer in the same write', async () => {
    await store.setSettings({ home: DEFAULTS });
    expect((await answerOffer(DEFAULTS, 'water', true)!).ok).toBe(true);
    expect(store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'water']);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
  });
  it('writes nothing when the group filled meanwhile, so the offer stays to answer', async () => {
    await store.setSettings({ home: FULL });
    expect(answerOffer(FULL, 'water', true)).toBeUndefined();
    expect(store.getState().settings.homeOffered).toBeUndefined();
  });
  it('builds on the stored layout, not the defaults, and keeps every earlier answer', async () => {
    const withWaist: HomeLayout = { ...DEFAULTS, order: { ...DEFAULTS.order, check: ['weight', 'sleep', 'waist'] } };
    await store.setSettings({ home: withWaist, homeOffered: ['glucose'] });
    expect((await answerOffer(DEFAULTS, 'water', true)!).ok).toBe(true);
    expect(store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'waist', 'water']);
    expect(store.getState().settings.homeOffered).toEqual(['glucose', 'water']);
  });
  it('“Add” for a tile already on Home, added from Browse meanwhile, only records the answer', async () => {
    const withWater: HomeLayout = { ...DEFAULTS, order: { ...DEFAULTS.order, check: ['weight', 'sleep', 'water'] } };
    await store.setSettings({ home: withWater });
    expect((await answerOffer(DEFAULTS, 'water', true)!).ok).toBe(true);
    expect(store.getState().settings.home).toEqual(withWater);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
  });
  it('a double tap records the answer once', async () => {
    await store.setSettings({ home: DEFAULTS });
    await Promise.all([answerOffer(DEFAULTS, 'water', false), answerOffer(DEFAULTS, 'water', false)]);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
  });
});

/** Another open copy of the app, a second tab, on the same database: its own store and its own Home code. */
async function copy(factory: IDBFactory) {
  vi.resetModules();
  const copyStore = await import('@/store/useStore');
  const home = await import('./homeLayout');
  const layout = await import('./layout');
  copyStore.resetForTests();
  await copyStore.start({ factory, broadcast: null });
  return { store: copyStore, home, layout };
}

describe('two open copies, and a change behind a failed one (codex H4-03)', () => {
  it('two copies adding different tiles from the same start keep both', async () => {
    const factory = fakeIndexedDB();
    const a = await copy(factory);
    expect((await a.store.setSettings({ home: DEFAULTS })).ok).toBe(true);
    const b = await copy(factory);
    expect((await a.home.changeHome(DEFAULTS, l => a.layout.addTile(l, 'waist'))!.saved).ok).toBe(true);
    // B still shows the start: it adds Water to that.
    expect((await b.home.changeHome(DEFAULTS, l => b.layout.addTile(l, 'water'))!.saved).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
    expect(a.store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'waist', 'water']);
  });

  it('two copies answering different offers from the same start keep both answers', async () => {
    const factory = fakeIndexedDB();
    const a = await copy(factory);
    expect((await a.store.setSettings({ home: DEFAULTS })).ok).toBe(true);
    const b = await copy(factory);
    expect((await a.home.answerOffer(DEFAULTS, 'water', false)!).ok).toBe(true);
    expect((await b.home.answerOffer(DEFAULTS, 'waist', true)!).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
    const { settings } = a.store.getState();
    expect([...(settings.homeOffered ?? [])].sort()).toEqual(['waist', 'water']);
    expect(settings.home?.order.check).toEqual(['weight', 'sleep', 'waist']);
  });

  it('an Add where the other copy has since filled the group: nothing is written, and the offer stays to answer', async () => {
    const ROOM: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'bp', 'back', 'labs'], learn: [] }, hidden: [] };
    const factory = fakeIndexedDB();
    const a = await copy(factory);
    expect((await a.store.setSettings({ home: ROOM })).ok).toBe(true);
    const b = await copy(factory);
    expect((await a.home.changeHome(ROOM, l => a.layout.addTile(l, 'weight'))!.saved).ok).toBe(true);
    // B still shows room for one more: its Add is checked again where it is written.
    const answered = await b.home.answerOffer(ROOM, 'water', true)!;
    expect(answered).toEqual({ ok: true, value: false });
    expect((await b.store.reload()).ok).toBe(true);
    const { settings } = b.store.getState();
    expect(settings.home?.order.check).toEqual(['glucose', 'bp', 'back', 'labs', 'weight']);
    expect(settings.homeOffered ?? []).not.toContain('water');
  });

  it('a change waiting behind one that fails is made to what is stored, never carrying the failed one forward', async () => {
    const refuseWaist = (storeName: string, value: Record<string, unknown>) =>
      (storeName === 'settings' && JSON.stringify(value).includes('"waist"') ? new DOMException('Refused.', 'UnknownError') : undefined);
    const factory = fakeIndexedDB({ failWrite: refuseWaist });
    const a = await copy(factory);
    expect((await a.store.setSettings({ home: DEFAULTS })).ok).toBe(true);
    const first = a.home.changeHome(DEFAULTS, l => a.layout.addTile(l, 'waist'))!;
    const second = a.home.changeHome(DEFAULTS, l => a.layout.addTile(l, 'water'))!;
    expect((await first.saved).ok).toBe(false);
    expect((await second.saved).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
    expect(a.store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'water']);
  });
});
