import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { FoodPreferences } from '@/types/profile';
import { foodPromptTime, promptDefault } from './prompts';

const person = (food: Partial<FoodPreferences>) => createDefaultProfile({ food: { pattern: 'vegetarian', avoid: [], ...food } });

describe('the food prompt (journey §7.4, A-73; board D103)', () => {
  it('is one meal at one time, with estimates only', () => {
    expect(foodPromptTime(person({ level: 'estimates', logReminder: { meal: 'lunch', at: '14:30' } }))).toEqual({ habit: 'foodLog', meal: 'lunch', minute: 870 });
  });
  it('is never there counts-free, with ideas only, when off, or with a time it can’t read (B-11)', () => {
    expect(foodPromptTime(person({ level: 'meals', logReminder: { meal: 'lunch', at: '14:30' } }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'ideas', logReminder: { meal: 'lunch', at: '14:30' } }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'estimates' }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'estimates', logReminder: { meal: 'lunch', at: '2pm' } }))).toBeUndefined();
    expect(foodPromptTime(undefined)).toBeUndefined();
  });
  it('defaults to an hour after the meal’s usual finish, or a fixed hour', () => {
    expect(promptDefault('lunch', { mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:30' } } })).toBe('14:30');
    expect(promptDefault('dinner', { mealWalk: { enabled: true, meals: ['dinner'], finish: { dinner: '23:30' } } })).toBe('00:30');
    expect(promptDefault('breakfast', undefined)).toBe('10:00');
    expect(promptDefault('lunch', undefined)).toBe('14:30');
    expect(promptDefault('dinner', { mealWalk: { enabled: true, meals: [], finish: {} } })).toBe('21:30');
  });
});
