import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import { permission, type Mode, type Permission } from '@/engine/permission';
import { CheckInSheet } from './CheckInSheet';
import { startDecision } from './start';

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

  // Asked at the moment of use, so a reading's freshness is judged against
  // the time the person actually taps Start.
  const permissionFor = useCallback(
    (mode: Mode) => permission({ profile, checkIn, now: new Date(), recent }, mode),
    [profile, checkIn, recent],
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
