/**
 * The shared trend chart (journey §12.2, §20.2; B-15; M21). It draws a
 * `ChartModel` and works out no statistic: the period before behind in grey
 * and striped, the current bars in the category colour, readings by shape,
 * weekly or monthly ranges, a dashed average named in the legend, labelled
 * reference lines, and hatched rest and status days.
 *
 * The whole plot is one slider: a tap or a drag anywhere chooses the slot
 * under it, and the arrow keys, Home, End and Escape do the same. The chosen
 * slot is outlined in body ink and nothing else fades (D71); its words
 * appear above the plot, and for a day "See the day" below it, beside "Show
 * as list", which opens the same figures as a table. VoiceOver hears the
 * summary.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { bands, barExtent, gutterFor, labelWidth, placeLabels, plotFrame, plotY, thinLabels, type LinearDomain, type Plot } from '@/components/hig/scale';
import { useMeasure } from '@/components/hig/useMeasure';
import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatNumber } from '@/screens/track/units';
import {
  domainOf, legendOf, selectable, slotAt, stepValue,
  type BarSeries, type ChartModel, type LegendItem, type PointSeries, type RangeSeries,
} from './chart';
import type { Shape } from './metrics';

/** The plot's height, in CSS pixels. Its text follows the person's text size. */
const HEIGHT = 200;

type Y = (value: number) => number;

export function TrendChart({ model, label, summary, table, view, origin }: {
  model: ChartModel;
  /** The slider's name: "Steps, This week". */
  label: string;
  /** The view in sentences, for VoiceOver (A-63). */
  summary: string;
  /** "Show as list" (K-40). */
  table: { columns: string[]; rows: string[][] };
  /** Changes with the period or the window: the plot fades over, and a choice is put down (M21). */
  view: string;
  /** Where "See the day" says it came from. */
  origin: { path: string; label: string; search?: string };
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduced = useReducedMotion();
  const [frame, width, fontPx] = useMeasure<HTMLDivElement>();
  const root = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<{ view: string; index: number }>();
  const [listOpen, setListOpen] = useState(false);
  // A choice belongs to the view it was made in: a new period or window starts with none, with no effect needed.
  const index = chosen?.view === view ? chosen.index : undefined;
  const max = selectable(model);
  const choose = (i: number | undefined) => setChosen(i === undefined ? undefined : { view, index: i });

  // A tap anywhere outside the chart puts the choice down (M21).
  useEffect(() => {
    if (index === undefined) return;
    const away = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setChosen(undefined);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [index]);

  const { domain, ticks } = domainOf(model);
  const tickText = (t: number) => formatNumber(t, Number.isInteger(domain.step) ? 0 : domain.step >= 0.1 ? 1 : 2);
  const sized = gutterFor(ticks, fontPx);
  // Room for the tick labels as written, with their digit grouping ("10,000").
  const gutter = { ...sized, left: Math.max(sized.left, labelWidth(Math.max(1, ...ticks.map(t => tickText(t).length)), fontPx) + 8) };
  const plot = plotFrame(width, HEIGHT, gutter);
  const y: Y = plot ? plotY(domain, plot) : () => Number.NaN;
  const n = model.slots.length;
  const slot = index === undefined ? undefined : model.slots[index];

  const pick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!plot || max === 0) return;
    const i = slotAt(e.clientX - e.currentTarget.getBoundingClientRect().left, plot, n);
    if (i !== undefined) choose(Math.min(i, max - 1));
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const now = index === undefined ? 0 : index + 1;
    const next = stepValue(e.key, now, max);
    // Escape with nothing chosen is the page's, not the chart's.
    if (next === undefined || (e.key === 'Escape' && now === 0)) return;
    e.preventDefault();
    choose(next === 0 ? undefined : next - 1);
  };
  const appear = reduced ? undefined : { animationDuration: `${MOTION.springQuick.cssMs}ms`, animationTimingFunction: springLinear(0) };
  const fade = reduced ? undefined : { animationDuration: `${MOTION.fade}ms` };

  return (
    <div ref={root} className="flex flex-col gap-3">
      <Patterns uid={uid} />
      {/* The chosen slot in words, above the plot (M21); a hint until one is chosen. Nothing here can be pressed:
          at large text the words can outgrow the lines kept for them and push the plot down, and the tap's own
          click would then land on whatever moved under the finger. "See the day" is below the plot. */}
      <div className="min-h-[3lh] text-[length:var(--text-subhead)] leading-snug">
        {slot ? (
          <p key={slot.key} className={reduced ? 'font-medium [overflow-wrap:break-word]' : 'font-medium [overflow-wrap:break-word] animate-in fade-in slide-in-from-bottom-1'} style={appear}>{slot.text}</p>
        ) : (
          <p className="text-muted-foreground">Tap or drag across the chart, or use the arrow keys, to read it.</p>
        )}
      </div>
      <div ref={frame} className="relative text-[length:var(--text-footnote)]" style={plot ? { height: HEIGHT } : undefined}>
        {plot && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={index === undefined ? 0 : index + 1}
            aria-valuetext={slot?.text ?? 'Nothing chosen'}
            onKeyDown={keys}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e); }}
            className="absolute inset-0 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-tint"
          >
            <svg width={width} height={HEIGHT} aria-hidden className="block">
              <Grid ticks={ticks} text={tickText} plot={plot} y={y} />
              <g key={view} className={reduced ? undefined : 'animate-in fade-in'} style={fade}>
                <Marks model={model} plot={plot} uid={uid} />
                <Bars model={model} plot={plot} y={y} uid={uid} />
                <Ranges model={model} plot={plot} y={y} />
                <Points model={model} plot={plot} y={y} />
                <Lines model={model} plot={plot} y={y} domain={domain} />
              </g>
              <Labels model={model} plot={plot} width={width} fontPx={fontPx} />
              {index !== undefined && (
                <rect
                  x={plot.left + (index * plot.width) / n + 1} y={plot.top - 2}
                  width={Math.max(2, plot.width / n - 2)} height={plot.height + 4} rx={4}
                  fill="none" style={{ stroke: 'var(--foreground)' }} strokeWidth={2}
                />
              )}
            </svg>
          </div>
        )}
      </div>
      <Legend items={legendOf(model)} {...(model.average ? { average: model.average.label } : {})} uid={uid} />
      <div className="flex flex-wrap items-center gap-3 empty:hidden">
        {plot && (
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls={`${uid}-list`}
            onClick={() => setListOpen(open => !open)}
            className="press-feedback min-h-12 rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint"
          >
            {listOpen ? 'Hide list' : 'Show as list'}
          </button>
        )}
        {slot?.day && (
          <Link to={`/day/${slot.day}`} state={origin} className="press-feedback inline-flex min-h-12 items-center px-1 text-[length:var(--text-subhead)] font-semibold text-tint">
            See the day
          </Link>
        )}
      </div>
      {/* With no room for a plot, the list is the chart. */}
      {(listOpen || !plot) && <Table id={`${uid}-list`} caption={label} table={table} />}
      <p className="sr-only">{summary}</p>
    </div>
  );
}

