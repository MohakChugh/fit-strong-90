import { describe, expect, it } from 'vitest';
import { ALLERGEN_IDS } from '@/types/profile';
import { ALLERGY_CHIPS, allergyName } from './allergies';

describe('chapter 7’s allergy chips (B-13, board D82)', () => {
  it('are Plan 7’s canonical ids, in its order, each with its label', () => {
    expect(ALLERGY_CHIPS.map(c => c.value)).toEqual([...ALLERGEN_IDS]);
    expect(allergyName('peanut')).toBe('Peanuts');
    expect(allergyName('shellfish')).toBe('Shellfish (prawn, crab)');
  });
});
