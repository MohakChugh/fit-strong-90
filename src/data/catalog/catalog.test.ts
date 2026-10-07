import { describe, it, expect } from 'vitest';
import { CATALOG, STRENGTH, MOBILITY, CARDIO, getMeta, canonicalId, hasEquipment, EQUIPMENT_BY_ACCESS, getStrength } from './index';
import { LEGACY_IDS } from '@/data/exercises';
import { MOBILITY_REGIONS } from '@/types/catalog';

describe('catalogue integrity', () => {
  it('has unique kebab-case ids', () => {
    const ids = CATALOG.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keeps every legacy exercise id so history still resolves', () => {
    const missing = LEGACY_IDS.filter(id => !getMeta(id));
    expect(missing).toEqual([]);
  });

  it('points every regression and swap at an existing, active entry', () => {
    const problems: string[] = [];
    for (const m of STRENGTH) {
      if (m.regressionId && !getMeta(m.regressionId)) problems.push(`${m.id} → ${m.regressionId}`);
    }
    for (const m of MOBILITY) {
      if (!m.irritableSwap) continue;
      const swap = getMeta(m.irritableSwap);
      if (!swap) problems.push(`${m.id} swap → ${m.irritableSwap}`);
      else if (swap.kind === 'mobility' && swap.status === 'avoidWhenIrritable') problems.push(`${m.id} swaps to another irritable item`);
    }
    expect(problems).toEqual([]);
  });

  it('has regression chains that terminate without cycles', () => {
    for (const start of STRENGTH) {
      const seen = new Set<string>();
      let id: string | undefined = start.id;
      while (id) {
        expect(seen.has(id), `cycle from ${start.id} at ${id}`).toBe(false);
        seen.add(id);
        id = getStrength(id)?.regressionId;
      }
    }
  });

  it('gives every active strength exercise a pattern and a plausible setup time', () => {
    for (const m of STRENGTH.filter(s => !s.retired)) {
      expect(m.patterns.length, m.id).toBeGreaterThan(0);
      expect(m.setupSeconds, m.id).toBeGreaterThanOrEqual(15);
      expect(m.setupSeconds, m.id).toBeLessThanOrEqual(90);
    }
  });

  it('matches the spec on key safety flags', () => {
    expect(getStrength('russian-twist')?.flags).toMatchObject({ spinalFlexion: 2, loadedRotation: true });
    expect(getStrength('deadlift')?.ladder).toEqual({ track: 'hinge', level: 4 });
    expect(getStrength('trap-bar-deadlift')?.ladder).toEqual({ track: 'hinge', level: 2 });
    expect(getStrength('barbell-squat')?.ladder).toEqual({ track: 'squat', level: 4 });
    expect(getStrength('romanian-deadlift')?.flags.sciaticTension).toBe(2);
  });

  it('flags every drill that loads the foot, standing or seated (spec §4.6 FOOT)', () => {
    const FOOT_LOADING = ['squat', 'hinge', 'lunge', 'calf', 'carry'];
    // Bodyweight floor drills are what the FOOT rule leaves available.
    const FLOOR = ['glute-bridge'];
    const missing = STRENGTH
      .filter(m => !m.retired && !FLOOR.includes(m.id) && m.patterns.some(p => FOOT_LOADING.includes(p)) && !m.flags.weightBearing)
      .map(m => m.id);
    expect(missing).toEqual([]);
    expect(getStrength('leg-press')?.flags.weightBearing).toBe(true);
    expect(getStrength('seated-calf-raise')?.flags.weightBearing).toBe(true);
    expect(getStrength('glute-bridge')?.flags.weightBearing).toBeUndefined();
  });

  it('tags the core drills IH and VR1 as Appendix A does', () => {
    for (const id of ['dead-bug', 'mcgill-curl-up', 'plank']) {
      expect(getStrength(id)?.flags, id).toMatchObject({ isometricHold: expect.any(Number), valsalva: 1 });
    }
    for (const id of ['bird-dog', 'side-plank', 'pallof-press']) {
      expect(getStrength(id)?.flags.isometricHold, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('grades a sustained brace apart from a paused rep', () => {
    // Grade 2 is the drill *being* the hold; grade 1 is a pause inside a rep.
    for (const id of ['plank', 'side-plank', 'mcgill-curl-up']) {
      expect(getStrength(id)?.flags.isometricHold, id).toBe(2);
    }
    for (const id of ['dead-bug', 'bird-dog', 'pallof-press']) {
      expect(getStrength(id)?.flags.isometricHold, id).toBe(1);
    }
  });

  it('has a seated leg curl gated by sciatic tension (Appendix A: when sciatica is quiet)', () => {
    const seated = STRENGTH.find(m => m.name === 'Seated Leg Curl');
    expect(seated?.flags.sciaticTension).toBe(1);
    expect(getStrength('lying-leg-curl')?.flags.sciaticTension).toBeUndefined();
  });

  it('uses valid mobility regions and plausible doses', () => {
    for (const m of MOBILITY) {
      expect(m.regions.length, m.id).toBeGreaterThan(0);
      for (const r of m.regions) expect(MOBILITY_REGIONS).toContain(r);
      if (m.mode === 'hold') {
        expect(m.dose.holdSeconds, m.id).toBeGreaterThanOrEqual(10);
        expect(m.dose.holdSeconds, m.id).toBeLessThanOrEqual(90);
      } else {
        expect(m.dose.reps, m.id).toBeGreaterThan(0);
        expect(m.dose.secondsPerRep, m.id).toBeGreaterThan(0);
      }
    }
  });

  it('runs sciatic nerve glides affected side first', () => {
    for (const m of MOBILITY.filter(x => x.mode === 'slider')) expect(m.dose.sides).toBe('affectedFirst');
  });

  it('excludes the knee-to-opposite-shoulder stretch from plans', () => {
    expect(getMeta('knee-to-opposite-shoulder')).toMatchObject({ status: 'excluded', retired: true });
  });

  it('maps legacy mobility ids to their replacements', () => {
    expect(canonicalId('hip-opener-stretch')).toBe('half-kneeling-hip-flexor-stretch');
    expect(canonicalId('hamstring-stretch')).toBe('supine-hamstring-stretch-strap');
    expect(canonicalId('face-pulls-shoulder')).toBe('face-pull');
    expect(canonicalId('lat-pulldown')).toBe('lat-pulldown');
  });

  it('includes the six cardio modalities', () => {
    expect(CARDIO.map(c => c.id).sort()).toEqual(
      ['brisk-walking', 'elliptical', 'recumbent-bike', 'rowing-machine', 'stationary-bike', 'treadmill-walk'],
    );
  });
});

describe('equipment', () => {
  it('accepts an alternative equipment set', () => {
    const pallof = getMeta('pallof-press')!;
    expect(hasEquipment(pallof, EQUIPMENT_BY_ACCESS.homeDumbbells)).toBe(true);
    expect(hasEquipment(pallof, EQUIPMENT_BY_ACCESS.homeNone)).toBe(false);
  });

  it('treats bodyweight exercises as always available', () => {
    expect(hasEquipment(getMeta('push-ups')!, EQUIPMENT_BY_ACCESS.homeNone)).toBe(true);
  });
});