/** The stripes for the period before and the hatching for shaded days, used by the plot and the legend. */
function Patterns({ uid }: { uid: string }) {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <pattern id={`${uid}-previous`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" style={{ fill: 'var(--trend-previous)' }} />
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--grouped-card)' }} strokeWidth="2" />
        </pattern>
        <pattern id={`${uid}-mark`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--muted-foreground)' }} strokeWidth="1.5" />
        </pattern>
      </defs>
    </svg>
  );
}

function Grid({ ticks, text, plot, y }: { ticks: number[]; text: (t: number) => string; plot: Plot; y: Y }) {
  return (
    // Tabular digits: every digit the same width, which is what the gutter is sized for.
    <g className="numeric text-muted-foreground">
      {ticks.map(t => (
        <g key={t}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(t)} y2={y(t)} stroke="currentColor" strokeWidth={1} className="text-separator" />
          <text x={plot.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{text(t)}</text>
        </g>
      ))}
    </g>
  );
}

/** Rest and status days, hatched across the plot: shaded and named, never a zero (K-49). */
function Marks({ model, plot, uid }: { model: ChartModel; plot: Plot; uid: string }) {
  const w = plot.width / model.slots.length;
  return (
    <g>
      {model.slots.map((s, i) => s.mark && (
        <rect key={s.key} x={plot.left + i * w} y={plot.top} width={w} height={plot.height} style={{ fill: `url(#${uid}-mark)` }} />
      ))}
    </g>
  );
}

