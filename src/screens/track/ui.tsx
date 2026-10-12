/**
 * Small controls Track's screens share, built from the hig tokens: a
 * segmented control, a date stepper, a big number field, chips, the two
 * button weights and the "not medical advice" footnote.
 */

import { useId, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/hig/Sheet';
import { BACK_EMERGENCY_SIGNS } from './redFlags';
import { NOT_ADVICE, type Tone } from './targets';

/**
 * Arrow keys, Home and End move the choice in a radio group, as a native one
 * does; only the chosen option is in the tab order (ARIA radio group pattern).
 */
function radioKeys<T extends string>(ids: readonly T[], value: T, onChange: (value: T) => void) {
  return (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ids.indexOf(value);
    const n = ids.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n
        : e.key === 'Home' ? 0
          : e.key === 'End' ? n - 1
            : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(ids[next]);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
}

/**
 * iOS's segmented control: a radio group, because exactly one is chosen.
 * Each segment is a full 44 px tall target even though the pill looks slimmer.
 */
export function Segmented<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // Segments keep their labels whole: when the text is too large for one
      // row, they wrap onto another rather than truncate or split a word.
      className={cn('flex min-h-11 w-full flex-wrap gap-0.5 rounded-[0.6rem] bg-segment-track p-0.5', className)}
    >
      {options.map(option => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={radioKeys(options.map(o => o.id), value, onChange)}
            className={cn(
              'min-h-11 min-w-fit flex-[1_1_0%] rounded-lg px-1.5 py-1 text-[length:var(--text-subhead)] leading-tight text-foreground transition-[background-color,box-shadow]',
              selected ? 'bg-segment-thumb font-semibold shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]' : 'font-medium',
            )}
          >
            <span className="block break-words">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Previous and next day around the day's name. There is no next from today. */
export function DateStepper({ label, sublabel, previousLabel, nextLabel, onPrevious, onNext, nextDisabled }: {
  label: string;
  sublabel?: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <button
        type="button"
        onClick={onPrevious}
        aria-label={previousLabel}
        className="press-feedback flex size-[44px] shrink-0 items-center justify-center rounded-full text-tint"
      >
        <ChevronLeftIcon className="size-[24px]" strokeWidth={2.2} aria-hidden />
      </button>
      <h2 aria-live="polite" className="min-w-0 flex-1 break-words text-center leading-tight">
        <span className="block text-[length:var(--text-body)] font-semibold">{label}</span>
        {sublabel && <span className="block text-[length:var(--text-footnote)] text-muted-foreground">{sublabel}</span>}
      </h2>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
        className="press-feedback flex size-[44px] shrink-0 items-center justify-center rounded-full text-tint disabled:text-muted-foreground/35"
      >
        <ChevronRightIcon className="size-[24px]" strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}

/**
 * The big field a reading is typed into. A text input with a numeric
 * `inputMode`, not `type="number"`: the number type accepts "e", changes value
 * under a scrolling finger on desktop, and on iOS shows the wrong keyboard.
 *
 * A unit switch sits in the label row, not inside the field, so at large text
 * sizes the number keeps the whole width rather than being squeezed out.
 */
export function NumberField({ ref, label, value, onChange, mode = 'decimal', unit, switcher, placeholder, invalid, describedBy, className }: {
  ref?: Ref<HTMLInputElement>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `decimal` shows the decimal pad; `numeric` the digits only. */
  mode?: 'decimal' | 'numeric';
  /** The unit, written after the number inside the field. */
  unit?: string;
  /** A unit switch, shown beside the label. */
  switcher?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5 px-1">
        <label htmlFor={id} className="text-[length:var(--text-subhead)] text-muted-foreground">{label}</label>
        {switcher}
      </div>
      <div className={cn(
        'flex min-h-16 items-center gap-2 rounded-xl bg-grouped-card px-4 ring-1',
        invalid ? 'ring-stop' : 'ring-transparent focus-within:ring-tint',
      )}>
        {/* `!`: the app's base CSS pins every text input at 16 px (against
            iOS focus zoom); a reading wants to be legible at arm's length. */}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode={mode}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={e => onChange(e.target.value)}
          className="numeric w-0 min-w-0 flex-1 bg-transparent py-2 !text-[2.5rem] font-semibold leading-tight outline-none placeholder:text-muted-foreground/40"
        />
        {/* With a switch above, the unit is already on screen; the digits get the room. */}
        {unit && !switcher && <span className="shrink-0 text-[length:var(--text-body)] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

/** A two-way unit switch for a NumberField's label row. Targets stay 44 px at any text size. */
export function UnitSwitch<U extends string>({ units, value, onChange, label }: {
  units: readonly U[];
  value: U;
  onChange: (unit: U) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-lg bg-segment-track p-0.5">
      {units.map(u => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={u === value}
          tabIndex={u === value ? 0 : -1}
          onClick={() => onChange(u)}
          onKeyDown={radioKeys(units, value, onChange)}
          className={cn(
            // Drawn as the segmented control is: body-colour labels on the
            // measured segment tokens (muted text on this track was 4.4:1 in dark).
            'min-h-[44px] min-w-[44px] rounded-md px-2 text-[length:var(--text-subhead)] text-foreground transition-[background-color,box-shadow]',
            u === value ? 'bg-segment-thumb font-semibold shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]' : 'font-medium',
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

/** Chips for one optional choice, such as when a reading was taken. Tapping the chosen one clears it. */
export function ChoiceChips<T extends string>({ legend, options, value, onChange }: {
  legend: string;
  options: readonly { id: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 px-1 text-[length:var(--text-subhead)] text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : option.id)}
              className={cn(
                'press-feedback min-h-11 rounded-full px-4 text-[length:var(--text-subhead)] font-medium ring-1',
                selected ? 'bg-tint text-on-tint ring-tint' : 'bg-grouped-card text-foreground ring-separator',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The one primary action on a screen or sheet: full width, 56 px. */
export function PrimaryButton({ children, onClick, disabled, type = 'button', className }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press-feedback flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A quieter action, tinted text on the card colour. `tone="stop"` for removing something. */
export function SecondaryButton({ children, onClick, tone = 'default', disabled, className }: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'stop';
  /** Keeps its place while it cannot be used, so nothing moves under a finger. */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press-feedback flex min-h-11 w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] font-medium disabled:text-muted-foreground',
        tone === 'stop' ? 'text-stop' : 'text-tint',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A form's problem, read out as soon as it appears. */
export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="px-1 text-[length:var(--text-subhead)] font-medium text-stop">
      {children}
    </p>
  );
}

/** A quiet line under a control: a hint, a protocol, a source. */
export function Hint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return <p id={id} className={cn('px-1 text-[length:var(--text-footnote)] leading-snug text-muted-foreground', className)}>{children}</p>;
}

const TONE_TEXT: Record<Tone, string> = { default: '', caution: 'text-caution', stop: 'text-stop' };
const TONE_WORD: Record<Tone, string> = { default: '', caution: 'Note: ', stop: 'Important: ' };

/**
 * An interpretive line with its framework and the not-advice line beside it,
 * never only in settings. Tone is said in words for anyone who cannot see it.
 */
export function Interpretation({ text, tone, framework, extra }: { text: string; tone: Tone; framework: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-grouped-card px-4 py-3">
      <p className={cn('text-[length:var(--text-body)] leading-snug', TONE_TEXT[tone])}>
        {TONE_WORD[tone] && <span className="sr-only">{TONE_WORD[tone]}</span>}
        {text}
      </p>
      {extra}
      <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        {framework}. {NOT_ADVICE}
      </p>
    </div>
  );
}

/** "Delete this reading?" — asked once, with the consequence said plainly. */
export function ConfirmSheet({ open, onOpenChange, title, detail, confirm, onConfirm, error }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detail: string;
  confirm: string;
  onConfirm: () => void;
  error?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} detent="medium">
      <p className="px-1 text-[length:var(--text-body)] leading-snug">{detail}</p>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className="press-feedback flex min-h-14 w-full items-center justify-center rounded-xl bg-grouped-card text-[length:var(--text-body)] font-semibold text-stop"
        >
          {confirm}
        </button>
        <SecondaryButton onClick={() => onOpenChange(false)}>Cancel</SecondaryButton>
      </div>
    </Sheet>
  );
}

/** The back and leg emergency signs, in the check-in's own words, one per line (X2-20). */
export function EmergencySigns({ className }: { className?: string }) {
  return (
    <ul className={cn('list-disc pl-5', className)}>
      {BACK_EMERGENCY_SIGNS.map(sign => <li key={sign}>{sign}</li>)}
    </ul>
  );
}
