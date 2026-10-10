import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fitView, linePaths } from '@/walk/route';
import type { RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route in the history (journey §9.5, B-23): our own small drawing,
 * never a map picture. It grows into the detail's frame (M14), except under
 * Reduce Motion, where neither carries the shared name, as Home's tiles do.
 */
export function RouteThumb({ walkId, route }: { walkId: string; route: Pick<RouteRecord, 'segments' | 'bbox'> }) {
  const reduce = useReducedMotion();
  const view = fitView(route.bbox, 64, 64, 6);
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-7" style={reduce ? undefined : { viewTransitionName: `route-${walkId}` }}>
      {linePaths(route.segments, view).map((d, i) => (
        <path key={route.segments[i]?.start ?? i} d={d} fill="none" className="stroke-tint" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
