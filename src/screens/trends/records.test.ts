import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { newObservation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import {
  activities, dayTotals, firstRecordDay, meterReadings, sessionMinutes, sessionsOf, stepsDays, stretchedDays, walkFigures,
} from './records';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned, as review.test.ts does.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const zone = env.TZ;
beforeAll(() => { env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete env.TZ; else env.TZ = zone; });

// Thursday 8 October 2026; this week is Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const RANGE = { from: '2026-10-05', to: '2026-10-11' };
let n = 0;
function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${++n}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: `${date}T07:30:00+05:30`, completedAt: `${date}T08:15:00+05:30`, notes: '', totalVolume: 0, guided: true,
    planKind: 'full', durationSeconds: 2700, ...over,
  };
}
const total = (kind: 'water' | 'steps', value: number, at: string) => newObservation({ kind, value, at, scope: 'dayTotal', source: 'manual' });
const walk = (id: string, at: string, minutes: number, steps?: number) => [
  newObservation({ kind: 'walkDuration', value: minutes, at, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}` }),
  ...(steps === undefined ? [] : [newObservation({ kind: 'steps', value: steps, at, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}` })]),
];

describe('the record’s first day (J§12.2, early days)', () => {
  it('is the earliest day of any record, or nothing', () => {
    const data = { observations: [total('water', 500, '2026-10-02T09:00:00+05:30')], sessions: [session('2026-09-30')], checkIns: [{ date: '2026-10-01' } as CheckInRecord] };
    expect(firstRecordDay(data)).toBe('2026-09-30');
    expect(firstRecordDay({ ...data, observations: [total('water', 500, '2026-09-20T09:00:00+05:30')] })).toBe('2026-09-20');
    expect(firstRecordDay({ ...data, checkIns: [{ date: '2026-09-21' } as CheckInRecord] })).toBe('2026-09-21');
    expect(firstRecordDay({ observations: [], sessions: [], checkIns: [] })).toBeUndefined();
  });
});

describe('sessions by kind, and their minutes (J§12.3)', () => {
  it('tells programme sessions from stretches, and leaves out skipped runs and a rest day’s optional mobility', () => {
    const full = session('2026-10-05');
    const stretch = session('2026-10-06', { planKind: 'stretch' });
    const skipped = session('2026-10-07', { status: 'skipped' });
    const rest = session('2026-10-08', { planKind: 'restDay' });
    const logged = session('2026-10-08', { guided: false, planKind: undefined, durationSeconds: 1800 });
    const all = [full, stretch, skipped, rest, logged];
    expect(sessionsOf('programme', all).map(s => s.id)).toEqual([full.id, logged.id]);
    expect(sessionsOf('stretch', all).map(s => s.id)).toEqual([stretch.id]);
  });

  it('adds each day’s active minutes as the sessions recorded them; a safety-stopped run keeps its partial minutes', () => {
    const a = session('2026-10-05', { durationSeconds: 1800 });
    const b = session('2026-10-05', { status: 'partial', durationSeconds: 900 });
    const later = session('2026-10-12', { durationSeconds: 600 });
    const untimed = session('2026-10-06', { durationSeconds: undefined });
    expect(sessionMinutes([a, b, later, untimed], RANGE)).toEqual([{ day: '2026-10-05', value: 45 }]);
  });

  it('a day stretched is a stretch routine, or any session whose mobility block was done (§12.3)', () => {
    const sessions = [
      session('2026-10-05', { planKind: 'stretch' }),
      session('2026-10-06', { mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] }),
      session('2026-10-07', { mobility: [{ exerciseId: 'cat-cow', seconds: 0 }] }),
      session('2026-10-08', { status: 'skipped', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] }),
      session('2026-10-09', { planKind: 'restDay', status: 'partial', mobility: [{ exerciseId: 'cat-cow', seconds: 30 }] }),
    ];
    expect([...stretchedDays(sessions)].sort()).toEqual(['2026-10-05', '2026-10-06', '2026-10-09']);
  });
});

describe('walking and day totals, through v1’s aggregation (D10, F17)', () => {
  it('counts walking minutes once where two records overlap, each on its own day', () => {
    const figures = walkFigures('walkDuration', RANGE, [...walk('a', '2026-10-05T18:00:00+05:30', 20), ...walk('b', '2026-10-05T18:10:00+05:30', 15), ...walk('c', '2026-10-06T07:00:00+05:30', 30)]);
    expect(figures).toEqual([{ day: '2026-10-05', value: 20 }, { day: '2026-10-06', value: 30 }]);
  });

  it('a walking day total typed by hand is no walk: the trend counts what the ring counts (F19)', () => {
    const typed = newObservation({ kind: 'walkDuration', value: 45, at: '2026-10-05T21:00:00+05:30', scope: 'dayTotal', source: 'manual' });
    expect(walkFigures('walkDuration', RANGE, [...walk('a', '2026-10-05T18:00:00+05:30', 20), typed])).toEqual([{ day: '2026-10-05', value: 20 }]);
  });

  it('a day total entered twice counts once: the later statement (Review Focus 2)', () => {
    const first = total('water', 1000, '2026-10-05T12:00:00+05:30');
    const later = total('water', 1750, '2026-10-05T20:00:00+05:30');
    expect(dayTotals('water', RANGE, [first, later])).toEqual([{ day: '2026-10-05', value: 1750 }]);
  });
});

