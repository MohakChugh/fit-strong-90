/**
 * The maths behind the charts and the ring: no React, no DOM, so every piece
 * can be tested on its own.
 *
 * Two parts carry more weight than the rest. `niceDomain` and `niceTicks` keep
 * the axis on numbers a person reads without effort — an axis labelled 0.3333
 * is harder to use than no axis at all. And the gap handling — `isReading`,
 * `plotY`, `segments` — is a correctness boundary rather than a style choice:
 * a line drawn across a day with no reading, or through a value that cannot be
 * a reading, shows a reading we never took, which in a health record is a
 * fabricated one.
 */

/** A reading at a position, or the absence of one. `null` is a real answer. */
export interface Reading {
  x: number;
  y: number | null | undefined;
}

/** A point that exists. */
export interface XY {
  x: number;
  y: number;
}

/** An axis: both ends land on a multiple of `step`. */
export interface LinearDomain {
  min: number;
  max: number;
  step: number;
}

/**
 * The largest magnitude a chart accepts as a reading. Past 2^53 a double can
 * no longer hold every whole number, so the axis arithmetic stops being exact;
 * no measurement this app records comes anywhere near it, so a larger figure is
 * corrupt, and is treated as not being a reading at all.
 */
export const MAX_MAGNITUDE = Number.MAX_SAFE_INTEGER;

/**
 * The most slots one chart draws. Daily slots past this are a smear at phone
 * width and a table of thousands of rows. A longer range is the caller's to
 * group — weekly, say — because only the caller knows whether a week is best
 * told by its total, its average or its worst day; the chart never aggregates
 * on its own, since an average hides exactly the extremes a health record most
 * needs to show.
 */
export const MAX_SLOTS = 1000;

/**
 * The largest chart frame, in CSS pixels, either way. Far past any screen; it
 * exists so that no frame size can overflow the arithmetic that writes SVG
 * coordinates.
 */
export const MAX_FRAME = 10_000;

/** Below this many pixels either way there is no plot worth drawing. */
export const MIN_PLOT = 48;

/** A number a chart can draw: finite, and no larger than `MAX_MAGNITUDE`. */
export function isReading(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_MAGNITUDE;
}

/**
 * Keep a value inside a range. Used to stop a figure outside the axis — an
 * over-goal arc, a band wider than the data — painting outside its plot.
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * A value's position along a pixel axis. Pass an inverted range — `[height, 0]`
 * — for a y axis, because SVG's y grows downwards.
 */
export function scaleLinear(domain: [number, number], range: [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  // A flat series — one reading, or every reading identical — has no span to
  // divide by, and an infinite one has no position in it. Either way, put it
  // down the middle of the plot rather than at NaN.
  if (span === 0 || !Number.isFinite(span)) return () => (r0 + r1) / 2;
  return value => r0 + ((value - d0) / span) * (r1 - r0);
}

/** The step sizes a person reads at a glance, one decade's worth. */
const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * The smallest comfortable step at or above `raw`. Rounding *up* rather than
 * to the nearest means the tick count never exceeds what was asked for, which
 * is what keeps a 320 px axis legible.
 */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const decade = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / decade;
  return (NICE_STEPS.find(candidate => candidate >= fraction - 1e-9) ?? 10) * decade;
}

/**
 * Floating-point dust: three 0.1 steps land on 0.30000000000000004, which no
 * axis should ever show. Round to the precision the step itself implies.
 */
function tidy(value: number, step: number): number {
  const decimals = Math.max(0, Math.min(20, 1 - Math.floor(Math.log10(step))));
  return Number(value.toFixed(decimals));
}

/** The axis for a chart with nothing to show. */
const EMPTY: LinearDomain = { min: 0, max: 1, step: 1 };

/**
 * An axis that contains every reading and lands on round numbers: pad the
 * readings a little so no point is welded to the frame, then push both bounds
 * out to the nearest multiple of a comfortable step.
 *
 * Padding never crosses zero. Nothing this app records can be negative, so a
 * series that stays at or above zero gets an axis that does too — an all-zero
 * week of steps sits on a zero baseline, not halfway up an axis of negative
 * steps. Signed data still gets both sides, because then the data is there.
 *
 * `include` is for the figures a chart draws but does not measure — a normal
 * range band, a clinician's target — which have to be on the axis to be seen.
 * `zeroBased` is for bar charts, where a bar not starting at zero lies about
 * its own length.
 */
