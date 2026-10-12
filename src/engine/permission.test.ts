import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { DailyCheckIn, Mode } from '@/types/checkin';

import { permission, resumePermission, PERMISSION_TEXT, FRESH_MINUTES } from './permission';
import { evaluateCheckIn, profileOnlyReadiness } from './readiness';
import { bpMedicinesUnknown, deriveHealth, glucoseStartMin, profileGaps } from './health';

const DATE = '2026-10-09';
const NOW = new Date(2026, 9, 9, 18, 0, 0);
const at = (minutesBeforeNow: number) => new Date(NOW.getTime() - minutesBeforeNow * 60_000).toISOString();
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const };
const insulin: ProfileInput = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump' } };
const lowRisk: ProfileInput = { health: { ...known, diabetes: 'type2', metformin: true } };
const none: ProfileInput = { health: { ...known } };

const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
const ask = (p: ProfileInput, c: DailyCheckIn | undefined, mode: Mode = 'guided', now = NOW) => {
  const profile = createDefaultProfile(p);
  return permission({ profile, ...(c ? { checkIn: { ...c, readiness: evaluateCheckIn(profile, c) } } : {}), now }, mode);
};

describe('permission: what it needs before a start', () => {
  it('asks for a check-in when there is none today', () => {
    for (const c of [undefined, ci({ date: '2026-10-08' })]) {
      expect(ask(none, c)).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: true });
      expect(ask(none, c).reasons).toContain(PERMISSION_TEXT.noCheckIn);
    }
  });

  it(`needs an insulin or sulfonylurea user's reading to be from the last ${FRESH_MINUTES} minutes, with its time`, () => {
    expect(ask(insulin, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(29) } })).allowed).toBe(true);
    for (const glucose of [
      { value: 140, unit: 'mg/dL' as const, measuredAt: at(31) },
      { value: 140, unit: 'mg/dL' as const },
      // A time in the future is not a reading taken before the session.
      { value: 140, unit: 'mg/dL' as const, measuredAt: at(-10) },
    ]) {
      expect(ask(insulin, ci({ glucose }))).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: true });
    }
    const su: ProfileInput = { health: { ...known, diabetes: 'type2', sulfonylureaOrMeglitinide: 'unsure' } };
    expect(ask(su, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(45) } })).needsCheckIn).toBe(true);
    // Metformin alone carries no glucose mandate.
    expect(ask(lowRisk, ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(300) } })).allowed).toBe(true);
  });

  it('treats an unsure or untouched insulin answer conservatively', () => {
    const unsure: ProfileInput = { health: { ...known, diabetes: 'type2', insulin: 'unsure' } };
    expect(ask(unsure, ci()).needsCheckIn).toBe(true);
    // Type 1 means insulin, whatever the insulin field was left as.
    const type1: ProfileInput = { health: { ...known, diabetes: 'type1' } };
    expect(ask(type1, ci()).needsCheckIn).toBe(true);
  });

  it('marks a pending re-check as needing a new check-in, and a stop as not', () => {
    expect(ask(lowRisk, ci({ glucose: { value: 65, unit: 'mg/dL', measuredAt: at(1) } })).needsCheckIn).toBe(true);
    expect(ask(none, ci({ news: ['dizzy'] })).needsCheckIn).toBe(false);
    expect(ask(none, ci({ emergency: ['chest'] })).needsCheckIn).toBe(false);
  });
});

describe('permission: precedence and wording', () => {
  it('lets an emergency answer outrank a data hold and a missing check-in reading', () => {
    const unknown: ProfileInput = { health: { diabetes: 'type2' } };
    const r = ask(unknown, ci({ emergency: ['chest'] }));
    expect(r.disposition).toBe('emergency');
    expect(r.release).toBeUndefined();
    expect(r.reasons[0]).toMatch(/chest/i);
  });

  it('puts the most important reason first and gives every refusal short of an emergency a release', () => {
    const r = ask(lowRisk, ci({ news: ['dizzy', 'lowOne'], glucose: { value: 110, unit: 'mg/dL', measuredAt: at(1) } }));
    expect(r.disposition).toBe('hold');
    expect(r.reasons[0]).toMatch(/dizzy/i);
    expect(r.release).toBeTruthy();
    for (const s of r.reasons) expect(s).toMatch(/[.!?]$/);
  });

  it('asks an unreviewed profile to finish its health answers before anything else is cleared', () => {
    const r = ask({ needsHealthReview: true }, ci());
    expect(r).toMatchObject({ allowed: false, disposition: 'hold' });
    expect(r.reasons).toContain(PERMISSION_TEXT.healthUnreviewed);
  });
});

