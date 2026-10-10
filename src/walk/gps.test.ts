import { describe, expect, it } from 'vitest';
import { createTrack, GPS, metresBetween, type Fix, type Track } from './gps';

/** A seeded generator, so a noisy test fails the same way every time. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function gaussian(rand: () => number) {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

const R = 6_371_008.8;
const START = { lat: 12.9716, lon: 77.5946 }; // Bengaluru
const T0 = Date.UTC(2026, 9, 8, 13, 0, 0);

/** A point `north` and `east` metres from `from`. */
function offset(from: { lat: number; lon: number }, north: number, east: number) {
  return {
    lat: from.lat + (north / R) * (180 / Math.PI),
    lon: from.lon + (east / (R * Math.cos((from.lat * Math.PI) / 180))) * (180 / Math.PI),
  };
}

interface PathOptions {
  /** Seconds after T0. */
  from?: number;
  seconds: number;
  /** Metres per second, north-east. */
  speed: number;
  /** Fixes per second. */
  hz?: number;
  accuracy?: number;
  /** Independent noise per fix, metres (1 sd per axis). */
  noise?: number;
  /** Slow drift added to the noise, metres per √s, to model correlated GPS error. */
  drift?: number;
  seed?: number;
  origin?: { lat: number; lon: number };
}

/** Fixes along a straight north-east line, as a phone would report them. */
function path(o: PathOptions): Fix[] {
  const n = gaussian(random(o.seed ?? 1));
  const hz = o.hz ?? 1;
  const fixes: Fix[] = [];
  let driftN = 0;
  let driftE = 0;
  for (let i = 0; i <= o.seconds * hz; i++) {
    const t = (o.from ?? 0) + i / hz;
    const along = o.speed * (t - (o.from ?? 0));
    if (o.drift) {
      driftN += o.drift * n() / Math.sqrt(hz);
      driftE += o.drift * n() / Math.sqrt(hz);
    }
    const p = offset(o.origin ?? START, along / Math.SQRT2 + (o.noise ?? 0) * n() + driftN, along / Math.SQRT2 + (o.noise ?? 0) * n() + driftE);
    fixes.push({ ...p, accuracy: o.accuracy ?? 5, timestamp: T0 + t * 1000 });
  }
  return fixes;
}

/** Deliver fixes as they arrive: each one a moment after it was taken. */
function play(track: Track, fixes: Fix[], lagMs = 200) {
  return fixes.map(f => track.push(f, f.timestamp + lagMs));
}

