import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { RING_DEFAULT, clamp, ringGeometry } from './scale';

/**
 * How the arc moves to a new value: the `spring` token (motion spec §3.1),
 * with no bounce, so it never shows more than its value even for a frame.
 * The arc's visibility steps with it, so an arc shrinking to nothing is seen
 * to shrink, and only then disappears.
 */
const SWEEP = `stroke-dashoffset ${MOTION.spring.cssMs}ms ${springLinear(0)}, visibility ${MOTION.spring.cssMs}ms`;

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
export function Ring({ value, goal, label, unit, size = RING_DEFAULT, className, arcClassName = 'text-tint', animate = true }: {
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
  /** The arc's colour: the action tint, or a category's (`text-cat-move`). */
  arcClassName?: string;
  /**
   * Whether a change of `value` sweeps the arc. False draws it already set:
   * a new week or goal, a decrease, or anything beside an urgent card (B-32, M1).
   */
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const g = ringGeometry(size);

  const fraction = goal > 0 && Number.isFinite(value) ? value / goal : 0;
  // Never past 100%, and no lap (journey §7.3, D31, K-06): a week past its
  // goal is a full ring and the words say by how much.
  const filled = clamp(fraction, 0, 1);

  /**
   * The arc sweeps from its old length to its new one: the dash offset is
   * derived straight from `value`, so changing `value` is the animation. Only
   * the offset and visibility change, so nothing is laid out again per frame.
   *
   * An empty arc is hidden rather than unmounted: a zero-length dash with
   * round caps can still paint a dot, and kept mounted it sweeps in from
   * nothing like any other change. Under reduce-motion, or when told not to,
   * there is no transition at all.
   */
  const move = reduced || !animate ? undefined : SWEEP;

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
          {arc(filled, g.track, arcClassName)}
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
