/**
 * The Safety contract (docs/research/clinical-tracking-protocols.md), one
 * test per row, every boundary it names, the audit's unit table and Codex's
 * ten regression cases (docs/reimagine/codex-safety-gap.md). Policy calls
 * follow board D29; the output shape is D30.
 *
 * Each case asserts the disposition and whether each mode may start, which is
 * what a person sees, rather than a colour or exact wording.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn, Disposition, EmergencyFlag, Mode } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { evaluateCheckIn, toMgdl } from './readiness';
import { permission, resumePermission, PERMISSION_TEXT } from './permission';
import { buildCheckIn, emptyForm, formFromRecord, submitBlocked, visibleQuestions } from '@/components/checkin/form';
import { recheckCountdown } from '@/components/checkin/copy';

const DATE = '2026-10-09';
/** 09:00 local on the check-in day; every measured-at time is relative to it. */
const NOW = new Date(2026, 9, 9, 9, 0, 0);
const at = (minutesBeforeNow: number) => new Date(NOW.getTime() - minutesBeforeNow * 60_000).toISOString();
const MODES: Mode[] = ['guided', 'stretch', 'walk'];

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, bpMonitor: true };
const P = {
  /** Confirmed diet and metformin only: no hypo-causing medicine. */
  lowRisk: { health: { ...known, diabetes: 'type2', metformin: true } },
  insulin: { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } },
  sulfonylurea: { health: { ...known, diabetes: 'type2', sulfonylureaOrMeglitinide: true } },
  sglt2: { health: { ...known, diabetes: 'type2', sglt2i: true, ketoneTest: 'blood' } },
  type1: { health: { ...known, diabetes: 'type1', insulin: 'injections_or_pump', insulinRegimen: 'multipleDaily', ketoneTest: 'blood' } },
  noDiabetes: { health: { ...known } },
  back: { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { ...known } },
  neuropathy: { health: { ...known, diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes' } },
} satisfies Record<string, ProfileInput>;
const profile = (p: ProfileInput): UserProfile => createDefaultProfile(p);

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({
  date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over,
});
const mg = (value: number, minutesAgo = 5) => ({ value, unit: 'mg/dL' as const, measuredAt: at(minutesAgo) });
const mmol = (value: number, minutesAgo = 5) => ({ value, unit: 'mmol/L' as const, measuredAt: at(minutesAgo) });

const record = (p: UserProfile, c: DailyCheckIn): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c) });
const perm = (p: ProfileInput, c: DailyCheckIn, mode: Mode = 'guided', recent: DailyCheckIn[] = []) => {
  const pr = profile(p);
  return permission({ profile: pr, checkIn: record(pr, c), now: NOW, recent }, mode);
};
/** The disposition and whether each mode may start. */
const all = (p: ProfileInput, c: DailyCheckIn) => MODES.map(m => {
  const r = perm(p, c, m);
  return { mode: m, allowed: r.allowed, disposition: r.disposition };
});
const refusedEverywhere = (p: ProfileInput, c: DailyCheckIn, disposition: Disposition) =>
  expect(all(p, c)).toEqual(MODES.map(mode => ({ mode, allowed: false, disposition })));
const codes = (p: ProfileInput, c: DailyCheckIn, recent: DailyCheckIn[] = []) => evaluateCheckIn(profile(p), c, recent).reasons.map(r => r.code);
/** Anything telling the person to eat or drink. */
const ORAL = /carbohydrate|carbs|\b15 g\b|\beat\b|\bdrink\b|juice|sugar|glucose tablets/i;

