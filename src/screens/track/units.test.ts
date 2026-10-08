import { describe, expect, it } from 'vitest';
import {
  convert, decimalsFor, displayValue, formatCompact, formatNumber, glucoseMgdl, roundTo, toCanonical,
} from './units';

describe('glucose conversion', () => {
  it('uses factor 18, unrounded (D29)', () => {
    expect(convert('glucose', 7.2, 'mmol/L', 'mg/dL')).toBeCloseTo(129.6, 10);
    expect(convert('glucose', 33.3, 'mmol/L', 'mg/dL')).toBeCloseTo(599.4, 10);
    expect(convert('glucose', 54, 'mg/dL', 'mmol/L')).toBe(3);
    expect(glucoseMgdl(3.9, 'mmol/L')).toBeCloseTo(70.2, 10);
    expect(glucoseMgdl(112, 'mg/dL')).toBe(112);
  });

  it('round-trips without drift', () => {
    expect(convert('glucose', convert('glucose', 6.1, 'mmol/L', 'mg/dL'), 'mg/dL', 'mmol/L')).toBeCloseTo(6.1, 12);
  });
});

describe('HbA1c conversion (IFCC–NGSP master equation)', () => {
  it('maps 7% to 53 mmol/mol and 6.5% to 48, as ADA pairs them', () => {
    expect(Math.round(convert('hba1c', 7, '%', 'mmol/mol'))).toBe(53);
    expect(Math.round(convert('hba1c', 6.5, '%', 'mmol/mol'))).toBe(48);
    expect(roundTo(convert('hba1c', 53, 'mmol/mol', '%'), 1)).toBe(7);
  });

  it('is the exact inverse in both directions', () => {
    expect(convert('hba1c', convert('hba1c', 8.3, '%', 'mmol/mol'), 'mmol/mol', '%')).toBeCloseTo(8.3, 12);
  });
});

describe('B12 and vitamin D conversion', () => {
  it('B12: 200 pg/mL is about 148 pmol/L (NIH ODS pairing)', () => {
    expect(Math.round(convert('b12', 200, 'pg/mL', 'pmol/L'))).toBe(148);
    expect(convert('b12', convert('b12', 350, 'pg/mL', 'pmol/L'), 'pmol/L', 'pg/mL')).toBeCloseTo(350, 10);
  });

  it('vitamin D: 1 ng/mL is 2.5 nmol/L', () => {
    expect(convert('vitaminD', 20, 'ng/mL', 'nmol/L')).toBe(50);
    expect(convert('vitaminD', 125, 'nmol/L', 'ng/mL')).toBe(50);
  });
});

describe('weight and length', () => {
  it('uses the exact international pound and inch', () => {
    expect(convert('weight', 1, 'lb', 'kg')).toBe(0.45359237);
    expect(convert('waist', 1, 'in', 'cm')).toBe(2.54);
    expect(convert('weight', 82, 'kg', 'lb')).toBeCloseTo(180.779, 3);
  });

  it('converts to the canonical stored unit', () => {
    expect(toCanonical('weight', 180, 'lb')).toBeCloseTo(81.647, 3);
    expect(toCanonical('glucose', 6, 'mmol/L')).toBe(108);
  });

  it('refuses a pair it does not know rather than passing the number through', () => {
    expect(() => convert('weight', 80, 'kg', 'mg/dL')).toThrow();
    expect(() => convert('steps', 80, 'steps', 'km')).toThrow();
    expect(convert('steps', 8000, 'steps', 'steps')).toBe(8000);
  });
});

describe('reading precision and formatting', () => {
  it('reads each unit to the precision a meter or lab shows', () => {
    expect(decimalsFor('glucose', 'mg/dL')).toBe(0);
    expect(decimalsFor('glucose', 'mmol/L')).toBe(1);
    expect(decimalsFor('hba1c', '%')).toBe(1);
    expect(decimalsFor('hba1c', 'mmol/mol')).toBe(0);
    expect(decimalsFor('steps', 'steps')).toBe(0);
  });

  it('rounds half away from zero without float dust', () => {
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.5, 0)).toBe(-2);
    expect(roundTo(129.6, 0)).toBe(130);
  });

  it('shows a converted reading at its precision', () => {
    expect(displayValue('glucose', 112, 'mg/dL', 'mmol/L')).toBe(6.2);
    expect(displayValue('glucose', 6.2, 'mmol/L', 'mg/dL')).toBe(112);
  });

  it('groups digits the Indian way and never shows -0', () => {
    expect(formatNumber(12500)).toBe('12,500');
    expect(formatNumber(125000)).toBe('1,25,000');
    expect(formatNumber(7.25, 1)).toBe('7.3');
    expect(formatNumber(-0.04, 1)).toBe('0.0');
    expect(formatCompact(7.5)).toBe('7.5');
    expect(formatCompact(8)).toBe('8');
  });
});
