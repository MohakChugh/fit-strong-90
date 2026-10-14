import { describe, expect, it } from 'vitest';
import { newObservation, type Observation } from '@/health/observation';
import { stepsDayFigure, stepsFromText } from './stepsDay';

const DAY = '2026-10-08';
const entered = (value: number, at: string) => newObservation({ id: `e${at}`, kind: 'steps', value, unit: 'steps', scope: 'dayTotal', source: 'manual', at });
const walk = (id: string, start: string, steps: number, minutes = 20) => [
  newObservation({ id: `${id}d`, kind: 'walkDuration', value: minutes, unit: 'min', scope: 'sessionObserved', source: 'measured', at: start, context: `walk:${id}`, coverageMs: minutes * 60_000 }),
  newObservation({ id: `${id}s`, kind: 'steps', value: steps, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: start, context: `walk:${id}`, coverageMs: minutes * 60_000 }),
];

describe('stepsDayFigure (journey §9.6; D10, D14, D52)', () => {
  it('an entered total, with when it was entered', () => {
    expect(stepsDayFigure(DAY, [entered(6050, `${DAY}T18:00:00.000+05:30`)], true)).toEqual({ kind: 'entered', value: '6,050', steps: 6050, source: 'entered at 6:00 pm' });
  });

  it('walks only: what they counted, never called the day’s total', () => {
    expect(stepsDayFigure(DAY, walk('w1', `${DAY}T07:40:00.000+05:30`, 4210), true))
      .toEqual({ kind: 'walks', value: '4,210', steps: 4210, source: 'in FitStrong walks · day total not entered' });
  });

  it('a FitStrong walk after an entered total: at least both, with both sources', () => {
    const obs = [entered(6050, `${DAY}T12:00:05.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250)];
    expect(stepsDayFigure(DAY, obs, true))
      .toEqual({ kind: 'atLeast', value: 'at least 7,300', steps: 7300, source: '6,050 entered at 12:00 pm + 1,250 in walks after 12:00 pm' });
  });

  it('a walk before the entered total is already in it', () => {
    expect(stepsDayFigure(DAY, [...walk('w1', `${DAY}T07:40:00.000+05:30`, 1250), entered(6050, `${DAY}T18:00:00.000+05:30`)], true).kind).toBe('entered');
  });

  it('a walk the next morning is that day’s, never added to this one (This week)', () => {
    const obs = [entered(6050, `${DAY}T18:00:00.000+05:30`), ...walk('w1', '2026-10-09T07:40:00.000+05:30', 1250)];
    expect(stepsDayFigure(DAY, obs, true)).toEqual({ kind: 'entered', value: '6,050', steps: 6050, source: 'entered at 6:00 pm' });
  });

  it('a past day’s total, stamped at noon, never adds the walks after noon (Review Focus 3)', () => {
    const obs = [entered(9000, `${DAY}T12:00:00.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1200)];
    expect(stepsDayFigure(DAY, obs, true)).toEqual({ kind: 'entered', value: '9,000', steps: 9000, source: 'entered' });
  });

  it('a newer entered total replaces the earlier one', () => {
    const obs = [entered(6050, `${DAY}T12:00:05.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250), entered(8200, `${DAY}T21:00:00.000+05:30`)];
    expect(stepsDayFigure(DAY, obs, true)).toMatchObject({ kind: 'entered', value: '8,200' });
  });

  it('a total corrected later counts walks only from the correction, so nothing is counted twice', () => {
    const fixed: Observation = { ...entered(6050, `${DAY}T12:00:05.000+05:30`), value: 8200, editedAt: `${DAY}T21:00:00.000+05:30` };
    const obs = [fixed, ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250), ...walk('w2', `${DAY}T21:30:00.000+05:30`, 400)];
    expect(stepsDayFigure(DAY, obs, true))
      .toEqual({ kind: 'atLeast', value: 'at least 8,600', steps: 8600, source: '8,200 changed at 9:00 pm + 400 in walks after 9:00 pm' });
  });

  describe('a walk across midnight: each of its parts counts on its own day, once (codex H2-03, F17)', () => {
    const NEXT = '2026-10-09';
    /** A walk's part: its own duration and steps, as the live screen splits a walk at midnight. */
    const part = (id: string, start: string, steps: number, minutes: number) => [
      newObservation({ id: `${id}d`, kind: 'walkDuration', value: minutes, unit: 'min', scope: 'sessionObserved', source: 'measured', at: start, context: 'walk:w9', coverageMs: minutes * 60_000 }),
      newObservation({ id: `${id}s`, kind: 'steps', value: steps, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: start, context: 'walk:w9', coverageMs: minutes * 60_000 }),
    ];
    const late = [
      entered(1000, `${DAY}T21:00:00.000+05:30`),
      ...part('w9a', `${DAY}T23:40:00.000+05:30`, 500, 20),
      ...part('w9b', `${NEXT}T00:00:00.000+05:30`, 500, 20),
    ];

    it('1,000 entered, then 500 before midnight and 500 after: at least 1,500 that day, not 2,000', () => {
      expect(stepsDayFigure(DAY, late, true))
        .toEqual({ kind: 'atLeast', value: 'at least 1,500', steps: 1500, source: '1,000 entered at 9:00 pm + 500 in walks after 9:00 pm' });
    });

    it('the next day counts its own 500, and only those', () => {
      expect(stepsDayFigure(NEXT, late, true)).toEqual({ kind: 'walks', value: '500', steps: 500, source: 'in FitStrong walks · day total not entered' });
      // With its own total entered before the walk's part that day, the part is already in it.
      expect(stepsDayFigure(NEXT, [...late, entered(800, `${NEXT}T00:30:00.000+05:30`)], true)).toMatchObject({ kind: 'entered', steps: 800 });
    });

    it('the cutoff applies to each part: a part after the total counts even when the walk began before it', () => {
      const paused = [
        ...part('w9a', `${DAY}T17:00:00.000+05:30`, 300, 10),
        entered(2000, `${DAY}T17:30:00.000+05:30`),
        ...part('w9b', `${DAY}T18:00:00.000+05:30`, 700, 15),
      ];
      expect(stepsDayFigure(DAY, paused, true)).toMatchObject({ kind: 'atLeast', steps: 2700 });
    });

    it('only walking adds to it: steps from another session record are not "in walks"', () => {
      const other = newObservation({ id: 'imp', kind: 'steps', value: 900, unit: 'steps', scope: 'sessionObserved', source: 'imported', at: `${DAY}T22:00:00.000+05:30`, context: 'import:health', coverageMs: 10 * 60_000 });
      expect(stepsDayFigure(DAY, [...late, other], true)).toMatchObject({ kind: 'atLeast', steps: 1500 });
    });

    it('overlapping records of the same time count once, by the shared rule (D10)', () => {
      const twice = [...late, newObservation({ id: 'dup', kind: 'steps', value: 500, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: `${DAY}T23:45:00.000+05:30`, context: 'walk:w8', coverageMs: 5 * 60_000 })];
      expect(stepsDayFigure(DAY, twice, true)).toMatchObject({ kind: 'atLeast', steps: 1500 });
    });
  });

  it('nothing at all: "Not entered"', () => {
    expect(stepsDayFigure(DAY, [], true)).toEqual({ kind: 'none', source: 'Not entered' });
  });
});

describe('stepsFromText (journey §9.6, Paste; Review Focus 4)', () => {
  it('the one number in the text, grouped either way', () => {
    const cases: [string, number][] = [
      ['6050', 6050], ['6,050', 6050], ['6,050 steps', 6050], ['Steps: 6 050', 6050], ['1,00,000', 100000], ['\n 4210 \n', 4210],
      // iOS and other locales group thousands with a no-break or a narrow no-break space.
      ['6\u00a0050', 6050], ['6\u202f050 steps', 6050],
    ];
    for (const [text, n] of cases) expect(stepsFromText(text), JSON.stringify(text)).toBe(n);
  });

  it('nothing rather than a guess', () => {
    for (const text of ['', 'abc', '6.5k', '6.050', '6,050 steps, 4.2 km', '12,34', '6,050, 4,000', '6050 4000', '06:30', '8 Oct 2026, 6,050 steps']) {
      expect(stepsFromText(text), JSON.stringify(text)).toBeUndefined();
    }
  });
});
