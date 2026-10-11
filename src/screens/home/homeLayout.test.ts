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

describe('what Home’s tiles read after setup (K5-18)', () => {
  it('keeps "Not sure" about pain, which only setup’s answers hold: Back & leg stays relevant, and Me can offer it', async () => {
    const { homeAnswers } = await import('./homeLayout');
    const { relevantCategories } = await import('@/categories');
    const { createDefaultProfile } = await import('@/profile/defaults');
    const settings = { ...store.getState().settings, onboardingComplete: true, setup: { stage: 'done' as const, skipped: [], answers: { conditions: { pain: 'unsure' as const } } } };
    const profile = createDefaultProfile({ weightKg: 70 });
    expect(relevantCategories(homeAnswers(profile, settings, false))).toContain('back');
    expect(relevantCategories(homeAnswers(profile, { ...settings, setup: { ...settings.setup, answers: { conditions: { pain: 'no' as const } } } }, false))).not.toContain('back');
  });
});
