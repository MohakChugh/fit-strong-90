import { describe, it, expect } from 'vitest';
import { exerciseAnimations, getExerciseAnimation } from './animations';
import { resolvePose, type ResolvedJoints } from './rig';
import { exercises } from '@/data/exercises';

/**
 * Geometry guardrails for the exercise animations.
 *
 * These catch the failure mode that is easy to introduce and hard to notice:
 * a mis-signed joint angle that sends a limb off-canvas or through the floor.
 * Eyeballing 45 figures is unreliable; asserting the joint bounds is not.
 */

const VIEW_MIN = -2;
const VIEW_MAX = 102;
const FLOOR_Y = 92;

function allJoints(j: ResolvedJoints): [string, { x: number; y: number }][] {
  return Object.entries(j) as [string, { x: number; y: number }][];
}

describe('animation coverage', () => {
  it('defines an animation for every exercise in the library', () => {
    const missing = exercises
      .filter(ex => !getExerciseAnimation(ex.id))
      .map(ex => ex.id);
    expect(missing).toEqual([]);
  });

  it('has no animation keyed to a non-existent exercise', () => {
    const ids = new Set(exercises.map(e => e.id));
    const orphans = Object.keys(exerciseAnimations).filter(k => !ids.has(k));
    expect(orphans).toEqual([]);
  });

  it('covers all 45 exercises', () => {
    expect(exercises).toHaveLength(45);
    expect(Object.keys(exerciseAnimations)).toHaveLength(45);
  });
});

