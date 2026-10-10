/**
 * The signature chart (board D21): four lanes on one time axis.
 *
 * 1. Pain, 0 to 10: back pain (the accent, solid) and leg pain (the
 *    foreground, dashed). A day with no reading breaks the line.
 * 2. How far leg symptoms reached, from the check-ins: a dot on the row for
 *    back, buttock, thigh, below the knee or foot. Categories are not joined
 *    by lines: "thigh" to "foot" is not a slope the person drew.
 * 3–4. Spinal loading, hinge and squat — the ladder's two tracks, each its
 *    own lane, because a summary of both hides the track that moved. The
 *    level each session used is held as a step until the next session that
 *    loaded that track, and broken after a fortnight without one. Every
 *    session is ticked on the axis; a "worse" checkpoint is a triangle on
 *    the track it followed — a shape and a word, never colour alone.
 *
 * Plain SVG on the hig `scale.ts` helpers. Every size is derived from the
 * chart's own measured text, as the hig charts do, so the lanes and labels
 * still fit when the text is enlarged. The SVG is hidden from assistive
 * technology and a table with the same facts stands in for it; when there is
 * no room to draw, the facts are shown in its place, a day at a time.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { labelWidth, placeLabels, scaleLinear, textSize, thinLabels } from '@/components/hig/scale';
import type { LadderLevel } from '@/types/catalog';
import {
  REACH_LABELS, REACH_ORDER, backLegTable, dayOffset, loadingRuns, painRuns, type BackLegData, type LoadPoint, type PainPoint,
} from './backLegSeries';
import { formatDayShort } from './format';
import { addDays, daysBetween } from './periods';

/** Below this the plot is too narrow to read; the table stands in for it. */
const MIN_PLOT = 120;
const RIGHT = 8;
const PAIN_H = 108;

/** Lane geometry for a text size: rows a line apart, titles clear of the top tick. */
function layout(fontPx: number) {
  const longest = Math.max(...REACH_ORDER.map(r => REACH_LABELS[r].length));
  return {
    gutter: labelWidth(longest, fontPx) + 8,
    title: Math.ceil(fontPx * 2),
    row: Math.ceil(fontPx * 1.2),
    level: Math.ceil(fontPx * 0.9),
    gap: Math.ceil(fontPx),
    axis: Math.ceil(fontPx * 2.2),
  };
}

