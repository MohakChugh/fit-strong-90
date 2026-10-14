import { useViewTransitionState } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { recordPath } from '@/screens/track/timeline';
import { fitView, linePaths } from '@/walk/route';
import type { RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route in the history (journey §9.5, B-23): our own small drawing,
 * never a map picture. It grows into the detail's frame (M14), except under
 * Reduce Motion. It carries the shared name only while the router moves to or
 * from its walk's detail, as Home's tiles do, so a day of walks names one
 * thumbnail, never all (motion §7, D117). A list row draws its icon at 20 px,
 * so the line is 8 of the drawing's 64 units (about 2.5 px) to stay legible.
 */
export function RouteThumb({ walkId, route }: { walkId: string; route: Pick<RouteRecord, 'segments' | 'bbox'> }) {
  const reduce = useReducedMotion();
  const named = useViewTransitionState(recordPath({ type: 'walk', id: walkId })) && !reduce;
  const view = fitView(route.bbox, 64, 64, 6);
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-7" style={named ? { viewTransitionName: `route-${walkId}` } : undefined}>
      {linePaths(route.segments, view).map((d, i) => (
        <path key={route.segments[i]?.start ?? i} d={d} fill="none" className="stroke-tint" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
