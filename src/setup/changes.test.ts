import { describe, expect, it } from 'vitest';
import { profileFrom } from './assemble';
import { whatChanges } from './changes';
import { FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, MINIMAL } from './fixtures';

const at = (a: typeof MINIMAL) => profileFrom(a, undefined, '2026-10-10', { thisYear: 2026 });

describe('what an edit changes, in words (journey §16)', () => {
  it('says what the engine will now do differently, and nothing when nothing did', () => {
    const before = at(MINIMAL);
    expect(whatChanges(before, at(GLIFLOZIN_NO_DIABETES))).toEqual(['Each check-in will ask about ketones and the signs of ketoacidosis.']);
    expect(whatChanges(before, at(INSULIN_NO_DIABETES))).toContain('Before exercise, you’ll be asked for a glucose reading.');
    expect(whatChanges(before, at(FOOT_WOUND))).toContain('Walks stay off while your foot needs weight kept off it.');
    expect(whatChanges(before, before)).toEqual([]);
  });

  it('says only what is new: a change already in place before is not said again', () => {
    for (const a of [GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, FOOT_WOUND]) expect(whatChanges(at(a), at(a))).toEqual([]);
  });

  it('says sessions wait when diabetes comes without its medicines (Review Focus 1)', () => {
    const before = at(MINIMAL);
    const after = { ...before, health: { ...before.health, diabetes: 'type2' as const, medicinesReviewed: false } };
    expect(whatChanges(before, after)).toContain('Sessions wait until your diabetes medicines are answered.');
  });
});
