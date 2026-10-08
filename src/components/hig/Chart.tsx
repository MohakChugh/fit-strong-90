import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  MAX_SLOTS, bands, barExtent, clamp, gutterFor, isReading, labelWidth, lineRuns, linePath, niceDomain, niceTicks,
  placeLabels, plotFrame, plotY, pointXs, recent, textSize, thinLabels,
  type LinearDomain, type Plot,
} from './scale';

/**
 * One point per slot — one per day, including the days with nothing in them.
 * That is what makes a gap visible: a missing day still takes up its space, so
 * the chart shows a hole rather than quietly closing it up.
 */
export interface ChartPoint {
  /** Axis and table label, already formatted, e.g. `"7 Oct"`. */
  label: string;
  /** The figure, or `null` when there is none for this slot. */
  value: number | null;
}

/** A shaded reference band, e.g. the range a reading is meant to sit in. */
export interface Band {
  from: number;
  to: number;
  /** Named in the chart's text equivalent, e.g. `"Normal range"`. */
  label: string;
}

/** A horizontal reference line, e.g. a clinician's target. */
export interface Target {
  value: number;
  label: string;
}

/**
 * A reference that is not a number is neither drawn nor described: the
 * picture and the table must not claim a line the chart cannot place.
 */
const usableBand = (band?: Band) => (band && isReading(band.from) && isReading(band.to) ? band : undefined);
const usableTarget = (target?: Target) => (target && isReading(target.value) ? target : undefined);

/**
 * A time series, with the missing days left missing.
 *
 * The gap handling is a correctness requirement rather than a style one: a
 * continuous line across a day with no glucose reading, or through a value
 * that cannot be a reading, would show a reading nobody took.
 */
export function LineChart({
  points, unit, label, band, target, height = 180, missingLabel = 'No reading', className,
}: {
  /** Oldest first. At most `MAX_SLOTS` are drawn; the newest are kept. */
  points: readonly ChartPoint[];
  /** e.g. `"mmol/L"`. Heads the value column in the text equivalent. */
  unit: string;
  /** What the chart is, e.g. `"Fasting glucose, last 90 days"`. */
  label: string;
  band?: Band;
  target?: Target;
  height?: number;
  /** What a slot with no figure is called. */
  missingLabel?: string;
  className?: string;
}) {
  const [frame, width, fontPx] = useMeasure();
  const { shown, omitted } = recent(points);
  const range = usableBand(band);
  const goal = usableTarget(target);
  const values = shown.map(p => p.value);
  const domain = niceDomain(values, { include: [range?.from, range?.to, goal?.value] });
  const ticks = niceTicks(domain);
  const plot = plotFrame(width, height, gutterFor(ticks, fontPx));

  return (
    <Figure
      frame={frame} plot={plot} width={width} height={height} omitted={omitted} className={className}
      table={{ label, unit, points: shown, band: range, target: goal, missingLabel }}
    >
      {plot && (
        <>
          {range && <BandRect band={range} domain={domain} plot={plot} />}
          <Grid ticks={ticks} domain={domain} plot={plot} />
          {goal && <TargetLine target={goal} domain={domain} plot={plot} />}
          <Line values={values} domain={domain} plot={plot} />
          <XLabels
            labels={shown.map(p => p.label)} plot={plot} width={width} height={height} fontPx={fontPx}
            centres={pointXs(shown.length, plot)}
          />
        </>
      )}
    </Figure>
  );
}

/**
 * Daily totals. A day with nothing recorded gets no bar at all — never a bar
 * of zero, because "not entered" and "none" are different facts (board D14).
 */
export function BarChart({
  points, unit, label, target, height = 160, missingLabel = 'Not entered', className,
}: {
  /** Oldest first. At most `MAX_SLOTS` are drawn; the newest are kept. */
  points: readonly ChartPoint[];
  unit: string;
  label: string;
  target?: Target;
  height?: number;
  missingLabel?: string;
  className?: string;
}) {
  const [frame, width, fontPx] = useMeasure();
  const clip = useId();
  const { shown, omitted } = recent(points);
  const goal = usableTarget(target);
  const domain = niceDomain(shown.map(p => p.value), { include: [goal?.value], zeroBased: true });
  const ticks = niceTicks(domain);
  const plot = plotFrame(width, height, gutterFor(ticks, fontPx));
  const slots = plot ? bands(shown.length, plot.width) : [];

  return (
    <Figure
      frame={frame} plot={plot} width={width} height={height} omitted={omitted} className={className}
      table={{ label, unit, points: shown, target: goal, missingLabel }}
    >
      {plot && (
        <>
          <defs>
            <clipPath id={clip}>
              <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} />
            </clipPath>
          </defs>
          <Grid ticks={ticks} domain={domain} plot={plot} />
          {goal && <TargetLine target={goal} domain={domain} plot={plot} />}
          <Bars points={shown} domain={domain} plot={plot} slots={slots} clip={clip} />
          <XLabels
            labels={shown.map(p => p.label)} plot={plot} width={width} height={height} fontPx={fontPx}
            centres={slots.map(b => plot.left + b.x + b.width / 2)}
          />
        </>
      )}
    </Figure>
  );
}

