import { describe, expect, it } from 'vitest';
import { splitSentences } from '@/voice/sentences';
import { CUE_GRACE_MS, WALK_CUES, cueDue, cuesSaidBy } from './cues';

const MIN = 60_000;

describe('the walk’s cues (journey §9.2, A-72)', () => {
  it('come at 10, 20, 30, 45 and 60 minutes', () => {
    expect(WALK_CUES.map(c => c.minute)).toEqual([10, 20, 30, 45, 60]);
  });

  it('are one recorded sentence each, with no number composed into it', () => {
    for (const c of WALK_CUES) {
      expect(splitSentences(c.line)).toEqual([c.line]);
      expect(c.line).not.toMatch(/\d/);
    }
  });

  it('are due once their minute is reached, and only once', () => {
    expect(cueDue(10 * MIN - 1, new Set())).toBeUndefined();
    expect(cueDue(10 * MIN, new Set())).toEqual({ minute: 10, line: 'Ten minutes of walking.' });
    expect(cueDue(10 * MIN + 30_000, new Set([10]))).toBeUndefined();
  });

  it('are dropped once their moment is long past, as after a reload or a long hold', () => {
    expect(cueDue(10 * MIN + CUE_GRACE_MS - 1, new Set())?.minute).toBe(10);
    expect(cueDue(10 * MIN + CUE_GRACE_MS, new Set())).toBeUndefined();
    expect(cueDue(75 * MIN, new Set())).toBeUndefined();
  });

  it('count the cues a walk already past them has had, so a reopened walk repeats none', () => {
    expect([...cuesSaidBy(0)]).toEqual([]);
    // Reopened exactly at its minute, the cue is still to say.
    expect([...cuesSaidBy(10 * MIN)]).toEqual([]);
    expect([...cuesSaidBy(10 * MIN + 1)]).toEqual([10]);
    expect([...cuesSaidBy(46 * MIN)]).toEqual([10, 20, 30, 45]);
  });
});
