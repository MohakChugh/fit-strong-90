import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserSettings } from '@/types';

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
const { finishTitle, notNow, setupProgress } = await import('./progress');

const settings = {} as UserSettings;
/** Every answer given: without diabetes, a medicines review also answers the SGLT2 question. */
const answered = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
const rows = (profile: Parameters<typeof setupProgress>[0]['profile'], s = settings) => setupProgress({ profile, settings: s }).map(c => [c.chapter, c.detail, c.why]);

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB() });
});

describe('setupProgress until Plan 5 (journey §6.6, §16)', () => {
  it('has nothing open when the answers are complete', () => {
    expect(setupProgress({ profile: answered, settings })).toEqual([]);
  });
  it('opens Your health for someone with no answers yet', () => {
    expect(setupProgress({ profile: undefined, settings })).toEqual([
      { chapter: 'health', label: 'Your health', detail: 'Answer the health questions before you move', href: '/me/profile', why: 'gap' },
    ]);
  });
  it('opens Your health for answers carried over from v1 and not yet reviewed', () => {
    expect(rows({ ...answered, needsHealthReview: true })).toEqual([['health', 'Your health answers need a review', 'gap']]);
  });
  it('opens Your medicines when diabetes medicines were never answered: movement waits on it', () => {
    expect(rows(createDefaultProfile({ weightKg: 70, health: { diabetes: 'type2', medicinesReviewed: false } }))).toEqual([['medicines', 'Medicines: not yet reviewed', 'gap']]);
  });
  it('opens Your medicines for the SGLT2 question nobody answered, as skipped: nothing is held on it', () => {
    expect(rows(createDefaultProfile({ weightKg: 70 }))).toEqual([['medicines', 'One medicine question to answer', 'skipped']]);
  });
  it('leaves out a chapter answered “Not now”', () => {
    expect(rows(undefined, { setup: { declined: ['health'] } } as UserSettings)).toEqual([]);
  });
  it('counts the chapters in the group’s title (journey §6.6)', () => {
    expect(finishTitle(1)).toBe('Finish setting up · 1 short chapter');
    expect(finishTitle(2)).toBe('Finish setting up · 2 short chapters');
  });
});

describe('notNow (journey §6.6)', () => {
  it('keeps each chapter once, and a setting written at the same moment survives', async () => {
    await Promise.all([notNow('health'), store.setSettings({ theme: 'dark' }), notNow('health'), notNow('food')]);
    expect((await store.reload()).ok).toBe(true);
    const s = store.getState().settings;
    expect(s.setup?.declined).toEqual(['health', 'food']);
    expect(s.theme).toBe('dark');
  });
});
