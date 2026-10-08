import { describe, expect, it } from 'vitest';
import { exercises } from '@/data/exercises';
import { getMeta } from '@/data/catalog';
import {
  AREAS, backNote, doseLine, filterExercises, filterParams, libraryReturn, libraryState, NO_FILTERS, readFilters, relatedExercises, sections,
} from './library';

const ids = (f: Partial<typeof NO_FILTERS>) => filterExercises({ ...NO_FILTERS, ...f }).map(e => e.id);

describe('filterExercises', () => {
  it('finds what people type rather than the catalogue’s own words (scan S-21)', () => {
    const glides = ids({ query: 'sciatica' });
    expect(glides.length).toBeGreaterThan(0);
    expect(glides.every(id => id.startsWith('sciatic-nerve-glide'))).toBe(true);
    expect(ids({ query: 'back pain' })).toEqual(ids({ query: 'back' }));
    expect(ids({ query: 'back' }).length).toBeGreaterThan(0);
    expect(ids({ query: 'yoga' }).length).toBeGreaterThan(0);
    expect(ids({ query: 'pain' })).toEqual([]);
  });

  it('lists every active exercise with no filter', () => {
    expect(ids({})).toHaveLength(exercises.length);
  });

  it('finds by name regardless of case, hyphens and word order', () => {
    expect(ids({ query: 'cat cow' })).toContain('cat-cow');
    expect(ids({ query: 'CAT-COW' })).toContain('cat-cow');
    expect(ids({ query: 'stretch hip' })).toContain('half-kneeling-hip-flexor-stretch');
    expect(ids({ query: 'zzzz' })).toEqual([]);
  });

  it('finds by muscle and by equipment', () => {
    expect(ids({ query: 'hamstrings' }).length).toBeGreaterThan(2);
    for (const id of ids({ query: 'strap' })) {
      const ex = exercises.find(e => e.id === id)!;
      expect(`${ex.name} ${ex.equipment} ${ex.primaryMuscles} ${ex.secondaryMuscles}`.toLowerCase()).toContain('strap');
    }
  });

  it('narrows by type and by area', () => {
    for (const id of ids({ kind: 'mobility' })) expect(getMeta(id)?.kind).toBe('mobility');
    const glides = ids({ kind: 'mobility', area: 'nerve' });
    expect(glides.length).toBeGreaterThan(0);
    for (const id of glides) expect(getMeta(id)).toMatchObject({ kind: 'mobility', mode: 'slider' });
    for (const id of ids({ kind: 'strength', area: 'hinge' })) expect(getMeta(id)?.kind).toBe('strength');
    // Search and filters combine.
    expect(ids({ kind: 'cardio', query: 'cat cow' })).toEqual([]);
  });
});

describe('filters in the address', () => {
  it('round-trips', () => {
    const f = { query: 'hip', kind: 'mobility' as const, area: 'hips' };
    expect(readFilters(filterParams(f))).toEqual(f);
    expect(filterParams(NO_FILTERS).toString()).toBe('');
  });

  it('drops what it does not recognise, including an area of another type', () => {
    expect(readFilters(new URLSearchParams('type=yoga&area=hips'))).toEqual(NO_FILTERS);
    expect(readFilters(new URLSearchParams('type=strength&area=nerve'))).toEqual({ query: '', kind: 'strength', area: 'all' });
    expect(readFilters(new URLSearchParams('type=cardio&area=legs'))).toEqual({ query: '', kind: 'cardio', area: 'all' });
  });

  it('offers areas only for stretches and strength', () => {
    expect(Object.keys(AREAS).sort()).toEqual(['mobility', 'strength']);
  });
});

describe('sections', () => {
  it('puts stretches first and leaves out empty kinds', () => {
    expect(sections(filterExercises(NO_FILTERS)).map(s => s.kind)).toEqual(['mobility', 'strength', 'cardio']);
    expect(sections(filterExercises({ ...NO_FILTERS, kind: 'mobility' })).map(s => s.title)).toEqual(['Stretch & mobility']);
    expect(sections([])).toEqual([]);
  });
});

describe('exercise details', () => {
  it('describes a stretch’s dose in words', () => {
    expect(doseLine(getMeta('supine-figure-4'))).toBe('30 s hold · each side');
    expect(doseLine(getMeta('sciatic-nerve-glide-supine'))).toBe('12 slow reps · each side, sore side first');
    expect(doseLine(getMeta('box-breathing'))).toBe('6 breaths');
    expect(doseLine(getMeta('deadlift'))).toBe('Strength');
  });

  it('flags what the back research says to modify or skip on a flare-up', () => {
    expect(backNote('supine-hamstring-stretch-strap')).toBe('Skip on flare-up days');
    expect(backNote('supine-figure-4')).toBeNull();
  });

  it('links easier and harder versions, and the flare-up swap, only when they exist', () => {
    expect(relatedExercises('supine-hamstring-stretch-strap')).toEqual([{ label: 'On flare-up days', id: 'sciatic-nerve-glide-supine' }]);
    const deadlift = relatedExercises('deadlift');
    expect(deadlift.map(r => r.label)).toContain('Easier');
    for (const r of deadlift) expect(getMeta(r.id)).toBeDefined();
    expect(relatedExercises('nope')).toEqual([]);
  });
});

describe('libraryReturn (F33)', () => {
  it('goes back to the list the exercise was opened from, search and filters included', () => {
    expect(libraryReturn({ from: '/move/exercises?q=hip&type=mobility' })).toBe('/move/exercises?q=hip&type=mobility');
    expect(libraryReturn({ from: '/move/exercises' })).toBe('/move/exercises');
  });

  it('falls back to the whole library for a direct link or anything that is not the list', () => {
    for (const state of [undefined, null, {}, 'x', { from: 42 }, { from: '/move/exercises/cat-cow' }, { from: '/today' },
      { from: '//evil.example/move/exercises' }, { from: 'https://evil.example' }, { from: '/move/exercisesx' }]) {
      expect(libraryReturn(state), JSON.stringify(state)).toBe('/move/exercises');
    }
  });

  it('is what the list hands an exercise, and what an exercise hands a related one', () => {
    expect(libraryState('/move/exercises', '?q=glide')).toEqual({ from: '/move/exercises?q=glide' });
    expect(libraryReturn(libraryState('/move/exercises', '?q=glide'))).toBe('/move/exercises?q=glide');
  });
});
