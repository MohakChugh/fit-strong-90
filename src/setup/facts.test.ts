import { describe, expect, it } from 'vitest';
import { diabetesOf, factsOf } from './facts';
import { GLIFLOZIN_NO_DIABETES, NO_CLASSES, withC, withMeds } from './fixtures';

describe('what the answers mean in the engine’s terms (journey §6.3, board D76, D78)', () => {
  it('reads "Not sure", or a type not given yet, as another type of diabetes', () => {
    expect(diabetesOf({})).toBeUndefined();
    expect(diabetesOf({ conditions: { diabetes: 'unsure' } })).toBe('other');
    expect(diabetesOf({ conditions: { diabetes: 'yes' }, diabetesType: 'unsure' })).toBe('other');
    expect(diabetesOf({ conditions: { diabetes: 'yes' }, diabetesType: 'type1' })).toBe('type1');
    expect(diabetesOf({ conditions: { diabetes: 'no' } })).toBe('none');
  });

  it('reads insulin or a lows tablet, with "No" or prediabetes, as diabetes that can go low (D78; Review Focus 3)', () => {
    expect(diabetesOf({ conditions: { diabetes: 'no' }, classes: { insulin: 'unsure' } })).toBe('other');
    expect(diabetesOf({ conditions: { diabetes: 'yes' }, diabetesType: 'prediabetes', classes: { lowsTablet: 'yes' } })).toBe('other');
    expect(diabetesOf({ conditions: { diabetes: 'yes' }, diabetesType: 'prediabetes', classes: { metformin: 'yes' } })).toBe('prediabetes');
  });

  it('reads insulin or a lows tablet as diabetes that can go low even with no diabetes answer at all (H5-01)', () => {
    expect(diabetesOf({ classes: { insulin: 'yes' } })).toBe('other');
    expect(diabetesOf({ conditions: { bp: 'no' }, classes: { lowsTablet: 'unsure' } })).toBe('other');
    expect(factsOf({ regular: 'yes', classes: { insulin: 'yes' } }).hypoRisk).toBe(true);
    // Without a medicine that can cause lows, an unanswered chip is still unanswered.
    expect(diabetesOf({ classes: { metformin: 'yes' } })).toBeUndefined();
  });

  it('counts a "-gliflozin" as a ketone risk, whatever the diagnosis', () => {
    expect(factsOf(GLIFLOZIN_NO_DIABETES).ketoneRisk).toBe(true);
    expect(factsOf(withMeds({ gliflozin: 'unsure' })).ketoneRisk).toBe(true);
    expect(factsOf(withMeds({})).ketoneRisk).toBe(false);
  });

  it('counts "Not sure" as yes, for medicines asked and blood-pressure medicine taken', () => {
    expect(factsOf({ ...withMeds({}), regular: 'unsure' }).medicines).toBe(true);
    expect(factsOf(withC({ bp: 'yes' }, { bpMedicine: 'unsure' })).bpMeds).toBe(true);
    expect(factsOf(withC({ bp: 'yes' }, { bpMedicine: 'no' })).bpMeds).toBe(false);
    expect(factsOf(withMeds({ betaBlocker: 'unsure' })).bpMeds).toBe(true);
  });

  it('holds walking for a wound now, or a clinician’s limit (K-30)', () => {
    expect(factsOf(withC({ feet: 'yes' }, { footWound: 'no', footRestriction: 'yes' })).footHeld).toBe(true);
    expect(factsOf(withC({ feet: 'yes' }, { footWound: 'now', footRestriction: 'no' })).footHeld).toBe(true);
    expect(factsOf(withC({ feet: 'yes' }, { footWound: 'past', footRestriction: 'no' })).footHeld).toBe(false);
  });

  it('reads type 1 as insulin, and diabetes with a lows tablet as a risk of lows', () => {
    expect(factsOf(withC({ diabetes: 'yes' }, { diabetesType: 'type1' })).insulin).toBe(true);
    expect(factsOf(withC({ diabetes: 'yes' }, { diabetesType: 'type2', regular: 'yes', classes: { ...NO_CLASSES, lowsTablet: 'yes' } })).hypoRisk).toBe(true);
  });
});
