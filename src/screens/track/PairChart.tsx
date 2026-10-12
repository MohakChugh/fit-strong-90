/**
 * Two lines on one axis — systolic and diastolic — for the one metric the
 * hig `LineChart` cannot draw, because a blood-pressure reading is two numbers.
 *
 * Built from the same `scale.ts` helpers and to the same rules as `LineChart`:
 * one slot per reading plus one per empty day, a gap drawn as a gap, a single
 * reading as a dot, gutters sized to the chart's own text so enlarged text
 * still fits, the newest `MAX_SLOTS` drawn, and the numbers as a table — hidden
 * behind the picture, or shown in its place when there is no room to draw.
 * One accent colour: the second line is the foreground, dashed, and the legend
 * says which is which in words.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  MAX_SLOTS, gutterFor, isReading, labelWidth, linePath, lineRuns, niceDomain, niceTicks, placeLabels, plotFrame,
  plotY, pointXs, recent, textSize, thinLabels,
} from '@/components/hig/scale';
import { cn } from '@/lib/utils';

export interface PairSlot {
  label: string;
  first: number | null;
  second: number | null;
}

/** Width (floored, never rounded up) and text size, measured before paint, as `LineChart` does. */
function useMeasure(): [RefObject<HTMLElement | null>, number, number] {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [fontPx, setFontPx] = useState(13);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (px: number) => {
      setWidth(Math.floor(px));
      setFontPx(textSize(parseFloat(getComputedStyle(el).fontSize)));
    };
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width, fontPx];
}

export function PairChart({ slots, names, unit, label, targets, height = 200, missingLabel = 'Not entered', className }: {
  /** Oldest first. At most `MAX_SLOTS` are drawn; the newest are kept. */
  slots: readonly PairSlot[];
  /** What each line is, e.g. ["Top number (systolic)", "Bottom number (diastolic)"]. */
  names: [string, string];
  unit: string;
  label: string;
  /** Dashed reference lines. */
  targets: readonly { value: number; label: string }[];
  height?: number;
  missingLabel?: string;
  className?: string;
}) {
  const [frame, width, fontPx] = useMeasure();
  const { shown, omitted } = recent(slots);
  const lines = targets.filter(t => isReading(t.value));
  const domain = niceDomain(shown.flatMap(s => [s.first, s.second]), { include: lines.map(t => t.value) });
  const ticks = niceTicks(domain);
  const plot = plotFrame(width, height, gutterFor(ticks, fontPx));
  const y = plot ? plotY(domain, plot) : undefined;

  const series = (pick: (s: PairSlot) => number | null) => {
    if (!plot) return { d: '', dots: [], last: undefined };
    const runs = lineRuns(shown.map(pick), domain, plot);
    return { d: linePath(runs), dots: runs.filter(r => r.length === 1).map(r => r[0]), last: runs.at(-1)?.at(-1) };
  };
  const top = series(s => s.first);
  const low = series(s => s.second);

  const labels = shown.map(s => s.label);
  const centres = plot ? pointXs(shown.length, plot) : [];
  const longest = labels.reduce((n, l) => Math.max(n, l.length), 1);
  const placed = plot
    ? placeLabels(thinLabels(labels.length, plot.width, labelWidth(longest, fontPx) + 8).map(i => ({ index: i, centre: centres[i], width: labelWidth(labels[i].length, fontPx) })), width)
    : [];

  return (
    <figure ref={frame} className={cn('m-0 flex flex-col gap-2 text-[length:var(--text-footnote)]', className)}>
      <div aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" x2="20" y1="4" y2="4" stroke="currentColor" strokeWidth="2.5" className="text-tint" /></svg>{names[0]}</span>
        <span className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" x2="20" y1="4" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" className="text-foreground" /></svg>{names[1]}</span>
      </div>
      {plot && y && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
          <g className="numeric text-muted-foreground">
            {ticks.map(tick => (
              <g key={tick}>
                <line x1={plot.left} x2={plot.left + plot.width} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeWidth={1} className="text-separator" />
                <text x={plot.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{tick}</text>
              </g>
            ))}
          </g>
          {lines.map(t => (
            <line key={t.label} x1={plot.left} x2={plot.left + plot.width} y1={y(t.value)} y2={y(t.value)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" className="text-muted-foreground" />
          ))}
          <g className="text-tint">
            <path d={top.d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {top.dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" />)}
            {top.last && <circle cx={top.last.x} cy={top.last.y} r={3} fill="currentColor" />}
          </g>
          <g className="text-foreground">
            <path d={low.d} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
            {low.dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" />)}
            {low.last && <circle cx={low.last.x} cy={low.last.y} r={3} fill="currentColor" />}
          </g>
          <g className="text-muted-foreground">
            {placed.map(({ index, x }) => (
              <text key={index} x={x} y={height - Math.ceil(fontPx * 0.35)} textAnchor="middle" fill="currentColor">{labels[index]}</text>
            ))}
          </g>
        </svg>
      )}
      {omitted > 0 && (
        <p className="text-muted-foreground">
          Showing the latest {MAX_SLOTS.toLocaleString()} readings and days. {omitted.toLocaleString()} earlier are not charted.
        </p>
      )}
      {/* The same numbers as a table: hidden behind the picture, shown when there is no room to draw. */}
      <div className={plot ? 'sr-only' : undefined}>
        <table className={plot ? undefined : 'w-full table-fixed border-collapse text-left wrap-anywhere'}>
          <caption className={plot ? undefined : 'pb-1 text-left text-muted-foreground'}>{[label, ...lines.map(t => t.label)].join('. ')}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{names[0]}, {unit}</th>
              <th scope="col">{names[1]}, {unit}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={`${s.label}-${i}`}>
                <th scope="row" className="font-normal">{s.label}</th>
                <td className="numeric">{s.first === null ? missingLabel : s.first}</td>
                <td className="numeric">{s.second === null ? missingLabel : s.second}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
