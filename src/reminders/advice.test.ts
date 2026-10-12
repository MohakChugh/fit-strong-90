import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { habitInstead, habitOffered, habitPrecautions, movementBlock } from './advice';

/** Codex's trigger (content re-check R03): a reviewed basal-insulin profile. */
const insulin = {
  diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', sulfonylureaOrMeglitinide: false,
  sglt2i: false, metformin: true, priorDkaOrInsulinDeficiency: false, medicinesReviewed: true,
} as const;
const wound = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'current_wound_or_active_charcot' } });
const healed = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'healthy' } });
const plain = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true } });

describe('movement reminders follow the Guide', () => {
  it('offers no standing or walking prompt with an open foot wound or active Charcot foot', () => {
    expect(habitOffered('sittingBreak', wound)).toBe(false);
    expect(habitOffered('mealWalk', wound)).toBe(false);
    expect(habitOffered('sittingBreak', healed)).toBe(true);
    expect(habitOffered('mealWalk', plain)).toBe(true);
  });

  it('says why, and what the Guide offers instead', () => {
    expect(movementBlock('sittingBreak', wound)).toMatch(/foot wound/);
    expect(movementBlock('sittingBreak', healed)).toBeUndefined();
    expect(habitInstead('sittingBreak', wound)).toMatch(/While you sit/);
    expect(habitInstead('mealWalk', wound)).toMatch(/open foot wound or active Charcot foot/);
  });

  it('carries the care-plan checks and fast-acting sugar with insulin, or a sulfonylurea or meglitinide', () => {
    for (const habit of ['sittingBreak', 'mealWalk'] as const) {
      expect(habitPrecautions(habit, healed).join(' '), habit).toMatch(/carry a fast-acting source of sugar/);
    }
    const secretagogue = createDefaultProfile({ health: { ...insulin, insulin: 'none', insulinRegimen: undefined, sulfonylureaOrMeglitinide: true } });
    expect(habitPrecautions('mealWalk', secretagogue).join(' ')).toMatch(/fast-acting source of sugar/);
  });

  it('adds nothing for someone the precautions are not about, or to a prompt that is not offered', () => {
    expect(habitPrecautions('sittingBreak', plain)).toEqual([]);
    expect(habitPrecautions('mealWalk', plain)).toEqual([]);
    expect(habitPrecautions('sittingBreak', wound)).toEqual([]);
    expect(habitPrecautions('mealWalk', wound)).toEqual([]);
  });
});
