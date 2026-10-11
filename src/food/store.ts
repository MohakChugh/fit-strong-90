/**
 * The food actions (journey §11.3, §18.2): each one stored change, through
 * Plan 6's record stores. A meal's id is made once, when the sheet opens, so
 * a second tap on Save writes the same meal again rather than a second one
 * (Review Focus 1).
 */
import type { StoreResult } from '@/store/db';
import { freshId, putRecords, removeRecords, writeRecords } from '@/store/useStore';
import { restored, stored } from './records';
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

/** A corrected meal (`corrected`), with any own foods added while correcting it. */
export function saveCorrection(meal: MealRecord, customFoods: readonly CustomFood[] = []): Promise<StoreResult> {
  return writeRecords({ put: { meals: [stored(meal)], ...(customFoods.length > 0 ? { customFoods: customFoods.map(stored) } : {}) } });
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
