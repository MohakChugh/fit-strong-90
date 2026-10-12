import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import type { AppData, WorkoutSession } from '@/types';
import { StoreFailure, type StoreResult } from '@/store/db';
import type { DailyCheckIn } from '@/types/checkin';
import {
  canSwapToday, guidedRow, guidedSummary, JOIN_CLOSED, joinController, joinFlow, joinSeed, mondayOf, planView, overrideFor, programmeWeek, programmeWeekDates, startDateProblem,
  STATUS_TEXT, swapChoices, swapToday, weekNote, weekView, withJoined, withLeft, type JoinAction, type JoinFlow, type WeekDay,
} from './plan';

// Default profile: Monday to Saturday training (Lower A, Upper A, Lower B,
// Upper B, Lower C, Upper C), Sunday rest. 2026-10-08 is a Thursday.
const profile = createDefaultProfile();
const TODAY = '2026-10-08';
const START = '2026-09-28';

const session = (date: string, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: `${date}-${over.planKind ?? 'x'}-${over.status ?? 'completed'}`, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 2,
  status: 'completed', sets: [], startedAt: `${date}T07:00:00.000Z`, completedAt: null, notes: '', totalVolume: 0, ...over,
});
const view = (sessions: WorkoutSession[], focusOverrides: Record<string, string> = {}, today = TODAY, p = profile) =>
  weekView({ sessions, focusOverrides: focusOverrides as never }, p, today);
const on = (days: WeekDay[], date: string) => days.find(d => d.date === date)!;

