import { describe, expect, it } from 'vitest';
import type { Observation } from '@/health/observation';
import { createDefaultProfile } from '@/profile/defaults';
import { DEFAULT_PREFS } from './format';
import { obs } from './fixtures';
import {
  dayTotalSlots, labUnit, metricFromParam, metricPath, metricRows, observedSlots, pressureSlots, readingSlots, readingsOf,
  trackedMetrics,
} from './metrics';
import { trendRows, weekPhrase } from './trends';
import { metricNotes } from './metrics';
import { currentStepsGoal, stepsGoalOn, stepsGoalThroughout, stepsProgress, withStepsGoal } from './stepsGoal';
import { assembleDay } from './timeline';

const now = '2026-10-08';
const week = { from: '2026-10-02', to: '2026-10-08' };

describe('metricFromParam', () => {
  it('takes a metric id or any stored kind, and nothing else', () => {
    expect(metricFromParam('glucose')).toBe('glucose');
    expect(metricFromParam('bloodPressure')).toBe('bloodPressure');
    expect(metricFromParam('bloodPressureDiastolic')).toBe('bloodPressure');
    expect(metricFromParam('backPain')).toBe('backLeg');
    expect(metricFromParam('walkDistance')).toBe('walking');
    expect(metricFromParam('movementMinutes')).toBeUndefined();
    expect(metricFromParam('constructor')).toBeUndefined();
    expect(metricFromParam(undefined)).toBeUndefined();
  });

  it('sends back and leg to the signature screen', () => {
    expect(metricPath('backLeg')).toBe('/track/back');
    expect(metricPath('weight')).toBe('/track/metric/weight');
  });
});

describe('trackedMetrics', () => {
  it('lists only what has data or what the profile makes relevant', () => {
    expect(trackedMetrics([], undefined)).toEqual([]);
    const owner = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'] }, health: { diabetes: 'type2', hypertension: 'treated' } });
    expect(trackedMetrics([], owner)).toEqual(['glucose', 'bloodPressure', 'backLeg']);
    expect(trackedMetrics([obs({ id: 'w', kind: 'water', unit: 'ml', scope: 'dayTotal', value: 250 })], undefined)).toEqual(['water']);
  });
});

describe('chart slots: a gap stays a gap', () => {
  it('gives each reading a slot and each empty day one empty slot', () => {
    const points = readingSlots([
      { day: '2026-10-03', at: '2026-10-03T08:00:00.000+05:30', value: 120 },
      { day: '2026-10-03', at: '2026-10-03T07:00:00.000+05:30', value: 110 },
      { day: '2026-10-07', at: '2026-10-07T07:00:00.000+05:30', value: 101 },
      { day: '2026-09-01', at: '2026-09-01T07:00:00.000+05:30', value: 99 },
    ], week, now);
    expect(points.map(p => p.value)).toEqual([null, 110, 120, null, null, null, 101, null]);
    expect(points[1].label).toBe('3 Oct');
  });

  it('converts readings to the display unit at reading precision', () => {
    const r = readingsOf('glucose', [obs({ id: 'a', value: 6.2, unit: 'mmol/L' })], DEFAULT_PREFS);
    expect(r[0].value).toBe(112);
    const filtered = readingsOf('glucose', [obs({ id: 'a', tag: 'fasting' }), obs({ id: 'b', tag: 'afterMeal' })], DEFAULT_PREFS, o => o.tag === 'fasting');
    expect(filtered).toHaveLength(1);
  });

  it('charts a day total once per day, never a zero for a missing day', () => {
    const points = dayTotalSlots('water', [
      obs({ id: '1', kind: 'water', unit: 'ml', scope: 'dayTotal', value: 250, at: '2026-10-05T08:00:00.000+05:30' }),
      obs({ id: '2', kind: 'water', unit: 'ml', scope: 'dayTotal', value: 750, at: '2026-10-05T18:00:00.000+05:30' }),
    ], week, now);
    expect(points.map(p => p.value)).toEqual([null, null, null, 750, null, null, null]);
  });

  it('keeps steps seen on a walk out of the day-total chart', () => {
    const walkSteps = obs({ id: 'ws', kind: 'steps', unit: 'steps', scope: 'sessionObserved', coverageMs: 600_000, value: 1200, at: '2026-10-05T08:00:00.000+05:30' });
    expect(dayTotalSlots('steps', [walkSteps], week, now).every(p => p.value === null)).toBe(true);
    expect(observedSlots('steps', [walkSteps], week, now)[3].value).toBe(1200);
  });

  it('pairs blood pressure slots and keeps missing halves null', () => {
    const slots = pressureSlots([
      obs({ id: 'a:s', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 140, context: 'bp:a', at: '2026-10-04T07:00:00.000+05:30' }),
      obs({ id: 'a:d', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 90, context: 'bp:a', at: '2026-10-04T07:00:00.000+05:30' }),
      obs({ id: 'b:s', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 150, context: 'bp:b', at: '2026-10-04T19:00:00.000+05:30' }),
    ], week, now);
    expect(slots.filter(s => s.systolic !== null || s.diastolic !== null)).toEqual([
      { label: '4 Oct', systolic: 140, diastolic: 90 },
      { label: '4 Oct', systolic: 150, diastolic: null },
    ]);
    expect(slots).toHaveLength(8);
  });

  it('shows a lab result in the unit its lab used last', () => {
    const older = obs({ id: 'a', kind: 'vitaminD', unit: 'nmol/L', value: 60, at: '2026-01-01T10:00:00.000+05:30' });
    const newer = obs({ id: 'b', kind: 'vitaminD', unit: 'ng/mL', value: 24, at: '2026-08-01T10:00:00.000-04:00' });
    expect(labUnit('vitaminD', [newer, older], 'nmol/L')).toBe('ng/mL');
    expect(labUnit('vitaminD', [], 'ng/mL')).toBe('ng/mL');
  });
});

