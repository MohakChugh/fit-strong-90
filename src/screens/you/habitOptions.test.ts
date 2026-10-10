import { describe, expect, it } from 'vitest';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import { DEFAULT_SITTING, DEFAULT_WATER, isSetUp, mealProblem, parseGoal, windowProblem, withEnabled } from './habitOptions';

describe('the habit switches', () => {
  const water = { enabled: false, ...DEFAULT_WATER };
  const sitting = { enabled: false, ...DEFAULT_SITTING };

  it('turn a habit straight back on only once it has been set up', () => {
    expect(isSetUp(undefined, 'sittingBreak')).toBe(false);
    expect(isSetUp({ sittingBreak: sitting }, 'sittingBreak')).toBe(true);
    expect(isSetUp({ sittingBreak: { ...sitting, to: sitting.from } }, 'sittingBreak')).toBe(false);
    expect(isSetUp({ mealWalk: { enabled: false, meals: ['lunch'] } }, 'mealWalk')).toBe(false);
    expect(isSetUp({ mealWalk: { enabled: false, meals: ['lunch'], finish: { lunch: '13:30' } } }, 'mealWalk')).toBe(true);
  });

  it('never turn water on without the fluid-limit question answered no', () => {
    expect(isSetUp({ water }, 'water')).toBe(false);
    expect(isSetUp({ water, fluidLimit: true }, 'water')).toBe(false);
    expect(isSetUp({ water, fluidLimit: false }, 'water')).toBe(true);
    expect(isSetUp({ water }, 'water', createDefaultProfile({ health: { fluidRestriction: false } }))).toBe(true);
    expect(isSetUp({ water }, 'water', createDefaultProfile({ health: { fluidRestriction: 'unsure' } }))).toBe(false);
    expect(isSetUp({ water, fluidLimit: false }, 'water', createDefaultProfile({ health: { fluidRestriction: true } }))).toBe(false);
  });

  it('change one habit and keep its setup for next time', () => {
    const habits: HabitSettings = { water: { ...water, enabled: true }, sittingBreak: sitting };
    const off = withEnabled(habits, 'water', false);
    expect(off.water).toEqual({ ...water, enabled: false });
    expect(off.sittingBreak).toBe(sitting);
    expect(withEnabled(habits, 'mealWalk', true)).toBe(habits);
    // A habit never set up is not half-created by its switch.
    expect(withEnabled({}, 'water', true)).toEqual({});
    expect(withEnabled({}, 'sittingBreak', true)).toEqual({});
  });
});

describe('turning a habit on', () => {
  it('starts sitting breaks at ADA\'s every 30 minutes, and water with no goal at all', () => {
    expect(DEFAULT_SITTING.everyMinutes).toBe(30);
    expect('dailyGoalMl' in DEFAULT_WATER).toBe(false);
  });

  it('takes an empty goal as no goal', () => {
    expect(parseGoal('')).toEqual({ ok: true, value: undefined });
    expect(parseGoal('   ')).toEqual({ ok: true, value: undefined });
  });

  it('takes a whole number of ml within sensible bounds, and says what it needs otherwise', () => {
    expect(parseGoal('2000')).toEqual({ ok: true, value: 2000 });
    expect(parseGoal(' 1500 ')).toEqual({ ok: true, value: 1500 });
    for (const bad of ['2 litres', '1.5', '-200', '20000', '50', '2,000']) {
      const parsed = parseGoal(bad);
      expect(parsed.ok, bad).toBe(false);
      if (!parsed.ok) expect(parsed.message).toMatch(/ml/);
    }
  });

  it('refuses a window that could never hold a reminder', () => {
    expect(windowProblem('09:00', '21:00', 120)).toBeUndefined();
    expect(windowProblem('22:00', '02:00', 60)).toBeUndefined();
    expect(windowProblem('09:00', '09:00', 30)).toMatch(/different/);
    expect(windowProblem('09:00', '09:20', 30)).toMatch(/shorter than the gap/);
    expect(windowProblem('', '18:00', 30)).toMatch(/start and an end/);
  });

  it('needs at least one meal, and a time for each', () => {
    expect(mealProblem([], {})).toMatch(/at least one/);
    expect(mealProblem(['lunch'], {})).toMatch(/each meal/);
    expect(mealProblem(['lunch', 'dinner'], { lunch: '13:30' })).toMatch(/each meal/);
    expect(mealProblem(['lunch'], { lunch: '13:30' })).toBeUndefined();
  });

});