describe('weekView', () => {
  it('lays out this week Monday first, with what each day is and where it stands', () => {
    const days = view([]);
    expect(days.map(d => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(days.map(d => d.focus)).toEqual(['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC', 'rest']);
    expect(days.map(d => d.status)).toEqual(['notRecorded', 'notRecorded', 'notRecorded', 'today', 'comingUp', 'comingUp', 'rest']);
    expect(days.filter(d => d.isToday).map(d => d.date)).toEqual([TODAY]);
  });

  it('reads Done only for the day’s completed programme workout', () => {
    const days = view([session('2026-10-05', { guided: true, focus: 'lowerA', planKind: 'full' })]);
    expect(on(days, '2026-10-05').status).toBe('done');
  });

  it('never counts a stretch as the day’s workout, however it was recorded', () => {
    const days = view([
      session('2026-10-05', { guided: true, focus: 'activeRecovery', planKind: 'stretch', planId: 'stretch:2026-10-05:backHips:10:green:' }),
      // A record from before planKind existed still says so in its plan id.
      session('2026-10-06', { guided: true, focus: 'activeRecovery', planId: 'stretch:2026-10-06:backHips:10:green:' }),
    ]);
    expect(on(days, '2026-10-05')).toMatchObject({ status: 'notRecorded', focus: 'lowerA' });
    expect(on(days, '2026-10-06')).toMatchObject({ status: 'notRecorded', focus: 'upperA' });
  });

  it('shows a recovery session in a workout’s place as that, not as the workout done', () => {
    const days = view([
      session('2026-10-05', { guided: true, focus: 'lowerA', planKind: 'recovery' }),
      session('2026-10-06', { guided: true, focus: 'upperA', planId: '2026-10-06:upperA:recovery:recovery:' }),
    ]);
    expect(on(days, '2026-10-05').status).toBe('recovery');
    expect(on(days, '2026-10-06').status).toBe('recovery');
    expect(STATUS_TEXT.recovery).toBe('Recovery session instead');
  });

  it('counts the recovery session as the workout on an active-recovery day', () => {
    const everyDay = createDefaultProfile({ trainingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] });
    const days = view([session('2026-10-04', { guided: true, focus: 'activeRecovery', planKind: 'recovery' })], {}, '2026-10-04', everyDay);
    expect(on(days, '2026-10-04')).toMatchObject({ focus: 'activeRecovery', status: 'done' });
  });

  it('names a swapped day by what it became, and says what it replaced', () => {
    const days = view([session('2026-10-05', { guided: true, focus: 'upperB', planKind: 'full' })], { '2026-10-05': 'upperB' });
    expect(on(days, '2026-10-05')).toMatchObject({ focus: 'upperB', swappedFrom: 'lowerA', status: 'done' });
  });

  it('shows a swap still to do as the new workout', () => {
    const days = view([], { [TODAY]: 'lowerA' });
    expect(on(days, TODAY)).toMatchObject({ focus: 'lowerA', swappedFrom: 'upperB', status: 'today' });
  });

  it('ignores a stored swap the week no longer offers', () => {
    expect(on(view([], { [TODAY]: 'push' }), TODAY)).toMatchObject({ focus: 'upperB', status: 'today' });
    expect(on(view([], { [TODAY]: 'push' }), TODAY).swappedFrom).toBeUndefined();
  });

  it('keeps partly done, started and skipped apart from done', () => {
    const done = { status: 'completed' as const, exerciseId: 'x', id: 's', setNumber: 1, plannedReps: 8, actualReps: 8, weight: 20, rpe: null };
    const days = view([
      session('2026-10-05', { status: 'partial', focus: 'lowerA' }),
      session('2026-10-06', { status: 'skipped', focus: 'upperA' }),
      session('2026-10-07', { status: 'in_progress', focus: 'lowerB', sets: [done] }),
      session(TODAY, { status: 'not_started', focus: 'upperB' }),
    ]);
    expect(days.slice(0, 4).map(d => d.status)).toEqual(['partial', 'skipped', 'inProgress', 'today']);
  });

  it('prefers the completed session when a day has several', () => {
    const days = view([
      session('2026-10-05', { status: 'partial', focus: 'lowerA', startedAt: '2026-10-05T08:00:00.000Z' }),
      session('2026-10-05', { status: 'completed', focus: 'lowerA', startedAt: '2026-10-05T07:00:00.000Z', id: 'b' }),
    ]);
    expect(on(days, '2026-10-05').status).toBe('done');
  });

  it('lets today’s new plan stand over unfinished work banked under the old one', () => {
    const banked = session(TODAY, { status: 'partial', focus: 'upperB', guided: true, planKind: 'full' });
    expect(on(view([banked], { [TODAY]: 'lowerA' }), TODAY)).toMatchObject({ focus: 'lowerA', status: 'today' });
    // On a past day the record is what happened.
    const earlier = session('2026-10-06', { status: 'partial', focus: 'upperA', guided: true, planKind: 'full' });
    expect(on(view([earlier], { '2026-10-06': 'lowerA' }), '2026-10-06')).toMatchObject({ focus: 'upperA', status: 'partial' });
  });

  it('keeps a rest day a rest day, optional mobility or not', () => {
    const days = view([session('2026-10-11', { guided: true, focus: 'rest', planKind: 'restDay' })], {}, '2026-10-11');
    expect(on(days, '2026-10-11').status).toBe('rest');
  });

  it('says a workout on a rest day was one', () => {
    const days = view([session('2026-10-11', { focus: 'fullA' })], {}, '2026-10-11');
    expect(on(days, '2026-10-11')).toMatchObject({ focus: 'fullA', swappedFrom: 'rest', status: 'done' });
  });

  it('starts the week on Monday, also on a Sunday', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
    expect(view([], {}, '2026-10-11')[0].date).toBe('2026-10-05');
  });
});

describe('a status on the plan (scan J2-12)', () => {
  const flare = { startDate: START, statusPeriods: [{ kind: 'flare' as const, from: '2026-10-05', to: '2026-10-07' }] };

  it('shows a day under a status as that status, never as a missed workout', () => {
    const days = weekView({ sessions: [], focusOverrides: {}, settings: flare }, profile, TODAY);
    expect(['2026-10-05', '2026-10-06', '2026-10-07'].map(d => on(days, d).status)).toEqual(['flare', 'flare', 'flare']);
    expect(STATUS_TEXT.flare).toBe('Flare-up');
    expect(on(days, TODAY).status).toBe('today');
  });

  it('keeps what was recorded, and a rest day stays rest', () => {
    const days = weekView({ sessions: [session('2026-10-06', { guided: true, focus: 'upperA', planKind: 'full' })], focusOverrides: {}, settings: flare }, profile, TODAY);
    expect(on(days, '2026-10-06').status).toBe('done');
    const sundays = weekView({ sessions: [], focusOverrides: {}, settings: { startDate: START, statusPeriods: [{ kind: 'away' as const, from: '2026-10-09' }] } }, profile, TODAY);
    expect(on(sundays, '2026-10-11').status).toBe('rest');
    // Away from tomorrow, still going: the days it covers say so.
    expect(on(sundays, '2026-10-09').status).toBe('away');
    expect(STATUS_TEXT.away).toBe('Away');
  });
});

