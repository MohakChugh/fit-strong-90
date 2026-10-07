import { describe, it, expect } from 'vitest';
import type { AppData, WorkoutSession } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { focusOverrideFor, planFor } from './useGuided';

const profile = createDefaultProfile({ weightKg: 80 });
/** A Monday: Lower A in the default week. */
const MONDAY = '2026-10-05';

const appData = (overrides: Partial<AppData> = {}): AppData => ({
  version: 4,
  settings: { startDate: '2026-09-28' } as AppData['settings'],
  sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], profile,
  ...overrides,
});

describe('planFor (Today, Workout and the guided session)', () => {
  it('runs the workout swapped in on the Workout page for that date only', () => {
    // The swap lived in a ?focus= URL parameter, so /session rebuilt Lower A.
    const data = appData({ focusOverrides: { [MONDAY]: 'upperB' } });
    expect(planFor(data, profile, MONDAY)).toMatchObject({ focus: 'upperB', label: 'Upper B · Pull-Down & Press' });
    expect(planFor(data, profile, '2026-10-12').focus).toBe('lowerA');
  });

  it('ignores a stored swap the swap dialog no longer offers', () => {
    const data = appData({ focusOverrides: { [MONDAY]: 'push' } });
    expect(focusOverrideFor(data, profile, MONDAY)).toBeUndefined();
    expect(planFor(data, profile, MONDAY).focus).toBe('lowerA');
  });

  it("builds a day's plan from earlier sessions only, so its own logs never reshuffle it", () => {
    const plan = planFor(appData(), profile, MONDAY);
    const lift = plan.exercises.find(e => e.rx.load.note === 'firstTime')!;
    const logged = (date: string): WorkoutSession => ({
      id: date, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed',
      sets: [1, 2].map(n => ({ id: `${date}-${n}`, exerciseId: lift.exerciseId, setNumber: n, plannedReps: 10, actualReps: 10, weight: 40, status: 'completed', rpe: null })),
      startedAt: null, completedAt: null, notes: '', totalVolume: 800,
    });

    expect(planFor(appData({ sessions: [logged(MONDAY)] }), profile, MONDAY)).toEqual(plan);
    // The same sets a week earlier do feed it.
    const later = planFor(appData({ sessions: [logged('2026-09-28')] }), profile, MONDAY);
    expect(later.exercises.find(e => e.exerciseId === lift.exerciseId)?.rx.load).toEqual({ kg: 40, note: 'same' });
  });
});
