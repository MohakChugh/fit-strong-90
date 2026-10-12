import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { statusOn } from '@/health/status';
import { cn } from '@/lib/utils';
import { showBadge } from './badge';
import { prunePending, usePending, showReminders } from './pending';
import { ReminderBanner } from './ReminderBanner';
import { startReminders, type Runner } from './runner';
import { dailyTimes, stillDue, type ReminderContext } from './schedule';
import { msToNextMinute, wallTimeOf, type WallTime } from './time';
import { waterRecorded } from './water';
import { habitPrecautions } from './advice';
import { bannerPlace, skipsReminders } from './place';

/** Just after the minute turns, so the new minute is the one read. */
const PAST_THE_MINUTE_MS = 25;

/**
 * Runs the in-app reminders for the whole app: mount it once, inside the
 * router. It reads everything it needs from the store — the habits, the
 * profile (for the fluid-limit rule), today's water, and the D25 Status that
 * Today sets, which quiets every prompt on a day that is not Normal.
 */
export function ReminderHost() {
  const { status: storage, settings, profile, observations } = useStore();
  const habits = settings.habits;
  const periods = settings.statusPeriods;
  const pending = usePending();
  const { pathname } = useLocation();
  // During a session or a live walk a prompt to stand or walk is noise: one
  // that comes due there is skipped, not saved for later. Today shows the
  // waiting reminder in its own place, so no banner floats there either.
  const place = bannerPlace(pathname);
  const focused = skipsReminders(pathname);
  // Banners that stepped out of view by themselves; their reminders still wait.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const hide = useCallback((id: string) => setHidden(previous => new Set(previous).add(id)), []);

  const runner = useRef<Runner | undefined>(undefined);
  const route = useRef(focused);
  const [now, setNow] = useState<WallTime>(() => wallTimeOf(new Date()));

  // What the reminders are checked against, as things are now.
  const current = useMemo<ReminderContext>(() => ({
    habits,
    profile,
    status: day => statusOn(periods, day),
    waterOn: day => waterRecorded(day, observations),
  }), [habits, profile, periods, observations]);
  // Read fresh by the runner on every check, so a glass logged a moment ago
  // counts towards the goal without restarting anything.
  const context = useRef(current);
  useEffect(() => {
    context.current = current;
    route.current = focused;
  }, [current, focused]);

  // The clock the waiting reminders are judged by. It moves on as each minute
  // turns — where quiet hours and days begin — so a banner already showing
  // goes the moment it may not show, not some seconds later (N07).
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const look = () => setNow(previous => {
      const next = wallTimeOf(new Date());
      return next.day === previous.day && next.minute === previous.minute ? previous : next;
    });
    const tick = () => {
      look();
      id = setTimeout(tick, msToNextMinute(Date.now()) + PAST_THE_MINUTE_MS);
    };
    id = setTimeout(tick, msToNextMinute(Date.now()) + PAST_THE_MINUTE_MS);
    document.addEventListener('visibilitychange', look);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', look);
    };
  }, []);

  // A reminder already waiting must not outlive a change that would stop it
  // showing now — a fluid limit or not knowing, a habit turned off, a day that
  // is no longer Normal, quiet hours, a goal met, a new day. Only what is
  // waiting goes; the water the person recorded stays.
  const waiting = useMemo(() => pending.filter(p => stillDue(p.occurrence, now, current)), [pending, now, current]);
  useEffect(() => {
    prunePending(p => stillDue(p.occurrence, now, current));
  }, [pending, now, current]);

  useEffect(() => {
    if (storage !== 'ready') return;
    const started = startReminders({
      now: () => new Date(),
      context: () => context.current,
      show: due => {
        if (!route.current) showReminders(due);
        setNow(wallTimeOf(new Date()));
      },
      later: (run, ms) => {
        const id = setTimeout(run, ms);
        return () => clearTimeout(id);
      },
    });
    runner.current = started;
    // iOS freezes timers while the app is off screen; look as soon as it is back.
    const wake = () => {
      if (document.visibilityState === 'visible') started.check();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    return () => {
      started.stop();
      runner.current = undefined;
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('focus', wake);
    };
  }, [storage]);

  // A changed schedule or Status starts the count again from now, so turning
  // a habit on, or coming back to Normal, never replays a reminder from the past.
  const schedule = useMemo(
    () => JSON.stringify([periods ?? [], habits?.inApp, dailyTimes(habits, profile)]),
    [periods, habits, profile],
  );
  useEffect(() => {
    runner.current?.restart();
  }, [schedule]);

  // The icon shows what is waiting. On a fresh start that is nothing, which
  // also clears a badge left behind by a previous run.
  useEffect(() => {
    showBadge(waiting.length);
  }, [waiting.length]);

  const top = focused ? undefined : waiting.find(p => !hidden.has(p.occurrence.id));
  const water = habits?.water;

  // The live region is always in the page, so a banner arriving in it is announced.
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-40 px-3',
        // Never over navigation: just above the tab bar, or the sidebar's
        // content area on a wide screen, or above the bottom safe area.
        place === 'aboveTabBar'
          ? 'bottom-[calc(3.0625rem+env(safe-area-inset-bottom)+0.5rem)] lg:bottom-[calc(env(safe-area-inset-bottom)+1rem)] lg:left-60'
          : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]',
      )}
    >
      {top && place !== 'hidden' && (
        <ReminderBanner
          key={top.occurrence.id}
          item={top}
          onHide={hide}
          {...(water?.glassMl ? { glassMl: water.glassMl } : {})}
          {...(top.occurrence.habit === 'water' ? waterProgress(water?.dailyGoalMl, waterRecorded(top.occurrence.day, observations)) : {})}
          precautions={habitPrecautions(top.occurrence.habit, profile, habits)}
        />
      )}
    </div>
  );
}

/** Progress towards the user's own goal. A day with nothing recorded says so, never "0 ml". */
function waterProgress(goal: number | undefined, had: number | undefined): { waterLine?: string } {
  if (!goal) return {};
  return {
    waterLine: had === undefined
      ? `Not entered today. Your goal is ${goal.toLocaleString()} ml.`
      : `${had.toLocaleString()} of ${goal.toLocaleString()} ml today`,
  };
}
