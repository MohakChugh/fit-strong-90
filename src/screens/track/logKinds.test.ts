import { describe, expect, it } from 'vitest';
import type { Observation } from '@/health/observation';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserProfile } from '@/types/profile';
import {
  dayTotalWrite, defaultGlucoseUnit, displayPrefs, fromLocalInput, glassMl, isInFuture, logOrder, mealStart, parseAddParam,
  repeatTimes, resolveDay, resolveEditedTime, resolveTime, storedKind, toLocalInput,
} from './logKinds';

function profile(over: { diabetes?: UserProfile['health']['diabetes']; hypertension?: UserProfile['health']['hypertension']; bpMonitor?: boolean; areas?: UserProfile['pain']['areas']; glucoseUnit?: 'mg/dL' | 'mmol/L' }): UserProfile {
  const p = createDefaultProfile();
  return {
    ...p,
    pain: { ...p.pain, areas: over.areas ?? [] },
    health: {
      ...p.health,
      diabetes: over.diabetes ?? 'none',
      hypertension: over.hypertension ?? 'none',
      bpMonitor: over.bpMonitor ?? false,
      glucoseUnit: over.glucoseUnit ?? 'mg/dL',
    },
  };
}

describe('logOrder', () => {
  it('keeps the usual order with no profile', () => {
    expect(logOrder(undefined)).toEqual(['glucose', 'bloodPressure', 'backLeg', 'weight', 'water', 'steps', 'sleep', 'waist', 'lab']);
  });

  it('puts what the profile makes likely first', () => {
    expect(logOrder(profile({ areas: ['sciatica'] }))[0]).toBe('backLeg');
    expect(logOrder(profile({ hypertension: 'treated' })).slice(0, 1)).toEqual(['bloodPressure']);
    expect(logOrder(profile({ bpMonitor: true }))[0]).toBe('bloodPressure');
    const all = logOrder(profile({ diabetes: 'type2', hypertension: 'unsure', areas: ['lowerBack'] }));
    expect(all.slice(0, 3)).toEqual(['glucose', 'bloodPressure', 'backLeg']);
    expect(all).toHaveLength(9);
  });

  it('moves glucose down for someone without diabetes', () => {
    const order = logOrder(profile({ areas: ['lowerBack'] }));
    expect(order[0]).toBe('backLeg');
    expect(order.indexOf('glucose')).toBeGreaterThan(0);
  });
});

describe('parseAddParam', () => {
  it('opens the form a link asks for, by log kind or stored kind', () => {
    expect(parseAddParam('glucose')).toEqual({ kind: 'glucose' });
    expect(parseAddParam('bloodPressure')).toEqual({ kind: 'bloodPressure' });
    expect(parseAddParam('bloodPressureSystolic')).toEqual({ kind: 'bloodPressure' });
    expect(parseAddParam('legPain')).toEqual({ kind: 'backLeg' });
    expect(parseAddParam('hba1c')).toEqual({ kind: 'lab', lab: 'hba1c' });
    expect(parseAddParam('lab')).toEqual({ kind: 'lab' });
  });

  it('opens nothing for anything else', () => {
    expect(parseAddParam(null)).toBeUndefined();
    expect(parseAddParam('')).toBeUndefined();
    expect(parseAddParam('mood')).toBeUndefined();
    expect(parseAddParam('toString')).toBeUndefined();
  });

  it('maps forms to the kind they store', () => {
    expect(storedKind('water')).toBe('water');
    expect(storedKind('lab', 'b12')).toBe('b12');
    expect(storedKind('bloodPressure')).toBeUndefined();
  });
});

describe('mealStart', () => {
  it('uses the reading’s day and offset', () => {
    expect(mealStart('2026-10-08T14:30:00.000+05:30', '13:00')).toBe('2026-10-08T13:00:00.000+05:30');
    expect(mealStart('2026-10-08T14:30:00+05:30', '13:00')).toBe('2026-10-08T13:00:00.000+05:30');
  });

  it('puts a meal later in the clock than the reading on the evening before', () => {
    expect(mealStart('2026-10-08T00:30:00.000+05:30', '23:15')).toBe('2026-10-07T23:15:00.000+05:30');
  });

  it('accepts a meal at the reading’s own minute and refuses junk', () => {
    expect(mealStart('2026-10-08T14:30:00.000+05:30', '14:30')).toBe('2026-10-08T14:30:00.000+05:30');
    expect(mealStart('2026-10-08T14:30:00.000+05:30', '25:00')).toBeUndefined();
    expect(mealStart('2026-10-08T14:30:00.000+05:30', '1pm')).toBeUndefined();
    expect(mealStart('not a time', '13:00')).toBeUndefined();
  });
});