describe('Safety contract, one test per row', () => {
  it('E-CARDIAC: chest pain, stroke signs, collapse without recovery or severe new breathlessness refuse every mode, whatever the readings', () => {
    for (const flag of ['chest', 'stroke', 'collapse', 'breathless'] as EmergencyFlag[]) {
      // An insulin user with no reading would otherwise be a data hold: the emergency must not wait for it.
      refusedEverywhere(P.insulin, ci({ emergency: [flag] }), 'emergency');
      expect(perm(P.insulin, ci({ emergency: [flag] }), 'stretch').restrictions).toEqual([]);
    }
    refusedEverywhere(P.noDiabetes, ci({ urgentSymptoms: true, emergency: undefined }), 'emergency');
    // A recovered faint is not the emergency; collapse without recovery is.
    expect(perm(P.noDiabetes, ci({ news: ['fainted'] })).disposition).toBe('today');
  });

  it('E-CES: retention, incontinence, saddle or genital numbness, or sexual dysfunction with radiating pain is an emergency that normal readings cannot clear', () => {
    const calm = { glucose: mg(110), bpReadings: [{ sys: 120, dia: 80 }], back: { pain: 0, newNeuro: false, caudaEquinaFlag: false } };
    for (const flag of ['bladderBowel', 'saddle'] as EmergencyFlag[]) {
      refusedEverywhere(P.lowRisk, ci({ ...calm, emergency: [flag] }), 'emergency');
      // Without any back history in the profile.
      refusedEverywhere(P.noDiabetes, ci({ emergency: [flag] }), 'emergency');
    }
    refusedEverywhere(P.back, ci({ ...calm, back: { pain: 0, newNeuro: false, caudaEquinaFlag: true } }), 'emergency');
  });

  it('E-BILATERAL: new weakness or numbness in both legs is an emergency; historical both-leg sciatica alone is not', () => {
    refusedEverywhere(P.back, ci({ emergency: ['bothLegs'] }), 'emergency');
    const history = { ...P.back, pain: { areas: ['sciatica'], sciaticaSide: 'both' } } satisfies ProfileInput;
    expect(perm(history, ci({ back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } })).allowed).toBe(true);
  });

  it('E-HYPO: a low that cannot be self-treated is an emergency with no food or drink instruction, and a past level 3 is not a present one', () => {
    const c = ci({ emergency: ['lowCantTreat'], glucose: mg(45) });
    refusedEverywhere(P.insulin, c, 'emergency');
    const r = evaluateCheckIn(profile(P.insulin), c);
    expect(r.actions.filter(a => ORAL.test(a))).toEqual([]);
    expect(perm(P.insulin, c).reasons.join(' ')).toMatch(/glucagon/i);
    // A low that needed help in the last 24 hours, now alert: help today, not emergency (D29(2)).
    expect(perm(P.insulin, ci({ news: ['lowSevere'], glucose: mg(120) })).disposition).toBe('today');
  });

  it('E-BP: a severe reading with acute symptoms is an emergency without waiting for a repeat', () => {
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 190, dia: 80, at: at(2) }], bpSymptoms: true }), 'emergency');
    // Unusual severe back pain counts as an acute symptom with a severe reading.
    refusedEverywhere(P.back, ci({
      bpReadings: [{ sys: 120, dia: 121, at: at(2) }],
      back: { pain: 7, newNeuro: false, caudaEquinaFlag: false, suddenSevere: true },
    }), 'emergency');
    // Stroke signs below the severe threshold are still an emergency (precedence example).
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 120, dia: 80 }], emergency: ['stroke'] }), 'emergency');
  });

  it('E-KETONE: blood ketones 3.0 or more, or a urine strip at moderate (2+) or more, is an emergency whatever the glucose', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 3.0 } }), 'emergency');
    for (const category of ['moderate', 'large'] as const) {
      refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'urine', category } }), 'emergency');
    }
    for (const low of [60, 50]) {
      refusedEverywhere(P.sglt2, ci({ glucose: mg(low), ketones: { kind: 'blood', value: 3.0 } }), 'emergency');
    }
  });

  it('E-DKA-SYMPTOM: vomiting with tummy pain, deep breathing, fruity breath or marked drowsiness is an emergency even at a normal glucose with ketones unknown', () => {
    refusedEverywhere(P.sglt2, ci({ emergency: ['dka'], glucose: mg(110) }), 'emergency');
  });

  it('E-EXTREME-GLUCOSE: a reading of 600 mg/dL or more is an emergency, in either unit', () => {
    refusedEverywhere(P.lowRisk, ci({ glucose: mg(600) }), 'emergency');
    refusedEverywhere(P.lowRisk, ci({ glucose: mmol(600 / 18) }), 'emergency');
    refusedEverywhere(P.lowRisk, ci({ glucose: mg(601) }), 'emergency');
  });

  it('E-OTHER: a serious accident, or confusion or difficulty waking in the heat, is an emergency; a hot day alone is not', () => {
    refusedEverywhere(P.noDiabetes, ci({ emergency: ['accident'] }), 'emergency');
    refusedEverywhere(P.noDiabetes, ci({ emergency: ['heatConfusion'] }), 'emergency');
    const hot = perm(P.noDiabetes, ci({ news: ['hot'] }), 'walk');
    expect(hot).toMatchObject({ allowed: true, disposition: 'adjust' });
  });

  it('T-BP: a severe reading confirmed by a repeat at least a minute later, without symptoms, means help today and no session', () => {
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 190, dia: 80, at: at(3) }, { sys: 186, dia: 82, at: at(1) }] }), 'today');
    // A single severe reading is not yet confirmed, but still stops every mode.
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 190, dia: 80, at: at(1) }] }), 'hold');
  });

  it('T-NEURO: new foot drop, dragging or a weakening leg means help today; fast progression or both legs is an emergency', () => {
    const b = { pain: 1, legPain: 1, reach: 'foot' as const, newNeuro: true, caudaEquinaFlag: false };
    refusedEverywhere(P.back, ci({ back: { ...b, newWeakness: true, newSensory: false } }), 'today');
    refusedEverywhere(P.back, ci({ back: { ...b, newWeakness: true, weaknessFast: true } }), 'emergency');
    refusedEverywhere(P.back, ci({ back: b, emergency: ['bothLegs'] }), 'emergency');
  });

  it('T-BACK: back pain with fever or feeling unwell, or sudden severe pain, means help today; a high pain score alone does not', () => {
    const b = { pain: 4, newNeuro: false, caudaEquinaFlag: false };
    refusedEverywhere(P.back, ci({ back: { ...b, feverish: true } }), 'today');
    refusedEverywhere(P.back, ci({ back: { ...b, suddenSevere: true } }), 'today');
    refusedEverywhere(P.back, ci({ back: b, news: ['unwell'] }), 'today');
    expect(perm(P.back, ci({ back: { ...b, pain: 8 } })).disposition).toBe('adjust');
  });

  it('T-HYPO-REVIEW: a level 2 or 3 low, or a low still under 70 at the 15-minute recheck, ends today’s session attempt', () => {
    // Level 2 earlier today, normal now: still help today.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [mg(50, 40)], glucose: mg(110, 5) }), 'today');
    // Still low at the first 15-minute recheck: the attempt ends (D29(3)), without a same-day contact demand.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [mg(65, 25)], glucose: mg(60, 8) }), 'hold');
    expect(perm(P.insulin, ci({ glucoseEarlier: [mg(65, 25)], glucose: mg(60, 8) })).release).toMatch(/tomorrow/i);
    // Another low after a documented recovery in the same attempt.
    refusedEverywhere(P.insulin, ci({ glucoseEarlier: [mg(65, 60), mg(130, 40)], glucose: mg(66, 5), lowRecovered: true }), 'hold');
  });

  it('T-KETONE: blood ketones from 1.5 to under 3.0 mean no exercise and contact the team today', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 1.5 } }), 'today');
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 2.9 } }), 'today');
  });

  it('T-ILLNESS: positive ketones while unwell, vomiting, or a high glucose that will not come down means contact the team now', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(150), ketones: { kind: 'blood', value: 0.8 }, news: ['unwell'] }), 'today');
    refusedEverywhere(P.lowRisk, ci({ news: ['vomiting'] }), 'today');
    refusedEverywhere(P.lowRisk, ci({ news: ['highNotFalling'], glucose: mg(280) }), 'today');
  });

  it('H-HYPO: a level 1 low holds for treatment and a later re-check; crossing 70 alone never releases it', () => {
    const low = ci({ glucose: mg(65, 2) });
    refusedEverywhere(P.lowRisk, low, 'hold');
    expect(perm(P.lowRisk, low).needsCheckIn).toBe(true);
    expect(evaluateCheckIn(profile(P.lowRisk), low).actions.join(' ')).toMatch(/15 g/);
    // Re-checked 16 minutes later at 95, but symptoms and plan not yet confirmed.
    const back = ci({ glucoseEarlier: [mg(65, 20)], glucose: mg(95, 4) });
    refusedEverywhere(P.lowRisk, back, 'hold');
    // Confirmed: an adjusted start.
    expect(perm(P.lowRisk, { ...back, lowRecovered: true })).toMatchObject({ allowed: true, disposition: 'adjust' });
    // A re-check taken too soon does not count.
    refusedEverywhere(P.lowRisk, ci({ glucoseEarlier: [mg(65, 12)], glucose: mg(95, 4), lowRecovered: true }), 'hold');
  });

  it('H-PRE-LOW: insulin or a sulfonylurea under 90 before exercise holds for the person’s own carbohydrate plan; metformin alone does not', () => {
    for (const p of [P.insulin, P.sulfonylurea]) {
      refusedEverywhere(p, ci({ glucose: mg(80) }), 'hold');
      expect(perm(p, ci({ glucose: mg(80) })).needsCheckIn).toBe(true);
      // No invented gram dose: the plan decides.
      expect(evaluateCheckIn(profile(p), ci({ glucose: mg(80) })).actions.join(' ')).not.toMatch(/\d+\s*(to|-)\s*\d+\s*g\b/);
    }
    expect(perm(P.lowRisk, ci({ glucose: mg(80) })).allowed).toBe(true);
  });

  it('H-HIGH: over 250 with ketones at the hold boundary or moderate urine ketones means no exercise', () => {
    expect(perm(P.sglt2, ci({ glucose: mg(260), ketones: { kind: 'blood', value: 1.5 } })).allowed).toBe(false);
    refusedEverywhere(P.sglt2, ci({ glucose: mg(260), ketones: { kind: 'urine', category: 'moderate' } }), 'emergency');
  });

  it('H-HIGH-UNCHECKED: ketone risk at 250 or more with no usable ketone result holds until tested', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(250) }), 'hold');
    expect(perm(P.sglt2, ci({ glucose: mg(250) })).needsCheckIn).toBe(true);
    const dka = { health: { ...P.insulin.health, priorDkaOrInsulinDeficiency: true } } satisfies ProfileInput;
    refusedEverywhere(dka, ci({ glucose: mg(255) }), 'hold');
    // Not every basal insulin user needs a ketone test.
    expect(perm(P.insulin, ci({ glucose: mg(255) })).allowed).toBe(true);
  });

  it('H-T2-HIGH: type 2 over 300 holds the session even without ketones', () => {
    refusedEverywhere(P.lowRisk, ci({ glucose: mg(301) }), 'hold');
    expect(perm(P.lowRisk, ci({ glucose: mg(300) })).allowed).toBe(true);
  });

  it('H-LOW-KETONE: blood ketones from 0.6 to under 1.5 hold, with a 2-hour re-check and contact now if unwell', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 0.6 } }), 'hold');
    expect(perm(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 0.6 } })).release).toMatch(/2 hours/);
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: 0.6 }, news: ['unwell'] }), 'today');
  });

  it('H-EXERCISE-BP: resting above 160 or above 100 holds every mode unless a clinician has permitted that level (D29(4))', () => {
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 161, dia: 80 }] }), 'hold');
    refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ sys: 150, dia: 101 }] }), 'hold');
    const permitted = { health: { ...known, bpExercisePermission: { sys: 170, dia: 105 } } } satisfies ProfileInput;
    expect(all(permitted, ci({ bpReadings: [{ sys: 165, dia: 95 }] })).every(x => x.allowed && x.disposition === 'adjust')).toBe(true);
    // A clinician's lower stop limit holds too.
    const stop = { health: { ...known, clinicianTargets: { bpStopSystolic: 150 } } } satisfies ProfileInput;
    refusedEverywhere(stop, ci({ bpReadings: [{ sys: 155, dia: 85 }] }), 'hold');
  });

  it('H-DIZZY: dizziness on standing or during activity holds regardless of blood pressure', () => {
    refusedEverywhere(P.noDiabetes, ci({ news: ['dizzy'], bpReadings: [{ sys: 110, dia: 70 }] }), 'hold');
    refusedEverywhere(P.noDiabetes, ci({ news: ['dizzy'], bpReadings: [{ sys: 85, dia: 55 }] }), 'hold');
    // Asymptomatic low BP keeps its existing comfort adjustment.
    expect(perm(P.noDiabetes, ci({ bpReadings: [{ sys: 85, dia: 55 }] }))).toMatchObject({ allowed: true, disposition: 'adjust' });
  });

  it('H-FOOT/EYE: a hot swollen or wounded foot refuses Walk but keeps seated work; a severe eye restriction keeps the head up', () => {
    const foot = ci({ news: ['hotSwollenFoot'] });
    expect(perm(P.neuropathy, foot, 'walk')).toMatchObject({ allowed: false, disposition: 'hold' });
    for (const m of ['guided', 'stretch'] as const) {
      const r = perm(P.neuropathy, foot, m);
      expect(r).toMatchObject({ allowed: true, disposition: 'adjust' });
      expect(r.restrictions.join(' ')).toMatch(/seated and floor/i);
    }
    const wound = { health: { ...known, footStatus: 'current_wound_or_active_charcot' } } satisfies ProfileInput;
    expect(perm(wound, ci(), 'walk').allowed).toBe(false);
    const eye = { health: { ...known, retinopathy: 'severe_or_proliferative' } } satisfies ProfileInput;
    expect(perm(eye, ci(), 'guided').restrictions.join(' ')).toMatch(/head-down/i);
    expect(perm(eye, ci(), 'walk').allowed).toBe(true);
    const treated = { health: { ...known, retinopathy: 'recent_eye_treatment' } } satisfies ProfileInput;
    refusedEverywhere(treated, ci(), 'hold');
  });

  it('H-DATA: unknown medicines, a missing or stale required reading, an unknown unit, HI, or symptoms a sensor does not show are never labelled safe', () => {
    const unknown = { health: { diabetes: 'type2', clearance: 'vigorous' } } satisfies ProfileInput;
    refusedEverywhere(unknown, ci({ glucose: mg(110) }), 'hold');
    expect(perm(unknown, ci({ glucose: mg(110) })).reasons).toContain(PERMISSION_TEXT.medicinesUnknown);
    refusedEverywhere(P.insulin, ci(), 'hold');
    expect(perm(P.insulin, ci()).needsCheckIn).toBe(true);
    // Stale (D29(6): insulin or a sulfonylurea needs a reading from the last 30 minutes).
    refusedEverywhere(P.insulin, ci({ glucose: mg(140, 45) }), 'hold');
    refusedEverywhere(P.sulfonylurea, ci({ glucose: { value: 140, unit: 'mg/dL' } }), 'hold');
    expect(perm(P.insulin, ci({ glucose: mg(140, 30) })).allowed).toBe(true);
    // An unknown unit is rejected, not read as mmol/L.
    refusedEverywhere(P.lowRisk, ci({ glucose: { value: 5.5, unit: 'mmol' as never, measuredAt: at(2) } }), 'hold');
    refusedEverywhere(P.lowRisk, ci({ glucoseDisplay: { display: 'HI', measuredAt: at(2) } }), 'hold');
    refusedEverywhere(P.lowRisk, ci({ glucoseEarlier: [{ display: 'HI', measuredAt: at(30) }], glucoseDisplay: { display: 'HI', measuredAt: at(2) } }), 'today');
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value: -0.2 } }), 'hold');
    refusedEverywhere(P.insulin, ci({ glucose: { ...mg(110), source: 'sensor' }, news: ['lowSymptoms'] }), 'hold');
    // Confirmed low-risk treatment never acquires a glucose mandate (D29(5)).
    expect(perm(P.lowRisk, ci()).allowed).toBe(true);
  });

  it('A-BACK: worse function or further spread withholds progression without a pain-score permission rule', () => {
    const b = { pain: 1, legPain: 1, reach: 'thigh' as const, newNeuro: false, caudaEquinaFlag: false };
    const worse = perm(P.back, ci({ back: { ...b, worseFunction: true } }));
    expect(worse).toMatchObject({ allowed: true, disposition: 'adjust' });
    expect(worse.restrictions.join(' ')).toMatch(/no progression/i);
    const yesterday = ci({ date: '2026-10-08', back: { ...b, reach: 'buttock' } });
    expect(codes(P.back, ci({ back: { ...b, reach: 'belowKnee' } }), [yesterday])).toContain('spread');
    // New tingling or numbness alone: no guided session, gentle stretch or walk allowed.
    const sensory = ci({ back: { ...b, newNeuro: true, newSensory: true, newWeakness: false } });
    expect(perm(P.back, sensory, 'guided').allowed).toBe(false);
    expect(perm(P.back, sensory, 'stretch')).toMatchObject({ allowed: true, disposition: 'adjust' });
    // Pain bands are comfort adjustments only: a low score never defers a red flag (D29(7)).
    refusedEverywhere(P.back, ci({ back: { ...b, pain: 0, legPain: 0, newWeakness: true } }), 'today');
  });
});

