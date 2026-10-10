import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { ringId } from '@/screens/home/week';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { weeklyGoalOn, withWeeklyGoal } from '@/screens/track/weeklyGoal';
import type { DayContext } from './stats';
import {
  WEEK_BRIEF_KEY, briefPause, briefSeen, pendingGoalText, ringLabel, weekBriefFor, weekFacts, weekRings, weekSentences, withSeen,
} from './yourWeek';

// A meter's display and the brief's 04:00 are read on this device's clock, so the zone is pinned.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const zone = env.TZ;
beforeAll(() => { env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete env.TZ; else env.TZ = zone; });

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const prefs = { ...DEFAULT_PREFS, hour12: true };
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-28', statusOn: () => 'normal', restOn: () => false, ...over });
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const moved = (id: string, day: string, minutes: number) => newObservation({
  kind: 'movementMinutes', value: minutes, at: `${day}T18:00:00.000+05:30`, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}`,
});
let n = 0;
const session = (date: string, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: `y${++n}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
  startedAt: `${date}T07:00:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true, planKind: 'stretch', durationSeconds: 600, ...over,
});
const steps = (day: string, value: number) => newObservation({ kind: 'steps', value, at: `${day}T20:00:00.000+05:30`, scope: 'dayTotal', source: 'manual' });
const g = (value: number, at: string) => newObservation({ kind: 'glucose', value, unit: 'mg/dL', at, scope: 'pointInTime', source: 'manual' });
const bp = (sys: number, dia: number, day: string) => {
  const shared = { at: `${day}T07:30:00+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(`bp-${day}`) };
  return [newObservation({ ...shared, kind: 'bloodPressureSystolic', value: sys }), newObservation({ ...shared, kind: 'bloodPressureDiastolic', value: dia })];
};

