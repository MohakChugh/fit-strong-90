import { describe, expect, it } from 'vitest';
import { newObservation } from './observation';

describe('a walk after a meal (board D26)', () => {
  const walk = { kind: 'walkDuration' as const, value: 10, unit: 'min', scope: 'sessionObserved' as const, at: '2026-10-08T13:40:00+05:30', coverageMs: 600_000, source: 'measured' as const };

  it('carries the meal it followed and when that meal started', () => {
    const o = newObservation({ ...walk, tag: 'afterMeal', mealStartedAt: '2026-10-08T13:20:00+05:30' });
    expect(o).toMatchObject({ tag: 'afterMeal', mealStartedAt: '2026-10-08T13:20:00+05:30' });
  });

  it('refuses a glucose-only timing tag on a walk, and a meal time on a weight', () => {
    expect(() => newObservation({ ...walk, tag: 'fasting' })).toThrow();
    expect(() => newObservation({ kind: 'weight', value: 80, unit: 'kg', scope: 'pointInTime', at: walk.at, source: 'manual', tag: 'afterMeal' })).toThrow();
  });
});
