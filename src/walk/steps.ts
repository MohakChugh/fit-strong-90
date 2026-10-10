/**
 * A step counter for the motion sensor, written here because the web has no
 * pedometer (`docs/research/frontend-only-health-platform.md` §1). It is the
 * literature-standard windowed peak detector the research describes:
 *
 * 1. the magnitude of `accelerationIncludingGravity`, so how the phone is held
 *    does not matter;
 * 2. gravity removed by a slow moving baseline;
 * 3. smoothed by a low-pass filter near 3.5 Hz — walking is 0.5–3 Hz;
 * 4. a peak is each lobe that rises past an adaptive threshold (a quarter of
 *    the recent amplitude, never below a floor far above sensor noise) and
 *    falls back through the baseline;
 * 5. peaks closer than 300 ms are one step, not two.
 *
 * One addition from how phone pedometers behave: steps count only in a run.
 * Four peaks with a walking rhythm commit together, and from then on each
 * peak counts. A phone put down on a table makes one or two big peaks with no
 * rhythm, so it adds nothing; neither does a bump in a pocket.
 *
 * Filters are stepped by the samples' own timestamps, because iOS delivers
 * `devicemotion` at anything from 20 to 100 Hz and a detector tuned for one
 * rate misbehaves at another. Salvi et al. (EMBC 2018) report about 95%
 * accuracy for this family of algorithm across carry positions; that is the
 * expectation to design against, not a promise.
 */

export const STEPS = {
  /** Gravity baseline time constant. Slow against a 0.5–3 Hz gait. */
  gravityTauS: 1,
  /** Low-pass cut-off. */
  lowPassHz: 3.5,
  /** m/s². Sensor noise at rest is about 0.05; a gentle hand-held walk peaks near 1. */
  floor: 0.6,
  /**
   * Threshold as a fraction of the recent peak amplitude. A quarter, not a
   * half: a limp makes one leg's step much weaker than the other's, and at
   * half the weaker step is missed every time — a sciatica walk counted as
   * half its steps. The floor and the run still keep noise and bumps out.
   */
  adapt: 0.25,
  /** How fast the recent amplitude is forgotten. */
  envelopeHalfLifeS: 1.5,
  /** 200 steps a minute is faster than anyone walks. */
  minIntervalMs: 300,
  /** 30 steps a minute is slower than anyone walks; a longer pause breaks the run. */
  maxIntervalMs: 2000,
  /** Peaks in a rhythm before any of them count. */
  minRun: 4,
  /** After a fresh start, the filters settle for this long before a peak can count. */
  settleMs: 750,
} as const;

export interface StepDetector {
  /**
   * One sample of acceleration including gravity, in m/s², stamped in ms.
   * Returns how many steps this sample committed (usually 0, sometimes 4).
   */
  push(t: number, x: number, y: number, z: number): number;
  /**
   * When each step the last `push` committed happened, oldest first, in the
   * samples' own time. A run is confirmed after its first steps, so these can
   * be earlier than the sample that committed them — across midnight, say.
   */
  readonly lastCommitted: readonly number[];
  /** Start afresh, for a new segment: filters settle again and a new rhythm is needed. The total is kept. */
  reset(): void;
  readonly count: number;
}

const NONE: readonly number[] = [];

export function createStepDetector(): StepDetector {
  let count = 0;
  let last: number | undefined;
  let baseline = 0;
  let smooth = 0;
  let envelope = 0;
  let settledAt = 0;
  let above = false;
  let peakValue = 0;
  let peakAt = 0;
  let lastPeak: number | undefined;
  let run = 0;
  /** Peaks in a run not yet long enough to count: their times. */
  let pending: number[] = [];
  let committed: readonly number[] = NONE;

  const lowPassTau = 1 / (2 * Math.PI * STEPS.lowPassHz);

  function startOver(t: number, magnitude: number) {
    last = t;
    baseline = magnitude;
    smooth = 0;
    envelope = 0;
    settledAt = t + STEPS.settleMs;
    above = false;
    lastPeak = undefined;
    run = 0;
    pending = [];
  }

  /** A peak at `t`: part of a walking rhythm, or not yet. */
  function peak(t: number): number {
    if (lastPeak !== undefined) {
      const interval = t - lastPeak;
      if (interval < STEPS.minIntervalMs) return 0;
      if (interval > STEPS.maxIntervalMs) {
        run = 0;
        pending = [];
      }
    }
    lastPeak = t;
    run += 1;
    if (run < STEPS.minRun) {
      pending.push(t);
      return 0;
    }
    committed = [...pending, t];
    pending = [];
    count += committed.length;
    return committed.length;
  }

  return {
    push(t, x, y, z) {
      committed = NONE;
      if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
      const magnitude = Math.hypot(x, y, z);
      if (last === undefined) {
        startOver(t, magnitude);
        return 0;
      }
      if (t <= last) return 0;
      // A gap in the samples needs no special case: over a long step the
      // filters simply catch up with the signal, and a pause longer than
      // `maxIntervalMs` already breaks the rhythm, so nothing is counted
      // across it.

      const dt = (t - last) / 1000;
      last = t;
      baseline += (magnitude - baseline) * (dt / (STEPS.gravityTauS + dt));
      smooth += (magnitude - baseline - smooth) * (dt / (lowPassTau + dt));
      envelope = Math.max(Math.abs(smooth), envelope * 0.5 ** (dt / STEPS.envelopeHalfLifeS));
      if (t < settledAt) return 0;

      if (!above) {
        if (smooth > Math.max(STEPS.floor, STEPS.adapt * envelope)) {
          above = true;
          peakValue = smooth;
          peakAt = t;
        }
        return 0;
      }
      if (smooth > peakValue) {
        peakValue = smooth;
        peakAt = t;
      }
      // The lobe ends when the signal falls back through the baseline.
      if (smooth > 0) return 0;
      above = false;
      return peak(peakAt);
    },

    reset() {
      last = undefined;
      committed = NONE;
    },

    get lastCommitted() {
      return committed;
    },

    get count() {
      return count;
    },
  };
}