describe('permission: inside an allowed mode', () => {
  it('turns standing restrictions into words for the mode, and refuses only the mode a restriction rules out', () => {
    const foot: ProfileInput = { health: { ...known, footStatus: 'current_wound_or_active_charcot' } };
    expect(ask(foot, ci(), 'walk')).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: false });
    expect(ask(foot, ci(), 'walk').reasons).toContain(PERMISSION_TEXT.footWalk);
    expect(ask(foot, ci(), 'stretch').restrictions.join(' ')).toMatch(/seated and floor/i);
    const bp: ProfileInput = { health: { ...known, hypertension: 'treated' } };
    expect(ask(bp, ci(), 'walk').restrictions.join(' ')).toMatch(/slow down gradually/i);
  });

  it('reassures only when nothing needs adjusting', () => {
    expect(ask(none, ci())).toMatchObject({ allowed: true, disposition: 'reassure', restrictions: [] });
    expect(ask(none, ci({ sleep: 'lt5' }))).toMatchObject({ allowed: true, disposition: 'adjust' });
  });

  it('uses a clinician start target in its own unit, and ignores one that cannot be right', () => {
    const mmol: ProfileInput = { health: { ...insulin.health, clinicianTargets: { glucoseStartMin: 5.5, glucoseStartUnit: 'mmol/L' } } };
    expect(ask(mmol, ci({ glucose: { value: 95, unit: 'mg/dL', measuredAt: at(2) } })).allowed).toBe(false);
    expect(ask(mmol, ci({ glucose: { value: 100, unit: 'mg/dL', measuredAt: at(2) } })).allowed).toBe(true);
    // 5.5 with no unit would be 5.5 mg/dL, a start level inside a severe low: the default applies instead.
    const bare: ProfileInput = { health: { ...insulin.health, clinicianTargets: { glucoseStartMin: 5.5 } } };
    expect(ask(bare, ci({ glucose: { value: 85, unit: 'mg/dL', measuredAt: at(2) } })).allowed).toBe(false);
  });
});

describe('resumePermission', () => {
  it('re-checks today’s answers before a saved session resumes, without asking for a fresh reading', () => {
    const profile = createDefaultProfile(insulin);
    const rec = (c: DailyCheckIn) => ({ ...c, readiness: evaluateCheckIn(profile, c) });
    const old = rec(ci({ glucose: { value: 140, unit: 'mg/dL', measuredAt: at(90) } }));
    expect(permission({ profile, checkIn: old, now: NOW }, 'guided').allowed).toBe(false);
    expect(resumePermission({ profile, checkIn: old, now: NOW }).allowed).toBe(true);
    expect(resumePermission({ profile, checkIn: rec(ci({ emergency: ['stroke'] })), now: NOW }).disposition).toBe('emergency');
    // A low entered after the session began stops the resume.
    expect(resumePermission({ profile, checkIn: rec(ci({ glucose: { value: 62, unit: 'mg/dL', measuredAt: at(1) } })), now: NOW }).allowed).toBe(false);
  });
});