describe('Boundary and precedence tests', () => {
  it('glucose exactly 54 is level 1; below 54 is level 2', () => {
    expect(perm(P.lowRisk, ci({ glucose: mg(54) })).disposition).toBe('hold');
    expect(perm(P.lowRisk, ci({ glucose: mg(53.9) })).disposition).toBe('today');
  });

  it('glucose exactly 70 is not a biochemical hypo, but is still a pre-exercise hold in a risk group', () => {
    expect(perm(P.lowRisk, ci({ glucose: mg(70) })).allowed).toBe(true);
    expect(codes(P.insulin, ci({ glucose: mg(70) }))).toContain('belowStart');
    expect(codes(P.insulin, ci({ glucose: mg(70) }))).not.toContain('low');
  });

  it('blood ketones exactly 1.5 meet T-KETONE and exactly 3.0 meet E-KETONE', () => {
    const k = (value: number) => perm(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'blood', value } })).disposition;
    expect([k(0.59), k(0.6), k(1.49), k(1.5), k(2.99), k(3.0)]).toEqual(['reassure', 'hold', 'hold', 'today', 'today', 'emergency']);
  });

  it('BP 180/80 or 120/120 meets the severe rule on either component', () => {
    for (const r of [{ sys: 180, dia: 80 }, { sys: 120, dia: 120 }]) {
      refusedEverywhere(P.noDiabetes, ci({ bpReadings: [{ ...r, at: at(2) }, { ...r, at: at(1) }] }), 'today');
      refusedEverywhere(P.noDiabetes, ci({ bpReadings: [r], bpSymptoms: true }), 'emergency');
    }
    expect(codes(P.noDiabetes, ci({ bpReadings: [{ sys: 179, dia: 80 }, { sys: 179, dia: 80 }] }))).not.toContain('bpSevere');
    expect(codes(P.noDiabetes, ci({ bpReadings: [{ sys: 120, dia: 119 }, { sys: 120, dia: 119 }] }))).not.toContain('bpSevere');
  });

  it('BP exactly 160/100 does not meet the strict hold, but keeps its comfort restrictions', () => {
    const r = perm(P.noDiabetes, ci({ bpReadings: [{ sys: 160, dia: 100 }] }));
    expect(r).toMatchObject({ allowed: true, disposition: 'adjust' });
    expect(r.restrictions.join(' ')).toMatch(/head-down/i);
    expect(perm(P.noDiabetes, ci({ bpReadings: [{ sys: 161, dia: 100 }] })).allowed).toBe(false);
    expect(perm(P.noDiabetes, ci({ bpReadings: [{ sys: 160, dia: 101 }] })).allowed).toBe(false);
  });

  it('severe individual readings are judged before any average', () => {
    // 190/80 and 150/85 average 170/83, which is below the severe line.
    expect(perm(P.noDiabetes, ci({ bpReadings: [{ sys: 190, dia: 80 }, { sys: 150, dia: 85 }], bp: { sys: 170, dia: 83 } })).allowed).toBe(false);
    expect(codes(P.noDiabetes, ci({ bpReadings: [{ sys: 190, dia: 80 }, { sys: 150, dia: 85 }] }))).toContain('bpSevereUnconfirmed');
  });

  it('new bladder or saddle symptoms with glucose in target still trigger E-CES; stroke signs below the severe BP line still trigger E-CARDIAC', () => {
    expect(perm(P.lowRisk, ci({ emergency: ['saddle'], glucose: mg(110) })).disposition).toBe('emergency');
    expect(perm(P.noDiabetes, ci({ emergency: ['stroke'], bpReadings: [{ sys: 118, dia: 76 }] })).disposition).toBe('emergency');
  });

  it('familiar left sciatica and a reassuring profile cannot cancel an acute red flag', () => {
    expect(perm(P.back, ci({ emergency: ['bladderBowel'], back: { pain: 1, legPain: 1, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } })).disposition).toBe('emergency');
  });
});

