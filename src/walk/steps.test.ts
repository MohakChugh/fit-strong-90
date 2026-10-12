import { describe, expect, it } from 'vitest';
import { createStepDetector, STEPS, type StepDetector } from './steps';

const G = 9.80665;

/** A seeded generator, so a noisy test fails the same way every time. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Normal noise by Box–Muller. */
function gaussian(rand: () => number) {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

interface Signal {
  /** Seconds. */
  from: number;
  to: number;
  hz: number;
  /** Extra acceleration along the phone's vertical, m/s², at time t (s). */
  shape: (t: number) => number;
}

/**
 * Feed a signal, as a phone held upright would report it: gravity on y, the
 * walking bounce added to it, and a little sideways sway on x so the
 * magnitude is not trivially one axis.
 */
function feed(detector: StepDetector, signal: Signal, noise = 0, seed = 1): number {
  const n = gaussian(random(seed));
  let added = 0;
  for (let t = signal.from; t < signal.to; t += 1 / signal.hz) {
    const sway = 0.3 * Math.sin(2 * Math.PI * 1 * t);
    added += detector.push(t * 1000, sway + noise * n(), G + signal.shape(t) + noise * n(), noise * n());
  }
  return added;
}

/** A 2 Hz walk (120 steps a minute): one bounce per step, plus a heel-strike harmonic. */
const walk2Hz = (amplitude = 2.5) => (t: number) =>
  amplitude * Math.sin(2 * Math.PI * 2 * t) + 0.4 * amplitude * Math.sin(2 * Math.PI * 4 * t + 0.7);

describe('step detector', () => {
  it('counts a clean 2 Hz walk at 60 Hz', () => {
    const d = createStepDetector();
    feed(d, { from: 0, to: 60, hz: 60, shape: walk2Hz() }, 0.05);
    // 120 steps; the filters settle for under a second at the start.
    expect(d.count).toBeGreaterThanOrEqual(117);
    expect(d.count).toBeLessThanOrEqual(121);
  });

  it.each([20, 30, 100])('counts the same walk sampled at %i Hz', hz => {
    const d = createStepDetector();
    feed(d, { from: 0, to: 60, hz, shape: walk2Hz() }, 0.05);
    expect(d.count).toBeGreaterThanOrEqual(117);
    expect(d.count).toBeLessThanOrEqual(121);
  });

  it('counts a slow, gentle walk with the phone in hand', () => {
    // 66 steps a minute, peaks about 1 m/s²: an older person's careful walk.
    const d = createStepDetector();
    feed(d, { from: 0, to: 60, hz: 60, shape: t => 1.1 * Math.sin(2 * Math.PI * 1.1 * t) }, 0.05);
    expect(d.count).toBeGreaterThanOrEqual(63);
    expect(d.count).toBeLessThanOrEqual(67);
  });

  it('counts both legs of an uneven walk', () => {
    // A limp: every other step is much weaker, so the bounce has a stride
    // (1 Hz) component on top of the step (2 Hz). At a threshold of half the
    // recent amplitude the weak step is missed and this reads as 60.
    const d = createStepDetector();
    feed(d, { from: 0, to: 60, hz: 60, shape: t => 2 * Math.sin(2 * Math.PI * 2 * t) + 1.5 * Math.sin(2 * Math.PI * t) }, 0.05);
    expect(d.count).toBeGreaterThanOrEqual(115);
    expect(d.count).toBeLessThanOrEqual(121);
  });

  it('counts a step with two jolts in it once', () => {
    // Heel strike and toe-off as two separate lobes 250 ms apart, each falling
    // back through the baseline. Without the minimum interval this reads 240.
    const d = createStepDetector();
    feed(d, { from: 0, to: 60, hz: 100, shape: t => (2.2 + 0.8 * Math.cos(2 * Math.PI * 2 * t)) * Math.sin(2 * Math.PI * 4 * t) }, 0.05);
    expect(d.count).toBeGreaterThanOrEqual(115);
    expect(d.count).toBeLessThanOrEqual(121);
  });

  it('counts nothing from sensor noise alone', () => {
    const quiet = createStepDetector();
    feed(quiet, { from: 0, to: 120, hz: 60, shape: () => 0 }, 0.05);
    expect(quiet.count).toBe(0);

    // A shaky hand: four times the usual noise.
    const shaky = createStepDetector();
    feed(shaky, { from: 0, to: 120, hz: 60, shape: () => 0 }, 0.2, 7);
    expect(shaky.count).toBe(0);
  });

  it('counts nothing when the phone is picked up and put down', () => {
    const d = createStepDetector();
    feed(d, {
      from: 0, to: 10, hz: 60,
      shape: t => {
        // Held still, lifted (a dip then a push), carried, set down with a
        // knock that rings briefly, then left on the table.
        if (t > 2 && t < 2.3) return -2.5;
        if (t >= 2.3 && t < 2.6) return 3;
        if (t > 4 && t < 4.25) return -2;
        if (t >= 4.25 && t < 4.31) return 7;
        if (t >= 4.31 && t < 4.7) return 2 * Math.exp(-(t - 4.31) * 8) * Math.sin(2 * Math.PI * 15 * t);
        return 0;
      },
    }, 0.05);
    expect(d.count).toBe(0);
  });

  it('counts nothing across a gap in the samples, and picks up again after it', () => {
    const d = createStepDetector();
    feed(d, { from: 0, to: 20, hz: 60, shape: walk2Hz() }, 0.05);
    const before = d.count;
    expect(before).toBeGreaterThanOrEqual(37);
    expect(before).toBeLessThanOrEqual(41);
    // The app is hidden for 30 s: no samples. The next one is far from the
    // last, and must not be taken for a step.
    feed(d, { from: 50, to: 70, hz: 60, shape: walk2Hz() }, 0.05);
    expect(d.count - before).toBeGreaterThanOrEqual(37);
    expect(d.count - before).toBeLessThanOrEqual(41);
  });

  it('needs a rhythm: three steps then a long pause count nothing', () => {
    const d = createStepDetector();
    // Three bounces at walking pace, then stillness for 5 s, three more.
    const three = (t: number) => (t % 6 < 1.5 ? walk2Hz()(t) : 0);
    feed(d, { from: 0, to: 18, hz: 60, shape: three }, 0.05);
    expect(d.count).toBe(0);
  });

  it('commits the first steps of a run together once the rhythm is there', () => {
    const d = createStepDetector();
    let committed: number[] = [];
    for (let t = 0; t < 10; t += 1 / 60) {
      const added = d.push(t * 1000, 0, G + walk2Hz()(t), 0);
      if (added) committed = [...committed, added];
    }
    expect(committed[0]).toBe(STEPS.minRun);
    expect(committed.slice(1).every(n => n === 1)).toBe(true);
  });

  it('says when each committed step happened, so a run confirmed after midnight can still be dated (N03)', () => {
    const d = createStepDetector();
    const times: number[] = [];
    for (let t = 0; t < 10; t += 1 / 60) {
      const at = t * 1000;
      const added = d.push(at, 0, G + walk2Hz()(t), 0);
      expect(d.lastCommitted).toHaveLength(added);
      // Every step happened at or before the sample that confirmed it.
      for (const p of d.lastCommitted) expect(p).toBeLessThanOrEqual(at);
      times.push(...d.lastCommitted);
    }
    expect(times).toHaveLength(d.count);
    // One per peak, in order, half a second apart at 2 Hz.
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps.every(g => g > 400 && g < 600)).toBe(true);
    // The first commit holds the steps that started the run, before the one confirming it.
    expect(times[STEPS.minRun - 1] - times[0]).toBeGreaterThan(1000);
  });

  it('keeps the total through a reset, and ignores samples that go backwards', () => {
    const d = createStepDetector();
    feed(d, { from: 0, to: 10, hz: 60, shape: walk2Hz() }, 0.05);
    const total = d.count;
    expect(total).toBeGreaterThan(15);
    d.reset();
    expect(d.count).toBe(total);
    expect(d.push(5_000, 0, G + 5, 0)).toBe(0);
    expect(d.push(Number.NaN, 0, G, 0)).toBe(0);
  });
});
