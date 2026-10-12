import { afterEach, describe, it, expect } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, EmergencyFlag } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { evaluateCheckIn } from '@/engine/readiness';
import { PERMISSION_TEXT, type PermissionInput } from '@/engine/permission';
import { effectiveCheckIns, resetPendingCheckInsForTests, saveCheckInRecord } from '@/components/checkin/pending';
import { gateInputFor, logGate, offersOtherWorkout, setGate, stageOf, type Stage } from './gate';

const DATE = '2026-10-09';
const NOW = new Date(2026, 9, 9, 18, 0, 0);
const at = (minutesBeforeNow: number) => new Date(NOW.getTime() - minutesBeforeNow * 60_000).toISOString();
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const };
const plain: ProfileInput = { health: { ...known } };
const insulin: ProfileInput = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump' } };
const metformin: ProfileInput = { health: { ...known, diabetes: 'type2', metformin: true } };

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn =>
  ({ date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });

function gate(p: ProfileInput, c: DailyCheckIn | undefined, stage: Stage, now = NOW) {
  const profile = createDefaultProfile(p);
  return logGate({ profile, ...(c ? { checkIn: { ...c, readiness: evaluateCheckIn(profile, c) } } : {}), now }, stage);
}

describe('before the first set', () => {
  it('asks for the check-in, exactly as a start button does', () => {
    const g = gate(plain, undefined, 'start');
    expect(g.kind).toBe('checkIn');
    expect(g.permission.reasons).toContain(PERMISSION_TEXT.noCheckIn);
    expect(gate(plain, ci(), 'start').kind).toBe('log');
  });

  it("asks an insulin user for a reading from the last 30 minutes", () => {
    expect(gate(insulin, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(10) } }), 'start').kind).toBe('log');
    expect(gate(insulin, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(120) } }), 'start').kind).toBe('checkIn');
  });

  it('stops for a reason another check-in will not change', () => {
    expect(gate(plain, ci({ news: ['dizzy'] }), 'start').kind).toBe('stop');
    expect(gate(plain, ci({ emergency: ['chest'] }), 'start').permission.disposition).toBe('emergency');
    // An unreviewed health profile is a hold the profile answers, not the check-in.
    const unreviewed = gate({ ...plain, needsHealthReview: true }, ci(), 'start');
    expect(unreviewed.kind).toBe('stop');
    expect(unreviewed.permission.reasons).toContain(PERMISSION_TEXT.healthUnreviewed);
  });
});

describe('once the workout is under way', () => {
  it('carries on when only the check-in has gone stale', () => {
    // Started last night: it is past midnight and no check-in exists for the new day.
    expect(gate(plain, ci({ date: '2026-10-08' }), 'live').kind).toBe('log');
    // The pre-session reading is two hours old now; the sets are already happening.
    expect(gate(insulin, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(120) } }), 'live').kind).toBe('log');
  });

  it('never lets saved work bypass a new stop or a pending re-check', () => {
    expect(gate(plain, ci({ emergency: ['chest'] }), 'live')).toMatchObject({ kind: 'stop', permission: { disposition: 'emergency' } });
    expect(gate(plain, ci({ news: ['dizzy'] }), 'live').kind).toBe('stop');
    expect(gate(metformin, ci({ glucose: { value: 65, unit: 'mg/dL', measuredAt: at(1) } }), 'live').kind).toBe('checkIn');
  });
});

describe('a workout taken up again', () => {
  // A reload, or a return from another screen, proves nothing about exercise
  // carrying on, so its next set asks what starting asks (re-audit B03).
  const glucose = (minutesAgo: number) => ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(minutesAgo) } });

  it('needs an insulin user to have a reading from the last 30 minutes', () => {
    expect(gate(insulin, glucose(30), 'restart').kind).toBe('log');
    const stale = gate(insulin, glucose(30 + 1 / 60), 'restart');
    expect(stale.kind).toBe('checkIn');
    expect(stale.permission.release).toBe('Check your glucose now and add the reading.');
    // Sets logged without a break keep the live question: the reading merely ageing does not stop them.
    expect(gate(insulin, glucose(30 + 1 / 60), 'live').kind).toBe('log');
  });

  it("needs today's check-in, and holds for an unreviewed profile, as a start does", () => {
    expect(gate(plain, undefined, 'restart')).toMatchObject({ kind: 'checkIn', permission: { reasons: [PERMISSION_TEXT.noCheckIn] } });
    expect(gate(plain, ci({ date: '2026-10-08' }), 'restart').kind).toBe('checkIn');
    expect(gate(plain, undefined, 'live').kind).toBe('log');
    const held = gate({ ...plain, needsHealthReview: true }, ci(), 'restart');
    expect(held.kind).toBe('stop');
    expect(held.permission.reasons).toContain(PERMISSION_TEXT.healthUnreviewed);
  });
});

describe('which question a workout asks', () => {
  it('follows where the workout stands', () => {
    expect(stageOf({ begun: false, live: false, afterTheFact: false })).toBe('start');
    expect(stageOf({ begun: true, live: false, afterTheFact: false })).toBe('restart');
    expect(stageOf({ begun: true, live: true, afterTheFact: false })).toBe('live');
    // A past day written down afterwards is not exercise, whatever its record says.
    expect(stageOf({ begun: false, live: false, afterTheFact: true })).toBe('record');
    expect(stageOf({ begun: true, live: false, afterTheFact: true })).toBe('record');
    expect(stageOf({ begun: true, live: true, afterTheFact: true })).toBe('record');
  });

  it('takes a set more than 30 minutes after the last as a restart: the sitting has ended (M-04)', () => {
    const t = NOW.getTime();
    const w = { begun: true, live: true, afterTheFact: false, lastSetAt: t };
    expect(stageOf(w, new Date(t + 30 * 60_000))).toBe('live');
    expect(stageOf(w, new Date(t + 30 * 60_000 + 1))).toBe('restart');
    expect(stageOf({ ...w, live: false }, new Date(t + 60_000))).toBe('restart');
  });
});

