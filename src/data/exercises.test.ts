import { describe, it, expect } from 'vitest';
import { exercises, getExerciseById, LEGACY_IDS } from './exercises';
import { CATALOG } from './catalog';

describe('unified exercise list', () => {
  it('lists every active catalogue id exactly once', () => {
    const active = CATALOG.filter(m => !('retired' in m && m.retired)).map(m => m.id);
    expect(exercises.map(e => e.id)).toEqual(active);
  });

  it('resolves every catalogue id, retired ones included', () => {
    expect(CATALOG.map(m => m.id).filter(id => !getExerciseById(id))).toEqual([]);
  });

  it('derives coaching content for the trap-bar deadlift', () => {
    const ex = getExerciseById('trap-bar-deadlift');
    expect(ex).toMatchObject({ id: 'trap-bar-deadlift', category: 'legs' });
    expect(ex!.instructions.length).toBeGreaterThanOrEqual(4);
    expect(ex!.tips!.length).toBeGreaterThanOrEqual(3);
    expect(ex!.commonMistakes.length).toBeGreaterThanOrEqual(2);
    expect(ex!.youtubeSearchQuery).not.toBe('');
  });

  it('keeps legacy history ids resolvable with a readable name and content', () => {
    for (const id of LEGACY_IDS) {
      const ex = getExerciseById(id);
      expect(ex, id).toBeDefined();
      expect(ex!.name, id).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(ex!.instructions.length, id).toBeGreaterThan(0);
    }
  });

  it('shows the replacement coaching for retired duplicates under the old name', () => {
    const old = getExerciseById('hip-opener-stretch')!;
    const now = getExerciseById('half-kneeling-hip-flexor-stretch')!;
    expect(old.instructions).toEqual(now.instructions);
    expect(exercises.some(e => e.id === 'hip-opener-stretch')).toBe(false);
  });

  it('categorises stretches and cardio for the Library', () => {
    expect(getExerciseById('treadmill-walk')?.category).toBe('cardio');
    expect(getExerciseById('half-kneeling-hip-flexor-stretch')?.category).toBe('mobility');
  });
});
