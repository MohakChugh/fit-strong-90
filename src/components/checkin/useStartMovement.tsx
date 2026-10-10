import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import type { Mode, Permission } from '@/engine/permission';
import { nextBoundary } from '@/health/recommend';
import { useClock, useWakeAt } from '@/screens/today/clock';
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

  const start = useCallback((mode: Mode, href: string, startLabel: string) => {
    if (startDecision(permissionFor(mode)) === 'go') navigate(href, { viewTransition: true });
    else setTarget({ mode, href, startLabel });
  }, [permissionFor, navigate]);

  const sheet = (
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
        if (t) navigate(t.href, { viewTransition: true });
      }}
    />
  );

  return { start, sheet, permissionFor };
}
