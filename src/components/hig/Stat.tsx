import { OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Colour never carries the meaning on its own. Each tone shows a word and a
 * symbol beside the label, so a person who cannot tell amber from red still
 * reads which it is. The word is real text, so a screen reader reads it in the
 * same place, before the figure; the symbol only repeats it, so it is hidden.
 * Nothing here is a live region: a timer that announced every tick would drown
 * out the one change that matters.
 */
const TONE: Record<'caution' | 'stop', { word: string; icon: LucideIcon; ink: string }> = {
  caution: { word: 'Caution', icon: TriangleAlertIcon, ink: 'text-caution' },
  stop: { word: 'Stop', icon: OctagonAlertIcon, ink: 'text-stop' },
};

/**
 * Sizes are in rem so browser text enlargement still works. A live timer wants
 * to be readable at arm's length on a mat; a reading inside a list does not.
 * The unit shrinks with the figure but never below 13 px, which is the floor
 * for anything a person has to read.
 *
 * The timer alone stops growing at 18vw, as iOS's own large clocks do: at 200%
 * text a 56px timer would be 112px, and "1:02:03" would run 400px off a 320px
 * screen. 18vw is above 56px on every screen from 320px up, so at ordinary
 * text sizes the cap never bites, and at 200% even "10:02:03" still fits.
 */
const SIZE = {
  timer: { value: 'text-[length:min(3.5rem,18vw)]', unit: 'text-[length:var(--text-body)]' },
  reading: { value: 'text-[length:var(--text-large-title)]', unit: 'text-[length:var(--text-subhead)]' },
  body: { value: 'text-[length:var(--text-body)]', unit: 'text-[length:var(--text-footnote)]' },
} as const;

/**
 * A big tabular-numeral readout: a running timer, a live pace, a reading just
 * entered. `.numeric` is the whole point — proportional digits change width as
 * they count, so a timer visibly jitters left and right every second.
 */
export function Stat({ value, unit, label, tone = 'default', size = 'timer', className }: {
  /** The figure. Pre-formatted, e.g. `"7:04"` or `"5.8"`. */
  value: ReactNode;
  /** Shown next to the figure, e.g. `"min"`, `"mmol/L"`, `"km/h"`. */
  unit: string;
  /** What is being measured. Always present: a figure with no noun is a riddle. */
  label: string;
  /** `caution` and `stop` are for a reading that changes what the user should do. */
  tone?: 'default' | keyof typeof TONE;
  /** `timer` at 56 px for a live figure, down to `body` inside a list. */
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const status = tone === 'default' ? undefined : TONE[tone];
  const Icon = status?.icon;

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="flex flex-wrap items-center gap-x-2 text-[length:var(--text-footnote)]">
        <span className="text-muted-foreground">{label}</span>
        {status && Icon && (
          <span className={cn('inline-flex items-center gap-1 font-semibold', status.ink)}>
            <Icon aria-hidden className="size-[1.15em] shrink-0" strokeWidth={2.25} />
            {/* Punctuation for the ear only: the eye gets the pause from the
                spacing, and "Glucose, Stop. 3.1" says what "Glucose Stop 3.1"
                runs together. */}
            <span className="sr-only">, </span>{status.word}<span className="sr-only">.</span>
          </span>
        )}
      </span>
      <span className={cn('flex flex-wrap items-baseline gap-1.5', status?.ink ?? 'text-foreground')}>
        {/* `leading-none` goes after the size: a font-size class also sets the
            line height, so `cn` drops a `leading-*` that comes before one. */}
        {/* Wraps as a last resort in a column too narrow for it: a figure on two
            lines loses nothing, a figure off the edge of the screen does. */}
        <span className={cn('numeric font-semibold tracking-tight wrap-anywhere', SIZE[size].value, 'leading-none')}>{value}</span>
        <span className={cn('text-muted-foreground', SIZE[size].unit)}>{unit}</span>
      </span>
    </div>
  );
}
