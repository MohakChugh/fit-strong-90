import { describe, expect, it } from 'vitest';
import { choiceChanged, isWalkId, liveHref, mealFromSearch, mealStartedLabel, MEAL_STARTED_AGO, newWalkId, setupPlan, walkFromSearch } from './plan';
import type { WalkPlan } from './clock';

const NOW = Date.UTC(2026, 9, 8, 13, 0, 0);
const search = (href: string) => new URLSearchParams(href.slice(href.indexOf('?')));

describe('the live screen address', () => {
  it('carries an after-meal walk across intact', () => {
    const plan: WalkPlan = { kind: 'afterMeal', meal: { which: 'dinner', startedAt: NOW - 20 * 60_000 }, targetMinutes: 10, gps: true, steps: false };
    const href = liveHref('mgh3k2x1-1a2b3c4d', plan);
    expect(href.startsWith('/walk/live?')).toBe(true);
    expect(walkFromSearch(search(href), NOW)).toEqual({ id: 'mgh3k2x1-1a2b3c4d', plan });
  });

  it('carries a plain walk with nothing switched on', () => {
    const plan: WalkPlan = { kind: 'walk', gps: false, steps: false };
    expect(walkFromSearch(search(liveHref('abcd-1234', plan)), NOW)).toEqual({ id: 'abcd-1234', plan });
  });

  it('starts nothing without a well-formed id', () => {
    expect(walkFromSearch(new URLSearchParams('gps=1'), NOW)).toBeUndefined();
    expect(walkFromSearch(new URLSearchParams('id=<script>'), NOW)).toBeUndefined();
  });

  it('drops a meal time that makes no sense, rather than guessing one', () => {
    const at = (mealAt: number | string) => walkFromSearch(new URLSearchParams(`id=abcd-1234&meal=lunch&mealAt=${mealAt}`), NOW)!.plan;
    expect(at('soon')).toEqual({ kind: 'walk', gps: false, steps: false });
    expect(at(NOW - 7 * 3600_000).kind).toBe('walk');
    expect(at(NOW + 3600_000).kind).toBe('walk');
    // A minute or two of clock skew is tolerated, and clamped to now.
    expect(at(NOW + 60_000)).toEqual({ kind: 'afterMeal', meal: { which: 'lunch', startedAt: NOW }, gps: false, steps: false });
    expect(walkFromSearch(new URLSearchParams(`id=abcd-1234&meal=supper&mealAt=${NOW}`), NOW)!.plan.kind).toBe('walk');
  });

  it('drops a target that is not a sensible whole number of minutes', () => {
    for (const target of ['0', '-5', '7.5', '600', 'ten', '']) {
      expect(walkFromSearch(new URLSearchParams(`id=abcd-1234&target=${target}`), NOW)!.plan.targetMinutes).toBeUndefined();
    }
    expect(walkFromSearch(new URLSearchParams('id=abcd-1234&target=15'), NOW)!.plan.targetMinutes).toBe(15);
  });
});

describe('meals', () => {
  it('needs the meal chosen before an after-meal walk can start: none is assumed from the time (J10)', () => {
    const choice = { kind: 'afterMeal' as const, mealAgo: 20, targetMinutes: 10, gps: false, steps: false };
    expect(setupPlan({ ...choice, meal: undefined }, NOW)).toBeUndefined();
    expect(setupPlan({ ...choice, meal: 'breakfast' }, NOW)).toEqual({
      kind: 'afterMeal', meal: { which: 'breakfast', startedAt: NOW - 20 * 60_000 }, targetMinutes: 10, gps: false, steps: false,
    });
  });

  it('builds a plain walk without a meal, and without a target unless one was set', () => {
    expect(setupPlan({ kind: 'walk', meal: 'dinner', mealAgo: 30, gps: true, steps: true }, NOW)).toEqual({ kind: 'walk', gps: true, steps: true });
  });

  it('reads a meal another screen asked for', () => {
    expect(mealFromSearch(new URLSearchParams('meal=dinner'))).toBe('dinner');
    expect(mealFromSearch(new URLSearchParams('meal=feast'))).toBeUndefined();
  });

  it('says when the meal started in words', () => {
    expect(MEAL_STARTED_AGO.map(mealStartedLabel)).toEqual([
      'Just now', '10 minutes ago', '20 minutes ago', '30 minutes ago', '45 minutes ago', '1 hour ago', '1½ hours ago', '2 hours ago',
    ]);
  });
});

describe('walk ids', () => {
  it('are well formed and do not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newWalkId(NOW)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isWalkId(id)).toBe(true);
  });
});

describe('remembered measuring choices', () => {
  it('remembers only a real change', () => {
    expect(choiceChanged(undefined, { gps: false, steps: false })).toBe(false);
    expect(choiceChanged(undefined, { gps: true, steps: false })).toBe(true);
    expect(choiceChanged({ gps: true, steps: true }, { gps: true, steps: true })).toBe(false);
    expect(choiceChanged({ gps: true, steps: true }, { gps: true, steps: false })).toBe(true);
    expect(choiceChanged({ gps: false, steps: true }, { gps: true, steps: true })).toBe(true);
  });
});
