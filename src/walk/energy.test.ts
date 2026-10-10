import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import { finishWalk, startWalk, updateOpenSegment } from './clock';
import {
  ADULT_WALKING, MPH_PER_MPS, OLDER_ADULT_WALKING, ageBand, energyText, estimateEnergy, roundKcal, walkEnergy, walkingMet, weightAt,
} from './energy';

const at3mph = (ms: number) => ({ ms, metres: (3 / MPH_PER_MPS) * (ms / 1000) });
const T = Date.parse('2026-10-08T03:30:00Z');
const weight = (at: string, kg: number) => newObservation({ kind: 'weight', value: kg, scope: 'pointInTime', source: 'manual', at });
const tenMinutes = () => finishWalk(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T), T + 600_000, 'finish');

describe('the 2024 Adult Compendium’s walking bands (J§12.4)', () => {
  it('cover every speed from a standstill to 5 mph, a gap between rows taking the slower row’s value', () => {
    const met = (mph: number) => walkingMet(mph, ADULT_WALKING)?.met;
    expect([0.5, 1.99, 2.0, 2.4, 2.45, 2.5, 2.7, 2.8, 3.4, 3.45, 3.5, 3.9, 4.0, 4.4, 4.5, 4.9].map(met))
      .toEqual([2.3, 2.3, 2.8, 2.8, 2.8, 3.0, 3.0, 3.8, 3.8, 3.8, 4.8, 4.8, 5.5, 5.5, 7.0, 7.0]);
    expect(ADULT_WALKING.map(b => b.code)).toEqual(['17151', '17152', '17170', '17190', '17200', '17220', '17230']);
  });

  it('give no value at 5 mph or faster, or for a speed that isn’t one (B-18)', () => {
    expect(walkingMet(5.0, ADULT_WALKING)).toBeUndefined();
    expect(walkingMet(Number.NaN, ADULT_WALKING)).toBeUndefined();
    expect(walkingMet(-1, ADULT_WALKING)).toBeUndefined();
  });
});

describe('active energy (V7, A-50, B-17)', () => {
  it('works the spec’s example: 70 kg, 30 min at 3 mph, about 100 kcal', () => {
    const e = estimateEnergy({ runs: [at3mph(1_800_000)], observedMs: 1_800_000, kg: 70, band: 'adult' });
    expect(e).toMatchObject({ kind: 'about', rounded: 100, coveredMs: 1_800_000, uncoveredMs: 0 });
    if (e.kind === 'about') expect(e.kcal).toBeCloseTo(98, 5);
  });

  it('counts time without distance at the slow-pace value, and says how much did', () => {
    const e = estimateEnergy({ runs: [], observedMs: 600_000, kg: 78, band: 'adult' });
    expect(e).toMatchObject({ kind: 'about', rounded: 20, uncoveredMs: 600_000 });
    expect(energyText(e, { kg: 78, from: 'profile' })).toEqual({
      value: 'about 20 kcal',
      detail: 'From 10 min without distance, counted at an easy pace. Using 78 kg, from your profile.',
    });
  });

  it('treats a run too thin for a speed as time without distance', () => {
    expect(estimateEnergy({ runs: [{ ms: 30_000, metres: 40 }], observedMs: 600_000, kg: 78, band: 'adult' }))
      .toMatchObject({ kind: 'about', coveredMs: 0, uncoveredMs: 600_000 });
  });

  it('gives no estimate when part of the walk was faster than walking', () => {
    expect(estimateEnergy({ runs: [{ ms: 600_000, metres: 1600 }], observedMs: 600_000, kg: 78, band: 'adult' }))
      .toEqual({ kind: 'none', reason: 'tooFast' });
  });

  it('rounds to the nearest 10, and calls a walk too short for one below 5 kcal', () => {
    expect([4.9, 5, 14, 15, 98].map(roundKcal)).toEqual([undefined, 10, 10, 20, 100]);
    expect(estimateEnergy({ runs: [], observedMs: 120_000, kg: 78, band: 'adult' })).toEqual({ kind: 'none', reason: 'tooShort' });
  });

  it('asks for a weight when there is none', () => {
    expect(estimateEnergy({ runs: [], observedMs: 600_000, band: 'adult' })).toEqual({ kind: 'none', reason: 'noWeight' });
    expect(energyText({ kind: 'none', reason: 'noWeight' }).detail).toBe('Add your weight for an estimate.');
  });
});

