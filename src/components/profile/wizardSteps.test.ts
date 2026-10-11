import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { HealthProfile } from '@/types/profile';
import { bpMedicinesAsked } from '@/engine/health';
import { startingLadder } from '@/engine/progression';
import {
  profileChanges,
  withProfileChanges,
  DIABETES_MEDICINES,
  answeredOnOpen,
  convertWeightText,
  ladderAfterEdit,
  metforminYearProblem,
} from './wizardSteps';

const TODAY = '2026-10-08';

describe('ladderAfterEdit', () => {
  const earned = createDefaultProfile({ ladder: { hinge: 4, squat: 3, neuralGate: true, changedOn: '2026-09-01' } });

  it('lowers the levels and closes the nerve gate when sciatica is newly added', () => {
    const after = { ...earned, pain: { ...earned.pain, areas: ['sciatica' as const] } };
    const start = startingLadder(after);
    expect(ladderAfterEdit(earned, after, TODAY)).toEqual({ hinge: start.hinge, squat: start.squat, neuralGate: false, changedOn: TODAY });
  });

  it('lowers the levels for a new back problem without sciatica, and keeps the nerve gate', () => {
    const after = { ...earned, pain: { ...earned.pain, areas: ['lowerBack' as const] } };
    const ladder = ladderAfterEdit(earned, after, TODAY);
    expect(ladder.hinge).toBe(startingLadder(after).hinge);
    expect(ladder.neuralGate).toBe(true);
    expect(ladder.changedOn).toBe(TODAY);
  });

  it('does not raise a level that is already lower than a new back problem would start at', () => {
    const low = createDefaultProfile({ ladder: { hinge: 0, squat: 0, neuralGate: true, changedOn: '2026-09-01' } });
    const after = { ...low, pain: { ...low.pain, areas: ['lowerBack' as const] } };
    expect(startingLadder(after).hinge).toBeGreaterThan(0);
    expect(ladderAfterEdit(low, after, TODAY)).toEqual(low.ladder);
  });

  it('never raises a level, and leaves an unchanged answer alone', () => {
    const cautious = createDefaultProfile({ pain: { areas: ['lowerBack'] }, ladder: { hinge: 0, squat: 0, neuralGate: true, changedOn: '2026-09-01' } });
    const added = { ...cautious, pain: { ...cautious.pain, areas: ['lowerBack' as const, 'knee' as const] } };
    expect(ladderAfterEdit(cautious, added, TODAY)).toEqual(cautious.ladder);
    expect(ladderAfterEdit(earned, earned, TODAY)).toBe(earned.ladder);
  });
});

describe('the medicine questions a health profile must answer', () => {
  const h = (over: Partial<HealthProfile> = {}) => createDefaultProfile({ health: over }).health;

  it('asks the beta-blocker and diuretic questions with blood pressure, and with heart or kidney disease without it', () => {
    for (const over of [{ hypertension: 'treated' }, { hypertension: 'unsure' }, { heartOrVascularDisease: true }, { kidneyDisease: 'ckd' }, { kidneyDisease: 'unsure' }] as Partial<HealthProfile>[]) {
      expect(bpMedicinesAsked(h(over)), JSON.stringify(over)).toBe(true);
    }
    expect(bpMedicinesAsked(h())).toBe(false);
  });

  it('counts as already answered only what was actually given', () => {
    // The untouched default "No" is not an answer.
    expect([...answeredOnOpen(h())]).toEqual([]);
    expect([...answeredOnOpen(h({ medicinesReviewed: true }))]).toEqual(['sglt2i']);
    // Without diabetes, a Yes or Not sure can only have come from an answer.
    expect([...answeredOnOpen(h({ sglt2i: 'unsure' }))]).toEqual(['sglt2i']);
    expect([...answeredOnOpen(h({ diabetes: 'type2', medicinesReviewed: true }))]).toEqual([...DIABETES_MEDICINES]);
    // With diabetes only the review vouches for an answer (contract H-DATA).
    expect(answeredOnOpen(h({ diabetes: 'type2', sglt2i: true })).size).toBe(0);
    expect([...answeredOnOpen(h({ hypertension: 'treated', bpMedicinesReviewed: true }))]).toEqual(['betaBlocker', 'diuretic']);
  });

  it('asks the other diabetes medicines again when diabetes is added to a profile that only answered SGLT2', () => {
    const answered = answeredOnOpen(h({ medicinesReviewed: true }));
    expect(DIABETES_MEDICINES.filter(q => !answered.has(q))).toEqual(['insulin', 'sulfonylurea', 'metformin', 'priorDka']);
  });
});

describe('the weight field and its units (N05)', () => {
  it('shows the same weight in the other unit when switching', () => {
    expect(convertWeightText('80', false)).toBe('176.4');
    expect(convertWeightText('176.4', true)).toBe('80');
    // kg, lb, kg again: the same number.
    expect(convertWeightText(convertWeightText('82.4', false), true)).toBe('82.4');
  });

  it('leaves an empty or unfinished entry as it is rather than making it zero', () => {
    expect(convertWeightText('', false)).toBe('');
    expect(convertWeightText('.', true)).toBe('.');
    expect(convertWeightText('-', false)).toBe('-');
  });
});

describe('the year metformin was started (J02)', () => {
  it('accepts an empty field, and a real four-digit year up to this one', () => {
    expect(metforminYearProblem('', 2026)).toBeNull();
    expect(metforminYearProblem('2019', 2026)).toBeNull();
    expect(metforminYearProblem('2026', 2026)).toBeNull();
  });

  it('names what is wrong with anything else, partial or impossible', () => {
    for (const text of ['2', '201', '20190', '2027', '1899', 'abcd']) {
      expect(metforminYearProblem(text, 2026), text).toMatch(/year/i);
    }
  });
});

describe('what an edit changed (D-03)', () => {
  const opened = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false } });

  it('is only the answers the person changed, leaf by leaf', () => {
    const saved = { ...opened, pain: { ...opened.pain, areas: ['lowerBack' as const] } };
    expect(profileChanges(opened, saved)).toEqual([{ path: ['pain', 'areas'], value: ['lowerBack'] }]);
    expect(profileChanges(opened, opened)).toEqual([]);
  });

  it('applied to the profile as it now stands, keeps what another copy saved meanwhile', () => {
    const saved = { ...opened, pain: { ...opened.pain, areas: ['lowerBack' as const] } };
    const meanwhile = {
      ...opened,
      health: { ...opened.health, footStatus: 'current_wound_or_active_charcot' as const, fluidRestriction: true },
      food: { pattern: 'vegan' as const, avoid: ['paneer'] },
    };
    const next = withProfileChanges(meanwhile, profileChanges(opened, saved));
    expect(next.pain.areas).toEqual(['lowerBack']);
    expect(next.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(next.health.fluidRestriction).toBe(true);
    expect(next.food).toEqual({ pattern: 'vegan', avoid: ['paneer'] });
    // Nothing is changed in place.
    expect(meanwhile.pain.areas).toEqual(opened.pain.areas);
  });

  it('removes an answer the person cleared, and takes everything when nothing was there before', () => {
    const withSince = { ...opened, health: { ...opened.health, metforminSince: '2019' } };
    const cleared = { ...withSince, health: { ...withSince.health, metforminSince: undefined } };
    expect(withProfileChanges(withSince, profileChanges(withSince, cleared)).health).not.toHaveProperty('metforminSince');
    expect(withProfileChanges(opened, profileChanges(undefined, withSince))).toEqual(withSince);
  });
});
