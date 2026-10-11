import { describe, expect, it } from 'vitest';
import { buildFoodData, fdcFoods, fdcRecord, hashOf, patternsOf, unbumped, type FdcExtract, type Ingredient, type Recipe } from './compute';

const source = { name: 'USDA FoodData Central', url: 'https://fdc.nal.usda.gov/', licence: 'CC0 1.0 Universal (public domain)', credit: 'credit', dataset: 'SR Legacy', file: 'f.json', extractedOn: '2026-10-10' };
const fdc: FdcExtract = {
  source,
  records: [
    { fdcId: 1, dataType: 'SR Legacy', description: 'Flour', kcal: 340, carbsG: 72 },
    { fdcId: 2, dataType: 'SR Legacy', description: 'Oil', kcal: 884, carbsG: 0 },
  ],
};
const ing = (over: Partial<Ingredient> & Pick<Ingredient, 'key'>): Ingredient =>
  ({ name: over.key, aliases: [], fdc: null, contains: [], mayContain: [], carbVariance: 0, ...over });
const INGREDIENTS: Ingredient[] = [
  ing({ key: 'flour', name: 'Wheat flour', aliases: ['atta'], fdc: 'Flour', contains: ['wheat'], carbVariance: 0.1 }),
  ing({ key: 'oil', fdc: 'Oil' }),
  ing({ key: 'salt' }),
  ing({ key: 'hing', mayContain: ['wheat'] }),
  ing({ key: 'water', water: true }),
];
const paratha: Recipe = {
  id: 'paratha', rev: 1, name: 'Plain paratha', aliases: ['parantha'], shelf: 'breads', slots: ['breakfast'],
  portion: { unit: 'piece', grams: 60, count: 1, noun: ['paratha', 'parathas'] }, yieldG: 60,
  ingredients: [['flour', 40], ['oil', 5], ['salt', 1], ['water', 20]], note: 'Home-style, 1 tsp oil',
};
const build = (recipes: Recipe[], ingredients = INGREDIENTS) => buildFoodData({ fdc, ingredients, recipes });