describe('a sitting broken by a long gap (M-04)', () => {
  it('asks an insulin user for a fresh reading for a set three hours after the last', () => {
    const profile = createDefaultProfile(insulin);
    const c = ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: new Date(2026, 9, 9, 9, 55).toISOString() } });
    const clinical = { profile, checkIns: [{ ...c, readiness: evaluateCheckIn(profile, c) }] };
    const w = { begun: true, live: true, afterTheFact: false, lastSetAt: new Date(2026, 9, 9, 10, 0).getTime() };
    expect(setGate(w, clinical, new Date(2026, 9, 9, 10, 20)).kind).toBe('log');
    const later = setGate(w, clinical, new Date(2026, 9, 9, 13, 0));
    expect(later.kind).toBe('checkIn');
    expect(later.permission.reasons.join(' ')).toMatch(/within 30 minutes of starting/);
  });
});

describe("the gate's input: every day's effective check-in (re-audit B04)", () => {
  afterEach(() => resetPendingCheckInsForTests());
  const profile = createDefaultProfile(plain);
  const record = (c: DailyCheckIn): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(profile, c) });
  const chest = { urgentSymptoms: true, emergency: ['chest'] as EmergencyFlag[] };
  /** A write the device refuses, as a full one does: the answer waits, unstored. */
  const refuse = (stored: CheckInRecord[], answers: DailyCheckIn) => saveCheckInRecord(answers, {
    profile,
    update: async updater => { updater({ checkIns: stored } as AppData); return { ok: false }; },
  });
  /** What `useGuided(date)` hands the screen. */
  const guided = (stored: CheckInRecord[]) => ({ profile, checkIns: effectiveCheckIns(stored, profile) });
  const stops = (input: PermissionInput) => {
    for (const stage of ['start', 'restart', 'live'] as const) {
      expect(logGate(input, stage)).toMatchObject({ kind: 'stop', permission: { disposition: 'emergency' } });
    }
  };

  it('stops logging for chest pain the device refused to store', async () => {
    const stored = [record(ci())];
    await refuse(stored, ci(chest));
    const input = gateInputFor(guided(stored), NOW);
    expect(input.checkIn).toMatchObject({ date: DATE, emergency: ['chest'] });
    stops(input);
    // From the stored records alone, as the screen once read them, logging carried on.
    expect(logGate({ profile, now: NOW, checkIn: stored[0], recent: stored }, 'live').kind).toBe('log');
  });

  it('keeps a refused 23:59 emergency at 00:01, though nothing is answered for the new day yet', async () => {
    const stored = [record(ci({ date: '2026-10-08' }))];
    await refuse(stored, ci({ date: '2026-10-08', ...chest }));
    const justAfterMidnight = new Date(2026, 9, 9, 0, 1, 0);
    const input = gateInputFor(guided(stored), justAfterMidnight);
    expect(input.checkIn).toBeUndefined();
    stops(input);
    // With the stored records as `recent`, the refused answer vanished at midnight.
    expect(logGate({ profile, now: justAfterMidnight, recent: stored }, 'live').kind).toBe('log');
  });

  it("is today's for a workout carried over from yesterday", async () => {
    const stored = [record(ci({ date: '2026-10-08' })), record(ci())];
    await refuse(stored, ci(chest));
    const input = gateInputFor(guided(stored), NOW);
    expect(input.checkIn).toMatchObject({ date: DATE, emergency: ['chest'] });
    expect(input.recent?.map(c => c.date)).toEqual(['2026-10-08', DATE]);
    stops(input);
  });
});

describe('a past day written down afterwards', () => {
  it("asks nothing of today's check-in, whatever it says", () => {
    expect(gate(plain, undefined, 'start').kind).toBe('checkIn');
    const profile = createDefaultProfile(plain);
    const stopped = { ...ci({ news: ['dizzy'] }), readiness: evaluateCheckIn(profile, ci({ news: ['dizzy'] })) };
    for (const c of [undefined, stopped]) {
      const g = logGate({ profile, now: NOW, ...(c ? { checkIn: c } : {}) }, 'record');
      expect(g).toMatchObject({ kind: 'log', permission: { reasons: [], restrictions: [] } });
    }
  });
});

describe('another workout on a rest day', () => {
  const restDay = { focus: 'rest', exercises: [] } as Pick<SessionPlan, 'focus' | 'exercises'>;
  const p = (c?: DailyCheckIn) => gate(plain, c, 'start').permission;

  it('is offered on a scheduled rest or recovery day unless today rules training out', () => {
    expect(offersOtherWorkout(restDay, p())).toBe(true);
    expect(offersOtherWorkout({ ...restDay, focus: 'activeRecovery' }, p(ci()))).toBe(true);
    expect(offersOtherWorkout(restDay, p(ci({ news: ['dizzy'] })))).toBe(false);
  });

  it('is not offered on a training day the check-in turned into recovery', () => {
    expect(offersOtherWorkout({ focus: 'lowerA', exercises: [] }, p(ci()))).toBe(false);
  });
});
