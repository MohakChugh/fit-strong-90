import type { Permission } from '@/engine/permission';
import { OwnsUrgent } from '@/screens/home/UrgentBanner';
import type { Readiness } from '@/types/checkin';
import { OutcomeBanner } from './OutcomeBanner';

/**
 * Shown instead of the guided session or a stretch when today's answers do
 * not allow it to start or resume, in that mode's own words. When a
 * check-in would answer it, Check in is the way on: the shared check-in,
 * which asks again (kiro FK-02).
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
        {checkIn && (
          <button type="button" onClick={checkIn}
            className="press-feedback min-h-[3.75rem] w-full rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint">
            Check in
          </button>
        )}
        <button type="button" onClick={onBack}
          className={checkIn
            ? 'press-feedback min-h-12 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-medium text-tint'
            : 'press-feedback min-h-[3.75rem] w-full rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint'}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
