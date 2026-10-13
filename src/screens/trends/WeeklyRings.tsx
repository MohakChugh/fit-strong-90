/**
 * The last 8 weeks as small rings (journey §12.1): one radio group, so it's
 * one choice however many weeks there are (B-08). Each ring is drawn set
 * against the goal its week had (B-16, B-32, M21), and its name gives the
 * minutes in words.
 */
import type { KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { ringGeometry } from '@/components/hig/scale';
import { cn } from '@/lib/utils';
import { ringLabel, type WeekRing } from './yourWeek';

function MiniRing({ minutes, goal }: { minutes: number; goal?: number }) {
  const g = ringGeometry(40);
  // Never past full, as Home's ring (journey §7.3): the words say by how much.
  const filled = goal ? Math.min(1, minutes / goal) : 0;
  return (
    <svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`} aria-hidden>
      <g transform={`rotate(-90 ${g.centre} ${g.centre})`}>
        <circle cx={g.centre} cy={g.centre} r={g.radius} fill="none" stroke="currentColor" strokeWidth={g.track} className="text-separator" />
        {filled > 0 && (
          <circle
            cx={g.centre} cy={g.centre} r={g.radius} fill="none" stroke="currentColor" strokeWidth={g.track} strokeLinecap="round"
            strokeDasharray={g.circumference} strokeDashoffset={g.circumference * (1 - filled)} className="text-cat-move"
          />
        )}
      </g>
    </svg>
  );
}

export function WeeklyRings({ rings, chosen, onChoose }: { rings: readonly WeekRing[]; chosen: string; onChoose: (week: string) => void }) {
  const i = Math.max(0, rings.findIndex(r => r.week === chosen));
  // Arrow keys, Home and End move the choice, as a native radio group does.
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = rings.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(n - 1, i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, i - 1)
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChoose(rings[next].week);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    // Four a row; two below 11.5 rem (a 320 px phone at 200% text), so no date breaks inside a word.
    <div className="@container">
    <div role="radiogroup" aria-label="Week" className="grid grid-cols-4 gap-3 @max-[11.5rem]:grid-cols-2">
      {rings.map((r, k) => {
        const selected = r.week === chosen;
        return (
          <button
            key={r.week}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ringLabel(r)}
            // One place in the Tab order whatever is chosen: the chosen ring, or the first when the address chose a week
            // before them (H3-14), as a radio group with none checked has (codex F-ui-06).
            tabIndex={k === i ? 0 : -1}
            onClick={() => onChoose(r.week)}
            onKeyDown={keys}
            className={cn('press-feedback flex min-h-12 flex-col items-center gap-1 rounded-xl bg-grouped-card px-1 py-2', selected && 'ring-2 ring-tint')}
          >
            <MiniRing minutes={r.minutes} goal={r.goal} />
            <span aria-hidden className="text-[length:var(--text-footnote)] leading-tight [overflow-wrap:anywhere]">
              {r.current ? 'This week' : format(new Date(`${r.week}T12:00:00`), 'd MMM')}
            </span>
          </button>
        );
      })}
    </div>
    </div>
  );
}
