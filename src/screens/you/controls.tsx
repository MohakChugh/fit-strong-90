import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The few controls these screens need beyond `hig`: the iOS switch, a list of
 * choices with a checkmark, a full-width primary action and a time field.
 * All at least 48 px tall (§20.4.1; H5-22), all labelled, all in the one
 * accent colour.
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
        'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-center text-[length:var(--text-body)] font-medium disabled:opacity-50',
        tone === 'stop' ? 'text-stop' : 'text-tint',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The iOS switch: a 51 × 31 track, accent when on, inside a control at least
 * 48 × 48 (journey §20.4 rule 1; H5-22, D159). All of it is in rem, the track,
 * its inset and the thumb's travel too, so it grows with the text size and the
 * thumb stays inside the track at every size. The thumb carries no meaning on
 * its own — the switch is announced as on or off with its label.
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
      className="group/toggle relative inline-flex min-h-12 min-w-12 shrink-0 items-center outline-none"
    >
      {/* The visible track, 51 × 31 at 100% text, centred in the control's height. */}
      <span
        aria-hidden
        className={cn(
          'flex h-[1.9375rem] w-[3.1875rem] items-center rounded-full p-0.5 transition-colors duration-200',
          'bg-separator group-data-[checked]/toggle:bg-tint group-data-[disabled]/toggle:opacity-40',
          'group-focus-visible/toggle:ring-3 group-focus-visible/toggle:ring-tint/40',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block size-[1.6875rem] rounded-full bg-white shadow-sm transition-transform duration-200',
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

const STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * A radio group's keyboard, as WAI-ARIA's radio group pattern has it (H5-23;
 * board D160): one tab stop, on the chosen option or else the first, and the
 * arrow keys move to the next or previous option, wrapping, and choose it.
 * Enter and Space are each button's own.
 */
function radioKeys<T extends string>(options: readonly { value: T }[], value: T | undefined, onChange: (value: T) => void) {
  const chosen = options.findIndex(o => o.value === value);
  const stop = chosen >= 0 ? chosen : 0;
  return (i: number) => ({
    tabIndex: i === stop ? 0 : -1,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const step = STEP[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const next = (i + step + options.length) % options.length;
      onChange(options[next].value);
      (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
    },
  });
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
  const keys = radioKeys(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className="[&>*+*]:border-t [&>*+*]:border-separator">
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            {...keys(i)}
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
  const keys = radioKeys(options, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1 rounded-xl bg-muted/70 p-1">
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            {...keys(i)}
            onClick={() => onChange(option.value)}
            className={cn(
              'numeric min-h-12 rounded-lg px-2 text-[length:var(--text-subhead)] font-medium transition-colors',
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
        className="numeric min-h-12 min-w-0 max-w-full rounded-lg bg-muted/60 px-[min(0.75rem,2vw)] text-[length:var(--text-body)] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-tint/40"
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
