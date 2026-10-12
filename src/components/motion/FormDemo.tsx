import { useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { getCoaching } from '@/data/coaching';
import { ExerciseFigure } from '@/components/exercise/ExerciseFigure';
import { cn } from '@/lib/utils';

/**
 * The 3D demo with a row of chips to switch between correct form and each
 * common mistake, replayed in red so you can see exactly what to avoid.
 */
export function FormDemo({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const mistakes = getCoaching(exerciseId)?.mistakes ?? [];
  const [shown, setShown] = useState<{ id: string; clip: string | null }>({ id: exerciseId, clip: null });
  // Reset to correct form when the exercise changes.
  const clip = shown.id === exerciseId ? shown.clip : null;
  const pick = (c: string | null) => setShown({ id: exerciseId, clip: c });
  const chip = 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium press-feedback';
  return (
    <div className="flex flex-col gap-2">
      <ExerciseFigure exerciseId={exerciseId} playing mistake={clip} className={className} />
      {mistakes.length > 0 && (
        <div role="radiogroup" aria-label="Show correct form or a common mistake" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" role="radio" aria-checked={clip === null} onClick={() => pick(null)}
            className={cn(chip, clip === null ? 'border-transparent bg-[var(--block-mobility-ink)] text-[var(--on-ink)]' : 'bg-background')}>
            <CheckIcon className="size-4" aria-hidden /> Correct form
          </button>
          {mistakes.map(m => (
            <button key={m.clip} type="button" role="radio" aria-checked={clip === m.clip} onClick={() => pick(m.clip)}
              className={cn(chip, clip === m.clip ? 'border-transparent bg-[var(--safety)] text-[var(--on-safety)]' : 'bg-background text-[var(--safety)]')}>
              <XIcon className="size-4" aria-hidden /> {m.mistake}
            </button>
          ))}
        </div>
      )}
      {clip && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm" aria-live="polite">
          <span className="font-semibold">Fix: </span>{mistakes.find(m => m.clip === clip)?.fix}
        </p>
      )}
    </div>
  );
}
