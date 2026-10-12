import { describe, expect, it } from 'vitest';
import { commonFoods, searchFoods } from './search';
import type { CustomFood, Food } from './types';

const f = (id: string, name: string, aliases: string[], shelf: Food['shelf'], slots: Food['slots']) => ({ id, name, aliases, shelf, slots }) as Food;
const FOODS = [
  f('roti', 'Roti (whole-wheat)', ['roti', 'chapati', 'chapatti', 'phulka'], 'breads', ['breakfast', 'lunch', 'dinner']),
  f('rajma', 'Rajma', ['rajma', 'kidney beans'], 'dal', ['lunch', 'dinner']),
  f('raita', 'Cucumber raita', ['raita'], 'sides', ['lunch', 'dinner']),
  f('poha', 'Vegetable poha', ['poha', 'pohe'], 'breakfast', ['breakfast', 'snack']),
  f('chai', 'Chai with milk and sugar', ['chai', 'tea'], 'drinks', ['breakfast', 'snack']),
];
const mine: CustomFood[] = [{ id: 'food-1', name: 'Rava dosa from the canteen', per: { qty: 1, unit: 'plate' }, createdAt: '2026-10-01T09:00:00.000+05:30', updatedAt: '2026-10-01T09:00:00.000+05:30' }];

describe('finding a food (journey §11.3)', () => {
  it('matches names and aliases as the person types, the last word as a prefix', () => {
    expect(searchFoods('chapatti', FOODS, []).foods.map(x => x.id)).toEqual(['roti']);
    expect(searchFoods('ra', FOODS, []).foods.map(x => x.id)).toEqual(['rajma', 'raita']);
    expect(searchFoods('kidney', FOODS, []).foods.map(x => x.id)).toEqual(['rajma']);
  });
  it('puts the person’s own foods first, and finds nothing for nothing typed', () => {
    expect(searchFoods('rava', FOODS, mine)).toEqual({ customs: mine, foods: [] });
    expect(searchFoods('  ', FOODS, mine)).toEqual({ customs: [], foods: [] });
  });
  it('lists common foods for the meal, shelf by shelf', () => {
    expect(commonFoods(FOODS, 'breakfast').map(x => x.id)).toEqual(['roti', 'poha', 'chai']);
    expect(commonFoods(FOODS, 'lunch').map(x => x.id)).toEqual(['roti', 'rajma', 'raita']);
  });
});

describe('finding a food: the other rules (mutation-checked)', () => {
  const more = [f('jowar-roti', 'Jowar roti (bhakri)', ['jowar roti', 'bhakri'], 'breads', ['lunch']), ...FOODS];
  it('puts a whole-name match first, then a name that starts with the word, then any other', () => {
    expect(searchFoods('roti', more, []).foods.map(x => x.id)).toEqual(['roti', 'jowar-roti']);
    const dals = [f('dal-makhani', 'Dal makhani', [], 'dal', ['dinner']), f('toor-dal', 'Toor dal', ['dal'], 'dal', ['lunch'])];
    expect(searchFoods('dal', dals, []).foods.map(x => x.id)).toEqual(['toor-dal', 'dal-makhani']);
    const chais = [f('masala-chai', 'Masala chai', [], 'drinks', ['snack']), f('chai-latte', 'Chai latte', [], 'drinks', ['snack'])];
    expect(searchFoods('chai', chais, []).foods.map(x => x.id)).toEqual(['chai-latte', 'masala-chai']);
  });
  it('lists only the person’s own foods that match', () => {
    expect(searchFoods('roti', FOODS, mine).customs).toEqual([]);
  });
  it('orders common foods by shelf, whatever the table’s order', () => {
    expect(commonFoods([...FOODS].reverse(), 'breakfast').map(x => x.id)).toEqual(['roti', 'poha', 'chai']);
  });
  it('needs every earlier word whole, and only the last as a prefix', () => {
    expect(searchFoods('kidney be', FOODS, []).foods.map(x => x.id)).toEqual(['rajma']);
    expect(searchFoods('kid beans', FOODS, []).foods).toEqual([]);
  });
  it('lists at most 12 common foods', () => {
    const many = Array.from({ length: 13 }, (_, i) => f(`food-${i}`, `Food ${i}`, [], 'snacks', ['snack']));
    expect(commonFoods(many, 'snack')).toHaveLength(12);
  });
});