export function niceDomain(
  values: readonly unknown[],
  { include = [], pad = 0.05, ticks = 4, zeroBased = false }: {
    include?: readonly unknown[];
    /** Fraction of the span to leave either side before rounding out, 0 to 1. */
    pad?: number;
    /** Roughly how many gaps between ticks to aim for, 1 to 10. */
    ticks?: number;
    zeroBased?: boolean;
  } = {},
): LinearDomain {
  // A loop rather than `Math.min(...values)`: spreading a long series into
  // arguments overflows the call stack at a few hundred thousand points.
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const list of [values, include]) {
    for (const v of list) {
      if (!isReading(v)) continue;
      if (v < low) low = v;
      if (v > high) high = v;
    }
  }
  if (low > high) return EMPTY;
  if (zeroBased) {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }

  // Which side of zero the data lives on decides which way the padding may go.
  // An all-zero series counts as non-negative, so it grows upwards.
  const floorAtZero = low >= 0;
  const ceilingAtZero = !floorAtZero && high <= 0;

  if (low === high) {
    // A single reading still needs an axis. Give it room either side.
    const room = low === 0 ? 1 : Math.abs(low) * 0.1;
    low -= room;
    high += room;
  }

  const room = (high - low) * clamp(pad, 0, 1);
  const lowPadded = floorAtZero ? Math.max(0, low - room) : low - room;
  const highPadded = ceilingAtZero ? Math.min(0, high + room) : high + room;
  const step = niceStep((highPadded - lowPadded) / clamp(Math.round(ticks), 1, 10));
  const min = tidy(Math.floor(lowPadded / step) * step, step);
  const max = tidy(Math.ceil(highPadded / step) * step, step);
  // Inputs are bounded by MAX_MAGNITUDE and padding by the span, so this holds;
  // it is checked anyway, because an infinite axis draws nothing at all.
  return Number.isFinite(min) && Number.isFinite(max) && min < max ? { min, max, step } : EMPTY;
}

/** Every tick on an axis, both ends included. */
export function niceTicks({ min, max, step }: LinearDomain): number[] {
  if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const count = Math.round((max - min) / step);
  // A domain and a step that disagree would otherwise spin for a long time.
  // The ends alone are still a truthful axis.
  if (count > 50) return [tidy(min, step), tidy(max, step)];
  return Array.from({ length: count + 1 }, (_, i) => tidy(min + i * step, step));
}

/**
 * Which tick indices get a label, so labels never collide. Walking back from
 * the newest point means the right-hand date — the one a person looks for
 * first — is always labelled, and the spacing is even everywhere.
 *
 * At 320 px a 90-day axis fits about seven labels, so it shows every
 * thirteenth day rather than ninety overlapping ones.
 */
export function thinLabels(count: number, width: number, labelWidth = 44): number[] {
  if (!Number.isInteger(count) || count <= 0 || !(width > 0) || !(labelWidth > 0)) return [];
  const fits = Math.max(1, Math.floor(width / labelWidth));
  if (count <= fits) return Array.from({ length: count }, (_, i) => i);
  const stride = Math.ceil(count / fits);
  const kept: number[] = [];
  for (let i = count - 1; i >= 0; i -= stride) kept.push(i);
  return kept.reverse();
}

/**
 * Where each date label goes: centred under its point, but held just inside
 * the frame, so an end label is not half off the chart. Holding a label in
 * pulls it towards its neighbour, so — walking back from the newest — a label
 * whose box would come within `gap` of the last one placed is left out. The
 * newest is always labelled, and no two labels ever touch.
 */
export function placeLabels(
  candidates: readonly { index: number; centre: number; width: number }[],
  frameWidth: number,
  gap = 8,
): { index: number; x: number }[] {
  const placed: { index: number; x: number; left: number }[] = [];
  for (let k = candidates.length - 1; k >= 0; k--) {
    const { index, centre, width } = candidates[k];
    const half = width / 2;
    const x = Math.max(half, Math.min(centre, frameWidth - half));
    const last = placed.at(-1);
    if (last && x + half + gap > last.left) continue;
    placed.push({ index, x, left: x - half });
  }
  return placed.reverse().map(({ index, x }) => ({ index, x }));
}

/**
 * Split a series into the runs that actually have readings. A missing point
 * ends one run and the next reading starts another, so the chart draws two
 * strokes instead of one line pretending to pass through data we never had.
 *
 * A run of one point is kept: it is a real reading, and it is the chart's job
 * to mark it with a dot rather than drop it.
 */