/** Width (floored, never rounded up) and text size, measured before paint, as the hig charts do. */
function useMeasure<T extends HTMLElement>(): [RefObject<T | null>, number, number] {
  const ref = useRef<T>(null);
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

function path(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
}

function LoadingLane({ track, title, top, data, x, gutter, plot, height, titleRoom, fontPx }: {
  track: 'hinge' | 'squat';
  title: string;
  top: number;
  data: BackLegData;
  x: (p: { day: string; dayFraction: number }) => number;
  gutter: number;
  plot: number;
  height: number;
  titleRoom: number;
  fontPx: number;
}) {
  const bottom = top + height;
  const y = scaleLinear([0, 4], [bottom, top]);
  const level = (p: LoadPoint) => p[track] as LadderLevel;
  const steps = loadingRuns(data.sessions, track).map(run => {
    const out: { x: number; y: number }[] = [];
    run.forEach((p, i) => {
      const px = x(p);
      if (i > 0) out.push({ x: px, y: out[out.length - 1].y });
      out.push({ x: px, y: y(level(p)) });
    });
    return out;
  });
  // A "worse" after an exercise off the ladder is shown on the hinge lane,
  // the track a flare of sciatica is usually set off by.
  const worse = data.sessions.filter(p => p.worseOn.includes(track) || (track === 'hinge' && p.worseOn.includes('other')));
  const tri = Math.ceil(fontPx * 0.35);
  return (
    <g>
      <text x={0} y={top - titleRoom + fontPx} fill="currentColor" fontWeight={600} className="text-muted-foreground">{title}</text>
      <g className="numeric text-muted-foreground">
        {[0, 2, 4].map(l => (
          <g key={l}>
            <line x1={gutter} x2={gutter + plot} y1={y(l)} y2={y(l)} stroke="currentColor" strokeWidth={1} className="text-separator" />
            <text x={gutter - 6} y={y(l)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{l}</text>
          </g>
        ))}
      </g>
      <g className="text-foreground">
        {steps.map((run, i) => run.length > 1 && <path key={i} d={path(run)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />)}
        {data.sessions.filter(p => p[track] !== null).map(p => <circle key={p.sessionId} cx={x(p)} cy={y(level(p))} r={3} fill="currentColor" />)}
      </g>
      <g className="text-caution">
        {worse.map(p => {
          const cx = x(p);
          const tip = (p[track] !== null ? y(level(p)) : top) - 5;
          return <path key={p.sessionId} d={`M${cx - tri} ${tip - tri * 1.5} H${cx + tri} L${cx} ${tip} Z`} fill="currentColor" />;
        })}
      </g>
    </g>
  );
}

export function BackLegChart({ data, current }: { data: BackLegData; current: string }) {
  const [frame, width, fontPx] = useMeasure<HTMLDivElement>();
  const L = layout(fontPx);
  const days = daysBetween(data.range.from, data.range.to) + 1;
  const plot = width - L.gutter - RIGHT;
  const drawable = plot >= MIN_PLOT;
  const x = (point: { day: string; dayFraction: number }) => L.gutter + (dayOffset(data.range, point) / days) * plot;

  const loadH = L.level * 4;
  const painTop = L.title;
  const painBottom = painTop + PAIN_H;
  const reachTop = painBottom + L.gap + L.title;
  const reachBottom = reachTop + L.row * 4;
  const hingeTop = reachBottom + L.gap + L.title;
  const squatTop = hingeTop + loadH + L.gap + L.title;
  const ticksAt = squatTop + loadH + 6;
  const height = squatTop + loadH + L.axis;

  const painY = scaleLinear([0, 10], [painBottom, painTop]);
  const reachY = (i: number) => reachTop + i * L.row;
  const line = (points: readonly PainPoint[]) => painRuns(points).map(run => run.map(p => ({ x: x(p), y: painY(p.value) })));
  const back = line(data.back);
  const leg = line(data.leg);

  const dayLabels = Array.from({ length: days }, (_, i) => formatDayShort(addDays(data.range.from, i), current));
  const longest = dayLabels.reduce((n, l) => Math.max(n, l.length), 1);
  const placed = drawable
    ? placeLabels(
      thinLabels(days, plot, labelWidth(longest, fontPx) + 8).map(i => ({
        index: i, centre: x({ day: addDays(data.range.from, i), dayFraction: 0.5 }), width: labelWidth(dayLabels[i].length, fontPx),
      })),
      width,
    )
    : [];
  const table = backLegTable(data);
  const caption = `Back and leg pain, how far symptoms reached, and spinal loading by day, ${formatDayShort(data.range.from, current)} to ${formatDayShort(data.range.to, current)}. Days with nothing recorded are left out.`;

  return (
    <figure className="m-0 flex flex-col gap-3 rounded-xl bg-grouped-card px-3 py-3 text-[length:var(--text-footnote)]">
      <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1.5 text-muted-foreground">
        <li className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" x2="20" y1="4" y2="4" stroke="currentColor" strokeWidth="2.5" className="text-tint" /></svg>Back pain</li>
        <li className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" x2="20" y1="4" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" className="text-foreground" /></svg>Leg pain</li>
        <li className="flex items-center gap-1.5"><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="currentColor" className="text-foreground" /></svg>How far symptoms reached</li>
        <li className="flex items-center gap-1.5"><svg width="20" height="10"><path d="M0 8 H8 V2 H20" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" /></svg>Level a session used</li>
        <li className="flex items-center gap-1.5"><svg width="10" height="10"><path d="M1 2 H9 L5 9 Z" fill="currentColor" className="text-caution" /></svg>Worse during a session</li>
        <li className="flex items-center gap-1.5"><svg width="6" height="10"><line x1="3" x2="3" y1="1" y2="9" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" /></svg>A session</li>
      </ul>

      {/* Measured inside the card's padding, so the plot is exactly as wide as the room it has. */}
      <div ref={frame}>
        {drawable && (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
            <text x={0} y={fontPx} fill="currentColor" fontWeight={600} className="text-muted-foreground">Pain, 0 to 10</text>
            <g className="numeric text-muted-foreground">
              {[0, 5, 10].map(t => (
                <g key={t}>
                  <line x1={L.gutter} x2={L.gutter + plot} y1={painY(t)} y2={painY(t)} stroke="currentColor" strokeWidth={1} className="text-separator" />
                  <text x={L.gutter - 6} y={painY(t)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{t}</text>
                </g>
              ))}
            </g>
            <g className="text-foreground">
              {leg.map((run, i) => (
                <g key={i}>
                  {run.length > 1 && <path d={path(run)} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />}
                  {run.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={2.5} fill="currentColor" />)}
                </g>
              ))}
            </g>
            <g className="text-tint">
              {back.map((run, i) => (
                <g key={i}>
                  {run.length > 1 && <path d={path(run)} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
                  {run.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={2.75} fill="currentColor" />)}
                </g>
              ))}
            </g>

            <text x={0} y={reachTop - L.title + fontPx} fill="currentColor" fontWeight={600} className="text-muted-foreground">Symptoms reached</text>
            <g className="text-muted-foreground">
              {REACH_ORDER.map((reach, i) => (
                <g key={reach}>
                  <line x1={L.gutter} x2={L.gutter + plot} y1={reachY(i)} y2={reachY(i)} stroke="currentColor" strokeWidth={1} className="text-separator" />
                  <text x={L.gutter - 6} y={reachY(i)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{REACH_LABELS[reach]}</text>
                </g>
              ))}
            </g>
            <g className="text-foreground">
              {data.reach.map(p => (
                <circle key={p.day} cx={x({ day: p.day, dayFraction: 0.5 })} cy={reachY(REACH_ORDER.indexOf(p.reach))} r={3.5} fill="currentColor" />
              ))}
            </g>

            <LoadingLane track="hinge" title="Hinge loading, level 0 to 4" top={hingeTop} data={data} x={x} gutter={L.gutter} plot={plot} height={loadH} titleRoom={L.title} fontPx={fontPx} />
            <LoadingLane track="squat" title="Squat loading, level 0 to 4" top={squatTop} data={data} x={x} gutter={L.gutter} plot={plot} height={loadH} titleRoom={L.title} fontPx={fontPx} />
            <g className="text-muted-foreground">
              {data.sessions.map(s => (
                <line key={s.sessionId} x1={x(s)} x2={x(s)} y1={ticksAt} y2={ticksAt + 5} stroke="currentColor" strokeWidth={1.5} />
              ))}
            </g>

            <g className="text-muted-foreground">
              {placed.map(({ index, x: lx }) => (
                <text key={index} x={lx} y={height - Math.ceil(fontPx * 0.35)} textAnchor="middle" fill="currentColor">{dayLabels[index]}</text>
              ))}
            </g>
          </svg>
        )}
      </div>

      {/* The same facts, behind the picture as a table. With no room to draw,
          they are shown instead — one block a day, not six columns, which
          would break every word at large text sizes. */}
      {drawable ? (
        <div className="sr-only">
          <table>
            <caption>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Back pain, 0 to 10</th>
                <th scope="col">Leg pain, 0 to 10</th>
                <th scope="col">Symptoms reached</th>
                <th scope="col">Session loading</th>
                <th scope="col">Worse during a session</th>
              </tr>
            </thead>
            <tbody>
              {table.map(r => (
                <tr key={r.day}>
                  <th scope="row">{formatDayShort(r.day, current)}</th>
                  <td>{r.back.length > 0 ? r.back.join(', ') : 'Not entered'}</td>
                  <td>{r.leg.length > 0 ? r.leg.join(', ') : 'Not entered'}</td>
                  <td>{r.reach ? REACH_LABELS[r.reach] : 'Not entered'}</td>
                  <td>{r.sessions.length > 0 ? r.sessions.join('; ') : 'No session'}</td>
                  <td>{r.worse ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section aria-label={caption} className="flex flex-col gap-3">
          <p className="text-muted-foreground">{caption}</p>
          <ol className="flex flex-col">
            {table.map(r => (
              <li key={r.day} className="flex flex-col gap-0.5 border-t border-separator py-2 first:border-t-0 first:pt-0">
                <span className="font-semibold">{formatDayShort(r.day, current)}</span>
                <span>Back pain {r.back.length > 0 ? r.back.join(', ') : 'not entered'} · Leg pain {r.leg.length > 0 ? r.leg.join(', ') : 'not entered'}</span>
                {r.reach && <span>Reached: {REACH_LABELS[r.reach]}</span>}
                {r.sessions.length > 0 && <span>Session: {r.sessions.join('; ')}</span>}
                {r.worse && <span className="font-semibold text-caution">Worse during a session</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </figure>
  );
}
