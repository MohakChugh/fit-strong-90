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
  asksStartDate,
  canLeave,
  convertWeightText,
  finalProfile,
  finishLabel,
  ladderAfterEdit,
  medicinesAnswered,
  metforminYearProblem,
  programmeInFlow,
  requiredMedicines,
  startDateMissing,
  stepTitle,
  submittedWeightKg,
  wizardSteps,
  type StepGate,
} from './wizardSteps';

const TODAY = '2026-10-08';

describe('wizardSteps', () => {
  it('runs all four steps when none are named', () => {
    expect(wizardSteps(undefined, 'onboarding')).toEqual(['about', 'body', 'health', 'summary']);
    expect(wizardSteps(undefined, 'edit')).toEqual(['about', 'body', 'health', 'summary']);
    expect(wizardSteps([], 'edit')).toEqual(['about', 'body', 'health', 'summary']);
  });

  it('keeps the wizard\'s own order and asks each step once', () => {
    expect(wizardSteps(['summary', 'health', 'body', 'health'], 'edit')).toEqual(['body', 'health', 'summary']);
  });

  it('edits one section on its own', () => {
    expect(wizardSteps(['health'], 'edit')).toEqual(['health']);
    expect(wizardSteps(['about'], 'edit')).toEqual(['about']);
  });

  it('never lets a first-time profile skip the summary and its acknowledgement', () => {
    expect(wizardSteps(['body', 'health'], 'onboarding')).toEqual(['body', 'health', 'summary']);
    expect(wizardSteps(['health'], 'onboarding')).toEqual(['health', 'summary']);
  });

  it('counts the programme as part of the flow only when its questions are', () => {
    expect(programmeInFlow(wizardSteps(undefined, 'onboarding'))).toBe(true);
    expect(programmeInFlow(wizardSteps(['body', 'health', 'summary'], 'onboarding'))).toBe(false);
  });

  it('lets a flow that knows say whether the person is in the programme', () => {
    // Editing "About you" for someone who only stretches: no training questions.
    expect(programmeInFlow(['about'], false)).toBe(false);
    // Editing their back for someone in the programme: their goals are asked too.
    expect(programmeInFlow(['body'], true)).toBe(true);
  });

  it('names the summary and the last button for what the flow is', () => {
    expect(stepTitle('about', true)).toBe('You and your schedule');
    expect(stepTitle('about', false)).toBe('About you');
    expect(stepTitle('summary', true)).toBe('Your plan');
    expect(stepTitle('summary', false)).toBe('Before you start');
    expect(finishLabel('onboarding', true)).toBe('Build my plan');
    expect(finishLabel('onboarding', false)).toBe('Save my answers');
    expect(finishLabel('edit', false)).toBe('Save');
  });
});

describe('canLeave', () => {
  const ready: StepGate = { programme: true, weight: 82, trainingDays: 3, medicinesAnswered: true, acknowledged: true };

  it('asks for weight and training days only on the step that asks them', () => {
    expect(canLeave('about', { ...ready, weight: 0 })).toBe(false);
    expect(canLeave('about', { ...ready, trainingDays: 0 })).toBe(false);
    expect(canLeave('about', ready)).toBe(true);
    expect(canLeave('body', { ...ready, weight: 0, trainingDays: 0 })).toBe(true);
    expect(canLeave('health', { ...ready, weight: 0, trainingDays: 0 })).toBe(true);
  });

  it('needs neither outside the programme, but never takes a negative weight', () => {
    const outside = { ...ready, programme: false };
    expect(canLeave('about', { ...outside, weight: 0, trainingDays: 0 })).toBe(true);
    expect(canLeave('about', { ...outside, weight: 70.5 })).toBe(true);
    expect(canLeave('about', { ...outside, weight: -1 })).toBe(false);
    expect(canLeave('about', { ...outside, weight: Number.NaN })).toBe(false);
  });

  it('holds the schedule step on a start date that is missing or refused, when one is asked', () => {
    expect(canLeave('about', { ...ready, startDateProblem: 'Choose a start date.' })).toBe(false);
    expect(canLeave('about', { ...ready, startDateProblem: null })).toBe(true);
    // Outside the programme no date is asked, so none can hold it.
    expect(canLeave('about', { ...ready, programme: false, startDateProblem: 'Choose a start date.' })).toBe(true);
  });

  it('holds the health step until every medicine question is answered', () => {
    expect(canLeave('health', { ...ready, medicinesAnswered: false })).toBe(false);
    expect(canLeave('about', { ...ready, medicinesAnswered: false })).toBe(true);
  });

  it('holds the summary until the acknowledgement is ticked', () => {
    expect(canLeave('summary', { ...ready, acknowledged: false })).toBe(false);
    expect(canLeave('summary', ready)).toBe(true);
  });
});

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

