import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import {
  LOADING_GAP_DAYS, PAIN_DAYS_NEEDED, assembleBackLeg, backLegTable, dayOffset, loadingOf, loadingRuns, painRuns, type LoadPoint,
} from './backLegSeries';
import { checkIn, obs, session, set } from './fixtures';

const range = { from: '2026-09-09', to: '2026-10-08' };

describe('loadingOf', () => {
  it('takes the highest ladder rung among completed sets, per track', () => {
    expect(loadingOf({ sets: [set('glute-bridge'), set('trap-bar-deadlift'), set('goblet-squat')] })).toEqual({ hinge: 2, squat: 2 });
  });

  it('ignores sets that were not completed and exercises off the ladder', () => {
    expect(loadingOf({ sets: [set('deadlift', 'skipped'), set('glute-bridge')] })).toEqual({ hinge: 0, squat: null });
    expect(loadingOf({ sets: [set('dumbbell-bench-press')] })).toEqual({ hinge: null, squat: null });
  });

  it('counts a completed rowing block as hinge level 3', () => {
    expect(loadingOf({ sets: [], cardio: { modality: 'rowing-machine', minutes: 12, format: 'steady' } })).toEqual({ hinge: 3, squat: null });
  });
});

describe('assembleBackLeg', () => {
  it('collects back and leg readings from every source, in time order, with their sources', () => {
    const data = assembleBackLeg(range, [
      obs({ id: 'b2', kind: 'backPain', unit: '0-10', value: 3, at: '2026-10-02T19:00:00.000+05:30' }),
      obs({ id: 'b1', kind: 'backPain', unit: '0-10', value: 5, context: 'checkIn:2026-10-02', at: '2026-10-02T12:00:00.000+05:30' }),
      obs({ id: 'l1', kind: 'legPain', unit: '0-10', value: 4, at: '2026-10-03T07:00:00.000+05:30' }),
      obs({ id: 'out', kind: 'backPain', unit: '0-10', value: 9, at: '2026-08-01T07:00:00.000+05:30' }),
    ], [], []);
    expect(data.back.map(p => [p.id, p.timed, p.dayFraction])).toEqual([['b1', false, 0.5], ['b2', true, 19 / 24]]);
    expect(data.back[0].source).toBe('From your check-in');
    expect(data.leg.map(p => p.id)).toEqual(['l1']);
    expect(data.painDays).toBe(2);
  });

  it(`needs readings on ${PAIN_DAYS_NEEDED} days before it charts`, () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    const readings = days.map((d, i) => obs({ id: `p${i}`, kind: 'backPain', unit: '0-10', value: 3, at: `${d}T07:00:00.000+05:30` }));
    expect(assembleBackLeg(range, readings.slice(0, 3), [], []).enough).toBe(false);
    expect(assembleBackLeg(range, readings, [], []).enough).toBe(true);
    // Two readings on one day are one day.
    const sameDay = [...readings.slice(0, 3), obs({ id: 'x', kind: 'legPain', unit: '0-10', value: 2, at: '2026-10-03T19:00:00.000+05:30' })];
    expect(assembleBackLeg(range, sameDay, [], []).enough).toBe(false);
  });

  it('takes how far symptoms reached from check-ins, a stored record winning over a session’s copy', () => {
    const data = assembleBackLeg(range, [], [
      session({ id: 's', date: '2026-10-01', checkIn: checkIn('2026-10-01', { back: { pain: 3, reach: 'foot', newNeuro: false, caudaEquinaFlag: false } }) }),
      session({ id: 's2', date: '2026-09-20', checkIn: checkIn('2026-09-20', { back: { pain: 3, reach: 'buttock', newNeuro: false, caudaEquinaFlag: false } }) }),
    ], [
      checkIn('2026-10-01', { back: { pain: 3, legPain: 2, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } }),
      checkIn('2026-10-02', { back: { pain: 1, newNeuro: false, caudaEquinaFlag: false } }),
    ]);
    expect(data.reach).toEqual([{ day: '2026-09-20', reach: 'buttock' }, { day: '2026-10-01', reach: 'thigh' }]);
  });

  it('marks each session with the level it used and any "worse" checkpoint', () => {
    const data = assembleBackLeg(range, [], [
      session({ id: 'a', date: '2026-10-01', guided: true, focus: 'lowerC', sets: [set('trap-bar-deadlift')], symptomChecks: { 'trap-bar-deadlift': 'worse' } }),
      session({ id: 'b', date: '2026-10-03', guided: true, focus: 'upperA', sets: [set('dumbbell-bench-press')], symptomChecks: { 'dumbbell-bench-press': 'same' } }),
    ], [], createDefaultProfile({ ladder: { hinge: 1, squat: 2, changedOn: '2026-10-01' } }));
    expect(data.sessions.map(s => [s.sessionId, s.level, s.worse, s.worseOn])).toEqual([['a', 2, true, ['hinge']], ['b', null, false, []]]);
    expect(data.ladderNow).toEqual({ hinge: 1, squat: 2, changedOn: '2026-10-01' });
  });
});