describe('the programme week beside the calendar week (scan J2-11)', () => {
  // Started on a Thursday: programme weeks run Thursday to Wednesday.
  const thursday = { startDate: '2026-09-24' };

  it('names each day’s programme week, so a calendar week that spans two cannot be misread', () => {
    const days = weekView({ sessions: [], focusOverrides: {}, settings: thursday }, profile, '2026-10-12');
    expect(days.map(d => d.week)).toEqual([3, 3, 3, 4, 4, 4, 4]);
    expect(programmeWeek(thursday.startDate, '2026-10-12').week).toBe(3);
  });

  it('gives the programme week’s own dates', () => {
    expect(programmeWeekDates('2026-09-24', '2026-10-12')).toEqual({ from: '2026-10-08', to: '2026-10-14' });
    expect(programmeWeekDates('2026-09-24', '2026-09-24')).toEqual({ from: '2026-09-24', to: '2026-09-30' });
    expect(programmeWeekDates('', '2026-10-12')).toBeUndefined();
  });

  it('says nothing about a week before the start', () => {
    const days = weekView({ sessions: [], focusOverrides: {}, settings: { startDate: '2026-10-09' } }, profile, TODAY);
    expect(days.map(d => d.week)).toEqual([undefined, undefined, undefined, undefined, 1, 1, 1]);
  });
});

describe('programmeWeek', () => {
  it('counts weeks from the start date and says Week N of 12', () => {
    expect(programmeWeek(START, TODAY)).toMatchObject({ week: 2, finished: false, phase: 'foundation', mode: 'normal' });
    expect(programmeWeek(START, START)).toMatchObject({ week: 1 });
    expect(programmeWeek(START, '2026-10-25')).toMatchObject({ week: 4, mode: 'deload' });
    expect(programmeWeek(START, '2026-11-16')).toMatchObject({ week: 8, phase: 'hypertrophy', mode: 'deload' });
    expect(programmeWeek(START, '2026-12-14')).toMatchObject({ week: 12, phase: 'strength', mode: 'taper', finished: false });
  });

  it('stays on week 12 after the twelve weeks, and says they are done', () => {
    expect(programmeWeek(START, '2026-12-21')).toMatchObject({ week: 12, finished: true });
  });

  it('is week 1 before the start date', () => {
    expect(programmeWeek('2026-10-20', TODAY)).toMatchObject({ week: 1, finished: false });
  });

  it('explains the lighter weeks and nothing else', () => {
    expect(weekNote('deload')).toMatch(/lighter week/i);
    expect(weekNote('taper')).toMatch(/last week/i);
    expect(weekNote('normal')).toBeNull();
  });
});

describe('swapping today', () => {
  const plan = (date: string, over: Partial<DailyCheckIn> = {}, p = profile) => buildSessionPlan({
    profile: p, date, startDate: START, sessions: [],
    checkIn: { date, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, ...over },
  });
  const todayRow = (status: WeekDay['status'], focus: WeekDay['focus'] = 'upperB'): WeekDay =>
    ({ date: TODAY, day: 'thursday', isToday: true, focus, status });

  it('allows a swap on a training day not yet started', () => {
    expect(canSwapToday(plan(TODAY), todayRow('today'))).toBe(true);
    expect(canSwapToday(plan(TODAY), todayRow('skipped'))).toBe(true);
  });

  it('refuses once today’s workout has work in it, as the Workout page did once it was done', () => {
    for (const s of ['done', 'partial', 'inProgress', 'recovery'] as const) expect(canSwapToday(plan(TODAY), todayRow(s)), s).toBe(false);
    expect(canSwapToday(plan(TODAY), undefined)).toBe(false);
  });

  it('refuses training on a day readiness turned into recovery or a stop', () => {
    expect(canSwapToday(plan(TODAY, { back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } }), todayRow('today'))).toBe(false);
    expect(canSwapToday(plan(TODAY, { news: ['unwell'] }), todayRow('today'))).toBe(false);
  });

  it('lets a rest day become a training day only when today’s check-in allows it', () => {
    expect(canSwapToday(plan('2026-10-11'), todayRow('rest', 'rest'))).toBe(true);
    expect(canSwapToday(plan('2026-10-11', { news: ['unwell'] }), todayRow('rest', 'rest'))).toBe(false);
  });

  it('offers the week’s workouts, marks the current one, and the way back to a swapped-out rest day', () => {
    const choices = swapChoices(profile, todayRow('today'));
    expect(choices.map(c => c.focus)).toEqual(['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC']);
    expect(choices.filter(c => c.current).map(c => c.focus)).toEqual(['upperB']);
    const fromRest = swapChoices(profile, { ...todayRow('today', 'lowerA'), swappedFrom: 'rest' });
    expect(fromRest.at(-1)).toEqual({ focus: 'rest', current: false });
  });

  it('drops the swap when the choice is the scheduled workout', () => {
    expect(overrideFor('upperB', 'upperB')).toBeUndefined();
    expect(overrideFor('lowerA', 'upperB')).toBe('lowerA');
  });
});

