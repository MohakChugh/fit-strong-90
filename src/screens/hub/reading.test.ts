import { describe, expect, it } from 'vitest';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { historyRange, hubAdd, labFrom, latestFor, readingSpec, weekValues } from './reading';

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const g = (id: string, day: string, time: string, value: number, tag?: Observation['tag']) =>
  newObservation({ id, kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${day}T${time}:00.000+05:30`, ...(tag ? { tag } : {}) });
const bp = (id: string, day: string, time: string, s: number, d: number, tag?: Observation['tag']): Observation[] => {
  const shared = { at: `${day}T${time}:00.000+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(id), ...(tag ? { tag } : {}) };
  return [
    newObservation({ ...shared, id: `${id}:s`, kind: 'bloodPressureSystolic', value: s }),
    newObservation({ ...shared, id: `${id}:d`, kind: 'bloodPressureDiastolic', value: d }),
  ];
};
const ctx = { prefs: { ...DEFAULT_PREFS, hour12: true }, profile: undefined, current: TODAY };

describe('readingSpec and labFrom (journey §8.2, B-14)', () => {
  it('knows each reading hub, and nothing else', () => {
    expect(readingSpec('glucose')?.add).toEqual({ kind: 'glucose' });
    expect(readingSpec('bp')?.metric).toBe('bloodPressure');
    expect(readingSpec('steps')).toBeUndefined();
    expect(readingSpec('nope')).toBeUndefined();
  });
  it('Labs keeps its kind', () => {
    expect(readingSpec('labs', 'b12')).toMatchObject({ metric: 'b12', add: { kind: 'lab', lab: 'b12' } });
    expect(labFrom('vitd')).toBe('vitaminD');
    expect(labFrom('nonsense')).toBe('hba1c');
    expect(labFrom(null)).toBe('hba1c');
  });
});

describe('hubAdd: a link opens this hub’s own form, never another’s', () => {
  it('opens the form asked for only when it is this hub’s', () => {
    const glucose = readingSpec('glucose')!;
    expect(hubAdd(glucose, 'glucose')).toEqual({ kind: 'glucose' });
    expect(hubAdd(glucose, 'bloodPressure')).toBeUndefined();
    expect(hubAdd(glucose, null)).toBeUndefined();
    expect(hubAdd(readingSpec('bp')!, 'bloodPressureSystolic')).toEqual({ kind: 'bloodPressure' });
    expect(hubAdd(readingSpec('labs', 'b12')!, 'b12')).toEqual({ kind: 'lab', lab: 'b12' });
    expect(hubAdd(readingSpec('labs', 'hba1c')!, 'b12')).toBeUndefined();
  });
});

describe('latestFor (journey §8.2 Latest, §4.10)', () => {
  it('glucose: the latest reading, with when, context and source, the contract’s word and v1’s reading of it', () => {
    const l = latestFor(readingSpec('glucose')!, [g('a', '2026-10-07', '08:00', 140, 'fasting'), g('b', TODAY, '09:05', 62, 'beforeExercise')], ctx);
    expect(l).toMatchObject({ value: '62 mg/dL', when: 'Today · 9:05 am', context: 'Before exercise', source: 'Manual entry', flag: 'Low', ref: { type: 'reading', id: 'b' } });
    expect(l?.reading?.text).toMatch(/^A low \(ADA level 1\)/);
  });

  it('blood pressure: the latest reading, put back together from its halves', () => {
    const l = latestFor(readingSpec('bp')!, [...bp('r1', TODAY, '07:30', 132, 84), ...bp('r2', TODAY, '07:31', 128, 82)], ctx);
    expect(l).toMatchObject({ value: '128/82 mmHg', when: 'Today · 7:31 am', ref: { type: 'pressure' } });
  });

  it('water: the last day with a total', () => {
    const w = newObservation({ id: 'w', kind: 'water', value: 1500, unit: 'ml', scope: 'dayTotal', source: 'manual', at: '2026-10-06T10:00:00.000+05:30' });
    expect(latestFor(readingSpec('water')!, [w], ctx)).toMatchObject({ value: '1,500 ml', when: 'Tuesday, 6 October' });
  });

  it('nothing yet: no Latest', () => {
    expect(latestFor(readingSpec('weight')!, [], ctx)).toBeUndefined();
  });
});

