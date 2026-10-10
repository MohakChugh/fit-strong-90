import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { fitView, gridLines, linePaths, liveView, toView, withPoint, zoomed, type View } from '@/walk/route';
import { bboxOf, type LatLon, type RouteLine } from '@/walk/routeRecord';

const CONTROL = 'press-feedback min-h-11 rounded-lg bg-grouped-card px-2 text-[length:var(--text-subhead)] font-semibold text-tint';

/**
 * Our own drawing of a route (journey §9.2, §9.5; M13, M14): one path per
 * line, never joined across a gap (A-48), on a plain grid or over the map
 * pictures passed as `children`.
 */
export function RouteView({ view, lines, here, ends = false, grid = true, label, className, transitionName, children }: {
  view: View;
  lines: readonly RouteLine[];
  /** The walker, on a live walk. */
  here?: LatLon;
  /** Start and end markers, once the walk is finished (M13). */
  ends?: boolean;
  /** The plain grid, when no map pictures lie under the drawing. */
  grid?: boolean;
  label: string;
  className?: string;
  /** The shared element the history's thumbnail grows into (M14). */
  transitionName?: string;
  children?: ReactNode;
}) {
  const g = grid ? gridLines(view) : undefined;
  const drawn = lines.filter(l => l.coords.length >= 2);
  const at = (p: LatLon) => toView(p[0], p[1], view);
  const first = drawn[0]?.coords[0];
  const last = drawn.at(-1)?.coords.at(-1);
  const dot = here ? at(here) : undefined;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl bg-grouped-card', className)}
      style={{ aspectRatio: `${view.w} / ${view.h}`, ...(transitionName ? { viewTransitionName: transitionName } : {}) }}
    >
      {children}
      <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-label={label} className="absolute inset-0 size-full">
        {g && (
          <g className="stroke-separator" strokeWidth={1}>
            {g.x.map(x => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={view.h} />)}
            {g.y.map(y => <line key={`y${y}`} x1={0} x2={view.w} y1={y} y2={y} />)}
          </g>
        )}
        {linePaths(drawn, view).map((d, i) => (
          <path key={drawn[i].start} d={d} fill="none" className="stroke-tint" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {ends && first && <circle cx={at(first).x} cy={at(first).y} r={6} className="fill-grouped-card stroke-tint" strokeWidth={3} />}
        {ends && last && <rect x={at(last).x - 6} y={at(last).y - 6} width={12} height={12} rx={2} className="fill-tint" />}
        {dot && <circle cx={dot.x} cy={dot.y} r={7} className="fill-tint stroke-grouped-card" strokeWidth={3} />}
      </svg>
    </div>
  );
}

/** `value`, changed at most once a second (K-08): the live drawing is redrawn no faster. */
function useEverySecond<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, last.current + 1000 - performance.now());
    const id = setTimeout(() => {
      last.current = performance.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(id);
  }, [value]);
  return shown;
}

/**
 * The live walk's route (journey §9.2, M13, B-29): the whole route kept in
 * view by stepping the scale, never by animating. Zoom in and Zoom out fix
 * the view where it is, and "Show whole route" fits it again. Under Reduce
 * Motion the view only moves on that button. Nothing here fetches a map
 * picture (D18).
 */
export function LiveRoute({ lines, here, waiting }: { lines: readonly RouteLine[]; here?: LatLon; waiting: string }) {
  const reduce = useReducedMotion();
  const shown = useEverySecond(useMemo(() => ({ lines, here }), [lines, here]));
  const [byHand, setByHand] = useState(false);
  const [view, setView] = useState<View>();
  const box = withPoint(bboxOf(shown.lines), shown.here);
  const next = liveView(view, box, reduce || byHand ? 'fixed' : 'auto');
  // Worked out from the last view, as the route grows: React's "information from previous renders" pattern.
  if (next !== view) setView(next);

  if (!next) {
    return (
      <p className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-center text-[length:var(--text-subhead)] text-muted-foreground">
        {waiting}
      </p>
    );
  }
  const zoom = (by: 1 | -1) => {
    setByHand(true);
    setView(zoomed(next, by));
  };
  const whole = () => {
    setByHand(false);
    if (box) setView(fitView(box, next.w, next.h));
  };
  return (
    <div className="flex flex-col gap-2">
      <RouteView view={next} lines={shown.lines} {...(shown.here ? { here: shown.here } : {})} label="Your route so far" />
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={CONTROL} onClick={() => zoom(1)}>Zoom in</button>
        <button type="button" className={CONTROL} onClick={() => zoom(-1)}>Zoom out</button>
        <button type="button" className={CONTROL} onClick={whole}>Show whole route</button>
      </div>
    </div>
  );
}