describe('guidedSummary', () => {
  it('names today’s guided session in one line', () => {
    expect(guidedSummary(buildSessionPlan({ profile, date: '2026-10-05', startDate: START, sessions: [] }))).toBe('Lower body · 60 min');
    expect(guidedSummary(buildSessionPlan({ profile, date: '2026-10-06', startDate: START, sessions: [] }))).toBe('Upper body · 60 min');
    const recovery = buildSessionPlan({
      profile, date: TODAY, startDate: START, sessions: [],
      checkIn: { date: TODAY, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } },
    });
    expect(guidedSummary(recovery)).toMatch(/^Recovery · \d+ min$/);
    expect(guidedSummary(buildSessionPlan({ profile, date: '2026-10-11', startDate: START, sessions: [] }))).toMatch(/^Rest day — mobility/);
    expect(guidedSummary(buildSessionPlan({ profile: createDefaultProfile({ restDayMobility: false }), date: '2026-10-11', startDate: START, sessions: [] }))).toBe('Rest day');
    const unwell = buildSessionPlan({
      profile, date: TODAY, startDate: START, sessions: [],
      checkIn: { date: TODAY, urgentSymptoms: false, news: ['unwell'], sleep: 'gt7', energy: 4 },
    });
    expect(guidedSummary(unwell)).toBe('Not today');
  });
});

describe('swapToday', () => {
  const ok = { ok: true as const, value: undefined };
  const saved = (date: string, kind: 'full' | 'stretch' = 'full') =>
    ({ plan: { date, kind }, state: {}, savedAt: 0, clockAt: 0 }) as never;
  const fakes = (opts: { saved?: unknown; bankOk?: boolean } = {}) => {
    const calls: string[] = [];
    const fx = {
      saved: (opts.saved ?? null) as never,
      bank: async () => { calls.push('bank'); return opts.bankOk === false ? { ok: false as const, failure: new Error('full') as never } : ok; },
      clear: () => { calls.push('clear'); },
      setOverride: async (date: string, focus: string | undefined) => { calls.push(`override ${date} ${focus ?? 'none'}`); return ok; },
    };
    return { fx, calls };
  };
  const row: WeekDay = { date: TODAY, day: 'thursday', isToday: true, focus: 'upperB', status: 'today' };

  it('stores the new workout for today, or drops the swap when going back to the scheduled one', async () => {
    const a = fakes();
    expect(await swapToday(row, 'lowerA', a.fx)).toEqual(ok);
    expect(a.calls).toEqual([`override ${TODAY} lowerA`]);
    const b = fakes();
    await swapToday({ ...row, focus: 'lowerA', swappedFrom: 'upperB' }, 'upperB', b.fx);
    expect(b.calls).toEqual([`override ${TODAY} none`]);
  });

  it('banks an unfinished guided session for today first, then clears it', async () => {
    const f = fakes({ saved: saved(TODAY) });
    await swapToday(row, 'lowerA', f.fx);
    expect(f.calls).toEqual(['bank', 'clear', `override ${TODAY} lowerA`]);
  });

  it('changes nothing when the banking save fails', async () => {
    const f = fakes({ saved: saved(TODAY), bankOk: false });
    const r = await swapToday(row, 'lowerA', f.fx);
    expect(r.ok).toBe(false);
    expect(f.calls).toEqual(['bank']);
  });

  it('leaves a saved stretch, and another day’s session, alone', async () => {
    for (const s of [saved(TODAY, 'stretch'), saved('2026-10-07')]) {
      const f = fakes({ saved: s });
      await swapToday(row, 'lowerA', f.fx);
      expect(f.calls).toEqual([`override ${TODAY} lowerA`]);
    }
  });
});

