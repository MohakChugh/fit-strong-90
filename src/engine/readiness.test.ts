import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { OUTCOME_ORDER } from '@/types/checkin';
import type { DailyCheckIn } from '@/types/checkin';
import { evaluateCheckIn, glucoseSanity, toMgdl, profileOnlyReadiness } from './readiness';

const base: DailyCheckIn = { date: '2026-10-09', urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4 };
const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ ...base, ...over });

const insulinUser: ProfileInput = {
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'vigorous' },
};
const metforminUser: ProfileInput = {
  health: { diabetes: 'type2', currentlyActive: true, clearance: 'vigorous' },
};
const type1: ProfileInput = {
  health: { diabetes: 'type1', insulin: 'injections_or_pump', ketoneTest: 'blood', currentlyActive: true, clearance: 'vigorous' },
};
const backUser: ProfileInput = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' } };

const evalWith = (p: ProfileInput, c: Partial<DailyCheckIn>, recent: DailyCheckIn[] = []) =>
  evaluateCheckIn(createDefaultProfile(p), ci(c), recent);

describe('glucose units (Review Focus #1)', () => {
  it('converts mmol/L to mg/dL', () => {
    expect(toMgdl(5.5, 'mmol/L')).toBe(99);
    expect(toMgdl(99, 'mg/dL')).toBe(99);
  });

  it.each([
    [5.5, 'mg/dL', 'ambiguousLow'],
    [25, 'mg/dL', 'ambiguousLow'],
    [34, 'mg/dL', 'ok'],
    [99, 'mmol/L', 'suspectUnit'],
    [99, 'mg/dL', 'ok'],
    [5.5, 'mmol/L', 'ok'],
    [0, 'mg/dL', 'implausible'],
    [900, 'mg/dL', 'implausible'],
  ] as const)('%s %s → %s', (v, u, expected) => {
    expect(glucoseSanity(v, u)).toBe(expected);
  });

  it('lands 5.5 mmol/L and 99 mg/dL in the same band', () => {
    const a = evalWith(insulinUser, { glucose: { value: 5.5, unit: 'mmol/L' } });
    const b = evalWith(insulinUser, { glucose: { value: 99, unit: 'mg/dL' } });
    expect(a.outcome).toBe(b.outcome);
    expect(a.actions).toEqual(b.actions);
  });

  // An ambiguous low fails safe: a real 25 mg/dL needs carbs now, and a
  // mis-typed 5.5 mmol/L costs only a snack and a re-check.
  it.each([25, 5.5])('treats %s mg/dL as a severe low and offers the unit fix', value => {
    const r = evalWith(insulinUser, { glucose: { value, unit: 'mg/dL' } });
    expect(r.outcome).toBe('red');
    expect(r.reasons.map(x => x.code)).toContain('severeLow');
    expect(r.actions.join(' ')).toMatch(/15 g of fast-acting carbohydrate/);
    expect(r.actions.join(' ')).toMatch(/mmol\/L/);
  });

  it('never clears a reading under 34 mg/dL for exercise', () => {
    for (const value of [20, 25, 30, 33]) {
      for (const p of [insulinUser, createDefaultProfile({ health: { diabetes: 'type2' } })]) {
        expect(evalWith(p, { glucose: { value, unit: 'mg/dL' } }).outcome).toBe('red');
      }
    }
  });
});