describe('Unit table: 54, 70, 90, 250, 300 and 600 mg/dL, each side, in both units', () => {
  /** [boundary, profile, below, at, above] — expected dispositions. */
  const TABLE: [number, ProfileInput, Disposition, Disposition, Disposition][] = [
    [54, P.lowRisk, 'today', 'hold', 'hold'],
    [70, P.lowRisk, 'hold', 'reassure', 'reassure'],
    // An insulin user under 126 keeps fast carbs to hand: adjusted, not reassured.
    [90, P.insulin, 'hold', 'adjust', 'adjust'],
    // Above 180 is above target even where exercise may go ahead.
    [250, P.sglt2, 'adjust', 'hold', 'hold'],
    [300, P.lowRisk, 'adjust', 'adjust', 'hold'],
    [600, P.lowRisk, 'hold', 'emergency', 'emergency'],
  ];

  for (const [b, p, below, exact, above] of TABLE) {
    for (const [label, value, expected] of [['below', b - 0.1, below], ['at', b, exact], ['above', b + 0.1, above]] as const) {
      it(`${label} ${b} mg/dL (${value}) → ${expected}, and the same at ${value}/18 mmol/L`, () => {
        const inMg = perm(p, ci({ glucose: mg(value) }));
        const inMmol = perm(p, ci({ glucose: mmol(value / 18) }));
        expect(inMg.disposition).toBe(expected);
        expect(inMmol.disposition).toBe(expected);
        expect(inMmol.allowed).toBe(inMg.allowed);
        expect(codes(p, ci({ glucose: mmol(value / 18) }))).toEqual(codes(p, ci({ glucose: mg(value) })));
      });
    }
  }

  it('converts without rounding and rejects an unknown unit', () => {
    expect(toMgdl(89.9 / 18, 'mmol/L')).toBeCloseTo(89.9, 10);
    expect(toMgdl(5.5, 'mmol/L')).toBe(99);
    expect(() => toMgdl(5.5, 'mmol' as never)).toThrow();
  });
});