describe('distance', () => {
  it('measures a noisy straight walk to within 5%', () => {
    for (const seed of [1, 2, 3]) {
      const track = createTrack(T0);
      play(track, path({ seconds: 300, speed: 1.3, noise: 2, seed }));
      expect(track.distanceM).toBeGreaterThan(390 * 0.95);
      expect(track.distanceM).toBeLessThan(390 * 1.05);
    }
  });

  it('measures a walk whose error drifts, as real GPS error does', () => {
    const track = createTrack(T0);
    play(track, path({ seconds: 300, speed: 1.3, noise: 1, drift: 0.3, seed: 4 }));
    expect(track.distanceM).toBeGreaterThan(390 * 0.93);
    expect(track.distanceM).toBeLessThan(390 * 1.07);
  });

  it('adds almost nothing while the person stands still', () => {
    // Raw fix-to-fix hops here would sum to well over a kilometre in 5 minutes.
    const sharp = createTrack(T0);
    const fixes = path({ seconds: 300, speed: 0, noise: 2, seed: 5 });
    play(sharp, fixes);
    const hops = fixes.slice(1).reduce((m, f, i) => m + metresBetween(fixes[i], f), 0);
    expect(hops).toBeGreaterThan(500);
    expect(sharp.distanceM).toBeLessThan(10);

    const poor = createTrack(T0);
    play(poor, path({ seconds: 300, speed: 0, noise: 6, accuracy: 16, seed: 6 }));
    expect(poor.distanceM).toBeLessThan(25);
  });

  it('refuses fixes that are too uncertain', () => {
    const track = createTrack(T0);
    const verdicts = play(track, path({ seconds: 60, speed: 1.3, accuracy: GPS.maxAccuracyM + 1 }));
    expect(verdicts.every(v => v === 'inaccurate')).toBe(true);
    expect(track.distanceM).toBe(0);
    expect(track.accepted).toBe(0);
  });

  it('reads a claimed accuracy of 0 as 1 m rather than refusing or dividing by it', () => {
    const track = createTrack(T0);
    const verdicts = play(track, path({ seconds: 120, speed: 1.3, accuracy: 0 }));
    expect(verdicts.every(v => v === 'accepted')).toBe(true);
    expect(track.distanceM).toBeGreaterThan(156 * 0.95);
    expect(track.distanceM).toBeLessThan(156 * 1.05);
  });

  it('accepts fixes right at the accuracy limit', () => {
    const track = createTrack(T0);
    const verdicts = play(track, path({ seconds: 10, speed: 1.3, accuracy: GPS.maxAccuracyM }));
    expect(verdicts.every(v => v === 'accepted')).toBe(true);
  });

  it('refuses stale, cached and out-of-order fixes', () => {
    const track = createTrack(T0 + 60_000);
    const [a, b] = path({ from: 60, seconds: 1, speed: 1.3 });
    // From before this segment, though only seconds old: a position cached while the app was away.
    expect(track.push({ ...a, timestamp: T0 + 55_000 }, T0 + 61_000)).toBe('stale');
    // Taken 20 s before it arrived.
    expect(track.push(a, a.timestamp + GPS.maxFixAgeMs + 5_000)).toBe('stale');
    // Stamped well in the future.
    expect(track.push({ ...a, timestamp: T0 + 600_000 }, T0 + 61_000)).toBe('stale');
    expect(track.push(b, b.timestamp)).toBe('accepted');
    expect(track.push(a, b.timestamp + 500)).toBe('stale');
    expect(track.accepted).toBe(1);
  });

  it('refuses malformed fixes', () => {
    const track = createTrack(T0);
    const [a] = path({ seconds: 0, speed: 0 });
    expect(track.push({ ...a, lat: Number.NaN }, a.timestamp)).toBe('invalid');
    expect(track.push({ ...a, lat: 91 }, a.timestamp)).toBe('invalid');
    expect(track.push({ ...a, accuracy: -1 }, a.timestamp)).toBe('invalid');
    expect(track.push({ ...a, accuracy: Number.POSITIVE_INFINITY }, a.timestamp)).toBe('invalid');
  });

  it('ignores a single multipath jump', () => {
    const fixes = path({ seconds: 120, speed: 1.3, noise: 1, seed: 8 });
    fixes[60] = { ...fixes[60], ...offset(fixes[60], 80, 0) };
    const track = createTrack(T0);
    const verdicts = play(track, fixes);
    expect(verdicts[60]).toBe('jump');
    expect(track.distanceM).toBeGreaterThan(156 * 0.94);
    expect(track.distanceM).toBeLessThan(156 * 1.05);
  });

  it('recovers from a bad first fix without counting the distance to it', () => {
    const fixes = path({ seconds: 120, speed: 1.3, noise: 1, seed: 9 });
    const bad = { ...fixes[0], ...offset(fixes[0], 0, 150) };
    const track = createTrack(T0);
    play(track, [bad, ...fixes.slice(1)]);
    // The walk from the first good fix onwards, not the 150 m back from the bad one.
    expect(track.distanceM).toBeGreaterThan(150 * 0.9);
    expect(track.distanceM).toBeLessThan(156 * 1.05);
  });

  it('does not count a ride as walking', () => {
    const walkIn = path({ seconds: 60, speed: 1.3, noise: 1, seed: 10 });
    const end = walkIn[walkIn.length - 1];
    const ride = path({ from: 61, seconds: 120, speed: 9, noise: 1, seed: 11, origin: end });
    const track = createTrack(T0);
    play(track, [...walkIn, ...ride]);
    // About 78 m walked; the 1 km ride adds nothing.
    expect(track.distanceM).toBeLessThan(78 * 1.15);
  });
});

