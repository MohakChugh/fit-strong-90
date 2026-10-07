import type { ReactNode } from 'react';
import { ActivityIcon, DumbbellIcon, FootprintsIcon, WindIcon } from 'lucide-react';
import { getMeta } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/useLocalStorage';
import { MotionView } from '@/components/motion/MotionView';

const KIND_COLOR = {
  mobility: 'var(--block-mobility)',
  strength: 'var(--block-strength)',
  cardio: 'var(--block-cardio)',
} as const;

export interface ExerciseFigureProps {
  exerciseId: string;
  /** For the 3D viewer: animate only while the figure is on screen or expanded. */
  playing?: boolean;
  /** Icon only, for list thumbnails. */
  compact?: boolean;
  className?: string;
  /** Replaces the placeholder shown while (or instead of) the 3D demo. */
  children?: ReactNode;
  /** Mistake clip id to replay in red. */
  mistake?: string | null;
  side?: 'left' | 'right';
}

/**
 * Where an exercise's form demo renders on the Library, Workout and History
 * pages. Until a 3D clip exists it shows a calm summary: the worked muscles
 * and the first coaching cue, on the block colour of the exercise kind.
 */
export function ExerciseFigure(props: ExerciseFigureProps) {
  const meta = getMeta(props.exerciseId);
  const coaching = getCoaching(props.exerciseId);
  const kind = meta?.kind ?? 'strength';
  const color = KIND_COLOR[kind];
  const Icon = kind === 'cardio' ? FootprintsIcon
    : kind === 'strength' ? DumbbellIcon
      : meta?.kind === 'mobility' && meta.mode === 'breathing' ? WindIcon : ActivityIcon;
  const name = meta?.name ?? props.exerciseId;
  const placeholder = props.children ?? (props.compact ? (
    <div className="flex h-full items-center justify-center">
      <Icon className="size-5" style={{ color }} aria-hidden />
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <Icon className="size-10" style={{ color }} aria-hidden />
      {coaching && <p className="text-sm text-muted-foreground max-w-xs">{coaching.muscles.primary.slice(0, 3).join(' · ')}</p>}
      {coaching?.cues[0] && <p className="text-base font-medium max-w-xs">“{coaching.cues[0]}”</p>}
    </div>
  ));
  if (!props.compact) return <Figure3D {...props} placeholder={placeholder} />;
  return (
    <div role="img" aria-label={`Form guide for ${name}`}
      className={cn('relative overflow-hidden rounded-lg border', props.className)}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${color} 18%, transparent), transparent 70%)` }}>
      {placeholder}
    </div>
  );
}

/** Full-size figures get the 3D demo; list thumbnails stay as light icons. */
function Figure3D(props: ExerciseFigureProps & { placeholder: ReactNode }) {
  const [data] = useAppData();
  return (
    <MotionView exerciseId={props.exerciseId} name={getMeta(props.exerciseId)?.name} playing={props.playing ?? true} mistake={props.mistake} side={props.side}
      figure={data.profile?.figure ?? 'male'} fallback={props.placeholder} className={props.className} controls />
  );
}
