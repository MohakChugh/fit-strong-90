/**
 * The food table, worked out from FoodData Central ingredient values and our
 * own recipes (journey §11.6, B-12; board D95 to D98). Pure: build.ts runs
 * it to write src/data/food/foods.json, and data.node.test.ts runs it again to
 * prove the committed file is what these inputs give.
 *
 * - Values are per 100 g of the dish as served: the ingredients' FDC values
 *   for their weights, over the cooked yield we wrote down.
 * - Carbs are FDC's "Carbohydrate, by difference": total, fibre included.
 * - The carb range adds each ingredient's own variance as an interval. A
 *   portion's variance is added when it's eaten (estimate.ts).
 * - Allergens are the union of the ingredients' tags, each tagged by us. A
 *   dish with a blend isn't known by name, so it isn't `named` (B-13).
 * - Seasonings at 2 g a serving or less have no FDC record and add nothing.
 */
import type { Pattern, Slot } from '@/content/schema';
import { tokens } from '@/content/text';
import { ALLERGEN_IDS, type AllergenId } from '@/types/profile';
import type { Food, FoodData, FoodIngredient, FoodSource, Portion, RecipeIngredient, ShelfId } from './types';

export interface FdcRecord { fdcId: number; dataType: string; description: string; kcal: number; carbsG: number }
export interface FdcExtract { source: FoodSource; records: FdcRecord[] }

export interface Ingredient {
  key: string;
  name: string;
  aliases: string[];
  /** The FDC record, by its exact description; `null` for a seasoning (at most 2 g a serving) or water. */
  fdc: string | null;
  /** Why this FDC record stands in for one FDC doesn't have. */
  proxy?: string;
  contains: readonly AllergenId[];
  mayContain: readonly AllergenId[];
  /**
   * A blend whose make-up isn't known by name (compounded hing): its allergens
   * are tagged, but a dish with one can't be matched against a custom
   * allergy's words, so it isn't `named` (B-13, K7-02).
   */
  blend?: true;
  animal?: 'dairy' | 'egg' | 'fish' | 'meat' | 'honey';
  /** A root vegetable or bulb, which Jain cooking leaves out (D100). */
  root?: true;
  /** How far its carbohydrate may vary from FDC's figure, as a fraction (D97). */
  carbVariance: number;
  /** Any amount, and no values. */
  water?: true;
}

export interface Recipe {
  id: string;
  rev: number;
  name: string;
  aliases: string[];
  shelf: ShelfId;
  slots: Slot[];
  portion: Portion;
  /** The cooked weight of one standard portion: always `portion.count × portion.grams`. */
  yieldG: number;
  ingredients: [key: string, grams: number][];
  note: string;
}

export const SEASONING_MAX_G = 2;
const ENERGY_KCAL = '208';
const CARBOHYDRATE = '205';
const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];
const ALLERGEN_ORDER: readonly AllergenId[] = ALLERGEN_IDS;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const sorted = (ids: readonly AllergenId[]) => [...new Set(ids)].sort((a, b) => ALLERGEN_ORDER.indexOf(a) - ALLERGEN_ORDER.indexOf(b));

/** FDC's food list in one downloaded JSON file, whatever its top-level key ("SRLegacyFoods"). */
export function fdcFoods(json: unknown): unknown[] {
  if (typeof json !== 'object' || json === null) throw new Error('That is not a FoodData Central JSON download.');
  const list = Object.values(json).find((v): v is unknown[] => Array.isArray(v) && typeof (v[0] as { fdcId?: unknown } | undefined)?.fdcId === 'number');
  if (!list) throw new Error('No FoodData Central food list in that file.');
  return list;
}

/** One FDC food as the record kept: energy in kcal (208) and carbohydrate by difference (205), per 100 g. */
export function fdcRecord(food: unknown): FdcRecord {
  const f = (food ?? {}) as { fdcId?: unknown; dataType?: unknown; description?: unknown; foodNutrients?: unknown };
  if (typeof f.fdcId !== 'number' || typeof f.description !== 'string' || !Array.isArray(f.foodNutrients)) throw new Error('That is not an FDC food.');
  const nutrients = f.foodNutrients as { nutrient?: { number?: unknown; unitName?: unknown }; amount?: unknown }[];
  const amount = (number: string, unit?: string) => {
    const n = nutrients.find(x => x.nutrient?.number === number && (unit === undefined || String(x.nutrient?.unitName).toLowerCase() === unit));
    return typeof n?.amount === 'number' ? n.amount : undefined;
  };
  const kcal = amount(ENERGY_KCAL, 'kcal');
  const carbsG = amount(CARBOHYDRATE);
  if (kcal === undefined || carbsG === undefined) throw new Error(`FDC ${f.fdcId} (${f.description}) has no energy in kcal or no carbohydrate.`);
  return { fdcId: f.fdcId, dataType: typeof f.dataType === 'string' ? f.dataType : '', description: f.description, kcal, carbsG };
}

/** The eating patterns a dish suits, from its ingredients (D100). */
export function patternsOf(ingredients: readonly Pick<Ingredient, 'animal' | 'root'>[]): Pattern[] {
  const animal = new Set(ingredients.map(i => i.animal).filter(Boolean));
  const root = ingredients.some(i => i.root);
  return PATTERNS.filter(p => {
    if (p === 'nonVegetarian') return true;
    if (animal.has('meat') || animal.has('fish')) return false;
    if (p === 'eggetarian') return true;
    if (animal.has('egg')) return false;
    if (p === 'vegetarian') return true;
    if (p === 'vegan') return animal.size === 0;
    return !animal.has('honey') && !root;
  });
}

