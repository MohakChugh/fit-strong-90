/**
 * Reproductions for the health-layer findings in
 * docs/reimagine/codex-review-data.md, one `describe` per finding. Every one of
 * these was run against the implementation the review exercised and failed.
 */

import { describe, it, expect } from 'vitest';
import {
  atOnDay,
  bpContext,
  compareObservations,
  compareStatements,
  isObservation,
  newObservation,
  reviseObservation,
  type Observation,
} from './observation';
import { entryFor, isOrphanedReading, pairBloodPressure, series, summariseDay, sum } from './aggregate';

/** The test runner's environment, without pulling node's types into the app build. */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

const MIN = 60_000;

describe('F15 — blood pressure halves pair by the instant they share, and duplicates are flagged', () => {
  it('pairs halves that name the same instant in different offsets', () => {
    const shared = { scope: 'pointInTime', source: 'manual', context: bpContext('r1') } as const;
    const readings = pairBloodPressure([
      newObservation({ ...shared, id: 'r1:s', kind: 'bloodPressureSystolic', value: 138, at: '2026-10-08T09:00:00.000+05:30' }),
      newObservation({ ...shared, id: 'r1:d', kind: 'bloodPressureDiastolic', value: 86, at: '2026-10-08T03:30:00.000Z' }),
    ]);
    expect(readings.map(r => [r.systolic, r.diastolic])).toEqual([[138, 86]]);
    expect(readings[0].day).toBe('2026-10-08');
  });

  it('flags a reading recorded twice rather than assembling whichever halves come first', () => {
    const at = '2026-10-08T12:00:00.000+05:30';
    const shared = { scope: 'pointInTime', source: 'manual', context: bpContext('checkIn:2026-10-08'), at } as const;
    const readings = pairBloodPressure([
      newObservation({ ...shared, id: 'old:s', kind: 'bloodPressureSystolic', value: 140 }),
      newObservation({ ...shared, id: 'old:d', kind: 'bloodPressureDiastolic', value: 90 }),
      { ...newObservation({ ...shared, id: 'new:s', kind: 'bloodPressureSystolic', value: 130 }), editedAt: '2026-10-08T13:00:00.000+05:30' },
      { ...newObservation({ ...shared, id: 'new:d', kind: 'bloodPressureDiastolic', value: 80 }), editedAt: '2026-10-08T13:00:00.000+05:30' },
    ]);
    expect(readings).toHaveLength(1);
    expect(readings[0].ambiguous).toBe(true);
    // The latest statement of each half, not the first one found.
    expect([readings[0].systolic, readings[0].diastolic]).toEqual([130, 80]);
    expect(isOrphanedReading(readings[0])).toBe(false);
  });
});

