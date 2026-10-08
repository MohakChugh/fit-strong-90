import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The few controls these screens need beyond `hig`: the iOS switch, a list of
 * choices with a checkmark, a full-width primary action and a time field.
 * All at least 44 px tall, all labelled, all in the one accent colour.
 */

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'press-feedback flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-center',
        'text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50 disabled:active:scale-100',
        className,
      )}
      {...props}
    />
  );
}

export function PlainButton({ className, tone = 'tint', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'tint' | 'stop' }) {
  return (
    <button
      type="button"
      className={cn(
        'press-feedback flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-center text-[length:var(--text-body)] font-medium disabled:opacity-50',
        tone === 'stop' ? 'text-stop' : 'text-tint',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The iOS switch: a 51 × 31 track, accent when on, inside a 51 × 44 control,
 * so the target is a full 44 points tall (acceptance tap targets). The thumb
 * carries no meaning on its own — the switch is announced as on or off with
 * its label.
 */
export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The accessible name, usually the row's label. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={next => onChange(next)}
      disabled={disabled}
      aria-label={label}
      className="group/toggle relative inline-flex h-11 w-[51px] shrink-0 items-center outline-none"
    >
      {/* The visible track, centred in the 44-point control. */}
      <span
        aria-hidden
        className={cn(
          'flex h-[31px] w-full items-center rounded-full p-0.5 transition-colors duration-200',
          'bg-separator group-data-[checked]/toggle:bg-tint group-data-[disabled]/toggle:opacity-40',
          'group-focus-visible/toggle:ring-3 group-focus-visible/toggle:ring-tint/40',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block size-[27px] rounded-full bg-white shadow-sm transition-transform duration-200',
            'data-[checked]:translate-x-5 data-[unchecked]:translate-x-0',
          )}
        />
      </span>
    </SwitchPrimitive.Root>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

/**
 * One choice of several, as iOS lists them: a row each, a checkmark on the
 * one chosen. Meant to sit inside a `Group`.
 */
export function ChoiceRows<T extends string>({ label, options, value, onChange }: {
  /** The accessible name of the group. */
  label: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="[&>*+*]:border-t [&>*+*]:border-separator">
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className="press-feedback flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--text-body)] leading-snug">{option.label}</span>
              {option.detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{option.detail}</span>}
            </span>
            <CheckIcon className={cn('size-5 shrink-0 text-tint', !on && 'invisible')} strokeWidth={2.4} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Several choices, any number at once: the same rows, each its own checkbox. */
export function CheckRows<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: Choice<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="[&>*+*]:border-t [&>*+*]:border-separator">
      {options.map(option => {
        const on = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? value.filter(v => v !== option.value) : [...value, option.value])}
            className="press-feedback flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60"
          >
            <span className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug">{option.label}</span>
            <CheckIcon className={cn('size-5 shrink-0 text-tint', !on && 'invisible')} strokeWidth={2.4} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A few short options side by side, as iOS's segmented control. The segments
 * wrap onto a second line rather than squeeze when the text is large.
 */
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1 rounded-xl bg-muted/70 p-1">
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              'numeric min-h-11 rounded-lg px-2 text-[length:var(--text-subhead)] font-medium transition-colors',
              on ? 'bg-grouped-card text-foreground ring-1 ring-separator' : 'text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A time of day. The native picker: a wheel on iPhone, in the phone's own
 * 12- or 24-hour style. 17 px so iOS does not zoom when it opens.
 */
export function TimeField({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    // At large text the time goes under its label rather than over it (D-10).
    <label htmlFor={id} className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-[min(1rem,4vw)] py-1.5">
      <span className="min-w-0 flex-1 basis-16 text-[length:var(--text-body)]">{label}</span>
      <input
        id={id}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="numeric min-h-11 min-w-0 max-w-full rounded-lg bg-muted/60 px-[min(0.75rem,2vw)] text-[length:var(--text-body)] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-tint/40"
      />
    </label>
  );
}

/** A line that reports the outcome of something the user just did. */
export function Notice({ tone = 'status', children }: { tone?: 'status' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('px-4 text-[length:var(--text-subhead)] leading-snug', tone === 'error' ? 'text-stop' : 'text-muted-foreground')}
    >
      {children}
    </p>
  );
}
