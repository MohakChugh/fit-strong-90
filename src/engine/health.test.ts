import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { deriveHealth, profileRules } from './health';
import { DEFAULT_HEALTH } from '@/profile/defaults';

describe('deriveHealth', () => {
  it.each([
    [{ diabetes: 'type2', insulin: 'injections_or_pump' }, { hypoRisk: true, ketoneRisk: false }],
    [{ diabetes: 'type2', sulfonylureaOrMeglitinide: true }, { hypoRisk: true, ketoneRisk: false }],
    [{ diabetes: 'type2' }, { hypoRisk: false, ketoneRisk: false }],
    [{ diabetes: 'type2', sglt2i: true }, { hypoRisk: false, ketoneRisk: true }],
    [{ diabetes: 'type1', insulin: 'injections_or_pump' }, { hypoRisk: true, ketoneRisk: true }],
    [{ diabetes: 'none', insulin: 'injections_or_pump' }, { hypoRisk: false, ketoneRisk: false }],
  ] as const)('%o → %o', (h, expected) => {
    expect(deriveHealth({ ...DEFAULT_HEALTH, ...h })).toMatchObject(expected);
  });

  it('treats any beta-blocker or diuretic as blood-pressure medicine', () => {
    expect(deriveHealth({ ...DEFAULT_HEALTH, betaBlocker: true }).onBpMeds).toBe(true);
    expect(deriveHealth({ ...DEFAULT_HEALTH, diuretic: true }).onBpMeds).toBe(true);
    expect(deriveHealth({ ...DEFAULT_HEALTH, hypertension: 'treated' }).onBpMeds).toBe(true);
    expect(deriveHealth(DEFAULT_HEALTH).onBpMeds).toBe(false);
  });
});

describe('profileRules', () => {
  const rules = (health: NonNullable<ProfileInput['health']>) =>
    profileRules(createDefaultProfile({ health }));

  it('is all green for a healthy, active profile', () => {
    const r = rules({});
    expect(r).toMatchObject({ outcome: 'green', modifiers: [], lightOnly: false, vigorousLocked: false, capHeavy: false });
  });

  it('applies COOL every day on blood-pressure medicine', () => {
    expect(rules({ hypertension: 'treated' }).modifiers).toContain('COOL');
  });

  it('uses effort, not heart rate, with a beta-blocker', () => {
    expect(rules({ betaBlocker: true }).rpeOnly).toBe(true);
  });

  it('applies IMPACT for peripheral neuropathy, including "not sure"', () => {
    expect(rules({ diabetes: 'type2', peripheralNeuropathy: 'yes', clearance: 'vigorous' }).modifiers).toContain('IMPACT');
    expect(rules({ diabetes: 'type2', peripheralNeuropathy: 'unsure', clearance: 'vigorous' }).modifiers).toContain('IMPACT');
  });

  it('applies FOOT for a current foot wound', () => {
    expect(rules({ footStatus: 'current_wound_or_active_charcot' }).modifiers).toContain('FOOT');
  });

  it('caps heavy lifts for moderate or unknown retinopathy', () => {
    expect(rules({ retinopathy: 'moderate' }).capHeavy).toBe(true);
    expect(rules({ retinopathy: 'unknown' }).capHeavy).toBe(true);
  });

  it('applies INT, LOAD, HEAD and IMPACT for severe or proliferative retinopathy', () => {
    const m = rules({ retinopathy: 'severe_or_proliferative' }).modifiers;
    expect(m).toEqual(expect.arrayContaining(['INT', 'LOAD', 'HEAD', 'IMPACT']));
  });

  it('is red after recent eye treatment', () => {
    expect(rules({ retinopathy: 'recent_eye_treatment' }).outcome).toBe('red');
  });

  it('applies LOAD with kidney disease', () => {
    expect(rules({ kidneyDisease: 'ckd', clearance: 'vigorous' }).modifiers).toContain('LOAD');
  });

  it('allows light work only for an inactive user with diabetes and no clearance (ACSM)', () => {
    const r = rules({ diabetes: 'type2', currentlyActive: false, clearance: 'none' });
    expect(r.lightOnly).toBe(true);
    expect(r.vigorousLocked).toBe(true);
    expect(r.modifiers).toEqual(expect.arrayContaining(['INT', 'LOAD']));
  });

  it('locks only vigorous work for an active user with diabetes without vigorous clearance', () => {
    const r = rules({ diabetes: 'type2', currentlyActive: true, clearance: 'moderate' });
    expect(r.lightOnly).toBe(false);
    expect(r.vigorousLocked).toBe(true);
  });

  it('unlocks vigorous work once cleared', () => {
    expect(rules({ diabetes: 'type1', insulin: 'injections_or_pump', clearance: 'vigorous' }).vigorousLocked).toBe(false);
  });

  it('does not require clearance for prediabetes alone', () => {
    expect(rules({ diabetes: 'prediabetes', currentlyActive: false }).vigorousLocked).toBe(false);
  });

  it('locks vigorous work for untreated or unknown hypertension', () => {
    expect(rules({ hypertension: 'untreated' }).vigorousLocked).toBe(true);
    expect(rules({ hypertension: 'unsure' }).vigorousLocked).toBe(true);
  });
});