/** The period before at full width behind, the current bars narrower in front; a recorded 0 is a hairline. */
function Bars({ model, plot, y, uid }: { model: ChartModel; plot: Plot; y: Y; uid: string }) {
  const n = model.slots.length;
  const bars = model.series.filter((s): s is BarSeries => s.kind === 'bars');
  const behind = bars.filter(s => s.previous);
  const front = bars.filter(s => !s.previous);
  const wide = bands(n, plot.width, 0.12);
  const narrow = bands(n, plot.width, 0.45);
  const base = y(0);
  const bottom = plot.top + plot.height;
  return (
    <g>
      {behind.map(s => s.values.map((v, i) => {
        if (v === null || !wide[i]) return null;
        const e = barExtent(y(v), base, plot.top, bottom);
        return (
          <rect
            key={`${s.id}-${i}`} x={plot.left + wide[i].x} y={e.y} width={wide[i].width} height={e.height} rx={2}
            style={{ fill: `url(#${uid}-previous)`, stroke: 'var(--trend-previous)' }} strokeWidth={1}
          />
        );
      }))}
      {front.map((s, j) => s.values.map((v, i) => {
        if (v === null || !narrow[i]) return null;
        const part = narrow[i].width / front.length;
        const e = barExtent(y(v), base, plot.top, bottom);
        return <rect key={`${s.id}-${i}`} x={plot.left + narrow[i].x + j * part} y={e.y} width={part} height={e.height} rx={2} style={{ fill: s.colour }} />;
      }))}
    </g>
  );
}

/** Each reading at its time of day across its slot, by shape; one past a line has a caution ring as well as its words. */
function Points({ model, plot, y }: { model: ChartModel; plot: Plot; y: Y }) {
  const w = plot.width / model.slots.length;
  const series = model.series.filter((s): s is PointSeries => s.kind === 'points');
  return (
    <g>
      {series.map(s => s.points.map((p, i) => {
        const cx = plot.left + (p.slot + Math.min(0.85, Math.max(0.15, p.at))) * w;
        const cy = y(p.value);
        return (
          <g key={`${s.id}-${i}`}>
            {p.flag && <circle cx={cx} cy={cy} r={8} fill="none" style={{ stroke: 'var(--caution)' }} strokeWidth={2} />}
            <ShapeMark shape={s.shape} x={cx} y={cy} size={9} colour={s.colour} />
          </g>
        );
      }))}
    </g>
  );
}

/** A week's or a month's readings: lowest to highest, with the mean marked. */
function Ranges({ model, plot, y }: { model: ChartModel; plot: Plot; y: Y }) {
  const w = plot.width / model.slots.length;
  const series = model.series.filter((s): s is RangeSeries => s.kind === 'ranges');
  return (
    <g>
      {series.map((s, j) => s.values.map((r, i) => {
        if (!r) return null;
        const cx = plot.left + (i + 0.5) * w + (j - (series.length - 1) / 2) * 6;
        return (
          <g key={`${s.id}-${i}`}>
            <line x1={cx} x2={cx} y1={y(r.max)} y2={y(r.min)} style={{ stroke: s.colour }} strokeWidth={3} strokeLinecap="round" />
            <ShapeMark shape={s.shape} x={cx} y={y(r.mean)} size={7} colour={s.colour} />
          </g>
        );
      }))}
    </g>
  );
}

/** The reference lines that fall on the axis, with their words, and the dashed average the legend names. */
function Lines({ model, plot, y, domain }: { model: ChartModel; plot: Plot; y: Y; domain: LinearDomain }) {
  const inside = (v: number) => v >= domain.min && v <= domain.max;
  return (
    <g>
      {model.lines.filter(l => inside(l.value)).map(l => (
        <g key={l.label}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(l.value)} y2={y(l.value)} style={{ stroke: 'var(--caution)' }} strokeWidth={1} />
          <text x={plot.left + 4} y={y(l.value) - 4} style={{ fill: 'var(--caution)', stroke: 'var(--grouped-card)' }} strokeWidth={3} paintOrder="stroke">{l.label}</text>
        </g>
      ))}
      {model.average && inside(model.average.value) && (
        <line
          x1={plot.left} x2={plot.left + plot.width} y1={y(model.average.value)} y2={y(model.average.value)}
          style={{ stroke: 'var(--foreground)' }} strokeWidth={1.5} strokeDasharray="5 4"
        />
      )}
    </g>
  );
}

