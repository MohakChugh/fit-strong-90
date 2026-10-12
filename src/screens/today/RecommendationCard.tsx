import { useId } from 'react';
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import type { Recommendation, RecommendationAction } from '@/health/recommend';
import { cn } from '@/lib/utils';

const CAUTION = new Set<Recommendation['kind']>(['seekHelp', 'recheck', 'hold']);

/** Health guidance carries its boundary next to it, not only in settings. */
const ADVICE = new Set<Recommendation['kind']>(['emergency', 'seekHelp', 'recheck', 'hold', 'mealWalk']);

const primaryButton = 'press-feedback flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-center text-[length:var(--text-body)] font-semibold';

/**
 * The one suggestion: a large title, what it is, why it was chosen — always
 * on screen (D20) — and one button. A stop replaces the movement button
 * rather than sitting beside it, and says so in words as well as colour.
 *
 * When the suggestion is worked out again while the screen is open (a
 * check-in, a new status), `revision` changes: the new words fade in inside
 * a live region that stays put, so a screen reader hears them, and the button
 * stays mounted, so focus returning from a sheet still has somewhere to land.
 */
export function RecommendationCard({ recommendation: r, eyebrow, revision, changed, onAct }: {
  recommendation: Recommendation;
  eyebrow: string;
  revision: string;
  changed: boolean;
  onAct: (action: RecommendationAction) => void;
}) {
  const titleId = useId();
  const emergency = r.kind === 'emergency';
  const caution = CAUTION.has(r.kind) && r.action.to !== '/you/profile';
  const Icon = emergency ? SirenIcon : caution ? TriangleAlertIcon : undefined;

  return (
    <section aria-labelledby={titleId} className="flex flex-col">
      <h2 className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</h2>
      <div className="flex flex-col gap-4 rounded-2xl bg-grouped-card p-5">
        <div aria-live="polite">
          <div key={revision} className={cn('flex flex-col gap-2', changed && 'animate-fade-in')}>
            <h3
              id={titleId}
              className={cn(
                'flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight',
                emergency && 'text-stop',
                caution && 'text-caution',
              )}
            >
              {Icon && <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />}
              <span className="min-w-0">{r.title}</span>
            </h3>
            {r.detail && <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{r.detail}</p>}
            <p className="text-[length:var(--text-subhead)] leading-snug">
              <span className="font-semibold">Why this? </span>
              {r.reason}
            </p>
          </div>
        </div>
        <Action action={r.action} emergency={emergency} onAct={onAct} />
        {ADVICE.has(r.kind) && r.action.to !== '/you/profile' && (
          <p className="-mt-1 text-[length:var(--text-footnote)] text-muted-foreground">General information, not medical advice.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Always one button element, whatever the action: when the suggestion is
 * worked out again under an open sheet, the same element stays, so focus
 * returning from the sheet still lands on it.
 */
function Action({ action, emergency, onAct }: { action: RecommendationAction; emergency: boolean; onAct: (a: RecommendationAction) => void }) {
  // In an emergency the thing to do is call for help, which the title says;
  // the check-in button is only for an answer given by mistake, so it is quiet.
  const tone = emergency ? 'bg-stop/10 text-stop' : 'bg-tint text-on-tint';
  return (
    <button type="button" onClick={() => onAct(action)} className={cn(primaryButton, tone)}>
      {action.label}
    </button>
  );
}
