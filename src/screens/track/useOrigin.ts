import { useLocation, useNavigate } from 'react-router-dom';
import { cameFrom } from '@/components/hig/navigation';
import type { Origin } from './MyDay';

/** A detail screen opened with no way back named, from a bookmark say, goes back to Today's log (kiro FK-07). */
const TODAYS_LOG: Origin = { path: '/day/today', label: 'Today’s log' };

/**
 * Where this detail screen came from, a Back for the bar, and a way back that
 * behaves like it: pop the stack when the person came from that screen — so
 * it returns exactly as they left it — otherwise replace this entry with it,
 * at the address it had (`?day=`, `?view=`), not a bare path. `leave` is used
 * after deleting a record, when the screen has nothing left to show.
 */
export function useOrigin(fallback: Origin = TODAYS_LOG): { origin: Origin; back: { to: string; label: string }; leave: () => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as Partial<Origin> | null;
  const origin: Origin = state && typeof state.path === 'string' && typeof state.label === 'string'
    ? { path: state.path, label: state.label, ...(typeof state.search === 'string' ? { search: state.search } : {}) }
    : fallback;
  // The shell's Back pops only when `to` is exactly the path it came from, and
  // otherwise goes to `to` itself — so `to` carries the search only when there
  // is no entry to pop back to.
  const popsBack = cameFrom() === origin.path;
  const to = popsBack ? origin.path : `${origin.path}${origin.search ?? ''}`;
  const leave = () => {
    if (popsBack) navigate(-1);
    else navigate(to, { replace: true, viewTransition: true });
  };
  return { origin, back: { to, label: origin.label }, leave };
}
