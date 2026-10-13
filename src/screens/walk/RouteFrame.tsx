import { useMemo, useState } from 'react';
import { TARGET } from '@/components/hig/targets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { fitView, zoomed, VIEW_SIZE, type View } from '@/walk/route';
import type { Bbox, RouteLine } from '@/walk/routeRecord';
import { ATTRIBUTION, mapUnavailable } from '@/walk/tiles';
import { RouteView } from './RouteView';
import { StaticMap } from './StaticMap';

// Each at least 48 × 48 px, 12 px apart (journey §20.4 rule 1, H6-11).
const CONTROL = cn('press-feedback rounded-lg bg-grouped-card px-2 text-[length:var(--text-subhead)] font-semibold text-tint', TARGET.tap);

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
      <div className={cn('flex flex-wrap items-center justify-between rounded-xl bg-grouped-card p-4', TARGET.gap)}>
        <p className="text-[length:var(--text-body)] text-muted-foreground">Map hidden</p>
        <button type="button" className={CONTROL} onClick={() => setHidden(false)}>Show map</button>
      </div>
    );
  }
  return (
    <div className={cn('@container flex flex-col', TARGET.gap)}>
      <RouteView view={view} lines={lines} ends grid={!pictures} label="Your route" {...(reduce ? {} : { transitionName: `route-${walkId}` })}>
        {pictures && <StaticMap view={view} onFail={() => setFailed(true)} />}
      </RouteView>
      {pictures && (
        <a href={ATTRIBUTION.href} target="_blank" rel="noopener" className={cn('inline-flex items-center justify-end self-end px-1 text-[length:var(--text-footnote)] text-tint underline', TARGET.tap)}>
          {ATTRIBUTION.text}
        </a>
      )}
      {mapOn && !pictures && <p role="status" className="text-[length:var(--text-footnote)] text-muted-foreground">{mapUnavailable(!online)}</p>}
      {/* Four in a row only where four fit at this text size, two where two do, and one under another at the
          largest sizes on a small phone: never squeezed under 48 px, and every word whole ("Recentre"). */}
      <div className={cn('grid grid-cols-1 @min-[16rem]:grid-cols-2 @min-[23rem]:grid-cols-4', TARGET.gap)}>
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, 1))}>Zoom in</button>
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, -1))}>Zoom out</button>
        <button type="button" className={CONTROL} onClick={() => setView(fit)}>Recentre</button>
        <button type="button" className={CONTROL} onClick={() => setHidden(true)}>Hide map</button>
      </div>
    </div>
  );
}
