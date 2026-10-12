import { describe, it, expect } from 'vitest';
import { parseNumber, readCount, readMinutes, readWeight, stepCount, stepMinutes, stepWeight, weightText } from './entry';

describe('field text', () => {
  it('reads a blank as nothing, a comma as a decimal point, and refuses anything else', () => {
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('22,5')).toBe(22.5);
    expect(parseNumber('22.5')).toBe(22.5);
    expect(parseNumber('.')).toBeNaN();
    expect(parseNumber('-5')).toBeNaN();
    expect(parseNumber('1e3')).toBeNaN();
    expect(parseNumber('10 kg')).toBeNaN();
  });
});

describe('reps and seconds', () => {
  it('needs a whole number of at least one', () => {
    expect(readCount('10', false)).toEqual({ ok: true, value: 10 });
    expect(readCount('', false)).toEqual({ ok: false, message: 'Enter the reps.' });
    expect(readCount('0', false).ok).toBe(false);
    expect(readCount('8.5', false).ok).toBe(false);
    expect(readCount('', true)).toEqual({ ok: false, message: 'Enter the seconds.' });
  });

  it('catches a slipped digit', () => {
    expect(readCount('200', false).ok).toBe(true);
    expect(readCount('1000', false).ok).toBe(false);
    expect(readCount('1000', true).ok).toBe(true);
  });
});

describe('weight units at the edge', () => {
  it('stores pounds as kilograms and shows exactly the pounds typed', () => {
    for (const lb of ['0', '5', '22.5', '88.2', '135', '227.3', '1000']) {
      const read = readWeight(lb, false);
      expect(read.ok).toBe(true);
      if (!read.ok) continue;
      expect(weightText(read.value, false)).toBe(lb);
    }
    const hundred = readWeight('100', false);
    expect(hundred.ok && hundred.value).toBeCloseTo(45.359, 3);
  });

  it('keeps kilograms as typed, including plate steps', () => {
    expect(readWeight('41,25', true)).toEqual({ ok: true, value: 41.25 });
    expect(weightText(41.25, true)).toBe('41.25');
    expect(weightText(50, false)).toBe('110.2');
  });

  it('leaves a blank weight as not entered rather than zero', () => {
    expect(readWeight('', true)).toEqual({ ok: true, value: null });
    expect(weightText(null, true)).toBe('');
    expect(weightText(0, true)).toBe('0');
  });

  it('refuses nonsense and an implausible load', () => {
    expect(readWeight('abc', true).ok).toBe(false);
    expect(readWeight('600', true).ok).toBe(false);
    // The ceiling is checked in kilograms and stated in the user's unit.
    expect(readWeight('1200', false)).toEqual({ ok: false, message: 'That is more than 1102 lbs. Check the number.' });
    expect(readWeight('1000', false).ok).toBe(true);
  });
});

describe('active minutes', () => {
  it('are optional, whole, and within a day of training', () => {
    expect(readMinutes('')).toEqual({ ok: true, value: null });
    expect(readMinutes('45')).toEqual({ ok: true, value: 45 });
    expect(readMinutes('0').ok).toBe(false);
    expect(readMinutes('12.5').ok).toBe(false);
    expect(readMinutes('601').ok).toBe(false);
  });

  it('step in fives, and below five go back to not said', () => {
    expect(stepMinutes('', 1)).toBe('5');
    expect(stepMinutes('45', 1)).toBe('50');
    expect(stepMinutes('5', -1)).toBe('');
    expect(stepMinutes('', -1)).toBe('');
    expect(stepMinutes('600', 1)).toBe('600');
  });
});

describe('steppers', () => {
  it('steps weight by 2.5 kg or 5 lb, never below zero, without float noise', () => {
    expect(stepWeight('20', 1, true)).toBe('22.5');
    expect(stepWeight('', 1, true)).toBe('2.5');
    expect(stepWeight('1', -1, true)).toBe('0');
    expect(stepWeight('88.2', 1, false)).toBe('93.2');
    // 1.07 + 2.5 is 3.5700000000000003 in floating point.
    expect(stepWeight('1.07', 1, true)).toBe('3.57');
    let w = '0';
    for (let i = 0; i < 40; i++) w = stepWeight(w, 1, true);
    expect(w).toBe('100');
    let lb = '90.9';
    for (let i = 0; i < 9; i++) lb = stepWeight(lb, 1, false);
    expect(lb).toBe('135.9');
  });

  it('steps reps by one and holds by five seconds, never below one', () => {
    expect(stepCount('10', 1, false)).toBe('11');
    expect(stepCount('1', -1, false)).toBe('1');
    expect(stepCount('', 1, false)).toBe('1');
    expect(stepCount('30', 1, true)).toBe('35');
    expect(stepCount('200', 1, false)).toBe('200');
  });
});