describe('pre-session glucose for insulin users (spec §4.6)', () => {
  it.each([
    [50, 'red', []],
    [60, 'amber', ['HYPO', 'INT']],
    [80, 'green', ['HYPO']],
    [110, 'green', ['HYPO']],
    [150, 'green', []],
    [220, 'green', []],
    [320, 'amber', ['INT', 'LOAD']],
  ] as const)('%i mg/dL → %s', (mg, outcome, mods) => {
    const r = evalWith(insulinUser, { glucose: { value: mg, unit: 'mg/dL' } });
    expect(r.outcome).toBe(outcome);
    for (const m of mods) expect(r.modifiers).toContain(m);
  });

  it('asks for treat-and-recheck below the start threshold', () => {
    expect(evalWith(insulinUser, { glucose: { value: 80, unit: 'mg/dL' } }).recheckMinutes).toBe(15);
    expect(evalWith(insulinUser, { glucose: { value: 62, unit: 'mg/dL' } }).recheckMinutes).toBe(15);
  });

  it('respects a clinician start target', () => {
    const r = evalWith(
      { health: { ...insulinUser.health, clinicianTargets: { glucoseStartMin: 120 } } },
      { glucose: { value: 110, unit: 'mg/dL' } },
    );
    expect(r.recheckMinutes).toBe(15);
  });

  it('uses the higher carbohydrate threshold for high hypo risk', () => {
    const normal = evalWith(insulinUser, { glucose: { value: 140, unit: 'mg/dL' } });
    const high = evalWith({ health: { ...insulinUser.health, highHypoRisk: true } }, { glucose: { value: 140, unit: 'mg/dL' } });
    expect(normal.modifiers).not.toContain('HYPO');
    expect(high.modifiers).toContain('HYPO');
  });

  it('delays a start when a CGM shows glucose falling under 126', () => {
    const r = evalWith(insulinUser, { glucose: { value: 115, unit: 'mg/dL', trend: 'fastFall' } });
    expect(r.recheckMinutes).toBe(15);
  });

  it('is amber with HYPO when an insulin user has no reading', () => {
    const r = evalWith(insulinUser, {});
    expect(r.outcome).toBe('amber');
    expect(r.modifiers).toEqual(expect.arrayContaining(['HYPO', 'INT']));
  });

  it('needs no carbs and no reading on low-risk medicines', () => {
    expect(evalWith(metforminUser, {}).outcome).toBe('green');
    expect(evalWith(metforminUser, { glucose: { value: 100, unit: 'mg/dL' } }).modifiers).not.toContain('HYPO');
  });

  it('still applies the < 70 row on low-risk medicines', () => {
    expect(evalWith(metforminUser, { glucose: { value: 65, unit: 'mg/dL' } }).outcome).toBe('amber');
  });
});

describe('ketones (type 1 and SGLT2)', () => {
  it.each([
    [0.3, 'green'],
    [0.8, 'red'],
    [1.8, 'red'],
    [3.2, 'urgent'],
  ] as const)('ketones %s at 260 mg/dL → %s', (k, outcome) => {
    expect(evalWith(type1, { glucose: { value: 260, unit: 'mg/dL' }, ketones: { value: k, kind: 'blood' } }).outcome).toBe(outcome);
  });

  it('allows recovery only for type 1 at ≥ 250 without a ketone test', () => {
    expect(evalWith(type1, { glucose: { value: 260, unit: 'mg/dL' } }).outcome).toBe('recovery');
  });

  it('is amber above 270 with negative ketones', () => {
    expect(evalWith(type1, { glucose: { value: 290, unit: 'mg/dL' }, ketones: { value: 0.2, kind: 'blood' } }).outcome).toBe('amber');
  });
});

describe('check-in news items', () => {
  it.each([
    ['unwell', 'red'],
    ['lowSevere', 'red'],
    ['lowTwoPlus', 'red'],
    ['lowOne', 'amber'],
    ['fainted', 'red'],
    ['dizzy', 'amber'],
    ['footProblem', 'amber'],
    ['unusualFatigue', 'red'],
    ['hot', 'green'],
  ] as const)('%s → %s', (item, outcome) => {
    expect(evalWith(insulinUser, { news: [item], glucose: { value: 150, unit: 'mg/dL' } }).outcome).toBe(outcome);
  });

  it('adds the matching modifiers', () => {
    expect(evalWith({}, { news: ['dizzy'] }).modifiers).toEqual(expect.arrayContaining(['COOL', 'INT']));
    expect(evalWith({}, { news: ['footProblem'] }).modifiers).toContain('FOOT');
    expect(evalWith({}, { news: ['hot'] }).modifiers).toContain('HEAT');
  });

  it('asks a ketone-risk user who is unwell to check ketones', () => {
    expect(evalWith(type1, { news: ['unwell'] }).actions.join(' ')).toMatch(/ketones/i);
  });
});

describe('blood pressure (spec §4.7)', () => {
  it.each([
    [[120, 80], 'green'],
    [[145, 85], 'amber'],
    [[150, 95], 'amber'],
    [[165, 95], 'amber'],
    [[182, 100], 'red'],
    [[170, 112], 'red'],
    [[185, 125], 'red'],
    [[85, 55], 'amber'],
  ] as const)('%o → %s', ([sys, dia], outcome) => {
    expect(evalWith({}, { bp: { sys, dia } }).outcome).toBe(outcome);
  });

  it('blocks intervals and heavy lifts from 140/90', () => {
    const r = evalWith({}, { bp: { sys: 145, dia: 85 } });
    expect(r.modifiers).toContain('INT');
    expect(r.capHeavy).toBe(true);
  });

  it('adds LOAD, HEAD and COOL from 160/100', () => {
    expect(evalWith({}, { bp: { sys: 165, dia: 95 } }).modifiers).toEqual(expect.arrayContaining(['INT', 'LOAD', 'HEAD', 'COOL']));
  });

  it('is red when low blood pressure comes with dizziness', () => {
    expect(evalWith({}, { bp: { sys: 85, dia: 55 }, news: ['dizzy'] }).outcome).toBe('red');
  });
});

