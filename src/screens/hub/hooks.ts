/**
 * What every movement hub asks of the app, once (journey §4.2, §7.5): the
 * shared gate for its mode, read as Home's card reads it (`gateOf`); the
 * tile's own words for it (`movementLine`, called exactly as Home's `lineOf`
 * calls it); status and enrolment; and the one way to start
 * (`useStartMovement`). Worked out again at each time boundary, as Home is,
 * so the words never go stale (L-07, B-20).
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { profileGaps } from '@/engine/health';
import type { Mode } from '@/engine/permission';
import { gateOf, isEnrolled, nextBoundary, recommend } from '@/health/recommend';
import { periodOn, type Status } from '@/health/status';
import { useGuided } from '@/hooks/useGuided';
import { prefersHour12 } from '@/lib/time';
import { normalLine } from '@/screens/home/model';
import { movementLine } from '@/screens/home/tileLine';
import { recommendSources, withEffectiveToday } from '@/screens/home/urgent';
import { useSafetyLeft } from '@/screens/setup/useSetup';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { useStore } from '@/store/useStore';

/** The device's clock preference does not change while the app is open. */
const HOUR12 = prefersHour12();

export function useHubGate(mode: Mode) {
  const state = useStore();
  const guided = useGuided();
  const { start, sheet, permissionFor } = useStartMovement();
  const { now } = useClock();
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(state.settings.habits ? { habits: state.settings.habits } : {}) }));
  const permissions = { guided: permissionFor('guided'), stretch: permissionFor('stretch'), walk: permissionFor('walk') };
  const today = format(now, 'yyyy-MM-dd');
  const status: Status = periodOn(state.settings.statusPeriods, today)?.kind ?? 'normal';
  const enrolled = isEnrolled(state.settings, state.profile);
  // While setup is unfinished, the gap names the safety chapter it still asks (K5-07).
  const left = useSafetyLeft();
  const gaps = { ...profileGaps(guided.profile), ...(left ? { ask: left.ask } : {}) };
  const profileGap = gaps.healthUnreviewed || gaps.medicinesUnknown;
  const recommendation = recommend({ ...recommendSources({ now, state, plan: guided.plan, checkIns }), permissions });
  const gate = gateOf(permissions[mode], guided.checkIn, profileGap);
  const stretchGate = gateOf(permissions.stretch, guided.checkIn, profileGap);
  const recheckAt = guided.checkIn?.readiness.recheckAt;
  const line = movementLine({
    mode, permission: permissions[mode], status, enrolled, normal: normalLine(mode, { recommendation, enrolled, plan: guided.plan }),
    ...(recheckAt ? { recheckAt } : {}), now, hour12: HOUR12, ...(left ? { gapChapter: left.chapter } : {}),
  });
  return {
    guided, state, now, today, status, enrolled, gaps, gate, line, recommendation, start, sheet, hour12: HOUR12,
    permission: permissions[mode],
    stretchOpen: stretchGate === 'go' || stretchGate === 'checkIn',
  };
}

/** Where a hub's rows say they were opened from, so the screen each opens goes Back to this hub, named after it. */
export function useHubOrigin(label: string): { path: string; label: string; search?: string } {
  const { pathname, search } = useLocation();
  return { path: pathname, label, ...(search ? { search } : {}) };
}

/**
 * A link's `?add=` opens the hub's own form (D55): on arrival, and whenever a
 * new link reaches the hub while it is already open, as from its own
 * reminder or a Learn card (codex H2-06). Then the address lets it go.
 * `accepts` keeps refusing another metric's form.
 */
export function useAddLink(accepts: (add: string | null) => boolean): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const add = params.get('add');
  const [open, setOpen] = useState(() => accepts(add));
  // The address lets each link go once handled, so a link there now is a new one, the same link again included:
  // its form opens in that render, as on arrival. (An address's own key can't tell: a hash typed or set by
  // another page arrives with none.)
  const [handled, setHandled] = useState(add);
  if (add !== handled) {
    setHandled(add);
    if (add !== null && accepts(add)) setOpen(true);
  }
  useEffect(() => {
    if (!params.has('add')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [params, setParams]);
  return [open, setOpen];
}
