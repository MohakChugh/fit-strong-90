import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { RING_DEFAULT, clamp, ringGeometry } from './scale';

/**
 * One ring, for one goal the user chose themselves.
 *
 * Deliberately not Apple's three-ring contract: we cannot observe calories or
 * standing, so there is nothing honest to put in the other two (board D14).
 *
 * The figure sits *beside* the ring rather than inside it, because a number
 * inside a stroke has nowhere to grow — at 200% text it either overflows the
 * ring or gets clipped. Beside it, it simply wraps.
 */
export function Ring({ value, goal, label, unit, size = RING_DEFAULT, className }: {
  value: number;
  /** The user's own goal. Zero or missing draws an empty ring, never a divide. */
  goal: number;
  /** What is being counted, e.g. "Recorded movement". */
  label: string;
  /** Read straight after the goal: "12 of 20 chosen minutes". */
  unit: string;
  /** Outer diameter in pixels, 32 to 512. Anything else is brought into that range. */
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const g = ringGeometry(size);

  const fraction = goal > 0 && Number.isFinite(value) ? value / goal : 0;
  const filled = clamp(fraction, 0, 1);
  // Past the goal is shown, not clipped at 100%: a second arc laps the first.
  const lapped = clamp(fraction - 1, 0, 1);

  /**
   * Every arc sweeps from its old length to its new one on its own: the dash
   * offset is derived straight from `value`, so changing `value` is the
   * animation. Only the offset and visibility change, so nothing is laid out
   * again per frame.
   *
   * An arc with nothing to show is hidden rather than unmounted. A lap that
   * mounted the moment the goal was passed would have no old offset to move
   * from and would snap into place; kept mounted at zero, it sweeps in like the
   * rest. Hidden, too, because a zero-length dash with round caps can still
   * paint a dot. `visibility` transitions as a step that stays visible for the
   * whole sweep, so an arc shrinking to nothing is seen to shrink, and only
   * then disappears. Under reduce-motion there is no transition at all.
   */
  const move = reduced ? undefined : 'stroke-dashoffset 700ms var(--ease-out-quart), visibility 700ms';

  const arc = (portion: number, width: number, colour: string) => (
    <circle
      cx={g.centre}
      cy={g.centre}
      r={g.radius}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={g.circumference}
      style={{
        strokeDashoffset: g.circumference * (1 - portion),
        visibility: portion > 0 ? 'visible' : 'hidden',
        transition: move,
      }}
      className={colour}
    />
  );

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <svg
        width={g.size}
        height={g.size}
        viewBox={`0 0 ${g.size} ${g.size}`}
        role="img"
        aria-label={`${label}: ${format(value)} of ${format(goal)} ${unit}${value > goal ? ', past the goal' : ''}`}
        className="shrink-0"
      >
        {/* Twelve o'clock is the start, as every ring a person has seen does. */}
        <g transform={`rotate(-90 ${g.centre} ${g.centre})`}>
          <circle cx={g.centre} cy={g.centre} r={g.radius} fill="none" stroke="currentColor" strokeWidth={g.track} className="text-separator" />
          {arc(filled, g.track, 'text-tint')}
          {/* A wider band of the track colour under the lapping arc, so the
              second turn reads as a second turn without a second accent colour
              (board D12). The track rather than the surface, so it works on a
              card and on the page alike. */}
          {arc(lapped, g.outline, 'text-separator')}
          {arc(lapped, g.lap, 'text-tint')}
        </g>
      </svg>

      {/* The same words as the aria-label above, so a screen reader reads them
          once rather than twice. */}
      <div aria-hidden className="min-w-0">
        <p className="text-[length:var(--text-footnote)] text-muted-foreground">{label}</p>
        <p className="leading-tight">
          <span className="numeric text-[length:var(--text-large-title)] font-semibold">{format(value)}</span>
          <span className="block text-[length:var(--text-subhead)] text-muted-foreground">
            of <span className="numeric">{format(goal)}</span> {unit}
          </span>
        </p>
      </div>
    </div>
  );
}

/** Whole numbers stay whole; a fraction keeps one decimal and no float dust. */
function format(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