describe('back pain and sciatica (spec §4.5)', () => {
  it('is urgent with saddle numbness or bladder/bowel change', () => {
    expect(evalWith(backUser, { back: { pain: 2, newNeuro: false, caudaEquinaFlag: true } }).outcome).toBe('urgent');
  });

  it('is a recovery day with new neurological symptoms', () => {
    const r = evalWith(backUser, { back: { pain: 2, newNeuro: true, caudaEquinaFlag: false } });
    expect(r.outcome).toBe('recovery');
    expect(r.nerveFlag).toBe(true);
    expect(r.back).toBe('red');
  });

  it.each([
    [1, 'green', 'green'],
    [4, 'amber', 'amber'],
    [7, 'recovery', 'red'],
  ] as const)('back pain %i → %s (%s light)', (pain, outcome, light) => {
    const r = evalWith(backUser, { back: { pain, newNeuro: false, caudaEquinaFlag: false } });
    expect(r.outcome).toBe(outcome);
    expect(r.back).toBe(light);
  });

  it('sets the nerve flag when leg symptoms reach the thigh or below', () => {
    expect(evalWith(backUser, { back: { pain: 1, legPain: 0, reach: 'belowKnee', newNeuro: false, caudaEquinaFlag: false } }).nerveFlag).toBe(true);
    expect(evalWith(backUser, { back: { pain: 1, legPain: 0, reach: 'back', newNeuro: false, caudaEquinaFlag: false } }).nerveFlag).toBe(false);
  });

  // A back answer can only exist because the user gave it, so it is honoured
  // even when the profile has no back history (they may have just hurt it).
  it('acts on back answers even without a back history', () => {
    expect(evalWith({}, { back: { pain: 8, newNeuro: false, caudaEquinaFlag: false } }).outcome).not.toBe('green');
    expect(evalWith({}, {}).outcome).toBe('green');
  });
});

describe('sleep and energy', () => {
  it('is amber with one set fewer after short sleep', () => {
    const r = evalWith({}, { sleep: 'lt5' });
    expect(r.outcome).toBe('amber');
    expect(r.modifiers).toContain('MINUS_SET');
  });

  it('is a recovery day after two low days running', () => {
    const yesterday = ci({ date: '2026-10-08', energy: 2 });
    expect(evalWith({}, { energy: 1 }, [yesterday]).outcome).toBe('recovery');
  });
});

describe('merging', () => {
  it('lets the most restrictive outcome win and accumulates modifiers', () => {
    const r = evalWith(insulinUser, { news: ['dizzy', 'hot'], glucose: { value: 110, unit: 'mg/dL' }, bp: { sys: 150, dia: 92 } });
    expect(r.outcome).toBe('amber');
    expect(r.modifiers).toEqual(expect.arrayContaining(['COOL', 'INT', 'HEAT', 'HYPO']));
  });

  it('is urgent with urgent symptoms whatever else is fine', () => {
    expect(evalWith({}, { urgentSymptoms: true }).outcome).toBe('urgent');
  });

  it('orders reasons most severe first', () => {
    const r = evalWith(insulinUser, { news: ['lowOne', 'unwell'], glucose: { value: 150, unit: 'mg/dL' } });
    expect(r.reasons[0].outcome).toBe('red');
  });

  it('carries profile rules into readiness', () => {
    const r = profileOnlyReadiness(createDefaultProfile({ health: { hypertension: 'treated', betaBlocker: true } }));
    expect(r.modifiers).toContain('COOL');
    expect(r.rpeOnly).toBe(true);
  });
});

describe('blood pressure thresholds', () => {
  const treated: ProfileInput = { health: { hypertension: 'treated', bpMonitor: true } };

  // On BP medication a high systolic with a low diastolic is common; it is a
  // stop, not a longer cool-down.
  it.each([[190, 55], [200, 50], [185, 58], [190, 95]])('%s/%s is red', (sys, dia) => {
    expect(evalWith(treated, { bp: { sys, dia } }).outcome).toBe('red');
  });

  it('still treats a genuinely low reading as low', () => {
    const r = evalWith(treated, { bp: { sys: 85, dia: 55 } });
    expect(r.outcome).toBe('amber');
    expect(r.modifiers).toContain('COOL');
  });

  it('red for 180 over 110 and above, amber below that', () => {
    expect(evalWith(treated, { bp: { sys: 182, dia: 92 } }).outcome).toBe('red');
    expect(evalWith(treated, { bp: { sys: 165, dia: 102 } }).outcome).toBe('amber');
  });
});

