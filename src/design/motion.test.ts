import { describe, expect, it } from 'vitest';
import { MOTION, shouldAnimate, skipNextTransition, springAt, springLinear, transitionSkipped } from './motion';

describe('springAt (Apple duration/bounce model; design research §4.1)', () => {
  it('starts at 0, ends at 1, never overshoots with bounce 0', () => {
    expect(springAt(0, 0.4, 0)).toBe(0);
    for (let t = 0; t <= 1.5; t += 0.01) expect(springAt(t, 0.4, 0)).toBeLessThanOrEqual(1 + 1e-9);
    expect(springAt(1.5, 0.4, 0)).toBeGreaterThan(0.999);
  });
  it('reaches about 90% at about 42% of the settle time at bounce 0', () => {
    // settle (0.1%) ≈ 1.47 × 0.4 s = 0.588 s; 42% of that ≈ 0.247 s
    expect(springAt(0.247, 0.4, 0)).toBeGreaterThan(0.87);
    expect(springAt(0.247, 0.4, 0)).toBeLessThan(0.93);
  });
  it('overshoots slightly at bounce 0.15, and never more than 1%', () => {
    let peak = 0;
    for (let t = 0; t <= 1.5; t += 0.002) peak = Math.max(peak, springAt(t, 0.4, 0.15));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.01);
  });
});

describe('springLinear', () => {
  it('produces a CSS linear() list from 0 to 1', () => {
    const css = springLinear(0);
    expect(css.startsWith('linear(0,')).toBe(true);
    expect(css.endsWith(', 1)')).toBe(true);
  });
  it('matches the research token at bounce 0 within 0.01 at each step', () => {
    const research = [0, .058, .18, .321, .455, .573, .671, .75, .812, .86, .897, .924, .945, .96, .971, .979, .985, .989, .992, .994, .996, .997, .998, .999, 1];
    const mine = springLinear(0).slice('linear('.length, -1).split(',').map(Number);
    expect(mine).toHaveLength(research.length);
    mine.forEach((v, i) => expect(Math.abs(v - research[i])).toBeLessThan(0.01));
  });
});

describe('tokens', () => {
  it('has the spec’s durations', () => {
    expect(MOTION.fade).toBe(200);
    // The research's 588 ms and 441 ms. Settling is sampled every 1 ms and this
    // keeps the last sample still outside 0.1%, so these land at 587 and 440.
    expect(MOTION.spring.cssMs).toBeCloseTo(588, -1);
    expect(MOTION.springQuick.cssMs).toBeCloseTo(441, -1);
  });
});

describe('shouldAnimate (motion rule 4; Review Focus 5)', () => {
  it('animates only when neither the system nor the app asks for less motion', () => {
    expect(shouldAnimate({ systemReduced: false, appReduced: false })).toBe(true);
    expect(shouldAnimate({ systemReduced: true, appReduced: false })).toBe(false);
    expect(shouldAnimate({ systemReduced: false, appReduced: true })).toBe(false);
  });
});

describe('safety pre-empts every effect (motion rule 2)', () => {
  it('skips every view transition while an urgent decision stands', () => {
    expect(transitionSkipped({ urgent: true }, 1_000)).toBe(true);
    expect(transitionSkipped({ urgent: false }, 1_000)).toBe(false);
  });
  it('skips the next one once, when a tap opens a screen on a stop or a hold (M3)', () => {
    skipNextTransition(1_000);
    expect(transitionSkipped({ urgent: false }, 1_050)).toBe(true);
    expect(transitionSkipped({ urgent: false }, 1_100)).toBe(false);
  });
  it('forgets a request no navigation took up', () => {
    skipNextTransition(1_000);
    expect(transitionSkipped({ urgent: false }, 2_500)).toBe(false);
  });
});