describe('animation metadata', () => {
  it('every animation has at least two poses so it can move', () => {
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      expect(anim.poses.length, `${id} pose count`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every animation names at least one worked muscle region', () => {
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      expect(anim.emphasis.length, `${id} emphasis`).toBeGreaterThan(0);
    }
  });

  it('rep durations are in a plausible range', () => {
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      expect(anim.duration, `${id} duration`).toBeGreaterThanOrEqual(1.2);
      expect(anim.duration, `${id} duration`).toBeLessThanOrEqual(6);
    }
  });

  it('contractionIndex, when set, points at a real pose', () => {
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      if (anim.contractionIndex !== undefined) {
        expect(anim.contractionIndex, `${id} contractionIndex`).toBeLessThan(anim.poses.length);
        expect(anim.contractionIndex, `${id} contractionIndex`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("each animation's emphasis overlaps the exercise's own muscle data", () => {
    // Guards against copy-paste errors where an animation is attached to the
    // wrong exercise: a chest press should not be emphasising calves.
    const regionAliases: Record<string, string[]> = {
      chest: ['chest', 'pectoral', 'upper chest'],
      back: ['back', 'lat', 'trap', 'delt', 'spine'],
      shoulders: ['delt', 'shoulder', 'rotator'],
      biceps: ['bicep', 'brachialis', 'forearm'],
      triceps: ['tricep'],
      quads: ['quad', 'leg'],
      hamstrings: ['hamstring'],
      glutes: ['glute', 'hip'],
      calves: ['calf', 'calves'],
      core: ['core', 'abs', 'oblique', 'respiratory'],
      cardio: ['cardio', 'cardiovascular', 'leg', 'quad'],
    };

    const mismatches: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      const ex = exercises.find(e => e.id === id);
      if (!ex) continue;
      const muscleText = [...ex.primaryMuscles, ...ex.secondaryMuscles, ex.category]
        .join(' ')
        .toLowerCase();
      const anyMatch = anim.emphasis.some(region =>
        (regionAliases[region] ?? [region]).some(alias => muscleText.includes(alias))
      );
      if (!anyMatch) {
        mismatches.push(`${id}: emphasis [${anim.emphasis}] vs muscles "${muscleText}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('pose geometry', () => {
  it('keeps every joint inside the viewBox', () => {
    const offCanvas: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      anim.poses.forEach((pose, i) => {
        for (const [name, p] of allJoints(resolvePose(pose))) {
          if (p.x < VIEW_MIN || p.x > VIEW_MAX || p.y < VIEW_MIN || p.y > VIEW_MAX) {
            offCanvas.push(`${id} pose[${i}].${name} at (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
          }
        }
      });
    }
    expect(offCanvas).toEqual([]);
  });

  it('does not sink feet through the floor', () => {
    const sunk: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      // Only meaningful for exercises drawn against a floor or mat.
      const grounded = anim.props.some(p => p.kind === 'floor' || p.kind === 'mat');
      if (!grounded) continue;
      anim.poses.forEach((pose, i) => {
        const j = resolvePose(pose);
        if (j.ankle.y > FLOOR_Y + 4) {
          sunk.push(`${id} pose[${i}] near foot y=${j.ankle.y.toFixed(0)}`);
        }
        if (j.farAnkle.y > FLOOR_Y + 4) {
          sunk.push(`${id} pose[${i}] far foot y=${j.farAnkle.y.toFixed(0)}`);
        }
      });
    }
    expect(sunk).toEqual([]);
  });

  it('keeps the head above the floor', () => {
    const grounded: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      anim.poses.forEach((pose, i) => {
        const j = resolvePose(pose);
        if (j.head.y > FLOOR_Y) {
          grounded.push(`${id} pose[${i}] head y=${j.head.y.toFixed(0)}`);
        }
      });
    }
    expect(grounded).toEqual([]);
  });

  it('produces visible movement between consecutive poses', () => {
    // A "2-pose" animation whose poses are nearly identical would render as a
    // static figure, silently defeating the whole feature.
    const stationary: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      let maxDelta = 0;
      for (let i = 1; i < anim.poses.length; i += 1) {
        const a = resolvePose(anim.poses[i - 1]);
        const b = resolvePose(anim.poses[i]);
        for (const [name, pa] of allJoints(a)) {
          const pb = (b as unknown as Record<string, { x: number; y: number }>)[name];
          maxDelta = Math.max(maxDelta, Math.hypot(pb.x - pa.x, pb.y - pa.y));
        }
      }
      if (maxDelta < 3) stationary.push(`${id} max joint travel ${maxDelta.toFixed(1)}`);
    }
    expect(stationary).toEqual([]);
  });

  it('does not fold the body double', () => {
    // The real "folded" signal is the ANGLE between the torso and the thigh,
    // not which side of the hip they land on. A hinged-over row correctly has
    // the torso forward and the legs down (~100 deg apart); a broken lying pose
    // has both pointing the same way (~5 deg apart). Comparing x-sides would
    // wrongly flag the row, so compare directions instead.
    const folded: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      anim.poses.forEach((pose, i) => {
        const rad = (d: number) => (d * Math.PI) / 180;
        // Torso runs up-and-away from the hip at (180 - lean).
        const torsoDir = { x: Math.sin(rad(pose.torso)), y: -Math.cos(rad(pose.torso)) };
        const thighDir = { x: Math.sin(rad(pose.thigh)), y: Math.cos(rad(pose.thigh)) };
        const dot = torsoDir.x * thighDir.x + torsoDir.y * thighDir.y;
        const deg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
        if (deg < 50) folded.push(`${id} pose[${i}]: torso and thigh only ${deg.toFixed(0)} deg apart`);
      });
    }
    expect(folded).toEqual([]);
  });

  it('keeps planted hands and feet near the floor when one is drawn', () => {
    // A figure whose hands float mid-air (or sink below the floor) in a
    // push-up or plank reads as broken regardless of overall proportions.
    const GROUND_CONTACT = new Set(['push-ups', 'plank']);
    const offGround: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      if (!GROUND_CONTACT.has(id)) continue;
      anim.poses.forEach((pose, i) => {
        const j = resolvePose(pose);
        const contact = id === 'plank' ? j.elbow : j.wrist;
        if (Math.abs(contact.y - FLOOR_Y) > 6) {
          offGround.push(`${id} pose[${i}] support y=${contact.y.toFixed(0)} vs floor ${FLOOR_Y}`);
        }
        if (Math.abs(j.ankle.y - FLOOR_Y) > 8) {
          offGround.push(`${id} pose[${i}] foot y=${j.ankle.y.toFixed(0)} vs floor ${FLOOR_Y}`);
        }
      });
    }
    expect(offGround).toEqual([]);
  });

  it('keeps limb lengths constant across poses (rig invariant)', () => {
    // This is the property that makes angle-based posing worth it. If it ever
    // fails, the renderer is interpolating coordinates somewhere it should not.
    const drift: string[] = [];
    for (const [id, anim] of Object.entries(exerciseAnimations)) {
      const lengths = anim.poses.map(pose => {
        const j = resolvePose(pose);
        return {
          upperArm: Math.hypot(j.elbow.x - j.shoulder.x, j.elbow.y - j.shoulder.y),
          foreArm: Math.hypot(j.wrist.x - j.elbow.x, j.wrist.y - j.elbow.y),
          thigh: Math.hypot(j.knee.x - j.hip.x, j.knee.y - j.hip.y),
          shin: Math.hypot(j.ankle.x - j.knee.x, j.ankle.y - j.knee.y),
        };
      });
      for (const key of ['upperArm', 'foreArm', 'thigh', 'shin'] as const) {
        const values = lengths.map(l => l[key]);
        const spread = Math.max(...values) - Math.min(...values);
        if (spread > 0.01) drift.push(`${id} ${key} varies by ${spread.toFixed(3)}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
