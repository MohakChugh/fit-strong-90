import type { ReactNode } from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A row that is a switch: the whole row is the target, the way iOS Settings
 * works, so the hit area is the full width and at least 52 px tall rather than
 * a thumb-sized toggle.
 */
export function SwitchRow({ label, detail, checked, busy, onToggle }: {
  label: string;
  detail?: ReactNode;
  checked: boolean;
  /** Waiting on a permission prompt. */
  busy?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={onToggle}
      className="press-feedback flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60 disabled:opacity-70"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] leading-snug">{label}</span>
        {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{detail}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-tint' : 'bg-separator',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 size-[1.6875rem] rounded-full border border-separator bg-white transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}

/** One choice of several, with the iOS checkmark. The group carries `role="radiogroup"`. */
export function ChoiceRow({ label, detail, selected, onSelect }: {
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="press-feedback flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] leading-snug">{label}</span>
        {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{detail}</span>}
      </span>
      <CheckIcon className={cn('size-5 shrink-0 text-tint', !selected && 'invisible')} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

/**
 * A row whose value is a native picker. On iPhone a `<select>` opens the
 * system wheel, which is the most familiar control there is for "pick one".
 */
export function SelectRow<T extends string | number>({ id, label, detail, value, options, onChange, placeholder }: {
  id: string;
  label: string;
  detail?: string;
  /** Nothing chosen yet shows `placeholder`: no answer is assumed for the person. */
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-1.5">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] leading-snug">{label}</span>
        {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{detail}</span>}
      </label>
      <span className="relative flex max-w-[60%] shrink-0 items-center">
        <select
          id={id}
          value={value === undefined ? '' : String(value)}
          onChange={e => {
            const picked = options.find(o => String(o.value) === e.target.value);
            if (picked) onChange(picked.value);
          }}
          className="min-h-11 w-full cursor-pointer appearance-none truncate rounded-lg bg-transparent py-2 pl-2 pr-6 text-right text-[length:var(--text-body)] text-tint outline-none focus-visible:ring-2 focus-visible:ring-tint dark:[color-scheme:dark]"
        >
          {value === undefined && <option value="" disabled>{placeholder ?? 'Choose'}</option>}
          {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
        {/* The pop-up button's cue, as iOS draws it beside the value. */}
        <ChevronsUpDownIcon className="pointer-events-none absolute right-0 size-4 text-tint" aria-hidden />
      </span>
    </div>
  );
}

const PAIN_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * A 0–10 pain answer with no default. A slider always holds a value, so an
 * untouched one would record "0, no pain" for someone who never answered;
 * here nothing is recorded until a number is tapped, and Clear takes it back.
 */
export function PainPicker({ id, label, value, disabled, onChange }: {
  id: string;
  label: string;
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="text-[length:var(--text-body)]">{label}</span>
        <span className="numeric text-[length:var(--text-subhead)] text-muted-foreground" aria-hidden>
          {value === undefined ? 'Not entered' : `${value} of 10`}
        </span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-6">
        {PAIN_VALUES.map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={n === 0 ? '0, no pain' : n === 10 ? '10, worst pain' : String(n)}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              'numeric min-h-11 rounded-lg text-[length:var(--text-body)] transition-colors disabled:opacity-60',
              value === n ? 'bg-tint font-semibold text-on-tint' : 'bg-grouped-bg text-foreground active:bg-muted',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || value === undefined}
          onClick={() => onChange(undefined)}
          className="min-h-11 rounded-lg text-[length:var(--text-subhead)] text-tint transition-opacity disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <p className="text-[length:var(--text-footnote)] text-muted-foreground">0 is no pain, 10 is the worst pain you can imagine.</p>
    </div>
  );
}

/** A plain primary action, full width: one per screen at most. */
export function PrimaryButton({ children, onClick, disabled, className }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press-feedback flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint transition-opacity disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A secondary action: the same size, quieter. */
export function SecondaryButton({ children, onClick, disabled, className }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press-feedback flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-semibold text-tint transition-opacity disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}
