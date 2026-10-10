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

  it('keeps only the latest start: an address from an earlier tap, left in history, starts nothing (KH-14)', () => {
    const plan = { kind: 'walk' as const, gps: false, steps: false };
    const at = Date.UTC(2026, 9, 8, 3, 30);
    const id = (href: string) => walkFromSearch(new URLSearchParams(href.split('?')[1]), at + 60_000)!.id;
    const earlier = id(startedHref(plan, at));
    const latest = id(startedHref(plan, at + 1000));
    expect(takeStarted(earlier)).toBeUndefined();
    expect(takeStarted(latest)).toEqual(plan);
  });
});
