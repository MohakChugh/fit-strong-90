import { describe, expect, it } from 'vitest';
import type { SetupAnswers } from '@/types/setup';
import { mergeAnswers } from './merge';

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
