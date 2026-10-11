/**
 * The food actions (journey §11.3, §18.2): each one stored change, through
 * Plan 6's record stores. A meal's id is made once, when the sheet opens, so
 * a second tap on Save writes the same meal again rather than a second one
 * (Review Focus 1).
 */
import { StoreFailure, type StoreResult } from '@/store/db';
import { sameValue } from '@/store/transfer';
import { freshId, putRecords, removeRecords, writeRecords } from '@/store/useStore';
import { corrected, mealsIn, restored, stored } from './records';
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

export const deleteMeal = (id: string): Promise<StoreResult> => removeRecords('meals', [id]);

/** Undo a meal's delete (B-05): the meal again, under a fresh id. */
export async function restoreMeal(meal: MealRecord): Promise<StoreResult<MealRecord>> {
  const back = restored(meal, newMealId());
  const result = await putRecords('meals', [stored(back)]);
  return result.ok ? { ok: true, value: back } : result;
}

export const deleteUsual = (id: string): Promise<StoreResult> => removeRecords('savedMeals', [id]);

/** Undo a usual meal's delete, under a fresh id. */
export async function restoreUsual(usual: SavedMeal): Promise<StoreResult<SavedMeal>> {
  const back = restored(usual, newUsualId());
  const result = await putRecords('savedMeals', [stored(back)]);
  return result.ok ? { ok: true, value: back } : result;
}
