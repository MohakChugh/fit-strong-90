/**
 * Motion tokens and spring maths (motion spec §3). Apple's (duration, bounce)
 * spring, mass 1: stiffness = (2π/d)², damping = 4π(1−bounce)/d, as the
 * design research works out from Apple's own example.
 */

/** Position of a spring released from 0 toward 1, at t seconds. */
export function springAt(t: number, duration: number, bounce: number): number {
  if (t <= 0) return 0;
  const w0 = (2 * Math.PI) / duration;          // natural frequency
  const zeta = 1 - bounce;                      // damping ratio
  if (zeta >= 1) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
}

/** Time for the spring to settle within 0.1% of its target. */
function settle(duration: number, bounce: number): number {
  let last = 0;
  for (let t = 0; t < duration * 6; t += 0.001) if (Math.abs(1 - springAt(t, duration, bounce)) > 0.001) last = t;
  return last;
}

/** A CSS `linear()` easing that draws the spring, sampled evenly over its settle time. The shape depends only on bounce. */
export function springLinear(bounce: number, steps = 24): string {
  const d = 0.4;
  const total = settle(d, bounce);
  const points = Array.from({ length: steps + 1 }, (_, i) => (i === 0 ? 0 : i === steps ? 1 : Number(springAt((i / steps) * total, d, bounce).toFixed(3))));
  return `linear(${points.join(', ')})`;
}

const spring = (duration: number, bounce: number) => ({ duration, bounce, cssMs: Math.round(settle(duration, bounce) * 1000) });

export const MOTION = {
  instant: 100,
  fade: 200,
  fadeSlow: 300,
  countMax: 600,
  spring: spring(0.4, 0),
  springQuick: spring(0.3, 0),
  springRelease: spring(0.4, 0.15),
} as const;

/** Whether app-drawn motion runs: never when the system or the app asks for less. */
export function shouldAnimate({ systemReduced, appReduced }: { systemReduced: boolean; appReduced: boolean }): boolean {
  return !systemReduced && !appReduced;
}

// ============================================================================
// Safety pre-empts every effect (motion rule 2)
// ============================================================================

/** A navigation starts its view transition within a few frames of the tap; an older request is stale. */
const SKIP_WINDOW_MS = 1000;
let skipUntil = 0;

/**
 * The next navigation opens on a stop or a hold, such as a tile whose mode the
 * gate refuses at the tap: its view transition is skipped and the screen
 * renders at once (motion rule 2, M3).
 */
export function skipNextTransition(now = Date.now()): void {
  skipUntil = now + SKIP_WINDOW_MS;
}

/**
 * Whether a view transition starting now is skipped: always while an urgent
 * decision stands, since every screen then shows it (journey §4.7), and once
 * when the navigation was asked to skip. Taking the request uses it up.
 */
export function transitionSkipped({ urgent }: { urgent: boolean }, now = Date.now()): boolean {
  const asked = now < skipUntil;
  skipUntil = 0;
  return urgent || asked;
}

/**
 * The next view transition is a tile opening its hub (M3): the page fades
 * while the tile's background grows into the hub's wash. Cleared when the
 * transition ends, or by a navigation that doesn't animate (`main.tsx`).
 */
export function markMorph(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.morph = '';
}
