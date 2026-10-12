import { describe, expect, it } from 'vitest';
import {
  addDays, clampDay, daysBetween, daysIn, isPeriod, mondayOf, periodRange, subtractMonths, weekOf,
} from './periods';

describe('day arithmetic', () => {
  it('adds days across month and year ends, and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('clamps months to the end of a shorter month', () => {
    expect(subtractMonths('2026-03-31', 1)).toBe('2026-02-28');
    expect(subtractMonths('2028-03-31', 1)).toBe('2028-02-29');
    expect(subtractMonths('2026-10-08', 3)).toBe('2026-07-08');
    expect(subtractMonths('2026-01-15', 1)).toBe('2025-12-15');
    expect(subtractMonths('2026-10-08', 12)).toBe('2025-10-08');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('refuses something that is not a day', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('weeks run Monday to Sunday', () => {
  it('finds the Monday of any day', () => {
    expect(mondayOf('2026-10-08')).toBe('2026-10-05'); // a Thursday
    expect(mondayOf('2026-10-05')).toBe('2026-10-05'); // a Monday
    expect(mondayOf('2026-10-11')).toBe('2026-10-05'); // a Sunday belongs to the week before
    expect(mondayOf('2026-01-01')).toBe('2025-12-29');
  });

  it('gives the whole week', () => {
    expect(weekOf('2026-10-08')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });
});

describe('periodRange', () => {
  it('ends on the given day, inclusive', () => {
    expect(periodRange('week', '2026-10-08')).toEqual({ from: '2026-10-02', to: '2026-10-08' });
    expect(daysIn(periodRange('week', '2026-10-08'))).toHaveLength(7);
    expect(periodRange('month', '2026-10-08')).toEqual({ from: '2026-09-09', to: '2026-10-08' });
    expect(periodRange('month', '2026-03-31')).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(periodRange('quarter', '2026-10-08')).toEqual({ from: '2026-07-09', to: '2026-10-08' });
    expect(periodRange('year', '2026-10-08')).toEqual({ from: '2025-10-09', to: '2026-10-08' });
    expect(daysIn(periodRange('year', '2026-10-08'))).toHaveLength(365);
  });

  it('recognises its own ids only', () => {
    expect(isPeriod('quarter')).toBe(true);
    expect(isPeriod('decade')).toBe(false);
  });
});

describe('daysIn', () => {
  it('lists every day, oldest first, and nothing for an inverted range', () => {
    expect(daysIn({ from: '2026-09-29', to: '2026-10-02' })).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(daysIn({ from: '2026-10-02', to: '2026-10-01' })).toEqual([]);
  });
});

describe('clampDay', () => {
  const now = '2026-10-08';
  it('keeps a real past day and refuses the future', () => {
    expect(clampDay('2026-10-01', now)).toBe('2026-10-01');
    expect(clampDay('2026-10-08', now)).toBe('2026-10-08');
    expect(clampDay('2026-10-09', now)).toBe('2026-10-08');
    expect(clampDay('2026-13-01', now)).toBe('2026-10-08');
    expect(clampDay(null, now)).toBe('2026-10-08');
    expect(clampDay('yesterday', now)).toBe('2026-10-08');
  });
});
