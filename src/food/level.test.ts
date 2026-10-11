import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { FoodPreferences, HealthProfile, UserProfile } from '@/types/profile';
import { afterScreening, carbRanges, countsFree, foodLevel, logsMeals, numbersView } from './level';

const person = (food?: Partial<FoodPreferences>, health: Partial<HealthProfile> = {}): UserProfile => createDefaultProfile({
  health: { medicinesReviewed: true, ...health },
  ...(food ? { food: { pattern: 'vegetarian', avoid: [], ...food } } : {}),
});

describe('food level (journey §11.1)', () => {
  it('reads nothing chosen as meal ideas only (A-20)', () => {
    expect(foodLevel(undefined)).toBe('ideas');
    expect(foodLevel({ pattern: 'vegan', avoid: [] })).toBe('ideas');
    expect(logsMeals(undefined)).toBe(false);
    expect(logsMeals({ pattern: 'vegan', avoid: [], level: 'meals' })).toBe(true);
  });
  it('is counts-free for “meals only, no numbers” (B-11)', () => {
    expect(countsFree(person({ level: 'meals' }))).toBe(true);
    expect(countsFree(person({ level: 'meals', hardBefore: 'no' }))).toBe(true);
    expect(countsFree(person({ level: 'estimates' }))).toBe(false);
    expect(countsFree(person({ level: 'ideas' }))).toBe(false);
    expect(countsFree(undefined)).toBe(false);
  });
  it('is counts-free too after “Yes” or “Prefer not to say” to the screening question, unless estimates were chosen (K7-04; board D133)', () => {
    for (const hardBefore of ['yes', 'preferNot'] as const) {
      expect(countsFree(person({ level: 'ideas', hardBefore })), hardBefore).toBe(true);
      expect(countsFree(person({ hardBefore })), hardBefore).toBe(true);
      expect(countsFree(person({ level: 'meals', hardBefore })), hardBefore).toBe(true);
      expect(countsFree(person({ level: 'estimates', hardBefore })), hardBefore).toBe(false);
    }
    expect(countsFree(person({ level: 'ideas', hardBefore: 'no' }))).toBe(false);
  });
  it('shows numbers only with estimates', () => {
    expect(numbersView(person({ level: 'meals' }))).toEqual({ show: false });
    expect(numbersView(person({ level: 'ideas' }))).toEqual({ show: false });
    expect(numbersView(person({ level: 'estimates' }))).toEqual({ show: true, ranges: false });
    expect(numbersView(person({ level: 'estimates' }, { diabetes: 'type2', insulin: 'injections_or_pump' }))).toEqual({ show: true, ranges: true });
  });
});

describe('carb ranges (K-22)', () => {
  it('with insulin, a sulfonylurea or a meglitinide, "not sure" included', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', insulin: 'injections_or_pump' }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'type2', sulfonylureaOrMeglitinide: true }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'type2', sulfonylureaOrMeglitinide: 'unsure' }))).toBe(true);
  });
  it('with type 1 whatever the insulin answer says, and with either medicine whatever the diabetes answer says', () => {
    expect(carbRanges(person({}, { diabetes: 'type1', insulin: 'none' }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'none', insulin: 'injections_or_pump' }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'prediabetes', sulfonylureaOrMeglitinide: true }))).toBe(true);
  });
  it('while the medicines aren’t known, or the health answers aren’t reviewed', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', medicinesReviewed: false }))).toBe(true);
    expect(carbRanges(createDefaultProfile({ needsHealthReview: true }))).toBe(true);
    expect(carbRanges(undefined)).toBe(true);
  });
  it('not with metformin alone, or without diabetes', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', metformin: true }))).toBe(false);
    expect(carbRanges(person())).toBe(false);
  });
});

describe('after the screening question (journey §6.2 chapter 7, §11.5)', () => {
  it('"No" goes to estimates; "Yes" and "Prefer not to say" recommend meals only and keep estimates', () => {
    expect(afterScreening('no')).toEqual({ recommended: 'estimates', others: [] });
    expect(afterScreening('yes')).toEqual({ recommended: 'meals', others: ['estimates'] });
    expect(afterScreening('preferNot')).toEqual({ recommended: 'meals', others: ['estimates'] });
  });
});