describe('time inputs', () => {
  it('shows an instant as its own wall clock', () => {
    expect(toLocalInput('2026-10-08T07:42:10.123+05:30')).toBe('2026-10-08T07:42');
  });

  it('reads a datetime-local value on this device’s clock', () => {
    const at = fromLocalInput('2026-10-08T07:42')!;
    expect(at.slice(0, 16)).toBe('2026-10-08T07:42');
    expect(Date.parse(at)).toBe(new Date(2026, 9, 8, 7, 42).getTime());
    expect(fromLocalInput('2026-10-08')).toBeUndefined();
    expect(fromLocalInput('')).toBeUndefined();
    expect(fromLocalInput('2026-02-30T07:42')).toBeUndefined();
  });

  it('reads a corrected time in the reading’s own offset, wherever the device is now (F13)', () => {
    const now = new Date('2026-10-09T00:00:00.000Z');
    // Recorded in Delhi; corrected on a device in Los Angeles: still Delhi time.
    expect(resolveEditedTime('2026-10-08T09:30', '2026-10-08T09:00:00.000+05:30', now)).toEqual({ ok: true, at: '2026-10-08T09:30:00.000+05:30' });
    expect(resolveEditedTime('2026-10-08T09:30', '2026-10-08T09:00:00.000Z', now)).toEqual({ ok: true, at: '2026-10-08T09:30:00.000Z' });
    expect(resolveEditedTime('2026-02-30T09:30', '2026-10-08T09:00:00.000+05:30', now).ok).toBe(false);
    expect(resolveEditedTime('2026-10-09T09:30', '2026-10-08T09:00:00.000+05:30', now)).toMatchObject({ ok: false, message: expect.stringMatching(/future/) });
    expect(resolveEditedTime('garbage', '2026-10-08T09:00:00.000+05:30', now).ok).toBe(false);
  });

  it('allows a minute of clock drift but not the future', () => {
    const now = new Date('2026-10-08T07:42:00.000Z');
    expect(isInFuture('2026-10-08T07:42:30.000Z', now)).toBe(false);
    expect(isInFuture('2026-10-08T07:44:00.000Z', now)).toBe(true);
  });
});

describe('preferences', () => {
  it('starts glucose in the profile’s unit, else mg/dL', () => {
    expect(defaultGlucoseUnit(undefined)).toBe('mg/dL');
    expect(defaultGlucoseUnit(profile({ glucoseUnit: 'mmol/L' }))).toBe('mmol/L');
  });

  it('follows metric for weight and waist, and the lab’s own latest unit', () => {
    const labs: Observation[] = [
      { id: 'a', kind: 'b12', at: '2026-01-02T10:00:00.000+05:30', day: '2026-01-02', value: 300, unit: 'pg/mL', scope: 'pointInTime', source: 'manual' },
      { id: 'b', kind: 'b12', at: '2026-06-02T10:00:00.000+05:30', day: '2026-06-02', value: 250, unit: 'pmol/L', scope: 'pointInTime', source: 'manual' },
    ];
    const prefs = displayPrefs({ useMetric: false }, undefined, labs, true);
    expect(prefs).toMatchObject({ mass: 'lb', length: 'in', b12: 'pmol/L', hba1c: '%', vitaminD: 'ng/mL', hour12: true, glucose: 'mg/dL' });
    expect(displayPrefs({ useMetric: true }, undefined, [], false)).toMatchObject({ mass: 'kg', length: 'cm', b12: 'pg/mL' });
  });

  it('uses the person’s own glass size', () => {
    expect(glassMl({})).toBe(250);
    expect(glassMl({ habits: { water: { enabled: true, glassMl: 300, everyMinutes: 60, from: '08:00', to: '20:00' } } })).toBe(300);
  });
});

