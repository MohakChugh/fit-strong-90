import { describe, it, expect } from 'vitest';
import type { SupersetGroup } from '@/types';
import { SUPERSET_IDLE, supersetReducer } from './useSupersetTimer';
import { secondsLeft } from './useTimer';

const group: SupersetGroup = { id: 'g', exerciseIds: ['row', 'press'], restBetweenSeconds: 20, restAfterRoundSeconds: 40 };
const T0 = 1_000_000;
const started = supersetReducer(SUPERSET_IDLE, { type: 'start', group });

describe('superset rests', () => {
  it('rests between exercises, and for the after-round rest once the round is done', () => {
    const afterRow = supersetReducer(started, { type: 'completeSet', now: T0 });
    expect(afterRow.rest?.leftMs).toBe(20_000);

    const press = supersetReducer(afterRow, { type: 'tick', now: T0 + 20_000 });
    expect(press).toMatchObject({ currentExerciseIndex: 1, rest: null });

    // Finishing press wraps to row: this used to rest 20 s too.
    const afterRound = supersetReducer(press, { type: 'completeSet', now: T0 + 60_000 });
    expect(afterRound.rest?.leftMs).toBe(40_000);
    expect(supersetReducer(afterRound, { type: 'tick', now: T0 + 100_000 })).toMatchObject({ currentExerciseIndex: 0, rest: null });
  });

  it('counts the rest from the clock, so a suspended tab catches up', () => {
    const resting = supersetReducer(started, { type: 'completeSet', now: T0 });
    expect(secondsLeft(supersetReducer(resting, { type: 'tick', now: T0 + 15_000 }).rest!.leftMs)).toBe(5);
    // Woken after the rest ran out: straight on to the next exercise.
    expect(supersetReducer(resting, { type: 'tick', now: T0 + 90_000 })).toMatchObject({ currentExerciseIndex: 1, rest: null });
  });

  it('skips a rest to the next exercise', () => {
    const resting = supersetReducer(started, { type: 'completeSet', now: T0 });
    expect(supersetReducer(resting, { type: 'skipRest' })).toMatchObject({ currentExerciseIndex: 1, rest: null });
  });
});