describe('who an estimate is for (B-18, B-31; Review Focus 3)', () => {
  it('uses the Adult Compendium only for someone certainly 19 to 59 this year', () => {
    expect(ageBand(1982, 2026)).toBe('adult');
    expect(ageBand(2006, 2026)).toBe('adult');
    expect(ageBand(1967, 2026)).toBe('adult');
  });

  it('treats a borderline year conservatively, and no birth year as unknown', () => {
    expect(ageBand(2007, 2026)).toBe('young');
    expect(ageBand(1966, 2026)).toBe('older');
    expect(ageBand(undefined, 2026)).toBe('unknown');
  });

  it('gives no figure for 60 and over until the Older Adult values are confirmed, and none for the young or unknown', () => {
    const input = { runs: [], observedMs: 600_000, kg: 70 };
    expect(estimateEnergy({ ...input, band: 'older' }, { older: undefined })).toEqual({ kind: 'none', reason: 'olderUnconfirmed' });
    expect(estimateEnergy({ ...input, band: 'young' })).toEqual({ kind: 'none', reason: 'young' });
    expect(estimateEnergy({ ...input, band: 'unknown' })).toEqual({ kind: 'none', reason: 'unknownAge' });
    expect(energyText({ kind: 'none', reason: 'olderUnconfirmed' }).detail).toBe('Estimates for ages 60 and over aren’t available yet.');
  });
});

describe('a walk’s estimate (A-36, B-16)', () => {
  it('uses the weight in effect when the walk began, and records the weight it used', () => {
    const walk = tenMinutes();
    const r = walkEnergy(walk, {
      birthYear: 1982,
      observations: [weight('2026-10-01T08:00:00+05:30', 80), weight('2026-10-09T08:00:00+05:30', 70)],
      profileKg: 75,
    });
    expect(r.weight).toEqual({ kg: 80, from: 'reading', day: '2026-10-01' });
    expect(r.input).toMatchObject({ id: `${walk.id}:activeEnergy`, kind: 'activeEnergy', scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: `walk:${walk.id}` });
    expect(r.input?.note).toMatch(/Using 80 kg, your weight on 1 Oct\./);
  });

  it('falls back to the profile’s weight, which has no date of its own', () => {
    expect(weightAt([], T, 75)).toEqual({ kg: 75, from: 'profile' });
    expect(weightAt([], T, undefined)).toBeUndefined();
  });

  it('records nothing when there is no figure', () => {
    expect(walkEnergy(tenMinutes(), { birthYear: undefined, observations: [], profileKg: 75 }).input).toBeUndefined();
  });
});

