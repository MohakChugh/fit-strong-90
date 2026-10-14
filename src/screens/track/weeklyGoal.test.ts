import { describe, expect, it } from 'vitest';
import { pendingWeeklyGoal, weeklyGoalChanges, weeklyGoalOn, withWeeklyGoal, type WeeklyGoalSettings } from './weeklyGoal';

// Thursday 8 October 2026: its week runs from Monday 5 to Sunday 11 October.
const MON = '2026-10-05';
const THU = '2026-10-08';
const SUN = '2026-10-11';
const NEXT_MON = '2026-10-12';

describe('the weekly goal by the week (B-16, journey §12.5)', () => {
  it('a first goal applies from this week; earlier weeks keep having none', () => {
    const s = withWeeklyGoal({}, 150, THU);
    expect(s.weeklyMovementGoalMinutes).toBe(150);
    expect(s.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }]);
    expect(weeklyGoalOn(s, MON)).toBe(150);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, '2026-10-04')).toBeUndefined();
  });

  it('a change mid-week waits for Monday, and this week keeps its goal (Review Focus 2)', () => {
    const s = withWeeklyGoal(withWeeklyGoal({}, 150, '2026-10-06'), 200, THU);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, SUN)).toBe(150);
    expect(weeklyGoalOn(s, NEXT_MON)).toBe(200);
    expect(pendingWeeklyGoal(s, THU)).toEqual({ from: NEXT_MON, goal: 200 });
    expect(s.weeklyMovementGoalMinutes).toBe(200);
  });

  it('removing a goal mid-week also waits for Monday', () => {
    const s = withWeeklyGoal(withWeeklyGoal({}, 150, MON), undefined, THU);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, NEXT_MON)).toBeUndefined();
    expect(pendingWeeklyGoal(s, THU)).toEqual({ from: NEXT_MON });
    expect(s.weeklyMovementGoalMinutes).toBeUndefined();
  });

  it('a second change before Monday replaces the first; choosing this week’s goal again cancels it', () => {
    const twice = withWeeklyGoal(withWeeklyGoal(withWeeklyGoal({}, 150, MON), 200, THU), 250, '2026-10-09');
    expect(twice.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }, { from: NEXT_MON, goal: 250 }]);
    const back = withWeeklyGoal(twice, 150, '2026-10-10');
    expect(back.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }]);
    expect(pendingWeeklyGoal(back, '2026-10-10')).toBeUndefined();
    expect(back.weeklyMovementGoalMinutes).toBe(150);
  });

  it('v1’s undated goal holds for every earlier week, and is given no date', () => {
    const legacy: WeeklyGoalSettings = { weeklyMovementGoalMinutes: 120 };
    expect(weeklyGoalOn(legacy, '2025-01-01')).toBe(120);
    const s = withWeeklyGoal(legacy, 180, THU);
    expect(s.weeklyMovementGoalHistory).toEqual([{ from: '', goal: 120 }, { from: NEXT_MON, goal: 180 }]);
    expect(weeklyGoalOn(s, '2025-01-01')).toBe(120);
    expect(weeklyGoalOn(s, THU)).toBe(120);
    expect(weeklyGoalOn(s, NEXT_MON)).toBe(180);
  });

  it('ignores history this app could not have written (an imported file)', () => {
    const s = {
      weeklyMovementGoalMinutes: 150,
      weeklyMovementGoalHistory: [{ from: '2026-10-07', goal: 90 }, { from: 'soon', goal: 60 }, { from: MON, goal: -5 }],
    } as unknown as WeeklyGoalSettings;
    // Not a Monday, not a day, not a goal: none is usable, so the stored goal stands as v1's did.
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalChanges(s)).toEqual([]);
  });

  it('weeklyGoalChanges: the valid changes, oldest first, v1’s undated goal first of all', () => {
    const s = { weeklyMovementGoalHistory: [{ from: NEXT_MON }, { from: '', goal: 120 }, { from: MON, goal: 150 }] } as WeeklyGoalSettings;
    expect(weeklyGoalChanges(s)).toEqual([{ from: '', goal: 120 }, { from: MON, goal: 150 }, { from: NEXT_MON }]);
    expect(weeklyGoalChanges(undefined)).toEqual([]);
  });

  it('a goal chosen in the week a removal began applies at once, in the removal’s place', () => {
    const removed = withWeeklyGoal(withWeeklyGoal({}, 150, MON), undefined, THU);
    const s = withWeeklyGoal(removed, 120, '2026-10-13');
    expect(s.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }, { from: NEXT_MON, goal: 120 }]);
    expect(weeklyGoalOn(s, '2026-10-13')).toBe(120);
    expect(pendingWeeklyGoal(s, '2026-10-13')).toBeUndefined();
  });

  it('a goal is whole minutes above zero: a fraction or a zero from a file is no goal', () => {
    const s = { weeklyMovementGoalMinutes: 150, weeklyMovementGoalHistory: [{ from: MON, goal: 1.5 }, { from: NEXT_MON, goal: 0 }] } as WeeklyGoalSettings;
    expect(weeklyGoalChanges(s)).toEqual([]);
    expect(weeklyGoalOn({ weeklyMovementGoalMinutes: 1.5 }, THU)).toBeUndefined();
  });

  it('a removal is stored as a change with no goal at all', () => {
    const s = withWeeklyGoal(withWeeklyGoal({}, 150, MON), undefined, THU);
    expect(s.weeklyMovementGoalHistory?.[1]).toStrictEqual({ from: NEXT_MON });
  });
});
