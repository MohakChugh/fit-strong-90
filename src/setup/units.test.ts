import { describe, expect, it } from 'vitest';
import { weightFieldText } from '@/components/profile/wizardSteps';
import { heightFrom, heightProblem, heightText, numberFrom, waistFrom, waistProblem, waistText, weightFrom, weightProblem } from './units';

describe('height, weight and waist as typed (journey §6.2 ch. 2; board D83)', () => {
  it('a page shown in feet and pounds, saved unchanged, keeps the stored values exactly (Review Focus 2)', () => {
    expect(heightText(170, false)).toEqual({ cm: '', ft: '5', inch: '7' });
    expect(heightFrom(heightText(170, false), false, 170)).toBe(170);
    expect(weightFrom(weightFieldText(78, false), false, 78)).toBe(78);
    expect(waistFrom(waistText(92, false), false, 92)).toBe(92);
    expect(heightFrom(heightText(170.18, true), true, 170.18)).toBe(170.18);
    // v1 kept a weight given in pounds unrounded: shown again in pounds and saved, it stays exactly as it was.
    expect(weightFrom(weightFieldText(68.0388, false), false, 68.0388)).toBe(68.0388);
  });

  it('converts what is typed in feet, inches and pounds', () => {
    expect(heightFrom({ cm: '', ft: '5', inch: '8' }, false, 170)).toBe(172.7);
    expect(weightFrom('176', false, 78)).toBe(79.8);
    expect(waistFrom('38', false, 92)).toBe(96.5);
    expect(heightFrom({ cm: '', ft: '', inch: '' }, false, undefined)).toBeUndefined();
  });

  it('keeps typing as it comes: nothing for empty, the number so far, or not a number yet', () => {
    expect(numberFrom('')).toBeUndefined();
    expect(numberFrom('19')).toBe(19);
    expect(numberFrom('72,5')).toBe(72.5);
    expect(numberFrom('7x')).toBeNaN();
  });

  it('checks each measure against what a person can be, and empty is fine', () => {
    expect(heightProblem(undefined)).toBeNull();
    expect(heightProblem(170)).toBeNull();
    expect(heightProblem(17)).toMatch(/between 50 and 260/);
    expect(weightProblem(Number.NaN)).toMatch(/between 10 and 400/);
    expect(waistProblem(300)).toMatch(/between 30 and 250/);
  });
});
