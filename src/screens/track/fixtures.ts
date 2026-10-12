/**
 * Records for Track's tests, shaped like the ones the app writes. Imported by
 * tests only; nothing in the app reads this file.
 */

import type { WorkoutSession, WorkoutSet } from '@/types';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import type { Observation } from '@/health/observation';

export function obs(over: Partial<Observation> & Pick<Observation, 'id'>): Observation {
  const at = over.at ?? '2026-10-08T07:42:10.000+05:30';
  return {
    kind: 'glucose',
    at,
    day: at.slice(0, 10),
    value: 112,
    unit: 'mg/dL',
    scope: 'pointInTime',
    source: 'manual',
    ...over,
  };
}

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [],
};

export function checkIn(date: string, over: Partial<CheckInRecord> = {}): CheckInRecord {
  return { date, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness, ...over };
}

export function set(exerciseId: string, status: WorkoutSet['status'] = 'completed', n = 1): WorkoutSet {
  return {
    id: `${exerciseId}-${n}`, exerciseId, setNumber: n, plannedReps: 10,
    actualReps: status === 'completed' ? 10 : null, weight: status === 'completed' ? 20 : null, status, rpe: null,
  };
}

export function session(over: Partial<WorkoutSession> & Pick<WorkoutSession, 'id' | 'date'>): WorkoutSession {
  return {
    dayOfWeek: 'thursday',
    muscleGroup: 'lower',
    phase: 'foundation',
    week: 2,
    status: 'completed',
    sets: [],
    startedAt: null,
    completedAt: null,
    notes: '',
    totalVolume: 0,
    ...over,
  };
}
