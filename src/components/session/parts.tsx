/**
 * Small presentational pieces of the session player.
 */

import type { Segment, SessionPlan, Block } from '@/types/plan';
import { cn } from '@/lib/utils';
import { stepSeconds } from '@/engine/timing';
import { BLOCK_COLOR, fmt } from './format';

/** Overall progress, segmented by block. */
export function SessionProgress({ plan, elapsedMs }: { plan: SessionPlan; elapsedMs: number }) {
  const total = plan.totalSeconds * 1000;
  const blocks: { block: Block; start: number; end: number }[] = [];
  let t = 0;
  for (const s of plan.steps) {
    const d = stepSeconds(s) * 1000;
    const b = s.block === 'intro' ? 'mobility' : s.block === 'wrapUp' ? 'cardio' : s.block;
    const last = blocks.at(-1);
    if (last && last.block === b) last.end = t + d;
    else blocks.push({ block: b, start: t, end: t + d });
    t += d;
  }
  return (
    <div className="flex h-2 w-full gap-0.5" role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round((elapsedMs / total) * 100)} aria-label="Session progress">
      {blocks.map(b => {
        const width = ((b.end - b.start) / total) * 100;
        const fill = Math.min(1, Math.max(0, (elapsedMs - b.start) / (b.end - b.start)));
        return (
          <div key={`${b.block}-${b.start}`} className="relative h-full overflow-hidden rounded-full bg-muted" style={{ width: `${width}%` }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, background: BLOCK_COLOR[b.block] }} />
          </div>
        );
      })}
    </div>
  );
}

/** Ring countdown for the current segment. */
export function TimerRing({ remainingMs, totalMs, color, size = 112, label }: { remainingMs: number; totalMs: number; color: string; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 250ms linear' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums leading-none" aria-live="off">{fmt(remainingMs)}</span>
        {label && <span className="mt-1 max-w-[80%] truncate text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/** Inhale 4 s / exhale 6 s pacer for holds and breathing drills. */
export function BreathPacer({ segment, segmentElapsedMs, reduced }: { segment: Segment; segmentElapsedMs: number; reduced: boolean }) {
  // Drills with explicit breaths follow the segment; holds follow a 10 s cycle.
  const phase: 'in' | 'out' = segment.breath ?? ((segmentElapsedMs % 10_000) < 4000 ? 'in' : 'out');
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="relative size-10 shrink-0">
        <div className={cn('absolute inset-0 rounded-full bg-[var(--block-mobility)]/25 transition-transform ease-in-out',
          reduced ? '' : phase === 'in' ? 'scale-100 duration-[4000ms]' : 'scale-50 duration-[6000ms]')} />
        <div className="absolute inset-[30%] rounded-full bg-[var(--block-mobility)]" />
      </div>
      <p className="whitespace-nowrap text-sm font-medium">{phase === 'in' ? 'Breathe in · 4' : 'Breathe out · 6'}</p>
    </div>
  );
}