describe('finalProfile', () => {
  const diabetic = createDefaultProfile({ weightKg: 82.37, needsHealthReview: true, health: { diabetes: 'type2' } });
  const base = { before: diabetic, typedWeightKg: 90, today: TODAY } as const;

  it('marks the medicines reviewed only when the health step was shown', () => {
    const health = finalProfile({ ...base, draft: diabetic, steps: ['health'], mode: 'edit' });
    expect(health.health.medicinesReviewed).toBe(true);
    expect(health.needsHealthReview).toBe(false);

    const about = finalProfile({ ...base, draft: diabetic, steps: ['about'], mode: 'edit' });
    expect(about.health.medicinesReviewed).toBeUndefined();
    expect(about.needsHealthReview).toBe(true);
  });

  it('takes the weight from the field only when it was asked, and keeps the stored one exactly otherwise', () => {
    expect(finalProfile({ ...base, draft: diabetic, steps: ['about'], mode: 'edit' }).weightKg).toBe(90);
    expect(finalProfile({ ...base, draft: diabetic, steps: ['health'], mode: 'edit' }).weightKg).toBe(82.37);
  });

  it('gives a first-time profile its starting ladder from what was answered', () => {
    const sciatica = createDefaultProfile({ pain: { areas: ['sciatica'], sciaticaSide: 'left' } });
    const made = finalProfile({ ...base, before: undefined, draft: sciatica, steps: ['body', 'health', 'summary'], mode: 'onboarding' });
    expect(made.ladder).toEqual(startingLadder(sciatica));
    expect(made.ladder.neuralGate).toBe(false);
  });

  it('works out the starting ladder afresh in first-time setup, even when opened with an earlier draft', () => {
    // Welcome passes back what was saved on an earlier pass; its ladder is not earned.
    const draft = createDefaultProfile({ pain: { areas: ['sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 3, squat: 3, neuralGate: true } });
    const made = finalProfile({ ...base, before: draft, draft, steps: ['body', 'health', 'summary'], mode: 'onboarding' });
    expect(made.ladder).toEqual(startingLadder(draft));
  });

  it('marks the SGLT2 answer as given for someone without diabetes, once the health step asked it', () => {
    const none = createDefaultProfile();
    expect(finalProfile({ ...base, before: none, draft: none, steps: ['health'], mode: 'edit' }).health.medicinesReviewed).toBe(true);
    expect(finalProfile({ ...base, before: none, draft: none, steps: ['body'], mode: 'edit' }).health.medicinesReviewed).toBeUndefined();
  });

  it('marks the blood-pressure medicines answered with blood pressure, heart or kidney disease, and only then', () => {
    for (const health of [{ hypertension: 'treated' as const }, { heartOrVascularDisease: true }, { kidneyDisease: 'ckd' as const }]) {
      const p = createDefaultProfile({ health });
      expect(finalProfile({ ...base, before: p, draft: p, steps: ['health'], mode: 'edit' }).health.bpMedicinesReviewed, JSON.stringify(health)).toBe(true);
      expect(finalProfile({ ...base, before: p, draft: p, steps: ['about'], mode: 'edit' }).health.bpMedicinesReviewed).toBeUndefined();
    }
    const plain = createDefaultProfile();
    expect(finalProfile({ ...base, before: plain, draft: plain, steps: ['health'], mode: 'edit' }).health.bpMedicinesReviewed).toBeUndefined();
  });
});

describe('the programme start date', () => {
  it('is asked only with the programme: always when first set up, in an edit only when the flow asks', () => {
    expect(asksStartDate(true, 'onboarding', undefined)).toBe(true);
    expect(asksStartDate(true, 'edit', undefined)).toBe(false);
    expect(asksStartDate(true, 'edit', true)).toBe(true);
    expect(asksStartDate(false, 'onboarding', true)).toBe(false);
  });

  it('must be a real day', () => {
    expect(startDateMissing('')).toBe('Choose a start date.');
    expect(startDateMissing('2026-13-01')).toBe('Choose a start date.');
    expect(startDateMissing('2026-09-28')).toBeNull();
  });
});

describe('the medicine questions a health profile must answer', () => {
  const h = (over: Partial<HealthProfile> = {}) => createDefaultProfile({ health: over }).health;

  it('asks someone without diabetes the SGLT2 question, and no other diabetes medicine', () => {
    expect(requiredMedicines(h())).toEqual(['sglt2i']);
  });

  it('asks someone with diabetes every diabetes medicine', () => {
    expect(requiredMedicines(h({ diabetes: 'type2' }))).toEqual([...DIABETES_MEDICINES]);
  });

  it('asks the beta-blocker and diuretic questions with blood pressure, and with heart or kidney disease without it', () => {
    for (const over of [{ hypertension: 'treated' }, { hypertension: 'unsure' }, { heartOrVascularDisease: true }, { kidneyDisease: 'ckd' }, { kidneyDisease: 'unsure' }] as Partial<HealthProfile>[]) {
      expect(requiredMedicines(h(over)), JSON.stringify(over)).toEqual(['sglt2i', 'betaBlocker', 'diuretic']);
    }
    expect(bpMedicinesAsked(h())).toBe(false);
  });

  it('is not complete until each is answered: an untouched default is not an answer', () => {
    expect(medicinesAnswered(h(), new Set())).toBe(false);
    expect(medicinesAnswered(h(), new Set(['sglt2i']))).toBe(true);
    const heart = h({ heartOrVascularDisease: true });
    expect(medicinesAnswered(heart, new Set(['sglt2i']))).toBe(false);
    expect(medicinesAnswered(heart, new Set(['sglt2i', 'betaBlocker', 'diuretic']))).toBe(true);
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
    expect(medicinesAnswered(h({ diabetes: 'type2', medicinesReviewed: true }), answered)).toBe(false);
  });
});

describe('the weight field and its units (N05)', () => {
  it('keeps the stored weight exactly when only the unit is changed', () => {
    expect(submittedWeightKg({ text: '176.4', metric: false, untouchedKg: 80 })).toBe(80);
    expect(submittedWeightKg({ text: '82.4', metric: true, untouchedKg: 82.37 })).toBe(82.37);
  });

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

  it('takes a typed weight in the unit shown', () => {
    expect(submittedWeightKg({ text: '80', metric: true })).toBe(80);
    expect(submittedWeightKg({ text: '176.4', metric: false })).toBeCloseTo(80.01, 2);
    expect(submittedWeightKg({ text: '', metric: true })).toBe(0);
  });

  it('saves an untouched weight exactly as it was stored', () => {
    const before = createDefaultProfile({ weightKg: 82.37 });
    expect(finalProfile({ draft: before, before, steps: ['about'], mode: 'edit', typedWeightKg: undefined, today: TODAY }).weightKg).toBe(82.37);
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

  it('holds the health step while the year cannot be read', () => {
    const ready: StepGate = { programme: false, weight: 0, trainingDays: 0, medicinesAnswered: true, acknowledged: true };
    expect(canLeave('health', { ...ready, fieldProblem: 'Enter the year as four digits, such as 2019.' })).toBe(false);
    expect(canLeave('health', { ...ready, fieldProblem: null })).toBe(true);
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
