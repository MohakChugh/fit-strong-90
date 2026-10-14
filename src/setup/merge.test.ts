import { describe, expect, it } from 'vitest';
import type { SetupAnswers } from '@/types/setup';
import { createDefaultProfile } from '@/profile/defaults';
import { profileFrom } from './assemble';
import { mergeAnswers, mergeAnswersWithConflicts, mergeSkipped, putField } from './merge';

describe('answers changed in one copy, onto the answers as they are now (H5-12, H5-13; board D165)', () => {
  it('writes only what this copy changed; another copy’s answers stay', () => {
    const opened: SetupAnswers = { name: 'Asha', figure: 'female' };
    const now: SetupAnswers = { name: 'Asha', figure: 'female', birthYear: 1958 };
    expect(mergeAnswers(now, opened, { ...opened, name: 'Kai' })).toEqual({ name: 'Kai', figure: 'female', birthYear: 1958 });
    // Unchanged here: as it is now, even where the other copy took it away.
    expect(mergeAnswers({ name: 'Asha' }, opened, opened)).toEqual({ name: 'Asha' });
    // Taken away here: gone.
    const { figure: _f, ...noFigure } = opened;
    void _f;
    expect(mergeAnswers(now, opened, noFigure)).toEqual({ name: 'Asha', birthYear: 1958 });
  });

  it('merges a checklist row by row', () => {
    const opened: SetupAnswers = { conditions: { diabetes: 'no', bp: 'no' } };
    const now: SetupAnswers = { conditions: { diabetes: 'unsure', bp: 'no' } };
    expect(mergeAnswers(now, opened, { conditions: { diabetes: 'no', bp: 'yes' } })).toEqual({ conditions: { diabetes: 'unsure', bp: 'yes' } });
    // A checklist not changed here stays as it is now, unanswered included.
    expect(mergeAnswers({ name: 'Kai' }, opened, opened)).toEqual({ name: 'Kai' });
  });

  it('where both copies changed a Yes, No or Not sure, keeps the stricter; anything else, this copy’s', () => {
    const opened: SetupAnswers = { conditions: { diabetes: 'yes' }, figure: 'male' };
    const now: SetupAnswers = { conditions: { diabetes: 'unsure' }, figure: 'female' };
    const mine: SetupAnswers = { conditions: { diabetes: 'no' }, figure: 'either' };
    expect(mergeAnswers(now, opened, mine)).toEqual({ conditions: { diabetes: 'unsure' }, figure: 'either' });
    expect(mergeAnswers({ dizzy: 'no' }, { dizzy: 'unsure' }, { dizzy: 'yes' })).toEqual({ dizzy: 'yes' });
  });

  it('leaves the skipped pages as they are now, for the caller', () => {
    expect(mergeAnswers({ skippedPages: ['movement.goal'] }, {}, { skippedPages: [] }).skippedPages).toEqual(['movement.goal']);
  });
});

describe('a page’s own skip marks, onto the marks as they are now (H5-12)', () => {
  it('adds a page skipped here, takes one answered here off, and keeps another copy’s', () => {
    expect(mergeSkipped(['movement.goal'], [], ['about.figure'])).toEqual(['movement.goal', 'about.figure']);
    expect(mergeSkipped(['movement.goal', 'about.figure'], ['about.figure'], [])).toEqual(['movement.goal']);
    expect(mergeSkipped(['movement.goal'], ['food.logging'], ['food.logging'])).toEqual(['movement.goal']);
  });
});

describe('where both copies changed a safety answer (K5R-09, H5R-02, H5F-03; boards D190, D196)', () => {
  const both = (key: keyof SetupAnswers, base: SetupAnswers, stored: unknown, mine: unknown) =>
    mergeAnswersWithConflicts({ ...base, [key]: stored }, base, { ...base, [key]: mine });
  const insulin: SetupAnswers = { conditions: { diabetes: 'yes' }, diabetesType: 'type2', regular: 'yes', classes: { insulin: 'yes' } };

  it('of two Yes, No or Not sure answers, the earlier in Yes, Not sure, No: a disclosure or a doubt is never erased', () => {
    // A care team's start figure makes lows risk read alike to the start figure, never to everything else it holds (H5F-03).
    const target = { ...insulin, glucoseStartMin: 90, lowsRisk: 'yes' as const };
    expect(both('lowsRisk', target, 'unsure', 'no').answers.lowsRisk).toBe('unsure');
    expect(both('lowsRisk', target, 'no', 'unsure').answers.lowsRisk).toBe('unsure');
    expect(both('lowsRisk', { ...target, lowsRisk: 'unsure' }, 'yes', 'no').answers.lowsRisk).toBe('yes');
    // A checklist's row, the same.
    const heart = mergeAnswersWithConflicts({ conditions: { heart: 'yes' } }, { conditions: { heart: 'unsure' } }, { conditions: { heart: 'no' } });
    expect(heart).toEqual({ answers: { conditions: { heart: 'yes' } }, conflicts: [] });
  });

  it('of any other safety answer, neither: the stored one stays, named, for the person to check', () => {
    const feet: SetupAnswers = { conditions: { feet: 'yes' }, feetNumb: 'no', footWound: 'past' };
    expect(both('footWound', feet, 'no', 'now')).toMatchObject({ answers: { footWound: 'no' }, conflicts: ['footWound'] });
    expect(both('clearance', { conditions: { heart: 'yes' } }, 'vigorous', 'none')).toMatchObject({ answers: { clearance: 'vigorous' }, conflicts: ['clearance'] });
    expect(both('glucoseMonitor', insulin, 'meter', 'none')).toMatchObject({ answers: { glucoseMonitor: 'meter' }, conflicts: ['glucoseMonitor'] });
    const back: SetupAnswers = { conditions: { pain: 'yes' }, painAreas: ['lowerBack'], worseWith: 'unknown' };
    expect(both('worseWith', back, 'flexion', 'extension')).toMatchObject({ answers: { worseWith: 'flexion' }, conflicts: ['worseWith'] });
  });

  it('a preference changed in both: this copy’s, the later', () => {
    expect(both('figure', {}, 'male', 'female')).toEqual({ answers: { figure: 'female' }, conflicts: [] });
  });
});

describe('an answer cleared stays named, so the profile clears it too (board D169)', () => {
  it('a weight cleared clears the stored weight; a checklist row cleared is unanswered', () => {
    const cleared = putField({ weightKg: 70 }, 'weightKg', undefined);
    expect('weightKg' in cleared).toBe(true);
    expect(profileFrom(cleared, createDefaultProfile({ weightKg: 70 }), '2026-10-12', { thisYear: 2026 }).weightKg).toBe(0);
    expect(putField({ conditions: { feet: 'yes' } }, 'conditions.feet', undefined)).toStrictEqual({ conditions: {} });
  });
});