/**
 * The frame both charts share. With room to draw, the SVG is the picture and
 * the table is its hidden text equivalent. Without room — a narrow column, a
 * frame size that is not a number — there is no picture to hide behind, so
 * the same table is shown instead of an empty box.
 */
function Figure({ frame, plot, width, height, omitted, table, className, children }: {
  frame: RefObject<HTMLElement | null>;
  plot: Plot | null;
  width: number;
  height: number;
  omitted: number;
  table: Omit<TableProps, 'visible'>;
  className?: string;
  children: ReactNode;
}) {
  return (
    // The chart's text size is set here, once, so it can be measured: every
    // label, the note and the table inherit it, and the gutters are sized to it.
    <figure ref={frame} className={cn('m-0 text-[length:var(--text-footnote)]', className)}>
      {plot && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
          {children}
        </svg>
      )}
      {/* Visible, and so read by a screen reader too: a chart that has left
          days out says so rather than presenting part as the whole. */}
      {omitted > 0 && (
        <p className="pt-1 text-muted-foreground">
          Showing the latest {MAX_SLOTS.toLocaleString()} days. {omitted.toLocaleString()} earlier are not charted.
        </p>
      )}
      <DataTable {...table} visible={!plot} />
    </figure>
  );
}

/**
 * The container's width and text size, measured before the first paint so the
 * chart never flashes at a guessed size. A ResizeObserver keeps both right
 * through rotation and a split view; they change only when the box does, never
 * per frame.
 */
function useMeasure(): [RefObject<HTMLElement | null>, number, number] {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [fontPx, setFontPx] = useState(13);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (px: number) => {
      // Floored, never rounded: a chart half a pixel wider than its box is a
      // horizontal scrollbar at 320 px.
      setWidth(Math.floor(px));
      setFontPx(textSize(parseFloat(getComputedStyle(el).fontSize)));
    };
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    // The observer's content box ignores transforms, so a parent's press
    // animation cannot leave the chart measured at its scaled-down width.
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width, fontPx];
}

function Grid({ ticks, domain, plot }: { ticks: number[]; domain: LinearDomain; plot: Plot }) {
  const y = plotY(domain, plot);
  return (
    // Tabular digits: every digit the same width, which is what the gutter is sized for.
    <g className="numeric text-muted-foreground">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeWidth={1} className="text-separator" />
          <text x={plot.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{tick}</text>
        </g>
      ))}
    </g>
  );
}

function BandRect({ band, domain, plot }: { band: Band; domain: LinearDomain; plot: Plot }) {
  const y = plotY(domain, plot);
  const top = y(Math.max(band.from, band.to));
  const bottom = y(Math.min(band.from, band.to));
  return <rect x={plot.left} y={top} width={plot.width} height={Math.max(0, bottom - top)} className="fill-tint/10" />;
}

function TargetLine({ target, domain, plot }: { target: Target; domain: LinearDomain; plot: Plot }) {
  const y = plotY(domain, plot)(target.value);
  return (
    <line
      x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y}
      stroke="currentColor" strokeWidth={1} strokeDasharray="3 3"
      className="text-muted-foreground"
    />
  );
}

function Line({ values, domain, plot }: { values: readonly (number | null)[]; domain: LinearDomain; plot: Plot }) {
  const runs = lineRuns(values, domain, plot);
  const latest = runs.at(-1)?.at(-1);

  return (
    <g className="text-tint">
      <path d={linePath(runs)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* A reading with no neighbour strokes nothing, so it gets a dot. Without
          this, one figure after a long gap would simply vanish. */}
      {runs.filter(run => run.length === 1).map(run => (
        <circle key={run[0].x} cx={run[0].x} cy={run[0].y} r={2.5} fill="currentColor" />
      ))}
      {latest && <circle cx={latest.x} cy={latest.y} r={3} fill="currentColor" />}
    </g>
  );
}

