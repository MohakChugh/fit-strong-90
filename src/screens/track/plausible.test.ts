import { describe, expect, it } from 'vitest';
import { checkPressure, checkValue, meterDisplay, parseNumber, unitQuestion } from './plausible';

describe('parseNumber', () => {
  it('reads plain numbers, a decimal comma and digit grouping', () => {
    expect(parseNumber('112')).toBe(112);
    expect(parseNumber(' 7.2 ')).toBe(7.2);
    expect(parseNumber('7,2')).toBe(7.2);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('4,820')).toBe(4820);
    expect(parseNumber('1,25,000')).toBe(125000);
    expect(parseNumber('1,250.5')).toBe(1250.5);
    expect(parseNumber('12 480')).toBe(12480);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('5.')).toBe(5);
  });

  it('refuses anything that is not a plain non-negative number', () => {
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('   ')).toBeUndefined();
    expect(parseNumber('-5')).toBeUndefined();
    expect(parseNumber('1e3')).toBeUndefined();
    expect(parseNumber('12a')).toBeUndefined();
    expect(parseNumber('7..2')).toBeUndefined();
    expect(parseNumber('HI')).toBeUndefined();
  });
});

describe('checkValue: glucose', () => {
  it('takes any reading above zero, as the check-in does', () => {
    expect(checkValue('glucose', '6.2', 'mg/dL')).toEqual({ ok: true, value: 6.2 });
    expect(checkValue('glucose', '600', 'mg/dL')).toEqual({ ok: true, value: 600 });
    expect(checkValue('glucose', '0.6', 'mmol/L')).toEqual({ ok: true, value: 0.6 });
    expect(checkValue('glucose', '34', 'mmol/L')).toEqual({ ok: true, value: 34 });
  });

  it('never refuses an extreme high: it is acted on (J13: 600.1 and 601 are not implausible)', () => {
    expect(checkValue('glucose', '600.1', 'mg/dL')).toEqual({ ok: true, value: 600.1 });
    expect(checkValue('glucose', '601', 'mg/dL')).toEqual({ ok: true, value: 601 });
    expect(checkValue('glucose', '1200', 'mg/dL')).toEqual({ ok: true, value: 1200 });
  });

  it('keeps the full precision of a converted reading, so 600/18 mmol/L is still 600 mg/dL', () => {
    expect(checkValue('glucose', String(600 / 18), 'mmol/L')).toEqual({ ok: true, value: 600 / 18 });
    expect(checkValue('glucose', String(601 / 18), 'mmol/L')).toEqual({ ok: true, value: 601 / 18 });
  });

  it('refuses zero, and a mmol/L number past what any meter reads, pointing at the unit and the emergency', () => {
    expect(checkValue('glucose', '0', 'mg/dL')).toMatchObject({ ok: false });
    expect(checkValue('glucose', '0', 'mmol/L')).toMatchObject({ ok: false });
    // 40 typed in mmol/L is most likely 40 mg/dL: refused until the unit is right.
    const mistaken = checkValue('glucose', '34.1', 'mmol/L');
    expect(mistaken.ok).toBe(false);
    if (!mistaken.ok) {
      expect(mistaken.message).toMatch(/mg\/dL, switch the unit/);
      expect(mistaken.message).toMatch(/emergency/);
    }
  });

  it('asks about the unit in the two zones the check-in asks about', () => {
    expect(unitQuestion('glucose', 6.5, 'mmol/L')).toBeUndefined();
    expect(unitQuestion('glucose', 33.9, 'mg/dL')).toMatchObject({ to: 'mmol/L' });
    expect(unitQuestion('glucose', 34, 'mg/dL')).toBeUndefined();
    expect(unitQuestion('glucose', 34, 'mmol/L')).toBeUndefined();
    expect(unitQuestion('glucose', 34.1, 'mmol/L')).toMatchObject({ to: 'mg/dL' });
    expect(unitQuestion('glucose', 0, 'mg/dL')).toBeUndefined();
    expect(unitQuestion('weight', 20, 'kg')).toBeUndefined();
  });

  it('recognises a meter display typed as letters, and nothing else', () => {
    expect(meterDisplay(' hi ')).toBe('HI');
    expect(meterDisplay('Lo')).toBe('LO');
    expect(meterDisplay('high')).toBeUndefined();
    expect(meterDisplay('112')).toBeUndefined();
  });
});

describe('checkValue: other kinds', () => {
  it('needs whole numbers where a device shows whole numbers', () => {
    expect(checkValue('steps', '4820.5', 'steps').ok).toBe(false);
    expect(checkValue('backPain', '4.5', '0-10').ok).toBe(false);
    expect(checkValue('backPain', '10', '0-10')).toEqual({ ok: true, value: 10 });
    expect(checkValue('backPain', '0', '0-10')).toEqual({ ok: true, value: 0 });
    expect(checkValue('backPain', '11', '0-10').ok).toBe(false);
  });

  it('checks each unit against its own range', () => {
    expect(checkValue('weight', '180', 'lb')).toEqual({ ok: true, value: 180 });
    expect(checkValue('weight', '500', 'kg').ok).toBe(false);
    expect(checkValue('hba1c', '53', 'mmol/mol')).toEqual({ ok: true, value: 53 });
    expect(checkValue('hba1c', '53', '%').ok).toBe(false);
    expect(checkValue('vitaminD', '75', 'nmol/L')).toEqual({ ok: true, value: 75 });
    expect(checkValue('sleep', '7.5', 'h')).toEqual({ ok: true, value: 7.5 });
    expect(checkValue('sleep', '25', 'h').ok).toBe(false);
  });

  it('says what is wrong in plain words', () => {
    expect(checkValue('weight', '', 'kg')).toEqual({ ok: false, message: 'Enter a number.' });
    expect(checkValue('weight', 'abc', 'kg')).toEqual({ ok: false, message: 'Enter a number, using digits only.' });
    expect(checkValue('weight', '80', 'stone')).toEqual({ ok: false, message: 'This app does not record stone for this.' });
  });

  it('writes the ends of a scale without a unit after each', () => {
    expect(checkValue('backPain', '11', '0-10')).toEqual({ ok: false, message: 'That looks too high. Enter a value from 0 to 10.' });
  });
});

describe('checkPressure', () => {
  it('accepts a normal reading', () => {
    expect(checkPressure('138', '86')).toEqual({ ok: true, systolic: 138, diastolic: 86 });
  });

  it('refuses a top number that is not above the bottom one', () => {
    const r = checkPressure('80', '120');
    expect(r).toMatchObject({ ok: false, field: 'both' });
    expect(checkPressure('90', '90')).toMatchObject({ ok: false, field: 'both' });
  });

  it('names the number that is wrong', () => {
    expect(checkPressure('', '86')).toEqual({ ok: false, field: 'systolic', message: 'Enter the top number.' });
    expect(checkPressure('138', '')).toEqual({ ok: false, field: 'diastolic', message: 'Enter the bottom number.' });
    expect(checkPressure('1380', '86')).toMatchObject({ ok: false, field: 'systolic' });
    expect(checkPressure('138.5', '86')).toMatchObject({ ok: false, field: 'systolic' });
    expect(checkPressure('', '')).toMatchObject({ ok: false, field: 'both' });
  });

  it('keeps severe readings: refusing one would hide the guidance it needs', () => {
    expect(checkPressure('220', '130')).toEqual({ ok: true, systolic: 220, diastolic: 130 });
  });
});
