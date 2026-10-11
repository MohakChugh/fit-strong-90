import { describe, expect, it } from 'vitest';
import { foodById, ingredientByKey } from '@/food/data';
import { MEALS } from './meals';
import { componentKey, MEAL_DISHES } from './mealDishes';

describe('meal ideas as dishes (B-13)', () => {
  it('maps every component of every meal idea, and nothing else', () => {
    const keys = MEALS.flatMap(m => m.components.map(c => componentKey(m.id, c.name)));
    expect(keys.filter(k => !MEAL_DISHES[k])).toEqual([]);
    expect(Object.keys(MEAL_DISHES).filter(k => !keys.includes(k))).toEqual([]);
  });
  it('names only dishes and ingredients the food table has', () => {
    for (const [key, { dishes, also }] of Object.entries(MEAL_DISHES)) {
      for (const id of dishes) expect(foodById(id), `${key}: ${id}`).toBeDefined();
      for (const k of also ?? []) expect(ingredientByKey(k), `${key}: ${k}`).toBeDefined();
    }
  });
  it('says what a component with no dish may carry', () => {
    for (const [key, c] of Object.entries(MEAL_DISHES)) if (c.dishes.length === 0) expect(c.mayContain?.length, key).toBeGreaterThan(0);
  });
});