describe('the day’s steps, as Plan 2 says them (J§9.6)', () => {
  const day = TODAY;
  it('a figure only for the days with steps, each with where it came from', () => {
    const obs = [total('steps', 6050, `${day}T18:00:00.000+05:30`), ...walk('a', '2026-10-06T07:40:00.000+05:30', 20, 4210)];
    expect(stepsDays(RANGE, obs, true)).toEqual([
      { day: '2026-10-06', value: 4210, basis: 'walks', note: 'in FitStrong walks · day total not entered' },
      { day, value: 6050, basis: 'entered', note: 'entered at 6:00 pm' },
    ]);
  });

  it('at least the total plus the walks after it, with both sources (V-J26)', () => {
    const obs = [total('steps', 6050, `${day}T12:05:00.000+05:30`), ...walk('a', `${day}T15:00:00.000+05:30`, 20, 1250)];
    expect(stepsDays(RANGE, obs, true)).toEqual([
      { day, value: 7300, basis: 'atLeast', note: '6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm' },
    ]);
  });

  it('a later total replaces the earlier one, and is added to nothing (Review Focus 2)', () => {
    const obs = [total('steps', 6050, `${day}T12:05:00.000+05:30`), ...walk('a', `${day}T15:00:00.000+05:30`, 20, 1250), total('steps', 9800, `${day}T21:00:00.000+05:30`)];
    expect(stepsDays(RANGE, obs, true)).toEqual([{ day, value: 9800, basis: 'entered', note: 'entered at 9:00 pm' }]);
  });

  it('a walk the evening before the range is no figure inside it', () => {
    expect(stepsDays(RANGE, walk('a', '2026-10-04T21:00:00.000+05:30', 20, 3000), true)).toEqual([]);
  });

  it('each day is the figure Home and the Steps hub give it, read from the whole record, across midnight too', () => {
    const late = 'walk:late';
    const obs = [
      total('steps', 6050, '2026-10-05T12:05:00.000+05:30'), ...walk('a', '2026-10-05T15:00:00.000+05:30', 20, 1250),
      ...walk('b', '2026-10-07T07:40:00.000+05:30', 20, 4210),
      total('steps', 8000, '2026-10-11T18:00:00.000+05:30'),
      // A walk from 11:50 pm on the range's last day: its second segment, after midnight, is the next day's record.
      newObservation({ kind: 'walkDuration', value: 10, at: '2026-10-11T23:50:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: late }),
      newObservation({ kind: 'steps', value: 900, at: '2026-10-11T23:50:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: late }),
      newObservation({ kind: 'walkDuration', value: 15, at: '2026-10-12T00:05:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 900_000, context: late }),
      newObservation({ kind: 'steps', value: 1400, at: '2026-10-12T00:05:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 900_000, context: late }),
      // A walk from 11:50 pm into Friday, and a copy of its last minutes on Friday: the overlap is counted once, on the day before.
      newObservation({ kind: 'steps', value: 900, at: '2026-10-08T23:50:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 1_200_000, context: 'walk:x' }),
      newObservation({ kind: 'steps', value: 500, at: '2026-10-09T00:00:00.000+05:30', scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: 'walk:y' }),
    ];
    const days = stepsDays(RANGE, obs, true);
    expect(days.map(d => d.day)).toEqual(['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-11']);
    expect(stepsDayFigure('2026-10-09', obs, true).kind).toBe('none');
    for (const d of days) {
      const home = stepsDayFigure(d.day, obs, true);
      expect([d.value, d.basis, d.note], d.day).toEqual([home.steps, home.kind, home.source]);
    }
  });
});

describe('a meter’s HI and LO, from the check-ins (K-11)', () => {
  it('once each, on the day measured; the numbers are the observations’, not here', () => {
    const c = {
      date: '2026-10-07',
      glucose: { value: 140, unit: 'mg/dL', measuredAt: '2026-10-07T09:20:00+05:30' },
      glucoseDisplay: { display: 'HI', measuredAt: '2026-10-07T09:10:00+05:30' },
      glucoseEarlier: [{ display: 'LO', measuredAt: '2026-10-07T03:30:00.000Z' }, { value: 60, unit: 'mg/dL' }, { display: 'HI', measuredAt: '2026-10-07T09:10:00+05:30' }],
    } as unknown as CheckInRecord;
    const untimed = { date: '2026-10-06', glucoseDisplay: { display: 'LO' } } as unknown as CheckInRecord;
    expect(meterReadings([c, untimed]).map(m => [m.day, m.display])).toEqual([['2026-10-07', 'LO'], ['2026-10-07', 'HI'], ['2026-10-06', 'LO']]);
    // Measured late last night, kept on this morning's check-in: it belongs to the night it was measured.
    const night = { date: '2026-10-08', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-07T23:40:00+05:30' } } as unknown as CheckInRecord;
    expect(meterReadings([night])).toEqual([{ day: '2026-10-07', at: '2026-10-07T23:40:00.000+05:30', display: 'LO' }]);
  });
});

describe('recent workouts, stretches and walks (J§12.1)', () => {
  it('merges the three, newest first, each with its own day and a heading for a mixed list', () => {
    const data = {
      observations: walk('w-1', '2026-10-07T18:00:00+05:30', 25),
      sessions: [session('2026-10-05'), session('2026-10-06', { planKind: 'stretch', durationSeconds: 600, startedAt: '2026-10-06T07:00:00+05:30' })],
      checkIns: [],
    };
    const rows = activities(data, DEFAULT_PREFS, TODAY);
    expect(rows.map(r => [r.kind, r.day])).toEqual([['walk', '2026-10-07'], ['stretch', '2026-10-06'], ['workout', '2026-10-05']]);
    expect(rows[0].heading).toBe(`Walk · ${rows[0].label}`);
    expect(rows[0].ref).toEqual({ type: 'walk', id: 'w-1' });
  });
});
