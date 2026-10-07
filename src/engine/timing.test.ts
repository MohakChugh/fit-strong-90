import { describe, it, expect } from 'vitest';
import type { HoldStep, SetStep, DrillStep } from '@/types/plan';
import { segmentsFor, stepSeconds, concentricFirst } from './timing';

const set = (over: Partial<SetStep> = {}): SetStep => ({
  kind: 'set', id: 's', block: 'strength', title: 'Goblet Squat', exerciseId: 'goblet-squat', set: 1, of: 3, ramp: false,
  reps: 10, tempo: { lower: 3, pauseBottom: 0, lift: 1, pauseTop: 0 }, sides: null, load: { kg: 20, note: 'same' }, rir: 3, prepSeconds: 5, ...over,
});

describe('segmentsFor', () => {
  it('paces a 10-rep set at 4 s per rep plus 5 s of prep', () => {
    expect(stepSeconds(set())).toBe(45);
  });

  it('orders a squat eccentric-first and a row concentric-first', () => {
    const squat = segmentsFor(set()).filter(s => s.kind === 'rep');
    expect(squat[0].repPhase).toBe('lower');
    const row = segmentsFor(set({ exerciseId: 'chest-supported-row' })).filter(s => s.kind === 'rep');
    expect(row[0].repPhase).toBe('lift');
    expect(concentricFirst('trap-bar-deadlift')).toBe(true);
    expect(concentricFirst('romanian-deadlift')).toBe(false);
  });

  it('pairs breathing with the rep phase: inhale lowering, exhale lifting', () => {
    const reps = segmentsFor(set()).filter(s => s.kind === 'rep');
    expect(reps.find(s => s.repPhase === 'lower')?.breath).toBe('in');
    expect(reps.find(s => s.repPhase === 'lift')?.breath).toBe('out');
  });

  it('runs unilateral sets side by side with a switch', () => {
    const segs = segmentsFor(set({ exerciseId: 'split-squat', reps: 8, sides: ['left', 'right'] }));
    expect(segs.filter(s => s.kind === 'switch')).toHaveLength(1);
    expect(segs.find(s => s.kind === 'rep')?.side).toBe('left');
    expect(stepSeconds(set({ exerciseId: 'split-squat', reps: 8, sides: ['left', 'right'] }))).toBe(5 + 8 * 4 * 2 + 8);
  });

  it('uses a hold for isometric sets and a walk for carries', () => {
    expect(segmentsFor(set({ exerciseId: 'side-plank', holdSeconds: 20, sides: ['left', 'right'] })).filter(s => s.kind === 'hold')).toHaveLength(2);
    expect(stepSeconds(set({ exerciseId: 'suitcase-carry', carrySeconds: 30, sides: ['left', 'right'] }))).toBe(5 + 30 + 8 + 30);
  });

  it('times a two-sided stretch: 2 holds × 30 s each side', () => {
    const hold: HoldStep = { kind: 'hold', id: 'h', block: 'mobility', title: 'Figure-4', exerciseId: 'supine-figure-4', holdSeconds: 30, sets: 2, sides: ['left', 'right'], prepSeconds: 10, switchSeconds: 5, deep: false };
    const segs = segmentsFor(hold);
    expect(segs.filter(s => s.kind === 'hold')).toHaveLength(4);
    expect(segs.filter(s => s.kind === 'hold')[0]).toMatchObject({ side: 'left', set: 1, of: 2 });
    expect(stepSeconds(hold)).toBe(10 + 4 * 30 + 3 * 5);
  });

  it('expands breathing drills into inhale and exhale segments', () => {
    const drill: DrillStep = { kind: 'drill', id: 'd', block: 'mobility', title: 'Breathing', exerciseId: 'box-breathing', reps: 3, secondsPerRep: 10, sets: 1, sides: null, prepSeconds: 5, switchSeconds: 0, breathing: { inhale: 4, exhale: 6 } };
    const segs = segmentsFor(drill);
    expect(segs.filter(s => s.breath === 'in')).toHaveLength(3);
    expect(stepSeconds(drill)).toBe(5 + 30);
  });
});
