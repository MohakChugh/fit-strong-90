/**
 * The food table (generated: `src/data/food/foods.json`) and the person's food
 * records (journey §11, §18.2). Types only.
 */
import type { Pattern, Slot } from '@/content/schema';
import type { AllergenId } from '@/types/profile';
import type { UnitId } from './units';

export type { Slot } from '@/content/schema';

/** Where a food sits in "Common Indian foods", in this order (`SHELVES` in search.ts). */
export type ShelfId = 'breads' | 'breakfast' | 'dal' | 'veg' | 'sides' | 'eggsMeat' | 'snacks' | 'drinks' | 'fruit';

/** A standard portion: one unit's weight in grams (our own table, board D98) and how many units it is. */
export interface Portion {
  unit: UnitId;
  grams: number;
  /** Two idlis, two tablespoons of chutney: what "+" adds at once. */
  count: number;
  /** For `piece`: what one and several are called. */
  noun?: [one: string, many: string];
}

export interface RecipeIngredient {
  key: string;
  name: string;
  grams: number;
  /** `null` for a seasoning or water, which adds nothing (board D96). */
  fdcId: number | null;
  proxy?: string;
}

export interface Food {
  id: string;
  /** Raised when the recipe changes; every logged item keeps the one it used (B-12). */
  rev: number;
  name: string;
  aliases: string[];
  shelf: ShelfId;
  slots: Slot[];
  portion: Portion;
  /** Per 100 g of the dish as served. Carbs are total carbohydrate (D95); the range is the ingredients' own variance (D97). */
  per100g: { kcal: number; carbsG: number; carbsLowG: number; carbsHighG: number };
  allergens: { contains: AllergenId[]; mayContain: AllergenId[]; complete: boolean };
  patterns: Pattern[];
  /** Every word its name, aliases and ingredients go by, folded: what a custom allergy is matched against (B-13). */
  words: string[];
  recipe: { note: string; hash: string; ingredients: RecipeIngredient[] };
}

export interface FoodSource { name: string; url: string; licence: string; credit: string; dataset: string; file: string; extractedOn: string }

export interface FoodData { format: 'fit-strong-food'; version: 1; source: FoodSource; foods: Food[] }

// ---- The person's records (journey §18.2) ----------------------------------

interface ItemBase {
  /** As it was called when logged, so history reads the same if the table changes (D104). */
  name: string;
  /** The estimate when logged. Absent is unknown, never 0 (A-17). */
  kcal?: number;
  carbsG?: number;
}

/** A food from the table: `count × gramsPerPortion` grams, worked out from recipe revision `rev` (B-12). */
export interface FoodItem extends ItemBase {
  kind: 'food';
  foodId: string;
  rev: number;
  unit: UnitId;
  count: number;
  /** One unit's weight: the table's, or the person's own when `weighed`. */
  gramsPerPortion: number;
  weighed?: true;
  carbsLowG?: number;
  carbsHighG?: number;
}

/** `count` portions of one of the person's own foods. */
export interface CustomItem extends ItemBase { kind: 'custom'; customId: string; count: number }

/** "About how much?" with no food named: a plate size, with kcal only if the person gave a number. Never carbs. */
export interface QuickItem extends ItemBase { kind: 'quick'; size: 'small' | 'normal' | 'large' }

export type MealItem = FoodItem | CustomItem | QuickItem;

/** The level a meal was logged at. What's shown never depends on it: B-11 reads the level now. */
export type LoggedLevel = 'meals' | 'estimates';

export interface MealRecord {
  id: string;
  /** When it was eaten, ISO with offset. */
  at: string;
  /** `at`'s local day. */
  day: string;
  meal: Slot;
  items: MealItem[];
  level: LoggedLevel;
  loggedAt: string;
  /** When it was last corrected. */
  editedAt?: string;
  /** Earlier versions, oldest first (A-22). */
  edits: MealEdit[];
  /** Brought back by Undo: the deleted record's id (B-05). */
  restoredFrom?: string;
}

export interface MealEdit { replacedAt: string; at: string; meal: Slot; items: MealItem[] }

export interface SavedMeal {
  id: string;
  name: string;
  meal?: Slot;
  items: MealItem[];
  savedAt: string;
  updatedAt: string;
  restoredFrom?: string;
}

export interface CustomFood {
  id: string;
  name: string;
  /** What one portion is, in the person's words: 1 plate, 100 g. */
  per: { qty: number; unit: string };
  kcal?: number;
  carbsG?: number;
  allergens?: AllergenId[];
  createdAt: string;
  updatedAt: string;
}
