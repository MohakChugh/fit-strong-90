import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { StatusPeriod, WorkoutSession } from '@/types';
import type { Readiness } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { HealthProfile, UserProfile } from '@/types/profile';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { HREF, type Recommendation } from '@/health/recommend';
import type { Pending } from '@/reminders/pending';
import type { HabitId } from '@/reminders/schedule';
import {
  chooserRows,
  during,
  eyebrowOf,
  latestGlucose,
  latestPressure,
  pickPrompt,
  planRow,
  sheetFrom,
  showsGlucose,
  showsPressure,
  startLabelFor,
  statusDetail,
  todayPrefs,
  weekMovement,
  enteredNote,
  within,
} from './model';

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const at = (day: string, time: string) => new Date(`${day}T${time}:00`);
const prefs = todayPrefs(undefined, false);

function profile(health: Partial<HealthProfile> = {}, extra: Partial<UserProfile> = {}): UserProfile {
  return createDefaultProfile({ health: { diabetes: 'type2', hypertension: 'treated', medicinesReviewed: true, ...health }, ...extra });
}

function readiness(): Readiness {
  return { outcome: 'green', modifiers: [], back: 'none', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [] };
}

function plan(over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'p', date: TODAY, week: 3, phase: 'foundation', mode: 'normal', focus: 'lowerA', label: 'Lower A · Squat',
    mobilityDayType: 'lowerSquat', readiness: readiness(), kind: 'full', steps: [], exercises: [], cardio: null,
    blockStarts: { mobility: 0, strength: 900 }, totalSeconds: 3600, changes: [], warnings: [], ...over,
  };
}

let n = 0;
function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${++n}`, date, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: at(date, '07:00').toISOString(), completedAt: null, notes: '', totalVolume: 0, guided: true, durationSeconds: 3000, ...over,
  };
}

const glucose = (time: string, value: number, unit = 'mg/dL', context?: string): Observation =>
  newObservation({ kind: 'glucose', value, unit, scope: 'pointInTime', source: 'manual', at: `${TODAY}T${time}:00+05:30`, ...(context ? { context } : {}) });

function pressure(time: string, sys: number | null, dia: number | null, readingId = `r${++n}`): Observation[] {
  const shared = { at: `${TODAY}T${time}:00+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(readingId) };
  return [
    ...(sys !== null ? [newObservation({ ...shared, kind: 'bloodPressureSystolic', value: sys })] : []),
    ...(dia !== null ? [newObservation({ ...shared, kind: 'bloodPressureDiastolic', value: dia })] : []),
  ];
}

const rec = (over: Partial<Recommendation>): Recommendation => ({
  kind: 'scheduled', title: 't', detail: 'd', reason: 'r', action: { label: 'Start session', to: HREF.guided, mode: 'guided' }, ...over,
});

