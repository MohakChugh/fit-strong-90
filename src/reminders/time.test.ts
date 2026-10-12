import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMinutes,
  compareWall,
  formatClock,
  instantOf,
  minutesBetween,
  msToNextMinute,
  parseClock,
  wallTimeOf,
} from './time';

describe('parseClock', () => {
  it('reads 24-hour HH:MM as minutes after midnight', () => {
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('09:30')).toBe(570);
    expect(parseClock('23:59')).toBe(1439);
  });

  it('refuses anything that is not a real time, rather than guessing', () => {
    for (const bad of ['24:00', '9:30', '09:60', '12:5', '1230', 'noon', '', ' 09:30', '09:30 ']) {
      expect(parseClock(bad), bad).toBeUndefined();
    }
    expect(parseClock(undefined)).toBeUndefined();
    expect(parseClock(570)).toBeUndefined();
    expect(parseClock(null)).toBeUndefined();
  });
});

describe('formatClock', () => {
  it('pads, and wraps past midnight in both directions', () => {
    expect(formatClock(570)).toBe('09:30');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(1440 + 30)).toBe('00:30');
    expect(formatClock(-30)).toBe('23:30');
  });
});

describe('day arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('moves a wall time across midnight both ways', () => {
    expect(addMinutes({ day: '2026-10-08', minute: 1430 }, 20)).toEqual({ day: '2026-10-09', minute: 10 });
    expect(addMinutes({ day: '2026-10-08', minute: 5 }, -15)).toEqual({ day: '2026-10-07', minute: 1430 });
    expect(addMinutes({ day: '2026-12-31', minute: 1439 }, 1)).toEqual({ day: '2027-01-01', minute: 0 });
  });

  it('measures and orders wall times across days', () => {
    const late = { day: '2026-10-08', minute: 1430 };
    const early = { day: '2026-10-09', minute: 10 };
    expect(minutesBetween(late, early)).toBe(20);
    expect(minutesBetween(early, late)).toBe(-20);
    expect(compareWall(late, early)).toBeLessThan(0);
    expect(compareWall(early, late)).toBeGreaterThan(0);
    expect(compareWall(late, { ...late })).toBe(0);
  });
});

describe('the device clock', () => {
  it('reads and writes local wall time, whatever zone the tests run in', () => {
    const at = new Date(2026, 9, 8, 21, 5, 42);
    expect(wallTimeOf(at)).toEqual({ day: '2026-10-08', minute: 21 * 60 + 5 });
    expect(instantOf({ day: '2026-10-08', minute: 21 * 60 + 5 }).getTime()).toBe(new Date(2026, 9, 8, 21, 5).getTime());
  });
});

describe('msToNextMinute', () => {
  it('counts to the start of the next minute, where quiet hours and days begin', () => {
    const at = (h: number, m: number, sec: number, ms = 0) => new Date(2026, 9, 8, h, m, sec, ms).getTime();
    expect(msToNextMinute(at(9, 59, 58))).toBe(2000);
    expect(msToNextMinute(at(9, 59, 59, 999))).toBe(1);
    expect(msToNextMinute(at(10, 0, 0))).toBe(60_000);
    expect(msToNextMinute(at(23, 59, 30))).toBe(30_000);
  });
});