describe('Audit masking cases (codex-safety-gap.md, "Outcome ordering and masking")', () => {
  it('insulin and an SGLT2 inhibitor, glucose 80 and blood ketones 3.0: an emergency with no exercise advice and no re-check timer', () => {
    const both = { health: { ...P.insulin.health, sglt2i: true, ketoneTest: 'blood' } } satisfies ProfileInput;
    const c = ci({ glucose: mg(80, 2), ketones: { kind: 'blood', value: 3.0 } });
    refusedEverywhere(both, c, 'emergency');
    const r = evaluateCheckIn(profile(both), c);
    expect(r.actions.join(' ')).not.toMatch(/before exercise|before cardio|strength work/i);
    expect(recheckCountdown(perm(both, c), r, NOW)).toBeNull();
    // The same timer does count down on an ordinary hold.
    const hold = ci({ glucose: mg(80, 2) });
    expect(recheckCountdown(perm(P.insulin, hold), evaluateCheckIn(profile(P.insulin), hold), NOW)).toMatchObject({ minutes: 13 });
  });

  it('asks about ketoacidosis signs for an SGLT2 inhibitor taken without diabetes', () => {
    const heart = profile({ health: { ...known, sglt2i: true } });
    expect(visibleQuestions(heart, emptyForm(heart)).emergency).toContain('dka');
    expect(visibleQuestions(profile(P.noDiabetes), emptyForm(profile(P.noDiabetes))).emergency).not.toContain('dka');
  });
});