describe('today’s readings', () => {
  it('shows the latest glucose of the day with its time and source', () => {
    const r = latestGlucose([glucose('07:40', 142), glucose('13:05', 168)], TODAY, prefs);
    expect(r).toEqual({ value: '168 mg/dL', detail: '13:05 · Manual entry' });
  });

  it('shows glucose in the person’s own unit', () => {
    const r = latestGlucose([glucose('07:40', 7.8, 'mmol/L')], TODAY, todayPrefs(profile({ glucoseUnit: 'mg/dL' }), false));
    expect(r?.value).toBe('140 mg/dL');
    expect(latestGlucose([glucose('07:40', 144)], TODAY, todayPrefs(profile({ glucoseUnit: 'mmol/L' }), true))).toEqual({ value: '8.0 mmol/L', detail: '7:40 am · Manual entry' });
  });

  it('does not invent a time for a reading lifted from a check-in', () => {
    const fromCheckIn = newObservation({ kind: 'glucose', value: 120, scope: 'pointInTime', source: 'manual', at: '2026-10-08T12:00:00.000+05:30', context: `checkIn:${TODAY}` });
    expect(latestGlucose([fromCheckIn], TODAY, prefs)).toEqual({ value: '120 mg/dL', detail: 'From your check-in' });
  });

  it('has nothing to show for a day with no reading, never a zero', () => {
    expect(latestGlucose([], TODAY, prefs)).toBeUndefined();
    expect(latestGlucose([glucose('07:40', 142)], '2026-10-09', prefs)).toBeUndefined();
    expect(latestPressure([], TODAY, prefs)).toBeUndefined();
  });

  it('puts a blood pressure reading back together, latest first', () => {
    const r = latestPressure([...pressure('07:30', 128, 82), ...pressure('19:00', 136, 88)], TODAY, prefs);
    expect(r).toEqual({ value: '136/88 mmHg', detail: '19:00 · Manual entry' });
  });

  it('says so when one half of a reading was lost, rather than inventing it', () => {
    expect(latestPressure(pressure('07:30', 128, null), TODAY, prefs)?.detail).toBe('07:30 · Manual entry · systolic only, the other number was not saved');
    expect(latestPressure(pressure('07:30', null, 82), TODAY, prefs)?.value).toBe('82 mmHg');
  });

  it('shows a row only where it is relevant, or once there is a reading', () => {
    const none = profile({ diabetes: 'none', hypertension: 'none', bpMonitor: false });
    expect(showsGlucose(none, undefined)).toBe(false);
    expect(showsGlucose(none, { value: '100 mg/dL', detail: '' })).toBe(true);
    expect(showsGlucose(profile(), undefined)).toBe(true);
    expect(showsGlucose(profile({ diabetes: 'prediabetes' }), undefined)).toBe(true);
    expect(showsPressure(none, undefined)).toBe(false);
    expect(showsPressure(profile({ hypertension: 'none', bpMonitor: true }), undefined)).toBe(true);
    expect(showsPressure(profile(), undefined)).toBe(true);
    expect(showsPressure(undefined, undefined)).toBe(false);
  });
});

describe('weekMovement', () => {
  it('counts this week’s walks and sessions once each, as Track’s ring does', () => {
    const walk = newObservation({
      kind: 'movementMinutes', value: 20, scope: 'sessionObserved', coverageMs: 20 * 60_000, source: 'measured',
      at: '2026-10-06T18:00:00+05:30', context: 'walk:w1',
    });
    const lastWeek = session('2026-10-04', { durationSeconds: 3600 });
    // A guided session and a measured walk: nothing was typed in.
    expect(weekMovement(TODAY, [walk], [session('2026-10-07', { durationSeconds: 45 * 60 }), lastWeek])).toEqual({ minutes: 65, entered: 0 });
    expect(weekMovement(TODAY, [], [])).toEqual({ minutes: 0, entered: 0 });
  });

  it('counts a hand-logged workout’s entered minutes as added by hand (acceptance J11)', () => {
    const logged = session('2026-10-07', { guided: false, durationSeconds: 3 * 60 });
    const walk = newObservation({
      kind: 'movementMinutes', value: 3, scope: 'sessionObserved', coverageMs: 3 * 60_000, source: 'measured',
      at: '2026-10-08T07:00:00+05:30', context: 'walk:w2',
    });
    expect(weekMovement(TODAY, [walk], [logged])).toEqual({ minutes: 6, entered: 3 });
  });
});

describe('enteredNote', () => {
  it('names the share added by hand, and says nothing when all of it was measured', () => {
    expect(enteredNote({ minutes: 6, entered: 3 })).toBe('3 min added by hand');
    expect(enteredNote({ minutes: 45, entered: 45 })).toBe('all added by hand');
    expect(enteredNote({ minutes: 20, entered: 0 })).toBeUndefined();
    expect(enteredNote({ minutes: 0, entered: 0 })).toBeUndefined();
  });
});

