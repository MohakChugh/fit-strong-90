/**
 * The adversarial safety review of 8 October (docs/reimagine/claude-scan-2-safety.md),
 * engine part: each finding as the reviewer reproduced it, through the real
 * `permission`, `evaluateCheckIn` and plan builders.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn, EpisodeAnswer, GlucoseUnit, Mode } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { CANNOT_SWALLOW, evaluateCheckIn, TREAT } from './readiness';
import { permission, PERMISSION_TEXT, resumePermission } from './permission';
import { buildStretchPlan } from './stretch';
import { getMeta } from '@/data/catalog';
import { planFor } from '@/hooks/useGuided';
import { checkInSays } from '@/screens/track/escalation';
import { HREF, recommend } from '@/health/recommend';
import { arrivalGate, startGate } from '@/session/gate';
import { formatTime } from '@/lib/time';
import { todayLine } from '@/screens/move/preview';

const D = '2026-10-08';
const Y = '2026-10-07';
const NOW = new Date(2026, 9, 8, 9, 0, 0);
const at = (day: number, h: number, m = 0, month = 9) => new Date(2026, month, day, h, m, 0).toISOString();
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const };
const ci = (date: string, over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
const record = (p: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[] = []): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c, recent) });
const MODES: Mode[] = ['guided', 'stretch', 'walk'];
const ask = (p: UserProfile, today: DailyCheckIn | undefined, earlier: DailyCheckIn[], mode: Mode, now = NOW) =>
  permission({ profile: p, ...(today ? { checkIn: record(p, today, earlier) } : {}), now, recent: earlier }, mode);
const ids = (p: UserProfile, today: DailyCheckIn, earlier: DailyCheckIn[]) =>
  (evaluateCheckIn(p, today, earlier, NOW).episodes ?? []).flatMap(e => e.readings.map(r => ({ kind: e.kind, ...r })));
const answer = (kind: EpisodeAnswer['kind'], id: string, resolution: EpisodeAnswer['resolution']): EpisodeAnswer => ({ kind, readings: [id], resolution, at: at(8, 8, 50) });

const BACK = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: known });
const quietBack = { pain: 2, legPain: 2, reach: 'foot' as const, newNeuro: false, newWeakness: false, weaknessFast: false, newSensory: false, feverish: false, suddenSevere: false, worseFunction: false, caudaEquinaFlag: false };

describe('X2-02: a new foot drop, or sudden or feverish back pain, stands until it is answered', () => {
  for (const [what, flags, label] of [
    ['new foot drop', { newWeakness: true, newNeuro: true }, /foot drop/i],
    ['back pain with fever', { feverish: true }, /fever/i],
    ['sudden severe back pain', { suddenSevere: true, pain: 7 }, /sudden severe back pain/i],
  ] as const) {
    it(`${what} from yesterday still stops every mode after a check-in with nothing new, and is asked about by name`, () => {
      const yesterday = ci(Y, { back: { ...quietBack, ...flags } });
      const today = ci(D, { back: quietBack });
      for (const mode of MODES) expect(ask(BACK, today, [yesterday], mode), mode).toMatchObject({ allowed: false, disposition: 'today' });
      expect(ask(BACK, undefined, [yesterday], 'walk')).toMatchObject({ allowed: false, disposition: 'today' });
      const asked = ids(BACK, today, [yesterday]);
      expect(asked.map(x => x.label).join(' | ')).toMatch(label);
      expect(asked.map(x => x.label).join(' | ')).toMatch(/7 Oct/);
    });

    // Its own release, as its message says: a clinician, or a tick made by mistake; "It has gone" is not one (R5-01).
    it(`${what}: "A clinician has checked it" or "I ticked it by mistake" settles it, and nothing else does`, () => {
      const yesterday = ci(Y, { back: { ...quietBack, ...flags } });
      const today = ci(D, { back: quietBack });
      const flag = ids(BACK, today, [yesterday]).find(x => label.test(x.label))!;
      for (const resolution of ['assessed', 'mistake'] as const) {
        const answered = { ...today, resolutions: [answer(flag.kind, flag.id, resolution)] };
        expect(ask(BACK, answered, [yesterday], 'walk').allowed, resolution).toBe(true);
      }
      for (const resolution of ['resolved', 'reopened'] as const) {
        expect(ask(BACK, { ...today, resolutions: [answer(flag.kind, flag.id, resolution)] }, [yesterday], 'walk').allowed, resolution).toBe(false);
      }
    });
  }
});

describe('X2-03: a new foot sore or a hot, swollen foot keeps walking off until it has healed or been cleared', () => {
  const foot = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes' } });
  for (const item of ['footProblem', 'hotSwollenFoot'] as const) {
    it(`${item} yesterday: no walking and no weight-bearing stretch today, until it is answered`, () => {
      const yesterday = ci(Y, { news: [item] });
      const today = ci(D);
      expect(ask(foot, today, [yesterday], 'walk')).toMatchObject({ allowed: false });
      expect(ask(foot, today, [yesterday], 'stretch').allowed).toBe(true);
      const plan = buildStretchPlan({ profile: foot, date: D, startDate: '', sessions: [], checkIn: today, recentCheckIns: [yesterday], focus: 'hipsLegs', minutes: 15 });
      const loaded = plan.steps.filter(s => 'exerciseId' in s && s.kind !== 'checkpoint' && getMeta(s.exerciseId)?.flags.weightBearing);
      expect(loaded.map(s => (s as { exerciseId: string }).exerciseId)).toEqual([]);
      const sore = ids(foot, today, [yesterday]).find(x => x.kind === 'foot')!;
      expect(sore.label).toMatch(/7 Oct/);
      // A sore may heal; a hot, swollen foot needs a clinician to clear it (R5-01).
      for (const resolution of item === 'footProblem' ? ['resolved', 'assessed'] as const : ['assessed'] as const) {
        expect(ask(foot, { ...today, resolutions: [answer('foot', sore.id, resolution)] }, [yesterday], 'walk').allowed, resolution).toBe(true);
      }
      if (item === 'hotSwollenFoot') expect(ask(foot, { ...today, resolutions: [answer('foot', sore.id, 'resolved')] }, [yesterday], 'walk').allowed).toBe(false);
    });
  }
});

describe('X2-06: a severe blood pressure with new numbness or weakness in the same check-in is an emergency', () => {
  const bp = createDefaultProfile({ pain: { areas: ['lowerBack'] }, health: { ...known, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false } });
  for (const back of [{ ...quietBack, newSensory: true }, { ...quietBack, newWeakness: true, newNeuro: true }]) {
    it(JSON.stringify(back.newSensory ? 'new numbness' : 'new weakness'), () => {
      const today = ci(D, { bpReadings: [{ sys: 186, dia: 96, at: at(8, 8, 55) }], bpSymptoms: false, back });
      expect(ask(bp, today, [], 'stretch')).toMatchObject({ allowed: false, disposition: 'emergency' });
    });
  }
});

describe('X2-08: a low that runs past midnight keeps its release rules', () => {
  const insulin = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } });
  const g = (value: number, iso: string) => ({ value, unit: 'mg/dL' as const, measuredAt: iso, source: 'meter' as const });
  const night = ci(Y, { glucose: g(62, at(7, 23, 56)) });

  it('still under 70 at the re-check after midnight ends exercise for the day', () => {
    const recheck = ci(D, { glucose: g(64, at(8, 0, 12)) });
    expect(evaluateCheckIn(insulin, recheck, [night]).reasons.map(r => r.code)).toContain('lowRepeat');
    const later = ci(D, { glucose: g(95, at(8, 0, 28)), glucoseEarlier: [g(64, at(8, 0, 12))], lowRecovered: true });
    expect(ask(insulin, later, [night], 'walk', new Date(2026, 9, 8, 0, 30))).toMatchObject({ allowed: false });
  });

  it('a recovery after midnight still needs the symptoms gone and the plan saying so', () => {
    const later = ci(D, { glucose: g(92, at(8, 0, 28)), glucoseEarlier: [g(75, at(8, 0, 12))] });
    const now = new Date(2026, 9, 8, 0, 30);
    expect(ask(insulin, later, [night], 'walk', now)).toMatchObject({ allowed: false });
    expect(evaluateCheckIn(insulin, later, [night]).reasons.map(r => r.code)).toContain('lowNotRecovered');
    expect(ask(insulin, { ...later, lowRecovered: true }, [night], 'walk', now).allowed).toBe(true);
  });

  it('a low from earlier in the evening, hours before, is not carried', () => {
    const evening = ci(Y, { glucose: g(62, at(7, 19, 0)), glucoseEarlier: [], lowRecovered: true });
    const morning = ci(D, { glucose: g(130, at(8, 8, 55)) });
    expect(ask(insulin, morning, [evening], 'walk').allowed).toBe(true);
  });
});

describe('X2-09: leg symptoms that spread during a walk end walking for the day', () => {
  it('a walk the stop control reported as provoking does not resume; other modes go on', () => {
    const today = ci(D, { back: { ...quietBack, reach: 'belowKnee', spreadToday: true }, provoked: ['brisk-walking'] });
    expect(permission({ profile: BACK, checkIn: record(BACK, today), now: NOW, recent: [] }, 'walk')).toMatchObject({ allowed: false });
    expect(ask(BACK, today, [], 'stretch').allowed).toBe(true);
  });
});

describe('X2-10: an old serious reading asks whether it was settled, with no "now" instruction', () => {
  const metformin = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true } });
  const today = ci(D, { glucose: { value: 120, unit: 'mg/dL', measuredAt: at(8, 8, 50) } });

  it('a 640 from February holds movement and asks, without "call now"', () => {
    const feb = ci('2026-02-14', { glucose: { value: 640, unit: 'mg/dL', measuredAt: at(14, 10, 0, 1) } });
    const p = ask(metformin, today, [feb], 'walk');
    expect(p).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(p.reasons.join(' ')).not.toMatch(/emergency number now|now\b.*call|contact them today/i);
    expect(p.reasons.join(' ')).toMatch(/14 Feb/);
    const old = ids(metformin, today, [feb]).find(x => x.kind === 'extremeGlucose')!;
    expect(ask(metformin, { ...today, resolutions: [answer('extremeGlucose', old.id, 'resolved')] }, [feb], 'walk').allowed).toBe(true);
  });

  it('a severe low and a confirmed severe pair from months ago do the same', () => {
    const jan = ci('2026-01-10', { glucose: { value: 50, unit: 'mg/dL', measuredAt: at(10, 7, 0, 0) } });
    const mar = ci('2026-03-02', { bpReadings: [{ sys: 184, dia: 96, at: at(2, 8, 0, 2) }, { sys: 182, dia: 94, at: at(2, 8, 2, 2) }] });
    for (const old of [jan, mar]) {
      const p = ask(metformin, today, [old], 'walk');
      expect(p, old.date).toMatchObject({ allowed: false, disposition: 'hold' });
      expect(p.reasons.join(' '), old.date).not.toMatch(/today/i);
    }
  });

  it('within a day it keeps its own instruction', () => {
    const night = ci(Y, { glucose: { value: 640, unit: 'mg/dL', measuredAt: at(7, 22, 0) } });
    expect(ask(metformin, today, [night], 'walk')).toMatchObject({ allowed: false, disposition: 'emergency' });
    // "Dealt with at the time" is no answer to a reading this recent.
    const recent = ids(metformin, today, [night]).find(x => x.kind === 'extremeGlucose')!;
    expect(ask(metformin, { ...today, resolutions: [answer('extremeGlucose', recent.id, 'resolved')] }, [night], 'walk').disposition).toBe('emergency');
  });

  it('two untimed readings on different days are two incidents', () => {
    const a = ci('2026-01-10', { glucose: { value: 640, unit: 'mg/dL' } });
    const b = ci('2026-09-30', { glucose: { value: 640, unit: 'mg/dL' } });
    const found = ids(metformin, today, [a, b]).filter(x => x.kind === 'extremeGlucose').map(x => x.id);
    expect(new Set(found).size).toBe(2);
  });
});

describe('X2-14: one rule for one-leg weakness that is getting worse', () => {
  it('the engine names hours or days, as the Guide does', () => {
    const r = evaluateCheckIn(BACK, ci(D, { back: { ...quietBack, newWeakness: true, newNeuro: true, weaknessFast: true } }));
    expect(r.disposition).toBe('emergency');
    expect(r.reasons.find(x => x.code === 'weaknessFast')?.message).toMatch(/over hours or days/);
  });
});

describe('X2-16: a declared flare-up makes the guided session gentle too', () => {
  const data = (statusPeriods: { kind: 'flare'; from: string }[] = []) => ({
    version: 5, settings: { startDate: '2026-09-28', statusPeriods }, sessions: [], bodyMetrics: [], personalRecords: [],
    checkIns: [record(BACK, ci(D, { back: { ...quietBack, pain: 1, legPain: 1, reach: 'thigh' } }))], focusOverrides: {},
  }) as unknown as Parameters<typeof planFor>[0];

  it('a recovery session, saying why, while the flare lasts', () => {
    const normal = planFor(data(), BACK, D);
    const flared = planFor(data([{ kind: 'flare', from: D }]), BACK, D);
    expect(normal.kind).toBe('full');
    expect(flared.kind).toBe('recovery');
    expect(flared.changes.join(' ')).toMatch(/flare-up/i);
  });
});

describe('X2-19: messages use the person’s glucose unit', () => {
  const mmol = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', glucoseUnit: 'mmol/L' } });
  it('a 3.0 mmol/L low is told in mmol/L', () => {
    const r = evaluateCheckIn(mmol, ci(D, { glucose: { value: 3.0, unit: 'mmol/L', measuredAt: at(8, 8, 55) } }));
    const text = [...r.reasons.map(x => x.message), r.release ?? ''].join(' ');
    expect(text).not.toMatch(/mg\/dL/);
    expect(text).toMatch(/5\.0 mmol\/L/);
  });
  it('a severe low too', () => {
    const r = evaluateCheckIn(mmol, ci(D, { glucose: { value: 2.5, unit: 'mmol/L', measuredAt: at(8, 8, 55) } }));
    expect(r.reasons.map(x => x.message).join(' ')).not.toMatch(/mg\/dL/);
  });
  it('under the start level, with the low band and the level to reach, as Track quotes them', () => {
    const below = evaluateCheckIn(mmol, ci(D, { glucose: { value: 4.5, unit: 'mmol/L', measuredAt: at(8, 8, 55) } }));
    expect(below.reasons.find(x => x.code === 'belowStart')?.message).toMatch(/^Glucose under 5\.0 mmol\/L/);
    expect(below.release).toMatch(/5\.0 mmol\/L or above/);
    const low = checkInSays({ glucose: { value: 3.2, unit: 'mmol/L', measuredAt: at(8, 8, 55) } }, 'low', mmol);
    expect(low).toMatch(/from 3\.0 to under 3\.9 mmol\/L/);
    expect(low).toMatch(/5\.0 mmol\/L or above/);
    expect(low).not.toMatch(/mg\/dL/);
    // A mg/dL person is told mg/dL, as before.
    const mg = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } });
    expect(checkInSays({ glucose: { value: 60, unit: 'mg/dL', measuredAt: at(8, 8, 55) } }, 'low', mg)).toMatch(/from 54 to 69 mg\/dL.*90 mg\/dL or above/);
  });
});

describe('one 15 g sentence: every low the engine treats is told `TREAT`, word for word', () => {
  const insulin = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } });
  const mmol = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', glucoseUnit: 'mmol/L' } });
  const g = (value: number, h: number, m: number, unit: GlucoseUnit = 'mg/dL') => ({ value, unit, measuredAt: at(8, h, m), source: 'meter' as const });
  const cases: [string, UserProfile, DailyCheckIn][] = [
    ['a level 1 low', insulin, ci(D, { glucose: g(62, 8, 55) })],
    ['a severe low', insulin, ci(D, { glucose: g(50, 8, 55) })],
    ['feeling low, no reading yet', insulin, ci(D, { news: ['lowSymptoms'], lowSymptomsAt: at(8, 8, 50) })],
    ['still low at the re-check', insulin, ci(D, { glucose: g(64, 8, 50), glucoseEarlier: [g(62, 8, 30)] })],
    ['a number that may be a mg/dL low', mmol, ci(D, { glucose: g(45, 8, 55, 'mmol/L') })],
  ];
  for (const [what, p, c] of cases) {
    it(what, () => {
      const r = evaluateCheckIn(p, c, [], NOW);
      const said = [...r.actions, ...r.reasons.map(x => x.message)].filter(t => /\b15 ?g\b/.test(t));
      expect(said.length, what).toBeGreaterThan(0);
      for (const t of said) expect(t, what).toContain(TREAT);
    });
  }
});

describe('one wording for someone who cannot swallow safely, wherever 15 g is said', () => {
  it('is written once, next to `TREAT`; the screens show the constant, never a copy', () => {
    const SRC = path.resolve(__dirname, '..');
    const files = fs.readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    const copies = files.filter(f => {
      const text = fs.readFileSync(path.join(SRC, f), 'utf8');
      return text.includes(CANNOT_SWALLOW.title) || text.includes(CANNOT_SWALLOW.line);
    });
    expect(copies).toEqual([path.join('engine', 'readiness.ts')]);
  });
});

describe('J2-01: lows the app recorded in the last 24 hours count, whatever the answer', () => {
  const insulin = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } });
  const g = (value: number, day: number, h: number, m: number) => ({ value, unit: 'mg/dL' as const, measuredAt: at(day, h, m), source: 'meter' as const });
  const MORNING = new Date(2026, 9, 8, 7, 0);
  const today = ci(D, { glucose: g(118, 8, 6, 55) });
  const codes = (earlier: DailyCheckIn[], c = today) => evaluateCheckIn(insulin, c, earlier, MORNING).reasons.map(r => r.code);
  const walk = (earlier: DailyCheckIn[], c = today) => permission({ profile: insulin, checkIn: record(insulin, c, earlier), now: MORNING, recent: earlier }, 'walk');

  it('a 62 on a walk and a 64 logged at bedtime: "None" next morning is still no exercise today, and both are named', () => {
    const yesterday = ci(Y, { glucoseEarlier: [g(120, 7, 7, 30)], glucose: g(62, 7, 7, 38), logged: { glucose: [g(64, 7, 21, 30)] } });
    const p = walk([yesterday]);
    expect(p).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(p.reasons.join(' ')).toMatch(/Two or more lows in the last 24 hours/);
    expect(p.reasons.join(' ')).toContain(`Recorded in the app: 62 mg/dL at ${formatTime(7, 38)} on 7 Oct, 64 mg/dL at ${formatTime(21, 30)} on 7 Oct.`);
  });

  it('a low and its re-checks are one low; a recovery between two lows makes them two', () => {
    expect(codes([ci(Y, { glucoseEarlier: [g(62, 7, 20, 0)], glucose: g(64, 7, 20, 20) })])).toEqual(expect.arrayContaining(['oneLow']));
    expect(codes([ci(Y, { glucoseEarlier: [g(62, 7, 20, 0)], glucose: g(64, 7, 20, 20) })])).not.toContain('recentLows');
    expect(codes([ci(Y, { glucoseEarlier: [g(62, 7, 20, 0), g(95, 7, 20, 20)], glucose: g(66, 7, 21, 0) })])).toContain('recentLows');
  });

  it('a low more than a day old, or one typed wrongly, is not counted', () => {
    expect(codes([ci(Y, { glucoseEarlier: [g(60, 7, 6, 30)], glucose: g(64, 7, 21, 30) })])).not.toContain('recentLows');
    const yesterday = ci(Y, { glucoseEarlier: [g(62, 7, 7, 38)], glucose: g(50, 7, 21, 30) });
    const typo = ids(insulin, today, [yesterday]).find(x => x.kind === 'severeLow')!;
    const answered = { ...today, resolutions: [answer('severeLow', typo.id, 'mistake')] };
    expect(codes([yesterday], answered)).not.toContain('recentLows');
    expect(codes([yesterday], answered)).toContain('oneLow');
  });

  it('the answer still counts on its own', () => {
    expect(walk([], ci(D, { glucose: g(118, 8, 6, 55), news: ['lowTwoPlus'] }))).toMatchObject({ allowed: false });
    expect(codes([], ci(D, { glucose: g(118, 8, 6, 55), news: ['lowOne'] }))).toContain('oneLow');
  });

  it('J2-14: no exercise preparation next to "no more exercise today"', () => {
    expect(evaluateCheckIn(insulin, today, [], MORNING).actions.join(' ')).toMatch(/before exercise/);
    // The scan's Friday: "Two or more" answered, a reading in range.
    const r = evaluateCheckIn(insulin, ci(D, { glucose: g(118, 8, 6, 55), news: ['lowTwoPlus'] }), [], MORNING);
    expect(r.release).toBe('No more exercise today. Try again tomorrow.');
    expect(r.actions.join(' ')).not.toMatch(/before exercise|before cardio/);
  });
});

describe('J2-04: a stretch that sent leg symptoms further down ends stretching for the day', () => {
  const spread = ci(D, { back: { ...quietBack, pain: 4, legPain: 5, reach: 'foot', spreadToday: true }, provoked: ['prone-press-up'] });
  const perms = (c: DailyCheckIn) => {
    const rec = record(BACK, c);
    return { rec, permissions: { guided: permission({ profile: BACK, checkIn: rec, now: NOW, recent: [] }, 'guided'), stretch: permission({ profile: BACK, checkIn: rec, now: NOW, recent: [] }, 'stretch'), walk: permission({ profile: BACK, checkIn: rec, now: NOW, recent: [] }, 'walk') } };
  };

  it('no new stretch today; walking is not ruled out by it', () => {
    expect(ask(BACK, spread, [], 'stretch')).toMatchObject({ allowed: false, needsCheckIn: false });
    expect(ask(BACK, spread, [], 'stretch').release).toMatch(/tomorrow/);
    expect(ask(BACK, spread, [], 'walk').allowed).toBe(true);
  });

  it('the routine under way carries on without the drill that did it (acceptance J02, J16 step 6); opening the player again does not', () => {
    const input = { profile: BACK, checkIn: record(BACK, spread), now: NOW, recent: [] };
    expect(resumePermission(input, 'stretch').allowed).toBe(true);
    expect(startGate(input, 'stretch').allowed).toBe(true);
    expect(arrivalGate(input, 'stretch', true).allowed).toBe(false);
    expect(arrivalGate(input, 'stretch', false).allowed).toBe(false);
    // A walk that spread them is different: the walk itself was the movement (X2-09).
    const walked = ci(D, { back: { ...quietBack, reach: 'belowKnee', spreadToday: true }, provoked: ['brisk-walking'] });
    expect(resumePermission({ profile: BACK, checkIn: record(BACK, walked), now: NOW, recent: [] }, 'walk').allowed).toBe(false);
  });

  it('in a flare, Today says so rather than offering the stretch again', () => {
    const statusPeriods = [{ kind: 'flare' as const, from: D }];
    const { rec, permissions } = perms(spread);
    const data = { version: 5, settings: { startDate: '', statusPeriods }, sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [rec], focusOverrides: {} } as unknown as Parameters<typeof planFor>[0];
    const r = recommend({ now: NOW, settings: { startDate: '', statusPeriods }, profile: BACK, plan: planFor(data, BACK, D), sessions: [], checkIns: [rec], observations: [], saved: [], permissions });
    expect(r).toMatchObject({ kind: 'hold', title: 'No stretch for now' });
    expect(r.reason).toMatch(/further down/);
  });

  it('the Stretch setup says why, in the refusal’s own words', () => {
    const plan = buildStretchPlan({ profile: BACK, date: D, startDate: '', sessions: [], checkIn: spread, recentCheckIns: [], focus: 'backHips', minutes: 10 });
    expect(plan.kind).toBe('none');
    expect(todayLine(plan, ask(BACK, spread, [], 'stretch'))).toMatch(/^A stretch sent your leg symptoms further down today/);
  });

  it('a drill that only felt worse is left out, and other stretches stay open; spread during a lift does not end stretching', () => {
    expect(ask(BACK, ci(D, { back: quietBack, provoked: ['prone-press-up'] }), [], 'stretch').allowed).toBe(true);
    expect(ask(BACK, ci(D, { back: { ...quietBack, reach: 'belowKnee', spreadToday: true }, provoked: ['trap-bar-deadlift'] }), [], 'stretch').allowed).toBe(true);
  });
});

describe('J2-09: a profile gap refuses before any check-in, and says where to answer it', () => {
  const blank = createDefaultProfile({ needsHealthReview: true });
  it('every mode refuses at once, with the health questions as the way on', () => {
    for (const mode of MODES) {
      expect(permission({ profile: blank, now: NOW, recent: [] }, mode), mode).toMatchObject({
        allowed: false, needsCheckIn: false, reasons: [PERMISSION_TEXT.healthUnreviewed], release: 'Answer the health questions in your profile.',
      });
    }
  });
  it('with a reading to take as well, the refusal still comes first: no reading answers the profile', () => {
    const unknown = createDefaultProfile({ health: { diabetes: 'type2', glucoseMonitor: 'meter' } });
    const low = ci(D, { glucose: { value: 62, unit: 'mg/dL', measuredAt: at(8, 8, 55) } });
    const p = permission({ profile: unknown, checkIn: record(unknown, low), now: NOW, recent: [] }, 'walk');
    expect(p).toMatchObject({ allowed: false, needsCheckIn: false });
    expect(p.reasons).toContain(PERMISSION_TEXT.medicinesUnknown);
  });

  it('Today, with no profile stored yet, asks for the health questions rather than a check-in', () => {
    const permissions = { guided: permission({ profile: blank, now: NOW, recent: [] }, 'guided'), stretch: permission({ profile: blank, now: NOW, recent: [] }, 'stretch'), walk: permission({ profile: blank, now: NOW, recent: [] }, 'walk') };
    const data = { version: 5, settings: { startDate: '' }, sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {} } as unknown as Parameters<typeof planFor>[0];
    const r = recommend({ now: NOW, settings: { startDate: '' }, plan: planFor(data, blank, D), sessions: [], checkIns: [], observations: [], saved: [], permissions });
    expect(r).toMatchObject({ kind: 'hold', title: 'Finish your health profile', action: { to: HREF.profile } });
  });
});

void ({} as ProfileInput);