describe('repeatTimes (F23): each reading has the time it was actually entered', () => {
  const now = new Date('2026-10-08T02:13:20.000Z'); // 07:43:20 in Delhi

  it('keeps the first reading’s moment from when the person moved on, and the repeat’s from Save', () => {
    const t = repeatTimes({ firstEntered: '2026-10-08T07:42:10.000+05:30' }, now);
    expect(t).toEqual({ ok: true, first: '2026-10-08T07:42:10.000+05:30', second: expect.stringMatching(/^2026-10-08T07:43:20\.000/) });
    if (t.ok) expect(Date.parse(t.second) - Date.parse(t.first)).toBe(70_000);
  });

  it('never stamps both with the Save moment when the first was entered earlier', () => {
    const t = repeatTimes({ firstEntered: '2026-10-08T07:43:00.000+05:30' }, now);
    expect(t.ok && t.first !== t.second).toBe(true);
  });

  it('keeps the times the person typed for a backdated pair', () => {
    expect(repeatTimes({ first: '2026-10-07T23:59', second: '2026-10-08T00:00', firstEntered: '2026-10-08T07:42:10.000+05:30' }, now))
      .toMatchObject({ ok: true, first: expect.stringMatching(/^2026-10-07T23:59/), second: expect.stringMatching(/^2026-10-08T00:00/) });
  });

  it('keeps the moment Save was first tapped for a pair saved again later (J17)', () => {
    const t = repeatTimes({ firstEntered: '2026-10-08T07:42:10.000+05:30', secondEntered: '2026-10-08T07:43:15.000+05:30' }, new Date('2026-10-08T03:00:00.000Z'));
    expect(t).toEqual({ ok: true, first: '2026-10-08T07:42:10.000+05:30', second: '2026-10-08T07:43:15.000+05:30' });
    // A typed time still wins over a kept moment.
    expect(repeatTimes({ firstEntered: '2026-10-08T07:42:10.000+05:30', second: '2026-10-08T07:43', secondEntered: '2026-10-08T07:43:15.000+05:30' }, now))
      .toMatchObject({ ok: true, second: expect.stringMatching(/^2026-10-08T07:43:00/) });
  });

  it('refuses a time that is not real or is in the future, saying which reading', () => {
    expect(repeatTimes({ first: '2026-10-09T09:00' }, now)).toMatchObject({ ok: false, which: 1 });
    expect(repeatTimes({ firstEntered: '2026-10-08T07:42:10.000+05:30', second: '2026-02-30T09:00' }, now)).toMatchObject({ ok: false, which: 2 });
  });
});

describe('resolveTime and resolveDay', () => {
  const now = new Date(2026, 9, 8, 9, 30);
  it('means now when untouched, and refuses an impossible or future time', () => {
    const untouched = resolveTime(undefined, now);
    expect(untouched.ok && Date.parse(untouched.at)).toBe(now.getTime());
    const typed = resolveTime('2026-10-08T07:42', now);
    expect(typed.ok && typed.at.slice(0, 16)).toBe('2026-10-08T07:42');
    expect(resolveTime('2026-10-08T11:00', now)).toMatchObject({ ok: false, message: expect.stringMatching(/future/) });
    expect(resolveTime('2026-02-30T07:42', now)).toMatchObject({ ok: false, message: expect.stringMatching(/do not exist/) });
  });

  it('means today when untouched, and refuses a future or impossible day', () => {
    expect(resolveDay(undefined, '2026-10-08')).toEqual({ ok: true, day: '2026-10-08' });
    expect(resolveDay('2026-10-01', '2026-10-08')).toEqual({ ok: true, day: '2026-10-01' });
    expect(resolveDay('2026-10-09', '2026-10-08')).toMatchObject({ ok: false });
    expect(resolveDay('2026-02-30', '2026-10-08')).toMatchObject({ ok: false });
  });
});

describe('dayTotalWrite', () => {
  const now = new Date(2026, 9, 8, 9, 30);
  const steps = (id: string, day: string, at: string, source: Observation['source'] = 'manual'): Observation =>
    ({ id, kind: 'steps', day, at, value: 4000, unit: 'steps', scope: 'dayTotal', source });

  it('adds a new statement now for today', () => {
    const w = dayTotalWrite('steps', '2026-10-08', [steps('a', '2026-10-08', '2026-10-08T08:00:00.000+05:30')], '2026-10-08', now);
    expect(w.action).toBe('add');
    expect(w.action === 'add' && Date.parse(w.at)).toBe(now.getTime());
  });

  it('corrects a past day’s own latest manual total rather than adding one that would not count', () => {
    const obs = [
      steps('early', '2026-10-06', '2026-10-06T09:00:00.000+05:30'),
      steps('late', '2026-10-06', '2026-10-06T21:00:00.000+05:30'),
      steps('imported', '2026-10-06', '2026-10-06T22:00:00.000+05:30', 'imported'),
    ];
    expect(dayTotalWrite('steps', '2026-10-06', obs, '2026-10-08', now)).toEqual({ action: 'edit', id: 'late' });
  });

  it('adds a statement at the day’s midday when a past day has no manual total', () => {
    const w = dayTotalWrite('sleep', '2026-10-06', [], '2026-10-08', now);
    expect(w).toEqual({ action: 'add', at: expect.stringMatching(/^2026-10-06T12:00:00\.000/) });
  });
});