describe('planRow', () => {
  const base = {
    day: TODAY, plan: plan(), sessions: [] as WorkoutSession[],
    profile: profile({}, { trainingDays: ['monday', 'wednesday', 'thursday', 'saturday'] }),
    startDate: '2026-09-21', statusPeriods: undefined as StatusPeriod[] | undefined, sessionShown: true,
  };

  it('names the week of 12 and the phase', () => {
    expect(planRow(base).label).toBe('Week 3 of 12');
    expect(planRow(base).detail).toBe('Foundation phase · 0 of 4 sessions this week');
  });

  it('keeps today’s session in view when the suggestion above is something else', () => {
    expect(planRow({ ...base, sessionShown: false }).detail).toBe('Foundation phase · Lower A · Squat today');
    // Once it is done, the week is what matters.
    expect(planRow({ ...base, sessionShown: false, sessions: [session(TODAY)] }).detail).toBe('Foundation phase · 1 of 4 sessions this week');
  });

  it('counts finished programme sessions only, as Move’s week shows them', () => {
    const sessions = [
      session('2026-10-05'),
      session('2026-10-07', { status: 'partial' }),
      session('2026-10-06', { planKind: 'stretch' }),
      session('2026-10-04', { planKind: 'restDay' }),
    ];
    expect(planRow({ ...base, sessions }).detail).toBe('Foundation phase · 1 of 4 sessions this week');
  });

  it('does not push today’s session while a status is set', () => {
    // Away from Thursday: of the week's Mon, Wed, Thu and Sat, only Mon and Wed still count.
    const statusPeriods: StatusPeriod[] = [{ kind: 'away', from: TODAY }];
    expect(planRow({ ...base, sessionShown: false, statusPeriods }).detail).toBe('Foundation phase · 0 of 2 sessions this week');
  });

  it('leaves status days out of both sides of the count (D25)', () => {
    const statusPeriods: StatusPeriod[] = [{ kind: 'away', from: '2026-10-05', to: '2026-10-07' }];
    const sessions = [session('2026-10-07')];
    expect(planRow({ ...base, sessions, statusPeriods }).detail).toBe('Foundation phase · 0 of 2 sessions this week');
  });

  it('does not count days before the programme started', () => {
    expect(planRow({ ...base, startDate: '2026-10-08' }).detail).toBe('Foundation phase · 0 of 2 sessions this week');
  });

  it('reports extra sessions without a misleading fraction', () => {
    const sessions = ['2026-10-05', '2026-10-06', '2026-10-07', TODAY, '2026-10-09'].map(d => session(d));
    expect(planRow({ ...base, sessions }).detail).toBe('Foundation phase · 5 sessions this week');
  });

  it('shows just the phase when nothing is planned in the counted days', () => {
    const statusPeriods: StatusPeriod[] = [{ kind: 'away', from: '2026-10-05' }];
    expect(planRow({ ...base, statusPeriods, plan: plan({ focus: 'rest', kind: 'none' }) }).detail).toBe('Foundation phase');
  });
});

describe('within', () => {
  it('is inside from the start and outside from the end', () => {
    expect(within(at(TODAY, '08:59'), '09:00', '21:00')).toBe(false);
    expect(within(at(TODAY, '09:00'), '09:00', '21:00')).toBe(true);
    expect(within(at(TODAY, '20:59'), '09:00', '21:00')).toBe(true);
    expect(within(at(TODAY, '21:00'), '09:00', '21:00')).toBe(false);
  });

  it('runs past midnight', () => {
    expect(within(at(TODAY, '23:30'), '22:00', '07:00')).toBe(true);
    expect(within(at(TODAY, '06:59'), '22:00', '07:00')).toBe(true);
    expect(within(at(TODAY, '07:00'), '22:00', '07:00')).toBe(false);
  });

  it('is never inside an unreadable window', () => {
    expect(within(at(TODAY, '10:00'), '9am', '21:00')).toBe(false);
    expect(within(at(TODAY, '10:00'), undefined, '21:00')).toBe(false);
    expect(within(at(TODAY, '10:00'), '09:00', '09:00')).toBe(false);
  });
});

