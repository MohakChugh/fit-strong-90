import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import { Ring } from '@/components/hig/Ring';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { dotLabel, readRingShown, ringId, ringSweeps, stretchedLine, type RingShown, type WeekDot } from './week';

/** What the ring last showed on this device. Cleared with everything else the app keeps (`fit-strong-90…`). */
const RING_KEY = 'fit-strong-90-week-ring';

function readShown(): RingShown | undefined {
  try {
    return readRingShown(localStorage.getItem(RING_KEY));
  } catch {
    return undefined;
  }
}

function writeShown(shown: RingShown): void {
  try {
    localStorage.setItem(RING_KEY, JSON.stringify(shown));
  } catch {
    // Not kept: next time the ring is drawn already set, which is always safe.
  }
}

/**
 * The value the ring draws, and whether it sweeps to it (B-32, M1). On
 * arrival it sweeps up from what this device last showed, only for a real
 * increase in the same week, metric and goal; a change while on screen
 * sweeps only when it is an increase in the same ring. Everything else is
 * drawn already set, and nothing moves beside an urgent card (`still`).
 */
function useRingValue(id: string, value: number, still: boolean): { shown: number; animate: boolean } {
  const [ring, setRing] = useState(() => {
    const before = readShown();
    const from = before && ringSweeps(before, { id, value }, still) ? before.value : undefined;
    return { id, value, shown: from ?? value, animate: false, pending: from !== undefined };
  });
  let current = ring;
  if (ring.id !== id || ring.value !== value) {
    current = { id, value, shown: value, animate: ringSweeps({ id: ring.id, value: ring.shown }, { id, value }, still), pending: false };
    setRing(current);
  }
  useEffect(() => {
    if (!ring.pending) return;
    // Two frames, so the old length is painted before the arc sweeps from it.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setRing(r => (r.pending ? { ...r, shown: r.value, animate: true, pending: false } : r)));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ring.pending]);
  useEffect(() => writeShown({ id, value }), [id, value]);
  return { shown: current.shown, animate: current.animate && !still };
}

/**
 * A day's mark grows with the text, as its letter does (kiro KV-22): seven
 * fit in a row on a 320 px phone up to 130%, and wrap to more rows beyond.
 * Each has its day and state in words for a screen reader.
 */
const DOT = 'flex size-5 items-center justify-center rounded-full';

/** A day's mark: filled for movement, "R" for a planned rest, hatched for a status day, an empty ring otherwise. */
function DayMark({ dot }: { dot: WeekDot }) {
  switch (dot.state) {
    case 'moved':
      return <span className={cn(DOT, 'bg-cat-move')} />;
    case 'rest':
      return <span className={cn(DOT, 'text-[length:var(--text-footnote)] font-bold leading-none text-muted-foreground')}>R</span>;
    case 'status':
      return <span className={cn(DOT, 'border-2 border-muted-foreground bg-[repeating-linear-gradient(45deg,var(--muted-foreground)_0_2px,transparent_2px_5px)]')} />;
    default:
      return <span className={cn(DOT, 'border-2 border-separator')} />;
  }
}

/**
 * This week (journey §7.3, D31): one Move ring against the person's weekly
 * goal, never past 100%; beside it the days stretched and today's steps;
 * under it the week's days. With no goal there is no ring, only the minutes
 * and a way to set one. The whole card opens Trends.
 */
export function WeekCard({ today, minutes, enteredNote, goal, stretched, steps, dots, still, onSetGoal }: {
  today: string;
  minutes: number;
  /** "20 min added by hand", when some of it was typed in rather than measured. */
  enteredNote?: string;
  goal?: number;
  stretched: number;
  /** Today's steps line; none while walking is held for the feet (L-09). */
  steps?: string;
  dots: readonly WeekDot[];
  /** The Right now card shows a safety state: nothing here moves (motion rule 2, M1). */
  still: boolean;
  onSetGoal: () => void;
}) {
  const titleId = useId();
  const reduced = useReducedMotion();
  const { shown, animate } = useRingValue(ringId(today, goal ?? 0), minutes, still || reduced);
  return (
    <section aria-labelledby={titleId} className="flex flex-col">
      <h2 id={titleId} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">This week</h2>
      <div className="press-feedback relative flex flex-col gap-4 rounded-2xl bg-grouped-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {goal !== undefined
            ? <Ring value={shown} goal={goal} label="Moved this week" unit="minutes" size={96} arcClassName="text-cat-move" animate={animate} />
            : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-[length:var(--text-body)] font-semibold">{minutes} min moved this week</p>
                {/* Above the card's link, so it is its own button. */}
                <button
                  type="button"
                  onClick={onSetGoal}
                  className="press-feedback relative z-10 flex min-h-12 items-center rounded-full bg-tint/12 px-4 text-[length:var(--text-body)] font-semibold text-tint"
                >
                  Set a weekly goal
                </button>
              </div>
            )}
          <ul className="flex min-w-0 flex-col gap-1 text-[length:var(--text-subhead)] leading-snug">
            <li>{stretchedLine(stretched)}</li>
            {steps && <li>{steps}</li>}
          </ul>
        </div>
        {goal !== undefined && minutes >= goal && goal > 0 && <p className="text-[length:var(--text-body)] font-medium">Weekly goal reached</p>}
        {enteredNote && <p className="text-[length:var(--text-footnote)] text-muted-foreground">Includes {enteredNote === 'all added by hand' ? 'only minutes added by hand' : enteredNote}.</p>}
        <ol aria-label="Days this week" className="grid grid-cols-[repeat(auto-fit,minmax(min(1.75rem,100%),1fr))] gap-1">
          {dots.map(dot => (
            <li key={dot.day} className="flex flex-col items-center gap-1">
              <span aria-hidden className={cn('text-[length:var(--text-footnote)] leading-none', dot.today ? 'font-bold text-foreground' : 'text-muted-foreground')}>{dot.letter}</span>
              <span aria-hidden><DayMark dot={dot} /></span>
              <span className="sr-only">{dotLabel(dot)}{dot.today ? ', today' : ''}</span>
            </li>
          ))}
        </ol>
        {/* The card's link. With the ring, its area covers the whole card, so a tap anywhere opens
            Trends; beside "Set a weekly goal" it is only this row, so a shaky tap near the button
            never opens Trends instead (kiro KV-11). */}
        <Link
          to="/trends"
          className={cn(
            'flex min-h-12 items-center justify-between gap-2 text-[length:var(--text-body)] font-semibold text-tint',
            goal !== undefined && "after:absolute after:inset-0 after:rounded-2xl after:content-['']",
          )}
        >
          See Trends
          <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
