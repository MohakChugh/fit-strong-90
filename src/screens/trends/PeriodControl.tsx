/**
 * Week · Month · 6 Months · Year (K-34), as one radio group whose indicator
 * slides to the choice (`spring-quick`, M21), then the window's title,
 * announced when it changes, and a pager that says where it goes in words:
 * "Previous week", "Next week" (B-08).
 *
 * Narrower than 16 rem (a 320 px phone from about 125% text, any phone at
 * 200%), the four choices sit in two rows of two, so no label breaks inside
 * a word, and the indicator moves by row and column. The pager's buttons
 * take a line each when two won't fit (journey §20.4 rule 7).
 */
import type { CSSProperties, KeyboardEvent } from 'react';
import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { TREND_PERIODS, type TrendPeriod } from './periods';

export function PeriodControl({ period, onPeriod, title, labels, canPrevious, canNext, onPrevious, onNext }: {
  period: TrendPeriod;
  onPeriod: (period: TrendPeriod) => void;
  /** "This week", "September". */
  title: string;
  labels: { previous: string; next: string };
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const reduced = useReducedMotion();
  const i = Math.max(0, TREND_PERIODS.findIndex(p => p.id === period));
  // Arrow keys, Home and End move the choice, as a native radio group does; only the chosen one is in the tab order.
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = TREND_PERIODS.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onPeriod(TREND_PERIODS[next].id);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  const pager = 'press-feedback min-h-12 flex-[1_1_8rem] rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold leading-tight text-tint disabled:bg-transparent disabled:text-muted-foreground';
  // The indicator's place in four columns, or in two rows of two.
  const place = {
    '--x4': `${i * 100}%`, '--x2': `${(i % 2) * 100}%`, '--y2': `${Math.floor(i / 2) * 100}%`,
    transition: reduced ? undefined : `translate ${MOTION.springQuick.cssMs}ms ${springLinear(0)}`,
  } as CSSProperties;
  return (
    <div className="@container flex flex-col gap-3">
      <div role="radiogroup" aria-label="Period" className="relative grid auto-rows-fr grid-cols-4 rounded-[0.6rem] bg-segment-track p-0.5 @max-[16rem]:grid-cols-2">
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-0.5 h-[calc(100%-0.25rem)] w-[calc((100%-0.25rem)/4)] translate-x-[var(--x4)] rounded-lg bg-segment-thumb shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] @max-[16rem]:h-[calc((100%-0.25rem)/2)] @max-[16rem]:w-[calc((100%-0.25rem)/2)] @max-[16rem]:translate-x-[var(--x2)] @max-[16rem]:translate-y-[var(--y2)]"
          style={place}
        />
        {TREND_PERIODS.map(p => {
          const selected = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onPeriod(p.id)}
              onKeyDown={keys}
              className={cn('relative min-h-12 rounded-lg px-1 py-1 text-[length:var(--text-subhead)] leading-tight text-foreground', selected ? 'font-semibold' : 'font-medium')}
            >
              <span className="block break-words">{p.label}</span>
            </button>
          );
        })}
      </div>
      <h2 aria-live="polite" className="text-center text-[length:var(--text-title-2)] font-semibold leading-tight [overflow-wrap:break-word]">{title}</h2>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onPrevious} disabled={!canPrevious} className={pager}>{labels.previous}</button>
        <button type="button" onClick={onNext} disabled={!canNext} className={pager}>{labels.next}</button>
      </div>
    </div>
  );
}