describe('weekValues (journey §8.2 This week, D14)', () => {
  it('Monday to today, a line a day, each value with its unit, and "Not entered" on a day with none', () => {
    const obs = [g('a', '2026-10-06', '07:00', 112, 'fasting'), g('b', '2026-10-06', '13:30', 168, 'afterMeal'), g('c', '2026-10-06', '20:00', 130)];
    const week = weekValues(readingSpec('glucose')!, obs, DEFAULT_PREFS, TODAY);
    expect(week.map(d => d.name)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday']);
    expect(week[0]).toMatchObject({ text: 'Not entered', entered: false });
    // Each with when it was measured and its context (codex H2-04).
    expect(week[1].text).toBe('112 mg/dL at 07:00, fasting; 168 mg/dL at 13:30, after a meal; and 1 more');
  });

  it('blood pressure reads as pairs, each with its time', () => {
    expect(weekValues(readingSpec('bp')!, bp('r1', '2026-10-05', '07:30', 132, 84), DEFAULT_PREFS, TODAY)[0].text).toBe('132/84 mmHg at 07:30');
  });
});

describe('the week’s clinical readings say when each was measured, and in what context (codex H2-04, journey §4.10)', () => {
  const hour12 = { ...DEFAULT_PREFS, hour12: true };

  it('blood pressure: each pair with its day, its time, and its Morning or Evening', () => {
    const pairs = [...bp('r1', '2026-10-06', '07:30', 132, 84, 'morning'), ...bp('r2', '2026-10-06', '19:45', 128, 80, 'evening')];
    const week = weekValues(readingSpec('bp')!, pairs, hour12, TODAY);
    expect(week[1]).toMatchObject({ name: 'Tuesday', date: 'Tuesday, 6 October', text: '132/84 mmHg at 7:30 am, morning; 128/80 mmHg at 7:45 pm, evening' });
    expect(week[1].readings).toEqual(['132/84 mmHg at 7:30 am, morning', '128/80 mmHg at 7:45 pm, evening']);
  });

  it('glucose: each reading with its time and its context', () => {
    const week = weekValues(readingSpec('glucose')!, [g('a', '2026-10-06', '07:00', 112, 'fasting'), g('b', '2026-10-06', '13:30', 168, 'afterMeal')], hour12, TODAY);
    expect(week[1].text).toBe('112 mg/dL at 7:00 am, fasting; 168 mg/dL at 1:30 pm, after a meal');
  });

  it('a condensed day keeps every reading, each in full, for its labelled detail', () => {
    const obs = [g('a', '2026-10-06', '07:00', 112, 'fasting'), g('b', '2026-10-06', '13:30', 168, 'afterMeal'), g('c', '2026-10-06', '20:00', 130)];
    const day = weekValues(readingSpec('glucose')!, obs, hour12, TODAY)[1];
    expect(day.text).toBe('112 mg/dL at 7:00 am, fasting; 168 mg/dL at 1:30 pm, after a meal; and 1 more');
    expect(day.readings).toEqual(['112 mg/dL at 7:00 am, fasting', '168 mg/dL at 1:30 pm, after a meal', '130 mg/dL at 8:00 pm']);
  });

  it('a reading with no clock time of its own is never given one', () => {
    // A past day's check-in reading, stamped at midday as a stand-in.
    const noted = newObservation({ id: 'ci', kind: 'glucose', value: 104, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-06T12:00:00.000+05:30', context: 'checkIn:2026-10-06' });
    expect(weekValues(readingSpec('glucose')!, [noted], hour12, TODAY)[1].text).toBe('104 mg/dL');
  });

  it('other measurements keep their one value a day', () => {
    const w = newObservation({ id: 'w', kind: 'weight', value: 78.4, unit: 'kg', scope: 'pointInTime', source: 'manual', at: '2026-10-06T07:00:00.000+05:30' });
    expect(weekValues(readingSpec('weight')!, [w], hour12, TODAY)[1]).toMatchObject({ text: '78.4 kg', date: 'Tuesday, 6 October' });
    expect(weekValues(readingSpec('weight')!, [w], hour12, TODAY)[1].readings).toBeUndefined();
  });
});

describe('historyRange', () => {
  it('runs from the first record of the hub’s kinds to today', () => {
    expect(historyRange({ metric: 'glucose' }, [g('a', '2026-01-02', '08:00', 100)], TODAY)).toEqual({ from: '2026-01-02', to: TODAY });
    expect(historyRange({ metric: 'glucose' }, [], TODAY)).toEqual({ from: TODAY, to: TODAY });
  });
});

describe('the reading hub model: the edges', () => {
  const total = (id: string, kind: 'water' | 'sleep', day: string, value: number) =>
    newObservation({ id, kind, value, unit: kind === 'water' ? 'ml' : 'h', scope: 'dayTotal', source: 'manual', at: `${day}T10:00:00.000+05:30` });
  const weight = (id: string, day: string, time: string, value: number) =>
    newObservation({ id, kind: 'weight', value, unit: 'kg', scope: 'pointInTime', source: 'manual', at: `${day}T${time}:00.000+05:30` });

  it('Labs reads every name it can arrive with, and a form asked for without a lab opens this hub’s own', () => {
    expect(labFrom('vitaminD')).toBe('vitaminD');
    expect(hubAdd(readingSpec('labs', 'b12')!, 'lab')).toEqual({ kind: 'lab', lab: 'b12' });
  });

  it('a very high blood pressure carries the contract’s word and v1’s reading of it', () => {
    const l = latestFor(readingSpec('bp')!, bp('r3', TODAY, '08:00', 182, 122), ctx);
    expect(l).toMatchObject({ value: '182/122 mmHg', flag: 'Very high' });
    expect(l?.reading?.tone).toBe('stop');
  });

  it('sleep is a day total: the latest night, and each night of the week', () => {
    const nights = [total('s1', 'sleep', '2026-10-05', 6), total('s2', 'sleep', '2026-10-07', 7.5)];
    expect(latestFor(readingSpec('sleep')!, nights, ctx)).toMatchObject({ value: '7.5 h', when: 'Yesterday' });
    expect(weekValues(readingSpec('sleep')!, nights, DEFAULT_PREFS, TODAY).map(d => d.text)).toEqual(['6.0 h', 'Not entered', '7.5 h', 'Not entered']);
  });

  it('a day with two weights says the later one; History counts only the hub’s own kinds', () => {
    const w = [weight('w1', '2026-10-06', '07:00', 78.4), weight('w2', '2026-10-06', '19:00', 78.9)];
    expect(weekValues(readingSpec('weight')!, w, DEFAULT_PREFS, TODAY)[1].text).toBe('78.9 kg');
    expect(historyRange({ metric: 'glucose' }, [weight('w0', '2026-01-02', '07:00', 80), g('a', '2026-05-02', '08:00', 100)], TODAY)).toEqual({ from: '2026-05-02', to: TODAY });
  });
});
