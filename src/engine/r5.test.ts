/**
 * Codex's final safety reconciliation (docs/reimagine/codex-final-reconcile-safety.md),
 * each finding as it reproduced it, through the real engine, gates, Today's
 * recommendation, the walk's history and the player's plan reconciliation.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { BpReading, CheckInRecord, DailyCheckIn, EpisodeAnswer, EpisodeResolution, NewsItem, RedFlag } from '@/types/checkin';
import type { CardioStep, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { evaluateCheckIn, profileOnlyReadiness, withLogged } from './readiness';
import { permission, resumePermission } from './permission';
import { buildSessionPlan } from './session';
import { answerEpisode, buildCheckIn, carryForward, emptyForm, episodeChoice, formFromRecord, visibleQuestions, type CheckInForm } from '@/components/checkin/form';
import { effectiveRecord, resetPendingCheckInsForTests, saveCheckInRecord, withPressureCorrected, withReadingRemoved } from '@/components/checkin/pending';
import { reconcilePlan } from '@/session/gate';
import { reachableHistory } from '@/walk/gate';
import { recommend } from '@/health/recommend';
import { planFor } from '@/hooks/useGuided';
import { formatTime } from '@/lib/time';

const D = '2026-10-08';
const Y = '2026-10-07';
const NOW = new Date(2026, 9, 8, 9, 30);
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m, 0).toISOString();
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const };
const ci = (date: string, over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
const record = (p: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[] = []): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c, recent) });
const ask = (p: UserProfile, today: DailyCheckIn | undefined, earlier: DailyCheckIn[], mode: 'guided' | 'stretch' | 'walk', now = NOW) =>
  permission({ profile: p, ...(today ? { checkIn: record(p, today, earlier) } : {}), now, recent: earlier }, mode);
const answer = (kind: EpisodeAnswer['kind'], id: string, resolution: EpisodeResolution): EpisodeAnswer => ({ kind, readings: [id], resolution, at: at(8, 9, 20) });

const BACK = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: known });
const quietBack = { pain: 2, legPain: 2, reach: 'foot' as const, newNeuro: false, newWeakness: false, weaknessFast: false, newSensory: false, feverish: false, suddenSevere: false, worseFunction: false, caudaEquinaFlag: false };
const METFORMIN = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true } });
const INSULIN = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } });
const BP = createDefaultProfile({ health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } });
const g = (value: number, day: number, h: number, m = 0) => ({ value, unit: 'mg/dL' as const, measuredAt: at(day, h, m), source: 'meter' as const });

describe('R5-01: a red flag or foot problem stays until its own release is given', () => {
  const footDrop = { ...quietBack, newWeakness: true, newNeuro: true };
  it('a foot drop said at 09:00 is not released by "None" at 10:00 the same day', () => {
    const morning = ci(D, { back: footDrop });
    const later = carryForward(morning, ci(D, { back: quietBack }));
    expect(ask(BACK, later, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    const flag = evaluateCheckIn(BACK, later, [], NOW).episodes?.flatMap(e => e.readings).find(r => /foot drop/i.test(r.label));
    expect(flag?.id).toBe(`flag:newWeakness@${D}`);
    expect(ask(BACK, { ...later, resolutions: [answer('redFlag', flag!.id, 'assessed')] }, [], 'walk').allowed).toBe(true);
  });

  it('a foot sore said earlier today is not released by unticking it', () => {
    const later = carryForward(ci(D, { news: ['footProblem'] }), ci(D));
    expect(ask(METFORMIN, later, [], 'walk').allowed).toBe(false);
    expect(ask(METFORMIN, { ...later, resolutions: [answer('foot', `flag:footProblem@${D}`, 'resolved')] }, [], 'walk').allowed).toBe(true);
  });

  it('a foot drop, fever or sudden back pain needs a clinician, or "I ticked it by mistake"; "It has gone" is no release', () => {
    for (const [flag, back] of [['newWeakness', footDrop], ['backFever', { ...quietBack, feverish: true }], ['backSudden', { ...quietBack, suddenSevere: true }]] as const) {
      const yesterday = ci(Y, { back });
      const today = (resolution: EpisodeResolution) => ci(D, { back: quietBack, resolutions: [answer('redFlag', `flag:${flag}@${Y}`, resolution)] });
      expect(ask(BACK, today('resolved'), [yesterday], 'walk').allowed, `${flag} resolved`).toBe(false);
      expect(ask(BACK, today('assessed'), [yesterday], 'walk').allowed, `${flag} assessed`).toBe(true);
      expect(ask(BACK, today('mistake'), [yesterday], 'walk').allowed, `${flag} mistake`).toBe(true);
    }
  });

  it('a hot, swollen foot needs a clinician; a sore may also heal', () => {
    const today = (flag: string, resolution: EpisodeResolution) => ci(D, { resolutions: [answer('foot', `flag:${flag}@${Y}`, resolution)] });
    expect(ask(METFORMIN, today('hotSwollenFoot', 'resolved'), [ci(Y, { news: ['hotSwollenFoot'] })], 'walk').allowed).toBe(false);
    expect(ask(METFORMIN, today('hotSwollenFoot', 'assessed'), [ci(Y, { news: ['hotSwollenFoot'] })], 'walk').allowed).toBe(true);
    expect(ask(METFORMIN, today('footProblem', 'resolved'), [ci(Y, { news: ['footProblem'] })], 'walk').allowed).toBe(true);
  });

  it('one unticked yesterday and never released is still carried today', () => {
    const yesterday = ci(Y, { back: quietBack, flagsEarlier: ['newWeakness'] });
    expect(ask(BACK, ci(D, { back: quietBack }), [yesterday], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });

  it('the sheet is told which answers settle each one', () => {
    const r = evaluateCheckIn(METFORMIN, ci(D), [ci(Y, { news: ['hotSwollenFoot', 'footProblem'] })], NOW);
    const by = Object.fromEntries((r.episodes ?? []).flatMap(e => e.readings).map(x => [x.id, x.accepts]));
    expect(by[`flag:hotSwollenFoot@${Y}`]).toEqual(['assessed', 'mistake']);
    expect(by[`flag:footProblem@${Y}`]).toEqual(['resolved', 'assessed', 'mistake']);
  });
});

describe('R5-02: a refused save cannot loosen what the device holds, whichever way the ranks fall', () => {
  it('new tingling stored, then "hot" waiting with the tingling gone: guided stays refused, and the heat counts', () => {
    const stored = record(BACK, ci(D, { back: { ...quietBack, newSensory: true, newNeuro: true } }));
    const pending = record(BACK, ci(D, { back: quietBack, news: ['hot'] }));
    const effective = effectiveRecord(stored, pending, BACK)!;
    expect(permission({ profile: BACK, checkIn: effective, now: NOW, recent: [] }, 'guided').allowed).toBe(false);
    expect(evaluateCheckIn(BACK, effective, [], NOW).modifiers).toContain('HEAT');
  });

  it('equal ranks, different restrictions: the heat stored and a low reported in the waiting save both count', () => {
    const stored = record(INSULIN, ci(D, { glucose: g(140, 8, 9, 20), news: ['hot'] }));
    const pending = record(INSULIN, ci(D, { glucose: g(140, 8, 9, 20), news: ['lowOne'] }));
    expect(evaluateCheckIn(INSULIN, effectiveRecord(stored, pending, INSULIN)!, [], NOW).modifiers).toEqual(expect.arrayContaining(['HEAT', 'HYPO']));
  });

  it('a foot sore stored, then "hot" waiting without it: walking stays refused (Codex’s sequence)', () => {
    const stored = record(METFORMIN, ci(D, { news: ['footProblem'] }));
    const pending = record(METFORMIN, ci(D, { news: ['hot'] }));
    const effective = effectiveRecord(stored, pending, METFORMIN)!;
    expect(permission({ profile: METFORMIN, checkIn: effective, now: NOW, recent: [] }, 'walk').allowed).toBe(false);
  });
});

describe('R5-03: an older reading entered later does not clear a later unsafe one', () => {
  it('320 at 09:10, then 140 timed 09:00: still held', () => {
    const today = ci(D, { glucose: g(140, 8, 9, 0), glucoseEarlier: [g(320, 8, 9, 10)] });
    expect(ask(METFORMIN, today, [], 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(evaluateCheckIn(METFORMIN, today, [], NOW).reasons.map(r => r.code)).toContain('high');
  });

  it('170/105 at 09:10, then 120/80 timed 09:00: still held', () => {
    const today = ci(D, { bpReadings: [{ sys: 120, dia: 80, at: at(8, 9, 0) }], bpEarlier: [{ sys: 170, dia: 105, at: at(8, 9, 10) }] });
    expect(ask(BP, today, [], 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
  });

  it('a later reading still answers an earlier one, and an untimed current reading keeps its place', () => {
    expect(ask(METFORMIN, ci(D, { glucose: g(140, 8, 9, 20), glucoseEarlier: [g(320, 8, 9, 10)] }), [], 'walk').allowed).toBe(true);
    expect(ask(METFORMIN, ci(D, { glucose: { value: 320, unit: 'mg/dL' }, glucoseEarlier: [g(140, 8, 9, 10)] }), [], 'walk').allowed).toBe(false);
  });
});

describe('R5-04: a restored plan never keeps more cardio than the fresh plan prescribes', () => {
  const input = { profile: INSULIN, checkIn: record(INSULIN, ci(D, { glucose: g(140, 8, 9, 20) })), now: NOW, recent: [] };
  const base = buildSessionPlan({ profile: INSULIN, date: D, startDate: '2026-09-28', sessions: [], checkIn: ci(D, { glucose: g(140, 8, 9, 20) }), focusOverride: 'upperB' });
  const withCardio = (parts: CardioStep['parts']): SessionPlan => ({ ...base, steps: base.steps.map(s => (s.kind === 'cardio' ? { ...s, parts } : s)) });
  const cardioOf = (p: SessionPlan) => p.steps.find((s): s is CardioStep => s.kind === 'cardio')!;

  it('20 minutes steady saved, 5 minutes fresh, the same cool-down: the fresh dose runs', () => {
    const saved = withCardio([{ seconds: 120, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 1200, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }]);
    const fresh = withCardio([{ seconds: 60, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 300, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }]);
    expect(cardioOf(reconcilePlan(saved, 0, fresh, input).plan).parts).toEqual(cardioOf(fresh).parts);
  });

  it('fast efforts saved, tempo fresh: the fresh effort runs', () => {
    const parts = (intensity: 'fast' | 'tempo') => [{ seconds: 120, intensity: 'easy' as const, label: 'Easy' }, { seconds: 60, intensity, label: 'Effort' }, { seconds: 300, intensity: 'cooldown' as const, label: 'Cool-down' }];
    const fresh = withCardio(parts('tempo'));
    expect(cardioOf(reconcilePlan(withCardio(parts('fast')), 0, fresh, input).plan).parts).toEqual(cardioOf(fresh).parts);
  });
});

describe('R5-05: carried urgent ketones keep the emergency instruction', () => {
  it('3.1 blood ketones at 23:55, normal ketones after midnight: emergency assessment now, with the call', () => {
    const night = ci(Y, { ketones: { kind: 'blood', value: 3.1, measuredAt: at(7, 23, 55) } });
    const morning = ci(D, { ketones: { kind: 'blood', value: 0.2, measuredAt: at(8, 0, 20) } });
    const p = ask(METFORMIN, morning, [night], 'walk', new Date(2026, 9, 8, 0, 30));
    expect(p.disposition).toBe('emergency');
    expect(p.reasons.join(' ')).toMatch(/emergency/i);
    expect(p.reasons.join(' ')).toMatch(/do not drive yourself/);
    expect(p.reasons.join(' ')).not.toMatch(/contact them today/);
  });
});

describe('R5-06: a usable severe number counts even when the other number cannot be used', () => {
  it('190/10 with new numbness is an emergency', () => {
    const today = ci(D, { bpReadings: [{ sys: 190, dia: 10, at: at(8, 9, 20) }], back: { ...quietBack, newSensory: true, newNeuro: true } });
    expect(ask(BP, today, [], 'stretch')).toMatchObject({ allowed: false, disposition: 'emergency' });
  });
  it('190/10 alone is still no exercise today, and asks for the reading again', () => {
    const r = evaluateCheckIn(BP, ci(D, { bpReadings: [{ sys: 190, dia: 10, at: at(8, 9, 20) }] }), [], NOW);
    expect(r.reasons.map(x => x.code)).toEqual(expect.arrayContaining(['bpInvalid', 'bpSevereUnconfirmed']));
  });
});

describe('R5-07: a day with only a report does not hide the last emergency answer', () => {
  const D0 = '2026-10-06';
  const chest = ci(D0, { emergency: ['chest'], urgentSymptoms: true });
  const reportOnly: DailyCheckIn = { date: Y, urgentSymptoms: false, news: [], glucose: g(140, 7, 18) };
  it('chest pain on day 1, a glucose report on day 2, nothing since: still an emergency, starting or carrying on', () => {
    expect(ask(METFORMIN, undefined, [chest, reportOnly], 'walk')).toMatchObject({ allowed: false, disposition: 'emergency' });
    expect(resumePermission({ profile: METFORMIN, now: NOW, recent: [chest, reportOnly] }, 'walk')).toMatchObject({ allowed: false, disposition: 'emergency' });
  });
  it('the walk’s short history keeps the day that answered it', () => {
    const records = [record(METFORMIN, chest), record(METFORMIN, reportOnly, [chest])];
    const kept = reachableHistory(records, D, METFORMIN);
    expect(kept.map(r => r.date)).toContain(D0);
    expect(ask(METFORMIN, undefined, kept, 'walk').disposition).toBe('emergency');
  });
});

describe('R5-08: reading the record twice changes nothing', () => {
  it('one logged 650 is one incident, however often the record is read', () => {
    const c = ci(D, { glucose: g(140, 8, 9, 10), logged: { glucose: [g(650, 8, 9, 0)] } });
    expect(withLogged(withLogged(c))).toEqual(withLogged(c));
    expect(withLogged(c).logged).toBeUndefined();
    const readings = (evaluateCheckIn(METFORMIN, c, [], NOW).episodes ?? []).flatMap(e => e.readings);
    expect(readings).toHaveLength(1);
  });

  it('a Track reading the record already holds is not counted twice', () => {
    const c = ci(D, { glucose: g(140, 8, 9, 10), glucoseEarlier: [g(650, 8, 9, 0)], logged: { glucose: [g(650, 8, 9, 0)] } });
    expect((evaluateCheckIn(METFORMIN, c, [], NOW).episodes ?? []).flatMap(e => e.readings)).toHaveLength(1);
    expect(withLogged(c).glucoseEarlier).toHaveLength(1);
  });
});

describe('X2-19: the re-check rule speaks the person’s unit', () => {
  it('still low at the re-check, in mmol/L', () => {
    const mmol = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', glucoseUnit: 'mmol/L' } });
    const mm = (value: number, h: number, m: number) => ({ value, unit: 'mmol/L' as const, measuredAt: at(8, h, m), source: 'meter' as const });
    const r = evaluateCheckIn(mmol, ci(D, { glucose: mm(3.5, 9, 20), glucoseEarlier: [mm(3.4, 9, 0)] }), [], NOW);
    const message = r.reasons.find(x => x.code === 'lowRepeat')?.message ?? '';
    expect(message).toMatch(/3\.9 mmol\/L/);
    expect(message).not.toMatch(/\b70\b/);
  });
});

describe('J2-03: a measured low’s re-check is what is said, with its time', () => {
  const low = ci(D, { news: ['lowSymptoms'], lowSymptomsAt: at(8, 9, 15), glucose: g(62, 8, 9, 20) });
  it('the engine gives the confirmed low’s release, not the suspected one’s', () => {
    expect(evaluateCheckIn(INSULIN, low, [], NOW).release).toMatch(/^Treat it, then re-check in 15 minutes/);
  });
  it('Today’s re-check card says when', () => {
    const rec = record(INSULIN, low);
    const perm = (mode: 'guided' | 'stretch' | 'walk') => permission({ profile: INSULIN, checkIn: rec, now: new Date(2026, 9, 8, 9, 25), recent: [] }, mode);
    const data = { version: 5, settings: { startDate: '' }, sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [rec], focusOverrides: {} } as unknown as Parameters<typeof planFor>[0];
    const r = recommend({ now: new Date(2026, 9, 8, 9, 25), settings: { startDate: '' }, profile: INSULIN, plan: planFor(data, INSULIN, D), sessions: [], checkIns: [rec], observations: [], saved: [], permissions: { guided: perm('guided'), stretch: perm('stretch'), walk: perm('walk') } });
    expect(r.kind).toBe('recheck');
    expect(r.detail).toContain(`Re-check at ${formatTime(9, 35)}`);
  });
});

describe('J2-14: no exercise preparation beside any answer that ends the day', () => {
  for (const [what, profile, c] of [
    ['one very high blood pressure', createDefaultProfile({ health: { ...INSULIN.health, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } }), ci(D, { glucose: g(118, 8, 9, 20), bpReadings: [{ sys: 185, dia: 95, at: at(8, 9, 21) }] })],
    ['low blood pressure with dizziness', createDefaultProfile({ health: { ...INSULIN.health, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } }), ci(D, { glucose: g(118, 8, 9, 20), news: ['dizzy'], bpReadings: [{ sys: 85, dia: 55, at: at(8, 9, 21) }] })],
  ] as const) {
    it(what, () => {
      const r = evaluateCheckIn(profile, c, [], NOW);
      expect(r.reasons.map(x => x.message).join(' ')).toMatch(/no exercise today/i);
      expect(r.actions.join(' ')).not.toMatch(/before exercise|before cardio/);
    });
  }
});

/** The day's record after the sheet saves `change` to the form, as the store keeps it. */
const saved = (p: UserProfile, previous: DailyCheckIn | undefined, change: (f: CheckInForm) => CheckInForm, now: Date): DailyCheckIn =>
  carryForward(previous, buildCheckIn(change({ ...(previous ? formFromRecord(previous, p) : emptyForm(p)), emergency: [] }), { date: D, profile: p, now, ...(previous ? { previous } : {}) }));
