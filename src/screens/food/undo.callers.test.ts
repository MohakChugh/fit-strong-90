/**
 * H7-15 (B-04, D113): Plan 7's food Undo ended when a detail opened from
 * Today's log, or the usual-meal logging detail, closed. Through the real
 * store, the food deletes Plan 7's screens call, and the one Undo stack, with
 * sonner a stand-in and each navigation told to `followPlace` as `main.tsx`'s
 * router subscription tells it: two meals deleted from details opened from
 * Today's log stand together back on the log, either restored first; and the
 * same for two usual meals around a logging detail opened from Usual meals.
 * And what they say when something else happened first: a meal no longer
 * stored, one already put back another way, one restored from Recently
 * deleted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';

type Shown = { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { deleteMealWithUndo, deleteUsualWithUndo } = await import('./undo');
const { dismissUndoFor, followPlace, resetUndosForTests } = await import('@/components/hig/undo');
const { saveMeal } = await import('@/food/store');
const { mealsIn, savedMealsIn } = await import('@/food/records');
const { NOT_RECENT, RECENT_PREFIX, isRecentKey } = await import('@/store/recent');

const AT = '2026-10-08T13:10:00.000+05:30';
const meal = (id: string, slot: 'lunch' | 'dinner') => ({
  id, at: AT, day: '2026-10-08', meal: slot, items: [{ kind: 'quick' as const, size: 'normal' as const, name: 'Normal plate' }], level: 'meals' as const, loggedAt: AT, edits: [],
});
const usual = (id: string, name: string) => ({ id, name, items: [{ kind: 'quick' as const, size: 'normal' as const, name: 'Normal plate' }], savedAt: AT, updatedAt: AT });
const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const standing = () => [...new Set(sonner.shown.map(s => s.id!))].filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo');
const press = async (id: string) => {
  latest(id).action!.onClick({ preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 0));
};

beforeEach(async () => {
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
  resetUndosForTests();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => store.resetForTests());

describe('food’s Undo stands while details come and go (H7-15, B-04)', () => {
  for (const first of [0, 1]) {
    it(`two meals deleted from details opened from Today’s log both stand, and either comes back first (${first === 0 ? 'lunch' : 'dinner'} first)`, async () => {
      expect((await saveMeal(meal('meal-lunch', 'lunch'))).ok).toBe(true);
      expect((await saveMeal(meal('meal-dinner', 'dinner'))).ok).toBe(true);
      followPlace({ path: '/day/today' });
      // Lunch's detail, opened from the log, deleted: the sheet goes back to the log.
      followPlace({ path: '/hub/food/log?edit=meal-lunch', from: '/day/today' });
      expect(await deleteMealWithUndo(meal('meal-lunch', 'lunch'), '/day/today')).toBeUndefined();
      followPlace({ path: '/day/today' });
      // Another meal's detail, opened and closed, and deleted too.
      followPlace({ path: '/hub/food/log?edit=meal-dinner', from: '/day/today' });
      expect(standing()).toHaveLength(1);
      expect(await deleteMealWithUndo(meal('meal-dinner', 'dinner'), '/day/today')).toBeUndefined();
      followPlace({ path: '/day/today' });
      expect(standing()).toHaveLength(2);
      expect(mealsIn(store.getState().records)).toEqual([]);
      const [lunch, dinner] = standing();
      await press(first === 0 ? lunch : dinner);
      expect(standing()).toEqual([first === 0 ? dinner : lunch]);
      await press(standing()[0]);
      expect(standing()).toEqual([]);
      expect(mealsIn(store.getState().records).map(m => m.restoredFrom).sort()).toEqual(['meal-dinner', 'meal-lunch']);
    });
  }

  it('two usual meals deleted around a logging detail opened from Usual meals both stand, either first', async () => {
    expect((await store.putRecords('savedMeals', [usual('usual-1', 'Weekday lunch'), usual('usual-2', 'Sunday lunch')])).ok).toBe(true);
    followPlace({ path: '/hub/food/usual' });
    expect(await deleteUsualWithUndo(usual('usual-1', 'Weekday lunch'), '/hub/food/usual')).toBeUndefined();
    // The usual meal's logging detail, opened from the list and closed.
    followPlace({ path: '/hub/food/log?usual=usual-2', from: '/hub/food/usual' });
    followPlace({ path: '/hub/food/usual' });
    expect(await deleteUsualWithUndo(usual('usual-2', 'Sunday lunch'), '/hub/food/usual')).toBeUndefined();
    expect(standing()).toHaveLength(2);
    const [weekday, sunday] = standing();
    await press(sunday);
    expect(standing()).toEqual([weekday]);
    await press(weekday);
    expect(savedMealsIn(store.getState().records).map(u => u.restoredFrom).sort()).toEqual(['usual-1', 'usual-2']);
  });
});

describe('what a food delete and its Undo say (B-04, K8-03)', () => {
  /** The Recently deleted entry the one delete made. */
  const entryOf = () => Object.keys(store.getState().contentState).filter(isRecentKey).map(k => k.slice(RECENT_PREFIX.length))[0];

  it('a meal that is no longer stored isn’t deleted: why is said, and no Undo is offered', async () => {
    expect(await deleteMealWithUndo(meal('meal-gone', 'lunch'), '/day/today')).toMatch(/\S/);
    expect(standing()).toEqual([]);
  });

  it('an Undo whose meal came back another way says why it wasn’t restored, beside Undo again', async () => {
    expect((await saveMeal(meal('meal-lunch', 'lunch'))).ok).toBe(true);
    expect(await deleteMealWithUndo(meal('meal-lunch', 'lunch'), '/day/today')).toBeUndefined();
    const [offer] = standing();
    // Restored in another tab, whose Recently deleted this one's Undo doesn't hear about.
    expect((await store.restoreDeleted(entryOf())).ok).toBe(true);
    await press(offer);
    expect(latest(offer)).toMatchObject({ text: expect.stringContaining(`It wasn’t restored. ${NOT_RECENT}`), action: { label: 'Undo' } });
    expect(mealsIn(store.getState().records)).toHaveLength(1);
  });

  it('belongs to its entry: restored from Recently deleted, its Undo goes', async () => {
    expect((await saveMeal(meal('meal-lunch', 'lunch'))).ok).toBe(true);
    expect(await deleteMealWithUndo(meal('meal-lunch', 'lunch'), '/day/today')).toBeUndefined();
    expect(standing()).toHaveLength(1);
    dismissUndoFor(entryOf());
    expect(standing()).toEqual([]);
  });
});