describe('ketones', () => {
  const sglt2: ProfileInput = { health: { diabetes: 'type2', sglt2i: true, glucoseMonitor: 'meter' } };
  const type2: ProfileInput = { health: { diabetes: 'type2', glucoseMonitor: 'meter' } };

  it('restricts a high glucose more for a user who can make ketones', () => {
    const risk = evalWith(sglt2, { glucose: { value: 400, unit: 'mg/dL' } });
    const plain = evalWith(type2, { glucose: { value: 400, unit: 'mg/dL' } });
    expect(risk.outcome).toBe('recovery');
    expect(OUTCOME_ORDER.indexOf(risk.outcome)).toBeGreaterThan(OUTCOME_ORDER.indexOf(plain.outcome));
    expect(plain.outcome).toBe('amber');
  });

  it('reads a urine strip on strip markings, not blood mmol/L', () => {
    const urine: ProfileInput = { health: { diabetes: 'type1', insulin: 'injections_or_pump', ketoneTest: 'urine', glucoseMonitor: 'meter' } };
    // A "small" strip result of 15 mg/dL is not an emergency.
    const small = evalWith(urine, { glucose: { value: 260, unit: 'mg/dL' }, ketones: { value: 15, kind: 'urine' } });
    expect(small.outcome).toBe('red');
    expect(small.reasons.map(r => r.code)).not.toContain('ketonesUrgent');
    // A large one is.
    expect(evalWith(urine, { glucose: { value: 260, unit: 'mg/dL' }, ketones: { value: 160, kind: 'urine' } }).outcome).toBe('urgent');
    // The same number on a blood meter is an emergency.
    expect(evalWith({ health: { diabetes: 'type1', insulin: 'injections_or_pump', ketoneTest: 'blood', glucoseMonitor: 'meter' } },
      { glucose: { value: 260, unit: 'mg/dL' }, ketones: { value: 15, kind: 'blood' } }).outcome).toBe('urgent');
  });

  it('acts on raised ketones even when glucose is normal', () => {
    const r = evalWith(sglt2, { glucose: { value: 110, unit: 'mg/dL' }, ketones: { value: 1.8, kind: 'blood' } });
    expect(r.outcome).toBe('red');
  });
});

describe('answers outlive profile edits', () => {
  const back: ProfileInput = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' } };

  it('keeps a cauda equina flag urgent after the pain areas are unticked', () => {
    const c = { back: { pain: 3, newNeuro: false, caudaEquinaFlag: true } };
    expect(evalWith(back, c).outcome).toBe('urgent');
    expect(evalWith({ pain: { areas: [] } }, c).outcome).toBe('urgent');
  });

  it('keeps reported back pain amber or worse after the pain areas are unticked', () => {
    const c = { back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } };
    expect(evalWith({ pain: { areas: [] } }, c).outcome).not.toBe('green');
  });
});

describe('impaired hypo awareness', () => {
  const risky: ProfileInput = { health: { diabetes: 'type1', insulin: 'injections_or_pump', highHypoRisk: true, glucoseMonitor: 'meter' } };

  it('does not clear a start at 92 mg/dL', () => {
    const r = evalWith(risky, { glucose: { value: 92, unit: 'mg/dL' } });
    expect(r.reasons.map(x => x.code)).toContain('belowStart');
    expect(r.modifiers).toContain('HYPO');
    expect(r.actions.join(' ')).toMatch(/fast-acting carbohydrate/);
  });

  it('clears a start once above the higher target', () => {
    expect(evalWith(risky, { glucose: { value: 150, unit: 'mg/dL' } }).reasons.map(x => x.code)).not.toContain('belowStart');
  });
});

describe('blood pressure wording', () => {
  const treated: ProfileInput = { health: { hypertension: 'treated', bpMonitor: true } };

  it('names only the number that is actually high', () => {
    const sysOnly = evalWith(treated, { bp: { sys: 190, dia: 55 } }).reasons.find(r => r.code.startsWith('bp'))!.message;
    expect(sysOnly).toContain('190');
    expect(sysOnly).not.toContain('over 120');
    const both = evalWith(treated, { bp: { sys: 190, dia: 125 } }).reasons.find(r => r.code.startsWith('bp'))!.message;
    expect(both).toContain('190 over 125');
  });
});
