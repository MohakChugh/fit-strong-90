import type { Segment, Step } from '@/types/plan';
import type { Coaching } from '@/types/catalog';
import { BLOCK_COLOR, BLOCK_INK } from './format';
import { cn } from '@/lib/utils';
import { ActivityIcon, DumbbellIcon, WindIcon, FootprintsIcon, SparklesIcon } from 'lucide-react';
import { MotionView, type RepSync } from '@/components/motion/MotionView';

/**
 * The form demo for the current step: the 3D coach doing the movement (in
 * step with the voice's rep count), or a calm summary when there's no clip.
 */
export function FigureSlot({ step, segment, coaching, demoId, sync, playing, figure, className }: {
  step: Step; segment: Segment; coaching?: Coaching;
  /** Exercise to demonstrate (the current one, or the next one during rests and transitions). */
  demoId?: string;
  sync?: RepSync | null;
  playing: boolean;
  figure?: 'male' | 'female';
  className?: string;
}) {
  const color = BLOCK_COLOR[step.block];
  const Icon = step.kind === 'cardio' ? FootprintsIcon
    : step.kind === 'set' || step.kind === 'setup' ? DumbbellIcon
      : segment.breath ? WindIcon
        : step.kind === 'talk' ? SparklesIcon : ActivityIcon;
  const summary = (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${color} 18%, transparent), transparent 70%)` }}>
      <Icon className="size-10" style={{ color: BLOCK_INK[step.block] }} aria-hidden />
      {coaching && <p className="text-sm text-muted-foreground max-w-xs">{coaching.muscles.primary.slice(0, 3).join(' · ')}</p>}
      {coaching?.cues[0] && step.kind !== 'talk' && <p className="text-base font-medium max-w-xs">“{coaching.cues[0]}”</p>}
    </div>
  );
  if (!demoId) return <div className={cn('relative overflow-hidden rounded-2xl border', className)}>{summary}</div>;
  return (
    <MotionView exerciseId={demoId} name={coaching?.id === demoId ? coaching.name : undefined} side={segment.side ?? 'left'} sync={sync} playing={playing} figure={figure}
      fallback={summary} className={className} />
  );
}
