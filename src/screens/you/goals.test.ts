import { describe, expect, it } from 'vitest';
import type { UserSettings } from '@/types';
import { shortDay } from './dates';
import { goalsLine, pendingLine, stepsGoalLines, weeklyGoalLines } from './goals';

const THU = '2026-10-08';
const s = (over: Partial<UserSettings>) => over as UserSettings;

describe('Goals’ lines (journey §16)', () => {
  it('names the goals in force today, or that there are none', () => {
    expect(goalsLine(s({}), THU)).toBe('No goals yet');
    expect(goalsLine(s({ weeklyMovementGoalMinutes: 150, dailyStepsGoal: 6000 }), THU)).toBe('150 min a week · 6,000 steps a day');
    expect(goalsLine(s({ dailyStepsGoal: 6000 }), THU)).toBe('6,000 steps a day');
    // This week's goal, not the change waiting for Monday (B-16).
    const changed = s({ weeklyMovementGoalMinutes: 120, weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12', goal: 120 }] });
    expect(goalsLine(changed, THU)).toBe('150 min a week');
  });
  it('says when a change waits for Monday, and what this week keeps (B-16)', () => {
    expect(pendingLine({ from: '2026-10-12', goal: 120 }, 150)).toBe('From Monday 12 October: 120 min a week. This week keeps 150 min.');
    expect(pendingLine({ from: '2026-10-12' }, 150)).toBe('From Monday 12 October: no weekly goal. This week keeps 150 min.');
    // Never "undefined" (Review Focus 3): a week with no goal says so.
    expect(pendingLine({ from: '2026-10-12', goal: 120 }, undefined)).toBe('From Monday 12 October: 120 min a week. This week has none.');
  });
  it('lists the weekly goal’s history newest first, v1’s undated goal last (Review Focus 3)', () => {
    const settings = s({ weeklyMovementGoalMinutes: 120, weeklyMovementGoalHistory: [{ from: '', goal: 150 }, { from: '2026-10-12', goal: 120 }] });
    expect(weeklyGoalLines(settings)).toEqual([
      { key: '2026-10-12', what: '120 min a week', when: `From ${shortDay('2026-10-12')}` },
      { key: 'undated', what: '150 min a week', when: 'Before then' },
    ]);
    const removed = s({ weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12' }] });
    expect(weeklyGoalLines(removed)[0]).toEqual({ key: '2026-10-12', what: 'No weekly goal', when: `From ${shortDay('2026-10-12')}` });
    expect(weeklyGoalLines(s({ weeklyMovementGoalMinutes: 150 }))).toEqual([]);
  });
  it('lists the steps goal’s history newest first, a removal in words (Review Focus 3)', () => {
    expect(stepsGoalLines(s({ dailyStepsGoalHistory: [{ from: '2026-10-12', goal: 6000 }, { from: '2026-10-13' }] }))).toEqual([
      { key: '2026-10-13', what: 'No steps goal', when: `From ${shortDay('2026-10-13')}` },
      { key: '2026-10-12', what: '6,000 steps a day', when: `From ${shortDay('2026-10-12')}` },
    ]);
  });
});
