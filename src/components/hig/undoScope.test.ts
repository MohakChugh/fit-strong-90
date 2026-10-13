import { describe, expect, it } from 'vitest';
import { follow, isDetail, pathOf, scopeOf } from './undoScope';

describe('where an Undo belongs, by where each screen was opened from (B-04, D113, P8-14)', () => {
  it('stays on its screen, with any query, and Today’s log is one screen whichever day it shows', () => {
    const s = scopeOf('/day/today');
    expect(follow(s, { path: '/day/today' })).toBe(s);
    expect(follow(s, { path: '/day/2026-10-07' })).toBe(s);
    expect(follow(scopeOf('/hub/glucose'), { path: '/hub/glucose?add=glucose' })).toEqual(scopeOf('/hub/glucose'));
  });

  it('stays on a record detail opened from it, on one opened from that, and back again', () => {
    const s = scopeOf('/day/today');
    const reading = follow(s, { path: '/track/reading/g1', from: '/day/today' })!;
    expect(reading.inside).toEqual(['/track/reading/g1']);
    const walk = follow(reading, { path: '/track/walk/W', from: '/track/reading/g1' })!;
    expect(walk.inside).toEqual(['/track/reading/g1', '/track/walk/W']);
    expect(follow(walk, { path: '/track/reading/g1' })).toBe(walk);
    expect(follow(walk, { path: '/day/today' })).toBe(walk);
  });

  it('reads where a detail was opened from without its query: Log a meal from Usual meals’ own list', () => {
    expect(follow(scopeOf('/hub/food/usual'), { path: '/hub/food/log', from: '/hub/food/usual?add=1' })?.inside).toEqual(['/hub/food/log']);
    const reading = follow(scopeOf('/day/today'), { path: '/track/reading/g1', from: '/day/today' })!;
    expect(follow(reading, { path: '/track/walk/W', from: '/track/reading/g1#top' })?.inside).toEqual(['/track/reading/g1', '/track/walk/W']);
  });

  it('ends on a detail opened from somewhere else: a glucose Undo doesn’t survive a walk opened from Today’s log', () => {
    expect(follow(scopeOf('/hub/glucose'), { path: '/track/walk/W', from: '/day/today' })).toBeUndefined();
    expect(follow(scopeOf('/hub/glucose'), { path: '/track/walk/W' })).toBeUndefined();
  });

  it('ends on a screen that is no record’s, though opened from it: the hub’s See trends', () => {
    expect(follow(scopeOf('/hub/glucose'), { path: '/trends/glucose', from: '/hub/glucose' })).toBeUndefined();
    expect(follow(scopeOf('/day/today'), { path: '/home', from: '/day/today' })).toBeUndefined();
  });

  it('knows the app’s record screens and Log a meal, and reads a path without its query or hash', () => {
    expect(['/track/reading/g1', '/track/pressure/r1', '/track/walk/W', '/track/session/s1', '/track/workout/s1', '/track/check-in/2026-10-08', '/hub/food/log'].every(isDetail)).toBe(true);
    expect(['/track/reading/', '/trends/glucose', '/hub/food/usual', '/day/today'].some(isDetail)).toBe(false);
    expect(pathOf('/hub/food/log?edit=meal-1')).toBe('/hub/food/log');
    expect(pathOf('')).toBe('/');
  });
});
