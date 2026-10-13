import type { ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Row } from '@/components/hig/List';
import { cn } from '@/lib/utils';

/** `Row` truncates its label; a safety question must be read whole, so it wraps. */
export const Wrap = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <span className={cn('block whitespace-normal', strong && 'font-semibold')}>{children}</span>
);

function Mark({ on, tone }: { on: boolean; tone?: 'stop' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        on ? (tone === 'stop' ? 'border-stop bg-stop text-on-tint' : 'border-tint bg-tint text-on-tint') : 'border-separator',
      )}
    >
      {on && <CheckIcon className="size-4" strokeWidth={3} />}
    </span>
  );
}

/** One answer in a checklist. `prominent` is for "None of these", the answer most days. */
export function CheckRow({ label, checked, onToggle, prominent, tone }: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  prominent?: boolean;
  tone?: 'stop';
}) {
  return (
    <Row
      as="button"
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      label={<Wrap strong={prominent}>{label}</Wrap>}
      accessory={<Mark on={checked} tone={tone} />}
      className={cn(prominent && 'min-h-[3.75rem]')}
    />
  );
}

/**
 * Where a segmented control's segments go one under another: narrower than its segments need side by side,
 * about 3.5rem each (3rem with small labels), by how many it has. In rem, so at a large text size they stack
 * rather than squeezing their words, as at 200% on a 320 px phone (J§20.4 rule 1).
 */
const STACK: Record<number, string> = {
  2: '@max-[7rem]:flex-col', 3: '@max-[10.5rem]:flex-col', 4: '@max-[14rem]:flex-col', 5: '@max-[17.5rem]:flex-col', 6: '@max-[21rem]:flex-col',
};
const STACK_SMALL: Record<number, string> = {
  2: '@max-[6rem]:flex-col', 3: '@max-[9rem]:flex-col', 4: '@max-[12rem]:flex-col', 5: '@max-[15rem]:flex-col', 6: '@max-[18rem]:flex-col',
};

/** An iOS segmented control: one choice from a few, each at least 48 px tall. */
export function Segmented<T extends string>({ label, value, options, onChange, small }: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** 13 px labels, for five options at 320 px wide. */
  small?: boolean;
}) {
  return (
    <div className="@container w-full">
    <div role="radiogroup" aria-label={label} className={cn('flex w-full gap-0.5 rounded-lg bg-muted p-0.5', (small ? STACK_SMALL : STACK)[options.length])}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-12 flex-1 rounded-md px-1 leading-tight transition-colors',
            small ? 'text-[length:var(--text-footnote)]' : 'text-[length:var(--text-subhead)]',
            value === o.value ? 'bg-grouped-card font-semibold text-foreground ring-1 ring-separator' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
    </div>
  );
}

/** A labelled on/off switch with a 48 px hit area. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 min-w-12 shrink-0 items-center justify-end"
    >
      <span aria-hidden className={cn('relative h-[1.9rem] w-[3.1rem] rounded-full transition-colors', checked ? 'bg-tint' : 'bg-muted-foreground/30')}>
        <span className={cn('absolute top-0.5 size-[1.65rem] rounded-full bg-white ring-1 ring-separator transition-transform', checked ? 'translate-x-[1.3rem]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

/** A number box sized for iOS: 17 px text so the page does not zoom on focus. */
export function NumberBox({ label, value, onChange, placeholder, className, invalid }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value.replace(',', '.'))}
      className={cn(
        'numeric h-12 rounded-lg bg-muted px-3 text-right text-[length:var(--text-body)] outline-none',
        'focus-visible:ring-2 focus-visible:ring-tint/60 aria-invalid:ring-2 aria-invalid:ring-stop/60',
        className,
      )}
    />
  );
}

/** A 0–10 pain scale on the native range input, which every screen reader knows. */
/** Keys that set a slider, whether or not they move it: Home on a slider already at 0 is still an answer of 0. */
const SLIDER_KEYS = new Set(['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);

/**
 * A 0–10 pain slider. Until it is `answered` it says so and shows no number:
 * its starting position is not an answer (acceptance J03, J16). Any setting
 * of it answers — a drag, a tap, or a key, even one that leaves it where it was.
 */
export function PainScale({ id, label, value, answered = true, onChange }: {
  id: string; label: string; value: number; answered?: boolean; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[length:var(--text-body)]">{label}</label>
        <span className={cn('numeric font-semibold', answered ? 'text-[length:var(--text-title-2)]' : 'text-[length:var(--text-subhead)] text-muted-foreground')} aria-hidden>
          {answered ? value : 'Not answered'}
        </span>
      </div>
      <input
        id={id} type="range" min={0} max={10} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onKeyUp={e => { if (SLIDER_KEYS.has(e.key)) onChange(Number(e.currentTarget.value)); }}
        onPointerUp={e => onChange(Number(e.currentTarget.value))}
        aria-valuetext={answered ? `${value} out of 10` : 'Not answered'}
        className={cn('h-12 w-full accent-[var(--tint)]', !answered && 'opacity-60')}
      />
      <div className="flex justify-between text-[length:var(--text-footnote)] text-muted-foreground" aria-hidden>
        <span>No pain</span><span>Worst</span>
      </div>
    </div>
  );
}