export function segments(points: readonly Reading[]): XY[][] {
  const runs: XY[][] = [];
  let run: XY[] = [];
  for (const { x, y } of points) {
    if (y === null || y === undefined || !Number.isFinite(y) || !Number.isFinite(x)) {
      if (run.length > 0) runs.push(run);
      run = [];
      continue;
    }
    run.push({ x, y });
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** Two decimals is under half a device pixel and keeps the `d` string short. */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * One `d` attribute for a whole series, already in pixel space. Each run gets
 * its own `M`, which is what makes a gap a gap — SVG lifts the pen between
 * subpaths, so nothing is drawn across the missing stretch.
 *
 * Runs of a single point are skipped, because a one-point subpath strokes
 * nothing; `segments` is exported so the chart can dot them instead.
 */
export function linePath(runs: readonly XY[][]): string {
  return runs
    .filter(run => run.length > 1)
    .map(run => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(''))
    .join('');
}

/**
 * Evenly spaced slots across a width, as a bar chart needs: one slot per day,
 * whether or not that day has a figure. `gapRatio` is the share of each slot
 * left as air between bars.
 */
export function bands(count: number, width: number, gapRatio = 0.3): { x: number; width: number }[] {
  if (!Number.isInteger(count) || count <= 0 || !(width > 0) || !Number.isFinite(width)) return [];
  const slot = width / count;
  // A bar keeps some air either side, and stays at least a pixel wide, for as
  // long as its slot can afford both. Below a pixel there is nothing to spare:
  // the bar fills its slot, thinner than a pixel, rather than spill into its
  // neighbour or past the edge of the plot. A year of days at 320 px is 0.67 px
  // a bar, and that is still a year of bars.
  const barWidth = Math.min(slot, Math.max(1, slot * (1 - clamp(gapRatio, 0, 0.9))));
  const inset = (slot - barWidth) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: i * slot + inset, width: barWidth }));
}

/** The drawable area inside a chart's axis gutters, in pixels. */
export interface Plot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Room for the axis labels around a plot, in pixels. */
export interface Gutter {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * A conservative advance for one character of an axis label, in em. Tabular
 * digits in SF Pro, the widest of the system faces the app renders with,
 * measure 0.62 em; a date's letters average a little less, a capital W a
 * little more. Over-estimating costs a few pixels of plot. Under-estimating
 * cuts the leading digit off a label, and an axis that reads 0000 for 10000 is
 * wrong by a factor of ten.
 */
export const LABEL_EM = 0.7;

/** A text size in pixels, or the 13 px footnote when the real one cannot be read. */
export function textSize(fontPx: number): number {
  return Number.isFinite(fontPx) && fontPx > 0 ? fontPx : 13;
}

/** The widest a label of `chars` characters can be, in pixels, at `fontPx`. */
export function labelWidth(chars: number, fontPx: number): number {
  return Math.ceil(chars * LABEL_EM * textSize(fontPx));
}

/**
 * The room around a plot, sized to the chart's own text rather than fixed in
 * pixels, so the labels still fit when the text is enlarged: on the left the
 * widest tick label, its 6px gap to the plot and 2px clear of the edge; half a
 * line above, so the top tick label is not cut in half; a line of dates and
 * some air below.
 */
export function gutterFor(ticks: readonly number[], fontPx: number): Gutter {
  const px = textSize(fontPx);
  const longest = ticks.reduce((chars, tick) => Math.max(chars, String(tick).length), 1);
  return {
    top: Math.ceil(px * 0.6),
    right: 6,
    bottom: Math.ceil(px * 1.2) + 4,
    left: Math.max(28, labelWidth(longest, px) + 8),
  };
}

/**
 * The plot inside a frame of `width` × `height`, or `null` when there is no
 * useful plot to draw: too small, larger than any screen, or a size that is
 * not a number at all. `null` is the chart's cue to show its table instead, so
 * a bad frame can never put `NaN` or `Infinity` into an SVG attribute.
 */
export function plotFrame(width: number, height: number, gutter: Gutter): Plot | null {
  // Range tests throughout, so that NaN, which fails every comparison, fails them.
  const inRange = (px: number) => px >= 0 && px <= MAX_FRAME;
  if (!(inRange(width) && inRange(height))) return null;
  if (!(inRange(gutter.top) && inRange(gutter.right) && inRange(gutter.bottom) && inRange(gutter.left))) return null;
  const inner = width - gutter.left - gutter.right;
  const tall = height - gutter.top - gutter.bottom;
  if (!(inner >= MIN_PLOT && tall >= MIN_PLOT)) return null;
  return { left: gutter.left, top: gutter.top, width: inner, height: tall };
}

/**
 * Value to pixel inside a plot, inverted for SVG's downward y and held to the
 * plot's edges. Something that is not a reading comes back as `NaN`, never as
 * a position: holding it to the edges would turn it into a valid-looking
 * reading at the top of the plot, and the line would run through it.
 */
export function plotY(domain: LinearDomain, plot: Plot): (value: number) => number {
  const bottom = plot.top + plot.height;
  const map = scaleLinear([domain.min, domain.max], [bottom, plot.top]);
  return value => (isReading(value) ? clamp(map(value), plot.top, bottom) : Number.NaN);
}

/** Pixel x for each point of a line chart: evenly spread, first and last on the plot's edges. */
export function pointXs(count: number, plot: Plot): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  if (count === 1) return [plot.left + plot.width / 2];
  const gap = plot.width / (count - 1);
  return Array.from({ length: count }, (_, i) => plot.left + i * gap);
}