describe('Codex regression cases', () => {
  it('1. Chest pain/stroke flag true and glucose 900 mg/dL or 99 mmol/L mistakenly entered; alternatively a cauda flag true with the same invalid entry → Emergency now, all sessions refused; emergency guidance must not wait for unit correction', () => {
    const p = profile(P.insulin);
    for (const emergency of [['chest'], ['stroke'], ['bladderBowel']] as EmergencyFlag[][]) {
      for (const [glucose, unit] of [['900', 'mg/dL'], ['99', 'mmol/L']] as const) {
        const form = { ...emptyForm(p), emergency, glucose, unit };
        // Nothing stops an emergency answer being saved.
        expect(submitBlocked(form, { profile: p })).toBeNull();
        const c = buildCheckIn(form, { date: DATE, profile: p, now: NOW });
        expect(c.emergency).toEqual(emergency);
        for (const mode of MODES) {
          expect(permission({ profile: p, checkIn: record(p, c), now: NOW }, mode)).toMatchObject({ allowed: false, disposition: 'emergency' });
        }
      }
    }
  });

  it('2. Saved check-in has back.caudaEquinaFlag=true, pain 0 and glucose 110; edit with profile pain.areas=[] and resubmit; route variant: a new urgent check-in after a runnable plan → Emergency retained, no session; a profile edit or saved plan is not clinical resolution', () => {
    const before = profile({ ...P.back, health: { ...P.lowRisk.health } });
    const saved = record(before, ci({ glucose: mg(110), back: { pain: 0, newNeuro: false, caudaEquinaFlag: true } }));
    const after = profile({ ...P.lowRisk, pain: { areas: [] } });
    const resubmitted = buildCheckIn(formFromRecord(saved), { date: DATE, profile: after, previous: saved, now: NOW });
    expect(resubmitted.back?.caudaEquinaFlag).toBe(true);
    expect(permission({ profile: after, checkIn: record(after, resubmitted), now: NOW }, 'stretch').disposition).toBe('emergency');
    // Resuming a saved plan re-asks the current check-in.
    const urgent = record(after, ci({ emergency: ['chest'] }));
    expect(resumePermission({ profile: after, checkIn: urgent, now: NOW })).toMatchObject({ allowed: false, disposition: 'emergency' });
    expect(resumePermission({ profile: after, checkIn: record(after, ci({ glucose: mg(110) })), now: NOW }).allowed).toBe(true);
  });

  it('3. Type 2, new foot drop/dragging; closest payload back={pain:1, legPain:1, reach:"foot", newNeuro:true, caudaEquinaFlag:false} → Help today, no recovery/stretch/walk session; rapidly progressive/bilateral/CES additions escalate', () => {
    const b = { pain: 1, legPain: 1, reach: 'foot' as const, newNeuro: true, caudaEquinaFlag: false };
    const p = { ...P.lowRisk, pain: { areas: ['sciatica'], sciaticaSide: 'left' } } satisfies ProfileInput;
    refusedEverywhere(p, ci({ glucose: mg(120), back: b }), 'today');
    refusedEverywhere(p, ci({ glucose: mg(120), back: { ...b, newWeakness: true } }), 'today');
    refusedEverywhere(p, ci({ glucose: mg(120), back: { ...b, newWeakness: true, weaknessFast: true } }), 'emergency');
    refusedEverywhere(p, ci({ glucose: mg(120), back: b, emergency: ['bothLegs'] }), 'emergency');
    refusedEverywhere(p, ci({ glucose: mg(120), back: b, emergency: ['saddle'] }), 'emergency');
  });

  it('4. SGLT2 profile, glucose 60 mg/dL, blood ketones exactly 3.0 mmol/L, no global urgent flag; parameterise glucose 50 too → Emergency, ketone contribution retained alongside safe hypo rescue', () => {
    for (const [value, hypoCode] of [[60, 'low'], [50, 'severeLow']] as const) {
      const c = ci({ glucose: mg(value), ketones: { kind: 'blood', value: 3.0 } });
      refusedEverywhere(P.sglt2, c, 'emergency');
      expect(codes(P.sglt2, c)).toEqual(expect.arrayContaining(['ketonesUrgent', hypoCode]));
      expect(evaluateCheckIn(profile(P.sglt2), c).actions.join(' ')).toMatch(/15 g/);
    }
  });

  it('5. Actual urine strip says 2+, with manufacturer-specific moderate marking 40 mg/dL, normal glucose; select current Moderate option → Emergency under the raw urine category policy; do not derive blood mmol/L', () => {
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'urine', category: 'moderate' } }), 'emergency');
    // A record saved by the old sheet (value 40 for its "Moderate" chip) is read back as that chip, not as blood ketones.
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'urine', value: 40 } }), 'emergency');
    // "Small" is a positive result to hold on, not a guessed blood level.
    refusedEverywhere(P.sglt2, ci({ glucose: mg(110), ketones: { kind: 'urine', category: 'small' } }), 'hold');
    const p = profile(P.sglt2);
    const form = { ...emptyForm(p), emergency: [], glucose: '110', urineKetones: 'moderate' as const };
    expect(buildCheckIn(form, { date: DATE, profile: { ...p, health: { ...p.health, ketoneTest: 'urine' } }, now: NOW }).ketones).toEqual({ kind: 'urine', category: 'moderate', measuredAt: NOW.toISOString() });
  });

  it('6. Correctly obtained resting BP 190/80, then 150/121 at least 1 minute later, no acute symptoms; feed through the sheet → Help today and no session because each repeat has a severe component; diagnostic average is secondary', () => {
    const p = profile(P.noDiabetes);
    const form = { ...emptyForm(p), emergency: [], bp: { s1: '190', d1: '80', s2: '150', d2: '121' } };
    const c = buildCheckIn(form, { date: DATE, profile: p, now: NOW });
    expect(c.bpReadings?.map(r => [r.sys, r.dia])).toEqual([[190, 80], [150, 121]]);
    expect(c.bp).toEqual({ sys: 170, dia: 101 });
    for (const mode of MODES) {
      expect(permission({ profile: p, checkIn: record(p, c), now: NOW }, mode)).toMatchObject({ allowed: false, disposition: 'today' });
    }
  });

  it('7. Known type 2, reliable glucose exactly 600 mg/dL or exactly 600/18 mmol/L; no other urgent flags → Emergency, no moderate or recovery fallback; a reliable 601 mg/dL cannot become reassuring through sanity rejection', () => {
    for (const glucose of [mg(600), mmol(600 / 18), mg(601)]) {
      refusedEverywhere(P.lowRisk, ci({ glucose }), 'emergency');
      expect(evaluateCheckIn(profile(P.lowRisk), ci({ glucose })).outcome).toBe('urgent');
    }
  });

  it('8. Known insulin profile, compare 89.9 mg/dL with 89.9/18 mmol/L, no ketones/symptoms and default start target → Hold in both units, pending the existing plan, a usable recheck and applicable release', () => {
    for (const glucose of [mg(89.9), mmol(89.9 / 18)]) {
      refusedEverywhere(P.insulin, ci({ glucose }), 'hold');
      expect(perm(P.insulin, ci({ glucose })).needsCheckIn).toBe(true);
      expect(codes(P.insulin, ci({ glucose }))).toContain('belowStart');
    }
  });

  it('9. Type 2 profile with needsHealthReview=true, medicine flags still default false/none, no glucose/recorded monitoring plan; additionally a known insulin profile with its required pre-session reading absent → Data hold; confirmed low-risk treatment remains a nonblocking control case', () => {
    const unreviewed = { health: { diabetes: 'type2', clearance: 'vigorous' }, needsHealthReview: true } satisfies ProfileInput;
    refusedEverywhere(unreviewed, ci(), 'hold');
    expect(perm(unreviewed, ci()).reasons).toContain(PERMISSION_TEXT.healthUnreviewed);
    refusedEverywhere(P.insulin, ci(), 'hold');
    expect(perm(P.lowRisk, ci())).toMatchObject({ allowed: true, disposition: 'reassure' });
  });

  it('10. Same session attempt: reliable glucose 50 mg/dL, then a later 110 without clinical review; separate variant: initial 65, rescue, still 60 at the 15 minute recheck → End session and help today under T-HYPO-REVIEW; a normal number must not erase the level 2 event, and the persistent-low policy is explicit', () => {
    const p = profile(P.insulin);
    // Through the sheet: the 50 is saved, then "Change answers" puts in 110.
    const first = buildCheckIn({ ...emptyForm(p), emergency: [], glucose: '50' }, { date: DATE, profile: p, now: new Date(NOW.getTime() - 30 * 60_000) });
    const saved = record(p, first);
    const second = buildCheckIn({ ...formFromRecord(saved), glucose: '110', glucoseAt: at(2) }, { date: DATE, profile: p, previous: saved, now: NOW });
    expect(second.glucoseEarlier?.some(g => 'value' in g && g.value === 50)).toBe(true);
    for (const mode of MODES) {
      expect(permission({ profile: p, checkIn: record(p, second), now: NOW }, mode)).toMatchObject({ allowed: false, disposition: 'today' });
    }
    const persistent = ci({ glucoseEarlier: [mg(65, 20)], glucose: mg(60, 4) });
    refusedEverywhere(P.insulin, persistent, 'hold');
    expect(codes(P.insulin, persistent)).toContain('lowRepeat');
    expect(perm(P.insulin, persistent).reasons.join(' ')).toMatch(/tell your care team if lows keep happening/i);
  });
});
