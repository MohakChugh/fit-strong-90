import { describe, expect, it } from 'vitest';
import { ageRange, asksAdult, birthYearProblem } from './age';

describe('the year you were born (journey §6.2 ch. 2; K-43; B-31)', () => {
  it('is optional, and checked to be 1920 to this year minus 18', () => {
    expect(birthYearProblem(undefined, 2026)).toBeNull();
    expect(birthYearProblem(1958, 2026)).toBeNull();
    expect(birthYearProblem(2008, 2026)).toBeNull();
    expect(birthYearProblem(2009, 2026)).toBe('FitStrong is made for adults aged 18 and over.');
    expect(birthYearProblem(1919, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(2030, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(19, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(1958.5, 2026)).toMatch(/four digits/);
    expect(birthYearProblem(Number.NaN, 2026)).toMatch(/four digits/);
  });

  it('asks "Are you 18 or over?" only for the one year that could be 17 (B-31)', () => {
    expect(asksAdult(2008, 2026)).toBe(true);
    expect(asksAdult(2007, 2026)).toBe(false);
    expect(asksAdult(undefined, 2026)).toBe(false);
  });

  it('reads a borderline year at its lower end, unless the person said they’re 18 (B-31)', () => {
    const today = new Date('2026-10-10T09:00:00+05:30');
    expect(ageRange(2008, today)).toEqual({ min: 17, max: 18 });
    expect(ageRange(2008, today, true)).toEqual({ min: 18, max: 18 });
    expect(ageRange(1966, today)).toEqual({ min: 59, max: 60 });
    expect(ageRange(undefined, today)).toBeUndefined();
  });
});