describe('the edges of an estimate (Plan 6 Task 5, from mutation checks)', () => {
  const kg = 78;
  it('takes the latest weight at or before the walk, the later of two at one moment', () => {
    const atStart = new Date(T).toISOString();
    expect(weightAt([weight(atStart, 79)], T, 75)).toMatchObject({ kg: 79, from: 'reading' });
    expect(weightAt([weight('2026-09-01T08:00:00+05:30', 82), weight('2026-10-01T08:00:00+05:30', 80)], T, 75)?.kg).toBe(80);
    const [a, b] = [weight('2026-10-01T08:00:00+05:30', 81), weight('2026-10-01T08:00:00+05:30', 80)];
    expect(weightAt([{ ...a, seq: 2 }, { ...b, seq: 5 }], T, 75)?.kg).toBe(80);
    expect(weightAt([{ ...a, seq: 5 }, { ...b, seq: 2 }], T, 75)?.kg).toBe(81);
  });

  it('never uses a weight of nothing', () => {
    expect(weightAt([{ ...weight('2026-10-01T08:00:00+05:30', 80), value: 0 }], T, 75)).toEqual({ kg: 75, from: 'profile' });
    expect(weightAt([], T, 0)).toBeUndefined();
    expect(estimateEnergy({ runs: [], observedMs: 600_000, kg: 0, band: 'adult' })).toEqual({ kind: 'none', reason: 'noWeight' });
  });

  it('counts a run too short, or too thin, for a speed as time without distance', () => {
    for (const run of [{ ms: 50_000, metres: 120 }, { ms: 120_000, metres: 90 }]) {
      expect(estimateEnergy({ runs: [run], observedMs: 600_000, kg, band: 'adult' })).toMatchObject({ kind: 'about', coveredMs: 0, uncoveredMs: 600_000 });
    }
  });

  it('says how much had distance and how much didn’t, and the weight to a tenth', () => {
    const e = estimateEnergy({ runs: [at3mph(600_000)], observedMs: 900_000, kg: 78.25, band: 'adult' });
    expect(energyText(e, { kg: 78.25, from: 'profile' }).detail)
      .toBe('From 10 min with distance and 5 min without it, counted at an easy pace. Using 78.3 kg, from your profile.');
  });

  it('reads a walk by its plan, its accrued time and its own year', () => {
    const walked = (gps: boolean) => finishWalk(
      updateOpenSegment(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps, steps: false }, T), x => ({ ...x, gps: [{ start: T, end: T + 600_000, distanceM: 805 }] })),
      T + 600_000, 'finish');
    const ctx = { birthYear: 1982, observations: [], profileKg: kg };
    expect(walkEnergy(walked(true), ctx).estimate).toMatchObject({ coveredMs: 600_000 });
    expect(walkEnergy(walked(false), ctx).estimate).toMatchObject({ coveredMs: 0, uncoveredMs: 600_000 });
    // Its clock moved under it: four minutes accrued over a ten-minute span.
    const moved = walked(false);
    const short = { ...moved, segments: [{ ...moved.segments[0], accruedMs: 240_000 }] };
    expect(walkEnergy(short, ctx).input?.coverageMs).toBe(240_000);
    // Born in 1966: 59 or 60 in 2026, so the Older Adult values; certainly under 60 on a walk in 2025, so the Adult ones.
    const older = walkEnergy(walked(true), { ...ctx, birthYear: 1966 }).estimate;
    const lastYear = { ...walked(true), segments: walked(true).segments.map(x => ({ ...x, day: '2025-10-08' })) };
    const adult = walkEnergy(lastYear, { ...ctx, birthYear: 1966 }).estimate;
    // 805 m in 10 min is 3.0 mph: 1719060 (5.3) at 60 and over, 17190 (3.8) for adults.
    expect(older.kind === 'about' && adult.kind === 'about' && older.kcal / adult.kcal).toBeCloseTo(((5.3 - 1) * 2.7 / 3.5) / (3.8 - 1), 6);
  });
});

describe('60 and over (B-18, Task 6)', () => {
  it('uses the Older Adult Compendium’s values, as printed, against its own resting rate', () => {
    expect(OLDER_ADULT_WALKING?.bands.map(b => [b.fromMph, b.met, b.code])).toEqual([
      [0, 3.0, '1715160'], [1.0, 4.0, '1715260'], [2.0, 3.8, '1715360'], [2.2, 4.5, '1717060'],
      [2.8, 5.3, '1719060'], [3.3, 6.0, '1720060'], [4.0, 7.3, '1722060'], [4.5, 9.0, '1723060'],
    ]);
    // (5.3 − 1) × 2.7/3.5 × 70 kg × 0.5 h ≈ 116 → about 120.
    expect(estimateEnergy({ runs: [at3mph(1_800_000)], observedMs: 1_800_000, kg: 70, band: 'older' })).toMatchObject({ kind: 'about', rounded: 120 });
  });

  it('counts time without distance at the slow-pace row, and gives nothing at 5 mph or faster', () => {
    // (3.8 − 1) × 2.7/3.5 × 70 kg × 0.5 h ≈ 75.6 → about 80.
    expect(estimateEnergy({ runs: [], observedMs: 1_800_000, kg: 70, band: 'older' })).toMatchObject({ kind: 'about', rounded: 80 });
    expect(OLDER_ADULT_WALKING?.noDistance).toEqual({ fromMph: 2.0, met: 3.8, code: '1715360' });
    expect(walkingMet(5, OLDER_ADULT_WALKING!.bands)).toBeUndefined();
    expect(walkingMet(4.99, OLDER_ADULT_WALKING!.bands)?.met).toBe(9.0);
  });
});