/**
 * A line chart's strokes, in pixels: one run per stretch of consecutive
 * readings. A missing value and an invalid one both end a run; `plotY` turns
 * the invalid one into `NaN` before anything is drawn, and `segments` breaks
 * on it.
 */
export function lineRuns(values: readonly (number | null | undefined)[], domain: LinearDomain, plot: Plot): XY[][] {
  const y = plotY(domain, plot);
  const xs = pointXs(values.length, plot);
  return segments(values.map((v, i) => ({ x: xs[i], y: v === null || v === undefined ? null : y(v) })));
}

/**
 * One bar's vertical extent, in pixels: from the zero line to its value, and
 * never outside the plot. It is at least a pixel tall, so a recorded zero
 * stays visible as a hairline — which is what tells "none" apart from "not
 * entered". The hairline grows the bar's own way, up for a positive figure and
 * down for a negative one, but always into the plot, so it survives the plot's
 * clip even when the zero line is the plot's top edge.
 */
export function barExtent(valueY: number, baseY: number, top: number, bottom: number): { y: number; height: number } {
  let start = clamp(Math.min(valueY, baseY), top, bottom);
  let end = clamp(Math.max(valueY, baseY), top, bottom);
  if (end - start < 1) {
    if (valueY > baseY) end = start + 1;
    else start = end - 1;
    if (start < top) [start, end] = [top, top + 1];
    if (end > bottom) [start, end] = [bottom - 1, bottom];
  }
  return { y: start, height: end - start };
}

/**
 * The newest `max` slots, and how many older ones were left out. A long
 * series is cut from the old end, never thinned in the middle, so every gap
 * and every extreme in what is shown is real.
 */
export function recent<T>(slots: readonly T[], max = MAX_SLOTS): { shown: readonly T[]; omitted: number } {
  if (slots.length <= max) return { shown: slots, omitted: 0 };
  return { shown: slots.slice(slots.length - max), omitted: slots.length - max };
}

/** The smallest ring that still has a hole once its widest stroke is drawn. */
export const RING_MIN = 32;
/** Far larger than any layout wants; it keeps the circumference finite. */
export const RING_MAX = 512;
export const RING_DEFAULT = 80;

/** A ring's circles, all sized to fit inside a `size` × `size` frame. */
export interface RingGeometry {
  /** The outer diameter actually drawn, after validation. */
  size: number;
  centre: number;
  /** Of every arc's centre line. One radius, so a lap sits exactly over the ring. */
  radius: number;
  circumference: number;
  /** The ring's own stroke, and its filled arc's. */
  track: number;
  /** The narrower arc of a second lap. */
  lap: number;
  /** The outline under a second lap: the widest stroke the ring ever draws. */
  outline: number;
}

/**
 * The ring reserves room for its widest stroke — the outline under a second
 * lap — whether or not the goal has been passed. Sizing to the stroke in use
 * would let the outline paint past the frame and be clipped, and would make
 * the whole ring shrink the moment the goal was reached.
 */
export function ringGeometry(size: number): RingGeometry {
  const outer = Number.isFinite(size) ? clamp(size, RING_MIN, RING_MAX) : RING_DEFAULT;
  const track = Math.max(4, outer * 0.11);
  const outline = track + 4;
  const radius = (outer - outline) / 2;
  return {
    size: outer,
    centre: outer / 2,
    radius,
    circumference: 2 * Math.PI * radius,
    track,
    lap: track - 2,
    outline,
  };
}
