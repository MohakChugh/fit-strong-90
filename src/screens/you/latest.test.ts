import { describe, expect, it } from 'vitest';
import { latestOnly } from './latest';

describe('latestOnly', () => {
  it('lets only the newest of overlapping requests land, whichever finishes first', () => {
    const latest = latestOnly();
    const a = latest.next();
    const b = latest.next();
    // B finishes first and lands; A, finishing later, is ignored.
    expect(latest.isCurrent(b)).toBe(true);
    expect(latest.isCurrent(a)).toBe(false);
  });

  it('can retire every request in flight', () => {
    const latest = latestOnly();
    const a = latest.next();
    latest.cancel();
    expect(latest.isCurrent(a)).toBe(false);
  });
});
