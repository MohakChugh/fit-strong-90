import { describe, expect, it } from 'vitest';
import { addDays } from '@/screens/track/periods';
import { domainOf, legendOf, selectable, slotAt, stepValue, type ChartModel, type Slot } from './chart';

const slots = (n: number, future = 0): Slot[] => Array.from({ length: n }, (_, i) => {
  const day = addDays('2026-10-05', i);
  return { key: day, label: day.slice(8), name: day, range: { from: day, to: day }, text: day, ...(i >= n - future ? { future: true as const } : {}) };
});
const model = (over: Partial<ChartModel> = {}): ChartModel => ({ slots: slots(7), series: [], lines: [], unit: 'steps', decimals: 0, ...over });

describe('choosing a slot (B-15: the whole plot, the keys and a list)', () => {
  it('a tap or a drag anywhere across the plot chooses the slot under it, held to the first and the last', () => {
    const plot = { left: 40, width: 280 };
    expect([40, 79, 80, 319].map(x => slotAt(x, plot, 7))).toEqual([0, 0, 1, 6]);
    expect(slotAt(10, plot, 7)).toBe(0);
    expect(slotAt(400, plot, 7)).toBe(6);
    expect(slotAt(100, plot, 0)).toBeUndefined();
    expect(slotAt(100, { left: 40, width: 0 }, 7)).toBeUndefined();
    expect(slotAt(Number.NaN, plot, 7)).toBeUndefined();
  });

  it('the arrow keys move one slot, Home and End jump, Escape puts the choice down', () => {
    expect(stepValue('ArrowRight', 0, 4)).toBe(1);
    expect(stepValue('ArrowRight', 4, 4)).toBe(4);
    expect(stepValue('ArrowLeft', 1, 4)).toBe(0);
    expect(stepValue('ArrowLeft', 0, 4)).toBe(0);
    expect(stepValue('Home', 3, 4)).toBe(1);
    expect(stepValue('End', 0, 4)).toBe(4);
    expect(stepValue('Escape', 3, 4)).toBe(0);
    expect(stepValue('ArrowUp', 1, 4)).toBe(2);
    expect(stepValue('ArrowDown', 2, 4)).toBe(1);
    expect(stepValue('Enter', 2, 4)).toBeUndefined();
    expect(stepValue('Home', 0, 0)).toBe(0);
  });

  it('only the slots up to today can be chosen', () => {
    expect(selectable(model({ slots: slots(7, 3) }))).toBe(4);
  });
});

describe('the value axis', () => {
  it('bars start at zero, and the axis holds the average', () => {
    const { domain, ticks } = domainOf(model({
      series: [
        { kind: 'bars', id: 'previous', label: 'Last week', colour: 'var(--trend-previous)', values: [5000, 6000, 5800, 6200, 4000, 8000, 3500], previous: true },
        { kind: 'bars', id: 'current', label: 'This week', colour: 'var(--cat-steps)', values: [6000, 7000, 5500, null, null, null, null] },
      ],
      average: { value: 18500 / 3, label: 'Average 6,167 steps a day' },
    }));
    expect(domain).toEqual({ min: 0, max: 10000, step: 2500 });
    expect(ticks).toEqual([0, 2500, 5000, 7500, 10000]);
  });

  it('readings sit around their spread, not on a zero line', () => {
    const { domain } = domainOf(model({
      series: [{ kind: 'points', id: 'beforeMeal', label: 'Fasting or before a meal', colour: 'var(--cat-glucose)', shape: 'circle', points: [
        { slot: 0, at: 0.3, value: 112 }, { slot: 1, at: 0.3, value: 126 }, { slot: 2, at: 0.3, value: 63, flag: 'low' },
      ] }],
      unit: 'mg/dL',
    }));
    expect(domain).toEqual({ min: 40, max: 140, step: 20 });
  });

  it('weekly or monthly ranges reach from their lowest to their highest, off the zero line', () => {
    const { domain } = domainOf(model({
      series: [{ kind: 'ranges', id: 'all', label: 'Glucose', colour: 'var(--cat-glucose)', shape: 'circle', values: [{ min: 120, max: 180, mean: 150 }, null] }],
    }));
    expect(domain).toEqual({ min: 100, max: 200, step: 20 });
  });

  it('the labelled average is always on the axis', () => {
    const { domain } = domainOf(model({
      series: [{ kind: 'points', id: 'value', label: 'Weight', colour: 'var(--cat-weight)', shape: 'circle', points: [{ slot: 0, at: 0.5, value: 112 }, { slot: 1, at: 0.5, value: 126 }] }],
      average: { value: 200, label: 'Average 200 kg' },
    }));
    expect(domain.max).toBeGreaterThanOrEqual(200);
  });

  it('a chart with nothing in it still has a finite axis', () => {
    const { domain, ticks } = domainOf(model());
    expect(domain).toEqual({ min: 0, max: 1, step: 1 });
    expect(ticks.every(Number.isFinite)).toBe(true);
  });
});

describe('the legend (journey §20.3: colour is never the only signal)', () => {
  it('names every series, then each kind of shaded day present, in a fixed order', () => {
    const marked = slots(7).map((s, i) => (i === 2 ? { ...s, mark: 'away' as const } : i === 6 ? { ...s, mark: 'rest' as const } : s));
    const items = legendOf(model({
      slots: marked,
      series: [
        { kind: 'bars', id: 'previous', label: 'Last week', colour: 'var(--trend-previous)', values: [], previous: true },
        { kind: 'bars', id: 'current', label: 'This week', colour: 'var(--cat-walk)', values: [] },
        { kind: 'points', id: 'afterMeal', label: 'After a meal', colour: 'var(--cat-glucose)', shape: 'triangle', points: [] },
        { kind: 'ranges', id: 'all', label: 'Weekly range', colour: 'var(--cat-glucose)', shape: 'square', values: [] },
      ],
    }));
    expect(items.map(i => [i.label, i.swatch])).toEqual([
      ['Last week', 'previous'], ['This week', 'bar'], ['After a meal', 'triangle'], ['Weekly range', 'range'], ['Rest day', 'mark'], ['Away', 'mark'],
    ]);
    // A range's mean is marked by its series' shape, in the plot and beside its name (H3-08).
    expect(items.find(i => i.swatch === 'range')?.shape).toBe('square');
  });
});
