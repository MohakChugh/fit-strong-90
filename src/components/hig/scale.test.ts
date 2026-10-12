import { describe, expect, it } from 'vitest';
import {
  MAX_SLOTS,
  RING_DEFAULT,
  RING_MAX,
  RING_MIN,
  bands,
  barExtent,
  clamp,
  gutterFor,
  isReading,
  labelWidth,
  lineRuns,
  linePath,
  niceDomain,
  niceStep,
  niceTicks,
  placeLabels,
  plotFrame,
  plotY,
  recent,
  ringGeometry,
  scaleLinear,
  segments,
  thinLabels,
} from './scale';

describe('clamp', () => {
  it('leaves a value inside the range alone', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('pulls a value outside the range to the nearer bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('turns a non-number into the lower bound rather than passing NaN into an SVG attribute', () => {
    expect(clamp(Number.NaN, 2, 8)).toBe(2);
    expect(clamp(Number.POSITIVE_INFINITY, 2, 8)).toBe(2);
  });
});

describe('isReading', () => {
  it('accepts a finite number and nothing else', () => {
    for (const ok of [5.4, 0, -3, Number.MAX_SAFE_INTEGER]) expect(isReading(ok), String(ok)).toBe(true);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, '5.4']) {
      expect(isReading(bad), String(bad)).toBe(false);
    }
  });

  it('refuses a magnitude no measurement could have, where axis arithmetic stops being exact', () => {
    expect(isReading(1e300)).toBe(false);
    expect(isReading(-Number.MAX_VALUE)).toBe(false);
  });
});

describe('scaleLinear', () => {
  it('maps each end of the domain to the matching end of the range', () => {
    const x = scaleLinear([0, 10], [0, 200]);
    expect(x(0)).toBe(0);
    expect(x(10)).toBe(200);
    expect(x(5)).toBe(100);
  });

  it('inverts for an SVG y axis, where zero is the top', () => {
    const y = scaleLinear([0, 10], [180, 0]);
    expect(y(0)).toBe(180);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(135);
  });

  it('puts a flat series down the middle instead of dividing by zero', () => {
    const y = scaleLinear([7, 7], [180, 0]);
    expect(y(7)).toBe(90);
    expect(Number.isNaN(y(7))).toBe(false);
  });

  it('puts everything down the middle when the domain itself is not finite', () => {
    expect(scaleLinear([0, Number.POSITIVE_INFINITY], [180, 0])(5)).toBe(90);
  });
});

describe('niceStep', () => {
  it('rounds up to a step a person reads at a glance', () => {
    expect(niceStep(0.4)).toBe(0.5);
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.2)).toBe(2);
    expect(niceStep(2.0625)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(2475)).toBe(2500);
  });

  it('never returns zero, so no caller can divide by it', () => {
    for (const raw of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(niceStep(raw)).toBeGreaterThan(0);
    }
  });
});

