/**
 * Scan J2-14: one way of writing a time of day, wherever the app writes one.
 */

import { describe, expect, it } from 'vitest';
import { formatTime, prefersHour12, timeOf } from './time';
import { formatClock } from '@/screens/track/format';
import { timeOfDay } from '@/walk/format';
import { timeText } from '@/screens/workout/summary';
import { clockFormat } from '@/screens/you/summaries';

describe('formatTime', () => {
  it('writes a 12-hour time with no leading zero, and am or pm', () => {
    expect(formatTime(7, 53, true)).toBe('7:53 am');
    expect(formatTime(9, 16, true)).toBe('9:16 am');
    expect(formatTime(0, 5, true)).toBe('12:05 am');
    expect(formatTime(12, 30, true)).toBe('12:30 pm');
    expect(formatTime(19, 40, true)).toBe('7:40 pm');
  });

  it('writes a 24-hour time with two digits', () => {
    expect(formatTime(7, 38, false)).toBe('07:38');
    expect(formatTime(19, 40, false)).toBe('19:40');
    expect(formatTime(0, 0, false)).toBe('00:00');
  });

  it('follows the device by default', () => {
    expect(formatTime(19, 40)).toBe(formatTime(19, 40, prefersHour12()));
  });
});

describe('prefersHour12', () => {
  it('reads the clock a locale uses', () => {
    expect(prefersHour12('en-GB')).toBe(false);
    expect(prefersHour12('en-US')).toBe(true);
    expect(prefersHour12('en-IN')).toBe(true);
  });
});

describe('timeOf', () => {
  it('writes an instant on this device’s clock, from a date, milliseconds or an ISO string', () => {
    const d = new Date(2026, 9, 8, 7, 53, 20);
    expect(timeOf(d, true)).toBe('7:53 am');
    expect(timeOf(d.getTime(), false)).toBe('07:53');
    expect(timeOf(d.toISOString(), true)).toBe('7:53 am');
    expect(timeOf('not a time', true)).toBe('');
  });
});

describe('every screen writes a time the same way', () => {
  const d = new Date(2026, 9, 8, 9, 16, 0);
  it('Track, Walk, the workout log and You give what the shared formatter gives', () => {
    for (const hour12 of [true, false]) {
      // Track reads the wall clock the reading was recorded in; here that is this device's.
      const local = `2026-10-08T09:16:00.000${(() => {
        const off = -d.getTimezoneOffset();
        const abs = Math.abs(off);
        return `${off < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
      })()}`;
      expect(formatClock(local, hour12)).toBe(formatTime(9, 16, hour12));
    }
    expect(timeOfDay(d.getTime())).toBe(timeOf(d));
    expect(timeText(d.toISOString())).toBe(timeOf(d));
    // A locale given still gets the app's own way of writing it, never its "AM" or a leading zero.
    expect(timeOfDay(d.getTime(), 'en-US')).toBe('9:16 am');
    expect(timeOfDay(d.getTime(), 'en-GB')).toBe('09:16');
    expect(timeText(d.toISOString(), 'en-US')).toBe('9:16 am');
    expect(clockFormat(9 * 60 + 16)).toBe(formatTime(9, 16));
    expect(timeOf(d, true)).toBe('9:16 am');
  });
});
