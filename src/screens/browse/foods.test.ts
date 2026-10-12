import { describe, expect, it } from 'vitest';
import { allergyAnswer } from '@/food/allergens';
import { FOODS } from '@/food/data';
import type { FoodPreferences } from '@/types/profile';
import type { SetupRecord } from '@/types/setup';
import type { BrowseResults } from './browse';
import { FOOD_ROWS_MAX, foodRows, listsFoods, withFoods } from './foods';

describe('Browse’s food rows (journey §14, D115)', () => {
  it('finds the roti for “chapatti”, opening “Log a meal” at its portion', () => {
    const [roti] = foodRows('chapatti', FOODS, { show: false });
    expect(roti).toMatchObject({ kind: 'food', id: 'roti', to: '/hub/food/log?food=roti' });
    expect(roti.detail).not.toMatch(/kcal|carbs|Estimated/);
    expect(foodRows('chapatti', FOODS, { show: true, ranges: false })[0].detail).toMatch(/· Estimated \d+ kcal$/);
  });

  it('lists at most 6, and none for nothing typed', () => {
    expect(foodRows('a', FOODS, { show: false }).length).toBeLessThanOrEqual(FOOD_ROWS_MAX);
    // “ch” starts a dozen foods' words: six are listed.
    expect(foodRows('ch', FOODS, { show: false })).toHaveLength(FOOD_ROWS_MAX);
    expect(foodRows('dal', FOODS, { show: false }).length).toBeGreaterThan(0);
    expect(foodRows('  ', FOODS, { show: false })).toEqual([]);
  });

  it('adds them under Eat, in Browse’s group order, and changes nothing without them', () => {
    const results: BrowseResults = { groups: [{ id: 'learn', title: 'Learn', rows: [{ kind: 'shortcut', id: 'today-log', title: 'Today’s log', to: '/day/today' }] }], partial: false };
    const rows = foodRows('chapatti', FOODS, { show: false });
    const merged = withFoods(results, rows);
    expect(merged.groups.map(g => g.id)).toEqual(['eat', 'learn']);
    expect(merged.groups[0].rows).toEqual(rows);
    expect(withFoods(results, [])).toBe(results);
  });

  it('puts them after Eat’s own rows, its categories and meal ideas', () => {
    const idea = { kind: 'meal' as const, id: 'l-roti-dal-sabzi', title: 'Roti, dal and sabzi', detail: 'Lunch', to: '/hub/food/ideas/l-roti-dal-sabzi' };
    const found: BrowseResults = { groups: [{ id: 'eat', title: 'Eat', rows: [{ ...idea, result: { ...idea, matched: ['chapatti'], missing: [] } }] }], partial: false };
    expect(withFoods(found, foodRows('chapatti', FOODS, { show: false })).groups[0].rows.map(r => r.id)).toEqual(['l-roti-dal-sabzi', 'roti']);
  });

  it('drops a partial result’s part-matches: a food with every word typed is the answer, as beside a category', () => {
    const topic = { kind: 'topic' as const, id: 'rice-roti', title: 'Rice, roti and millets', detail: 'Grains', to: '/hub/learn/topic/rice-roti' };
    const partial: BrowseResults = {
      groups: [{ id: 'learn', title: 'Learn', rows: [{ ...topic, result: { ...topic, matched: ['roti'], missing: ['chapatti'] } }] }],
      partial: true,
    };
    const rows = foodRows('chapatti', FOODS, { show: false });
    expect(withFoods(partial, rows)).toEqual({ groups: [{ id: 'eat', title: 'Eat', rows }], partial: false });
  });
});

describe('who Browse lists foods to log for (D115; the owner’s allergy rule, Plan 5’s D194)', () => {
  const food = (more: Partial<FoodPreferences>): FoodPreferences => ({ pattern: 'vegetarian', avoid: [], ...more });
  // As the screen asks: by the one allergy answer Browse's meal ideas wait for.
  const lists = (f: FoodPreferences | undefined, setup?: SetupRecord) => listsFoods(f, allergyAnswer(f, setup));

  it('someone who logs meals, once they have said what they are allergic to, “none” included', () => {
    expect(lists(food({ level: 'meals', allergies: [] }))).toBe(true);
    expect(lists(food({ level: 'estimates', allergies: ['peanut'] }))).toBe(true);
    expect(lists(food({ level: 'meals', customAllergies: ['kiwi'] }))).toBe(true);
  });

  it('someone whose record never answered allergies, once setup’s waiting answer has, as meal ideas show then', () => {
    expect(lists(food({ level: 'meals' }), { answers: { allergies: [] } })).toBe(true);
  });

  it('no one whose allergies are unknown: a food record whose allergies were never answered', () => {
    expect(lists(food({ level: 'estimates' }))).toBe(false);
    expect(lists(food({ level: 'meals', hardBefore: 'no' }))).toBe(false);
  });

  it('no one who doesn’t log meals: meal ideas only has no “Log a meal”', () => {
    expect(lists(food({ level: 'ideas', allergies: [] }))).toBe(false);
    expect(lists(food({ allergies: [] }))).toBe(false);
    expect(lists(undefined, { answers: { allergies: [] } })).toBe(false);
  });
});
