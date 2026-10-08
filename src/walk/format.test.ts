import { describe, expect, it } from 'vitest';
import { clock, count, km, pace, span, spokenClock, wholeMinutes } from './format';

describe('format', () => {
  it('reads a stopwatch, rounding down so a second shows once it has passed', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(999)).toBe('0:00');
    expect(clock(7_000)).toBe('0:07');
    expect(clock(522_400)).toBe('8:42');
    expect(clock(3_735_000)).toBe('1:02:15');
    expect(clock(-5)).toBe('0:00');
  });

  it('says the stopwatch in words', () => {
    expect(spokenClock(522_000)).toBe('8 minutes 42 seconds');
    expect(spokenClock(61_000)).toBe('1 minute 1 second');
    expect(spokenClock(3_600_000)).toBe('1 hour 0 minutes 0 seconds');
    expect(spokenClock(4_000)).toBe('4 seconds');
  });

  it('reads a pace in minutes and seconds per kilometre', () => {
    expect(pace(769.2)).toBe('12:49');
    expect(pace(600)).toBe('10:00');
    expect(pace(59.6)).toBe('1:00');
  });

  it('reads kilometres to two places from metres', () => {
    expect(km(650)).toBe('0.65');
    expect(km(12_404)).toBe('12.40');
    expect(km(-3)).toBe('0.00');
  });

  it('groups counts the way the reader does', () => {
    expect(count(1204, 'en-US')).toBe('1,204');
    expect(count(120450, 'en-IN')).toBe('1,20,450');
  });

  it('says a stretch of time plainly', () => {
    expect(span(12_000)).toBe('12 seconds');
    expect(span(1_000)).toBe('1 second');
    expect(span(240_000)).toBe('4 min');
    expect(span(3_900_000)).toBe('1 h 5 min');
    expect(span(7_200_000)).toBe('2 h');
  });

  it('offers whole minutes, never zero', () => {
    expect(wholeMinutes(20_000)).toBe(1);
    expect(wholeMinutes(150_000)).toBe(3);
  });
});