/** The slots' labels, thinned to fit and held inside the frame (v1's `thinLabels` and `placeLabels`). */
function Labels({ model, plot, width, fontPx }: { model: ChartModel; plot: Plot; width: number; fontPx: number }) {
  const n = model.slots.length;
  const w = plot.width / n;
  const widest = model.slots.reduce((m, s) => Math.max(m, s.label.length), 1);
  const placed = placeLabels(
    thinLabels(n, plot.width, labelWidth(widest, fontPx) + 6).map(i => ({ index: i, centre: plot.left + (i + 0.5) * w, width: labelWidth(model.slots[i].label.length, fontPx) })),
    width,
  );
  return (
    <g className="text-muted-foreground">
      {placed.map(({ index, x }) => (
        <text key={model.slots[index].key} x={x} y={plot.top + plot.height + fontPx + 2} textAnchor="middle" fill="currentColor">{model.slots[index].label}</text>
      ))}
    </g>
  );
}

function ShapeMark({ shape, x, y, size, colour }: { shape: Shape; x: number; y: number; size: number; colour: string }) {
  const h = size / 2;
  const style = { fill: colour, stroke: 'var(--grouped-card)' };
  if (shape === 'square') return <rect x={x - h} y={y - h} width={size} height={size} style={style} strokeWidth={1.5} />;
  if (shape === 'triangle') return <path d={`M${x} ${y - h - 1}L${x + h + 1} ${y + h}L${x - h - 1} ${y + h}Z`} style={style} strokeWidth={1.5} />;
  return <circle cx={x} cy={y} r={h} style={style} strokeWidth={1.5} />;
}

function Swatch({ item, uid }: { item: LegendItem; uid: string }) {
  switch (item.swatch) {
    case 'bar': return <rect x="3" y="2" width="10" height="12" rx="2" style={{ fill: item.colour }} />;
    case 'previous': return <rect x="2" y="2" width="12" height="12" rx="1" style={{ fill: `url(#${uid}-previous)`, stroke: 'var(--trend-previous)' }} />;
    case 'mark': return <rect x="1" y="1" width="14" height="14" style={{ fill: `url(#${uid}-mark)`, stroke: 'var(--muted-foreground)' }} strokeWidth="1" />;
    case 'range': return (
      <>
        <line x1="8" x2="8" y1="2" y2="14" style={{ stroke: item.colour }} strokeWidth="3" strokeLinecap="round" />
        {item.shape && <ShapeMark shape={item.shape} x={8} y={8} size={7} colour={item.colour} />}
      </>
    );
    default: return <ShapeMark shape={item.swatch} x={8} y={8} size={10} colour={item.colour} />;
  }
}

/** What each colour, pattern and shape means, in words beside it (journey §20.3), and the average's figure. */
function Legend({ items, average, uid }: { items: LegendItem[]; average?: string; uid: string }) {
  if (items.length === 0 && !average) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
      {items.map(item => (
        <li key={item.id} className="flex items-center gap-1.5">
          <svg width="16" height="16" aria-hidden className="shrink-0"><Swatch item={item} uid={uid} /></svg>
          <span>{item.label}</span>
        </li>
      ))}
      {average && (
        <li className="flex items-center gap-1.5">
          <svg width="16" height="16" aria-hidden className="shrink-0">
            <line x1="1" x2="15" y1="8" y2="8" style={{ stroke: 'var(--foreground)' }} strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          <span>{average}</span>
        </li>
      )}
    </ul>
  );
}

function Table({ id, caption, table }: { id: string; caption: string; table: { columns: string[]; rows: string[][] } }) {
  return (
    <div id={id} className="overflow-hidden rounded-xl bg-grouped-card">
      <table className="w-full border-collapse text-left text-[length:var(--text-subhead)]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{table.columns.map(c => <th key={c} scope="col" className="px-3 py-2 font-semibold text-muted-foreground [overflow-wrap:anywhere]">{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.length === 0 && (
            <tr className="border-t border-separator"><td colSpan={table.columns.length} className="px-3 py-2 text-muted-foreground">Nothing recorded in this period.</td></tr>
          )}
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-separator">
              {row.map((cell, j) => (j === 0
                ? <th key={j} scope="row" className="px-3 py-2 font-medium [overflow-wrap:anywhere]">{cell}</th>
                : <td key={j} className="px-3 py-2 [overflow-wrap:anywhere]">{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
