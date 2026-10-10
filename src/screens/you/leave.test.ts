import { describe, expect, it } from 'vitest';
import { buildId } from './about';
import { earliest, historyIndex, leaveDelta } from './leave';

describe('buildId', () => {
  it('reads the build hash from the entry script', () => {
    expect(buildId(['https://mohakchugh.github.io/fit-strong-90/assets/index-D4xkQ2aB.js'])).toBe('D4xkQ2aB');
    expect(buildId(['/fit-strong-90/assets/vendor-AAAA1111.js', '/fit-strong-90/assets/index-Bx_7-q2Z.js?v=1'])).toBe('Bx_7-q2Z');
  });

  it('has none on a development server', () => {
    expect(buildId(['http://127.0.0.1:5173/fit-strong-90/src/main.tsx', 'http://127.0.0.1:5173/@vite/client'])).toBeUndefined();
    expect(buildId([])).toBeUndefined();
  });
});

describe('leaving You', () => {
  it('goes back to the entry before the first You screen, past everything pushed inside', () => {
    // Today at 4, You at 5, Data at 6, back to You by a link at 7.
    expect(leaveDelta(5, 7)).toBe(-3);
    expect(leaveDelta(5, 5)).toBe(-1);
  });

  it('lands on Today when You was the first page loaded, or the history makes no sense', () => {
    expect(leaveDelta(0, 3)).toBeUndefined();
    expect(leaveDelta(undefined, 3)).toBeUndefined();
    expect(leaveDelta(5, undefined)).toBeUndefined();
    expect(leaveDelta(6, 5)).toBeUndefined();
  });

  it('remembers the lowest You entry seen, so coming back by the back button still finds the start', () => {
    expect(earliest(undefined, 6)).toBe(6);
    expect(earliest(6, 5)).toBe(5);
    expect(earliest(5, 9)).toBe(5);
    expect(earliest(5, undefined)).toBe(5);
  });

  it('reads React Router\'s index from history state, and nothing else', () => {
    expect(historyIndex({ usr: null, key: 'abc', idx: 4 })).toBe(4);
    expect(historyIndex({ idx: '4' })).toBeUndefined();
    expect(historyIndex({ idx: -1 })).toBeUndefined();
    expect(historyIndex(null)).toBeUndefined();
    expect(historyIndex(undefined)).toBeUndefined();
  });
});
