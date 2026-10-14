import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { FoodPreferences } from '@/types/profile';
import { foodPromptTime, promptDefault, FOOD_PROMPT_DAY_KEY, foodPromptOfferedOn, noteFoodPromptsShown } from './prompts';

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

describe('the day a food prompt was offered (H7-21; board D140)', () => {
  const kept = new Map<string, string>();
  const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
  it('is remembered from a food prompt shown, not from another reminder', () => {
    kept.clear();
    noteFoodPromptsShown([{ habit: 'water', day: '2026-10-08' }], storage);
    expect(foodPromptOfferedOn('2026-10-08', storage)).toBe(false);
    noteFoodPromptsShown([{ habit: 'water', day: '2026-10-08' }, { habit: 'foodLog', day: '2026-10-08' }], storage);
    expect(foodPromptOfferedOn('2026-10-08', storage)).toBe(true);
    expect(foodPromptOfferedOn('2026-10-09', storage)).toBe(false);
    expect(kept.get(FOOD_PROMPT_DAY_KEY)).toBe('2026-10-08');
  });
  it('is remembered while the app is open when the device won’t keep it, so retiming never brings another (H7-21)', () => {
    const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(foodPromptOfferedOn('2026-10-11', refusing)).toBe(false);
    expect(() => noteFoodPromptsShown([{ habit: 'foodLog', day: '2026-10-11' }], refusing)).not.toThrow();
    expect(foodPromptOfferedOn('2026-10-11', refusing)).toBe(true);
    expect(foodPromptOfferedOn('2026-10-11', undefined)).toBe(true);
    expect(foodPromptOfferedOn('2026-10-12', refusing)).toBe(false);
  });
});
