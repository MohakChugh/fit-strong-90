import { describe, expect, it } from 'vitest';
import { compareStatements, newObservation, observationProblem, reviseObservation } from './observation';

/** A restored record's provenance and each statement's place (B-05, P8R-06). */
describe('observationProblem, and the order statements are said in', () => {
  it('takes a restored record’s `restoredFrom`, and only as the id it came from (B-05)', () => {
    const o = newObservation({ id: 'g2', kind: 'glucose', value: 90, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30' });
    expect(observationProblem({ ...o, restoredFrom: 'g1' })).toBeUndefined();
    expect(observationProblem({ ...o, restoredFrom: '' })).toMatch(/restoredFrom/);
  });

  it('gives each statement its place as it is said, a correction a later one, and orders two said at one instant by it (P8R-06)', () => {
    const at = '2026-10-06T12:00:00+05:30';
    const first = newObservation({ id: 'z', kind: 'water', value: 250, scope: 'dayTotal', source: 'manual', at });
    const later = newObservation({ id: 'a', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at });
    expect(later.order!).toBeGreaterThan(first.order!);
    expect(reviseObservation(first, { value: 300 }, '2026-10-06T12:00:00+05:30').order!).toBeGreaterThan(later.order!);
    // Neither its id nor this database's commit order decides it while both have a place.
    expect(compareStatements({ ...later, seq: 1 }, { ...first, seq: 9 })).toBeGreaterThan(0);
    // One said before this release has none: the commit order decides, as it always has (J05).
    expect(compareStatements({ ...later, order: undefined, seq: 1 }, { ...first, seq: 9 })).toBeLessThan(0);
    expect(observationProblem({ ...first, order: -1 })).toMatch(/order/);
  });
});
