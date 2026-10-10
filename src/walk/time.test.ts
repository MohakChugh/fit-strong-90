import { describe, expect, it } from 'vitest';
import { isoAt, nextMidnightAt, offsetAt } from './time';

describe('instants at a fixed offset (B-19)', () => {
  it('writes an instant at the offset it was recorded in, as `nowAt` does', () => {
    const t = Date.parse('2026-10-08T03:30:00Z');
    expect(isoAt(t, 330)).toBe('2026-10-08T09:00:00.000+05:30');
    expect(isoAt(t, -300)).toBe('2026-10-07T22:30:00.000-05:00');
    expect(isoAt(t, 0)).toBe('2026-10-08T03:30:00.000Z');
  });

  it('finds the next local midnight at that offset, after a moment already at midnight too', () => {
    expect(nextMidnightAt(Date.parse('2026-10-08T23:50:00+05:30'), 330)).toBe(Date.parse('2026-10-09T00:00:00+05:30'));
    expect(nextMidnightAt(Date.parse('2026-10-09T00:00:00+05:30'), 330)).toBe(Date.parse('2026-10-10T00:00:00+05:30'));
  });

  it('reads this device’s offset', () => {
    const t = Date.parse('2026-10-08T03:30:00Z');
    expect(offsetAt(t)).toBe(-new Date(t).getTimezoneOffset());
  });
});