describe('medicine knowledge behind permission', () => {
  const h = (over: Partial<ReturnType<typeof createDefaultProfile>['health']>) => createDefaultProfile({ health: over }).health;

  it('counts "Not sure" as yes, and type 1 as insulin whatever the insulin answer says', () => {
    expect(deriveHealth(h({ diabetes: 'type2', sulfonylureaOrMeglitinide: 'unsure' })).hypoRisk).toBe(true);
    expect(deriveHealth(h({ diabetes: 'type2', insulin: 'unsure' })).hypoRisk).toBe(true);
    expect(deriveHealth(h({ diabetes: 'type2', sglt2i: 'unsure' })).ketoneRisk).toBe(true);
    expect(deriveHealth(h({ diabetes: 'type1' })).hypoRisk).toBe(true);
    expect(deriveHealth(h({ diabetes: 'type2' })).hypoRisk).toBe(false);
  });

  it('adds ketone risk for past ketoacidosis or insulin deficiency, not for insulin alone', () => {
    expect(deriveHealth(h({ diabetes: 'type2', insulin: 'injections_or_pump' })).ketoneRisk).toBe(false);
    expect(deriveHealth(h({ diabetes: 'type2', insulin: 'injections_or_pump', priorDkaOrInsulinDeficiency: true })).ketoneRisk).toBe(true);
    expect(deriveHealth(h({ diabetes: 'type2', priorDkaOrInsulinDeficiency: 'unsure' })).ketoneRisk).toBe(true);
  });

  it('reads a clinician start level in its own unit and refuses one inside a low', () => {
    expect(glucoseStartMin(h({ clinicianTargets: { glucoseStartMin: 120 } }))).toBe(120);
    expect(glucoseStartMin(h({ clinicianTargets: { glucoseStartMin: 5.5, glucoseStartUnit: 'mmol/L' } }))).toBeCloseTo(99, 10);
    expect(glucoseStartMin(h({ clinicianTargets: { glucoseStartMin: 5.5 } }))).toBe(90);
    expect(glucoseStartMin(h({ highHypoRisk: true }))).toBe(145);
  });

  it('treats an untouched or unreviewed medicine profile as unknown, and a non-diabetic one by its SGLT2 answer alone', () => {
    expect(profileGaps(createDefaultProfile({ health: { diabetes: 'type2' } }))).toMatchObject({ healthUnreviewed: false, medicinesUnknown: true, sglt2Unknown: false });
    expect(profileGaps(createDefaultProfile({ health: { diabetes: 'type2', medicinesReviewed: true } }))).toMatchObject({ healthUnreviewed: false, medicinesUnknown: false });
    // Without diabetes only the SGLT2 question applies; never answered, it is unknown (round 3 B08).
    expect(profileGaps(createDefaultProfile({ health: { diabetes: 'none' } }))).toMatchObject({ healthUnreviewed: false, medicinesUnknown: false, sglt2Unknown: true });
    expect(profileGaps(createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true } }))).toMatchObject({ medicinesUnknown: false, sglt2Unknown: false });
    expect(profileGaps(createDefaultProfile({ needsHealthReview: true }))).toMatchObject({ healthUnreviewed: true, medicinesUnknown: false, sglt2Unknown: false });
  });

  it('an SGLT2 answer never given, without diabetes, asks about ketoacidosis each day but holds nothing', () => {
    const unknown = createDefaultProfile({ health: { diabetes: 'none', currentlyActive: true, clearance: 'vigorous' } });
    expect(deriveHealth(unknown.health).ketoneRisk).toBe(true);
    const c = ci({});
    const r = permission({ profile: unknown, checkIn: { ...c, readiness: evaluateCheckIn(unknown, c) }, now: NOW }, 'guided');
    expect(r).toMatchObject({ allowed: true, disposition: 'adjust' });
    expect(r.reasons.join(' ')).toMatch(/medicines are not recorded/);
    const answered = createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, sglt2i: false, currentlyActive: true, clearance: 'vigorous' } });
    expect(deriveHealth(answered.health).ketoneRisk).toBe(false);
  });
});

describe('restrictions are words a screen can show as they are', () => {
  const everything: ProfileInput = {
    pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' },
    health: {
      ...known, diabetes: 'type2', insulin: 'injections_or_pump', retinopathy: 'severe_or_proliferative', peripheralNeuropathy: 'yes',
      hypertension: 'treated', betaBlocker: true, kidneyDisease: 'ckd', clearance: 'moderate',
    },
  };
  const busy = ci({
    glucose: { value: 110, unit: 'mg/dL', measuredAt: at(2) },
    back: { pain: 4, legPain: 2, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false },
    news: ['hot', 'footProblem'], sleep: 'lt5',
  });

  it('gives plain sentences, most important first, with one code for each', () => {
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      const r = ask(everything, busy, mode);
      if (!r.allowed) continue;
      expect(r.restrictions.length, mode).toBeGreaterThan(0);
      expect(r.codes, mode).toHaveLength(r.restrictions.length);
      for (const s of r.restrictions) {
        expect(s, mode).toMatch(/^[A-Z].*[.]$/);
        expect(s, mode).not.toMatch(/\b(FOOT|INT|LOAD|HEAD|IMPACT|COOL|HYPO|HEAT|MINUS_SET)\b/);
      }
    }
    const guided = ask(everything, busy, 'guided');
    expect(guided.codes?.slice(0, 2)).toEqual(['FOOT', 'HEAD']);
    expect(guided.codes!.indexOf('FOOT')).toBeLessThan(guided.codes!.indexOf('COOL'));
    expect(guided.restrictions[0]).toMatch(/seated and floor/i);
    // Walk is refused for the foot, so it carries no limits at all.
    expect(ask(everything, busy, 'walk')).toMatchObject({ allowed: false, restrictions: [], codes: [] });
  });

  it('shares one emergency wording, with no telephone number in it', () => {
    const r = ask(none, ci({ emergency: ['chest'] }));
    expect(r.reasons.join(' ')).toContain(PERMISSION_TEXT.emergencyCall);
    for (const t of [PERMISSION_TEXT.emergencyTitle, PERMISSION_TEXT.emergencyCall, PERMISSION_TEXT.emergencyNoExercise]) expect(t).not.toMatch(/\d/);
  });
});

