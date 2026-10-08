import { useState, type ReactNode } from 'react';
import { MinusIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { secondsLeft } from '@/hooks/useTimer';
import { Stat } from '@/components/hig/Stat';
import { readCount, readWeight, stepCount, stepWeight, unitLabel, weightText } from './entry';
import { restLeftMs, type Rest } from './model';
import { useNow } from './useNow';

/** The one primary action on a screen. */
export const primary = 'press-feedback flex min-h-14 w-full items-center justify-center rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50';
/** A secondary action, quieter but still a full-size target. */
export const secondary = 'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-medium text-tint';
/** A plain text action inside a card. */
export const quiet = 'press-feedback inline-flex min-h-11 items-center px-1 text-[length:var(--text-body)] text-tint';

/** A caution or stop message, always with words and an icon, never colour alone. */
export function Notice({ tone, title, children, role = 'status' }: {
  tone: 'caution' | 'stop';
  title: string;
  children?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div role={role} className="flex gap-3 rounded-xl bg-grouped-card p-4">
      <TriangleAlertIcon className={cn('mt-0.5 size-5 shrink-0', tone === 'stop' ? 'text-stop' : 'text-caution')} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1 text-[length:var(--text-subhead)] leading-snug">
        <p className="font-semibold text-[length:var(--text-body)]">{title}</p>
        {children}
      </div>
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    // A fixed touch size, so at large text the field grows rather than the buttons crowding it out.
    <button type="button" aria-label={label} onClick={onClick}
      className="press-feedback flex size-[48px] shrink-0 items-center justify-center rounded-full bg-grouped-bg text-tint [&_svg]:size-5">
      {children}
    </button>
  );
}

/**
 * A number with large minus and plus buttons either side of a field you can
 * also type into. The field has no `type` attribute on purpose: the old
 * global rule pins number inputs to 16 px, and this one is meant to be read at
 * arm's length between sets.
 */
export function NumberStepper({ id, label, noun, value, onChange, onStep, inputMode }: {
  id: string;
  label: string;
  /** For the buttons' names, e.g. "reps": "Fewer reps", "More reps". */
  noun: string;
  value: string;
  onChange: (text: string) => void;
  onStep: (direction: 1 | -1) => void;
  inputMode: 'numeric' | 'decimal';
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[length:var(--text-footnote)] text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <StepButton label={`Less ${noun}`} onClick={() => onStep(-1)}><MinusIcon /></StepButton>
        <input
          id={id}
          inputMode={inputMode}
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          className="numeric h-12 min-w-0 flex-1 rounded-lg bg-grouped-bg px-2 text-center text-[length:var(--text-title-2)] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tint"
        />
        <StepButton label={`More ${noun}`} onClick={() => onStep(1)}><PlusIcon /></StepButton>
      </div>
    </div>
  );
}

export interface SetValues {
  reps: number;
  weightKg: number | null;
}

/**
 * Reps (or seconds) and weight for one set, and the button that records it.
 * Holds field text, not numbers, so a half-typed "22." is not thrown away;
 * the conversion to kilograms happens once, on the way out (`readWeight`).
 */
export function SetFields({ idPrefix, timed, perSide, showWeight, hideCount = false, useMetric, initial, action, onSubmit, children }: {
  idPrefix: string;
  timed: boolean;
  perSide: boolean;
  showWeight: boolean;
  /** No count to edit (a guided hold records none): the one given is kept. */
  hideCount?: boolean;
  useMetric: boolean;
  initial: { reps: number | null; weightKg: number | null };
  /** The button's words, e.g. "Done set". */
  action: string;
  onSubmit: (values: SetValues) => void;
  /** Anything between the fields and the button. */
  children?: ReactNode;
}) {
  const [reps, setReps] = useState(initial.reps === null ? '' : String(initial.reps));
  const [weight, setWeight] = useState(weightText(initial.weightKg, useMetric));
  const [error, setError] = useState<string | null>(null);
  const noun = timed ? 'seconds' : 'reps';
  const each = perSide ? ' each side' : '';

  const submit = () => {
    const r = hideCount ? { ok: true as const, value: initial.reps ?? 1 } : readCount(reps, timed);
    if (!r.ok) return setError(r.message);
    const w = showWeight ? readWeight(weight, useMetric) : { ok: true as const, value: null };
    if (!w.ok) return setError(w.message);
    setError(null);
    onSubmit({ reps: r.value ?? 0, weightKg: w.value });
  };

  return (
    <div className="flex flex-col gap-3">
      {!hideCount && (
        <NumberStepper id={`${idPrefix}-count`} label={`${timed ? 'Seconds' : 'Reps'}${each}`} noun={noun}
          value={reps} inputMode="numeric"
          onChange={t => { setReps(t); setError(null); }}
          onStep={d => { setReps(stepCount(reps, d, timed)); setError(null); }} />
      )}
      {showWeight && (
        <NumberStepper id={`${idPrefix}-weight`} label={`Weight (${unitLabel(useMetric)})`} noun="weight"
          value={weight} inputMode="decimal"
          onChange={t => { setWeight(t); setError(null); }}
          onStep={d => { setWeight(stepWeight(weight, d, useMetric)); setError(null); }} />
      )}
      {error && <p role="alert" className="text-[length:var(--text-subhead)] text-stop">{error}</p>}
      {children}
      <button type="button" className={primary} onClick={submit}>{action}</button>
    </div>
  );
}

/**
 * The rest after a set, counted down from its deadline rather than by
 * counting ticks, so a phone that locks mid-rest wakes to the right time.
 * The figure is not announced every second; its end is, once.
 */
export function RestPanel({ rest, onSkip }: { rest: Rest; onSkip: () => void }) {
  const now = useNow(true);
  const left = secondsLeft(restLeftMs(rest, now));
  const over = left === 0;

  return (
    <section aria-label="Rest" className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 rounded-xl bg-grouped-card px-4 py-2">
      {over ? (
        <p className="text-[length:var(--text-body)] font-medium">Rest done. Ready when you are.</p>
      ) : (
        <Stat label="Rest" value={formatDuration(left)} unit="left" size="reading" />
      )}
      <span className="sr-only" aria-live="polite">{over ? 'Rest done.' : ''}</span>
      <button type="button" className={cn(quiet, 'shrink-0')} onClick={onSkip}>{over ? 'Hide' : 'Skip rest'}</button>
    </section>
  );
}
