import { describe, it, expect } from 'vitest';
import { COACHING, getCoaching } from './index';
import { CATALOG, getMeta } from '@/data/catalog';

const active = CATALOG.filter(m => !('retired' in m && m.retired));
const SPOKEN: (keyof (typeof COACHING)[number])[] = ['summary', 'breathing', 'feel', 'shouldNotFeel', 'why'];

describe('coaching content', () => {
  it('covers every active catalogue id', () => {
    expect(active.filter(m => !getCoaching(m.id)).map(m => m.id)).toEqual([]);
  });

  it('has no coaching for ids missing from the catalogue', () => {
    expect(COACHING.filter(c => !getMeta(c.id)).map(c => c.id)).toEqual([]);
  });

  it('resolves retired aliases to their replacement', () => {
    expect(getCoaching('hip-opener-stretch')?.id).toBe('half-kneeling-hip-flexor-stretch');
  });

  it('fills every field', () => {
    const problems: string[] = [];
    for (const c of COACHING) {
      for (const f of SPOKEN) if (!String(c[f] ?? '').trim()) problems.push(`${c.id}.${String(f)} empty`);
      if (c.steps.length < 4 || c.steps.length > 7) problems.push(`${c.id} has ${c.steps.length} steps`);
      if (c.cues.length < 3) problems.push(`${c.id} has ${c.cues.length} cues`);
      if (!c.youtube.tutorial || !c.youtube.mistakes) problems.push(`${c.id} youtube`);
      if (c.sources.length < 1) problems.push(`${c.id} sources`);
      if (c.mistakes.length < 1) problems.push(`${c.id} mistakes`);
      for (const m of c.mistakes) if (!m.clip.startsWith(`${c.id}.`)) problems.push(`${c.id} clip ${m.clip}`);
      const meta = getMeta(c.id);
      if (meta?.kind === 'strength' && c.mistakes.length < 2) problems.push(`${c.id} needs 2 mistakes`);
    }
    expect(problems).toEqual([]);
  });

  it('never tells anyone to hold their breath', () => {
    // Flags an instruction to hold the breath (sentence-initial imperative), not warnings about it.
    const imperative = /(?:^|[.!?]\s+)(?:then\s+)?hold (?:your|the) breath/i;
    const offenders = COACHING.filter(c => [c.breathing, ...c.steps, ...c.cues].some(t => imperative.test(t)));
    expect(offenders.map(c => c.id)).toEqual([]);
  });

  it('uses unique mistake clip ids', () => {
    const clips = COACHING.flatMap(c => c.mistakes.map(m => m.clip));
    expect(new Set(clips).size).toBe(clips.length);
  });

  it('points regressions at existing ids', () => {
    expect(COACHING.filter(c => c.backSafety.regression && !getMeta(c.backSafety.regression)).map(c => c.id)).toEqual([]);
  });
});