describe('trendRows', () => {
  const owner = createDefaultProfile({ pain: { areas: ['sciatica'] }, health: { diabetes: 'type2', hypertension: 'treated' } });

  it('says "Not entered" for a relevant measure with no data, never a zero', () => {
    const rows = trendRows('2026-10-08', { observations: [], profile: owner }, DEFAULT_PREFS, now);
    expect(rows.map(r => [r.title, r.value, r.detail])).toEqual([
      ['Glucose', 'Not entered', 'No readings yet'],
      ['Blood pressure', 'Not entered', 'No readings yet'],
      ['Back & leg', 'Not entered', 'No readings yet'],
    ]);
  });

  it('gives the latest value and this week’s count, Monday to Sunday', () => {
    const rows = trendRows('2026-10-08', {
      observations: [
        obs({ id: 'old', value: 140, at: '2026-10-04T07:00:00.000+05:30' }), // the Sunday before
        obs({ id: 'a', value: 120, at: '2026-10-06T07:00:00.000+05:30' }),
        obs({ id: 'b', value: 112, at: '2026-10-08T07:00:00.000+05:30' }),
        obs({ id: 'future', value: 99, at: '2026-10-09T07:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS, now);
    expect(rows[0]).toEqual({ metric: 'glucose', title: 'Glucose', value: '112 mg/dL', detail: '2 readings this week · Manual entry', to: '/track/metric/glucose' });
  });

  it('describes a past week by its Monday', () => {
    expect(weekPhrase('2026-10-08', now)).toBe('this week');
    expect(weekPhrase('2026-10-01', now)).toBe('in the week of 28 Sep');
  });

  it('dates lab results rather than counting them', () => {
    const rows = trendRows('2026-10-08', { observations: [obs({ id: 'h', kind: 'hba1c', unit: '%', value: 7.2, at: '2026-08-12T10:00:00.000+05:30' })] }, DEFAULT_PREFS, now);
    expect(rows[0]).toMatchObject({ title: 'HbA1c', value: '7.2%', detail: 'Tested 12 Aug · Manual entry' });
  });

  it('gives a day total’s latest day and how many days this week had one', () => {
    const rows = trendRows('2026-10-08', {
      observations: [
        obs({ id: '1', kind: 'water', unit: 'ml', scope: 'dayTotal', value: 1500, at: '2026-10-06T20:00:00.000+05:30' }),
        obs({ id: '2', kind: 'water', unit: 'ml', scope: 'dayTotal', value: 500, at: '2026-10-08T09:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS, now);
    expect(rows[0]).toMatchObject({ title: 'Water', value: '500 ml', detail: 'Today · 2 days this week · Manual entry' });
  });

  it('pairs blood pressure and gives back and leg together', () => {
    const rows = trendRows('2026-10-08', {
      profile: owner,
      observations: [
        obs({ id: 'r:s', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 132, context: 'bp:r', at: '2026-10-07T07:00:00.000+05:30' }),
        obs({ id: 'r:d', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 84, context: 'bp:r', at: '2026-10-07T07:00:00.000+05:30' }),
        obs({ id: 'bp', kind: 'backPain', unit: '0-10', value: 3, at: '2026-10-07T07:00:00.000+05:30' }),
        obs({ id: 'lp', kind: 'legPain', unit: '0-10', value: 2, at: '2026-10-08T07:00:00.000+05:30' }),
      ],
    }, DEFAULT_PREFS, now);
    expect(rows.find(r => r.metric === 'bloodPressure')).toMatchObject({ value: '132/84 mmHg', detail: '1 reading this week · Manual entry' });
    // The latest record held only a leg score: the row shows that record, not yesterday's back score beside it (J2-13).
    expect(rows.find(r => r.metric === 'backLeg')).toMatchObject({ value: 'Leg 2', detail: '2 days recorded this week · Manual entry', to: '/track/back' });
  });

  it('shows back and leg from one record, under that record’s source (scan J2-13)', () => {
    const checkIn = (id: string, kind: 'backPain' | 'legPain', value: number) =>
      obs({ id, kind, unit: '0-10', value, context: 'checkIn:2026-10-08', at: '2026-10-08T09:00:00.000+05:30' });
    const morning = [checkIn('b1', 'backPain', 4), checkIn('l1', 'legPain', 5)];
    const afterStretch = obs({ id: 's1', kind: 'backPain', unit: '0-10', value: 5, context: 'session:stretch-1', at: '2026-10-08T10:30:00.000+05:30' });
    const row = (observations: Observation[]) => trendRows('2026-10-08', { profile: owner, observations }, DEFAULT_PREFS, now).find(r => r.metric === 'backLeg')!;
    expect(row(morning)).toMatchObject({ value: 'Back 4 · Leg 5', detail: '1 day recorded this week · From your check-in' });
    expect(row([...morning, afterStretch])).toMatchObject({ value: 'Back 5', detail: '1 day recorded this week · After a session' });
    // A later check-in that day is its own record, though it shares the day's context.
    const evening = obs({ id: 'b2', kind: 'backPain', unit: '0-10', value: 6, context: 'checkIn:2026-10-08', at: '2026-10-08T18:00:00.000+05:30' });
    expect(row([...morning, evening])).toMatchObject({ value: 'Back 6', detail: '1 day recorded this week · From your check-in' });
    // Back and leg typed together in Add share their moment: one record.
    const added = ['backPain', 'legPain'].map((kind, i) => obs({ id: `q${i}`, kind: kind as 'backPain', unit: '0-10', value: 2 + i, at: '2026-10-08T19:00:00.000+05:30' }));
    expect(row([...morning, ...added])).toMatchObject({ value: 'Back 2 · Leg 3', detail: '1 day recorded this week · Manual entry' });
    // Another source at the very same moment is still another record.
    const sameMoment = obs({ id: 'm', kind: 'backPain', unit: '0-10', value: 6, at: '2026-10-08T09:00:00.000+05:30' });
    expect(row([sameMoment, ...morning])).toMatchObject({ value: 'Back 6', detail: '1 day recorded this week · Manual entry' });
  });
});

describe('metricRows', () => {
  it('lists readings newest first with date, time, timing, a word for a low, and the source', () => {
    const rows = metricRows('glucose', [
      obs({ id: 'a', value: 112, tag: 'fasting', at: '2026-10-07T07:00:00.000+05:30' }),
      obs({ id: 'b', value: 62, at: '2026-10-08T15:00:00.000+05:30' }),
      obs({ id: 'old', value: 99, at: '2026-08-01T07:00:00.000+05:30' }),
    ], week, DEFAULT_PREFS, now);
    expect(rows.map(r => [r.label, r.detail, r.ref])).toEqual([
      ['62 mg/dL', 'Thu 8 Oct · 15:00 · Low · Manual entry', { type: 'reading', id: 'b' }],
      ['112 mg/dL', 'Wed 7 Oct · 07:00 · Fasting · Manual entry', { type: 'reading', id: 'a' }],
    ]);
  });

  it('can be narrowed to one time of day', () => {
    const rows = metricRows('glucose', [obs({ id: 'a', tag: 'fasting' }), obs({ id: 'b', tag: 'afterMeal' })], week, DEFAULT_PREFS, now, o => o.tag === 'afterMeal');
    expect(rows.map(r => r.ref)).toEqual([{ type: 'reading', id: 'b' }]);
  });

  it('pairs blood pressure and names a very high reading in words', () => {
    const rows = metricRows('bloodPressure', [
      obs({ id: 'r:s', kind: 'bloodPressureSystolic', unit: 'mmHg', value: 182, context: 'bp:r', tag: 'evening', at: '2026-10-06T20:00:00.000+05:30' }),
      obs({ id: 'r:d', kind: 'bloodPressureDiastolic', unit: 'mmHg', value: 96, context: 'bp:r', tag: 'evening', at: '2026-10-06T20:00:00.000+05:30' }),
    ], week, DEFAULT_PREFS, now);
    expect(rows).toEqual([{
      key: 'pressure:r|2026-10-06T20:00:00.000+05:30', label: '182/96 mmHg', detail: 'Tue 6 Oct · 20:00 · Evening · Very high · Manual entry',
      ref: { type: 'pressure', id: 'r' }, ids: ['r:s', 'r:d'],
    }]);
  });

  it('gives one row per day for a day total, and keeps walk steps separate', () => {
    const rows = metricRows('steps', [
      obs({ id: 's1', kind: 'steps', unit: 'steps', scope: 'dayTotal', value: 3000, at: '2026-10-05T12:00:30.000+05:30' }),
      obs({ id: 's2', kind: 'steps', unit: 'steps', scope: 'dayTotal', value: 6400, at: '2026-10-05T21:00:00.000+05:30' }),
      obs({ id: 'wd', kind: 'walkDuration', unit: 'min', scope: 'sessionObserved', coverageMs: 900_000, value: 15, context: 'walk:w9', source: 'measured', at: '2026-10-06T18:00:00.000+05:30' }),
      obs({ id: 'ws', kind: 'steps', unit: 'steps', scope: 'sessionObserved', coverageMs: 900_000, value: 1800, context: 'walk:w9', source: 'measured', at: '2026-10-06T18:00:00.000+05:30' }),
    ], week, DEFAULT_PREFS, now);
    expect(rows.map(r => [r.label, r.detail, r.ref])).toEqual([
      ['1,800 steps', 'Tue 6 Oct · 18:00 · During a walk · Measured on a walk', { type: 'walk', id: 'w9' }],
      ['6,400 steps', 'Mon 5 Oct · Manual entry · Replaces an earlier total', { type: 'reading', id: 's2' }],
    ]);
  });
});

describe('metricRows for walking', () => {
  it('lists a walk paused once as one walk, its segments added, and the person’s added time named', () => {
    const shared = { kind: 'walkDuration' as const, unit: 'min', scope: 'sessionObserved' as const, context: 'walk:w3' };
    const rows = metricRows('walking', [
      obs({ ...shared, id: 'w3:s0', value: 12, source: 'measured', coverageMs: 720_000, at: '2026-10-07T07:00:00.000+05:30' }),
      obs({ ...shared, id: 'w3:g0', value: 3, source: 'manual', coverageMs: 180_000, at: '2026-10-07T07:12:00.000+05:30' }),
      obs({ ...shared, id: 'w3:s1', value: 18, source: 'measured', coverageMs: 1_080_000, at: '2026-10-07T07:15:00.000+05:30' }),
      obs({ id: 'w3:d0', kind: 'walkDistance', unit: 'km', scope: 'sessionObserved', value: 2.2, source: 'measured', coverageMs: 720_000, context: 'walk:w3', at: '2026-10-07T07:00:00.000+05:30' }),
    ], week, DEFAULT_PREFS, now);
    expect(rows.map(r => [r.label, r.detail, r.ref])).toEqual([
      ['30 min', 'Wed 7 Oct · 07:00 · 2.2 km · 3 min added by you · Measured on a walk', { type: 'walk', id: 'w3' }],
    ]);
  });
});

describe('metricRows for back and leg', () => {
  it('names which pain each reading is', () => {
    const rows = metricRows('backLeg', [
      obs({ id: 'b', kind: 'backPain', unit: '0-10', value: 4, at: '2026-10-07T07:00:00.000+05:30' }),
      obs({ id: 'l', kind: 'legPain', unit: '0-10', value: 3, context: 'checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }),
    ], week, DEFAULT_PREFS, now);
    expect(rows.map(r => [r.label, r.detail])).toEqual([
      ['Leg pain 3 of 10', 'Thu 8 Oct · From your check-in'],
      ['Back pain 4 of 10', 'Wed 7 Oct · 07:00 · Manual entry'],
    ]);
  });
});

describe('metricNotes: the interpretation panel judges the latest result (F24)', () => {
  const profile = (() => {
    const p = createDefaultProfile({ health: { diabetes: 'type2' } });
    return { ...p, health: { ...p.health, clinicianTargets: { hba1cPercent: 8 } } };
  })();
  const at = '2026-06-08T12:00:00.000+05:30';
  const older = { ...obs({ id: 'h-a', kind: 'hba1c', unit: '%', value: 6.5, at }), seq: 3 };
  const newer = { ...obs({ id: 'h-b', kind: 'hba1c', unit: '%', value: 9, at }), seq: 4 };

  it('cites the testing cadence to ADA recommendation 6.2, whatever goal judges the result (J06)', () => {
    for (const p of [profile, createDefaultProfile({ health: { diabetes: 'type2' } })]) {
      const note = metricNotes('hba1c', [newer], { prefs: DEFAULT_PREFS, profile: p, habits: undefined, glucoseView: 'all', current: now }).find(n => n.key === 'hba1c')!;
      expect(note.extra).toMatch(/ADA Standards of Care 2026, recommendation 6\.2\./);
    }
  });

  it('takes the later-saved of two results at the same moment, in either order', () => {
    for (const own of [[older, newer], [newer, older]]) {
      const notes = metricNotes('hba1c', own, { prefs: DEFAULT_PREFS, profile, habits: undefined, glucoseView: 'all', current: now });
      const hba1c = notes.find(n => n.key === 'hba1c')!;
      expect(hba1c.reading.text).toMatch(/^At or above 8%, your clinician’s goal\./);
    }
  });
});

describe('Trends says when today is not entered (acceptance J01)', () => {
  const yesterday = obs({ id: 's7', kind: 'steps', unit: 'steps', scope: 'dayTotal', value: 2000, at: '2026-10-07T12:00:00.000+05:30' });

  it('gives today as not entered, with the last day that was, rather than yesterday’s figure as if it were today’s', () => {
    const rows = trendRows('2026-10-08', { observations: [yesterday] }, DEFAULT_PREFS, now);
    expect(rows.find(r => r.metric === 'steps')).toMatchObject({ value: 'Not entered today', detail: 'Yesterday: 2,000 steps · 1 day this week · Manual entry' });
  });

  it('gives today’s figure once it is entered', () => {
    const today = obs({ id: 's8', kind: 'steps', unit: 'steps', scope: 'dayTotal', value: 3000, at: '2026-10-08T12:00:00.000+05:30' });
    expect(trendRows('2026-10-08', { observations: [yesterday, today] }, DEFAULT_PREFS, now).find(r => r.metric === 'steps')).toMatchObject({ value: '3,000 steps' });
  });

  it('names the day looked at when it is not today', () => {
    expect(trendRows('2026-10-08', { observations: [yesterday] }, DEFAULT_PREFS, '2026-10-09').find(r => r.metric === 'steps')?.value).toBe('Not entered on 8 Oct');
  });
});

describe('a daily steps goal (acceptance J07): the person’s own, judged by the day it was in force', () => {
  it('keeps each day against the goal chosen for it, so a change never re-scores a past day', () => {
    let settings: Parameters<typeof stepsGoalOn>[0] = {};
    settings = { ...settings, ...withStepsGoal(settings, 2500, '2026-10-07') };
    settings = { ...settings, ...withStepsGoal(settings, 3000, '2026-10-08') };
    expect(stepsGoalOn(settings, '2026-10-06')).toBeUndefined();
    expect(stepsGoalOn(settings, '2026-10-07')).toBe(2500);
    expect(stepsGoalOn(settings, '2026-10-08')).toBe(3000);
    expect(settings.dailyStepsGoal).toBe(3000);
    // Changed again the same day: that day takes the latest choice.
    settings = { ...settings, ...withStepsGoal(settings, 3500, '2026-10-08') };
    expect(stepsGoalOn(settings, '2026-10-08')).toBe(3500);
    expect(stepsGoalOn(settings, '2026-10-07')).toBe(2500);
    // Removed: no goal from then on, the past kept.
    settings = { ...settings, ...withStepsGoal(settings, undefined, '2026-10-09') };
    expect(stepsGoalOn(settings, '2026-10-09')).toBeUndefined();
    expect(stepsGoalOn(settings, '2026-10-08')).toBe(3500);
    expect(settings.dailyStepsGoal).toBeUndefined();
  });

  it('draws one line on a chart only when the same goal held on every day it shows', () => {
    const settings = { ...withStepsGoal(withStepsGoal({}, 2500, '2026-10-07'), 3000, '2026-10-08') };
    expect(stepsGoalThroughout(settings, '2026-10-08', '2026-10-14')).toBe(3000);
    expect(stepsGoalThroughout(settings, '2026-10-07', '2026-10-07')).toBe(2500);
    expect(stepsGoalThroughout(settings, '2026-10-02', '2026-10-08')).toBe('changed');
    // A goal set within the period is a change too: the days before it had none.
    expect(stepsGoalThroughout(settings, '2026-10-01', '2026-10-07')).toBe('changed');
    expect(stepsGoalThroughout(settings, '2026-09-01', '2026-09-30')).toBeUndefined();
    // Chosen again at the same number: nothing changed.
    expect(stepsGoalThroughout(withStepsGoal(withStepsGoal({}, 2500, '2026-10-01'), 2500, '2026-10-05'), '2026-10-01', '2026-10-08')).toBe(2500);
  });

  it('reads only what the app could have written, since settings may come from an imported file', () => {
    const odd = { dailyStepsGoal: 'lots', dailyStepsGoalHistory: [{ from: '2026-10-07', goal: 2500 }, { from: 'soon', goal: 9000 }, { from: '2026-10-08', goal: -5 }, null] } as never;
    expect(stepsGoalOn(odd, '2026-10-09')).toBe(2500);
    expect(currentStepsGoal(odd)).toBeUndefined();
    expect(stepsGoalOn({ dailyStepsGoalHistory: 'x' } as never, '2026-10-09')).toBeUndefined();
    expect(withStepsGoal(odd, 3000, '2026-10-10').dailyStepsGoalHistory).toEqual([{ from: '2026-10-07', goal: 2500 }, { from: '2026-10-10', goal: 3000 }]);
  });

  it('has no goal, and so no progress, until the person sets one', () => {
    expect(stepsGoalOn({}, '2026-10-08')).toBeUndefined();
    expect(stepsProgress(2000, undefined)).toBeUndefined();
  });

  it('says progress quietly, never rounding up', () => {
    expect(stepsProgress(2000, 2500)).toBe('80% of the 2,500 goal');
    expect(stepsProgress(2499, 2500)).toBe('99% of the 2,500 goal');
    expect(stepsProgress(3100, 3000)).toBe('103% of the 3,000 goal');
  });

  it('shows a day total against that day’s own goal in My Day, and only there', () => {
    const settings = { ...withStepsGoal({}, 2500, '2026-10-07'), ...withStepsGoal(withStepsGoal({}, 2500, '2026-10-07'), 3000, '2026-10-08') };
    const steps = obs({ id: 's', kind: 'steps', unit: 'steps', scope: 'dayTotal', value: 2000, at: '2026-10-07T09:00:00.000+05:30' });
    const day = assembleDay('2026-10-07', { observations: [steps], sessions: [], checkIns: [], settings }, DEFAULT_PREFS);
    expect(day.totals[0].detail).toMatch(/80% of the 2,500 goal/);
    expect(assembleDay('2026-10-07', { observations: [steps], sessions: [], checkIns: [] }, DEFAULT_PREFS).totals[0].detail).not.toMatch(/goal/);
    // The Steps list names no goal: on that screen the goal is its own control, and the chart draws it.
    expect(metricRows('steps', [steps], week, DEFAULT_PREFS, now)[0].detail).not.toMatch(/goal|%/);
  });
});
