import { describe, expect, it } from 'vitest';
import { checkIn, obs, session } from '@/screens/track/fixtures';
import { placeExists } from './places';

/** A tab goes back to a record's screen only while that record is stored (acceptance J18). */
describe('placeExists', () => {
  const at = '2026-10-08T07:00:00.000+05:30';
  const record = {
    observations: [
      obs({ id: 'g1' }),
      obs({ id: 'r1:systolic', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 138, context: 'bp:r1', at }),
      obs({ id: 'r1:diastolic', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 86, context: 'bp:r1', at }),
      obs({ id: 'd', kind: 'walkDuration', unit: 'min', value: 32, scope: 'sessionObserved', source: 'measured', coverageMs: 1_920_000, context: 'walk:w1', at }),
    ],
    sessions: [session({ id: 's1', date: '2026-10-01' }), session({ id: 'v4', date: '2026-09-25', checkIn: checkIn('2026-09-25') })],
    checkIns: [checkIn('2026-10-08')],
  };

  it('finds each kind of record the way its screen does', () => {
    expect(placeExists('/track/reading/g1', record)).toBe(true);
    expect(placeExists('/track/pressure/r1', record)).toBe(true);
    expect(placeExists('/track/walk/w1', record)).toBe(true);
    expect(placeExists('/track/session/s1', record)).toBe(true);
    expect(placeExists('/track/workout/s1', record)).toBe(true);
    expect(placeExists('/track/check-in/2026-10-08', record)).toBe(true);
    // A v4 session carried its own copy of the day's check-in.
    expect(placeExists('/track/check-in/2026-09-25', record)).toBe(true);
  });

  it('says no for a record that is not stored, as after "Delete everything" or a restore that replaced it', () => {
    const empty = { observations: [], sessions: [], checkIns: [] };
    for (const path of ['/track/reading/g1', '/track/pressure/r1', '/track/walk/w1', '/track/session/s1', '/track/workout/1791430200000-w9yuanf', '/track/check-in/2026-10-08']) {
      expect(placeExists(path, empty), path).toBe(false);
    }
    expect(placeExists('/track/reading/other', record)).toBe(false);
    expect(placeExists('/track/reading/%E0%A4%A', record)).toBe(false);
  });

  it('lets every address that shows no single record through', () => {
    const empty = { observations: [], sessions: [], checkIns: [] };
    for (const path of ['/track', '/track/workout', '/track/metric/glucose', '/track/back', '/today', '/move/exercises/cat-cow', '/guide/card/card-dal']) {
      expect(placeExists(path, empty), path).toBe(true);
    }
  });
});
