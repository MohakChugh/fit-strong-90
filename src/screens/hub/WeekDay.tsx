import { ChevronRightIcon } from 'lucide-react';
import { Row } from '@/components/hig/List';
import type { WeekValue } from './reading';

/**
 * A day of This week. Each clinical reading says when it was measured and
 * its context (journey §4.10). A day with more than two condenses to the
 * first two and how many more, and its labelled detail holds every one
 * (codex H2-04).
 */
export function WeekDay({ day }: { day: WeekValue }) {
  if (!day.readings || day.readings.length <= 2) return <Row label={day.date} detail={day.text} />;
  return (
    <details className="group">
      <summary className="press-feedback flex min-h-[3.25rem] cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors active:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{day.date}</span>
          <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{day.text}</span>
          <span className="block text-[length:var(--text-subhead)] font-medium leading-snug text-tint">All {day.readings.length} readings</span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
      </summary>
      <ul aria-label={`Every reading on ${day.date}`} className="flex flex-col gap-1.5 px-4 pb-3 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">
        {day.readings.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </details>
  );
}
