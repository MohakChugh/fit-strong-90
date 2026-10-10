import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from './format';
import { checkIn, obs, session, set } from './fixtures';
import { assembleDay, checkInFor, formatPressure, recordPath } from './timeline';

const day = '2026-10-08';
const empty = { observations: [], sessions: [], checkIns: [] };

describe('assembleDay', () => {
  it('is empty — not a list of zeroes — for a day with nothing recorded', () => {
    const view = assembleDay(day, empty, DEFAULT_PREFS);
    expect(view).toEqual({ day, totals: [], rows: [], empty: true });
  });

  it('puts every record in time order with its value, unit, time and source', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'g2', at: '2026-10-08T14:05:00.000+05:30', value: 168, tag: 'afterMeal' }),
        obs({ id: 'g1', at: '2026-10-08T07:42:00.000+05:30', value: 112, tag: 'fasting' }),
        obs({ id: 'w', kind: 'weight', unit: 'kg', value: 82.4, at: '2026-10-08T07:30:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => [r.title, r.value, r.detail])).toEqual([
      ['Weight', '82.4 kg', '07:30 · Manual entry'],
      ['Glucose', '112 mg/dL', '07:42 · Fasting · Manual entry'],
      ['Glucose', '168 mg/dL', '14:05 · After a meal · Manual entry'],
    ]);
    expect(view.rows[1].ref).toEqual({ type: 'reading', id: 'g1' });
    expect(view.empty).toBe(false);
  });

  it('shows a reading in the person’s unit', () => {
    const view = assembleDay(day, { ...empty, observations: [obs({ id: 'g', value: 112 })] }, { ...DEFAULT_PREFS, glucose: 'mmol/L', hour12: true });
    expect(view.rows[0].value).toBe('6.2 mmol/L');
    expect(view.rows[0].detail).toMatch(/^7:42 am/);
  });

  it('shows a day total once, as the statement that counts, and says what it replaced', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'w1', kind: 'water', unit: 'ml', value: 250, scope: 'dayTotal', at: '2026-10-08T08:00:00.000+05:30' }),
        obs({ id: 'w2', kind: 'water', unit: 'ml', value: 500, scope: 'dayTotal', at: '2026-10-08T10:00:00.000+05:30' }),
        obs({ id: 'w3', kind: 'water', unit: 'ml', value: 750, scope: 'dayTotal', at: '2026-10-08T14:05:00.000+05:30' }),
        obs({ id: 's1', kind: 'steps', unit: 'steps', value: 3000, scope: 'dayTotal', at: '2026-10-08T12:00:30.000+05:30' }),
        obs({ id: 's2', kind: 'steps', unit: 'steps', value: 4820, scope: 'dayTotal', at: '2026-10-08T18:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows).toEqual([]);
    expect(view.totals.map(t => [t.title, t.value, t.detail, t.ref])).toEqual([
      ['Steps', '4,820 steps', 'Manual entry · Replaces an earlier total', { type: 'reading', id: 's2' }],
      ['Water', '750 ml', 'Manual entry · 3 entries', { type: 'reading', id: 'w3' }],
    ]);
    expect(view.totals[1].ids.sort()).toEqual(['w1', 'w2', 'w3']);
  });

  it('never adds a second source’s total; it says one exists', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'm', kind: 'steps', unit: 'steps', value: 8100, scope: 'dayTotal', at: '2026-10-08T20:00:00.000+05:30' }),
        obs({ id: 'i', kind: 'steps', unit: 'steps', value: 7800, scope: 'dayTotal', source: 'imported', at: '2026-10-08T21:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.totals[0]).toMatchObject({ value: '7,800 steps', detail: 'Imported · Another source gave a different total' });
  });

  it('pairs blood pressure into one reading and keeps a missing half visible', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'r1:systolic', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 138, context: 'bp:r1', tag: 'morning', at: '2026-10-08T07:00:00.000+05:30' }),
        obs({ id: 'r1:diastolic', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 86, context: 'bp:r1', tag: 'morning', at: '2026-10-08T07:00:00.000+05:30' }),
        obs({ id: 'lone', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 150, context: 'bp:r2', at: '2026-10-08T19:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => [r.title, r.value, r.detail, r.ref])).toEqual([
      ['Blood pressure', '138/86 mmHg', '07:00 · Morning · Manual entry', { type: 'pressure', id: 'r1' }],
      ['Blood pressure', '150 mmHg', '19:00 · Bottom number not entered · Manual entry', { type: 'pressure', id: 'r2' }],
    ]);
  });

  it('holds a check-in’s readings inside the check-in, untimed and first', () => {
    const view = assembleDay(day, {
      observations: [
        obs({ id: 'checkIn:2026-10-08:glucose', context: 'checkIn:2026-10-08', value: 148, at: '2026-10-08T12:00:00.000+05:30' }),
        obs({ id: 'checkIn:2026-10-08:bloodPressureSystolic', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 138, context: 'bp:checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
        obs({ id: 'checkIn:2026-10-08:bloodPressureDiastolic', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 86, context: 'bp:checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
        obs({ id: 'checkIn:2026-10-08:backPain', kind: 'backPain', unit: '0-10', value: 4, context: 'checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
        obs({ id: 'g', value: 101, at: '2026-10-08T06:30:00.000+05:30' }),
      ],
      sessions: [],
      checkIns: [checkIn(day)],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => r.title)).toEqual(['Check-in', 'Glucose']);
    expect(view.rows[0].detail).toBe('Glucose 148 mg/dL · BP 138/86 mmHg · Back pain 4 of 10 · Your check-in');
    expect(view.rows[0].ref).toEqual({ type: 'checkIn', date: day });
    expect(view.rows[0].ids).toHaveLength(4);
  });

  it('shows a check-in’s readings on their own when the check-in record is missing, with no invented time', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [obs({ id: 'c', context: 'checkIn:2026-10-08', value: 148, at: '2026-10-08T12:00:00.000+05:30' })],
    }, DEFAULT_PREFS);
    expect(view.rows[0]).toMatchObject({ title: 'Glucose', detail: 'Time not recorded · From your check-in' });
    expect(view.rows[0].at).toBeUndefined();
  });

  it('shows a session with its time, length and status, holding what was recorded about it', () => {
    const s = session({
      id: 'sess', date: day, guided: true, focus: 'lowerA', status: 'completed',
      startedAt: '2026-10-08T01:32:00.000Z', durationSeconds: 3480, sets: [set('goblet-squat')],
    });
    const pain = obs({ id: 'session:sess:backPain', kind: 'backPain', unit: '0-10', value: 2, context: 'session:sess', at: '2026-10-08T12:00:00.000+05:30' });
    const view = assembleDay(day, { observations: [pain], sessions: [s], checkIns: [] }, DEFAULT_PREFS);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ title: 'Lower A · Squat', value: '58 min', ref: { type: 'session', id: 'sess' } });
    expect(view.rows[0].detail).toMatch(/· Completed · Guided session$/);
    expect(view.rows[0].ids).toEqual(['sess', 'session:sess:backPain']);
  });

  it('shows a walk as one record, however many measurements it produced', () => {
    const at = '2026-10-08T18:10:00.000+05:30';
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'd', kind: 'walkDuration', unit: 'min', value: 32, scope: 'sessionObserved', source: 'measured', coverageMs: 1_920_000, context: 'walk:w1', at }),
        obs({ id: 'k', kind: 'walkDistance', unit: 'km', value: 2.14, scope: 'sessionObserved', source: 'measured', coverageMs: 1_920_000, context: 'walk:w1', at }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ title: 'Walk', value: '32 min', detail: '18:10 · 2.1 km · Measured on a walk', ref: { type: 'walk', id: 'w1' } });
  });

  it('only shows the day asked for', () => {
    const view = assembleDay(day, { ...empty, observations: [obs({ id: 'y', at: '2026-10-07T23:59:00.000+05:30' })] }, DEFAULT_PREFS);
    expect(view.empty).toBe(true);
  });
});

