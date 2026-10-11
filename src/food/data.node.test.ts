import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES } from '@/content/sources';
import { EXPECTED } from '../../scripts/food/expected';
import { INGREDIENTS } from '../../scripts/food/ingredients';
import { RECIPES } from '../../scripts/food/recipes';
import { buildFoodData, type FdcExtract } from './compute';
import { FOOD_DATA } from './data';

const fdc = JSON.parse(fs.readFileSync('scripts/food/fdc-ingredients.json', 'utf8')) as FdcExtract;
const committed: unknown = JSON.parse(fs.readFileSync('src/data/food/foods.json', 'utf8'));
const food = (id: string) => FOOD_DATA.foods.find(f => f.id === id)!;

describe('the food table (journey §11.6)', () => {
  it('is exactly what the recipes and the FDC extract give: run scripts/food/build.ts after changing either', () => {
    expect(committed).toEqual(buildFoodData({ fdc, ingredients: INGREDIENTS, recipes: RECIPES }));
  });
  it('is what the app loads', () => {
    expect(FOOD_DATA).toEqual(committed);
  });
  it('starts with 42 common Indian dishes', () => {
    expect(FOOD_DATA.foods).toHaveLength(42);
  });
  it('carries its source, version, licence and credit (board, D45)', () => {
    const s = FOOD_DATA.source;
    expect(s.name).toBe('USDA FoodData Central');
    expect(s.dataset).toBe('SR Legacy');
    expect(s.licence).toMatch(/CC0 1\.0/);
    // FDC's suggested citation, as its home page gave it when the board recorded the source (Plan 7 Task 1).
    expect(s.credit).toBe(`U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central. [Internet]. [cited ${s.extractedOn}]. Available from https://fdc.nal.usda.gov/.`);
    expect(s.file).toMatch(/sr_legacy/i);
    expect(SOURCES.find(x => x.id === 'usda-fdc')?.accessed).toBe(s.extractedOn);
  });
  it('gives every dish a plausible estimate for its standard portion (Review Focus 5: a raw record matched for a cooked one)', () => {
    for (const f of FOOD_DATA.foods) {
      const want = EXPECTED[f.id];
      expect(want, `${f.id} has no line in scripts/food/expected.ts`).toBeDefined();
      const grams = f.portion.count * f.portion.grams;
      const kcal = (f.per100g.kcal * grams) / 100;
      const carbs = (f.per100g.carbsG * grams) / 100;
      expect(Math.abs(kcal - want.kcal), `${f.id}: ${kcal.toFixed(0)} kcal, expected about ${want.kcal}`).toBeLessThanOrEqual(Math.max(want.kcal * 0.2, 5));
      expect(Math.abs(carbs - want.carbsG), `${f.id}: ${carbs.toFixed(1)} g carbs, expected about ${want.carbsG}`).toBeLessThanOrEqual(Math.max(want.carbsG * 0.2, 1));
      expect(f.per100g.carbsLowG).toBeLessThanOrEqual(f.per100g.carbsG);
      expect(f.per100g.carbsHighG).toBeGreaterThanOrEqual(f.per100g.carbsG);
    }
  });
  it('says why each stand-in FDC record stands in', () => {
    for (const i of INGREDIENTS) if (i.proxy !== undefined) expect(i.proxy.length, i.key).toBeGreaterThan(20);
  });
  it('tags allergens from the ingredients (D99)', () => {
    expect(food('dahi').allergens.contains).toEqual(['milk']);
    expect(food('roti').allergens.contains).toEqual(['wheat']);
    expect(food('poha').allergens.contains).toEqual(expect.arrayContaining(['peanut', 'mustard']));
    expect(food('sambar').allergens.mayContain).toContain('wheat');
    expect(food('rice').allergens).toEqual({ contains: [], mayContain: [], complete: true });
    expect(food('coconut-chutney').words).toContain('coconut');
    expect(FOOD_DATA.foods.every(f => f.allergens.complete)).toBe(true);
  });
  it('derives eating patterns: no meat for vegetarians, no dairy for vegans, no root vegetables for Jain (D100)', () => {
    expect(food('chicken-curry').patterns).toEqual(['nonVegetarian']);
    expect(food('boiled-egg').patterns).toEqual(['eggetarian', 'nonVegetarian']);
    expect(food('dahi').patterns).not.toContain('vegan');
    expect(food('aloo-gobhi').patterns).not.toContain('jain');
    expect(food('mixed-veg-sabzi').patterns).toContain('jain');
  });
});