describe('niceDomain', () => {
  it('turns a glucose range of 4.2 to 11.7 into round ticks that still contain every reading', () => {
    const domain = niceDomain([4.2, 7.9, 11.7, 6.1, 5.4]);
    expect(domain.min).toBeLessThanOrEqual(4.2);
    expect(domain.max).toBeGreaterThanOrEqual(11.7);
    const ticks = niceTicks(domain);
    // Round means two things: every tick is a whole number of steps from the
    // bottom, and no tick prints a tail of decimals.
    for (const tick of ticks) {
      expect(Math.abs(Math.round((tick - domain.min) / domain.step) - (tick - domain.min) / domain.step)).toBeLessThan(1e-9);
      expect(String(tick)).toMatch(/^-?\d+(\.\d)?$/);
    }
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it('starts a bar axis at zero, because a bar that does not is lying about its length', () => {
    const domain = niceDomain([3200, 8900, 6100], { zeroBased: true });
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThanOrEqual(8900);
  });

  it('keeps an all-zero bar series on a zero baseline, never a negative one', () => {
    const domain = niceDomain([0, 0, 0], { zeroBased: true });
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThan(0);
    for (const tick of niceTicks(domain)) expect(tick).toBeGreaterThanOrEqual(0);
  });

  it('does not pad a series that never goes below zero into negative numbers', () => {
    expect(niceDomain([0, 5, 3]).min).toBe(0);
    expect(niceDomain([0, 0]).min).toBe(0);
  });

  it('still gives signed data both sides of zero', () => {
    const domain = niceDomain([-3, 5], { zeroBased: true });
    expect(domain.min).toBeLessThanOrEqual(-3);
    expect(domain.max).toBeGreaterThanOrEqual(5);
  });

  it('hangs an all-negative bar series from a zero ceiling', () => {
    const domain = niceDomain([-3, -5], { zeroBased: true });
    expect(domain.max).toBe(0);
    expect(domain.min).toBeLessThanOrEqual(-5);
  });

  it('keeps a normal-range band and a target on the axis even when no reading reaches them', () => {
    const domain = niceDomain([9.5, 10.2, 11.1], { include: [4, 7] });
    expect(domain.min).toBeLessThanOrEqual(4);
    expect(domain.max).toBeGreaterThanOrEqual(11.1);
  });

  it('gives a single reading an axis rather than a zero-height plot', () => {
    const domain = niceDomain([72]);
    expect(domain.min).toBeLessThan(72);
    expect(domain.max).toBeGreaterThan(72);
  });

  it('survives a series with no readings at all', () => {
    expect(niceDomain([])).toEqual({ min: 0, max: 1, step: 1 });
    expect(niceDomain([null, undefined, Number.NaN])).toEqual({ min: 0, max: 1, step: 1 });
  });

  it('finds the bounds of a very long series without overflowing the call stack', () => {
    const long = Array.from({ length: 500_000 }, (_, i) => i % 500);
    const domain = niceDomain(long);
    expect(domain.min).toBeLessThanOrEqual(0);
    expect(domain.max).toBeGreaterThanOrEqual(499);
  });

  it('never returns an infinite axis, even for the largest numbers a double can hold', () => {
    for (const values of [[Number.MAX_VALUE], [-Number.MAX_VALUE, Number.MAX_VALUE], [Number.MAX_SAFE_INTEGER]]) {
      const { min, max } = niceDomain(values);
      expect(Number.isFinite(min) && Number.isFinite(max), String(values)).toBe(true);
      expect(min).toBeLessThan(max);
    }
    const { min, max } = niceDomain([Number.MAX_SAFE_INTEGER]);
    expect(min).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(max).toBeGreaterThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('ignores a value too large to be a reading instead of stretching the axis to it', () => {
    const domain = niceDomain([5, 1e300, 7]);
    expect(domain.min).toBeLessThanOrEqual(5);
    expect(domain.max).toBeGreaterThanOrEqual(7);
    expect(domain.max).toBeLessThan(100);
  });

  it('survives nonsense options without an infinite or runaway axis', () => {
    for (const options of [
      { pad: Number.NaN }, { pad: Number.POSITIVE_INFINITY }, { pad: 1e300 }, { pad: -1 },
      { ticks: Number.NaN }, { ticks: 0 }, { ticks: -3 }, { ticks: Number.POSITIVE_INFINITY },
    ]) {
      const domain = niceDomain([4.2, 11.7], options);
      expect(Number.isFinite(domain.min) && Number.isFinite(domain.max), JSON.stringify(options)).toBe(true);
      expect(domain.min).toBeLessThanOrEqual(4.2);
      expect(domain.max).toBeGreaterThanOrEqual(11.7);
      expect(niceTicks(domain).length).toBeLessThanOrEqual(11);
    }
  });

  it('keeps ticks round when asked for an absurd number of them', () => {
    const ticks = niceTicks(niceDomain([4.2, 11.7], { ticks: 1e6 }));
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    for (const tick of ticks) expect(String(tick)).toMatch(/^-?\d+(\.\d)?$/);
  });
});

describe('niceTicks', () => {
  it('does not leak floating-point dust onto the axis', () => {
    const ticks = niceTicks({ min: 0, max: 1, step: 0.1 });
    expect(ticks).toContain(0.3);
    expect(ticks.some(t => String(t).length > 3)).toBe(false);
  });

  it('falls back to the two ends rather than spinning on an absurd step', () => {
    expect(niceTicks({ min: 0, max: 1, step: 1e-6 })).toEqual([0, 1]);
  });

  it('returns nothing for a domain that cannot be drawn', () => {
    expect(niceTicks({ min: 10, max: 0, step: 1 })).toEqual([]);
    expect(niceTicks({ min: 0, max: 10, step: 0 })).toEqual([]);
  });
});

describe('thinLabels', () => {
  it('thins a 90-day axis at 320 px instead of overlapping ninety labels', () => {
    const kept = thinLabels(90, 320);
    expect(kept.length).toBeLessThan(90);
    // The invariant that actually matters: the pixel gap between two labelled
    // ticks is at least one label wide.
    const stepPx = 320 / 89;
    for (let i = 1; i < kept.length; i++) {
      expect((kept[i] - kept[i - 1]) * stepPx).toBeGreaterThanOrEqual(44);
    }
  });

  it('always labels the newest point, which is the one being looked for', () => {
    for (const count of [2, 7, 30, 90, 365]) {
      expect(thinLabels(count, 320)).toContain(count - 1);
    }
  });

  it('labels every point when they all fit', () => {
    expect(thinLabels(7, 320)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('returns nothing for an empty, unmeasured or impossible axis', () => {
    expect(thinLabels(0, 320)).toEqual([]);
    expect(thinLabels(30, 0)).toEqual([]);
    expect(thinLabels(Number.POSITIVE_INFINITY, 320)).toEqual([]);
  });
});

describe('placeLabels', () => {
  const W = 288;
  const at = (centres: number[], width = 30) => centres.map((centre, index) => ({ index, centre, width }));
  /** Every placed box, left to right, as the chart will draw it. */
  const boxes = (placed: ReturnType<typeof placeLabels>, width = 30) => placed.map(p => [p.x - width / 2, p.x + width / 2]);

  it('centres a label under its point when there is room', () => {
    expect(placeLabels(at([100, 200]), W)).toEqual([{ index: 0, x: 100 }, { index: 1, x: 200 }]);
  });

  it('holds an end label inside the frame instead of letting it hang off the edge', () => {
    const [last] = placeLabels(at([W - 6]), W);
    expect(last.x + 15).toBeLessThanOrEqual(W);
    const [first] = placeLabels(at([4]), W);
    expect(first.x - 15).toBeGreaterThanOrEqual(0);
  });

  it('drops the label beside a held-in end label rather than let them touch, and keeps the newest', () => {
    // 40px apart is room for two centred 30px labels, but not once the last is held in.
    const placed = placeLabels(at([200, 240, W - 6]), W);
    expect(placed.at(-1)?.index).toBe(2);
    expect(placed.map(p => p.index)).toEqual([0, 2]);
  });

  it('never lets two placed labels overlap or come within the gap', () => {
    for (const spacing of [10, 29, 37, 38, 39, 45, 60]) {
      const centres = Array.from({ length: 12 }, (_, i) => W - 6 - (11 - i) * spacing).filter(c => c > -30);
      const placed = placeLabels(at(centres), W);
      const b = boxes(placed);
      for (let i = 1; i < b.length; i++) expect(b[i][0] - b[i - 1][1], `spacing ${spacing}`).toBeGreaterThanOrEqual(8);
      for (const [l, r] of b) {
        expect(l).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(W);
      }
      expect(placed.at(-1)?.index, `spacing ${spacing}`).toBe(centres.length - 1);
    }
  });

  it('places nothing when given nothing', () => {
    expect(placeLabels([], W)).toEqual([]);
  });
});

describe('segments — a gap is a gap', () => {
  it('breaks the series in two where a day has no reading', () => {
    const runs = segments([{ x: 0, y: 5.1 }, { x: 1, y: null }, { x: 2, y: 6.4 }]);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual([{ x: 0, y: 5.1 }]);
    expect(runs[1]).toEqual([{ x: 2, y: 6.4 }]);
  });

  it('treats undefined and a non-finite number as missing, not as zero', () => {
    const runs = segments([{ x: 0, y: 1 }, { x: 1, y: undefined }, { x: 2, y: 2 }, { x: 3, y: Number.NaN }, { x: 4, y: 3 }]);
    expect(runs).toHaveLength(3);
    expect(runs.flat().map(p => p.y)).toEqual([1, 2, 3]);
  });

  it('keeps a lone reading, because it is a reading', () => {
    expect(segments([{ x: 0, y: null }, { x: 1, y: 9.9 }, { x: 2, y: null }])).toEqual([[{ x: 1, y: 9.9 }]]);
  });

  it('returns one run for a complete series and none for an empty one', () => {
    expect(segments([{ x: 0, y: 1 }, { x: 1, y: 2 }])).toHaveLength(1);
    expect(segments([])).toHaveLength(0);
    expect(segments([{ x: 0, y: null }])).toHaveLength(0);
  });
});

describe('linePath — a gap is a gap', () => {
  it('draws two subpaths across a missing middle point, never one line through it', () => {
    const d = linePath(segments([
      { x: 0, y: 5.0 }, { x: 10, y: 5.4 },
      { x: 20, y: null },
      { x: 30, y: 6.1 }, { x: 40, y: 6.3 },
    ]));
    expect(d.match(/M/g)).toHaveLength(2);
    // The pen is never put down at the missing x, so nothing is interpolated.
    expect(d).not.toContain('20 ');
  });

  it('draws one subpath when nothing is missing', () => {
    const d = linePath(segments([{ x: 0, y: 1 }, { x: 10, y: 2 }, { x: 20, y: 3 }]));
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('strokes nothing for a lone reading, which the chart dots instead', () => {
    expect(linePath(segments([{ x: 5, y: 7 }]))).toBe('');
    expect(linePath([])).toBe('');
  });

  it('rounds coordinates to under half a device pixel', () => {
    expect(linePath([[{ x: 1.23456, y: 9.87654 }, { x: 2, y: 3 }]])).toBe('M1.23 9.88L2 3');
  });
});

describe('plotFrame', () => {
  const G = { top: 8, right: 6, bottom: 20, left: 36 };

  it('gives the drawable area inside the axis gutters', () => {
    expect(plotFrame(288, 180, G)).toEqual({ left: 36, top: 8, width: 246, height: 152 });
  });

  it('has no plot for a frame that is not a number, so nothing invalid reaches the SVG', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(plotFrame(bad, 180, G), `width ${bad}`).toBeNull();
      expect(plotFrame(288, bad, G), `height ${bad}`).toBeNull();
      expect(plotFrame(288, 180, { ...G, left: bad }), `gutter ${bad}`).toBeNull();
    }
  });

  it('has no plot for a frame too small to be useful', () => {
    expect(plotFrame(89, 180, G)).toBeNull();
    expect(plotFrame(288, 60, G)).toBeNull();
    expect(plotFrame(-288, 180, G)).toBeNull();
  });

  it('has no plot for a frame far past any screen, whose coordinates could overflow', () => {
    expect(plotFrame(288, 1e308, G)).toBeNull();
    expect(plotFrame(1e308, 180, G)).toBeNull();
  });
});

describe('gutterFor', () => {
  /** What tabular digits measure in SF Pro, the widest system face: 0.624 em. */
  const DIGIT = 0.624;

  it('leaves room for the widest tick label, so 10000 never reads as 0000', () => {
    for (const fontPx of [13, 17, 26]) {
      const { left } = gutterFor([0, 5000, 10000, 15000], fontPx);
      // The label ends 6px short of the plot and must not start before the frame.
      expect(left - 6, `${fontPx}px`).toBeGreaterThanOrEqual(5 * DIGIT * fontPx);
    }
  });

  it('keeps short labels in a narrow gutter, so the plot keeps its width', () => {
    expect(gutterFor([0, 5, 10], 13).left).toBeLessThan(gutterFor([0, 5000, 10000], 13).left);
  });

  it('grows the room above and below with the text size, for the top tick and the dates', () => {
    const small = gutterFor([0, 10], 13);
    const large = gutterFor([0, 10], 26);
    expect(large.top).toBeGreaterThan(small.top);
    expect(large.bottom).toBeGreaterThan(small.bottom);
    // Half a line above the top tick, a full line below the plot.
    expect(large.top).toBeGreaterThanOrEqual(26 / 2);
    expect(large.bottom).toBeGreaterThanOrEqual(26);
  });

  it('matches the old fixed gutter above and below at the footnote size', () => {
    const { top, right, bottom } = gutterFor([0, 10], 13);
    expect({ top, right, bottom }).toEqual({ top: 8, right: 6, bottom: 20 });
  });

  it('falls back to the footnote size when the text size cannot be read', () => {
    for (const bad of [Number.NaN, 0, -4, Number.POSITIVE_INFINITY]) {
      expect(gutterFor([0, 10], bad), String(bad)).toEqual(gutterFor([0, 10], 13));
    }
  });
});

describe('labelWidth', () => {
  it('never under-estimates a date label or a row of tabular digits', () => {
    // Measured in Chromium with the app's system font at 13px.
    expect(labelWidth('28 Oct'.length, 13)).toBeGreaterThanOrEqual(41.7);
    expect(labelWidth('Wed'.length, 13)).toBeGreaterThanOrEqual(27.1);
    expect(labelWidth('10000'.length, 13)).toBeGreaterThanOrEqual(40.6);
  });

  it('scales with the text size', () => {
    expect(labelWidth(6, 26)).toBeGreaterThanOrEqual(2 * labelWidth(6, 13) - 1);
  });
});

describe('plotY', () => {
  const plot = { left: 36, top: 8, width: 246, height: 152 };

  it('maps a reading into the plot, upside down for SVG', () => {
    const y = plotY({ min: 0, max: 10, step: 2.5 }, plot);
    expect(y(0)).toBe(160);
    expect(y(10)).toBe(8);
  });

  it('never turns something that is not a reading into a position on the plot', () => {
    const y = plotY({ min: 0, max: 10, step: 2.5 }, plot);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e300]) {
      expect(Number.isNaN(y(bad)), String(bad)).toBe(true);
    }
  });
});

describe('lineRuns — validity is decided before scaling', () => {
  const plot = { left: 36, top: 8, width: 246, height: 152 };
  const domain = niceDomain([100, 110]);

  it('breaks the line at an invalid value exactly as it does at a missing one', () => {
    const missing = lineRuns([100, null, 110], domain, plot);
    expect(missing).toHaveLength(2);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e300]) {
      expect(lineRuns([100, bad, 110], domain, plot), String(bad)).toEqual(missing);
    }
  });

  it('never strokes through an invalid middle value', () => {
    expect(linePath(lineRuns([100, Number.NaN, 110], domain, plot))).toBe('');
    expect(linePath(lineRuns([100, 105, Number.NaN, 110, 108], domain, plot)).match(/M/g)).toHaveLength(2);
  });

  it('joins consecutive readings into one run, from the left edge of the plot to the right', () => {
    const [run] = lineRuns([100, 105, 110], domain, plot);
    expect(run).toHaveLength(3);
    expect(run[0].x).toBe(plot.left);
    expect(run[2].x).toBe(plot.left + plot.width);
  });
});

describe('bands', () => {
  it('gives every day a slot, including the days with nothing in them', () => {
    expect(bands(7, 280)).toHaveLength(7);
  });

  it('keeps every bar inside the plot and in its own slot, up to a year of days on a 320 px screen', () => {
    for (const [count, width] of [[7, 280], [30, 280], [90, 252], [365, 246], [MAX_SLOTS, 246]] as const) {
      const all = bands(count, width);
      all.forEach((bar, i) => {
        expect(bar.x, `${count} at ${width}`).toBeGreaterThanOrEqual(0);
        expect(bar.x + bar.width).toBeLessThanOrEqual(width + 1e-9);
        if (i > 0) expect(all[i - 1].x + all[i - 1].width).toBeLessThanOrEqual(bar.x + 1e-9);
      });
    }
  });

  it('lets a bar go below a pixel rather than spill into its neighbour, and then fills its slot', () => {
    const slot = 246 / 365;
    for (const bar of bands(365, 246)) expect(bar.width).toBeCloseTo(slot, 9);
  });

  it('keeps a bar at least a pixel wide while its slot can afford one', () => {
    for (const bar of bands(200, 240)) expect(bar.width).toBe(1);
  });

  it('centres each bar in its slot, so it lines up with its own axis label', () => {
    const slot = 280 / 7;
    bands(7, 280).forEach((bar, i) => {
      expect(bar.x + bar.width / 2).toBeCloseTo(i * slot + slot / 2, 9);
    });
  });

  it('returns nothing for an empty, unmeasured or impossible series', () => {
    expect(bands(0, 280)).toEqual([]);
    expect(bands(7, 0)).toEqual([]);
    expect(bands(Number.POSITIVE_INFINITY, 280)).toEqual([]);
    expect(bands(7, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe('barExtent', () => {
  const top = 8;
  const bottom = 160;

  it('runs from the zero line up to a positive value', () => {
    expect(barExtent(50, bottom, top, bottom)).toEqual({ y: 50, height: 110 });
  });

  it('hangs a negative value down from the zero line', () => {
    expect(barExtent(100, 50, top, bottom)).toEqual({ y: 50, height: 50 });
  });

  it('gives a recorded zero a one-pixel hairline, so "none" is not "not entered"', () => {
    expect(barExtent(bottom, bottom, top, bottom)).toEqual({ y: bottom - 1, height: 1 });
  });

  it('grows that hairline into the plot when the zero line is its top edge, so a clip cannot hide it', () => {
    expect(barExtent(top, top, top, bottom)).toEqual({ y: top, height: 1 });
  });

  it('never reaches outside the plot', () => {
    // The last two are hairlines that would grow out through the edge they sit on.
    for (const [value, base] of [[-50, bottom], [300, top], [-1e6, 1e6], [bottom + 0.5, bottom], [top - 0.5, top]]) {
      const { y, height } = barExtent(value, base, top, bottom);
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y + height).toBeLessThanOrEqual(bottom);
    }
  });
});

describe('recent', () => {
  it(`charts at most ${MAX_SLOTS} slots, cut from the old end so every gap and extreme shown is real`, () => {
    const all = Array.from({ length: MAX_SLOTS + 200 }, (_, i) => i);
    const { shown, omitted } = recent(all);
    expect(shown).toHaveLength(MAX_SLOTS);
    expect(shown[0]).toBe(200);
    expect(shown.at(-1)).toBe(all.at(-1));
    expect(omitted).toBe(200);
  });

  it('passes a series that fits through untouched', () => {
    const all = Array.from({ length: 90 }, (_, i) => i);
    expect(recent(all)).toEqual({ shown: all, omitted: 0 });
  });
});

describe('ringGeometry', () => {
  it('always fits its widest stroke inside its frame, with a hole left in the middle', () => {
    for (const size of [RING_MIN, 44, RING_DEFAULT, 120, RING_MAX]) {
      const g = ringGeometry(size);
      expect(g.radius + g.outline / 2, `size ${size}`).toBeLessThanOrEqual(g.size / 2 + 1e-9);
      expect(g.radius - g.outline / 2).toBeGreaterThan(0);
      expect(g.outline).toBeGreaterThanOrEqual(g.track);
      expect(g.lap).toBeGreaterThan(0);
    }
  });

  it('turns a size that cannot be drawn into one that can', () => {
    expect(ringGeometry(Number.NaN).size).toBe(RING_DEFAULT);
    expect(ringGeometry(Number.POSITIVE_INFINITY).size).toBe(RING_DEFAULT);
    expect(ringGeometry(0).size).toBe(RING_MIN);
    expect(ringGeometry(-10).size).toBe(RING_MIN);
    expect(ringGeometry(1).size).toBe(RING_MIN);
    expect(ringGeometry(1e308).size).toBe(RING_MAX);
  });

  it('never produces a figure that is not a number', () => {
    for (const size of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1, 1e308]) {
      for (const [key, value] of Object.entries(ringGeometry(size))) {
        expect(Number.isFinite(value), `${key} at size ${size}`).toBe(true);
      }
    }
  });
});
