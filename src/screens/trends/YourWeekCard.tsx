/**
 * Your week (journey §12.1): the week's ring against the goal it had, or its
 * minutes when there was none, then up to 4 factual sentences, paused while
 * the status isn't Normal or a safety decision stands (§12.6). The ring is
 * drawn set, never swept (M21, B-32).
 */
import { useId } from 'react';
import { Ring } from '@/components/hig/Ring';
import { formatNumber } from '@/screens/track/units';

const PAUSED = {
  status: 'Your week’s summary returns when your status is back to Normal.',
  safety: 'Your week’s summary returns once today’s safety advice has passed.',
} as const;

export function YourWeekCard({ title, name, minutes, goal, sentences, pause, pending, onLastWeek, onThisWeek }: {
  /** "This week", "Last week", "Week of 21 Sep". */
  title: string;
  /** In a sentence: "this week", "last week", "in the week of 21 Sep". */
  name: string;
  minutes: number;
  goal?: number;
  sentences: readonly string[];
  pause?: 'status' | 'safety';
  /** A goal change waiting for Monday (B-16). */
  pending?: string;
  onLastWeek?: () => void;
  onThisWeek?: () => void;
}) {
  const id = useId();
  const button = 'press-feedback min-h-12 self-start rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint';
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
      <h2 id={id} className="leading-tight">
        <span className="block text-[length:var(--text-title-2)] font-semibold">Your week</span>
        <span className="block text-[length:var(--text-subhead)] text-muted-foreground">{title}</span>
      </h2>
      {goal !== undefined
        ? <Ring value={minutes} goal={goal} label={`Moved ${name}`} unit="min" animate={false} arcClassName="text-cat-move" />
        : <p className="text-[length:var(--text-body)]"><span className="numeric font-semibold">{formatNumber(minutes)}</span> min moved {name}</p>}
      {pause ? (
        <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{PAUSED[pause]}</p>
      ) : sentences.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-[length:var(--text-body)] leading-snug">{sentences.map(s => <li key={s}>{s}</li>)}</ul>
      ) : (
        <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Nothing recorded {name}{name === 'this week' ? ' yet' : ''}.</p>
      )}
      {pending && <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{pending}</p>}
      {onLastWeek && <button type="button" onClick={onLastWeek} className={button}>Last week in brief</button>}
      {onThisWeek && <button type="button" onClick={onThisWeek} className={button}>Back to this week</button>}
    </section>
  );
}