function Bars({ points, domain, plot, slots, clip }: {
  points: readonly ChartPoint[];
  domain: LinearDomain;
  plot: Plot;
  slots: { x: number; width: number }[];
  /** The plot's clip path. Bars are built to fit it; the clip makes sure. */
  clip: string;
}) {
  const y = plotY(domain, plot);
  const base = y(clamp(0, domain.min, domain.max));

  return (
    <g className="text-tint" clipPath={`url(#${clip})`}>
      {points.map((point, i) => {
        // No bar at all for a day with nothing recorded, or with a figure that
        // cannot be a reading. A recorded zero does get a hairline, so "none"
        // stays distinguishable from "not entered".
        if (!isReading(point.value) || !slots[i]) return null;
        const { y: top, height } = barExtent(y(point.value), base, plot.top, plot.top + plot.height);
        return (
          <rect
            key={`${point.label}-${i}`}
            x={plot.left + slots[i].x}
            y={top}
            width={slots[i].width}
            height={height}
            rx={Math.min(2, slots[i].width / 2)}
            fill="currentColor"
          />
        );
      })}
    </g>
  );
}

function XLabels({ labels, plot, width, height, fontPx, centres }: {
  labels: readonly string[];
  plot: Plot;
  /** The whole frame's width: a label may use the gutter below the y axis. */
  width: number;
  height: number;
  fontPx: number;
  centres: number[];
}) {
  // Each label is budgeted the room its longest neighbour could need, plus a
  // gap, at the chart's real text size — so the callers' own date formats and
  // enlarged text are both thinned rather than overlapped.
  const longest = labels.reduce((chars, label) => Math.max(chars, label.length), 1);
  const kept = thinLabels(labels.length, plot.width, labelWidth(longest, fontPx) + 8);
  const placed = placeLabels(
    kept.map(i => ({ index: i, centre: centres[i], width: labelWidth(labels[i].length, fontPx) })),
    width,
  );
  return (
    <g className="text-muted-foreground">
      {placed.map(({ index, x }) => (
        // Clear of the descenders, at any text size.
        <text key={index} x={x} y={height - Math.ceil(fontPx * 0.35)} textAnchor="middle" fill="currentColor">
          {labels[index]}
        </text>
      ))}
    </g>
  );
}

interface TableProps {
  label: string;
  unit: string;
  points: readonly ChartPoint[];
  band?: Band;
  target?: Target;
  missingLabel: string;
  /** Shown as the chart itself when there is no room to draw one. */
  visible: boolean;
}

/**
 * The chart's text equivalent — not a summary of it, the same numbers. Behind
 * a drawn chart it is visually hidden, and is what a screen reader gets; the
 * caption means it can be recognised and skipped like any other table.
 */
function DataTable({ label, unit, points, band, target, missingLabel, visible }: TableProps) {
  const caption = [
    label,
    band && `${band.label} ${band.from} to ${band.to} ${unit}`,
    target && `${target.label} ${target.value} ${unit}`,
  ].filter((part): part is string => typeof part === 'string').join('. ');
  // Styling only when shown: the hidden copy stays as lean as markup can be.
  const shown = (classes: string) => (visible ? classes : undefined);

  return (
    // The wrapper, not the table, carries `sr-only`. A table ignores a 1px
    // width — auto table layout sizes it to its widest cell — so an unwrapped
    // one is laid out hundreds of pixels wide and drags the whole page into
    // horizontal scroll at 320 px. Shown, the table is fixed to its box and
    // wraps instead, so it can never widen the page either.
    <div className={visible ? undefined : 'sr-only'}>
      <table className={shown('w-full table-fixed border-collapse text-left wrap-anywhere')}>
        <caption className={shown('pb-1 text-left text-muted-foreground')}>{caption}</caption>
        <thead>
          <tr className={shown('text-muted-foreground')}>
            <th scope="col" className={shown('py-1 pr-2 font-medium')}>Date</th>
            <th scope="col" className={shown('py-1 font-medium')}>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, i) => (
            <tr key={`${point.label}-${i}`} className={shown('border-t border-separator')}>
              <th scope="row" className={shown('py-1 pr-2 font-normal')}>{point.label}</th>
              <td className={shown('numeric py-1')}>{cell(point.value, unit, missingLabel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Three different facts, said three different ways: a reading, nothing
 * entered, and something entered that cannot be a reading. `unknown`, because
 * records arrive from storage and import, where the type is only a promise.
 */
function cell(value: unknown, unit: string, missingLabel: string): string {
  if (isReading(value)) return `${value} ${unit}`;
  return value === null || value === undefined ? missingLabel : 'Invalid value';
}