/** A short, stable name for a recipe's content (FNV-1a), so a change without a new rev is caught. */
export function hashOf(recipe: Pick<Recipe, 'portion' | 'yieldG' | 'ingredients'>): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify([recipe.portion, recipe.yieldG, recipe.ingredients])) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildFoodData({ fdc, ingredients, recipes }: { fdc: FdcExtract; ingredients: readonly Ingredient[]; recipes: readonly Recipe[] }): FoodData {
  const problems: string[] = [];
  const byDescription = new Map(fdc.records.map(r => [r.description, r]));
  const byKey = new Map<string, Ingredient>();
  for (const i of ingredients) {
    if (byKey.has(i.key)) problems.push(`ingredient ${i.key} is listed twice`);
    byKey.set(i.key, i);
    if (i.fdc !== null && !byDescription.has(i.fdc)) problems.push(`ingredient ${i.key}: no FDC record "${i.fdc}" in fdc-ingredients.json (run extract-fdc.ts)`);
  }
  const seen = new Set<string>();
  const foods = recipes.map(r => {
    if (seen.has(r.id)) problems.push(`recipe ${r.id} is listed twice`);
    seen.add(r.id);
    return buildFood(r, byKey, byDescription, problems);
  });
  if (problems.length > 0) throw new Error(`The food table can't be built:\n- ${problems.join('\n- ')}`);
  return { format: 'fit-strong-food', version: 1, source: fdc.source, foods, ingredients: ingredients.map(ingredientOf) };
}

/** An ingredient as meal ideas read it (B-13): its words, its tags and the eating patterns it suits. */
function ingredientOf(i: Ingredient): FoodIngredient {
  const contains = sorted(i.contains);
  return {
    key: i.key, name: i.name, words: [...new Set([i.name, ...i.aliases].flatMap(tokens))].sort(),
    contains, mayContain: sorted(i.mayContain).filter(a => !contains.includes(a)),
    ...(i.blend ? { blend: true as const } : {}), patterns: patternsOf([i]),
  };
}

function buildFood(r: Recipe, byKey: ReadonlyMap<string, Ingredient>, byDescription: ReadonlyMap<string, FdcRecord>, problems: string[]): Food {
  const where = `recipe ${r.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) problems.push(`${where}: the id must be lower-case words joined by hyphens`);
  if (!Number.isInteger(r.rev) || r.rev < 1) problems.push(`${where}: rev must be a whole number from 1`);
  if (r.portion.unit === 'piece' && !r.portion.noun) problems.push(`${where}: a piece needs a noun, such as ["roti", "rotis"]`);
  if (Math.abs(r.yieldG - r.portion.count * r.portion.grams) > 1e-9) problems.push(`${where}: yieldG ${r.yieldG} isn't count × grams (${r.portion.count * r.portion.grams})`);
  if (r.slots.length === 0) problems.push(`${where}: no meal slots`);
  let kcal = 0;
  let carbs = 0;
  let low = 0;
  let high = 0;
  const used: Ingredient[] = [];
  const rows: RecipeIngredient[] = [];
  for (const [key, grams] of r.ingredients) {
    const ing = byKey.get(key);
    if (!ing) {
      problems.push(`${where}: unknown ingredient ${key}`);
      continue;
    }
    if (!(grams > 0)) problems.push(`${where}: ${key} needs a weight above 0 g`);
    used.push(ing);
    if (ing.fdc === null) {
      if (!ing.water && grams > SEASONING_MAX_G) problems.push(`${where}: ${key} has no FDC values, so it may be at most ${SEASONING_MAX_G} g a serving, not ${grams} g`);
      rows.push({ key, name: ing.name, grams, fdcId: null });
      continue;
    }
    const rec = byDescription.get(ing.fdc);
    if (!rec) continue; // reported with the ingredients
    const c = (rec.carbsG * grams) / 100;
    kcal += (rec.kcal * grams) / 100;
    carbs += c;
    low += c * (1 - ing.carbVariance);
    high += c * (1 + ing.carbVariance);
    rows.push({ key, name: ing.name, grams, fdcId: rec.fdcId, ...(ing.proxy ? { proxy: ing.proxy } : {}) });
  }
  const per = (n: number, places: number) => round((n * 100) / r.yieldG, places);
  const contains = sorted(used.flatMap(i => i.contains));
  const mayContain = sorted(used.flatMap(i => i.mayContain)).filter(a => !contains.includes(a));
  const words = [...new Set([r.name, ...r.aliases, ...used.flatMap(i => [i.name, ...i.aliases])].flatMap(tokens))].sort();
  return {
    id: r.id, rev: r.rev, name: r.name, aliases: r.aliases, shelf: r.shelf, slots: r.slots, portion: r.portion,
    per100g: { kcal: per(kcal, 1), carbsG: per(carbs, 2), carbsLowG: per(low, 2), carbsHighG: per(high, 2) },
    // Every ingredient carries our tags, so every dish is complete; a blend leaves it unnamed (K7-02).
    allergens: { contains, mayContain, complete: true, named: used.every(i => !i.blend) },
    patterns: patternsOf(used),
    words,
    recipe: { note: r.note, hash: hashOf(r), ingredients: rows },
  };
}

/** Recipes whose content changed while their rev didn't rise (B-12): each must get a new rev. */
export function unbumped(before: Pick<FoodData, 'foods'> | undefined, after: Pick<FoodData, 'foods'>): string[] {
  const old = new Map((before?.foods ?? []).map(f => [f.id, f]));
  return after.foods
    .filter(f => {
      const o = old.get(f.id);
      return o !== undefined && o.recipe.hash !== f.recipe.hash && f.rev <= o.rev;
    })
    .map(f => f.id);
}