describe('runs: lines break at gaps', () => {
  it('joins readings on consecutive days and breaks across a day with none', () => {
    const days = ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05'].map(day => ({ day }));
    expect(painRuns(days).map(r => r.length)).toEqual([3, 2]);
    expect(painRuns([])).toEqual([]);
  });

  it(`holds each track's level between sessions, but not across more than ${LOADING_GAP_DAYS} days`, () => {
    const p = (day: string, hinge: LoadPoint['hinge'], squat: LoadPoint['squat'] = null): LoadPoint => ({
      sessionId: day, day, dayFraction: 0.3, title: '', level: hinge ?? squat, hinge, squat, worse: false, worseOn: [],
    });
    const points = [p('2026-09-01', 1), p('2026-09-03', null, 2), p('2026-09-10', 2), p('2026-09-24', 2), p('2026-10-09', 3)];
    expect(loadingRuns(points, 'hinge').map(r => r.map(x => x.day))).toEqual([['2026-09-01', '2026-09-10', '2026-09-24'], ['2026-10-09']]);
    expect(loadingRuns(points, 'squat').map(r => r.map(x => x.day))).toEqual([['2026-09-03']]);
  });

  it('places points on the time axis by day and time of day', () => {
    expect(dayOffset(range, { day: '2026-09-09', dayFraction: 0.5 })).toBe(0.5);
    expect(dayOffset(range, { day: '2026-10-08', dayFraction: 0 })).toBe(29);
  });
});

describe('backLegTable', () => {
  it('gives one row per day with anything on it, in date order, and leaves empty days out', () => {
    const data = assembleBackLeg(range, [
      obs({ id: 'b1', kind: 'backPain', unit: '0-10', value: 5, at: '2026-10-02T07:00:00.000+05:30' }),
      obs({ id: 'b2', kind: 'backPain', unit: '0-10', value: 3, at: '2026-10-02T19:00:00.000+05:30' }),
      obs({ id: 'l1', kind: 'legPain', unit: '0-10', value: 2, at: '2026-10-04T07:00:00.000+05:30' }),
    ], [
      session({ id: 's', date: '2026-10-04', sets: [set('trap-bar-deadlift'), set('goblet-squat')], symptomChecks: { 'trap-bar-deadlift': 'worse' } }),
      session({ id: 'u', date: '2026-10-06', sets: [set('dumbbell-bench-press')] }),
    ], [checkIn('2026-10-04', { back: { pain: 2, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } })]);
    expect(backLegTable(data)).toEqual([
      { day: '2026-10-02', back: [5, 3], leg: [], sessions: [], worse: false },
      { day: '2026-10-04', back: [], leg: [2], reach: 'thigh', sessions: ['Hinge 2, squat 2'], worse: true },
      { day: '2026-10-06', back: [], leg: [], sessions: ['No spinal loading'], worse: false },
    ]);
  });
});

describe('worse checkpoints by track', () => {
  it('puts each "worse" on the track of the exercise it followed, or "other" off the ladder', () => {
    const data = assembleBackLeg(range, [], [
      session({ id: 's', date: '2026-10-04', sets: [set('goblet-squat')], symptomChecks: { 'goblet-squat': 'worse', 'cat-cow': 'worse', 'glute-bridge': 'same' } }),
    ], []);
    expect(data.sessions[0].worseOn.sort()).toEqual(['other', 'squat']);
  });
});

describe('backLegTable wording', () => {
  it('capitalises whichever track comes first', () => {
    const data = assembleBackLeg(range, [], [session({ id: 's', date: '2026-10-04', sets: [set('goblet-squat')] })], []);
    expect(backLegTable(data)[0].sessions).toEqual(['Squat 2']);
  });
});
