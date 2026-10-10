/**
 * Week · Month · 6 Months · Year (K-34), as one radio group whose indicator
 * slides to the choice (`spring-quick`, M21), then the window's title,
 * announced when it changes, and a pager that says where it goes in words:
 * "Previous week", "Next week" (B-08).
 */
import type { KeyboardEvent } from 'react';
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
  const pager = 'press-feedback min-h-12 flex-1 rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold leading-tight text-tint disabled:bg-transparent disabled:text-muted-foreground';
  return (
    <div className="flex flex-col gap-3">
      {/* ponytail: four columns at every size; at 200% text on a 320 px screen "6 Months" wraps inside its segment. Upgrade: two rows below 22 rem, the thumb placed by row and column. */}
      <div role="radiogroup" aria-label="Period" className="relative grid grid-cols-4 rounded-[0.6rem] bg-segment-track p-0.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/4)] rounded-lg bg-segment-thumb shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]"
          style={{ transform: `translateX(${i * 100}%)`, transition: reduced ? undefined : `transform ${MOTION.springQuick.cssMs}ms ${springLinear(0)}` }}
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
      <div className="flex gap-3">
        <button type="button" onClick={onPrevious} disabled={!canPrevious} className={pager}>{labels.previous}</button>
        <button type="button" onClick={onNext} disabled={!canNext} className={pager}>{labels.next}</button>
      </div>
    </div>
  );
}
