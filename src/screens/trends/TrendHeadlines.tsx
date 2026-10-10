/**
 * A trend's headline (journey §12.2, B-15): a meter's HI and LO first, in
 * caution ink (K-11), then the statistic and what it covers, the figure with
 * its unit, and the change in body ink with an arrow, never green or red
 * (A-41). The figures change at once and never count up (M21).
 */
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import type { Direction } from './stats';
import type { Change, Headline } from './model';

function ChangeArrow({ direction }: { direction: Direction }) {
  const className = 'mt-0.5 size-5 shrink-0';
  if (direction === 'higher') return <ArrowUpRightIcon className={className} aria-hidden />;
  if (direction === 'lower') return <ArrowDownRightIcon className={className} aria-hidden />;
  return <ArrowRightIcon className={className} aria-hidden />;
}

export function TrendHeadlines({ headline, change, meter }: { headline: Headline; change: Change; meter?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {meter && <p className="text-[length:var(--text-subhead)] font-semibold leading-snug text-caution">{meter}</p>}
      <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{headline.statistic} · {headline.coverage}</p>
      <p className="leading-tight [overflow-wrap:break-word]">
        <span className="numeric text-[length:var(--text-large-title)] font-semibold">{headline.value}</span>
        {headline.unit && <span className="ml-1.5 text-[length:var(--text-body)] text-muted-foreground">{headline.unit}</span>}
      </p>
      <p className="flex items-start gap-1.5 text-[length:var(--text-body)] leading-snug">
        {change.direction && <ChangeArrow direction={change.direction} />}
        <span className="min-w-0 [overflow-wrap:break-word]">{change.text}</span>
      </p>
      {change.compared && <p className="text-[length:var(--text-footnote)] text-muted-foreground">{change.compared}</p>}
    </div>
  );
}