describe('blood-pressure medicines that were never answered', () => {
  const treated = (over: Partial<ReturnType<typeof createDefaultProfile>['health']> = {}) =>
    createDefaultProfile({ health: { ...known, hypertension: 'treated', ...over } });

  it('is not read as "no", and guides by effort rather than heart rate', () => {
    expect(bpMedicinesUnknown(treated().health)).toBe(true);
    expect(bpMedicinesUnknown(treated({ bpMedicinesReviewed: true }).health)).toBe(false);
    expect(bpMedicinesUnknown(createDefaultProfile({ health: known }).health), 'nothing to ask without blood pressure').toBe(false);
    const r = profileOnlyReadiness(treated());
    expect(r.rpeOnly).toBe(true);
    expect(r.modifiers).toContain('COOL');
    expect(r.notices.join(' ')).toMatch(/not heart rate/i);
  });

  it('counts "Not sure" as taking it, and an answered no as no', () => {
    expect(profileOnlyReadiness(treated({ betaBlocker: 'unsure', bpMedicinesReviewed: true })).rpeOnly).toBe(true);
    expect(profileOnlyReadiness(treated({ betaBlocker: false, diuretic: false, bpMedicinesReviewed: true })).rpeOnly).toBe(false);
    expect(deriveHealth(treated({ hypertension: 'untreated', diuretic: 'unsure', bpMedicinesReviewed: true }).health).onBpMeds).toBe(true);
  });

  it('keeps movement available: an unanswered medicine tightens the session, it does not refuse one', () => {
    const p = { health: { ...known, hypertension: 'treated' } } satisfies ProfileInput;
    const r = ask(p, ci({ bpReadings: [{ sys: 128, dia: 80, at: at(2) }] }));
    expect(r).toMatchObject({ allowed: true, disposition: 'adjust' });
    expect(r.restrictions.join(' ')).toMatch(/effort and the talk test/i);
  });

  it('keeps fluid advice conditional until the diuretic answer is given', () => {
    const dizzy = ci({ news: ['dizzy'], bpReadings: [{ sys: 85, dia: 55, at: at(1) }] });
    const unknown = evaluateCheckIn(treated(), dizzy);
    expect(unknown.actions.join(' ')).toMatch(/unless you have a fluid limit/i);
    const answered = evaluateCheckIn(treated({ diuretic: false, betaBlocker: false, bpMedicinesReviewed: true, fluidRestriction: false }), dizzy);
    expect(answered.actions.join(' ')).toMatch(/have a drink/i);
    expect(answered.actions.join(' ')).not.toMatch(/unless you have a fluid limit/i);
  });
});

describe('scan M-01: a day started by something said during movement is not a check-in', () => {
  // What `reportSymptoms` writes when the day has no record yet: only what was said.
  const reported = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DATE, urgentSymptoms: false, news: [], ...over });

  it('every start still asks for the check-in, whatever the report held', () => {
    for (const c of [
      reported({ news: ['lowSymptoms'], lowSymptomsAt: at(20), glucose: { value: 110, unit: 'mg/dL', measuredAt: at(5) }, lowRecovered: true }),
      reported({ glucose: { value: 100, unit: 'mg/dL', measuredAt: at(1) } }),
      reported({ back: { reach: 'thigh' }, provoked: ['glute-bridge'] }),
    ]) {
      for (const mode of ['guided', 'stretch', 'walk'] as const) {
        const p = ask(none, c, mode);
        expect(p, mode).toMatchObject({ allowed: false, needsCheckIn: true });
        expect(p.reasons, mode).toContain(PERMISSION_TEXT.noCheckIn);
      }
    }
  });

  it('what it said still counts at once: an emergency stops, a felt low holds exercise under way', () => {
    expect(ask(none, reported({ emergency: ['chest'], urgentSymptoms: true }))).toMatchObject({ allowed: false, disposition: 'emergency' });
    const profile = createDefaultProfile(insulin);
    const low = reported({ news: ['lowSymptoms'], lowSymptomsAt: at(1) });
    expect(resumePermission({ profile, checkIn: { ...low, readiness: evaluateCheckIn(profile, low) }, now: NOW })).toMatchObject({ allowed: false, needsCheckIn: true });
  });

  it('answering the first question makes it one', () => {
    expect(ask(none, reported({ emergency: [] })).allowed).toBe(true);
  });
});

describe('a mode the profile alone rules out does not wait on a check-in', () => {
  const foot: ProfileInput = { health: { ...known, diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' } };

  it('a protected foot refuses walking at once, before and after a check-in', () => {
    for (const c of [undefined, ci()]) {
      const p = ask(foot, c, 'walk');
      expect(p).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: false });
      expect(p.reasons).toContain(PERMISSION_TEXT.footWalk);
    }
  });

  it('where the check-in decides, it is still asked for', () => {
    for (const mode of ['guided', 'stretch'] as const) {
      expect(ask(foot, undefined, mode), mode).toMatchObject({ allowed: false, needsCheckIn: true });
      expect(ask(foot, ci(), mode).allowed, mode).toBe(true);
    }
  });
});