describe('buildFoodData (journey §11.6, B-12)', () => {
  it('works out per-100 g values from the ingredients over the cooked yield', () => {
    const [f] = build([paratha]).foods;
    // (40 × 3.40 + 5 × 8.84) = 180.2 kcal over 60 g; 40 × 0.72 = 28.8 g carbs over 60 g.
    expect(f.per100g.kcal).toBe(300.3);
    expect(f.per100g.carbsG).toBe(48);
    // ±10% on the flour's carbs only: 25.92 and 31.68 g over 60 g.
    expect(f.per100g.carbsLowG).toBe(43.2);
    expect(f.per100g.carbsHighG).toBe(52.8);
  });
  it('keeps the recipe beside the dish, with each ingredient’s FDC id, and counts nothing for a seasoning', () => {
    const [f] = build([paratha]).foods;
    expect(f.recipe.ingredients).toEqual([
      { key: 'flour', name: 'Wheat flour', grams: 40, fdcId: 1 },
      { key: 'oil', name: 'oil', grams: 5, fdcId: 2 },
      { key: 'salt', name: 'salt', grams: 1, fdcId: null },
      { key: 'water', name: 'water', grams: 20, fdcId: null },
    ]);
    expect(f.recipe.note).toBe('Home-style, 1 tsp oil');
    expect(f.recipe.hash).toBe(hashOf(paratha));
    const proxied = build([paratha], INGREDIENTS.map(i => (i.key === 'oil' ? { ...i, proxy: 'Stands in for an oil FDC lacks.' } : i))).foods[0];
    expect(proxied.recipe.ingredients[1]).toEqual({ key: 'oil', name: 'oil', grams: 5, fdcId: 2, proxy: 'Stands in for an oil FDC lacks.' });
  });
  it('tags allergens from the ingredients, “may contain” apart from “contains”', () => {
    expect(build([paratha]).foods[0].allergens).toEqual({ contains: ['wheat'], mayContain: [], complete: true, named: true });
    const dal: Recipe = { ...paratha, id: 'dal', ingredients: [['oil', 5], ['hing', 0.1], ['water', 55]] };
    expect(build([dal]).foods[0].allergens).toEqual({ contains: [], mayContain: ['wheat'], complete: true, named: true });
    // In Plan 5's order, once each, and never "may contain" what it contains.
    const rai = ing({ key: 'rai', contains: ['mustard'] });
    const maida = ing({ key: 'maida', fdc: 'Flour', contains: ['wheat'] });
    const tadka: Recipe = { ...paratha, id: 'tadka', ingredients: [['rai', 0.5], ['hing', 0.1], ['flour', 40], ['maida', 5]] };
    expect(build([tadka], [...INGREDIENTS, rai, maida]).foods[0].allergens).toEqual({ contains: ['wheat', 'mustard'], mayContain: [], complete: true, named: true });
  });
  it('isn’t known by name with a blend in it, though its allergens are tagged (B-13, K7-02)', () => {
    const masala = ing({ key: 'masala', blend: true, mayContain: ['mustard'] });
    expect(build([{ ...paratha, ingredients: [['flour', 40], ['masala', 1]] }], [...INGREDIENTS, masala]).foods[0].allergens)
      .toEqual({ contains: ['wheat'], mayContain: ['mustard'], complete: true, named: false });
  });
  it('lists every word the dish and its ingredients go by, for custom allergies', () => {
    expect(build([paratha]).foods[0].words).toEqual(expect.arrayContaining(['paratha', 'parantha', 'wheat', 'flour', 'atta']));
  });
  it('refuses inputs it can’t trust, naming every problem at once', () => {
    const bad: Recipe[] = [
      { ...paratha, id: 'Bad Id', yieldG: 50 },
      { ...paratha, id: 'heavy', ingredients: [['salt', 5]] },
      { ...paratha, id: 'missing', ingredients: [['ghee', 5]] },
    ];
    expect(() => build(bad)).toThrow(/Bad Id: the id[\s\S]*yieldG 50 isn't count × grams \(60\)[\s\S]*salt has no FDC values, so it may be at most 2 g a serving, not 5 g[\s\S]*unknown ingredient ghee/);
    expect(() => build([paratha], [...INGREDIENTS, ing({ key: 'ghee', fdc: 'Butter oil, anhydrous' })])).toThrow(/no FDC record "Butter oil, anhydrous"/);
    expect(() => build([paratha, paratha])).toThrow(/recipe paratha is listed twice/);
    expect(() => build([{ ...paratha, portion: { unit: 'piece', grams: 60, count: 1 } }])).toThrow(/a piece needs a noun/);
    expect(() => build([paratha], [...INGREDIENTS, ing({ key: 'oil', fdc: 'Oil' })])).toThrow(/ingredient oil is listed twice/);
    expect(() => build([{ ...paratha, rev: 0 }])).toThrow(/rev must be a whole number from 1/);
    expect(() => build([{ ...paratha, slots: [] }])).toThrow(/no meal slots/);
    expect(() => build([{ ...paratha, ingredients: [['flour', 0]] }])).toThrow(/flour needs a weight above 0 g/);
  });
});

describe('patternsOf (board D100)', () => {
  it('reads eating patterns from the ingredients', () => {
    expect(patternsOf([{}])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain']);
    expect(patternsOf([{ animal: 'dairy' }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'jain']);
    expect(patternsOf([{ animal: 'egg' }])).toEqual(['eggetarian', 'nonVegetarian']);
    expect(patternsOf([{ animal: 'fish' }])).toEqual(['nonVegetarian']);
    expect(patternsOf([{ root: true }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan']);
    expect(patternsOf([{ animal: 'honey' }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian']);
  });
});

describe('FDC downloads', () => {
  const food = {
    fdcId: 168893, dataType: 'SR Legacy', description: 'Wheat flour, whole-grain', foodNutrients: [
      { nutrient: { number: '268', unitName: 'kJ' }, amount: 1423 },
      { nutrient: { number: '208', unitName: 'kcal' }, amount: 340 },
      { nutrient: { number: '205', unitName: 'g' }, amount: 71.97 },
    ],
  };
  it('finds the food list under whatever top-level key the file uses', () => {
    expect(fdcFoods({ SRLegacyFoods: [food] })).toEqual([food]);
    expect(() => fdcFoods({ Other: 'x' })).toThrow(/No FoodData Central food list/);
  });
  it('reads energy in kcal, never kJ, and carbohydrate by difference (D95)', () => {
    expect(fdcRecord(food)).toEqual({ fdcId: 168893, dataType: 'SR Legacy', description: 'Wheat flour, whole-grain', kcal: 340, carbsG: 71.97 });
    expect(() => fdcRecord({ ...food, foodNutrients: food.foodNutrients.slice(0, 1) })).toThrow(/no energy in kcal or no carbohydrate/);
  });
  it('refuses what isn’t an FDC download or an FDC food, and energy given only in kJ', () => {
    expect(() => fdcFoods(null)).toThrow(/not a FoodData Central JSON download/);
    expect(() => fdcRecord({ description: 'Flour' })).toThrow(/not an FDC food/);
    expect(() => fdcRecord({ ...food, fdcId: '168893' })).toThrow(/not an FDC food/);
    expect(() => fdcRecord({ ...food, description: undefined })).toThrow(/not an FDC food/);
    expect(() => fdcRecord({ ...food, foodNutrients: [{ nutrient: { number: '208', unitName: 'kJ' }, amount: 1423 }, food.foodNutrients[2]] })).toThrow(/no energy in kcal/);
  });
});

describe('unbumped (B-12)', () => {
  it('names a recipe whose content changed while its rev didn’t rise', () => {
    const before = build([paratha]);
    const more = (rev: number) => build([{ ...paratha, rev, ingredients: [['flour', 45], ['oil', 5]] }]);
    expect(unbumped(before, more(1))).toEqual(['paratha']);
    expect(unbumped(before, more(2))).toEqual([]);
    expect(unbumped(before, before)).toEqual([]);
    expect(unbumped(undefined, before)).toEqual([]);
  });
});
