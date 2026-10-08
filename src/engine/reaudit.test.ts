/**
 * Codex's re-audit (docs/reimagine/codex-safety-reaudit.md): the ten cases
 * that must fail closed before the engine may gate real movement, one named
 * test each, plus the findings' own triggers.
 *
 * The UI-level cases run the real state machines — the sheet's `sheetState`,
 * the player's `gate`, the save callback's merge — in node, the way Codex's
 * probes drove the actual callbacks.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn, Mode } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { evaluateCheckIn } from './readiness';
import { permission, resumePermission, type Permission } from './permission';
import { buildSessionPlan } from './session';
import { buildCheckIn, carryForward, emptyForm, formFromRecord, visibleQuestions } from '@/components/checkin/form';
import { afterSave as afterSaveSeq, openSheet, sheetGate, type SheetContext, type SheetState } from '@/components/checkin/sheetState';
import { bpReadingId, glucoseReadingId } from './readiness';
import type { EpisodeAnswer } from '@/types/checkin';

// One save at a time here, so each completes as the latest.
const afterSave = (s: SheetState, o: { record: CheckInRecord; stored: boolean }, c: SheetContext) => afterSaveSeq(s, o, c, s.seq);
const sheetPermission = (s: SheetState, c: SheetContext) => sheetGate(s, c)?.permission;
const answer = (kind: EpisodeAnswer['kind'], readings: string[], resolution: EpisodeAnswer['resolution']): EpisodeAnswer =>
  ({ kind, readings, resolution, at: new Date(2026, 9, 9, 9, 0).toISOString() });
import { afterSymptomReport, arrivalGate, blockedSteps, liveGate, startGate } from '@/session/gate';
import { effectiveCheckIn } from '@/hooks/useGuided';

const DATE = '2026-10-09';
const NOW = new Date(2026, 9, 9, 9, 0, 0);
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const MODES: Mode[] = ['guided', 'stretch', 'walk'];

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, bpMonitor: true };
const P = {
  insulin: { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } },
  lowRisk: { health: { ...known, diabetes: 'type2', metformin: true } },
  sglt2: { health: { ...known, diabetes: 'type2', sglt2i: true, ketoneTest: 'blood' } },
  plain: { health: { ...known } },
  eye: { health: { ...known, retinopathy: 'recent_eye_treatment' } },
  foot: { health: { ...known, diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' } },
  back: { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: false }, health: { ...known } },
} satisfies Record<string, ProfileInput>;
const profile = (p: ProfileInput): UserProfile => createDefaultProfile(p);

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over,
});
const mg = (value: number, minutesAgo = 2) => ({ value, unit: 'mg/dL' as const, measuredAt: at(minutesAgo) });
const rec = (p: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[] = []): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c, recent) });
const ask = (p: ProfileInput, c: DailyCheckIn | undefined, mode: Mode = 'guided', now = NOW) => {
  const pr = profile(p);
  return permission({ profile: pr, ...(c ? { checkIn: rec(pr, c) } : {}), now }, mode);
};
const refusedEverywhere = (p: ProfileInput, c: DailyCheckIn, disposition: Permission['disposition']) =>
  expect(MODES.map(m => ({ m, ...ask(p, c, m) })).map(x => [x.m, x.allowed, x.disposition]))
    .toEqual(MODES.map(m => [m, false, disposition]));

/** The sheet's save, as `useGuided` does it: merge with the day, then evaluate the merged record. */
function saveThrough(p: UserProfile, stored: CheckInRecord | undefined, answers: DailyCheckIn, stored2 = true) {
  const merged = carryForward(stored, answers);
  const record = { ...merged, readiness: evaluateCheckIn(p, merged) };
  return { record, stored: stored2 };
}

const ctxFor = (p: ProfileInput, now = NOW, mode: Mode = 'guided'): SheetContext => ({ profile: profile(p), date: DATE, mode, now });