describe('a signal gap', () => {
  it('F15: never bridges a GPS outage with distance', () => {
    // 1 m/s north for 60 s, a minute of silence, then a fresh fix 120 m from
    // the start. The 65 m between is not walked as far as GPS can say.
    const track = createTrack(T0);
    const before = path({ seconds: 60, speed: 1, noise: 0 });
    play(track, before);
    const walkedBefore = track.distanceM;
    expect(walkedBefore).toBeGreaterThan(50);
    expect(walkedBefore).toBeLessThan(61);
    const back = { ...offset(START, 120 / Math.SQRT2, 120 / Math.SQRT2), accuracy: 5, timestamp: T0 + 120_000 };
    expect(track.push(back, back.timestamp + 200)).toBe('accepted');
    expect(track.distanceM).toBe(walkedBefore);
    expect(track.coveredMs).toBe(60_000);
  });

  it('keeps each stretch of signal as its own run, times only', () => {
    const track = createTrack(T0);
    play(track, path({ seconds: 60, speed: 1.3, noise: 0 }));
    const resume = path({ from: 120, seconds: 60, speed: 1.3, noise: 0, origin: offset(START, 300, 0) });
    play(track, resume);
    expect(track.runs).toHaveLength(2);
    expect(track.runs.map(r => [r.start - T0, r.end - T0])).toEqual([[0, 60_000], [120_000, 180_000]]);
    expect(track.runs.reduce((t, r) => t + r.distanceM, 0)).toBeCloseTo(track.distanceM, 6);
    // A run holds when and how far, never where.
    expect(Object.keys(track.runs[0]).sort()).toEqual(['distanceM', 'end', 'start']);
  });

  it('starts a run at the segment, never before it, for a fix stamped just ahead of it', () => {
    const track = createTrack(T0 + 1_000);
    const [early] = path({ from: 0.5, seconds: 0, speed: 0 });
    track.push(early, T0 + 1_100);
    expect(track.runs[0].start).toBe(T0 + 1_000);
  });

  it('warms the pace up again after an outage, rather than spanning it', () => {
    const track = createTrack(T0);
    play(track, path({ seconds: 90, speed: 1.3, noise: 0.5 }));
    expect(track.readout(T0 + 90_200).state).toBe('ok');
    // Back a minute later, 60 m on: a distance a walker could cover, so only
    // the gap itself can stop the pace being read across it.
    const walkedTo = offset(START, 117 / Math.SQRT2 + 60, 117 / Math.SQRT2);
    play(track, path({ from: 150, seconds: 10, speed: 1.3, noise: 0.5, origin: walkedTo }));
    expect(track.readout(T0 + 160_200).state).toBe('measuring');
  });
});

