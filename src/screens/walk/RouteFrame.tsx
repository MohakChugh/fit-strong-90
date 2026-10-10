import { useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fitView, zoomed, VIEW_SIZE, type View } from '@/walk/route';
import type { Bbox, RouteLine } from '@/walk/routeRecord';
import { ATTRIBUTION, mapUnavailable } from '@/walk/tiles';
import { RouteView } from './RouteView';
import { StaticMap } from './StaticMap';

const CONTROL = 'press-feedback min-h-11 rounded-lg bg-grouped-card px-2 text-[length:var(--text-subhead)] font-semibold text-tint';

/**
 * A finished walk's route (journey §9.5, M14): our drawing with its start and
 * end, fitted to the whole route, with Zoom in, Zoom out and Recentre. With
 * this phone's map pictures on and a connection, the view's tiles lie under
 * it. "Hide map" hides the route and every location (A-51), and nothing is
 * requested while it's hidden.
 */
export function RouteFrame({ walkId, lines, bbox, mapOn }: { walkId: string; lines: readonly RouteLine[]; bbox: Bbox; mapOn: boolean }) {
  const reduce = useReducedMotion();
  const fit = useMemo(() => fitView(bbox, VIEW_SIZE.w, VIEW_SIZE.h), [bbox]);
  const [view, setView] = useState<View>(fit);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const pictures = mapOn && online && !failed;

  if (hidden) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-grouped-card p-4">
        <p className="text-[length:var(--text-body)] text-muted-foreground">Map hidden</p>
        <button type="button" className={CONTROL} onClick={() => setHidden(false)}>Show map</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <RouteView view={view} lines={lines} ends grid={!pictures} label="Your route" {...(reduce ? {} : { transitionName: `route-${walkId}` })}>
        {pictures && <StaticMap view={view} onFail={() => setFailed(true)} />}
      </RouteView>
      {pictures && (
        <a href={ATTRIBUTION.href} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center self-end px-1 text-[length:var(--text-footnote)] text-tint underline">
          {ATTRIBUTION.text}
        </a>
      )}
      {mapOn && !pictures && <p role="status" className="text-[length:var(--text-footnote)] text-muted-foreground">{mapUnavailable(!online)}</p>}
      <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, 1))}>Zoom in</button>
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, -1))}>Zoom out</button>
        <button type="button" className={CONTROL} onClick={() => setView(fit)}>Recentre</button>
        <button type="button" className={CONTROL} onClick={() => setHidden(true)}>Hide map</button>
      </div>
    </div>
  );
}