const OBS = [
  moved('b', '2026-09-28', 20), moved('c', '2026-10-01', 32), moved('d', '2026-10-02', 40), moved('a', '2026-10-05', 30),
  g(118, '2026-10-05T07:30:00+05:30'), g(62, '2026-10-06T13:00:00+05:30'), g(112, '2026-10-07T07:30:00+05:30'), g(168, '2026-10-07T14:10:00+05:30'), g(124, '2026-10-08T07:30:00+05:30'),
  ...bp(132, 84, '2026-10-05'), ...bp(128, 82, '2026-10-06'), ...bp(182, 96, '2026-10-07'), ...bp(126, 80, '2026-10-08'),
  steps('2026-10-05', 6000), steps('2026-10-06', 7000), steps('2026-10-07', 5500),
];
// A stretch on Tuesday (10 min) and a full session on Wednesday (24 min) whose mobility block was done.
const SESSIONS = [session('2026-10-06'), session('2026-10-07', { planKind: 'full', durationSeconds: 1440, mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] })];
const LO = { date: '2026-10-07', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-07T21:00:00+05:30' } } as unknown as CheckInRecord;

describe('Your week’s facts and sentences (journey §12.1, B-15)', () => {
  const facts = weekFacts({ week: '2026-10-05', data: data(OBS, SESSIONS, [LO]), prefs, ctx: ctx() });

  it('counts recorded movement to today, against the same days of last week', () => {
    expect(facts).toMatchObject({ week: '2026-10-05', title: 'This week', name: 'this week', minutes: 64, before: 52, beforeName: 'by this time last week', stretchDays: 2 });
  });

  it('says up to 4 facts, movement first, then the readings with their context; no praise, no blame', () => {
    expect(weekSentences(facts, prefs)).toEqual([
      'You moved 64 minutes this week, 12 more than by this time last week.',
      'You stretched on 2 days this week.',
      '2 glucose readings were below 70 mg/dL this week.',
      '1 blood pressure reading was 180/120 mmHg or higher this week.',
    ]);
    expect(weekSentences(facts, prefs).join(' ')).not.toMatch(/great|well done|good job|keep it up|only|better|worse|should|missed/i);
  });

  it('the same, or fewer, said as plainly as more; stretches and readings of other weeks left out', () => {
    const same = weekFacts({ week: '2026-10-05', data: data([moved('p', '2026-09-29', 30), moved('q', '2026-10-06', 30)]), prefs, ctx: ctx() });
    expect(weekSentences(same, prefs)[0]).toBe('You moved 30 minutes this week, the same as by this time last week.');
    const fewer = weekFacts({ week: '2026-10-05', data: data([moved('p', '2026-09-29', 45), moved('q', '2026-10-06', 30)]), prefs, ctx: ctx() });
    expect(weekSentences(fewer, prefs)[0]).toBe('You moved 30 minutes this week, 15 fewer than by this time last week.');
    const lastWeekStretch = weekFacts({ week: '2026-10-05', data: data(OBS, [...SESSIONS, session('2026-09-30')], [LO]), prefs, ctx: ctx() });
    expect(lastWeekStretch.stretchDays).toBe(2);
  });

  it('a meter’s LO alone is a glucose reading below 70', () => {
    const onlyLo = weekFacts({ week: '2026-10-05', data: data([], [], [LO]), prefs, ctx: ctx() });
    expect(weekSentences(onlyLo, prefs)).toEqual(['1 glucose reading was below 70 mg/dL this week.']);
  });

  it('never counts how often anyone tests: readings are said only past a line (KT-05, A-15, K-51)', () => {
    const usual = weekFacts({ week: '2026-10-05', data: data([g(118, '2026-10-05T07:30:00+05:30'), g(124, '2026-10-06T07:30:00+05:30'), ...bp(128, 82, '2026-10-06')]), prefs, ctx: ctx() });
    expect(weekSentences(usual, prefs)).toEqual([]);
    const both = weekFacts({ week: '2026-10-05', data: data([g(62, '2026-10-05T07:30:00+05:30'), g(280, '2026-10-06T13:00:00+05:30'), g(300, '2026-10-07T13:00:00+05:30')]), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    expect(weekSentences(both, { ...prefs, glucose: 'mmol/L' })).toEqual(['1 glucose reading was below 3.9 mmol/L and 2 were above 13.9 mmol/L this week.']);
    const high = weekFacts({ week: '2026-10-05', data: data([g(280, '2026-10-06T13:00:00+05:30')]), prefs, ctx: ctx() });
    expect(weekSentences(high, prefs)).toEqual(['1 glucose reading was above 250 mg/dL this week.']);
  });

  it('steps, when there is room for them', () => {
    const few = weekFacts({ week: '2026-10-05', data: data([moved('a', '2026-10-05', 30), steps('2026-10-05', 6000), steps('2026-10-06', 7000), steps('2026-10-07', 5500)]), prefs, ctx: ctx({ since: '2026-10-05' }) });
    expect(weekSentences(few, prefs)).toEqual(['You moved 30 minutes this week.', '6,167 steps a day on average this week, from 3 days with steps.']);
  });

  it('a record that starts this Thursday says no “fewer than last week” (Review Focus 4)', () => {
    const first = weekFacts({ week: '2026-10-05', data: data([moved('a', TODAY, 30)]), prefs, ctx: ctx({ since: TODAY }) });
    expect(first.before).toBeUndefined();
    expect(weekSentences(first, prefs)).toEqual(['You moved 30 minutes this week.']);
  });

  it('compares only with 3 days of data in both weeks, as a category’s trend does (H3-12, KT-02, B-15)', () => {
    // Monday 12 October: one day this week against one day by this time last week.
    const record = data([moved('a', '2026-10-05', 20), moved('b', '2026-10-06', 25), moved('c', '2026-10-12', 30), moved('d', '2026-10-13', 10)]);
    const monday = weekFacts({ week: '2026-10-12', data: record, prefs, ctx: ctx({ today: '2026-10-12' }) });
    expect(monday.before).toBeUndefined();
    expect(weekSentences(monday, prefs)[0]).toBe('You moved 30 minutes this week.');
    // By Wednesday each has three days: Monday to Wednesday against last Monday to Wednesday.
    const wednesday = weekFacts({ week: '2026-10-12', data: record, prefs, ctx: ctx({ today: '2026-10-14' }) });
    expect(weekSentences(wednesday, prefs)[0]).toBe('You moved 40 minutes this week, 5 fewer than by this time last week.');
    // An Away day isn't a day of data: a week with five of them has two, and isn't compared.
    const away = weekFacts({ week: '2026-10-05', data: record, prefs, ctx: ctx({ today: '2026-10-12', statusOn: d => (d >= '2026-10-06' && d <= '2026-10-10' ? 'away' : 'normal') }) });
    expect(away.before).toBeUndefined();
    // So is a week whose week before had five: both need 3.
    const awayBefore = weekFacts({ week: '2026-10-05', data: record, prefs, ctx: ctx({ today: '2026-10-12', statusOn: d => (d >= '2026-09-29' && d <= '2026-10-03' ? 'away' : 'normal') }) });
    expect(awayBefore.before).toBeUndefined();
    expect(weekFacts({ week: '2026-10-05', data: record, prefs, ctx: ctx({ today: '2026-10-12' }) }).before).toBe(0);
  });

  it('a finished week is named and compared as one', () => {
    const last = weekFacts({ week: '2026-09-28', data: data(OBS), prefs, ctx: ctx() });
    expect(last).toMatchObject({ title: 'Last week', name: 'last week', minutes: 92, beforeName: 'the week before' });
    // The week before began before the first record, so there is nothing to compare.
    expect(weekSentences(last, prefs)[0]).toBe('You moved 92 minutes last week.');
    expect(weekFacts({ week: '2026-09-21', data: data(OBS), prefs, ctx: ctx({ since: '2026-09-21' }) }).title).toBe('Week of 21 Sep');
  });
});

describe('when Your week is paused (§12.6)', () => {
  it('beside a safety decision, or on a day that isn’t Normal', () => {
    expect(briefPause({ status: 'normal', urgent: false, held: false })).toBeUndefined();
    expect(briefPause({ status: 'normal', urgent: true, held: false })).toBe('safety');
    for (const status of ['flare', 'unwell', 'away'] as const) expect(briefPause({ status, urgent: false, held: false })).toBe('status');
  });

  it('on a day with a hold that raises no urgent surface, as Home’s brief goes quiet (H3-03, KT-04)', () => {
    expect(briefPause({ status: 'normal', urgent: false, held: true })).toBe('hold');
    // The safety surface's words, then the status's, come first.
    expect(briefPause({ status: 'normal', urgent: true, held: true })).toBe('safety');
    expect(briefPause({ status: 'unwell', urgent: false, held: true })).toBe('status');
  });
});

describe('the last 8 weeks’ rings (§12.1, B-16)', () => {
  const settings = { weeklyMovementGoalMinutes: 150, weeklyMovementGoalHistory: [{ from: '2026-09-21', goal: 120 }, { from: '2026-10-05', goal: 150 }] };
  const rings = weekRings(TODAY, data(OBS, SESSIONS), settings);

  it('runs oldest first to this week, each against the goal its week had', () => {
    expect(rings.map(r => r.week)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(rings.map(r => r.goal)).toEqual([undefined, undefined, undefined, undefined, undefined, 120, 120, 150]);
    expect(rings.at(-1)).toMatchObject({ minutes: 64, current: true });
  });

  it('names each with its minutes, as its visible date reads', () => {
    expect(ringLabel(rings[7])).toBe('This week: 64 of 150 min');
    expect(ringLabel(rings[6])).toBe('Week of 28 Sep: 92 of 120 min');
    expect(ringLabel(rings[0])).toBe('Week of 17 Aug: 0 min moved');
  });

  it('says a change waiting for Monday', () => {
    const later = { weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12', goal: 200 }] };
    expect(pendingGoalText(later, TODAY)).toBe('From Monday 12 October, your weekly goal is 200 min.');
    expect(pendingGoalText({ weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12' }] }, TODAY)).toBe('From Monday 12 October, no weekly goal.');
    expect(pendingGoalText(settings, TODAY)).toBeUndefined();
  });

  it('this week’s ring has its own week’s goal, never the goal just chosen, as Home’s This week keys it (kiro KV-25, B-16, B-32)', () => {
    // Today the person chooses 200: it applies from next Monday, and this week keeps 150 (D48).
    const chosen = withWeeklyGoal({ weeklyMovementGoalMinutes: 150, weeklyMovementGoalHistory: [{ from: '2026-09-21', goal: 150 }] }, 200, TODAY);
    expect(chosen.weeklyMovementGoalMinutes).toBe(200);
    const ring = weekRings(TODAY, data(OBS, SESSIONS), chosen).at(-1)!;
    expect(ring).toMatchObject({ week: '2026-10-05', goal: 150, current: true });
    expect(ringLabel(ring)).toBe('This week: 64 of 150 min');
    // Home draws This week against weeklyGoalOn(settings, today) and keys its ring by it (src/screens/home/week.ts).
    expect(ringId(TODAY, weeklyGoalOn(chosen, TODAY)!)).toBe(`${ring.week}|moveMinutes|${ring.goal}`);
    // Next week's ring is drawn against the new goal, once it is in force.
    expect(weekRings('2026-10-12', data(OBS, SESSIONS), chosen).at(-1)).toMatchObject({ week: '2026-10-12', goal: 200 });
  });
});

describe('Your week in brief (B-20, L-18)', () => {
  const at = (iso: string) => new Date(iso);

  it('offers last week from Monday 04:00 until it’s opened or the week is over', () => {
    expect(weekBriefFor({ now: at('2026-10-12T03:59:00+05:30'), seen: [], hasFacts: true })).toBeUndefined();
    expect(weekBriefFor({ now: at('2026-10-12T04:00:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-05' });
    expect(weekBriefFor({ now: at('2026-10-18T23:59:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-05' });
    expect(weekBriefFor({ now: at('2026-10-19T05:00:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-12' });
  });

  it('once opened, stays opened; a week with nothing to say offers nothing', () => {
    expect(weekBriefFor({ now: at('2026-10-13T09:00:00+05:30'), seen: ['2026-10-05'], hasFacts: true })).toBeUndefined();
    expect(weekBriefFor({ now: at('2026-10-13T09:00:00+05:30'), seen: [], hasFacts: false })).toBeUndefined();
  });

  it('keeps what was opened in content state, read defensively and kept short', () => {
    expect(WEEK_BRIEF_KEY).toBe('trends:weekBrief');
    expect(briefSeen(['2026-10-05', 3, null])).toEqual(['2026-10-05']);
    expect(briefSeen('2026-10-05')).toEqual([]);
    expect(withSeen(['2026-09-28', '2026-10-05'], '2026-09-28')).toEqual(['2026-10-05', '2026-09-28']);
    const many = Array.from({ length: 8 }, (_, i) => `2026-08-${String(3 + i * 7).padStart(2, '0')}`);
    expect(withSeen(many, '2026-10-05')).toHaveLength(8);
  });
});