describe('F17 — chronology is decided by instants, not by how the timestamp is written', () => {
  // US fall-back on 1 Nov 2026: 01:10-05:00 is twenty minutes after 01:50-04:00.
  const earlier = newObservation({ id: 'w1', kind: 'water', value: 1000, scope: 'dayTotal', source: 'manual', at: '2026-11-01T01:50:00.000-04:00' });
  const later = newObservation({ id: 'w2', kind: 'water', value: 1250, scope: 'dayTotal', source: 'manual', at: '2026-11-01T01:10:00.000-05:00' });

  it('keeps the later statement across a daylight-saving change', () => {
    expect(Date.parse(later.at) - Date.parse(earlier.at)).toBe(20 * MIN);
    expect(sum([earlier, later]).value).toBe(1250);
    expect(sum([later, earlier]).value).toBe(1250);
    expect(entryFor(summariseDay('2026-11-01', [earlier, later]), 'water')?.latest.id).toBe('w2');
  });

  it('orders readings and statements by instant', () => {
    expect([later, earlier].sort(compareObservations).map(o => o.id)).toEqual(['w1', 'w2']);
    expect([later, earlier].sort(compareStatements).map(o => o.id)).toEqual(['w1', 'w2']);

    // An edit stated in another offset is still ordered by when it happened.
    const a = { ...earlier, id: 'a', editedAt: '2026-11-01T09:00:00.000+05:30' }; // 03:30Z
    const b = { ...earlier, id: 'b', editedAt: '2026-11-01T04:00:00.000Z' };
    expect([b, a].sort(compareStatements).map(o => o.id)).toEqual(['a', 'b']);
  });

  it('orders blood pressure readings and series points by instant', () => {
    const bp = (id: string, at: string) => [
      newObservation({ id: `${id}:s`, kind: 'bloodPressureSystolic', value: 130, scope: 'pointInTime', source: 'manual', at, context: bpContext(id) }),
      newObservation({ id: `${id}:d`, kind: 'bloodPressureDiastolic', value: 80, scope: 'pointInTime', source: 'manual', at, context: bpContext(id) }),
    ];
    const readings = pairBloodPressure([...bp('second', '2026-11-01T01:10:00.000-05:00'), ...bp('first', '2026-11-01T01:50:00.000-04:00')]);
    expect(readings.map(r => r.id)).toEqual(['first', 'second']);

    const g = (id: string, at: string) => newObservation({ id, kind: 'glucose', value: 100, scope: 'pointInTime', source: 'manual', at });
    const points = series('glucose', { from: '2026-11-01', to: '2026-11-01' }, [g('second', '2026-11-01T01:10:00.000-05:00'), g('first', '2026-11-01T01:50:00.000-04:00')]).points;
    expect(points.map(p => p.observations[0].id)).toEqual(['first', 'second']);
  });

  it('counts the first of two overlapping intervals by when they started', () => {
    // 01:30-05:00 starts after 01:50-04:00 (06:30Z vs 05:50Z).
    const first = newObservation({ id: 'first', kind: 'walkDuration', value: 30, scope: 'sessionObserved', source: 'measured', at: '2026-11-01T01:50:00.000-04:00', coverageMs: 60 * MIN });
    const second = newObservation({ id: 'second', kind: 'walkDuration', value: 20, scope: 'sessionObserved', source: 'measured', at: '2026-11-01T01:30:00.000-05:00', coverageMs: 20 * MIN });
    const result = sum([second, first]);
    expect(result.contributed.map(o => o.id)).toEqual(['first']);
    expect(result.overlaps).toEqual([{ kept: 'first', excluded: 'second', overlapMs: 20 * MIN }]);
  });
});

