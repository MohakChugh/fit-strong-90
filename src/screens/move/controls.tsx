import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The few controls Move needs beyond `hig`: one full-width primary action, a
 * list of choices with a checkmark, and a two- or three-way segmented choice.
 * Every target is at least 44 px and every choice is announced as a radio.
 */

/**
 * A `Row` label that wraps instead of truncating: at large text sizes a label
 * cut to "St…" is no label at all.
 */
export function Wrap({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'press-feedback flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-center',
        'text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50 disabled:active:scale-100',
        className,
      )}
      {...props}
    />
  );
}

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  detail?: string;
  disabled?: boolean;
}

/**
 * One choice of several, as iOS lists them: a row each, a checkmark on the
 * one chosen. Sits inside a `Group`, which draws the card.
 */
export function ChoiceRows<T extends string>({ label, options, value, onChange }: {
  /** The accessible name of the group. */
  label: string;
  options: Choice<T>[];
  value: T;
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

/**
 * A short either-or, side by side, drawn as Track's segmented control is (the
 * accent stays for actions, board D12). One that cannot be chosen today stays
 * visible, dimmed, so the choice does not appear and vanish — the screen says
 * why underneath.
 */
export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-[0.6rem] bg-segment-track p-0.5">
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={option.disabled || undefined}
            onClick={() => { if (!option.disabled) onChange(option.value); }}
            className={cn(
              'min-h-11 min-w-0 flex-1 rounded-lg px-3 text-[length:var(--text-subhead)] text-foreground transition-[background-color,box-shadow]',
              on ? 'bg-segment-thumb font-semibold shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]' : 'font-medium',
              option.disabled && 'opacity-40',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