describe('helpers', () => {
  it('builds detail paths that survive ids with colons', () => {
    expect(recordPath({ type: 'reading', id: 'checkIn:2026-10-01:glucose' })).toBe('/track/reading/checkIn%3A2026-10-01%3Aglucose');
    expect(recordPath({ type: 'pressure', id: 'checkIn:2026-10-01' })).toBe('/track/pressure/checkIn%3A2026-10-01');
    expect(recordPath({ type: 'checkIn', date: '2026-10-01' })).toBe('/track/check-in/2026-10-01');
  });

  it('finds a check-in a v4 session carried when there is no stored record', () => {
    const carried = checkIn('2026-10-01');
    expect(checkInFor('2026-10-01', { checkIns: [], sessions: [session({ id: 's', date: '2026-10-01', checkIn: carried })] })).toBe(carried);
    const stored = checkIn('2026-10-01', { energy: 2 });
    expect(checkInFor('2026-10-01', { checkIns: [stored], sessions: [session({ id: 's', date: '2026-10-01', checkIn: carried })] })).toBe(stored);
  });

  it('writes a missing half of a pressure reading as not entered', () => {
    expect(formatPressure({ systolic: null, diastolic: 80 })).toBe('Not entered/80 mmHg');
  });

  it('names a session the way the Workout Log does, and opens a hand-logged one there', () => {
    const view = assembleDay(day, {
      ...empty,
      sessions: [
        session({ id: 'm', date: day, guided: false, muscleGroup: 'back', startedAt: '2026-10-08T12:30:00.000Z', durationSeconds: 1800 }),
        session({ id: 's', date: day, guided: true, focus: 'lowerA', planKind: 'stretch', startedAt: '2026-10-08T01:30:00.000Z', durationSeconds: 600 }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => [r.title, r.ref])).toEqual([
      ['Stretch', { type: 'session', id: 's' }],
      ['Back workout', { type: 'workout', id: 'm' }],
    ]);
    expect(recordPath({ type: 'workout', id: 'm' })).toBe('/track/workout/m');
  });
});

describe('ordering of records with no time', () => {
  it('follows the kinds’ registry order, not the alphabet', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'bodyMetric:2026-10-08:waist', kind: 'waist', unit: 'cm', value: 95, context: 'bodyMetric:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
        obs({ id: 'bodyMetric:2026-10-08:weight', kind: 'weight', unit: 'kg', value: 82, context: 'bodyMetric:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => r.title)).toEqual(['Weight', 'Waist']);
  });
});

describe('words for readings the contract singles out', () => {
  it('says "Low" and "Very high" in the row, not only in a colour', () => {
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'g', value: 62, at: '2026-10-08T07:00:00.000+05:30' }),
        obs({ id: 'r:systolic', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 186, context: 'bp:r', at: '2026-10-08T08:00:00.000+05:30' }),
        obs({ id: 'r:diastolic', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 92, context: 'bp:r', at: '2026-10-08T08:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => r.detail)).toEqual(['07:00 · Low · Manual entry', '08:00 · Very high · Manual entry']);
  });
});

describe('a walk recorded in segments (walk/record.ts)', () => {
  const shared = { scope: 'sessionObserved' as const, context: 'walk:w2' };
  const seg = (i: number, at: string, minutes: number, km: number, steps: number) => [
    obs({ ...shared, id: `w2:s${i}:walkDuration`, kind: 'walkDuration', unit: 'min', value: minutes, source: 'measured', coverageMs: minutes * 60_000, at }),
    obs({ ...shared, id: `w2:s${i}:movementMinutes`, kind: 'movementMinutes', unit: 'min', value: minutes, source: 'measured', coverageMs: minutes * 60_000, at }),
    obs({ ...shared, id: `w2:s${i}:walkDistance`, kind: 'walkDistance', unit: 'km', value: km, source: 'measured', coverageMs: minutes * 60_000, at }),
    obs({ ...shared, id: `w2:s${i}:steps`, kind: 'steps', unit: 'steps', value: steps, source: 'measured', coverageMs: minutes * 60_000, at }),
  ];
  const gap = obs({ ...shared, id: 'w2:g0:walkDuration', kind: 'walkDuration', unit: 'min', value: 3, source: 'manual', coverageMs: 180_000, at: '2026-10-08T07:12:00.000+05:30' });
  const pain = obs({ id: 'w2:backPain', kind: 'backPain', unit: '0-10', value: 3, context: 'walk:w2', note: 'After a walk.', at: '2026-10-08T07:40:00.000+05:30' });
  const walk = [...seg(0, '2026-10-08T07:00:00.000+05:30', 12, 0.9, 1400), gap, ...seg(1, '2026-10-08T07:15:00.000+05:30', 18, 1.3, 2100), pain];

  it('is one row with the whole walk’s totals, the added minutes named as the person’s, and the pain after it', () => {
    const view = assembleDay(day, { ...empty, observations: walk }, DEFAULT_PREFS);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({
      title: 'Walk', value: '30 min', ref: { type: 'walk', id: 'w2' },
      detail: '07:00 · 2.2 km · 3,500 steps · 3 min added by you · Pain afterwards back 3 of 10 · Measured on a walk',
    });
    expect(view.rows[0].ids).toHaveLength(walk.length);
  });

  it('leaves the pain ratings as readings of their own once the walk itself is deleted', () => {
    const view = assembleDay(day, { ...empty, observations: [pain] }, DEFAULT_PREFS);
    expect(view.rows.map(r => [r.title, r.ref])).toEqual([['Back pain', { type: 'reading', id: 'w2:backPain' }]]);
    expect(view.rows[0].detail).toMatch(/After a walk/);
  });
});

describe('a check-in with rechecks and readings the contract singles out', () => {
  it('holds every lifted reading, rechecks included, and names a serious low and a very high pressure', () => {
    const at = '2026-10-08T07:30:00.000+05:30';
    const bp = (n: string, sys: number, dia: number) => [
      obs({ id: `checkIn:2026-10-08${n}:bloodPressureSystolic`, kind: 'bloodPressureSystolic', unit: 'mmHg', value: sys, context: `bp:checkIn:2026-10-08${n}`, at }),
      obs({ id: `checkIn:2026-10-08${n}:bloodPressureDiastolic`, kind: 'bloodPressureDiastolic', unit: 'mmHg', value: dia, context: `bp:checkIn:2026-10-08${n}`, at: '2026-10-08T07:31:00.000+05:30' }),
    ].map((o, i) => (i === 1 ? { ...o, at } : o));
    const view = assembleDay(day, {
      observations: [
        obs({ id: 'checkIn:2026-10-08:glucose', context: 'checkIn:2026-10-08', value: 52, at }),
        ...bp('', 184, 96),
        ...bp('#1', 176, 94),
      ],
      sessions: [],
      checkIns: [checkIn(day)],
    }, DEFAULT_PREFS);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].ids).toHaveLength(5);
    expect(view.rows[0].detail).toBe('Glucose 52 mg/dL, Serious low · BP 184/96 mmHg, Very high · BP 176/94 mmHg · Your check-in');
  });

  it('says a meter’s HI as the meter did, with no number', () => {
    const view = assembleDay(day, { ...empty, checkIns: [checkIn(day, { glucoseDisplay: { display: 'HI' } })] }, DEFAULT_PREFS);
    expect(view.rows[0].detail).toBe('Glucose HI, past the meter’s range · Your check-in');
  });
});

describe('a hand-logged workout’s length', () => {
  it('is its active time, never the span from first set to finish (R01, F20)', () => {
    const spanOnly = session({ id: 'm1', date: day, guided: false, muscleGroup: 'back', startedAt: '2026-10-08T03:30:00.000Z', completedAt: '2026-10-08T07:30:00.000Z' });
    const entered = session({ id: 'm2', date: day, guided: false, muscleGroup: 'back', startedAt: '2026-10-08T08:30:00.000Z', completedAt: '2026-10-08T09:30:00.000Z', durationSeconds: 300 });
    const view = assembleDay(day, { ...empty, sessions: [spanOnly, entered] }, DEFAULT_PREFS);
    expect(view.rows.map(r => r.value)).toEqual([undefined, '5 min']);
  });
});

describe('two readings recorded at the same moment (F14)', () => {
  it('keep the order they were saved in, by commit order, not by their random ids', () => {
    const at = '2026-10-08T09:00:00.000+05:30';
    const half = (reading: string, kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, seq: number) =>
      ({ ...obs({ id: `${reading}:${kind}`, kind, unit: 'mmHg', value, context: `bp:${reading}`, at }), seq });
    const view = assembleDay(day, {
      ...empty,
      observations: [half('reading-z', 'bloodPressureSystolic', 150, 4), half('reading-z', 'bloodPressureDiastolic', 90, 4), half('reading-b', 'bloodPressureSystolic', 140, 5), half('reading-b', 'bloodPressureDiastolic', 88, 5)],
    }, DEFAULT_PREFS);
    expect(view.rows.map(r => r.value)).toEqual(['150/90 mmHg', '140/88 mmHg']);
  });
});

describe('a day total that belongs to a walk', () => {
  it('is shown once, with the day totals, not again inside the walk', () => {
    const at = '2026-10-08T18:10:00.000+05:30';
    const view = assembleDay(day, {
      ...empty,
      observations: [
        obs({ id: 'd', kind: 'walkDuration', unit: 'min', value: 20, scope: 'sessionObserved', source: 'measured', coverageMs: 1_200_000, context: 'walk:w1', at }),
        obs({ id: 't', kind: 'walkDistance', unit: 'km', value: 3.2, scope: 'dayTotal', context: 'walk:w1', at }),
      ],
    }, DEFAULT_PREFS);
    expect(view.totals.map(t => t.ids)).toEqual([['t']]);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].ids).toEqual(['d']);
  });
});