describe('pickPrompt', () => {
  const water = { enabled: true, glassMl: 300, dailyGoalMl: 2000, everyMinutes: 90, from: '09:00', to: '21:00' };
  const quiet = profile({ diabetes: 'none', hypertension: 'none' });
  const base = {
    now: at(TODAY, '10:00'), day: TODAY, status: 'normal' as const, stopped: false, held: false, profile: quiet,
    settings: { habits: { water } }, observations: [] as Observation[], waterBlocked: false, waiting: [] as Pending[],
  };
  /** A reminder that showed and has not been answered, as the reminders module keeps it. */
  const reminder = (habit: HabitId, clock: string): Pending => {
    const [h, m] = clock.split(':').map(Number);
    return { occurrence: { habit, minute: h * 60 + m, day: TODAY, id: `${habit}@${TODAY}T${clock}` }, shownAt: at(TODAY, clock).getTime() };
  };
  const stand = reminder('sittingBreak', '09:55');
  const sip = reminder('water', '09:30');
  const bp = profile({ diabetes: 'none', bpMonitor: true });

  it('shows the newest waiting reminder when nothing is due, in place of the water row', () => {
    expect(pickPrompt({ ...base, waiting: [stand, sip] })).toEqual({ kind: 'reminder', item: stand });
    expect(pickPrompt({ ...base, waiting: [sip] })).toEqual({ kind: 'reminder', item: sip });
    // Once nothing is waiting, the water row is back.
    expect(pickPrompt({ ...base, waiting: [] })).toEqual({ kind: 'water', goalMl: 2000, glassMl: 300 });
  });

  /** A full home blood-pressure day: two readings morning and evening, a minute apart. */
  const bpDay = (day: string): Observation[] => ['07:30', '07:31', '20:00', '20:01'].flatMap((time, i) => {
    const shared = { at: `${day}T${time}:00+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(`d${day}-${i}`), tag: i < 2 ? 'morning' as const : 'evening' as const };
    return [newObservation({ ...shared, kind: 'bloodPressureSystolic', value: 132 }), newObservation({ ...shared, kind: 'bloodPressureDiastolic', value: 84 })];
  });
  const treatedBp = profile({ diabetes: 'none', hypertension: 'treated', bpMonitor: true });

  it('puts a blood-pressure day that has just come round ahead of a waiting reminder, and an ignored one behind it', () => {
    // The last full day a week ago: today's check day has just come round.
    expect(pickPrompt({ ...base, profile: treatedBp, observations: bpDay('2026-10-01'), waiting: [stand] })).toMatchObject({ kind: 'due', item: { kind: 'bpCheckDay' } });
    // Never recorded, or gone unanswered for days: the reminder comes first, the prompt after it.
    expect(pickPrompt({ ...base, profile: treatedBp, waiting: [stand] })).toEqual({ kind: 'reminder', item: stand });
    expect(pickPrompt({ ...base, profile: treatedBp })).toMatchObject({ kind: 'due', item: { kind: 'bpCheckDay' } });
  });

  it('keeps the due list’s own order: a lab test that is due before an ignored blood-pressure prompt (acceptance J06)', () => {
    const both = profile({ diabetes: 'type2', hypertension: 'treated', bpMonitor: true });
    const old = newObservation({ kind: 'hba1c', value: 6.5, scope: 'pointInTime', source: 'manual', at: '2026-03-01T12:00:00+05:30' });
    expect(pickPrompt({ ...base, profile: both, observations: [old] })).toMatchObject({ kind: 'due', item: { kind: 'hba1c' } });
  });

  it('keeps reminders from beside any safety card, while a due check may still show beside a hold', () => {
    expect(pickPrompt({ ...base, stopped: true, waiting: [stand] })).toBeUndefined();
    expect(pickPrompt({ ...base, held: true, waiting: [stand] })).toBeUndefined();
    expect(pickPrompt({ ...base, held: true })).toBeUndefined();
    expect(pickPrompt({ ...base, held: true, profile: bp, waiting: [stand] })).toMatchObject({ kind: 'due' });
  });

  it('shows no reminder unless the day is Normal', () => {
    for (const status of ['flare', 'unwell', 'away'] as const) {
      expect(pickPrompt({ ...base, status, waiting: [stand] })).toBeUndefined();
    }
  });

  it('never lets a lab nudge hide a reminder the person turned on, nor a first result hide the water row (scan J2-06)', () => {
    const diabetic = profile({ diabetes: 'type2', hypertension: 'none' });
    // No HbA1c ever entered: the least urgent prompt of all.
    expect(pickPrompt({ ...base, profile: diabetic, waiting: [sip] })).toEqual({ kind: 'reminder', item: sip });
    expect(pickPrompt({ ...base, profile: diabetic })).toEqual({ kind: 'water', goalMl: 2000, glassMl: 300 });
    expect(pickPrompt({ ...base, profile: diabetic, now: at(TODAY, '22:00') })).toMatchObject({ kind: 'due', item: { kind: 'hba1cFirst' } });
    // A result that is due again: after a waiting reminder, ahead of the water row.
    const old = newObservation({ kind: 'hba1c', value: 7.4, scope: 'pointInTime', source: 'manual', at: '2025-12-01T12:00:00+05:30' });
    expect(pickPrompt({ ...base, profile: diabetic, observations: [old], waiting: [sip] })).toEqual({ kind: 'reminder', item: sip });
    expect(pickPrompt({ ...base, profile: diabetic, observations: [old] })).toMatchObject({ kind: 'due', item: { kind: 'hba1c' } });
  });

  it('puts a due check first', () => {
    const p = pickPrompt({ ...base, profile: profile({ diabetes: 'none' , bpMonitor: true }) });
    expect(p).toMatchObject({ kind: 'due', item: { kind: 'bpCheckDay' } });
  });

  it('otherwise offers the water habit the person chose, inside its hours', () => {
    expect(pickPrompt(base)).toEqual({ kind: 'water', goalMl: 2000, glassMl: 300 });
    const drunk = newObservation({ kind: 'water', value: 750, scope: 'dayTotal', source: 'manual', at: `${TODAY}T09:30:00+05:30` });
    expect(pickPrompt({ ...base, observations: [drunk] })).toEqual({ kind: 'water', totalMl: 750, goalMl: 2000, glassMl: 300 });
    expect(pickPrompt({ ...base, now: at(TODAY, '22:00') })).toBeUndefined();
  });

  it('stays quiet when in-app reminders are turned off', () => {
    expect(pickPrompt({ ...base, settings: { habits: { water, inApp: false } } })).toBeUndefined();
    expect(pickPrompt({ ...base, settings: { habits: { water, inApp: true } } })?.kind).toBe('water');
  });

  it('never offers water against the reminders module’s block, or in quiet hours', () => {
    expect(pickPrompt({ ...base, waterBlocked: true })).toBeUndefined();
    expect(pickPrompt({ ...base, settings: { habits: { water, quietHours: { from: '09:30', to: '11:00' } } } })).toBeUndefined();
    expect(pickPrompt({ ...base, settings: { habits: { water: { ...water, enabled: false } } } })).toBeUndefined();
  });

  it('asks nothing under an emergency or a "get advice today"', () => {
    expect(pickPrompt({ ...base, stopped: true })).toBeUndefined();
    expect(pickPrompt({ ...base, stopped: true, profile: profile({ diabetes: 'none', bpMonitor: true }) })).toBeUndefined();
  });

  it('asks nothing while away or unwell, and only a due check during a flare-up', () => {
    const bp = profile({ diabetes: 'none', bpMonitor: true });
    expect(pickPrompt({ ...base, profile: bp, status: 'away' })).toBeUndefined();
    expect(pickPrompt({ ...base, profile: bp, status: 'unwell' })).toBeUndefined();
    expect(pickPrompt({ ...base, profile: bp, status: 'flare' })?.kind).toBe('due');
    expect(pickPrompt({ ...base, status: 'flare' })).toBeUndefined();
  });
});

describe('chooserRows', () => {
  const input = { recommendation: rec({}), enrolled: true, plan: plan(), trained: false };

  it('lists the five modes in a fixed order', () => {
    expect(chooserRows(input).map(r => r.label)).toEqual(['Stretch', 'Walk', 'Guided session', 'Log something', 'Learn']);
    const habit = rec({ kind: 'habit', action: { label: 'Stretch now', to: HREF.stretch, mode: 'stretch' } });
    expect(chooserRows({ ...input, recommendation: habit }).map(r => r.label)).toEqual(['Stretch', 'Walk', 'Guided session', 'Log something', 'Learn']);
  });

  it('offers no way of moving as an ordinary choice during a stop (scan S-15)', () => {
    const rows = chooserRows({ ...input, stopped: true });
    expect(rows.filter(r => r.mode).map(r => r.detail)).toEqual(['Not today · see your check-in', 'Not today · see your check-in', 'Not today · see your check-in']);
    expect(rows.some(r => r.suggested)).toBe(false);
    // Logging and learning stay as they are.
    expect(rows.find(r => r.id === 'log')?.detail).toBe('A reading, water, steps or a workout');
  });

  it('marks the suggestion without moving it', () => {
    expect(chooserRows(input).filter(r => r.suggested).map(r => r.id)).toEqual(['guided']);
    const walk = rec({ kind: 'gentle', action: { label: 'Walk now', to: HREF.walk, mode: 'walk' } });
    expect(chooserRows({ ...input, recommendation: walk }).filter(r => r.suggested).map(r => r.id)).toEqual(['walk']);
    const choose = rec({ kind: 'choose', action: { label: 'See the choices', to: HREF.choose } });
    expect(chooserRows({ ...input, recommendation: choose }).some(r => r.suggested)).toBe(false);
  });

  it('routes movement through the gate and the rest straight to its place', () => {
    const rows = chooserRows(input);
    expect(rows.map(r => [r.id, r.to, r.mode])).toEqual([
      ['stretch', '/move/stretch', 'stretch'],
      ['walk', '/walk', 'walk'],
      ['guided', '/session', 'guided'],
      ['log', '/track?add=', undefined],
      ['learn', '/guide', undefined],
    ]);
  });

  it('describes the guided session for the day it is', () => {
    const guided = (i: Partial<typeof input>) => chooserRows({ ...input, ...i }).find(r => r.id === 'guided');
    expect(guided({})?.detail).toBe('Lower A · Squat · 60 min');
    expect(guided({ trained: true })?.detail).toBe('Done today · Lower A · Squat');
    expect(guided({ plan: plan({ focus: 'rest', kind: 'restDay', totalSeconds: 1800 }) })?.detail).toBe('Rest-day session · 30 min');
    expect(guided({ plan: plan({ focus: 'rest', kind: 'none' }) })).toMatchObject({ detail: 'A rest day in your plan', to: HREF.plan });
    expect(guided({ enrolled: false })).toMatchObject({ detail: 'The 12-week strength programme', to: HREF.plan });
    expect(guided({ enrolled: false })?.mode).toBeUndefined();
  });
});

describe('startLabelFor', () => {
  it('says what the Start button will do', () => {
    expect(startLabelFor('guided', HREF.guided)).toBe('Start session');
    expect(startLabelFor('guided', HREF.guided, true)).toBe('Start recovery session');
    expect(startLabelFor('guided', HREF.resume)).toBe('Continue session');
    expect(startLabelFor('stretch', '/session?mode=stretch&focus=backHips&minutes=10&resume=1')).toBe('Continue stretch');
    expect(startLabelFor('stretch', HREF.stretch)).toBe('Continue to stretch');
    expect(startLabelFor('walk', HREF.walk)).toBe('Continue to walk');
  });
});

describe('sheetFrom', () => {
  const q = (s: string) => sheetFrom(new URLSearchParams(s));

  it('opens the check-in from the session player’s link, for the guided session by default', () => {
    expect(q('checkin=1')).toEqual({ kind: 'checkIn', mode: 'guided' });
    expect(q('checkin=walk')).toEqual({ kind: 'checkIn', mode: 'walk' });
    expect(q('checkin=stretch')).toEqual({ kind: 'checkIn', mode: 'stretch' });
    expect(q('checkin=anything')).toEqual({ kind: 'checkIn', mode: 'guided' });
  });

  it('reads the other sheets, and only one at a time', () => {
    expect(q('status=1')).toEqual({ kind: 'status' });
    expect(q('status=normal')).toEqual({ kind: 'status', preset: 'normal' });
    expect(q('choose=1')).toEqual({ kind: 'choose' });
    expect(q('goal=1')).toEqual({ kind: 'goal' });
    expect(q('choose=1&checkin=1')).toEqual({ kind: 'checkIn', mode: 'guided' });
    expect(q('')).toBeUndefined();
    expect(q('day=2026-10-01')).toBeUndefined();
  });

  it('parses every sheet address the recommendation can hold', () => {
    for (const to of [HREF.checkIn('walk'), HREF.status, HREF.statusNormal, HREF.choose]) {
      expect(sheetFrom(new URLSearchParams(to.slice(to.indexOf('?') + 1)))).toBeDefined();
    }
  });
});

describe('words', () => {
  it('heads the suggestion by what it is', () => {
    expect(eyebrowOf(rec({}))).toBe('Today’s session');
    expect(eyebrowOf(rec({ kind: 'emergency' }))).toBe('Today’s check-in');
    expect(eyebrowOf(rec({ kind: 'hold', action: { label: 'x', to: HREF.profile } }))).toBe('Before you start');
    expect(eyebrowOf(rec({ kind: 'hold', action: { label: 'x', to: HREF.checkIn('guided') } }))).toBe('Today’s check-in');
    expect(eyebrowOf(rec({ kind: 'resume' }))).toBe('In progress');
    expect(eyebrowOf(rec({ kind: 'status' }))).toBe('Your status');
    expect(eyebrowOf(rec({ kind: 'habit' }))).toBe('Suggested for now');
    expect(eyebrowOf(rec({ kind: 'choose' }))).toBe('Today');
  });

  it('describes a status period in days a person uses', () => {
    expect(statusDetail(undefined, TODAY)).toBeUndefined();
    expect(statusDetail({ kind: 'away', from: TODAY }, TODAY)).toBe('since today');
    expect(statusDetail({ kind: 'away', from: '2026-10-06', to: '2026-10-11' }, TODAY)).toBe('since Tuesday · until Sunday');
    expect(statusDetail({ kind: 'flare', from: '2026-09-20' }, TODAY)).toBe('since 20 September');
    expect(statusDetail({ kind: 'unwell', from: '2026-10-07', to: TODAY }, TODAY)).toBe('since Wednesday · until today');
  });

  it('names the run the plan offer is about', () => {
    const p = (kind: StatusPeriod['kind'], from: string): StatusPeriod => ({ kind, from, to: from });
    expect(during([p('away', '2026-10-01')])).toBe('While you were away');
    expect(during([p('unwell', '2026-10-01'), p('unwell', '2026-10-02')])).toBe('While you were unwell');
    expect(during([p('flare', '2026-10-01')])).toBe('During your flare-up');
    expect(during([p('flare', '2026-10-01'), p('unwell', '2026-10-02')])).toBe('While you were in a flare-up and unwell');
  });
});

describe('the guided row names what runs (scan X2-16)', () => {
  const guided = (p: SessionPlan, trained = false) =>
    chooserRows({ recommendation: rec({}), enrolled: true, plan: p, trained }).find(r => r.id === 'guided');

  it('calls a flare-up’s or a check-in’s recovery version a recovery session, not the day’s full session', () => {
    // A flare-up turns Full Body C into the 26-minute recovery session, as Move's "Recovery · 26 min" says.
    const recovery = plan({ kind: 'recovery', focus: 'fullC', label: 'Full Body C', totalSeconds: 26 * 60 });
    expect(guided(recovery)).toMatchObject({ label: 'Guided session', detail: 'Recovery session · 26 min', to: HREF.guided, mode: 'guided' });
    // The full session keeps its own name.
    expect(guided(plan({ kind: 'full', focus: 'fullC', label: 'Full Body C', totalSeconds: 45 * 60 }))?.detail).toBe('Full Body C · 45 min');
  });
});
