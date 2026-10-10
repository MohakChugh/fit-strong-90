import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import { newObservation, type Observation } from '@/health/observation';
import {
  dotLabel, movedDays, readRingShown, restDaysOf, ringId, ringSweeps, stepsLine, stretchDays, stretchedLine, weekDots,
} from './week';

// Thursday 8 October 2026: the week runs Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';

let ids = 0;
function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${++ids}`, date, dayOfWeek: 'monday', muscleGroup: 'mobility', phase: 'foundation', week: 3, status: 'completed',
    sets: [], startedAt: `${date}T07:30:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true,
    planKind: 'stretch', durationSeconds: 600, ...over,
  };
}
const walk = (day: string, time = '18:00'): Observation => newObservation({
  kind: 'movementMinutes', value: 20, scope: 'sessionObserved', coverageMs: 20 * 60_000, source: 'measured',
  at: `${day}T${time}:00+05:30`, context: `walk:w${++ids}`,
});

describe('This week’s day dots (journey §7.3)', () => {
  it('runs Monday to Sunday, marking today and the days still to come', () => {
    const dots = weekDots({ today: TODAY, moved: new Set(), restDays: [] });
    expect(dots.map(d => d.letter).join('')).toBe('MTWTFSS');
    expect(dots.map(d => d.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(dots.filter(d => d.today).map(d => d.day)).toEqual([TODAY]);
    expect(dots.filter(d => d.future)).toHaveLength(3);
  });

  it('fills a day with movement, marks a planned rest day "R", hatches a status day, and leaves the rest empty', () => {
    const dots = weekDots({
      today: TODAY,
      moved: new Set(['2026-10-05', '2026-10-07']),
      restDays: restDaysOf(true, ['monday', 'thursday', 'saturday']),
      statusPeriods: [{ kind: 'unwell', from: '2026-10-07', to: '2026-10-08' }],
    });
    expect(dots.map(d => d.state)).toEqual(['moved', 'rest', 'moved', 'status', 'rest', 'none', 'rest']);
    expect(dots[3].status).toBe('unwell');
    expect(dots.map(dotLabel)).toEqual([
      'Monday: moved', 'Tuesday: rest day', 'Wednesday: moved', 'Thursday: Unwell', 'Friday: rest day', 'Saturday: still to come', 'Sunday: rest day',
    ]);
  });

  it('never marks a rest nobody planned: outside the programme there are no rest days (A-39)', () => {
    expect(restDaysOf(false, ['monday', 'thursday'])).toEqual([]);
    expect(restDaysOf(true, [])).toEqual([]);
    expect(weekDots({ today: TODAY, moved: new Set(), restDays: restDaysOf(false, ['monday']) }).some(d => d.state === 'rest')).toBe(false);
    expect(dotLabel(weekDots({ today: TODAY, moved: new Set(), restDays: [] })[0])).toBe('Monday: no movement recorded');
  });

  it('counts a day as moved from the same records the ring counts, and never a day still to come', () => {
    const moved = movedDays(TODAY, [walk('2026-10-06'), walk('2026-10-04'), walk('2026-10-09')], [session('2026-10-08', { planKind: 'full', muscleGroup: 'lower' })]);
    expect([...moved].sort()).toEqual(['2026-10-06', '2026-10-08']);
  });
});

describe('Stretched days', () => {
  it('counts distinct days this week with a stretch done, whole or in part', () => {
    const sessions = [
      session('2026-10-05'), session('2026-10-05'), session('2026-10-07', { status: 'partial' }),
      session('2026-10-04'), session('2026-10-06', { status: 'skipped' }), session('2026-10-06', { planKind: 'full', muscleGroup: 'lower' }),
    ];
    expect(stretchDays(TODAY, sessions)).toBe(2);
  });
  it('counts a session whose mobility block was done as a day stretched (journey §12.3)', () => {
    const withBlock = session('2026-10-06', { planKind: 'full', muscleGroup: 'lower', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] });
    expect(stretchDays(TODAY, [withBlock])).toBe(1);
  });
  it('says it plainly', () => {
    expect(stretchedLine(0)).toBe('No stretches yet this week');
    expect(stretchedLine(1)).toBe('Stretched 1 day');
    expect(stretchedLine(3)).toBe('Stretched 3 days');
  });
});

describe('Steps today (D14, A-47)', () => {
  const steps = (value: number, scope: 'dayTotal' | 'sessionObserved', at: string, context?: string) => newObservation({
    kind: 'steps', value, scope, source: scope === 'dayTotal' ? 'manual' : 'measured', at, ...(context ? { context } : {}),
    ...(scope === 'sessionObserved' ? { coverageMs: 20 * 60_000 } : {}),
  });
  it('a total the person entered, with when it was entered', () => {
    expect(stepsLine(TODAY, [steps(6050, 'dayTotal', `${TODAY}T18:00:00+05:30`)], true)).toBe('Steps today: 6,050 entered at 6:00 pm');
  });
  it('else the steps counted on FitStrong walks', () => {
    expect(stepsLine(TODAY, [steps(4210, 'sessionObserved', `${TODAY}T08:00:00+05:30`, 'walk:a')], true)).toBe('Steps today: 4,210 in FitStrong walks');
  });
  it('else "not entered", never a zero or yesterday’s number', () => {
    expect(stepsLine(TODAY, [], true)).toBe('Steps: not entered');
    expect(stepsLine(TODAY, [steps(9000, 'dayTotal', '2026-10-07T20:00:00+05:30')], true)).toBe('Steps: not entered');
  });
  it('a FitStrong walk after an entered total reads "at least", with both sources (journey §9.6)', () => {
    const at = (time: string) => `2026-10-08T${time}.000+05:30`;
    const obs = [
      newObservation({ id: 'e', kind: 'steps', value: 6050, unit: 'steps', scope: 'dayTotal', source: 'manual', at: at('12:00:05') }),
      newObservation({ id: 'wd', kind: 'walkDuration', value: 20, unit: 'min', scope: 'sessionObserved', source: 'measured', at: at('17:00:00'), context: 'walk:w', coverageMs: 1_200_000 }),
      newObservation({ id: 'ws', kind: 'steps', value: 1250, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: at('17:00:00'), context: 'walk:w', coverageMs: 1_200_000 }),
    ];
    expect(stepsLine('2026-10-08', obs, true)).toBe('Steps today: at least 7,300 (6,050 entered at 12:00 pm + 1,250 in walks after 12:00 pm)');
  });
});

describe('the week ring’s remembered value (B-32, M1)', () => {
  const id = ringId(TODAY, 150);
  it('is one ring for a week, a metric and a goal', () => {
    expect(id).toBe('2026-10-05|moveMinutes|150');
    expect(ringId('2026-10-11', 150)).toBe(id);
    expect(ringId('2026-10-12', 150)).not.toBe(id);
    expect(ringId(TODAY, 120)).not.toBe(id);
  });
  it('sweeps only for a real increase within the same ring', () => {
    expect(ringSweeps({ id, value: 40 }, { id, value: 64 }, false)).toBe(true);
    expect(ringSweeps({ id, value: 64 }, { id, value: 64 }, false)).toBe(false);
    expect(ringSweeps({ id, value: 64 }, { id, value: 40 }, false)).toBe(false);
  });
  it('is drawn already set for a new week, a changed goal, or nothing remembered, so it never sweeps up from zero on arrival', () => {
    expect(ringSweeps({ id: ringId('2026-09-30', 150), value: 10 }, { id, value: 64 }, false)).toBe(false);
    expect(ringSweeps({ id: ringId(TODAY, 120), value: 10 }, { id, value: 64 }, false)).toBe(false);
    expect(ringSweeps(undefined, { id, value: 64 }, false)).toBe(false);
  });
  it('never sweeps beside an urgent Right now card (motion rule 2)', () => {
    expect(ringSweeps({ id, value: 40 }, { id, value: 64 }, true)).toBe(false);
  });
  it('reads back only what it wrote', () => {
    expect(readRingShown(JSON.stringify({ id, value: 40 }))).toEqual({ id, value: 40 });
    for (const raw of [null, '', 'nope', '{"id":3,"value":1}', '{"id":"x","value":"2"}', '{"id":"x","value":null}', '[]']) expect(readRingShown(raw), String(raw)).toBeUndefined();
  });
});