describe('F19 — overlap is checked across midnight', () => {
  const walk = newObservation({ id: 'walk', kind: 'walkDuration', value: 20, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T23:50:00.000+05:30', coverageMs: 20 * MIN });
  const imported = newObservation({ id: 'imported', kind: 'walkDuration', value: 10, scope: 'sessionObserved', source: 'imported', at: '2026-10-09T00:00:00.000+05:30', coverageMs: 10 * MIN });

  it('flags an interval on the next day that overlaps one which crossed midnight', () => {
    const result = series('walkDuration', { from: '2026-10-08', to: '2026-10-09' }, [walk, imported]);
    expect(result.flags.map(f => f.fault)).toContain('overlap');
    expect(result.points.reduce((t, p) => t + p.value, 0)).toBe(20);
  });

  it('flags it in the day summary too, when given the neighbouring days', () => {
    const nextDay = summariseDay('2026-10-09', [walk, imported]);
    expect(nextDay.flags.map(f => f.fault)).toContain('overlap');
    expect(entryFor(nextDay, 'walkDuration')?.total).toBe(0);
    expect(entryFor(nextDay, 'walkDuration')?.observations.map(o => o.id)).toEqual(['imported']);
  });

  it('counts an interval that crosses midnight on the day it started, and says so', () => {
    const startDay = summariseDay('2026-10-08', [walk, imported]);
    expect(entryFor(startDay, 'walkDuration')?.total).toBe(20);
    expect(startDay.flags.map(f => f.fault)).toContain('spansMidnight');
  });
});

describe('F20 — a date-only record keeps its date wherever it is read', () => {
  it('keeps a day the device’s time zone skipped', () => {
    const zone = env.TZ;
    env.TZ = 'Pacific/Apia';
    try {
      const at = atOnDay('2011-12-30');
      expect(at.slice(0, 10)).toBe('2011-12-30');
      // The synthetic time screens recognise as "not recorded".
      expect(at.slice(11, 23)).toBe('12:00:00.000');
    } finally {
      if (zone === undefined) delete env.TZ; else env.TZ = zone;
    }
  });
});

describe('F21 — a record from outside obeys the same rules as one made here', () => {
  const valid = newObservation({ id: 'g', kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00.000+05:30' });

  it('rejects a scope the kind cannot have', () => {
    expect(isObservation({ ...valid, scope: 'sessionObserved', coverageMs: 600_000 })).toBe(false);
  });

  it('rejects an interval that is not a positive span', () => {
    const walk = newObservation({ id: 'w', kind: 'walkDuration', value: 20, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00.000+05:30', coverageMs: 20 * MIN });
    expect(isObservation(walk)).toBe(true);
    expect(isObservation({ ...walk, coverageMs: 0 })).toBe(false);
    expect(isObservation({ ...walk, coverageMs: -5 })).toBe(false);
    expect(isObservation({ ...valid, coverageMs: 600_000 })).toBe(false);
  });

  it('rejects negative values, non-text notes and meal times that do not apply', () => {
    expect(isObservation({ ...valid, value: -1 })).toBe(false);
    expect(isObservation({ ...valid, context: 42 })).toBe(false);
    expect(isObservation({ ...valid, note: { text: 'x' } })).toBe(false);
    expect(isObservation({ ...valid, tag: 'fasting', mealStartedAt: '2026-10-08T07:00:00.000+05:30' })).toBe(false);
    expect(isObservation({ ...valid, tag: 'afterMeal', mealStartedAt: '2026-10-08T07:00:00.000+05:30' })).toBe(true);
  });

  it('never totals a record that breaks the rules, even one that got in anyway', () => {
    const a = { ...valid, id: 'a', scope: 'sessionObserved', coverageMs: 10 * MIN } as Observation;
    const b = { ...valid, id: 'b', value: 200, at: '2026-10-08T09:30:00.000+05:30', scope: 'sessionObserved', coverageMs: 10 * MIN } as Observation;
    const entry = entryFor(summariseDay('2026-10-08', [a, b]), 'glucose');
    expect(entry?.total).toBeNull();
    expect(entry?.flags.map(f => f.fault)).toContain('invalidRecord');
    expect(entry?.observations).toHaveLength(2);
  });

  it('does not count sessions whose span is unknown, and says so', () => {
    const walk = newObservation({ id: 'w', kind: 'walkDuration', value: 20, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00.000+05:30', coverageMs: 20 * MIN });
    const result = sum([{ ...walk, id: 'x', coverageMs: 0 }, { ...walk, id: 'y', coverageMs: 0 }]);
    expect(result.value).toBe(0);
    expect(result.flags.map(f => f.fault)).toEqual(['missingCoverage']);
    expect(result.flags[0].ids.sort()).toEqual(['x', 'y']);
  });
});

describe('Mechanism: the rules a record is held to', () => {
  it('counts an interval that overlaps only an excluded one', () => {
    const w = (id: string, at: string, minutes: number) => newObservation({ id, kind: 'walkDuration', value: minutes, scope: 'sessionObserved', source: 'measured', at, coverageMs: minutes * MIN });
    // A counted; B overlaps A and is left out; C overlaps only B, so C counts.
    const result = sum([w('A', '2026-10-08T07:00:00.000+05:30', 30), w('B', '2026-10-08T07:20:00.000+05:30', 40), w('C', '2026-10-08T07:45:00.000+05:30', 10)]);
    expect(result.contributed.map(o => o.id)).toEqual(['A', 'C']);
    expect(result.value).toBe(40);
  });

  it('keeps a scale reading inside its scale', () => {
    const pain = { kind: 'backPain', scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00.000+05:30' } as const;
    expect(newObservation({ ...pain, value: 10 }).value).toBe(10);
    expect(() => newObservation({ ...pain, value: 11 })).toThrow(/0 to 10/);
    expect(() => newObservation({ kind: 'mood', scope: 'pointInTime', source: 'manual', value: 0 })).toThrow(/1 to 5/);
  });

  it('drops a meal start when the reading stops being after a meal', () => {
    const after = newObservation({
      kind: 'glucose', value: 152, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00.000+05:30',
      tag: 'afterMeal', mealStartedAt: '2026-10-08T07:30:00.000+05:30',
    });
    const fasting = reviseObservation(after, { tag: 'fasting' });
    expect(fasting.tag).toBe('fasting');
    expect(fasting.mealStartedAt).toBeUndefined();
    expect(reviseObservation(after, { value: 150 }).mealStartedAt).toBe('2026-10-08T07:30:00.000+05:30');
  });
});
