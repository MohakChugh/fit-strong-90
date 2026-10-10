import { useEffect, useId, useRef, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import type { StatusPeriod } from '@/types';
import { Sheet } from '@/components/hig/Sheet';
import { Group, Row } from '@/components/hig/List';
import { isDay } from '@/health/observation';
import { STATUS_LABEL, answerShift, changeStatus, periodOn, planOffer, shiftStartDate, type PlanOffer, type Status } from '@/health/status';
import { setSettings } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { during } from './model';

const ORDER: Status[] = ['normal', 'flare', 'unwell', 'away'];

const MEANING: Record<Status, string> = {
  normal: 'The usual suggestions.',
  flare: 'Back or leg worse: gentle movement only.',
  unwell: 'Rest. Nothing is suggested.',
  away: 'Nothing is suggested.',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from "I’m back" or "I feel better": Normal is already chosen. */
  preset?: 'normal';
  today: string;
  periods: StatusPeriod[] | undefined;
  /** `settings.startDate`; empty when there is no programme to move. */
  startDate: string;
}

/**
 * Normal, Flare-up, Unwell or Away, with an optional end date (D25). Coming
 * back to Normal from days that paused the programme offers to move the plan
 * back by them, here and then; closing the sheet leaves the offer on Today.
 */
export function StatusSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title="Status" detent="large">
      {/* Mounted per opening, so it always starts from the status in force. */}
      {props.open && <StatusBody {...props} onDone={() => props.onOpenChange(false)} />}
    </Sheet>
  );
}

const buttonBase = 'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-[length:var(--text-body)] font-semibold disabled:opacity-50';

function StatusBody({ preset, today, periods, startDate, onDone }: Props & { onDone: () => void }) {
  const current = periodOn(periods, today);
  const [choice, setChoice] = useState<Status>(preset ?? current?.kind ?? 'normal');
  const [until, setUntil] = useState(current?.to ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The periods just written travel with the offer, so the answer is recorded into exactly those.
  const [offer, setOffer] = useState<{ offer: PlanOffer; periods: StatusPeriod[] }>();
  const untilId = useId();
  const errorId = useId();

  if (offer) {
    return <MovePlanBack offer={offer.offer} periods={offer.periods} startDate={startDate} takeFocus onAnswered={onDone} />;
  }

  const apply = async () => {
    const end = choice === 'normal' || until === '' ? undefined : until;
    if (end !== undefined && (!isDay(end) || end < today)) {
      setError('Choose today or a later day for the end date.');
      return;
    }
    const change = changeStatus(periods, choice, today, end);
    if (!change.changed) {
      onDone();
      return;
    }
    setBusy(true);
    const result = await setSettings({ statusPeriods: change.periods });
    setBusy(false);
    if (!result.ok) {
      setError(result.failure.message);
      return;
    }
    const pending = planOffer(change.periods, startDate, today);
    if (pending) setOffer({ offer: pending, periods: change.periods });
    else onDone();
  };

  const unchanged = choice === (current?.kind ?? 'normal') && (choice === 'normal' || until === (current?.to ?? ''));
  const label = unchanged ? 'Done' : choice === 'normal' ? 'Back to normal' : `Set to ${STATUS_LABEL[choice]}`;

  return (
    <>
      <div role="radiogroup" aria-label="Status">
        <Group footer="Days with a status are left out of your weekly count.">
          {ORDER.map(status => (
            <Row
              key={status}
              role="radio"
              aria-checked={choice === status}
              label={STATUS_LABEL[status]}
              detail={MEANING[status]}
              onClick={() => { setChoice(status); setError(undefined); }}
              accessory={<CheckIcon className={cn('size-5 shrink-0 text-tint', choice !== status && 'invisible')} aria-hidden />}
            />
          ))}
        </Group>
      </div>

      {choice !== 'normal' && (
        <Group header="Until" footer="Optional. Leave it empty if you’re not sure; you can change it any time.">
          <label htmlFor={untilId} className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5">
            <span className="min-w-0 flex-1 text-[length:var(--text-body)]">End date</span>
            <input
              id={untilId}
              type="date"
              min={today}
              value={until}
              aria-describedby={error ? errorId : undefined}
              onChange={e => { setUntil(e.target.value); setError(undefined); }}
              className="min-h-11 min-w-0 rounded-lg bg-transparent text-right text-[length:var(--text-body)] text-tint outline-none focus-visible:ring-2 focus-visible:ring-tint"
            />
          </label>
          {until !== '' && <Row label="No end date" className="text-tint" onClick={() => setUntil('')} />}
        </Group>
      )}

      {error && <p id={errorId} role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{error}</p>}

      <button type="button" disabled={busy} onClick={() => void apply()} className={cn(buttonBase, 'bg-tint text-on-tint')}>
        {busy ? 'Saving…' : label}
      </button>
    </>
  );
}

/**
 * "Move your plan back N days?" (D25): made once a status run is over, in the
 * sheet at the moment of coming back and on Today until it is answered. Both
 * answers carry the same weight, since neither is the safe default, and both
 * are recorded on the run so it is never asked again. Moving the start date
 * and recording that are one write.
 */
export function MovePlanBack({ offer, periods, startDate, takeFocus = false, onAnswered }: {
  offer: PlanOffer;
  /** The periods as stored, which the answer is recorded into. */
  periods: StatusPeriod[] | undefined;
  startDate: string;
  /** Take focus on arrival, as it does in place of the sheet's choices. */
  takeFocus?: boolean;
  onAnswered?: () => void;
}) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const question = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (takeFocus) question.current?.focus();
  }, [takeFocus]);
  const n = offer.days === 1 ? '1 day' : `${offer.days} days`;

  const answer = async (moved: boolean) => {
    setBusy(true);
    const result = await setSettings({
      statusPeriods: answerShift(periods, offer.run, moved ? 'moved' : 'kept'),
      ...(moved ? { startDate: shiftStartDate(startDate, offer.days) } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.failure.message);
      return;
    }
    onAnswered?.();
  };

  const button = 'press-feedback flex min-h-11 w-full items-center justify-center rounded-lg bg-tint/10 px-3 py-2 text-[length:var(--text-body)] font-semibold text-tint disabled:opacity-50';
  return (
    <Group header="Welcome back" footer="Your history stays as it is. Only the week your plan is in changes.">
      <div className="flex flex-col gap-3 px-4 py-3">
        <p ref={question} tabIndex={-1} className="text-[length:var(--text-body)] leading-snug outline-none">
          {during(offer.run)}, your plan moved on {n}. Move your plan back {n}, so you pick up where you left off?
        </p>
        {error && <p role="alert" className="text-[length:var(--text-subhead)] text-stop">{error}</p>}
        {/* Stacked: each answer reads whole, on one line where it fits. */}
        <div className="flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={() => void answer(true)} className={button}>
            Move my plan back {n}
          </button>
          <button type="button" disabled={busy} onClick={() => void answer(false)} className={button}>
            Keep my plan as it is
          </button>
        </div>
      </div>
    </Group>
  );
}
