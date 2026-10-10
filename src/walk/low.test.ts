import { describe, expect, it } from 'vitest';
import { lowReading, typedReading } from './low';

describe('a reading after "I feel low"', () => {
  it('reports what the player reports for the same answers (M-05)', () => {
    const glucose = { value: 62, unit: 'mg/dL' as const, source: 'meter' as const };
    expect(lowReading(glucose, false)).toEqual({ glucose });
    expect(lowReading(glucose, true)).toEqual({ glucose, newsGone: ['lowSymptoms'], lowRecovered: true });
    // Someone else had to help: a severe low, whatever the reading says now.
    expect(lowReading(glucose, false, true)).toEqual({ glucose, news: ['lowSevere'] });
    expect(lowReading(glucose, true, true)).toEqual({ glucose, news: ['lowSevere'], newsGone: ['lowSymptoms'], lowRecovered: true });
  });
});

describe('a reading typed after "I feel low", judged as the check-in and the player judge it (X2-18)', () => {
  it('holds a number under 34 in mg/dL until the unit is answered', () => {
    expect(typedReading('5.5', 'mg/dL', false)).toEqual({ sanity: 'ambiguousLow' });
    // "5.5 mg/dL", answered: a severe low, read as given.
    expect(typedReading('5.5', 'mg/dL', true, 'meter')).toEqual({ sanity: 'ok', reading: { value: 5.5, unit: 'mg/dL', unitConfirmed: true, source: 'meter' } });
    // "5.5 mmol/L": the unit switched, nothing to confirm.
    expect(typedReading('5.5', 'mmol/L', false, 'meter')).toEqual({ sanity: 'ok', reading: { value: 5.5, unit: 'mmol/L', source: 'meter' } });
  });

  it('holds a number over 34 in mmol/L until the unit is answered', () => {
    expect(typedReading('120', 'mmol/L', false)).toEqual({ sanity: 'suspectUnit' });
    expect(typedReading('120', 'mg/dL', false)).toEqual({ sanity: 'ok', reading: { value: 120, unit: 'mg/dL' } });
    // "really": an extreme mmol/L reading the engine must act on.
    expect(typedReading('40', 'mmol/L', true)).toEqual({ sanity: 'ok', reading: { value: 40, unit: 'mmol/L', unitConfirmed: true } });
  });

  it('refuses what cannot be a reading, and waits for a number', () => {
    expect(typedReading('0', 'mg/dL', false)).toEqual({ sanity: 'implausible' });
    expect(typedReading('-3', 'mmol/L', true)).toEqual({ sanity: 'implausible' });
    expect(typedReading('', 'mg/dL', false)).toEqual({ sanity: null });
    expect(typedReading('abc', 'mg/dL', false)).toEqual({ sanity: null });
    expect(typedReading(' 98 ', 'mg/dL', false)).toEqual({ sanity: 'ok', reading: { value: 98, unit: 'mg/dL' } });
  });
});
