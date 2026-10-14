import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import type { Mode, Permission } from '@/engine/permission';
import { nextBoundary } from '@/health/recommend';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { useWalkFlow } from '@/screens/walk/useWalkFlow';
import { freshLiveHref, walkPlanOf } from '@/walk/plan';
import { CheckInSheet } from './CheckInSheet';
import { gateFor, startDecision } from './start';

interface Target {
  mode: Mode;
  href: string;
  startLabel: string;
}

/**
 * The one way a screen starts Guided, Stretch or Walk.
 *
 * `start` goes straight to `href` when today's check-in already allows the
 * mode; otherwise it opens the check-in sheet for that mode, whose Start
 * button then goes to `href`. The caller renders `sheet` once. No screen
 * writes its own safety gate.
 *
 * A start to `/walk/live` is a walk: its first-walk questions and B-01's
 * start sequence run in place of the navigation (Plan 6).
 */
export function useStartMovement(): {
  start: (mode: Mode, href: string, startLabel: string) => void;
  sheet: ReactNode;
  permissionFor: (mode: Mode) => Permission;
} {
  // The effective records, earlier days included: a refused write, or what an
  // earlier day still asks of today, counts at every start (round 3 B01, B04).
  const { profile, date, checkIn, saveCheckIn, checkIns: recent } = useGuided();
  const navigate = useNavigate();
  const [target, setTarget] = useState<Target | null>(null);
  // What a screen shows from the gate is worked out again at the next time
  // boundary (a reading going stale, a re-check falling due, 04:00,
  // midnight) and when the app is opened again, as Home's words are (codex
  // V1-04, journey §4.1).
  const { now } = useClock();
  useWakeAt(nextBoundary(now, checkIn ? { checkIn } : {}));

  // Asked at the moment of use, so a reading's freshness is judged against
  // the time the person actually taps Start. A new clock reading is a new
  // question, for a screen that keeps its answer.
  const permissionFor = useCallback(
    (mode: Mode) => gateFor({ profile, checkIn, checkIns: recent }, mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, checkIn, recent, now],
  );

  // A walk's questions and start sequence (journey §9.1, B-01). A refusal that a check-in answers opens the sheet below.
  const walk = useWalkFlow(plan => setTarget({ mode: 'walk', href: freshLiveHref(plan), startLabel: 'Start walk' }));

  /** Where an allowed start goes: a walk through its own flow, in this tap; anything else straight to its screen. */
  const go = (href: string) => {
    const plan = walkPlanOf(href);
    if (plan) walk.begin(plan);
    else navigate(href, { viewTransition: true });
  };

  const start = (mode: Mode, href: string, startLabel: string) => {
    if (startDecision(permissionFor(mode)) === 'go') go(href);
    else setTarget({ mode, href, startLabel });
  };

  const sheet = (
    <>
    <CheckInSheet
      open={target !== null}
      onOpenChange={open => { if (!open) setTarget(null); }}
      profile={profile}
      date={date}
      initial={checkIn}
      recent={recent}
      onSave={saveCheckIn}
      mode={target?.mode ?? 'guided'}
      startLabel={target?.startLabel}
      onStart={() => {
        const t = target;
        setTarget(null);
        if (t) go(t.href);
      }}
    />
    {walk.ui}
    </>
  );

  return { start, sheet, permissionFor };
}
