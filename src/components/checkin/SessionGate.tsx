import type { Permission } from '@/engine/permission';
import { STOP_UNANSWERED } from '@/engine/readiness';
import { OwnsUrgent } from '@/screens/home/UrgentBanner';
import type { Readiness } from '@/types/checkin';
import { OutcomeBanner } from './OutcomeBanner';
import { useSayWhatHappened } from './sayWhatHappened';

/**
 * Shown instead of the guided session or a stretch when today's answers do
 * not allow it to start or resume, in that mode's own words. When a
 * check-in would answer it, Check in is the way on: the shared check-in,
 * which asks again (kiro FK-02). An unanswered "I need to stop" is answered
 * by its own questions, the shared ones Home's surface opens, which this
 * screen draws in its place (K6R-03).
 */
export function SessionGate({ permission, readiness, now, onBack, backLabel = 'Back to Home', onCheckIn }: {
  permission: Permission;
  readiness?: Readiness;
  now: Date;
  onBack: () => void;
  /** Where Back goes, in its words: the screen the session came from, or Home. */
  backLabel?: string;
  /** Opens the shared check-in, for a refusal a check-in answers. */
  onCheckIn?: () => void;
}) {
  const stretch = permission.mode === 'stretch';
  const checkIn = permission.needsCheckIn ? onCheckIn : undefined;
  const say = useSayWhatHappened();
  const stop = permission.reasons.includes(STOP_UNANSWERED.reason) ? say : null;
  const main = 'press-feedback min-h-[3.75rem] w-full rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint';
  const other = 'press-feedback min-h-12 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-medium text-tint';
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      {/* The answer drawn here, whole: the task's shared surface steps aside only while it is the decision standing now (codex V1-03, W-01). */}
      <OwnsUrgent shows={permission} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
        <h1 className="sr-only">{stretch ? 'Stretch' : 'Guided session'}</h1>
        <OutcomeBanner permission={permission} readiness={readiness} now={now} />
        {permission.needsCheckIn && (
          <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">{`Check in first, then start the ${stretch ? 'stretch' : 'session'}.`}</p>
        )}
        {/* One main way on: the stop's questions first, as a stop outranks every hold, then Check in. */}
        {stop && <button type="button" onClick={stop} className={main}>Say what happened</button>}
        {checkIn && <button type="button" onClick={checkIn} className={stop ? other : main}>Check in</button>}
        <button type="button" onClick={onBack} className={stop || checkIn ? other : main}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