describe('joining and leaving the programme (F29)', () => {
  const settings = { startDate: '', currentWeight: 80, targetGoal: '', defaultRestSeconds: 90, useMetric: true, theme: 'system' as const, onboardingComplete: true,
    gymDays: { monday: 'rest', tuesday: 'rest', wednesday: 'rest', thursday: 'rest', friday: 'rest', saturday: 'rest', sunday: 'rest' } as const };
  const record = (over: Partial<AppData> = {}): AppData => ({
    version: 5, settings: { ...settings }, sessions: [session('2026-10-01', { planKind: 'stretch' })], bodyMetrics: [], personalRecords: [],
    profile: createDefaultProfile({ weightKg: 80 }), checkIns: [], focusOverrides: { '2026-10-01': 'upperA' }, ...over,
  });

  it('accepts today or a later day as a start date, nothing else', () => {
    expect(startDateProblem(TODAY, TODAY)).toBeNull();
    expect(startDateProblem('2026-10-12', TODAY)).toBeNull();
    expect(startDateProblem('2026-10-07', TODAY)).toMatch(/today or a later/i);
    expect(startDateProblem('', TODAY)).toMatch(/choose a start date/i);
    expect(startDateProblem('2026-02-30', TODAY)).toMatch(/choose a start date/i);
    expect(startDateProblem('next week', TODAY)).toMatch(/choose a start date/i);
  });

  it('joins with the answers given and the start date chosen, and touches nothing else', () => {
    const before = record();
    const answers = { profile: createDefaultProfile({ weightKg: 84, trainingDays: ['monday', 'wednesday', 'friday'] }), useMetric: false };
    const after = withJoined(before, answers, '2026-10-12');
    expect(after.settings).toEqual({ ...before.settings, startDate: '2026-10-12', currentWeight: 84, useMetric: false });
    expect(after.profile).toEqual(answers.profile);
    expect({ ...after, settings: before.settings, profile: before.profile }).toEqual(before);
  });

  it('leaves by dropping only the start date: every session, check-in, swap and answer stays', () => {
    const before = record({ settings: { ...settings, startDate: '2026-09-28' } });
    const after = withLeft(before);
    expect(after.settings.startDate).toBe('');
    expect({ ...after, settings: { ...after.settings, startDate: '2026-09-28' } }).toEqual(before);
  });

  it('sends someone outside the programme to join it, and starts the session for a member', () => {
    const plan = buildSessionPlan({ profile, date: TODAY, startDate: START, sessions: [] });
    expect(guidedRow(false, plan, undefined)).toEqual({ detail: 'The 12-week strength programme', join: true });
    expect(guidedRow(true, plan, { date: TODAY, day: 'thursday', isToday: true, focus: 'upperB', status: 'today' })).toEqual({ detail: 'Upper body · 60 min', join: false });
    expect(guidedRow(true, plan, { date: TODAY, day: 'thursday', isToday: true, focus: 'upperB', status: 'done' }).detail).toBe('Done today · Upper body · 60 min');
  });

  it('does not call the days before the start date missed', () => {
    const days = weekView({ sessions: [session('2026-10-05', { focus: 'lowerA' })], focusOverrides: {}, settings: { startDate: TODAY } }, profile, TODAY);
    // A recorded workout still shows; an empty day before joining is not "Not recorded".
    expect(days.slice(0, 4).map(d => d.status)).toEqual(['done', 'beforeStart', 'beforeStart', 'today']);
    expect(STATUS_TEXT.beforeStart).toBe('Before your start date');
    const later = weekView({ sessions: [], focusOverrides: {}, settings: { startDate: '2026-10-10' } }, profile, TODAY);
    expect(later.map(d => d.status)).toEqual(['beforeStart', 'beforeStart', 'beforeStart', 'beforeStart', 'beforeStart', 'comingUp', 'rest']);
    // A rest day before the start is one too: nothing is scheduled yet, so nothing can be swapped.
    const restFirst = createDefaultProfile({ trainingDays: ['monday', 'wednesday', 'friday'] });
    const notYet = weekView({ sessions: [], focusOverrides: {}, settings: { startDate: '2026-10-12' } }, restFirst, TODAY);
    expect(notYet.map(d => d.status)).toEqual(['beforeStart', 'beforeStart', 'beforeStart', 'beforeStart', 'beforeStart', 'beforeStart', 'beforeStart']);
    const restDay = buildSessionPlan({ profile: restFirst, date: TODAY, startDate: '2026-10-12', sessions: [] });
    expect(canSwapToday(restDay, notYet.find(d => d.isToday))).toBe(false);
  });

  it('says when a programme that has not begun starts', () => {
    expect(programmeWeek('2026-10-12', TODAY)).toMatchObject({ week: 1, startsOn: '2026-10-12' });
    expect(programmeWeek(START, TODAY).startsOn).toBeUndefined();
  });
});