const glucoseTyped = (value: number, taken: string) => (f: CheckInForm): CheckInForm => ({ ...f, glucose: String(value), glucoseAt: taken });
const readingIds = (r: ReturnType<typeof evaluateCheckIn>) => (r.episodes ?? []).flatMap(e => e.readings).map(x => x.id);

describe('Earlier glucose readings count in the order they were taken, not the order they were typed', () => {
  it('60 at 09:20, then 58 timed 09:00, then 64 at 09:25: still under 70 at the 15-minute re-check, so no exercise today', () => {
    const first = saved(INSULIN, undefined, glucoseTyped(60, at(8, 9, 20)), new Date(2026, 9, 8, 9, 20));
    const second = saved(INSULIN, first, glucoseTyped(58, at(8, 9, 0)), new Date(2026, 9, 8, 9, 21));
    const third = saved(INSULIN, second, glucoseTyped(64, at(8, 9, 25)), new Date(2026, 9, 8, 9, 25));
    const r = evaluateCheckIn(INSULIN, third, [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('lowRepeat');
    expect(r.reasons.map(x => x.code)).not.toContain('low');
    // The next re-check is timed from the 64, not from a 15-minute wait after the 60.
    expect(r.recheckAt).toBe(at(8, 9, 40));
    expect(ask(INSULIN, third, [], 'walk')).toMatchObject({ allowed: false });
  });

  it('the re-check is timed from the latest reading that asked for one: an 80 at 09:20, a 62 typed after it but timed 09:00, then 110 at 09:30', () => {
    const today = ci(D, { lowRecovered: true, glucose: g(110, 8, 9, 30), glucoseEarlier: [g(80, 8, 9, 20), g(62, 8, 9, 0)] });
    const r = evaluateCheckIn(INSULIN, today, [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('tooSoon');
    expect(r.recheckAt).toBe(at(8, 9, 35));
    expect(ask(INSULIN, today, [], 'walk').allowed).toBe(false);
  });

  it('reading the record again changes nothing', () => {
    const c = ci(D, { glucose: g(64, 8, 9, 25), glucoseEarlier: [g(60, 8, 9, 20), g(58, 8, 9, 0)] });
    expect(withLogged(withLogged(c))).toEqual(withLogged(c));
  });
});

describe('R5-06, after an edit: a usable severe number still counts once it is an earlier reading', () => {
  const reading1 = (sys: number, dia: number, taken: string) => (f: CheckInForm): CheckInForm => ({ ...f, bp: { ...f.bp, s1: String(sys), d1: String(dia), at1: taken } });
  const typedThenFixed = (sys: number, dia: number) => {
    const first = saved(BP, undefined, reading1(sys, dia, at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    return saved(BP, first, reading1(120, 80, at(8, 9, 2)), new Date(2026, 9, 8, 9, 2));
  };
  const typo = typedThenFixed(190, 10);
  const typoId = `bp:${at(8, 9, 0)}:190/10`;

  it('190/10, then reading 1 changed to 120/80: still no exercise today, and asked about by name', () => {
    expect(typo.bpEarlier).toEqual([{ sys: 190, dia: 10, at: at(8, 9, 0) }]);
    expect(ask(BP, typo, [], 'walk').allowed).toBe(false);
    const r = evaluateCheckIn(BP, typo, [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('bpSevereEarlier');
    expect(r.reasons.map(x => x.message).join(' ')).toMatch(/top number is 190/);
    expect(r.reasons.map(x => x.message).join(' ')).not.toMatch(/over 10\b/);
    expect(readingIds(r)).toContain(typoId);
  });

  it('"I typed it wrongly" releases it; "A clinician has checked me since" still means no exercise today', () => {
    expect(ask(BP, { ...typo, resolutions: [answer('severeBp', typoId, 'mistake')] }, [], 'walk').allowed).toBe(true);
    expect(ask(BP, { ...typo, resolutions: [answer('severeBp', typoId, 'assessed')] }, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });

  it('as a valid 190/100 typed, then corrected, does', () => {
    const valid = typedThenFixed(190, 100);
    const codes = (c: DailyCheckIn) => evaluateCheckIn(BP, c, [], NOW).reasons.map(x => x.code);
    expect(codes(typo)).toEqual(codes(valid));
    expect(permission({ profile: BP, checkIn: record(BP, typo), now: NOW, recent: [] }, 'walk').disposition)
      .toBe(permission({ profile: BP, checkIn: record(BP, valid), now: NOW, recent: [] }, 'walk').disposition);
  });

  it('a usable severe bottom number counts by itself, and an unusable top number is never named', () => {
    const r = evaluateCheckIn(BP, typedThenFixed(400, 125), [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('bpSevereEarlier');
    expect(r.reasons.map(x => x.message).join(' ')).toMatch(/bottom number is 125/);
    expect(r.reasons.map(x => x.message).join(' ')).not.toMatch(/400/);
  });
});

describe('A flag name the engine does not know is ignored, never a crash', () => {
  const unknown = ['bogus', 'newWeakness'] as unknown as RedFlag[];
  it('in today’s record: the known one still holds', () => {
    const today = ci(D, { back: quietBack, flagsEarlier: unknown });
    expect(() => evaluateCheckIn(BACK, today, [], NOW)).not.toThrow();
    expect(ask(BACK, today, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    expect(readingIds(evaluateCheckIn(BACK, today, [], NOW))).toEqual([`flag:newWeakness@${D}`]);
  });
  it('in an earlier day’s record, and with a name an object already has', () => {
    const yesterday = ci(Y, { back: quietBack, flagsEarlier: ['constructor', ...unknown] as unknown as RedFlag[] });
    expect(() => profileOnlyReadiness(BACK, { date: D, recent: [yesterday], now: NOW })).not.toThrow();
    const r = profileOnlyReadiness(BACK, { date: D, recent: [yesterday], now: NOW });
    expect(readingIds(r)).toEqual([`flag:newWeakness@${Y}`]);
    expect(r.reasons.map(x => x.code).filter(code => code.startsWith('carried'))).toEqual(['carried:newWeakness']);
    expect(r.reasons.map(x => x.message).join(' ')).not.toMatch(/undefined/);
    expect(ask(BACK, ci(D, { back: quietBack }), [yesterday], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });
  it('a list that is not a list is no flag, and no news, at all', () => {
    const odd = ci(D, { back: quietBack, flagsEarlier: 'newWeakness' as unknown as RedFlag[], newsEarlier: 7 as unknown as NewsItem[] });
    expect(() => evaluateCheckIn(BACK, odd, [], NOW)).not.toThrow();
    expect(() => profileOnlyReadiness(BACK, { date: '2026-10-09', recent: [odd], now: NOW })).not.toThrow();
    expect(ask(BACK, odd, [], 'walk').allowed).toBe(true);
  });
});

describe('Serious news said earlier today ends exercise for the rest of the day (same class as R5-01)', () => {
  const cases: [NewsItem, UserProfile][] = [['fainted', METFORMIN], ['highNotFalling', METFORMIN], ['vomiting', METFORMIN], ['lowSevere', INSULIN]];
  for (const [item, p] of cases) {
    const morning = ci(D, { news: [item], glucose: g(120, 8, 9, 0) });
    const later = carryForward(morning, ci(D, { glucose: g(120, 8, 9, 0) }));
    it(`${item} at 09:00, then "None of these" at 10:00: still no exercise today`, () => {
      expect(ask(p, morning, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
      expect(ask(p, later, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    });
    it(`${item}: asked about by name, and "I ticked it by mistake" releases it`, () => {
      const id = `news:${item}@${D}`;
      const listed = (evaluateCheckIn(p, later, [], NOW).episodes ?? []).flatMap(e => e.readings).find(r => r.id === id);
      expect(listed?.accepts).toEqual(['mistake']);
      expect(ask(p, { ...later, resolutions: [answer('news', id, 'mistake')] }, [], 'walk').allowed).toBe(true);
    });
  }

  it('vomiting without diabetes is a hold that unticking it releases, as its own message says', () => {
    const plain = createDefaultProfile({ health: known });
    const later = carryForward(ci(D, { news: ['vomiting'] }), ci(D));
    expect(ask(plain, ci(D, { news: ['vomiting'] }), [], 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(ask(plain, later, [], 'walk').allowed).toBe(true);
  });

  it('a low that needed help, unticked later the same day, is still carried the next morning', () => {
    const yesterday = carryForward(ci(Y, { news: ['lowSevere'], glucose: g(120, 7, 9, 0) }), ci(Y, { glucose: g(120, 7, 9, 0) }));
    expect(ask(INSULIN, undefined, [yesterday], 'walk', new Date(2026, 9, 8, 0, 30))).toMatchObject({ allowed: false, disposition: 'today' });
  });

  it('ticking it again makes it today’s answer once more, not an earlier one', () => {
    const again = carryForward(carryForward(ci(D, { news: ['fainted'] }), ci(D)), ci(D, { news: ['fainted'] }));
    expect(again.news).toEqual(['fainted']);
    expect(readingIds(evaluateCheckIn(METFORMIN, again, [], NOW))).not.toContain(`news:fainted@${D}`);
  });
});

describe('A release given today does not cover the same item reported again later that day', () => {
  const clockAt = (h: number, m = 0) => new Date(2026, 9, 8, h, m);
  const news = (item: NewsItem) => (on: boolean) => (f: CheckInForm): CheckInForm =>
    ({ ...f, news: on ? [...f.news.filter(n => n !== item), item] : f.news.filter(n => n !== item), answered: { ...f.answered, news: true } });
  const weakness = (on: boolean) => (f: CheckInForm): CheckInForm => ({ ...f, back: { ...f.back, newWeakness: on }, answered: { ...f.answered, backFlags: true } });
  const cases: [string, UserProfile, EpisodeAnswer['kind'], string, (on: boolean) => (f: CheckInForm) => CheckInForm][] = [
    ['a foot drop', BACK, 'redFlag', `flag:newWeakness@${D}`, weakness],
    ['a foot sore', METFORMIN, 'foot', `flag:footProblem@${D}`, news('footProblem')],
    ['fainting', METFORMIN, 'news', `news:fainted@${D}`, news('fainted')],
    ['a low that needed help', METFORMIN, 'news', `news:lowSevere@${D}`, news('lowSevere')],
  ];
  for (const [what, p, kind, id, set] of cases) {
    const listed = (c: DailyCheckIn) => (evaluateCheckIn(p, c, [], NOW).episodes ?? []).flatMap(e => e.readings).find(r => r.id === id);
    const ticked = saved(p, undefined, set(true), clockAt(9));
    const unticked = saved(p, ticked, set(false), clockAt(10));
    const released = saved(p, unticked, f => answerEpisode(f, kind, [id], 'mistake', clockAt(10, 5), clockAt(10, 5)), clockAt(10, 5));

    it(`${what}: "I ticked it by mistake" on its own still releases it`, () => {
      expect(ask(p, unticked, [], 'walk').allowed).toBe(false);
      expect(ask(p, released, [], 'walk').allowed).toBe(true);
      expect(listed(released)?.settled).toBe('mistake');
    });

    it(`${what}: ticked, unticked, "I ticked it by mistake", ticked again, unticked: still held, and asked again by name`, () => {
      const again = saved(p, released, set(true), clockAt(11));
      expect(ask(p, again, [], 'walk').allowed).toBe(false);
      const untickedAgain = saved(p, again, set(false), clockAt(12));
      expect(ask(p, untickedAgain, [], 'walk').allowed).toBe(false);
      expect(listed(untickedAgain)).toMatchObject({ id });
      expect(listed(untickedAgain)?.settled).toBeUndefined();
      // Taken back by when it was said, whatever order the answers are kept in.
      expect(ask(p, { ...untickedAgain, resolutions: [...(untickedAgain.resolutions ?? [])].reverse() }, [], 'walk').allowed).toBe(false);
      // Saying it again is still the person's own release.
      const releasedAgain = saved(p, untickedAgain, f => answerEpisode(f, kind, [id], 'mistake', clockAt(12, 5), clockAt(12, 5)), clockAt(12, 5));
      expect(ask(p, releasedAgain, [], 'walk').allowed).toBe(true);
    });
  }

  it('reading the save again adds nothing more', () => {
    const [, p, kind, id, set] = cases[2];
    const unticked = saved(p, saved(p, undefined, set(true), clockAt(9)), set(false), clockAt(10));
    const released = saved(p, unticked, f => answerEpisode(f, kind, [id], 'mistake', clockAt(10, 5), clockAt(10, 5)), clockAt(10, 5));
    const again = saved(p, released, set(true), clockAt(11));
    expect(carryForward(released, again)).toEqual(again);
    expect((again.resolutions ?? []).filter(a => a.resolution === 'reopened')).toHaveLength(1);
  });
});

describe('N-03: answers count in the order they were given, whatever offset or precision they are written with', () => {
  const footDrop = { ...quietBack, newWeakness: true, newNeuro: true };
  const flag = `flag:newWeakness@${D}`;
  const said = (kind: EpisodeAnswer['kind'], id: string, resolution: EpisodeAnswer['resolution'], iso: string): EpisodeAnswer => ({ kind, readings: [id], resolution, at: iso });

  it('an assessment imported as 10:05+05:30, then the foot drop ticked again and unticked: still held, and reopened once', () => {
    const assessed = said('redFlag', flag, 'assessed', '2026-10-08T10:05:00+05:30');
    const unticked = carryForward(ci(D, { back: footDrop }), ci(D, { back: quietBack, resolutions: [assessed] }));
    expect(ask(BACK, unticked, [], 'walk').allowed).toBe(true);
    const again = carryForward(unticked, ci(D, { back: footDrop, resolutions: [assessed] }));
    const reopened = (again.resolutions ?? []).filter(a => a.resolution === 'reopened');
    expect(reopened).toHaveLength(1);
    expect(Date.parse(reopened[0].at)).toBeGreaterThan(Date.parse(assessed.at));
    // Saving the same thing again adds nothing.
    expect(carryForward(unticked, again)).toEqual(again);
    const untickedAgain = carryForward(again, ci(D, { back: quietBack, resolutions: again.resolutions }));
    expect(ask(BACK, untickedAgain, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });

  it('two earlier releases written with different offsets: the reopening comes after the later of them', () => {
    const answers = [said('redFlag', flag, 'assessed', '2026-10-08T10:05:00+05:30'), said('redFlag', flag, 'mistake', '2026-10-08T06:00:00Z')];
    const unticked = carryForward(ci(D, { back: footDrop }), ci(D, { back: quietBack, resolutions: answers }));
    const again = carryForward(unticked, ci(D, { back: footDrop, resolutions: answers }));
    const reopened = (again.resolutions ?? []).filter(a => a.resolution === 'reopened');
    expect(reopened.map(a => Date.parse(a.at))).toEqual([Date.parse('2026-10-08T06:00:00.001Z')]);
    const untickedAgain = carryForward(again, ci(D, { back: quietBack, resolutions: again.resolutions }));
    expect(ask(BACK, untickedAgain, [], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
  });

  // Yesterday's 650 is an emergency until answered (B01).
  const night = ci(Y, { glucose: g(650, 7, 23, 50) });
  const id650 = `g:${at(7, 23, 50)}:650mg/dL`;
  const morning = (...answers: EpisodeAnswer[]) => ci(D, { glucose: g(110, 8, 9, 0), resolutions: answers });

  it('mixed precision: a reopening at 03:35:00.5 is after a mistake at 03:35:00', () => {
    const today = morning(said('extremeGlucose', id650, 'mistake', '2026-10-08T03:35:00Z'), said('extremeGlucose', id650, 'reopened', '2026-10-08T03:35:00.5Z'));
    expect(ask(METFORMIN, today, [night], 'walk').disposition).toBe('emergency');
  });

  it('the same instant written two ways: the stricter answer stands, whichever is listed first', () => {
    const mistake = said('extremeGlucose', id650, 'mistake', '2026-10-08T09:05:00+05:30');
    const reopened = said('extremeGlucose', id650, 'reopened', '2026-10-08T03:35:00Z');
    expect(ask(METFORMIN, morning(mistake, reopened), [night], 'walk').disposition).toBe('emergency');
    expect(ask(METFORMIN, morning(reopened, mistake), [night], 'walk').disposition).toBe('emergency');
    const assessed = said('extremeGlucose', id650, 'assessed', '2026-10-08T03:35:00.000Z');
    for (const answers of [[mistake, assessed], [assessed, mistake]]) {
      expect(ask(METFORMIN, morning(...answers), [night], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
    }
  });

  it('the sheet shows the answer that stands', () => {
    const answers = [said('redFlag', flag, 'assessed', '2026-10-08T10:05:00+05:30'), said('redFlag', flag, 'reopened', '2026-10-08T04:40:00Z')];
    const form = { ...emptyForm(BACK), resolutions: answers };
    expect(episodeChoice(form, { kind: 'redFlag', readings: [{ id: flag, label: 'Foot drop' }] })).toBe('open');
  });

  it('an answer from an earlier sitting, written with an offset, is kept when it is taken back in this one', () => {
    const imported = said('redFlag', flag, 'assessed', '2026-10-08T15:00:00+05:30');
    const form = { ...emptyForm(BACK), resolutions: [imported] };
    const next = answerEpisode(form, 'redFlag', [flag], 'open', new Date('2026-10-08T09:45:00Z'), new Date('2026-10-08T09:40:00Z'));
    expect(next.resolutions).toEqual([imported, said('redFlag', flag, 'reopened', '2026-10-08T09:45:00.000Z')]);
  });
});

describe('R5-03, ties and unknown times: only a provably later usable reading releases what an earlier one holds', () => {
  const SGLT2 = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true, sglt2i: true, ketoneTest: 'blood' } });
  const untimed = (value: number) => ({ value, unit: 'mg/dL' as const, source: 'meter' as const });
  const bp = (sys: number, dia: number, h?: number, m = 0) => ({ sys, dia, ...(h !== undefined ? { at: at(8, h, m) } : {}) });

  it('glucose: 320 at 09:10, then 140 at the same instant, or with no time: still held', () => {
    for (const current of [g(140, 8, 9, 10), untimed(140)]) {
      const today = ci(D, { glucose: current, glucoseEarlier: [g(320, 8, 9, 10)] });
      expect(ask(METFORMIN, today, [], 'walk'), JSON.stringify(current)).toMatchObject({ allowed: false, disposition: 'hold' });
      expect(evaluateCheckIn(METFORMIN, today, [], NOW).reasons.map(r => r.code)).toContain('high');
    }
  });

  it('glucose: a meter reading HI, or 260 with no ketone result, then a normal number at the same instant: still held', () => {
    const hi = ci(D, { glucose: g(140, 8, 9, 10), glucoseEarlier: [{ display: 'HI', measuredAt: at(8, 9, 10), source: 'meter' }] });
    expect(evaluateCheckIn(METFORMIN, hi, [], NOW).reasons.map(r => r.code)).toContain('meterHi');
    expect(ask(METFORMIN, hi, [], 'walk').allowed).toBe(false);
    // Twice HI is the stronger instruction, said once.
    const twice = ci(D, { glucoseDisplay: { display: 'HI', measuredAt: at(8, 9, 10), source: 'meter' }, glucoseEarlier: [{ display: 'HI', measuredAt: at(8, 9, 10), source: 'meter' }] });
    expect(evaluateCheckIn(METFORMIN, twice, [], NOW).reasons.map(r => r.code).filter(c => /Hi$/.test(c))).toEqual(['persistentHi']);
    const ketones = ci(D, { glucose: untimed(140), glucoseEarlier: [g(260, 8, 9, 10)] });
    expect(evaluateCheckIn(SGLT2, ketones, [], NOW).reasons.map(r => r.code)).toContain('noKetones');
  });

  it('glucose: a provably later normal reading still releases it', () => {
    expect(ask(METFORMIN, ci(D, { glucose: g(140, 8, 9, 11), glucoseEarlier: [g(320, 8, 9, 10)] }), [], 'walk').allowed).toBe(true);
    expect(ask(METFORMIN, ci(D, { glucose: g(140, 8, 9, 11), glucoseEarlier: [{ display: 'HI', measuredAt: at(8, 9, 10), source: 'meter' }] }), [], 'walk').allowed).toBe(true);
  });

  it('blood pressure: 170/105, then 120/80 at the same instant, with no time, or after one with no time: still held', () => {
    for (const [current, earlier] of [[bp(120, 80, 9, 10), bp(170, 105, 9, 10)], [bp(120, 80), bp(170, 105, 9, 10)], [bp(120, 80, 9, 10), bp(170, 105)]]) {
      const today = ci(D, { bpReadings: [current], bpEarlier: [earlier] });
      expect(ask(BP, today, [], 'walk'), JSON.stringify([current, earlier])).toMatchObject({ allowed: false, disposition: 'hold' });
    }
  });

  it('blood pressure: a provably later normal reading still releases it, and a severe one is still one reading', () => {
    expect(ask(BP, ci(D, { bpReadings: [bp(120, 80, 9, 11)], bpEarlier: [bp(170, 105, 9, 10)] }), [], 'walk').allowed).toBe(true);
    // A severe reading at the same instant is one reading, not a confirming second one.
    const severe = evaluateCheckIn(BP, ci(D, { bpReadings: [bp(120, 80, 9, 10)], bpEarlier: [bp(190, 100, 9, 10)] }), [], NOW);
    expect(severe.reasons.map(r => r.code)).not.toContain('bpSevere');
    expect(severe.disposition).not.toBe('reassure');
  });
});

describe('N-01: a refused save never loosens what the device holds, even when its reading is newer', () => {
  const stored = (p: UserProfile, c: DailyCheckIn) => record(p, c);
  const effective = (p: UserProfile, s: DailyCheckIn, pending: DailyCheckIn) => effectiveRecord(stored(p, s), record(p, pending), p)!;
  const bp = (sys: number, dia: number, h: number, m = 0) => ({ sys, dia, at: at(8, h, m) });

  it('glucose: 320 at 09:10 stored, a refused 140 at 09:20: still held, on every mode and at the player', () => {
    const e = effective(METFORMIN, ci(D, { glucose: g(320, 8, 9, 10) }), ci(D, { glucose: g(140, 8, 9, 20), glucoseEarlier: [g(320, 8, 9, 10)] }));
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      expect(permission({ profile: METFORMIN, checkIn: e, now: NOW, recent: [] }, mode), mode).toMatchObject({ allowed: false, disposition: 'hold' });
      expect(resumePermission({ profile: METFORMIN, checkIn: e, now: NOW, recent: [] }, mode).allowed, mode).toBe(false);
    }
    expect(e.readiness.reasons.map(r => r.code)).toContain('high');
  });

  it('blood pressure: 170/105 at 09:10 stored, a refused 120/80 at 09:20: still held', () => {
    const e = effective(BP, ci(D, { bpReadings: [bp(170, 105, 9, 10)] }), ci(D, { bpReadings: [bp(120, 80, 9, 20)], bpEarlier: [bp(170, 105, 9, 10)] }));
    expect(permission({ profile: BP, checkIn: e, now: NOW, recent: [] }, 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
  });

  it('a restriction the stored reading sets stays too: 150/95 stored, a refused 120/80, and the plan keeps its limits', () => {
    const e = effective(BP, ci(D, { bpReadings: [bp(150, 95, 9, 10)] }), ci(D, { bpReadings: [bp(120, 80, 9, 20)], bpEarlier: [bp(150, 95, 9, 10)] }));
    const p = permission({ profile: BP, checkIn: e, now: NOW, recent: [] }, 'guided');
    expect(p.allowed).toBe(true);
    expect(p.codes).toEqual(expect.arrayContaining(['INT', 'capHeavy']));
    const plan = buildSessionPlan({ profile: BP, date: D, startDate: '2026-09-28', sessions: [], checkIn: e, focusOverride: 'upperB' });
    expect(plan.changes.join(' ')).toMatch(/140 over 90/);
  });

  it('a fresh reading the device refused does not make a stale stored one fresh', () => {
    const later = new Date(2026, 9, 8, 9, 45);
    const e = effective(INSULIN, ci(D, { glucose: g(140, 8, 9, 0) }), ci(D, { glucose: g(130, 8, 9, 40), glucoseEarlier: [g(140, 8, 9, 0)] }));
    expect(permission({ profile: INSULIN, checkIn: e, now: later, recent: [] }, 'walk')).toMatchObject({ allowed: false, needsCheckIn: true });
  });

  it('once the device stores it, the newer reading decides', () => {
    const now = ci(D, { glucose: g(140, 8, 9, 20), glucoseEarlier: [g(320, 8, 9, 10)] });
    expect(permission({ profile: METFORMIN, checkIn: effectiveRecord(record(METFORMIN, now), undefined, METFORMIN)!, now: NOW, recent: [] }, 'walk').allowed).toBe(true);
  });

  it('what the device stored is never written back with the record, by a save, a report or a correction', () => {
    const e = effective(METFORMIN, ci(D, { glucose: g(320, 8, 9, 10) }), ci(D, { glucose: g(140, 8, 9, 20), glucoseEarlier: [g(320, 8, 9, 10)] }));
    expect(carryForward(e, ci(D, { glucose: g(150, 8, 9, 30) }))).not.toHaveProperty('durable');
    expect(carryForward(e, { ...e, news: ['hot'] })).not.toHaveProperty('durable');
  });
});

describe('P-01: what only the gates attach to a day is never kept in its record, however the save goes', () => {
  const gateOnly = { durable: ci(D), logged: { glucose: [g(140, 8, 9, 0)] }, readingsOnly: true as const };

  it('with no saved record for the day, only another day’s, or the day’s own: the record to save carries none of it', () => {
    for (const saved of [undefined, ci(Y), ci(D)]) {
      const next = carryForward(saved, { ...ci(D, { news: ['hot'] }), ...gateOnly });
      for (const field of ['durable', 'logged', 'readingsOnly']) expect(next, `${field}, saved over ${saved?.date ?? 'nothing'}`).not.toHaveProperty(field);
      expect(next.news).toEqual(['hot']);
    }
  });

  it('a save the store never ran still hands back only the day’s own record', async () => {
    const result = await saveCheckInRecord({ ...ci(D, { news: ['hot'] }), ...gateOnly }, { profile: BACK, update: async () => ({ ok: false, failure: { message: 'No storage' } }) });
    resetPendingCheckInsForTests();
    expect(result.stored).toBe(false);
    for (const field of ['durable', 'logged', 'readingsOnly']) expect(result.record, field).not.toHaveProperty(field);
    expect(result.record.news).toEqual(['hot']);
  });
});

describe('N-04: a half-entered severe number is only ever replaced by its own completion', () => {
  const BACK_BP = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: BP.health });
  const row = (n: 1 | 2, sys: string, dia: string, taken: string) => (f: CheckInForm): CheckInForm =>
    ({ ...f, bp: { ...f.bp, [`s${n}`]: sys, [`d${n}`]: dia, [`at${n}`]: taken } });
  const numb = (f: CheckInForm): CheckInForm => ({ ...f, back: { ...f.back, newSensory: true }, answered: { ...f.answered, backFlags: true } });
  const typoId = `bp:${at(8, 9, 0)}:190/100`;
  /** 190/100 at 09:00, replaced by 120/80, then answered "I typed it wrongly". */
  const released = () => {
    const first = saved(BACK_BP, undefined, row(1, '190', '100', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    const replaced = saved(BACK_BP, first, row(1, '120', '80', at(8, 9, 2)), new Date(2026, 9, 8, 9, 2));
    return saved(BACK_BP, replaced, f => answerEpisode(f, 'severeBp', [typoId], 'mistake', new Date(2026, 9, 8, 9, 3), new Date(2026, 9, 8, 9, 3)), new Date(2026, 9, 8, 9, 3));
  };

  it('190/100 answered as a typo, then a fresh 190 with the other box empty and new numbness: still an emergency', () => {
    const before = released();
    expect(ask(BACK_BP, before, [], 'walk').allowed).toBe(true);
    const fresh = saved(BACK_BP, before, f => numb(row(2, '190', '', at(8, 9, 10))(f)), new Date(2026, 9, 8, 9, 10));
    expect(fresh.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 10) }]);
    expect(ask(BACK_BP, fresh, [], 'walk')).toMatchObject({ allowed: false, disposition: 'emergency' });
    // And the half stays on the next save, which the old reading cannot take either.
    const next = saved(BACK_BP, fresh, f => f, new Date(2026, 9, 8, 9, 12));
    expect(next.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 10) }]);
  });

  it('a box that is not a number leaves the other to count alone, whatever older reading has the same number', () => {
    const before = released();
    const fresh = saved(BACK_BP, before, f => numb(row(2, '190', 'x', at(8, 9, 10))(f)), new Date(2026, 9, 8, 9, 10));
    expect(fresh.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 10) }]);
    expect(ask(BACK_BP, fresh, [], 'walk').disposition).toBe('emergency');
  });

  it('an older reading that still stands never takes a fresh half\u2019s place: answered as a typo later, the half still counts', () => {
    const first = saved(BACK_BP, undefined, row(1, '190', '100', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    const replaced = saved(BACK_BP, first, row(1, '120', '80', at(8, 9, 2)), new Date(2026, 9, 8, 9, 2));
    const fresh = saved(BACK_BP, replaced, f => numb(row(2, '190', '', at(8, 9, 10))(f)), new Date(2026, 9, 8, 9, 10));
    // Both are asked about: the older reading is another measurement.
    expect(readingIds(evaluateCheckIn(BACK_BP, fresh, [], NOW))).toEqual(expect.arrayContaining([typoId, `bpp:${at(8, 9, 10)}:190/`]));
    // Answers built from an older copy of the day keep the half too (B04).
    expect(carryForward(fresh, replaced).bpPartial).toEqual([{ sys: 190, at: at(8, 9, 10) }]);
    const afterTypo = saved(BACK_BP, fresh, f => answerEpisode(f, 'severeBp', [typoId], 'mistake', new Date(2026, 9, 8, 9, 12), new Date(2026, 9, 8, 9, 12)), new Date(2026, 9, 8, 9, 12));
    expect(ask(BACK_BP, afterTypo, [], 'walk').disposition).toBe('emergency');
  });

  it('a half completed by its own reading is read as that reading, and counts again if that reading is withdrawn', () => {
    const half = saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    const halfId = `bpp:${at(8, 9, 0)}:190/`;
    expect(half.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
    const completed = saved(BACK_BP, half, row(1, '190', '100', at(8, 9, 1)), new Date(2026, 9, 8, 9, 1));
    const r = evaluateCheckIn(BACK_BP, completed, [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('bpSevereUnconfirmed');
    // One measurement: the half is not asked about beside the reading that completes it.
    expect(readingIds(r)).toEqual([]);
    const replaced = saved(BACK_BP, completed, row(1, '120', '80', at(8, 9, 5)), new Date(2026, 9, 8, 9, 5));
    expect(readingIds(evaluateCheckIn(BACK_BP, replaced, [], NOW))).toEqual([`bp:${at(8, 9, 1)}:190/100`]);
    const withdrawn = saved(BACK_BP, replaced, f => answerEpisode(f, 'severeBp', [`bp:${at(8, 9, 1)}:190/100`], 'mistake', new Date(2026, 9, 8, 9, 6), new Date(2026, 9, 8, 9, 6)), new Date(2026, 9, 8, 9, 6));
    expect(ask(BACK_BP, withdrawn, [], 'walk').allowed).toBe(false);
    expect(readingIds(evaluateCheckIn(BACK_BP, withdrawn, [], NOW))).toContain(halfId);
  });

  describe('P-02: the half goes with the measurement it was the start of', () => {
    const halfId = `bpp:${at(8, 9, 0)}:190/`;
    /** 190 with the other box empty at 09:00, then completed as 190/100 at 09:01. */
    const completed = () => saved(BACK_BP, saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0)), row(1, '190', '100', at(8, 9, 1)), new Date(2026, 9, 8, 9, 1));
    const severe = (c: DailyCheckIn) => {
      const r = evaluateCheckIn(BACK_BP, c, [], NOW);
      return [...r.reasons.map(x => x.code).filter(code => code.startsWith('bpSevere')), ...readingIds(r)];
    };

    it('its completion corrected in Track to 120/80: nothing severe is left, then or on the next save', () => {
      const fixed = withPressureCorrected(completed(), { at: at(8, 9, 1), was: { sys: 190, dia: 100 }, to: { sys: 120, dia: 80 } })!;
      expect(fixed.bpReadings).toEqual([{ sys: 120, dia: 80, at: at(8, 9, 1) }]);
      // Its 190 was part of what was typed wrongly: it goes with the old numbers (Q-02).
      expect(fixed.bpPartial ?? []).toEqual([]);
      expect(severe(fixed)).toEqual([]);
      expect(ask(BACK_BP, fixed, [], 'walk').allowed).toBe(true);
      expect(severe(saved(BACK_BP, fixed, f => f, new Date(2026, 9, 8, 9, 10)))).toEqual([]);
      // Answers built from a copy of the day from before the correction bring it
      // back as evidence, asked about again, as any reading such a copy holds (B04).
      const halfOnly = saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
      expect(severe(carryForward(fixed, halfOnly))).toEqual(['bpSevereUnconfirmed', halfId]);
    });

    it('corrected to numbers that still hold its own, it follows the corrected reading, and counts again if that is withdrawn', () => {
      const fixed = withPressureCorrected(completed(), { at: at(8, 9, 1), was: { sys: 190, dia: 100 }, to: { sys: 190, dia: 110 } })!;
      expect(fixed.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0), completion: { sys: 190, dia: 110, at: at(8, 9, 1) } }]);
      expect(severe(fixed)).toEqual(['bpSevereUnconfirmed']);
      const withdrawn = saved(BACK_BP, fixed, f => answerEpisode(f, 'severeBp', [`bp:${at(8, 9, 1)}:190/110`], 'mistake', new Date(2026, 9, 8, 9, 6), new Date(2026, 9, 8, 9, 6)), new Date(2026, 9, 8, 9, 6));
      expect(readingIds(evaluateCheckIn(BACK_BP, withdrawn, [], NOW))).toContain(halfId);
    });

    it('its completion deleted in Track: the half is deleted with it', () => {
      const gone = withReadingRemoved(completed(), { kind: 'pressure', at: at(8, 9, 1), sys: 190, dia: 100 })!;
      expect(gone.bpReadings ?? []).toEqual([]);
      expect(gone.bpPartial ?? []).toEqual([]);
      expect(severe(gone)).toEqual([]);
      expect(severe(saved(BACK_BP, gone, f => f, new Date(2026, 9, 8, 9, 10)))).toEqual([]);
    });

    it('an answer built from a copy that knew the half but not its completion keeps the link the day holds', () => {
      const c = completed();
      expect(c.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0), completion: { sys: 190, dia: 100, at: at(8, 9, 1) } }]);
      const unlinked = { ...c, bpPartial: [{ sys: 190, at: at(8, 9, 0) }] };
      const merged = carryForward(c, unlinked);
      expect(merged.bpPartial).toEqual(c.bpPartial);
      expect(severe(withPressureCorrected(merged, { at: at(8, 9, 1), was: { sys: 190, dia: 100 }, to: { sys: 120, dia: 80 } })!)).toEqual([]);
    });

    it('a reading that is not its completion leaves it alone: corrected or deleted, the fresh half still counts', () => {
      // 190/100 at 09:00 stands; a fresh 190 at 09:10 is another measurement.
      const first = saved(BACK_BP, undefined, row(1, '190', '100', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
      const fresh = saved(BACK_BP, first, f => row(2, '190', '', at(8, 9, 10))(f), new Date(2026, 9, 8, 9, 10));
      const freshId = `bpp:${at(8, 9, 10)}:190/`;
      const fixed = withPressureCorrected(fresh, { at: at(8, 9, 0), was: { sys: 190, dia: 100 }, to: { sys: 120, dia: 80 } })!;
      expect(readingIds(evaluateCheckIn(BACK_BP, fixed, [], NOW))).toContain(freshId);
      const gone = withReadingRemoved(fresh, { kind: 'pressure', at: at(8, 9, 0), sys: 190, dia: 100 })!;
      expect(gone.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 10) }]);
      expect(readingIds(evaluateCheckIn(BACK_BP, gone, [], NOW))).toContain(freshId);
    });

    it('still read as its completion until then, and counted again if that reading is answered as typed wrongly (N-04)', () => {
      const c = completed();
      expect(severe(c)).toEqual(['bpSevereUnconfirmed']);
      const withdrawn = saved(BACK_BP, c, f => answerEpisode(f, 'severeBp', [`bp:${at(8, 9, 1)}:190/100`], 'mistake', new Date(2026, 9, 8, 9, 6), new Date(2026, 9, 8, 9, 6)), new Date(2026, 9, 8, 9, 6));
      expect(readingIds(evaluateCheckIn(BACK_BP, withdrawn, [], NOW))).toContain(halfId);
    });
  });
});

describe('Q-01: only completing the row a half was entered in completes it', () => {
  const BACK_BP = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: BP.health });
  const row = (n: 1 | 2, sys: string, dia: string, taken: string) => (f: CheckInForm): CheckInForm =>
    ({ ...f, bp: { ...f.bp, [`s${n}`]: sys, [`d${n}`]: dia, [`at${n}`]: taken } });
  const halfId = `bpp:${at(8, 9, 0)}:190/`;
  /** A real 190 in reading 1 at 09:00, then an independent 190/100 in reading 2 at 09:10 (Codex round 8). */
  const independent = () => saved(BACK_BP, saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0)), row(2, '190', '100', at(8, 9, 10)), new Date(2026, 9, 8, 9, 10));
  const fix = { at: at(8, 9, 10), was: { sys: 190, dia: 100 }, to: { sys: 120, dia: 80 } };

  it('another reading with the same number is another measurement: the half is not linked to it', () => {
    const c = independent();
    expect(c.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
    expect(readingIds(evaluateCheckIn(BACK_BP, c, [], NOW))).toContain(halfId);
  });

  it('that reading corrected in Track to 120/80: the half still counts, and holds', () => {
    const fixed = withPressureCorrected(independent(), fix)!;
    expect(fixed.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
    const r = evaluateCheckIn(BACK_BP, fixed, [], NOW);
    expect(r.reasons.map(x => x.code)).toContain('bpSevereUnconfirmed');
    expect(readingIds(r)).toContain(halfId);
    expect(ask(BACK_BP, fixed, [], 'walk').allowed).toBe(false);
  });

  it('that reading deleted in Track: the half is kept, and still holds', () => {
    const gone = withReadingRemoved(independent(), { kind: 'pressure', at: at(8, 9, 10), sys: 190, dia: 100 })!;
    expect(gone.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
    expect(readingIds(evaluateCheckIn(BACK_BP, gone, [], NOW))).toContain(halfId);
    expect(ask(BACK_BP, gone, [], 'walk').allowed).toBe(false);
  });

  it('the half is shown in its row, so filling in the other box there completes it', () => {
    const half = saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    const form = formFromRecord(half, BACK_BP);
    expect(form.bp).toMatchObject({ s1: '190', d1: '', at1: at(8, 9, 0), half1: { sys: 190, at: at(8, 9, 0) } });
    const completed = saved(BACK_BP, half, f => ({ ...f, bp: { ...f.bp, d1: '100', at1: at(8, 9, 2) } }), new Date(2026, 9, 8, 9, 2));
    expect(completed.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0), completion: { sys: 190, dia: 100, at: at(8, 9, 2) } }]);
    expect(readingIds(evaluateCheckIn(BACK_BP, completed, [], NOW))).toEqual([]);
  });

  it('typed again in its row with the same number, it is still the one half it was, not a second one timed again', () => {
    const half = saved(BACK_BP, undefined, row(1, '190', '', at(8, 9, 0)), new Date(2026, 9, 8, 9, 0));
    const again = saved(BACK_BP, half, row(1, '190', '', at(8, 9, 5)), new Date(2026, 9, 8, 9, 5));
    expect(again.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
  });

  it('a half saved by an older build beside a matching reading is never read as completed by it, nor moved by its correction', () => {
    const legacy = ci(D, { bpPartial: [{ sys: 190, at: at(8, 9, 0) }], bpReadings: [{ sys: 190, dia: 100, at: at(8, 9, 1) }] });
    expect(readingIds(evaluateCheckIn(BACK_BP, legacy, [], NOW))).toContain(halfId);
    const fixed = withPressureCorrected(legacy, { at: at(8, 9, 1), was: { sys: 190, dia: 100 }, to: { sys: 120, dia: 80 } })!;
    expect(fixed.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
    expect(withReadingRemoved(legacy, { kind: 'pressure', at: at(8, 9, 1), sys: 190, dia: 100 })!.bpPartial).toEqual([{ sys: 190, at: at(8, 9, 0) }]);
  });
});

describe('Q-02: a completion that cannot be the half’s is ignored, and the half still counts', () => {
  const half = (completion: BpReading, readings: BpReading[]) => ci(D, { bpReadings: readings, bpPartial: [{ sys: 190, at: at(8, 9, 10), completion }] });
  const codes = (c: DailyCheckIn) => evaluateCheckIn(BP, c, [], NOW).reasons.map(x => x.code);
  const normalEarlier = { sys: 120, dia: 80, at: at(8, 9, 0) };

  it('Codex’s case: 190 at 09:10 linked to the day’s 120/80 at 09:00, a reading taken before it', () => {
    expect(codes(half(normalEarlier, [normalEarlier]))).toContain('bpSevereUnconfirmed');
    expect(ask(BP, half(normalEarlier, [normalEarlier]), [], 'walk').allowed).toBe(false);
    // Taken before it, a reading with its number is another measurement too.
    const sameEarlier = { sys: 190, dia: 100, at: at(8, 9, 0) };
    expect(readingIds(evaluateCheckIn(BP, half(sameEarlier, [sameEarlier]), [], NOW))).toContain(`bpp:${at(8, 9, 10)}:190/`);
  });

  it('linked to a later reading without its number, or to one the day does not hold', () => {
    const later = { sys: 120, dia: 80, at: at(8, 9, 20) };
    expect(codes(half(later, [later]))).toContain('bpSevereUnconfirmed');
    expect(codes(half({ sys: 190, dia: 100, at: at(8, 9, 20) }, [later]))).toContain('bpSevereUnconfirmed');
    // Its own completion, for contrast, is read as that reading.
    const own = { sys: 190, dia: 100, at: at(8, 9, 20) };
    expect(readingIds(evaluateCheckIn(BP, half(own, [own]), [], NOW))).not.toContain(`bpp:${at(8, 9, 10)}:190/`);
  });
});

describe('A saved half-reading is asked about symptoms, and escalates on them, as a complete severe reading does', () => {
  const half = (over: Partial<DailyCheckIn> = {}) => ci(D, { bpPartial: [{ sys: 190, at: at(8, 9, 0) }], ...over });
  const full = (over: Partial<DailyCheckIn> = {}) => ci(D, { bpReadings: [{ sys: 190, dia: 100, at: at(8, 9, 0) }], ...over });

  it('the sheet asks "Symptoms with the high reading" when the only severe number is a saved half', () => {
    expect(visibleQuestions(BP, formFromRecord(half(), BP), half()).bpSymptoms).toBe(true);
    expect(visibleQuestions(BP, formFromRecord(full(), BP), full()).bpSymptoms).toBe(true);
    // Answered as a typo, there is nothing left to ask about.
    const typo = half({ resolutions: [answer('severeBp', `bpp:${at(8, 9, 0)}:190/`, 'mistake')] });
    expect(visibleQuestions(BP, formFromRecord(typo, BP), typo).bpSymptoms).toBe(false);
  });

  it('with symptoms, an emergency; without, no exercise today: the same as the complete reading', () => {
    for (const bpSymptoms of [true, false]) {
      const [h, f] = [half({ bpSymptoms }), full({ bpSymptoms })];
      expect(ask(BP, h, [], 'walk').disposition, String(bpSymptoms)).toBe(ask(BP, f, [], 'walk').disposition);
      expect(evaluateCheckIn(BP, h, [], NOW).reasons.some(r => r.code === 'bpEmergency')).toBe(bpSymptoms);
    }
  });
});
