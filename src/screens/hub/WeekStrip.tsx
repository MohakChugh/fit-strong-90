import { useSyncExternalStore } from 'react';
import { scaleFromRoot } from '@/lib/textSize';
import { cn } from '@/lib/utils';
import { tileColumns } from '@/screens/home/model';
import { stripLayout } from './frame';
import { HubSection } from './HubFrame';
import type { HubDay } from './week';

/** How each day is marked; the words beside or under it always say it too (journey §20.3). */
const MARK: Record<HubDay['state'], string> = {
  done: 'bg-cat-move text-white',
  rest: 'border border-separator text-muted-foreground',
  status: 'border-2 border-dashed border-muted-foreground/60',
  none: 'border border-separator',
};

function columnsNow() {
  return tileColumns({ width: window.innerWidth, scale: scaleFromRoot(parseFloat(getComputedStyle(document.documentElement).fontSize)) });
}
function onResize(changed: () => void): () => void {
  window.addEventListener('resize', changed);
  document.addEventListener('visibilitychange', changed);
  return () => {
    window.removeEventListener('resize', changed);
    document.removeEventListener('visibilitychange', changed);
  };
}

/**
 * This week (journey §8.2): the week's minutes against this week's goal, and
 * the Monday–Sunday strip for the hub's mode. Below 375 px, or above 130%
 * text, the strip becomes seven rows (K-42).
 */
export function WeekStrip({ days, goal }: { days: readonly HubDay[]; goal: { text: string; reached: boolean } }) {
  const layout = stripLayout(useSyncExternalStore(onResize, columnsNow, () => 1 as const));
  return (
    <HubSection title="This week">
      <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
        <p className="text-[length:var(--text-body)] font-semibold leading-snug">{goal.text}</p>
        {goal.reached && <p className="text-[length:var(--text-subhead)] leading-snug">Weekly goal reached</p>}
        {layout === 'strip' ? (
          <ol aria-label="Days this week" className="grid grid-cols-7 gap-1">
            {days.map(d => (
              <li key={d.day} aria-current={d.today ? 'date' : undefined} className="flex flex-col items-center gap-1">
                <span aria-hidden className={cn('text-[length:var(--text-footnote)] font-medium text-muted-foreground', d.today && 'text-foreground')}>{d.letter}</span>
                <span aria-hidden className={cn('flex size-7 items-center justify-center rounded-full text-[length:var(--text-footnote)] font-semibold', MARK[d.state])}>
                  {d.state === 'rest' ? 'R' : ''}
                </span>
                <span className="sr-only">{d.name}: {d.words}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul aria-label="Days this week" className="flex flex-col [&>*+*]:border-t [&>*+*]:border-separator">
            {days.map(d => (
              <li key={d.day} aria-current={d.today ? 'date' : undefined} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
                <span className={cn('text-[length:var(--text-body)]', d.today && 'font-semibold')}>{d.name}</span>
                <span className="text-[length:var(--text-subhead)] text-muted-foreground">{d.words}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HubSection>
  );
}
