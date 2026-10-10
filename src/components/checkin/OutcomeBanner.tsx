import { CircleCheckIcon, CirclePauseIcon, OctagonAlertIcon, SirenIcon } from 'lucide-react';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import { SGLT2_UNRECORDED } from '@/engine/health';
import { CANNOT_SWALLOW, TREAT } from '@/engine/readiness';
import type { Readiness } from '@/types/checkin';
import { cn } from '@/lib/utils';
import { timeOf } from '@/lib/time';
import { headline, recheckCountdown } from './copy';

const ICON = { emergency: SirenIcon, today: OctagonAlertIcon, hold: CirclePauseIcon, adjust: CircleCheckIcon, reassure: CircleCheckIcon };

/** The re-check time, written as the whole app writes times (J2-14). */
const clock = (t: number): string => timeOf(t);

/**
 * Shown with every 15 g instruction, in the words the player and the walk
 * use: nothing by mouth for someone who cannot swallow safely, and the call (E-HYPO).
 */
export function CannotSwallow() {
  return (
    <div className="flex flex-col gap-0.5 text-[length:var(--text-subhead)] leading-snug">
      <p className="font-semibold">{CANNOT_SWALLOW.title}</p>
      <p>{CANNOT_SWALLOW.line}</p>
      <p><span className="font-semibold text-stop">{PERMISSION_TEXT.emergencyTitle}.</span> {PERMISSION_TEXT.emergencyCall}</p>
    </div>
  );
}

/**
 * Today's answer for one mode: one clear statement, the reason, and what to
 * do. Words always carry the meaning; colour only repeats it.
 */
export function OutcomeBanner({ permission: p, readiness, now }: { permission: Permission; readiness?: Readiness; now: Date }) {
  const h = headline(p);
  const Icon = ICON[p.disposition];
  const [first, ...rest] = p.reasons;
  const countdown = recheckCountdown(p, readiness, now);
  const actions = readiness?.actions ?? [];
  const treats = [...p.reasons, ...actions].some(t => t.includes(TREAT));
  const stop = h.tone === 'stop';
  // A reason only the profile can answer comes with the way there.
  const toProfile = p.reasons.some(r => r === PERMISSION_TEXT.healthUnreviewed || r === PERMISSION_TEXT.medicinesUnknown || r === SGLT2_UNRECORDED);

  return (
    <section
      role={p.disposition === 'emergency' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-xl bg-grouped-card p-4', stop && 'ring-2 ring-stop')}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn('mt-0.5 size-7 shrink-0', stop ? 'text-stop' : h.tone === 'caution' ? 'text-caution' : 'text-tint')} />
        <h2 className={cn('text-[length:var(--text-title-2)] font-bold leading-tight', stop && 'text-stop')}>{h.title}</h2>
      </div>

      {p.disposition === 'emergency' && <p className="text-[length:var(--text-body)] font-semibold">{PERMISSION_TEXT.emergencyNoExercise}</p>}

      {first && <p className="text-[length:var(--text-body)] leading-snug">{first}</p>}
      {rest.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          {rest.map(r => <li key={r}>{r}</li>)}
        </ul>
      )}

      {countdown && (
        <p aria-live="polite" className="numeric text-[length:var(--text-body)] font-semibold">
          Re-check at {clock(countdown.due)}, in {countdown.minutes} {countdown.minutes === 1 ? 'minute' : 'minutes'}.
        </p>
      )}

      {toProfile && (
        <a href="#/you/profile" className="press-feedback flex min-h-11 items-center self-start rounded-lg bg-muted px-3 text-[length:var(--text-body)] font-semibold text-tint">
          Open Profile and health
        </a>
      )}

      {p.release && (
        <div className="flex flex-col gap-0.5">
          <p className="text-[length:var(--text-footnote)] font-semibold uppercase tracking-wide text-muted-foreground">What changes this</p>
          <p className="text-[length:var(--text-subhead)] leading-snug">{p.release}</p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[length:var(--text-footnote)] font-semibold uppercase tracking-wide text-muted-foreground">{p.allowed ? 'Before you start' : 'Now'}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[length:var(--text-subhead)] leading-snug">
            {actions.map(a => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {treats && <CannotSwallow />}

      {p.allowed && p.restrictions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[length:var(--text-footnote)] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[length:var(--text-subhead)] leading-snug">
            {p.restrictions.map(r => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      <p className="text-[length:var(--text-footnote)] text-muted-foreground">General information, not medical advice.</p>
    </section>
  );
}
