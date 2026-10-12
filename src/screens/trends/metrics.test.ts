import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { CATEGORIES } from '@/categories';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { TREND_ORDER, figuresFor, hasData, labPoints, readingsFor, trendDef } from './metrics';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const zone = env.TZ;
beforeAll(() => { env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete env.TZ; else env.TZ = zone; });

const RANGE = { from: '2026-10-05', to: '2026-10-11' };
const prefs = { ...DEFAULT_PREFS, hour12: true };
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const g = (value: number, unit: 'mg/dL' | 'mmol/L', at: string, tag?: 'fasting' | 'afterMeal') =>
  newObservation({ kind: 'glucose', value, unit, at, scope: 'pointInTime', source: 'manual', ...(tag ? { tag } : {}) });

describe('a trend for each category that declares one (B-14)', () => {
  it('every category’s trend address has a trend here, but Food’s, which Plan 7 builds; Learn declares none; Mood is extra', () => {
    for (const c of CATEGORIES) {
      if (c.id === 'food') {
        expect(trendDef('food')).toBeUndefined();
        continue;
      }
      if (c.trend === undefined) {
        expect(c.id).toBe('learn');
        continue;
      }
      expect(trendDef(c.id)?.id, c.id).toBe(c.id);
      expect(c.trend).toBe(`/trends/${c.id}`);
    }
    expect(TREND_ORDER).toEqual(['workout', 'stretch', 'walk', 'steps', 'glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'mood']);
  });

  it('finds a trend by its address id, and nothing for anything else', () => {
    expect(trendDef('steps')).toMatchObject({ title: 'Steps', family: 'stated', movement: true });
    expect(trendDef('glucose')).toMatchObject({ family: 'readings', movement: false });
    expect(trendDef('walk')).toMatchObject({ family: 'counted', movement: true });
    for (const id of ['food', 'learn', 'nope', 'constructor', undefined]) expect(trendDef(id), String(id)).toBeUndefined();
  });
});

describe('readings in the person’s own unit (Review Focus 1)', () => {
  const both = data([g(112, 'mg/dL', '2026-10-05T07:30:00+05:30', 'fasting'), g(7, 'mmol/L', '2026-10-06T07:30:00+05:30', 'fasting'), g(3.5, 'mmol/L', '2026-10-07T07:30:00+05:30', 'fasting')]);

  it('converts every reading to the unit shown, whatever it was stored in', () => {
    expect(readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mg/dL' }).points.map(p => p.value)).toEqual([112, 126, 63]);
    // Unrounded, as the statistics count them (KT-15); the words round them as shown.
    const mmol = readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mmol/L' }).points.map(p => p.value);
    [112 / 18, 7, 3.5].forEach((v, i) => expect(mmol[i]).toBeCloseTo(v, 9));
  });

  it('judges low and high on the reading itself, in either unit', () => {
    const points = readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mmol/L' }).points;
    expect(points.map(p => p.low === true)).toEqual([false, false, true]);
    const high = readingsFor('glucose', RANGE, data([g(15, 'mmol/L', '2026-10-05T09:00:00+05:30')]), prefs).points[0];
    expect(high.high).toBe(true);
  });

  it('a low is under 70 and a high over 250, so 70 and 250 themselves are neither', () => {
    const at = (h: number) => `2026-10-05T${String(h).padStart(2, '0')}:00:00+05:30`;
    const points = readingsFor('glucose', RANGE, data([g(69, 'mg/dL', at(7)), g(70, 'mg/dL', at(8)), g(250, 'mg/dL', at(9)), g(251, 'mg/dL', at(10))]), prefs).points;
    expect(points.map(p => [p.value, p.low === true, p.high === true])).toEqual([[69, true, false], [70, false, false], [250, false, false], [251, false, true]]);
  });

  it('says each reading with its time and context, and names a low', () => {
    const texts = readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mg/dL' }).texts;
    expect(texts.map(t => [t.text, t.note])).toEqual([
      ['112 mg/dL at 7:30 am, fasting', undefined], ['126 mg/dL at 7:30 am, fasting', undefined], ['63 mg/dL at 7:30 am, fasting', 'Low'],
    ]);
  });
});

describe('glucose by context, with a meter’s HI and LO', () => {
  it('a series for each context present, in a fixed order, and the meter’s displays beside them', () => {
    const obs = [g(168, 'mg/dL', '2026-10-06T14:10:00+05:30', 'afterMeal'), g(118, 'mg/dL', '2026-10-05T07:30:00+05:30', 'fasting')];
    const lo = { date: '2026-10-07', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-07T13:00:00+05:30' } } as unknown as CheckInRecord;
    const r = readingsFor('glucose', RANGE, data(obs, [], [lo]), prefs);
    expect(r.series.map(s => [s.id, s.label, s.shape])).toEqual([['beforeMeal', 'Fasting or before a meal', 'circle'], ['afterMeal', 'After a meal', 'triangle']]);
    expect(r.meters).toEqual([{ day: '2026-10-07', at: '2026-10-07T13:00:00+05:30', display: 'LO' }]);
    expect(r.texts.at(-1)).toEqual({ day: '2026-10-07', at: '2026-10-07T13:00:00+05:30', text: 'Meter showed LO at 1:00 pm', note: 'Below what the meter can show' });
    // Oldest first, as they were measured, not as they were entered.
    expect(r.texts.map(t => t.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });

  it('a HI is said as one; a display outside the range is that window’s', () => {
    const hi = { date: '2026-10-06', glucoseDisplay: { display: 'HI', measuredAt: '2026-10-06T21:00:00+05:30' } } as unknown as CheckInRecord;
    const earlier = { date: '2026-10-02', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-02T13:00:00+05:30' } } as unknown as CheckInRecord;
    const r = readingsFor('glucose', RANGE, data([], [], [hi, earlier]), prefs);
    expect(r.meters.map(m => m.display)).toEqual(['HI']);
    expect(r.texts).toEqual([{ day: '2026-10-06', at: '2026-10-06T21:00:00+05:30', text: 'Meter showed HI at 9:00 pm', note: 'Above what the meter can show' }]);
  });
});

describe('back and leg pain, weight, waist and mood', () => {
  const at = '2026-10-05T07:30:00+05:30';
  it('back and leg are their own series, each said with its time', () => {
    const r = readingsFor('back', RANGE, data([
      newObservation({ kind: 'backPain', value: 6, at, scope: 'pointInTime', source: 'manual' }),
      newObservation({ kind: 'legPain', value: 3, at, scope: 'pointInTime', source: 'manual' }),
    ]), prefs);
    expect(r.points.map(p => `${p.series}:${p.value}`)).toEqual(['back:6', 'leg:3']);
    expect(r.series.map(s => s.label)).toEqual(['Back pain', 'Leg pain']);
    expect(r.texts.map(t => t.text)).toEqual(['Back 6 of 10 at 7:30 am', 'Leg 3 of 10 at 7:30 am']);
  });

  it('weight in the person’s own unit', () => {
    const r = readingsFor('weight', RANGE, data([newObservation({ kind: 'weight', value: 70, at, scope: 'pointInTime', source: 'manual' })]), { ...prefs, mass: 'lb' });
    expect(r.points[0].value).toBeCloseTo(70 / 0.45359237, 9);
    expect(r.texts.map(t => t.text)).toEqual(['154.3 lb at 7:30 am']);
  });
});

describe('blood pressure: two numbers in one reading', () => {
  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, at: string, id: string) =>
    newObservation({ kind, value, at, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
  it('each number in its own series; a half with no partner keeps its number; a very high reading is named', () => {
    const obs = [
      half('bloodPressureSystolic', 132, '2026-10-05T07:30:00+05:30', 'r1'), half('bloodPressureDiastolic', 84, '2026-10-05T07:30:00+05:30', 'r1'),
      half('bloodPressureSystolic', 184, '2026-10-06T07:30:00+05:30', 'r2'), half('bloodPressureDiastolic', 96, '2026-10-06T07:30:00+05:30', 'r2'),
      half('bloodPressureSystolic', 128, '2026-10-07T07:30:00+05:30', 'r3'),
    ];
    const r = readingsFor('bp', RANGE, data(obs), prefs);
    expect(r.points.map(p => `${p.series}:${p.value}`)).toEqual(['systolic:132', 'diastolic:84', 'systolic:184', 'diastolic:96', 'systolic:128']);
    expect(r.texts.map(t => t.note)).toEqual([undefined, 'Very high', undefined]);
    expect(r.texts[0].text).toBe('132/84 mmHg at 7:30 am');
  });

  it('keeps the context it was recorded with, as glucose keeps its own (H3-06, J§4.10)', () => {
    const tagged = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
      newObservation({ kind, value, at: '2026-10-05T21:10:00+05:30', scope: 'pointInTime', source: 'manual', context: bpContext('e1'), tag: 'evening' });
    const r = readingsFor('bp', RANGE, data([tagged('bloodPressureSystolic', 136), tagged('bloodPressureDiastolic', 86)]), prefs);
    expect(r.texts.map(t => t.text)).toEqual(['136/86 mmHg at 9:10 pm, evening']);
  });
});

describe('daily figures and labs', () => {
  const session = (date: string, over: Partial<WorkoutSession>): WorkoutSession => ({
    id: `${date}-${over.planKind}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: `${date}T07:30:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true, ...over,
  });
  it('keeps each kind of movement to its own trend', () => {
    const d = data([], [session('2026-10-05', { planKind: 'full', durationSeconds: 2700 }), session('2026-10-06', { planKind: 'stretch', durationSeconds: 600 })]);
    expect(figuresFor('workout', RANGE, d, prefs)).toEqual([{ day: '2026-10-05', value: 45 }]);
    expect(figuresFor('stretch', RANGE, d, prefs)).toEqual([{ day: '2026-10-06', value: 10 }]);
    expect(figuresFor('glucose', RANGE, d, prefs)).toEqual([]);
  });

  it('labs in the unit their lab reports, oldest first', () => {
    const lab = (value: number, unit: '%' | 'mmol/mol', day: string) => newObservation({ kind: 'hba1c', value, unit, at: `${day}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });
    const labs = labPoints('hba1c', [lab(53, 'mmol/mol', '2026-06-02'), lab(7.4, '%', '2026-03-02')], { ...prefs, hba1c: '%' });
    expect(labs.map(p => [p.day, p.unit])).toEqual([['2026-03-02', '%'], ['2026-06-02', '%']]);
    expect(labs[0].value).toBe(7.4);
    expect(labs[1].value).toBeCloseTo(7, 2);
  });

  it('knows which categories have data: sessions for Workout and Stretch, records for the rest, a meter’s LO for Glucose', () => {
    const lo = { date: '2026-10-07', glucoseDisplay: { display: 'LO' } } as unknown as CheckInRecord;
    expect(hasData('glucose', data([], [], [lo]))).toBe(true);
    expect(hasData('workout', data([], [session('2026-10-05', { planKind: 'full' })]))).toBe(true);
    expect(hasData('workout', data([], [session('2026-10-05', { planKind: 'stretch' })]))).toBe(false);
    expect(hasData('stretch', data([], [session('2026-10-05', { planKind: 'full', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] })]))).toBe(true);
    expect(hasData('steps', data([]))).toBe(false);
    expect(hasData('mood', data([newObservation({ kind: 'mood', value: 3, at: '2026-09-02T12:00:00+05:30', scope: 'pointInTime', source: 'imported' })]))).toBe(true);
  });
});
