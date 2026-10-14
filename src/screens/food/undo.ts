/**
 * Food's deletes, at once with Undo (B-04, B-05; board D111, D113): each
 * kept 7 days in Recently deleted, its Undo on the one stack every delete
 * shares (`@/components/hig/undo`), scoped to the screen the delete goes back
 * to, so it stands while a detail opened from there comes and goes (H7-15).
 * Resolves with what went wrong, in words, or nothing.
 */
import { offerUndo, type UndoOutcome } from '@/components/hig/undo';
import { FOOD_COPY } from '@/food/copy';
import { SLOT_LABEL } from '@/food/format';
import { deleteMeal, deleteOwnFood, deleteUsual } from '@/food/store';
import type { CustomFood, MealRecord, SavedMeal } from '@/food/types';
import type { StoreResult } from '@/store/db';
import { restoreDeleted } from '@/store/useStore';

const restoring = (entry: string) => async (): Promise<UndoOutcome> => {
  const back = await restoreDeleted(entry);
  return back.ok ? { done: true } : { done: false, problem: back.failure.message };
};

async function withUndo(deleting: Promise<StoreResult<string>>, text: string, restored: string, scope: string): Promise<string | undefined> {
  const result = await deleting;
  if (!result.ok) return result.failure.message;
  offerUndo({ text, restored, scope, entry: result.value, undo: restoring(result.value) });
  return undefined;
}

export const deleteMealWithUndo = (meal: MealRecord, scope: string) =>
  withUndo(deleteMeal(meal.id), FOOD_COPY.deleted(SLOT_LABEL[meal.meal]), FOOD_COPY.restored(SLOT_LABEL[meal.meal]), scope);

export const deleteUsualWithUndo = (usual: SavedMeal, scope: string) =>
  withUndo(deleteUsual(usual.id), FOOD_COPY.removed(usual.name), FOOD_COPY.restored(usual.name), scope);

export const deleteOwnFoodWithUndo = (food: CustomFood, scope: string) =>
  withUndo(deleteOwnFood(food.id), FOOD_COPY.deleted(food.name), FOOD_COPY.restored(food.name), scope);
