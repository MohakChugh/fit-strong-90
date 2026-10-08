import type { Permission } from '@/engine/permission';
import type { Readiness } from '@/types/checkin';
import { OutcomeBanner } from './OutcomeBanner';

/**
 * Shown instead of the guided session when today's answers do not allow it
 * to start or resume. The way on is the check-in on Today, which asks again.
 */
export function SessionGate({ permission, readiness, now, onBack }: {
  permission: Permission;
  readiness?: Readiness;
  now: Date;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
        <h1 className="sr-only">Guided session</h1>
        <OutcomeBanner permission={permission} readiness={readiness} now={now} />
        {permission.needsCheckIn && (
          <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Check in again from Today, then start the session.</p>
        )}
        <button type="button" onClick={onBack}
          className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint">
          Back to Today
        </button>
      </div>
    </div>
  );
}