describe('the Join save lifecycle (R02)', () => {
  const stored = (): AppData => ({
    version: 5, settings: { startDate: '', currentWeight: 80, targetGoal: '', defaultRestSeconds: 90, useMetric: true, theme: 'system', onboardingComplete: true,
      gymDays: { monday: 'rest', tuesday: 'rest', wednesday: 'rest', thursday: 'rest', friday: 'rest', saturday: 'rest', sunday: 'rest' } },
    sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {},
    profile: createDefaultProfile({ weightKg: 80, trainingDays: ['monday'] }),
  });
  const tueThu = { profile: createDefaultProfile({ weightKg: 80, trainingDays: ['tuesday', 'thursday'] }), startDate: '2026-10-12', useMetric: true };
  const refused = { ok: false as const, failure: new StoreFailure('quotaExceeded', 'Storage is full') };
  const ok = { ok: true as const, value: undefined };

  /** A flow and a write that records what it was asked to store and answers as told. */
  const rig = (answers: StoreResult[]) => {
    let state: JoinFlow = { ...JOIN_CLOSED };
    const dispatch = (a: JoinAction) => { state = joinFlow(state, a); };
    const attempts: AppData[] = [];
    let pending: (() => void) | undefined;
    const write = (updater: (d: AppData) => AppData) => new Promise<StoreResult>(resolve => {
      attempts.push(updater(stored()));
      const answer = answers[attempts.length - 1] ?? ok;
      pending = () => resolve(answer);
    });
    return { get state() { return state; }, dispatch, attempts, write, settle: () => pending?.() };
  };

  it('keeps the wizard open, busy, with the answers, until the store answers', async () => {
    const r = rig([refused]);
    r.dispatch({ type: 'open' });
    const submit = joinController(r.write, r.dispatch);
    const saving = submit(tueThu);
    expect(r.state).toMatchObject({ open: true, busy: true });
    expect(r.state.draft?.profile.trainingDays).toEqual(['tuesday', 'thursday']);
    r.settle();
    await saving;
    // Refused: still open, the reason shown, Tuesday and Thursday still there.
    expect(r.state).toMatchObject({ open: true, busy: false, error: 'That did not save. Storage is full' });
    expect(r.state.draft?.profile.trainingDays).toEqual(['tuesday', 'thursday']);
    expect(r.attempts[0].profile?.trainingDays).toEqual(['tuesday', 'thursday']);
    expect(r.attempts[0].settings.startDate).toBe('2026-10-12');
  });

  it('writes only the answers changed in this wizard over the latest profile (scan D-03)', async () => {
    // Opened with Monday training and no foot answer; meanwhile another open
    // copy saved an open foot wound. Join changes the training days only.
    const openedWith = createDefaultProfile({ weightKg: 80, trainingDays: ['monday'] });
    const draft = { ...tueThu, opened: { profile: openedWith, useMetric: true } };
    const attempts: AppData[] = [];
    const latest = stored();
    latest.profile = { ...latest.profile!, health: { ...latest.profile!.health, footStatus: 'current_wound_or_active_charcot' } };
    const write = (updater: (d: AppData) => AppData) => { attempts.push(updater(latest)); return Promise.resolve(ok); };
    await joinController(write, () => {})(draft);
    expect(attempts[0].profile?.trainingDays).toEqual(['tuesday', 'thursday']);
    expect(attempts[0].profile?.health.footStatus).toBe('current_wound_or_active_charcot');
  });

  it('keeps the unsaved answers after closing, so opening again starts from them', async () => {
    const r = rig([refused]);
    r.dispatch({ type: 'open' });
    const saving = joinController(r.write, r.dispatch)(tueThu);
    r.settle();
    await saving;
    r.dispatch({ type: 'cancel' });
    expect(r.state.open).toBe(false);
    expect(r.state.draft?.profile.trainingDays).toEqual(['tuesday', 'thursday']);
    r.dispatch({ type: 'open' });
    // A fresh attempt: the answers come back, the old reason does not.
    expect(r.state.open).toBe(true);
    expect(r.state.error).toBeUndefined();
    expect(r.state.draft?.profile.trainingDays).toEqual(['tuesday', 'thursday']);
    expect(joinSeed(r.state, stored(), TODAY)).toEqual({ profile: tueThu.profile, startDate: '2026-10-12', useMetric: true });
  });

  it('closes and forgets the draft once the store confirms the save', async () => {
    const r = rig([ok]);
    r.dispatch({ type: 'open' });
    const saving = joinController(r.write, r.dispatch)(tueThu);
    r.settle();
    await saving;
    expect(r.state).toEqual(JOIN_CLOSED);
    expect(joinSeed(r.state, stored(), TODAY)).toEqual({ profile: stored().profile, startDate: TODAY, useMetric: true });
  });

  it('sends one save however often it is submitted, and cannot be closed while saving', async () => {
    const r = rig([ok]);
    r.dispatch({ type: 'open' });
    const submit = joinController(r.write, r.dispatch);
    const first = submit(tueThu);
    const second = submit(tueThu);
    r.dispatch({ type: 'cancel' });
    expect(r.state).toMatchObject({ open: true, busy: true });
    r.settle();
    await Promise.all([first, second]);
    expect(r.attempts).toHaveLength(1);
  });

  it('never leaves the wizard stuck saving, even if the write throws', async () => {
    let state: JoinFlow = { ...JOIN_CLOSED, open: true };
    const dispatch = (a: JoinAction) => { state = joinFlow(state, a); };
    await joinController(() => Promise.reject(new Error('disk gone')), dispatch)(tueThu);
    expect(state).toMatchObject({ open: true, busy: false });
    expect(state.error).toMatch(/did not save/i);
    expect(state.draft?.profile.trainingDays).toEqual(['tuesday', 'thursday']);
  });

  it('retries with the kept answers after a refusal', async () => {
    const r = rig([refused, ok]);
    r.dispatch({ type: 'open' });
    const submit = joinController(r.write, r.dispatch);
    const a = submit(tueThu); r.settle(); await a;
    const b = submit(r.state.draft!); r.settle(); await b;
    expect(r.attempts.map(x => x.profile?.trainingDays)).toEqual([['tuesday', 'thursday'], ['tuesday', 'thursday']]);
    expect(r.state).toEqual(JOIN_CLOSED);
  });
});

describe('which view Your plan shows while membership is being saved (R02)', () => {
  it('stays on the way in while the Join wizard is open, even once the store shows the join', () => {
    expect(planView(false, { joining: true, leaving: false })).toBe('join');
    // The store publishes the join before it is stored.
    expect(planView(true, { joining: true, leaving: false })).toBe('join');
  });

  it('shows the programme once the join is saved and the wizard has closed', () => {
    expect(planView(true, { joining: false, leaving: false })).toBe('member');
  });

  it('stays on the programme while leaving is saved, so a refusal can be shown there', () => {
    expect(planView(false, { joining: false, leaving: true })).toBe('member');
    expect(planView(true, { joining: false, leaving: true })).toBe('member');
  });

  it('follows the store otherwise', () => {
    expect(planView(false, { joining: false, leaving: false })).toBe('join');
  });
});

