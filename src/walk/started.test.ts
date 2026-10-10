import { describe, expect, it } from 'vitest';
import { walkFromSearch } from './plan';
import { startedHref, takeStarted } from './started';

describe('the walks the start flow has just started (H6-04)', () => {
  it('gives each its own address, and the plan once, to the live screen alone', () => {
    const plan = { kind: 'walk' as const, gps: true, steps: false };
    const href = startedHref(plan, Date.UTC(2026, 9, 8, 3, 30));
    const asked = walkFromSearch(new URLSearchParams(href.split('?')[1]), Date.UTC(2026, 9, 8, 3, 30))!;
    expect(takeStarted(asked.id)).toEqual(plan);
    // Taken: a second arrival at the same address is no start.
    expect(takeStarted(asked.id)).toBeUndefined();
    expect(takeStarted('mgh3k2x1-zzzzzzzz')).toBeUndefined();
  });
});
