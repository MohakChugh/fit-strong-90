import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import type { RecentDeletion } from '@/store/recent';
import { kindTitle, type DisplayPrefs } from './format';
import { recentRow } from './recentRows';

const prefs: DisplayPrefs = { glucose: 'mg/dL', mass: 'kg', length: 'cm', hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL', hour12: true };
const entry = (over: Partial<RecentDeletion>): RecentDeletion => ({ id: 'deleted-1', at: '2026-10-08T09:05:00.000+05:30', kind: 'reading', of: 'x', ...over });
const DAY = '2026-10-08';

describe('Recently deleted, in words (J§20.4 rule 6)', () => {
  it('names a reading by its value, and says when it went', () => {
    const water = newObservation({ id: 'w2', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: '2026-10-08T08:05:00+05:30' });
    expect(recentRow(entry({ observations: [water] }), prefs, DAY)).toEqual({ id: 'deleted-1', title: 'Water 500 ml', detail: 'Deleted today at 9:05 am' });
    expect(recentRow(entry({ at: '2026-10-07T18:10:00.000+05:30', observations: [water] }), prefs, DAY).detail).toBe('Deleted yesterday at 6:10 pm');
  });

  it('names a blood pressure reading by both numbers, a walk by its minutes, and a check-in’s reading as its check-in’s', () => {
    const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
      newObservation({ id: `reading-r1:${kind}`, kind, value, scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:00:00+05:30', context: 'bp:reading-r1' });
    expect(recentRow(entry({ kind: 'pressure', observations: [half('bloodPressureSystolic', 142), half('bloodPressureDiastolic', 88)] }), prefs, DAY).title).toBe('Blood pressure 142/88 mmHg');
    const walked = newObservation({ id: 'w:s0:walkDuration', kind: 'walkDuration', value: 20, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30', context: 'walk:w' });
    const pain = newObservation({ id: 'w:backPain', kind: 'backPain', value: 2, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:25:00+05:30', context: 'walk:w' });
    expect(recentRow(entry({ kind: 'walk', observations: [walked, pain] }), prefs, DAY).title).toBe('Walk, 20 min');
    const lifted = newObservation({ id: 'ci-1', kind: 'glucose', value: 118, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:50:00+05:30', context: `checkIn:${DAY}` });
    expect(recentRow(entry({ kind: 'checkInReading', day: DAY, kept: { kind: 'glucose', slot: 'current', entry: { value: 118, unit: 'mg/dL', measuredAt: lifted.at } }, observations: [lifted] }), prefs, DAY).title)
      .toBe('Glucose 118 mg/dL, from your check-in');
  });

  it('names an energy figure from movement without its figure once counts-free is chosen, though it was deleted with estimates on (P8S-10)', () => {
    const energy = newObservation({ id: 'e1', kind: 'activeEnergy', value: 85, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30' });
    const e = entry({ observations: [energy] });
    expect(recentRow(e, prefs, DAY).title).toMatch(/85/);
    const row = recentRow(e, prefs, DAY, true);
    expect(row.title).toBe(kindTitle('activeEnergy'));
    expect(`${row.title} ${row.detail}`).not.toMatch(/85|kcal/);
    // Only that figure: a reading of anything else keeps its value.
    const water = newObservation({ id: 'w2', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: '2026-10-08T08:05:00+05:30' });
    expect(recentRow(entry({ observations: [water] }), prefs, DAY, true).title).toBe('Water 500 ml');
  });

  it('says the day one deleted further back went, and names a check-in’s blood pressure by both numbers', () => {
    expect(recentRow(entry({ at: '2026-10-05T07:30:00.000+05:30' }), prefs, DAY).detail).toBe('Deleted on Monday, 5 October at 7:30 am');
    const bp = { sys: 132, dia: 84, at: '2026-10-08T08:52:00.000+05:30' };
    expect(recentRow(entry({ kind: 'checkInReading', day: DAY, kept: { kind: 'pressure', slot: 'readings', entry: bp, halves: [] } }), prefs, DAY).title)
      .toBe('Blood pressure 132/84 mmHg, from your check-in');
  });

  it('counts a walk’s minutes in whole minutes, and names by its kind what it can’t read', () => {
    const segment = (i: number, value: number) => newObservation({ id: `w:s${i}:walkDuration`, kind: 'walkDuration', value, scope: 'sessionObserved', coverageMs: value * 60_000, source: 'measured', at: '2026-10-08T07:00:00+05:30', context: 'walk:w' });
    expect(recentRow(entry({ kind: 'walk', observations: [segment(0, 20.4), segment(1, 9.8)] }), prefs, DAY).title).toBe('Walk, 30 min');
    expect(recentRow(entry({ kind: 'walk', observations: [] }), prefs, DAY).title).toBe('Walk');
    expect(recentRow(entry({}), prefs, DAY).title).toBe('A reading');
    expect(recentRow(entry({ kind: 'checkInReading', day: DAY }), prefs, DAY).title).toBe('A check-in reading');
    expect(recentRow(entry({ kind: 'meal' }), prefs, DAY).title).toBe('A meal');
    expect(recentRow(entry({ kind: 'usualMeal' }), prefs, DAY).title).toBe('A usual meal');
    expect(recentRow(entry({ kind: 'ownFood', records: { customFoods: [{ id: 'food-1' }] } }), prefs, DAY).title).toBe('One of your own foods');
    expect(recentRow(entry({ kind: 'session' }), prefs, DAY).title).toBe('A workout');
  });

  it('names a meal, a usual meal and an own food by their words, never a figure (B-11), and a workout by its kind', () => {
    const meal = { id: 'meal-1', at: '2026-10-08T13:10:00.000+05:30', day: DAY, meal: 'lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], level: 'meals', loggedAt: '2026-10-08T13:10:00.000+05:30', edits: [] };
    expect(recentRow(entry({ kind: 'meal', records: { meals: [meal] } }), prefs, DAY).title).toBe('Lunch: Normal plate');
    expect(recentRow(entry({ kind: 'usualMeal', records: { savedMeals: [{ id: 'usual-1', name: 'Weekday lunch' }] } }), prefs, DAY).title).toBe('Usual meal: Weekday lunch');
    expect(recentRow(entry({ kind: 'ownFood', records: { customFoods: [{ id: 'food-1', name: 'Bhel puri' }] } }), prefs, DAY).title).toBe('Your own food: Bhel puri');
    expect(recentRow(entry({ kind: 'session', session: { id: 's1', date: DAY, muscleGroup: 'lower', guided: false } as never }), prefs, DAY).title).toMatch(/workout|session/i);
  });
});
