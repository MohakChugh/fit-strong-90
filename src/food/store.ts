/**
 * The food actions (journey §11.3, §18.2): each one stored change, through
 * Plan 6's record stores. A meal's id is made once, when the sheet opens, so
 * a second tap on Save writes the same meal again rather than a second one
 * (Review Focus 1).
 */
import { StoreFailure, type StoreResult } from '@/store/db';
import { sameValue } from '@/store/transfer';
import { nowAt } from '@/health/observation';
import { deleteRecord, freshId, writeRecords } from '@/store/useStore';
import { corrected, customFoodsIn, mealsIn, stored } from './records';
import type { CustomFood, MealRecord, SavedMeal } from './types';

export const newMealId = (): string => freshId('meal-');
export const newUsualId = (): string => freshId('usual-');
export const newCustomId = (): string => freshId('food-');

/** A new meal, with a usual meal and the person's own foods it was saved with, in one change. */
export function saveMeal(meal: MealRecord, extras: { usual?: SavedMeal; customFoods?: readonly CustomFood[] } = {}): Promise<StoreResult> {
  return writeRecords({
    put: {
      meals: [stored(meal)],
      ...(extras.usual ? { savedMeals: [stored(extras.usual)] } : {}),
      ...(extras.customFoods && extras.customFoods.length > 0 ? { customFoods: extras.customFoods.map(stored) } : {}),
    },
  });
}

/**
 * A correction of the meal the sheet opened (A-22), with any own foods added
 * while correcting it. It's worked out against the meal as stored when it's
 * written (board D135, H7-08): one deleted since is never brought back (only
 * restore does that, under a fresh id), and one changed since in any way (a
 * correction, a merged copy) isn't written over: the version checked is the
 * whole record. Either refuses with `conflict`, in the words `describe` gives
 * it; the sheet keeps the draft.
 */
export function saveCorrection(
  editing: MealRecord,
  next: Pick<MealRecord, 'at' | 'meal' | 'items'>,
  now: string,
  options: { customFoods?: readonly CustomFood[]; describe?: (current: MealRecord | undefined) => string } = {},
): Promise<StoreResult> {
  const customFoods = options.customFoods ?? [];
  return writeRecords(records => {
    const current = mealsIn(records).find(m => m.id === editing.id);
    if (!current || !sameValue(current, editing)) {
      throw new StoreFailure('conflict', options.describe?.(current) ?? (current ? 'That meal was changed elsewhere.' : 'That meal was deleted.'));
    }
    return { put: { meals: [stored(corrected(current, next, now))], ...(customFoods.length > 0 ? { customFoods: customFoods.map(stored) } : {}) } };
  });
}

/** A meal deleted at once and kept in Recently deleted for 7 days (B-04, B-05, D109). Resolves with the entry's id; `restoreDeleted` brings it back. */
export const deleteMeal = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'meal', id });

/** A usual meal, the same way. */
export const deleteUsual = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'usualMeal', id });

/** One of the person's own foods, the same way (D111). Each meal keeps its own copy of the food, so none changes. */
export const deleteOwnFood = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'ownFood', id });

/**
 * An own food edited (K7-11): a new version of its definition, under the
 * same id. Its `updatedAt` is the version, so a merge takes the copy changed
 * last. Each meal item keeps its own snapshot of the food and the version it
 * was (Plan 7's fix, board D134), so only meals logged from now on take the
 * change. One deleted since, on another screen or in another tab, is never
 * brought back by an edit: only its Restore does that.
 */
export function editOwnFood(food: CustomFood): Promise<StoreResult> {
  return writeRecords(records => {
    if (!customFoodsIn(records).some(f => f.id === food.id)) {
      throw new StoreFailure('conflict', 'That food was deleted elsewhere, so this wasn’t saved. Nothing was changed.');
    }
    return { put: { customFoods: [stored({ ...food, updatedAt: nowAt() })] } };
  });
}