describe('pace', () => {
  const pace = 1000 / 1.3; // 12:49 per km

  it('waits for a first fix, then for enough walking, before showing a pace', () => {
    const track = createTrack(T0);
    expect(track.readout(T0 + 5_000).state).toBe('acquiring');
    const fixes = path({ seconds: 120, speed: 1.3, noise: 1, seed: 12 });
    const states = fixes.map(f => {
      track.push(f, f.timestamp + 200);
      return { t: (f.timestamp - T0) / 1000, ...track.readout(f.timestamp + 200) };
    });
    const firstOk = states.find(s => s.state === 'ok');
    expect(states[5].state).toBe('measuring');
    expect(states[25].state).toBe('measuring');
    expect(firstOk).toBeDefined();
    expect(firstOk!.t).toBeGreaterThanOrEqual(GPS.paceMinSpanMs / 1000);
    expect(firstOk!.t).toBeLessThan(45);
  });

  it('settles on the walking pace and stays steady', () => {
    const readingsOf = (noise: number, seed: number) => {
      const track = createTrack(T0);
      const readings: number[] = [];
      for (const f of path({ seconds: 600, speed: 1.3, noise, seed })) {
        track.push(f, f.timestamp + 200);
        const r = track.readout(f.timestamp + 200);
        if (f.timestamp - T0 > 90_000 && r.state === 'ok') readings.push(r.secPerKm!);
      }
      return readings;
    };

    // Even with noisier fixes than an iPhone outdoors gives, within 10%.
    const noisy = readingsOf(2, 13);
    expect(noisy.length).toBeGreaterThan(450);
    for (const r of noisy) {
      expect(r).toBeGreaterThan(pace * 0.9);
      expect(r).toBeLessThan(pace * 1.1);
    }

    // Smoothed: consecutive readings never lurch.
    const steady = readingsOf(1, 14);
    const steps = steady.slice(1).map((r, i) => Math.abs(r - steady[i]) / steady[i]);
    expect(Math.max(...steps)).toBeLessThan(0.04);
  });

  it('says still when the person stops, and finds the pace again when they walk on', () => {
    const walking = path({ seconds: 120, speed: 1.3, noise: 1, seed: 14 });
    const here = walking[walking.length - 1];
    const standing = path({ from: 121, seconds: 60, speed: 0, noise: 1, seed: 15, origin: here });
    const again = path({ from: 182, seconds: 120, speed: 1.3, noise: 1, seed: 16, origin: here });
    const track = createTrack(T0);
    const at = (fixes: Fix[]) => {
      play(track, fixes);
      const lastFix = fixes[fixes.length - 1];
      return track.readout(lastFix.timestamp + 200);
    };
    expect(at(walking).state).toBe('ok');
    expect(at(standing).state).toBe('still');
    const resumed = at(again);
    expect(resumed.state).toBe('ok');
    expect(resumed.secPerKm!).toBeGreaterThan(pace * 0.85);
    expect(resumed.secPerKm!).toBeLessThan(pace * 1.15);
  });

  it('says the signal is lost when fixes stop, and weak when only poor ones arrive', () => {
    const fixes = path({ seconds: 60, speed: 1.3, noise: 1, seed: 17 });
    const track = createTrack(T0);
    play(track, fixes);
    const end = fixes[fixes.length - 1].timestamp;
    expect(track.readout(end + 5_000).state).toBe('ok');
    expect(track.readout(end + GPS.lostAfterMs + 1_000).state).toBe('lost');

    const indoors = createTrack(T0);
    for (const f of path({ seconds: 90, speed: 1.3, accuracy: 65 })) indoors.push(f, f.timestamp + 200);
    expect(indoors.readout(T0 + 20_000).state).toBe('acquiring');
    expect(indoors.readout(T0 + 90_500).state).toBe('weak');

    const silent = createTrack(T0);
    expect(silent.readout(T0 + GPS.firstFixGraceMs + 1_000).state).toBe('lost');
  });

  it('keeps the signal alive when the same fix is delivered again', () => {
    const [a] = path({ seconds: 0, speed: 0 });
    const track = createTrack(T0);
    track.push(a, T0 + 200);
    expect(track.push(a, T0 + 15_000)).toBe('stale');
    expect(track.readout(T0 + 30_000).state).not.toBe('lost');
  });
});

describe('metresBetween', () => {
  it('measures across the antimeridian the short way', () => {
    expect(metresBetween({ lat: 0, lon: 179.9999 }, { lat: 0, lon: -179.9999 })).toBeLessThan(30);
  });

  it('agrees with a known distance', () => {
    // One degree of latitude is about 111.2 km.
    expect(metresBetween({ lat: 12, lon: 77 }, { lat: 13, lon: 77 })).toBeCloseTo(111_195, -2);
  });
});
