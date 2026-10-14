import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HubSection } from './HubFrame';
import type { HubActionKind, HubCard } from './movement';
import { UnsavedClinical } from '@/components/profile/UnsavedClinical';

/**
 * A movement hub's Right now card (journey §8.2): what is on offer and why,
 * or, while the gate refuses, its words and the safe action (§7.5). The gate's
 * sentences sit in a status region. Urgent ink and the safe action are there
 * in the first frame, with no entrance (motion rule 2). One primary action,
 * at least 60 px tall; the quieter ones at least 48 px.
 */
export function MovementCard({ card, onAction }: { card: HubCard; onAction: (kind: HubActionKind) => void }) {
  const Icon = card.tone === 'stop' ? SirenIcon : card.tone === 'caution' ? TriangleAlertIcon : undefined;
  const primary = card.primary;
  return (
    <HubSection title="Right now">
      <div data-hub-card={card.state} className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
        <h3 className={cn(
          'flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word]',
          card.tone === 'stop' && 'text-stop', card.tone === 'caution' && 'text-caution',
        )}>
          {Icon && <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />}
          <span className="min-w-0">{card.title}</span>
        </h3>
        {card.detail && <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{card.detail}</p>}
        {card.today && <p className="text-[length:var(--text-body)] font-medium leading-snug [overflow-wrap:break-word]">{card.today}</p>}
        {card.reason && (
          <p className="text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word]">
            <span className="font-semibold">Why this? </span>{card.reason}
          </p>
        )}
        {(card.reasons.length > 0 || card.release) && (
          <div role="status" className="flex flex-col gap-2 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">
            {card.reasons.map(r => <p key={r}>{r}</p>)}
            {card.release && <p className="text-muted-foreground">{card.release}</p>}
          </div>
        )}
        {/* A clinical save the device refused: the way out of the pause, kept as the hold lifts (board D197). */}
        {card.tone !== 'stop' && <UnsavedClinical />}
        {card.restrictions.length > 0 && (
          <ul aria-label="Changes for today" className="flex list-disc flex-col gap-1.5 pl-5 text-[length:var(--text-body)] leading-snug">
            {card.restrictions.map(r => <li key={r}>{r}</li>)}
          </ul>
        )}
        {primary && (
          <button
            type="button"
            disabled={primary.disabled}
            onClick={() => onAction(primary.kind)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center rounded-xl bg-tint px-4 text-center text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50"
          >
            {primary.label}
          </button>
        )}
        {card.note && <p className="text-center text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{card.note}</p>}
        {card.secondary.map(a => (
          <button
            key={a.kind}
            type="button"
            onClick={() => onAction(a.kind)}
            className="press-feedback flex min-h-12 w-full items-center justify-center rounded-xl bg-tint/10 px-4 text-center text-[length:var(--text-body)] font-semibold text-tint"
          >
            {a.label}
          </button>
        ))}
      </div>
    </HubSection>
  );
}
