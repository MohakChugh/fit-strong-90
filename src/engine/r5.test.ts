/**
 * Codex's final safety reconciliation (docs/reimagine/codex-final-reconcile-safety.md),
 * each finding as it reproduced it, through the real engine, gates, Today's
 * recommendation, the walk's history and the player's plan reconciliation.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn, EpisodeAnswer, EpisodeResolution, NewsItem, RedFlag } from '@/types/checkin';
import type { CardioStep, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { evaluateCheckIn, profileOnlyReadiness, withLogged } from './readiness';
import { permission, resumePermission } from './permission';
import { buildSessionPlan } from './session';
import { answerEpisode, buildCheckIn, carryForward, emptyForm, formFromRecord, type CheckInForm } from '@/components/checkin/form';
import { effectiveRecord } from '@/components/checkin/pending';
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
