import { describe, it, expect } from 'vitest';
import { ObservationError, bpContext, dayOf, newObservation, type Observation, type ObservationInput } from './observation';
import { AggregationError, entryFor, isOrphanedReading, pairBloodPressure, series, summariseDay, sum } from './aggregate';

/** A record with an explicit instant, so every case is timezone-independent. */
function obs(input: ObservationInput & { id: string }): Observation {
  return newObservation(input);
}

const MIN = 60_000;

describe('sum refuses rather than returning a wrong number (D10)', () => {
  it('throws when asked to sum across scopes', () => {
    const walk = obs({
      id: 'walk', kind: 'movementMinutes', value: 20, unit: 'min',
      scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00+05:30', coverageMs: 20 * MIN,
    });
    const typed = obs({
      id: 'typed', kind: 'movementMinutes', value: 45, unit: 'min',
      scope: 'dayTotal', source: 'manual', at: '2026-10-08T21:00:00+05:30',
    });

    expect(() => sum([walk, typed])).toThrow(AggregationError);
    expect(() => sum([walk, typed])).toThrow(/scope/i);
    try {
      sum([walk, typed]);
      expect.unreachable('summing a session into a day total must throw');
    } catch (error) {
      expect((error as AggregationError).fault).toBe('mixedScope');
    }
  });

  it('throws when asked to sum different kinds', () => {
    const steps = obs({ id: 'a', kind: 'steps', value: 4000, scope: 'dayTotal', source: 'manual', at: '2026-10-08T21:00:00+05:30' });
    const water = obs({ id: 'b', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: '2026-10-08T21:00:00+05:30' });
    expect(() => sum([steps, water])).toThrow(/kind/i);
  });

  it('throws rather than sum instantaneous readings', () => {
    const one = obs({ id: 'g1', kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' });
    const two = obs({ id: 'g2', kind: 'glucose', value: 130, scope: 'pointInTime', source: 'manual', at: '2026-10-08T13:30:00+05:30' });
    try {
      sum([one, two]);
      expect.unreachable('two glucose readings do not make a bigger reading');
    } catch (error) {
      expect((error as AggregationError).fault).toBe('notSummable');
    }
  });

  it('throws on mixed units rather than guessing a conversion', () => {
    const mgdl = obs({ id: 'g1', kind: 'glucose', value: 110, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' });
    const mmol = { ...mgdl, id: 'g2', unit: 'mmol/L', value: 6.1 };
    try {
      sum([mgdl, mmol]);
      expect.unreachable('mg/dL and mmol/L must not be combined');
    } catch (error) {
      expect((error as AggregationError).fault).toBe('mixedUnit');
    }
  });

  it('throws on an empty list, which has no kind and no unit', () => {
    expect(() => sum([])).toThrow(AggregationError);
  });
});

describe('a day total replaces, never adds (D10)', () => {
  const morning = obs({ id: 'am', kind: 'steps', value: 3200, scope: 'dayTotal', source: 'manual', at: '2026-10-08T11:00:00+05:30' });
  const evening = obs({ id: 'pm', kind: 'steps', value: 8100, scope: 'dayTotal', source: 'manual', at: '2026-10-08T22:00:00+05:30' });

  it('keeps the latest statement of the same kind and source', () => {
    const result = sum([morning, evening]);
    expect(result.value).toBe(8100);
    expect(result.contributed.map(o => o.id)).toEqual(['pm']);
    expect(result.superseded.map(o => o.id)).toEqual(['am']);
    expect(result.flags.map(f => f.fault)).toContain('replaced');
  });

  it('is order-independent', () => {
    expect(sum([evening, morning]).value).toBe(8100);
  });

  it('uses editedAt to decide which record is the current statement', () => {
    const corrected: Observation = { ...morning, value: 9000, editedAt: '2026-10-08T23:00:00+05:30' };
    expect(sum([corrected, evening]).value).toBe(9000);
  });

  // Two taps can land in the same millisecond. The day must still read as the
  // second one, not as whichever record happens to sort first.
  it('keeps the later statement even when both share an instant', () => {
    const at = '2026-10-08T11:00:00.000+05:30';
    const first = newObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual', at });
    const second = newObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at });
    // Which is why generated ids sort in creation order: that is the only
    // thing left to decide it once the instants are identical.
    expect(first.id < second.id).toBe(true);
    expect(sum([first, second]).value).toBe(500);
    expect(sum([second, first]).value).toBe(500);
  });

  it('never adds day totals from two sources, and says there is another', () => {
    const imported = obs({ id: 'health', kind: 'steps', value: 7800, scope: 'dayTotal', source: 'imported', at: '2026-10-08T23:30:00+05:30' });
    const result = sum([evening, imported]);
    expect(result.value).not.toBe(8100 + 7800);
    expect(result.value).toBe(7800); // the latest statement wins
    expect(result.conflicting.map(o => o.id)).toEqual(['pm']);
    expect(result.flags.map(f => f.fault)).toContain('conflictingSources');
  });

  it('keeps one record per source when a source restates its own total', () => {
    const importedOld = obs({ id: 'h1', kind: 'steps', value: 7000, scope: 'dayTotal', source: 'imported', at: '2026-10-08T12:00:00+05:30' });
    const importedNew = obs({ id: 'h2', kind: 'steps', value: 7800, scope: 'dayTotal', source: 'imported', at: '2026-10-08T23:30:00+05:30' });
    const result = sum([morning, evening, importedOld, importedNew]);
    expect(result.value).toBe(7800);
    expect(result.superseded.map(o => o.id).sort()).toEqual(['am', 'h1']);
    expect(result.conflicting.map(o => o.id)).toEqual(['pm']);
  });
});

describe('overlapping observed intervals are flagged, never summed (D10)', () => {
  const first = obs({
    id: 'w1', kind: 'walkDuration', value: 30, scope: 'sessionObserved', source: 'measured',
    at: '2026-10-08T07:00:00+05:30', coverageMs: 30 * MIN,
  });

  it('adds intervals that do not overlap', () => {
    const later = obs({
      id: 'w2', kind: 'walkDuration', value: 20, scope: 'sessionObserved', source: 'measured',
      at: '2026-10-08T18:00:00+05:30', coverageMs: 20 * MIN,
    });
    const result = sum([first, later]);
    expect(result.value).toBe(50);
    expect(result.overlaps).toEqual([]);
    expect(result.flags).toEqual([]);
  });

  it('adds intervals that merely touch', () => {
    const touching = obs({
      id: 'w2', kind: 'walkDuration', value: 10, scope: 'sessionObserved', source: 'measured',
      at: '2026-10-08T07:30:00+05:30', coverageMs: 10 * MIN,
    });
    expect(sum([first, touching]).value).toBe(40);
  });

  it('excludes the overlapping record from the total and reports it', () => {
    const overlapping = obs({
      id: 'w2', kind: 'walkDuration', value: 25, scope: 'sessionObserved', source: 'measured',
      at: '2026-10-08T07:20:00+05:30', coverageMs: 25 * MIN,
    });
    const result = sum([first, overlapping]);
    expect(result.value).toBe(30);
    expect(result.contributed.map(o => o.id)).toEqual(['w1']);
    expect(result.overlaps).toEqual([{ kept: 'w1', excluded: 'w2', overlapMs: 10 * MIN }]);
    expect(result.flags.map(f => f.fault)).toEqual(['overlap']);
  });

  it('keeps a third interval that clears both', () => {
    const overlapping = obs({
      id: 'w2', kind: 'walkDuration', value: 25, scope: 'sessionObserved', source: 'measured',
      at: '2026-10-08T07:20:00+05:30', coverageMs: 25 * MIN,
    });
    const clear = obs({
      id: 'w3', kind: 'walkDuration', value: 15, scope: 'sessionObserved', source: 'measured',
      at: '2026-10-08T19:00:00+05:30', coverageMs: 15 * MIN,
    });
    const result = sum([first, overlapping, clear]);
    expect(result.value).toBe(45);
    expect(result.overlaps.map(o => o.excluded)).toEqual(['w2']);
  });

  // Only a hand-edited import can reach this: newObservation demands coverage.
  // A session whose span is unknown cannot be shown not to overlap, so it is
  // reported and left out of the total rather than trusted (review F21).
  it('leaves out a record with no stated interval, and says so', () => {
    const noCoverage: Observation = { ...first, id: 'w2', coverageMs: undefined, value: 12 };
    const result = sum([first, noCoverage]);
    expect(result.value).toBe(30);
    expect(result.contributed.map(o => o.id)).toEqual(['w1']);
    expect(result.flags.map(f => f.fault)).toEqual(['missingCoverage']);
    expect(result.flags[0].ids).toEqual(['w2']);
  });
});

describe('summariseDay', () => {
  const day = '2026-10-08';
  const all = [
    obs({ id: 'g1', kind: 'glucose', value: 112, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' }),
    obs({ id: 'g2', kind: 'glucose', value: 141, scope: 'pointInTime', source: 'manual', at: '2026-10-08T14:30:00+05:30' }),
    obs({ id: 's1', kind: 'steps', value: 8100, scope: 'dayTotal', source: 'manual', at: '2026-10-08T22:00:00+05:30' }),
    obs({ id: 'm1', kind: 'movementMinutes', value: 22, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00+05:30', coverageMs: 22 * MIN }),
    obs({ id: 'm2', kind: 'movementMinutes', value: 18, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T18:00:00+05:30', coverageMs: 18 * MIN }),
    obs({ id: 'other', kind: 'steps', value: 5000, scope: 'dayTotal', source: 'manual', at: '2026-10-09T22:00:00+05:30' }),
  ];

  it('ignores other days', () => {
    const summary = summariseDay(day, all);
    expect(summary.day).toBe(day);
    expect(summary.entries.flatMap(e => e.observations).map(o => o.id)).not.toContain('other');
  });

  it('totals what may be totalled and leaves readings as readings', () => {
    const summary = summariseDay(day, all);
    expect(entryFor(summary, 'steps')?.total).toBe(8100);
    expect(entryFor(summary, 'movementMinutes')?.total).toBe(40);

    const glucose = entryFor(summary, 'glucose');
    expect(glucose?.total).toBeNull();
    expect(glucose?.observations.map(o => o.value)).toEqual([112, 141]);
    expect(glucose?.latest.id).toBe('g2');
  });

  it('keeps a session and a day total of the same kind apart', () => {
    const summary = summariseDay(day, [
      ...all,
      obs({ id: 'walkSteps', kind: 'steps', value: 2400, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00+05:30', coverageMs: 22 * MIN }),
    ]);
    const entries = summary.entries.filter(e => e.kind === 'steps');
    expect(entries.map(e => [e.scope, e.total])).toEqual([
      ['dayTotal', 8100],
      ['sessionObserved', 2400],
    ]);
    expect(entryFor(summary, 'steps', 'sessionObserved')?.total).toBe(2400);
  });

  it('degrades to no total with a flag when a group cannot be combined', () => {
    const mixed: Observation = {
      ...obs({ id: 'g3', kind: 'glucose', value: 6.2, unit: 'mmol/L', scope: 'pointInTime', source: 'manual', at: '2026-10-08T20:30:00+05:30' }),
    };
    const summary = summariseDay(day, [...all, mixed]);
    const glucose = entryFor(summary, 'glucose');
    expect(glucose?.total).toBeNull();
    expect(glucose?.unit).toBeNull();
    expect(summary.flags.map(f => f.fault)).toContain('mixedUnit');
    // The readings are still all there: a unit clash must not hide history.
    expect(glucose?.observations).toHaveLength(3);
  });

  it('has no entry for a day with nothing recorded (never a zero, D14)', () => {
    expect(summariseDay('2026-01-01', all).entries).toEqual([]);
    expect(entryFor(summariseDay('2026-01-01', all), 'steps')).toBeUndefined();
  });
});

describe('local days and midnight', () => {
  it('puts a reading 30 minutes after local midnight on that local day', () => {
    const justAfter = obs({ id: 'a', kind: 'glucose', value: 104, scope: 'pointInTime', source: 'manual', at: '2026-10-08T00:30:00+05:30' });
    const justBefore = obs({ id: 'b', kind: 'glucose', value: 162, scope: 'pointInTime', source: 'manual', at: '2026-10-07T23:45:00+05:30' });
    expect(justAfter.day).toBe('2026-10-08');
    expect(justBefore.day).toBe('2026-10-07');

    expect(summariseDay('2026-10-08', [justAfter, justBefore]).entries[0].observations.map(o => o.id)).toEqual(['a']);
    expect(summariseDay('2026-10-07', [justAfter, justBefore]).entries[0].observations.map(o => o.id)).toEqual(['b']);
  });

  it('follows the offset the reading was recorded in, not UTC', () => {
    // The same instant, stated in two places. 19:30 UTC on the 7th is 01:00 on
    // the 8th in Kolkata; each record keeps the day it happened on locally.
    const kolkata = obs({ id: 'k', kind: 'glucose', value: 104, scope: 'pointInTime', source: 'manual', at: '2026-10-08T01:00:00+05:30' });
    const london = obs({ id: 'l', kind: 'glucose', value: 104, scope: 'pointInTime', source: 'manual', at: '2026-10-07T20:30:00+01:00' });
    expect(Date.parse(kolkata.at)).toBe(Date.parse(london.at));
    expect(kolkata.day).toBe('2026-10-08');
    expect(london.day).toBe('2026-10-07');
  });
});

describe('series', () => {
  const readings = [
    obs({ id: 'g1', kind: 'glucose', value: 112, scope: 'pointInTime', source: 'manual', at: '2026-10-06T07:30:00+05:30' }),
    obs({ id: 'g2', kind: 'glucose', value: 141, scope: 'pointInTime', source: 'manual', at: '2026-10-08T14:30:00+05:30' }),
    obs({ id: 'g3', kind: 'glucose', value: 128, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' }),
    obs({ id: 'g4', kind: 'glucose', value: 99, scope: 'pointInTime', source: 'manual', at: '2026-10-12T07:30:00+05:30' }),
    obs({ id: 's1', kind: 'steps', value: 8100, scope: 'dayTotal', source: 'manual', at: '2026-10-08T22:00:00+05:30' }),
  ];

  it('returns every reading in range, chronologically, for an instantaneous kind', () => {
    const result = series('glucose', { from: '2026-10-06', to: '2026-10-08' }, readings);
    expect(result.unit).toBe('mg/dL');
    expect(result.points.map(p => p.observations[0].id)).toEqual(['g1', 'g3', 'g2']);
    expect(result.points.map(p => p.day)).toEqual(['2026-10-06', '2026-10-08', '2026-10-08']);
  });

  it('is inclusive at both ends and skips days with no record', () => {
    const result = series('glucose', { from: '2026-10-08', to: '2026-10-12' }, readings);
    expect(result.points.map(p => p.value)).toEqual([128, 141, 99]);
    expect(result.points.map(p => p.day)).not.toContain('2026-10-09');
  });

  it('gives one point per day for a total, and keeps scopes apart', () => {
    const steps = [
      readings[4],
      obs({ id: 's2', kind: 'steps', value: 9000, scope: 'dayTotal', source: 'manual', at: '2026-10-09T22:00:00+05:30' }),
      obs({ id: 'walk', kind: 'steps', value: 2400, scope: 'sessionObserved', source: 'measured', at: '2026-10-09T07:00:00+05:30', coverageMs: 22 * MIN }),
    ];
    const result = series('steps', { from: '2026-10-08', to: '2026-10-09' }, steps);
    expect(result.points.map(p => [p.day, p.scope, p.value])).toEqual([
      ['2026-10-08', 'dayTotal', 8100],
      ['2026-10-09', 'dayTotal', 9000],
      ['2026-10-09', 'sessionObserved', 2400],
    ]);
  });

  it('carries the overlap flags of each day it aggregated', () => {
    const overlapping = [
      obs({ id: 'w1', kind: 'walkDuration', value: 30, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:00:00+05:30', coverageMs: 30 * MIN }),
      obs({ id: 'w2', kind: 'walkDuration', value: 25, scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:20:00+05:30', coverageMs: 25 * MIN }),
    ];
    const result = series('walkDuration', { from: '2026-10-08', to: '2026-10-08' }, overlapping);
    expect(result.points.map(p => p.value)).toEqual([30]);
    expect(result.flags.map(f => f.fault)).toEqual(['overlap']);
    expect(result.flags[0].day).toBe('2026-10-08');
  });

  it('returns an empty series rather than inventing zeros', () => {
    const result = series('weight', { from: '2026-10-01', to: '2026-10-31' }, readings);
    expect(result.points).toEqual([]);
    expect(result.unit).toBeNull();
  });

  it('rejects a malformed or inverted range', () => {
    expect(() => series('glucose', { from: 'last week', to: '2026-10-08' }, readings)).toThrow(AggregationError);
    expect(() => series('glucose', { from: '2026-10-08', to: '2026-10-01' }, readings)).toThrow(/range/i);
  });
});

// Everything above depends on a stored record being one that can be reasoned
// about, so the validator is the floor the aggregation rules stand on.
describe('records that cannot be stored', () => {
  const ok: ObservationInput = { kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' };

  it('refuses an instant with no offset, because its local day would be a guess', () => {
    expect(() => newObservation({ ...ok, at: '2026-10-08T07:30:00' })).toThrow(ObservationError);
    expect(() => dayOf('2026-10-08T07:30:00')).toThrow(/offset/i);
    expect(() => dayOf('2026-10-08')).toThrow(ObservationError);
  });

  it('refuses a day that does not exist', () => {
    expect(() => newObservation({ ...ok, at: '2026-02-30T07:30:00+05:30' })).toThrow(ObservationError);
    expect(() => newObservation({ ...ok, at: '2026-10-08T25:30:00+05:30' })).toThrow(ObservationError);
  });

  it('accepts UTC, written either way', () => {
    expect(newObservation({ ...ok, at: '2026-10-08T07:30:00Z' }).day).toBe('2026-10-08');
    expect(newObservation({ ...ok, at: '2026-10-08T07:30:00+00:00' }).day).toBe('2026-10-08');
    expect(newObservation({ ...ok, at: '2026-10-08T07:30:00.500+05:30' }).day).toBe('2026-10-08');
  });

  it('refuses a unit this measurement is not taken in', () => {
    expect(() => newObservation({ ...ok, unit: 'mmHg' })).toThrow(/mmHg/);
    expect(newObservation({ ...ok, unit: 'mmol/L', value: 6.1 }).unit).toBe('mmol/L');
    expect(newObservation(ok).unit).toBe('mg/dL'); // the canonical unit by default
  });

  it('refuses a scope this measurement cannot be recorded in', () => {
    expect(() => newObservation({ ...ok, scope: 'dayTotal' })).toThrow(/dayTotal/);
    expect(() => newObservation({ kind: 'water', value: 250, scope: 'pointInTime', source: 'manual' })).toThrow(/pointInTime/);
  });

  it('refuses a value no measurement could have', () => {
    expect(() => newObservation({ ...ok, value: -1 })).toThrow(ObservationError);
    expect(() => newObservation({ ...ok, value: Number.NaN })).toThrow(ObservationError);
    expect(() => newObservation({ ...ok, value: Number.POSITIVE_INFINITY })).toThrow(ObservationError);
    expect(() => newObservation({ ...ok, value: '110' as never })).toThrow(ObservationError);
  });

  it('refuses an unknown kind', () => {
    expect(() => newObservation({ ...ok, kind: 'vibes' as never })).toThrow(/kind/i);
  });

  it('demands an interval from anything claiming to have observed one', () => {
    const walk: ObservationInput = { kind: 'walkDuration', value: 30, scope: 'sessionObserved', source: 'measured', at: ok.at };
    expect(() => newObservation(walk)).toThrow(/coverageMs/);
    expect(() => newObservation({ ...walk, coverageMs: 0 })).toThrow(/coverageMs/);
    expect(newObservation({ ...walk, coverageMs: 1800_000 }).coverageMs).toBe(1800_000);
  });

  it('refuses an interval on something that is not an interval', () => {
    expect(() => newObservation({ ...ok, coverageMs: 1000 })).toThrow(/coverageMs/);
  });

  it('gives every record an id of its own', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newObservation(ok).id));
    expect(ids.size).toBe(50);
  });
});

// Glucose targets depend on when the reading was taken (ADA: 80–130 mg/dL
// before a meal, under 180 at the post-meal peak), so timing is part of the
// record, not a note.
describe('timing tags', () => {
  const glucose = { kind: 'glucose', value: 150, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:30:00+05:30' } as const;

  it('carries a tag the kind allows', () => {
    expect(newObservation({ ...glucose, tag: 'fasting' }).tag).toBe('fasting');
    expect(newObservation({ ...glucose, tag: 'afterExercise' }).tag).toBe('afterExercise');
    expect(newObservation({ kind: 'bloodPressureSystolic', value: 138, scope: 'pointInTime', source: 'manual', tag: 'morning' }).tag).toBe('morning');
  });

  it('leaves the tag absent when it is not known, and never guesses fasting', () => {
    expect(newObservation(glucose).tag).toBeUndefined();
    expect('tag' in newObservation(glucose)).toBe(false);
  });

  it('refuses a tag that belongs to another kind', () => {
    expect(() => newObservation({ ...glucose, tag: 'morning' })).toThrow(/morning/);
    expect(() => newObservation({ kind: 'bloodPressureSystolic', value: 138, scope: 'pointInTime', source: 'manual', tag: 'fasting' })).toThrow(/fasting/);
  });

  it('refuses a tag on a kind that has no timing', () => {
    expect(() => newObservation({ kind: 'weight', value: 82, scope: 'pointInTime', source: 'manual', tag: 'morning' })).toThrow(/timing tag/);
  });

  it('takes a meal start only for an after-meal glucose reading', () => {
    const meal = '2026-10-08T08:00:00+05:30';
    const reading = newObservation({ ...glucose, tag: 'afterMeal', mealStartedAt: meal });
    expect(reading.mealStartedAt).toBe(meal);
    // Guidelines time the peak from the first mouthful, so the minutes are
    // arithmetic rather than an assumption.
    expect((Date.parse(reading.at) - Date.parse(meal)) / 60_000).toBe(90);

    expect(() => newObservation({ ...glucose, tag: 'fasting', mealStartedAt: meal })).toThrow(/afterMeal/);
    expect(() => newObservation({ ...glucose, mealStartedAt: meal })).toThrow(/afterMeal/);
    expect(() => newObservation({ kind: 'weight', value: 82, scope: 'pointInTime', source: 'manual', mealStartedAt: meal })).toThrow(/afterMeal/);
  });

  it('refuses a meal start that is not a real instant', () => {
    expect(() => newObservation({ ...glucose, tag: 'afterMeal', mealStartedAt: '2026-10-08T08:00:00' })).toThrow(/offset/);
    expect(() => newObservation({ ...glucose, tag: 'afterMeal', mealStartedAt: 'breakfast' })).toThrow(ObservationError);
  });
});

describe('pairBloodPressure', () => {
  const at = '2026-10-08T07:15:00.000+05:30';
  const evening = '2026-10-08T21:40:00.000+05:30';

  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, reading: string, when = at, tag?: 'morning' | 'evening') =>
    newObservation({
      id: `${reading}:${kind}`, kind, value, scope: 'pointInTime', source: 'manual',
      at: when, context: bpContext(reading), ...(tag !== undefined ? { tag } : {}),
    });

  it('puts the two halves of a reading back together', () => {
    const readings = pairBloodPressure([
      half('bloodPressureDiastolic', 86, 'r1', at, 'morning'),
      half('bloodPressureSystolic', 138, 'r1', at, 'morning'),
    ]);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ id: 'r1', systolic: 138, diastolic: 86, day: '2026-10-08', tag: 'morning', source: 'manual' });
    expect(readings[0].halves.map(h => h.kind)).toEqual(['bloodPressureSystolic', 'bloodPressureDiastolic']);
    expect(isOrphanedReading(readings[0])).toBe(false);
  });

  it('keeps two readings on the same day apart, chronologically', () => {
    const readings = pairBloodPressure([
      half('bloodPressureSystolic', 126, 'r2', evening, 'evening'),
      half('bloodPressureDiastolic', 78, 'r2', evening, 'evening'),
      half('bloodPressureSystolic', 138, 'r1', at, 'morning'),
      half('bloodPressureDiastolic', 86, 'r1', at, 'morning'),
    ]);
    expect(readings.map(r => [r.id, r.systolic, r.diastolic])).toEqual([
      ['r1', 138, 86],
      ['r2', 126, 78],
    ]);
  });

  it('reports a half with no partner instead of dropping it or inventing the other number', () => {
    const readings = pairBloodPressure([half('bloodPressureSystolic', 138, 'r1')]);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ id: 'r1', systolic: 138, diastolic: null });
    expect(isOrphanedReading(readings[0])).toBe(true);
    expect(readings[0].halves).toHaveLength(1);
  });

  it('never crosses two readings into one that never happened', () => {
    // A morning systolic and an evening diastolic share nothing but the kind.
    const readings = pairBloodPressure([
      half('bloodPressureSystolic', 160, 'r1', at),
      half('bloodPressureDiastolic', 70, 'r2', evening),
    ]);
    expect(readings.map(r => [r.systolic, r.diastolic])).toEqual([[160, null], [null, 70]]);
    expect(readings.every(isOrphanedReading)).toBe(true);
  });

  it('will not pair halves that share an id but not an instant', () => {
    const readings = pairBloodPressure([
      half('bloodPressureSystolic', 138, 'r1', at),
      half('bloodPressureDiastolic', 86, 'r1', evening),
    ]);
    expect(readings).toHaveLength(2);
    expect(readings.every(isOrphanedReading)).toBe(true);
  });

  it('still shows a half from older data that has no pairing context', () => {
    const loose = newObservation({ id: 'old', kind: 'bloodPressureSystolic', value: 142, scope: 'pointInTime', source: 'imported', at });
    const readings = pairBloodPressure([loose]);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ id: 'old', systolic: 142, diastolic: null, source: 'imported' });
  });

  it('ignores everything that is not a blood-pressure half', () => {
    expect(pairBloodPressure([
      newObservation({ kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual', at }),
      newObservation({ kind: 'steps', value: 8000, scope: 'dayTotal', source: 'manual', at }),
    ])).toEqual([]);
    expect(pairBloodPressure([])).toEqual([]);
  });
});