describe('Codex re-audit: the ten cases that must fail closed', () => {
  it('1. Save 140 at 09:00, wait to 09:31, change another answer and resubmit without a new measurement: the reading keeps 09:00 and an insulin user stays held; a same-measurement unit correction creates no earlier low', () => {
    const p = profile(P.insulin);
    const ctx: SheetContext = { profile: p, date: DATE, mode: 'guided', now: NOW };
    // 09:00: 140 mg/dL, no time typed.
    const first = buildCheckIn({ ...emptyForm(p), emergency: [], glucose: '140' }, { date: DATE, profile: p, now: NOW });
    expect(first.glucose?.measuredAt).toBe(NOW.toISOString());
    let state = afterSave(openSheet(ctx, undefined), saveThrough(p, undefined, first), ctx);

    // 09:31, same sheet: Start refuses the stale reading.
    const at0931 = later(31);
    const late: SheetContext = { ...ctx, now: at0931 };
    expect(sheetPermission(state, late)).toMatchObject({ allowed: false, needsCheckIn: true });

    // Change answers, touch something else, resubmit with the reading untouched.
    const answers = buildCheckIn({ ...state.form, sleep: '5to7' }, { date: DATE, profile: p, now: at0931, previous: state.record });
    expect(answers.glucose?.measuredAt, 'an unchanged reading keeps its own time').toBe(NOW.toISOString());
    expect(answers.glucoseEarlier ?? []).toEqual([]);
    state = afterSave(state, saveThrough(p, state.record, answers), late);
    expect(sheetPermission(state, late)).toMatchObject({ allowed: false, needsCheckIn: true });

    // A mistyped 5.5 mg/dL corrected to mmol/L in the same opening is one reading, not a past low.
    const typo = buildCheckIn({ ...emptyForm(p), emergency: [], glucose: '5.5' }, { date: DATE, profile: p, now: NOW });
    let s2 = afterSave(openSheet(ctx, undefined), saveThrough(p, undefined, typo), ctx);
    const fixed = buildCheckIn({ ...s2.form, unit: 'mmol/L' }, { date: DATE, profile: p, now: later(1), previous: s2.record });
    expect(fixed.glucose).toEqual({ ...typo.glucose, unit: 'mmol/L' });
    expect(fixed.glucoseEarlier ?? []).toEqual([]);
    s2 = afterSave(s2, saveThrough(p, s2.record, fixed), ctx);
    expect(s2.record?.readiness.disposition).not.toBe('today');
  });

  it('2. Resume with the required glucose missing or stale, or no check-in and recent eye treatment, holds; the Start tap is checked again; a new emergency stops a mounted session', () => {
    const insulin = profile(P.insulin);
    const stale = { profile: insulin, checkIn: rec(insulin, ci({ glucose: mg(140, 180) })), now: NOW };
    expect(arrivalGate(stale, 'guided', true), 'R01').toMatchObject({ allowed: false, disposition: 'hold' });
    expect(arrivalGate({ profile: insulin, now: NOW }, 'guided', true), 'R02').toMatchObject({ allowed: false });
    const eye = profile(P.eye);
    expect(arrivalGate({ profile: eye, now: NOW }, 'guided', true), 'R03').toMatchObject({ allowed: false, disposition: 'hold' });
    expect(resumePermission({ profile: eye, now: NOW }, 'guided'), 'R03 through resumePermission').toMatchObject({ allowed: false });

    // P03: the ready screen sat open until the reading went stale.
    const ok = { profile: insulin, checkIn: rec(insulin, ci({ glucose: mg(140, 0) })), now: NOW };
    expect(startGate(ok, 'guided').allowed).toBe(true);
    expect(startGate({ ...ok, now: later(31) }, 'guided')).toMatchObject({ allowed: false, needsCheckIn: true });

    // P04: a new emergency arrives while the player is mounted.
    const emergency = rec(insulin, ci({ emergency: ['chest'], glucose: mg(140, 0) }));
    expect(liveGate({ profile: insulin, checkIn: emergency, now: NOW }, 'guided')).toMatchObject({ allowed: false, disposition: 'emergency' });
    // Uninterrupted exercise is not cut off just because the reading aged.
    expect(liveGate({ profile: insulin, checkIn: rec(insulin, ci({ glucose: mg(140, 180) })), now: NOW }, 'guided')).toBeUndefined();
  });

  it('3. A retained 50 mg/dL while the sheet holds an old normal record: permission, button and saved record all say today; a failed emergency write survives closing and reopening', () => {
    const p = profile(P.insulin);
    const ctx = ctxFor(P.insulin);
    const old = rec(p, ci({ glucose: mg(110, 10) }));
    let state = openSheet(ctx, old);
    // Another save lands a level 2 low while this sheet is open.
    const storedNow = rec(p, ci({ glucose: mg(50, 5) }));
    const answers = buildCheckIn(state.form, { date: DATE, profile: p, now: NOW, previous: old });
    state = afterSave(state, saveThrough(p, storedNow, answers), ctx);
    expect(state.record?.readiness.disposition, 'the merged record keeps the low').toBe('today');
    expect(sheetPermission(state, ctx)).toMatchObject({ allowed: false, disposition: 'today' });

    // F05: the emergency write fails; the answer still counts after reopening.
    const emergencyAnswers = buildCheckIn({ ...state.form, emergency: ['chest'] }, { date: DATE, profile: p, now: NOW, previous: state.record });
    const failed = saveThrough(p, old, emergencyAnswers, false);
    state = afterSave(state, failed, ctx);
    expect(state.unsaved).toBe(true);
    expect(sheetPermission(state, ctx)).toMatchObject({ allowed: false, disposition: 'emergency' });
    // Reopened from the day's durable record, which is still the old normal one.
    const reopened = openSheet(ctx, effectiveCheckIn(old, failed.record, DATE));
    expect(sheetPermission(reopened, ctx)).toMatchObject({ allowed: false, disposition: 'emergency' });
    expect(effectiveCheckIn(old, null, DATE)?.readiness.disposition).not.toBe('emergency');
  });

  it('4. A saved walk with emergency refusal recovers its progress but never runs', () => {
    // The Walk screen is another agent's; the shared answer it must obey is this one.
    const p = profile(P.plain);
    const emergency = rec(p, ci({ emergency: ['chest'] }));
    for (const gate of [
      permission({ profile: p, checkIn: emergency, now: NOW }, 'walk'),
      resumePermission({ profile: p, checkIn: emergency, now: NOW }, 'walk'),
      arrivalGate({ profile: p, checkIn: emergency, now: NOW }, 'walk', true),
      liveGate({ profile: p, checkIn: emergency, now: NOW }, 'walk')!,
    ]) {
      expect(gate).toMatchObject({ allowed: false, disposition: 'emergency' });
    }
  });

  it('5. An archived standing plan is not executed after a foot wound or a new eye restriction, and a saved stretch is judged as a stretch', () => {
    const before = profile(P.lowRisk);
    const plan = buildSessionPlan({ profile: before, date: DATE, startDate: '2026-09-28', sessions: [] });
    expect(plan.kind).toBe('full');
    const standing = plan.steps.filter(s => 'exerciseId' in s).map(s => (s as { exerciseId: string }).exerciseId);
    expect(standing.length).toBeGreaterThan(0);

    const now = profile(P.foot);
    const input = { profile: now, checkIn: rec(now, ci()), now: NOW };
    expect(permission(input, 'guided'), 'the mode is allowed, with restrictions').toMatchObject({ allowed: true });
    const blocked = blockedSteps(plan, input);
    expect(blocked.length, 'weight-bearing work is refused').toBeGreaterThan(0);
    for (const id of blocked) expect(plan.steps.some(s => s.id === id)).toBe(true);

    const eye = profile(P.eye);
    expect(arrivalGate({ profile: eye, checkIn: rec(eye, ci()), now: NOW }, 'guided', true).allowed).toBe(false);

    // F15: a saved stretch asks for stretch permission, not guided.
    const sensory = ci({ back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: true, caudaEquinaFlag: false, newSensory: true, newWeakness: false } });
    const backProfile = profile(P.back);
    const stretchInput = { profile: backProfile, checkIn: rec(backProfile, sensory), now: NOW };
    expect(arrivalGate(stretchInput, 'stretch', true)).toMatchObject({ allowed: true });
    expect(arrivalGate(stretchInput, 'guided', true)).toMatchObject({ allowed: false });
  });

  it('6. A low reported inside the player allows no movement before a usable timed recheck and confirmation; a persistent level 1 ends the attempt; a missing old time proves nothing', () => {
    // The player saves the reading through the same check-in path, so the engine decides.
    const p = profile(P.insulin);
    const low = rec(p, ci({ glucose: mg(65, 0) }));
    expect(liveGate({ profile: p, checkIn: low, now: NOW }, 'guided')).toMatchObject({ allowed: false, disposition: 'hold' });

    // Treated, re-checked 16 minutes later at 95, symptoms gone and plan allows it.
    const recovered = ci({ glucoseEarlier: [mg(65, 16)], glucose: mg(95, 0), lowRecovered: true });
    expect(ask(P.insulin, recovered).allowed).toBe(true);
    // Still under 70 at the first re-check: the attempt is over.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [mg(65, 16)], glucose: mg(60, 0) }), 'hold');
    // Level 2 directs contact today.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [mg(50, 20)], glucose: mg(110, 0) }), 'today');
    // L01: the earlier low has no time, so 15 minutes cannot be assumed.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [{ value: 65, unit: 'mg/dL' }], glucose: mg(95, 0), lowRecovered: true }), 'hold');
  });

  it('7. A severe blood pressure reading and its properly timed severe repeat saved separately mean contact today; a lower later entry does not erase it; a partly entered severe component still asks about emergency symptoms', () => {
    // B01: the first severe reading was saved earlier; the repeat comes two minutes later.
    refusedEverywhere(P.plain, ci({ bpEarlier: [{ sys: 190, dia: 80, at: at(3) }], bpReadings: [{ sys: 186, dia: 82, at: at(1) }] }), 'today');
    // A single severe reading still stops today, and keeps asking for a repeat.
    expect(ask(P.plain, ci({ bpReadings: [{ sys: 190, dia: 80, at: at(1) }] }))).toMatchObject({ allowed: false, disposition: 'hold' });
    // Settled as a mis-typed reading, or seen by a clinician.
    expect(ask(P.plain, ci({ bpEarlier: [{ sys: 190, dia: 80, at: at(30) }], bpReadings: [{ sys: 120, dia: 80, at: at(1) }], resolutions: [answer('severeBp', [bpReadingId({ sys: 190, dia: 80, at: at(30) })], 'mistake')] })).allowed).toBe(true);
    expect(ask(P.plain, ci({ bpEarlier: [{ sys: 190, dia: 80, at: at(30) }, { sys: 186, dia: 82, at: at(28) }], resolutions: [answer('severeBp', [bpReadingId({ sys: 190, dia: 80, at: at(30) }), bpReadingId({ sys: 186, dia: 82, at: at(28) })], 'assessed')] })).disposition).toBe('today');
    // B02: the confirmed pair moves into history and a normal reading arrives.
    refusedEverywhere(P.plain, ci({
      bpEarlier: [{ sys: 190, dia: 80, at: at(30) }, { sys: 186, dia: 82, at: at(28) }],
      bpReadings: [{ sys: 120, dia: 80, at: at(1) }],
    }), 'today');
    // B04: only the systolic box is filled, and it is severe.
    const p = profile(P.plain);
    const form = { ...emptyForm(p), emergency: [], bp: { s1: '190', d1: '', s2: '', d2: '' } };
    expect(visibleQuestions(p, form).bpSymptoms, 'the emergency question is asked').toBe(true);
    // The sheet marks the toggle answered when it is touched; untouched, it says nothing.
    const withSymptom = { ...form, bpSymptoms: true, answered: { bpSymptoms: true as const }, bp: { s1: '190', d1: '110', s2: '', d2: '' } };
    expect(ask(P.plain, buildCheckIn(withSymptom, { date: DATE, profile: p, now: NOW })).disposition).toBe('emergency');
  });

  it('8. A reliable 600 mg/dL or ketones 3.0 replaced by a normal entry keeps its help action until it is settled, and a genuine high mmol/L gets the same answer as its mg/dL equivalent', () => {
    // G01: the extreme reading is still unresolved.
    refusedEverywhere(P.lowRisk, ci({ glucoseEarlier: [mg(600, 3)], glucose: mg(110, 0) }), 'emergency');
    // Said to be a typing mistake: gone. Assessed by a clinician: no exercise today, no emergency call.
    expect(ask(P.lowRisk, ci({ glucoseEarlier: [mg(600, 3)], glucose: mg(110, 0), resolutions: [answer('extremeGlucose', [glucoseReadingId(mg(600, 3))], 'mistake')] })).allowed).toBe(true);
    expect(ask(P.lowRisk, ci({ glucoseEarlier: [mg(600, 3)], glucose: mg(110, 0), resolutions: [answer('extremeGlucose', [glucoseReadingId(mg(600, 3))], 'assessed')] })).disposition).toBe('today');
    // K01/K02: the same for ketones.
    refusedEverywhere(P.sglt2, ci({ ketonesEarlier: [{ kind: 'blood', value: 3.0, measuredAt: at(3) }], ketones: { kind: 'blood', value: 0.1, measuredAt: at(0) } }), 'emergency');
    refusedEverywhere(P.sglt2, ci({
      ketonesEarlier: [{ kind: 'blood', value: 0.8, measuredAt: at(3) }], ketones: { kind: 'blood', value: 0.1, measuredAt: at(0) }, news: ['unwell'],
    }), 'today');
    // G02/G03: 650 mg/dL and the same reading in mmol/L.
    refusedEverywhere(P.lowRisk, ci({ glucose: mg(650, 0) }), 'emergency');
    const confirmed = ci({ glucose: { value: 650 / 18, unit: 'mmol/L', measuredAt: at(0), unitConfirmed: true } });
    refusedEverywhere(P.lowRisk, confirmed, 'emergency');
    // Until the unit is confirmed it holds, and says what it would mean either way.
    const unconfirmed = ask(P.lowRisk, ci({ glucose: { value: 650 / 18, unit: 'mmol/L', measuredAt: at(0) } }));
    expect(unconfirmed.allowed).toBe(false);
    expect(unconfirmed.reasons.join(' ')).toMatch(/mmol\/L/);
  });

  it('9. An SGLT2 inhibitor without diabetes can record ketones 3.0 and is refused, and a prescribed fluid limit with no kidney disease gets no extra-fluid advice', () => {
    const heart: ProfileInput = { health: { ...known, sglt2i: true, heartOrVascularDisease: true, ketoneTest: 'blood' } };
    const p = profile(heart);
    const v = visibleQuestions(p, emptyForm(p));
    expect(v.ketones, 'ketone entry is offered without diabetes').toBe('blood');
    const form = { ...emptyForm(p), emergency: [], bloodKetones: '3' };
    const saved = buildCheckIn(form, { date: DATE, profile: p, now: NOW });
    expect(saved.ketones, 'the reading is kept').toMatchObject({ kind: 'blood', value: 3 });
    refusedEverywhere(heart, saved, 'emergency');

    const limited: ProfileInput = { health: { ...known, heartOrVascularDisease: true, fluidRestriction: true } };
    const dizzy = ci({ news: ['dizzy'], bpReadings: [{ sys: 85, dia: 55, at: at(1) }] });
    const r = evaluateCheckIn(profile(limited), dizzy);
    expect(r.actions.join(' ')).not.toMatch(/have a drink|drink water|sip fluids|extra fluids/i);
    expect(r.actions.join(' ') + r.notices.join(' ')).toMatch(/fluid plan/i);
    // Without a restriction recorded, the advice stays conditional rather than absent.
    const open = evaluateCheckIn(profile(P.plain), dizzy);
    expect((open.actions.join(' ') + open.notices.join(' ')).toLowerCase()).toMatch(/fluid limit|drink/);
  });

  it('10. Distal spread reported at a player checkpoint stops the provoking work and takes the higher pathway, with no pain-number clearance', () => {
    const p = profile(P.back);
    const before = rec(p, ci({ back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } }));
    // The checkpoint's answers go through the same check-in path.
    const spread = buildCheckIn(
      { ...formFromRecord(before, p), back: { ...formFromRecord(before, p).back, reach: 'belowKnee', worseFunction: true } },
      { date: DATE, profile: p, now: NOW, previous: before },
    );
    const after = rec(p, spread);
    const input = { profile: p, checkIn: after, now: NOW };
    // The provoking movement stops now: either the session halts, or that exercise is dropped.
    const response = afterSymptomReport(input, 'guided', 'barbell-back-squat');
    expect(!!response.halt || response.skip.includes('barbell-back-squat')).toBe(true);
    expect(permission(input, 'guided').restrictions.join(' ')).toMatch(/no progression|stop/i);
    // New weakness at the same checkpoint takes the higher pathway, whatever the pain score.
    const weakness = buildCheckIn(
      { ...formFromRecord(before, p), back: { ...formFromRecord(before, p).back, pain: 0, legPain: 0, newWeakness: true } },
      { date: DATE, profile: p, now: NOW, previous: before },
    );
    refusedEverywhere(P.back, weakness, 'today');
  });
});

