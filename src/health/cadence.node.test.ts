import { afterEach, describe, expect, it } from 'vitest';
import { latestStart } from './cadence';

// The app's own tests run in whatever zone the machine is in; this one needs a
// zone with a clock change at the end of March to be meaningful.
const zone = process.env.TZ;
afterEach(() => { process.env.TZ = zone; });

describe('latestStart across a clock change', () => {
  it('ends March on the 31st where the last day of the month is 23 hours long', () => {
    process.env.TZ = 'Europe/London';
    expect(new Date(2024, 3, 1).getTimezoneOffset()).toBe(-60);
    expect(latestStart('2024-03')).toBe('2024-03-31');
    expect(latestStart('2025-03')).toBe('2025-03-31');
  });
});