describe('Codex re-audit: copy the findings name', () => {
  it('does not tell a LO reading it is below 54', () => {
    const r = evaluateCheckIn(profile(P.insulin), ci({ glucoseDisplay: { display: 'LO', measuredAt: at(1) } }));
    const text = r.reasons.map(x => x.message).join(' ');
    expect(text).toMatch(/LO/);
    expect(text).not.toMatch(/below 54/);
  });

  it('gives no unsourced waiting time for new tingling or numbness', () => {
    const p = profile(P.back);
    const r = evaluateCheckIn(p, ci({ back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: true, caudaEquinaFlag: false, newSensory: true, newWeakness: false } }));
    expect(r.reasons.map(x => x.message).join(' ')).not.toMatch(/few days/i);
  });

  it('never calls a glucose reading in or out of target, which needs a context this check-in does not hold', () => {
    const r = evaluateCheckIn(profile(P.lowRisk), ci({ glucose: mg(200, 1) }));
    expect((r.actions.join(' ') + r.reasons.map(x => x.message).join(' ')).toLowerCase()).not.toMatch(/above target|in target|out of target/);
  });
});

describe('Codex re-audit: the findings’ own triggers', () => {
  it('F02: the three gates ask three different questions', () => {
    const p = profile(P.insulin);
    const stale = { profile: p, checkIn: rec(p, ci({ glucose: mg(140, 180) })), now: NOW };
    // Starting or restarting needs the reading D29(6) asks for; carrying on does not.
    expect(permission(stale, 'guided').allowed).toBe(false);
    expect(arrivalGate(stale, 'guided', true).allowed).toBe(false);
    expect(startGate(stale, 'guided').allowed).toBe(false);
    expect(liveGate(stale, 'guided')).toBeUndefined();
    // A profile rule refuses all three, with or without a check-in.
    const eye = { profile: profile(P.eye), now: NOW };
    expect([permission(eye, 'guided').allowed, resumePermission(eye, 'guided').allowed, !!liveGate(eye, 'guided')]).toEqual([false, false, true]);
  });

  it('F07: an archived plan’s head-down and standing work is refused when the profile changes under it', () => {
    const before = profile(P.lowRisk);
    const plan = buildSessionPlan({ profile: before, date: DATE, startDate: '2026-09-28', sessions: [] });
    const unchanged = { profile: before, checkIn: rec(before, ci()), now: NOW };
    expect(blockedSteps(plan, unchanged), 'nothing is refused while nothing changed').toEqual([]);
    const eye = profile({ health: { ...known, retinopathy: 'severe_or_proliferative' } });
    const now = { profile: eye, checkIn: rec(eye, ci()), now: NOW };
    const blocked = blockedSteps(plan, now);
    for (const id of blocked) expect(plan.steps.some(s => s.id === id)).toBe(true);
    // A symptom report during the session drops that exercise, not the session.
    const response = afterSymptomReport(unchanged, 'guided', 'goblet-squat');
    expect(response).toEqual({ skip: ['goblet-squat'] });
    expect(blockedSteps(plan, unchanged, ['goblet-squat']).length).toBeGreaterThan(0);
  });

  it('F05: an unstored answer counts until a later save lands, and never loosens what is stored', () => {
    const p = profile(P.lowRisk);
    const stored = rec(p, ci({ glucose: mg(110, 5) }));
    const emergency = rec(p, ci({ emergency: ['chest'] }));
    expect(effectiveCheckIn(stored, emergency, DATE)?.readiness.disposition).toBe('emergency');
    // A failed write of something gentler cannot replace a stored stop.
    const stop = rec(p, ci({ glucose: mg(50, 5) }));
    expect(effectiveCheckIn(stop, rec(p, ci({ glucose: mg(110, 1) })), DATE)?.readiness.disposition).toBe('today');
    // Yesterday's draft is not today's answer.
    expect(effectiveCheckIn(stored, { ...emergency, date: '2026-10-08' }, DATE)).toBe(stored);
  });

  it('F09: the urgent symptom question follows a severe number in any single box', () => {
    const p = profile(P.plain);
    const form = emptyForm(p);
    expect(visibleQuestions(p, { ...form, bp: { s1: '', d1: '125', s2: '', d2: '' } }).bpSymptoms).toBe(true);
    expect(visibleQuestions(p, { ...form, bp: { s1: '150', d1: '', s2: '', d2: '' } }).bpSymptoms).toBe(false);
    // And it keeps asking once such a reading is on the day's record.
    const saved = rec(p, ci({ bpReadings: [{ sys: 190, dia: 80, at: at(20) }] }));
    expect(visibleQuestions(p, emptyForm(p), saved).bpSymptoms).toBe(true);
  });

  it('F10, F11: the sheet is told which earlier reading is still unsettled', () => {
    const p = profile(P.sglt2);
    const saved = rec(p, ci({ glucoseEarlier: [mg(600, 20)], glucose: mg(120, 1), ketonesEarlier: [{ kind: 'blood', value: 3, measuredAt: at(20) }] }));
    expect(saved.readiness.unresolved).toEqual(expect.arrayContaining(['extremeGlucose', 'ketones']));
    expect(visibleQuestions(p, emptyForm(p), saved).episodes.map(e => e.kind)).toEqual(expect.arrayContaining(['extremeGlucose', 'ketones']));
    // Answering it is kept with the day, and a later save does not forget it.
    const mistake = answer('extremeGlucose', [glucoseReadingId(mg(600, 20))], 'mistake');
    const form = { ...formFromRecord(saved, p), resolutions: [mistake] };
    const next = buildCheckIn(form, { date: DATE, profile: p, now: NOW, previous: saved });
    expect(next.resolutions).toEqual([mistake]);
    const nextRecord: CheckInRecord = { ...next, readiness: saved.readiness };
    const again = buildCheckIn(formFromRecord(nextRecord, p), { date: DATE, profile: p, now: NOW, previous: nextRecord });
    expect(again.resolutions).toEqual([mistake]);
  });

  it('decision 8: a reading stamped in the future is refused whatever the medicines', () => {
    const soon = (minutes: number) => ({ value: 140, unit: 'mg/dL' as const, measuredAt: new Date(NOW.getTime() + minutes * 60_000).toISOString() });
    for (const p of [P.lowRisk, P.insulin]) {
      expect(ask(p, ci({ glucose: soon(10) })), 'a future reading').toMatchObject({ allowed: false });
      expect(ask(p, ci({ glucose: soon(1) })).allowed, 'a little clock drift').toBe(true);
    }
  });
});
