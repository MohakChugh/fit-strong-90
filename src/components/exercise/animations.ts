/**
 * Per-exercise form animations, keyed by the exercise ids in @/data/exercises.
 *
 * Each entry describes the movement as 2-3 joint-angle poses that the renderer
 * interpolates between. Angles follow the convention in ./rig.ts: degrees
 * clockwise from straight down, child limbs relative to their parent.
 *
 * Poses are ordered so pose[0] is the position you start and finish in, which
 * makes the loop read as a continuous rep.
 */

import type { ExerciseAnimation, Pose } from './rig';

// Common anchor points, to keep definitions readable.
const STANDING_HIP = { x: 50, y: 56 };
const FLOOR_Y = 92;

/** A neutral standing pose: upright torso, arms down, legs straight. */
const standing: Pose = {
  hip: STANDING_HIP,
  torso: 0,
  upperArm: 6,
  foreArm: 0,
  thigh: 4,
  shin: -2,
};

/** Seated on a machine or bench: hips lower, knees forward. */
const seated: Pose = {
  hip: { x: 44, y: 62 },
  torso: 4,
  upperArm: 10,
  foreArm: 0,
  thigh: 78,
  shin: -76,
};

/** Lying supine on a flat bench. */
const supine: Pose = {
  hip: { x: 58, y: 60 },
  torso: 88,
  head: -6,
  // Lying face-up with the head to the RIGHT, so the legs extend LEFT.
  // In a horizontal pose the legs must project opposite the torso, or the
  // figure folds in half. Upright poses have no such constraint.
  upperArm: -80,
  foreArm: -14,
  thigh: -96,
  shin: 28,
};

function pose(base: Pose, overrides: Partial<Pose>): Pose {
  return { ...base, ...overrides };
}

export const exerciseAnimations: Record<string, ExerciseAnimation> = {
  // ─── BACK ────────────────────────────────────────────────────────────────

  'lat-pulldown': {
    duration: 3.2,
    emphasis: ['back'],
    contractionIndex: 1,
    props: [
      { kind: 'cableStack', x: 50, topY: 6, attachTo: 'wrist' },
      { kind: 'bench', y: 74, x: 34, width: 26 },
    ],
    poses: [
      // Arms extended overhead, slight lean back
      pose(seated, { torso: -8, upperArm: -150, foreArm: 8 }),
      // Bar pulled to upper chest, shoulder blades squeezed
      pose(seated, { torso: -12, upperArm: -108, foreArm: 74 }),
    ],
  },

  'seated-cable-row': {
    duration: 3.2,
    emphasis: ['back'],
    contractionIndex: 1,
    props: [
      { kind: 'cableStack', x: 92, topY: 58, attachTo: 'wrist' },
      { kind: 'bench', y: 72, x: 30, width: 24 },
    ],
    poses: [
      // Reaching forward, arms long
      pose(seated, { torso: 16, upperArm: 92, foreArm: 4, thigh: 74, shin: -70 }),
      // Handle pulled to lower abdomen, torso upright
      pose(seated, { torso: -4, upperArm: 66, foreArm: 96, thigh: 74, shin: -70 }),
    ],
  },

  'one-arm-dumbbell-row': {
    duration: 3.0,
    emphasis: ['back'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 66, x: 24, width: 30 },
      { kind: 'dumbbell', grip: 'wrist' },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      // Hinged over bench, arm hanging straight down
      pose(standing, { hip: { x: 42, y: 56 }, torso: 74, head: -24, upperArm: 6, foreArm: 2, thigh: 6, shin: -4 }),
      // Dumbbell pulled to hip, elbow tight to body
      pose(standing, { hip: { x: 42, y: 56 }, torso: 74, head: -24, upperArm: -46, foreArm: 92, thigh: 6, shin: -4 }),
    ],
  },

  'chest-supported-row': {
    duration: 3.0,
    emphasis: ['back'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 62, x: 28, width: 34, incline: 42 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      pose(standing, { hip: { x: 52, y: 58 }, torso: 46, head: -12, upperArm: 10, foreArm: 0, thigh: 22, shin: -14 }),
      pose(standing, { hip: { x: 52, y: 58 }, torso: 46, head: -12, upperArm: -26, foreArm: 84, thigh: 22, shin: -14 }),
    ],
  },

  'face-pull': {
    duration: 2.8,
    emphasis: ['back', 'shoulders'],
    contractionIndex: 1,
    props: [{ kind: 'cableStack', x: 92, topY: 30, attachTo: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Arms extended toward the stack at eye level
      pose(standing, { upperArm: 84, foreArm: 6 }),
      // Rope pulled to face, elbows high and flared
      pose(standing, { upperArm: 62, foreArm: -84, head: 4 }),
    ],
  },

  'face-pulls-shoulder': {
    duration: 2.8,
    emphasis: ['shoulders', 'back'],
    contractionIndex: 1,
    props: [{ kind: 'cableStack', x: 92, topY: 30, attachTo: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      pose(standing, { upperArm: 84, foreArm: 6 }),
      pose(standing, { upperArm: 62, foreArm: -84, head: 4 }),
    ],
  },

  deadlift: {
    duration: 4.0,
    emphasis: ['back', 'glutes', 'hamstrings'],
    contractionIndex: 0,
    props: [{ kind: 'barbell', grip: 'wrist', width: 34 }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Lockout: standing tall, bar at hip
      pose(standing, { torso: 2, upperArm: 4, foreArm: 0, thigh: 2, shin: 0 }),
      // Bottom: hips back, shins vertical, flat back
      pose(standing, { hip: { x: 42, y: 62 }, torso: 62, head: -26, upperArm: 12, foreArm: -6, thigh: 8, shin: -6 }),
    ],
  },

  'rack-pull': {
    duration: 3.6,
    emphasis: ['back', 'shoulders'],
    contractionIndex: 0,
    props: [
      { kind: 'barbell', grip: 'wrist', width: 34 },
      { kind: 'machineFrame', x: 20, y: 60, w: 60, h: 32 },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      pose(standing, { torso: 2, upperArm: 4, foreArm: 0, thigh: 2, shin: 0 }),
      // Shorter range than a deadlift: bar starts at knee height
      pose(standing, { hip: { x: 47, y: 60 }, torso: 42, head: -16, upperArm: 6, foreArm: -2, thigh: 22, shin: -26 }),
    ],
  },

  // ─── CHEST ───────────────────────────────────────────────────────────────

  'machine-chest-press': {
    duration: 3.0,
    emphasis: ['chest'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 74, x: 34, width: 26 },
      { kind: 'machineFrame', x: 66, y: 34, w: 12, h: 44 },
    ],
    poses: [
      // Handles at chest, elbows back
      pose(seated, { torso: -4, upperArm: 118, foreArm: -104 }),
      // Pressed forward to near-extension
      pose(seated, { torso: -4, upperArm: 92, foreArm: -8 }),
    ],
  },

  'dumbbell-bench-press': {
    duration: 3.2,
    emphasis: ['chest', 'triceps'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 64, x: 24, width: 46 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      // Bottom: dumbbells at chest level, elbows bent
      pose(supine, { upperArm: -150, foreArm: 40 }),
      // Top: arms extended above the chest
      pose(supine, { upperArm: -178, foreArm: -2 }),
    ],
  },

  'incline-dumbbell-press': {
    duration: 3.2,
    emphasis: ['chest', 'shoulders'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 62, x: 24, width: 42, incline: -36 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      pose(supine, { torso: 56, hip: { x: 52, y: 64 }, upperArm: -132, foreArm: 44, thigh: -58, shin: -34 }),
      pose(supine, { torso: 56, hip: { x: 52, y: 64 }, upperArm: -170, foreArm: -4, thigh: -58, shin: -34 }),
    ],
  },

  'cable-fly': {
    duration: 3.2,
    emphasis: ['chest'],
    contractionIndex: 1,
    props: [
      { kind: 'cableStack', x: 8, topY: 26, attachTo: 'farWrist' },
      { kind: 'cableStack', x: 92, topY: 26, attachTo: 'wrist' },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      // Arms wide, chest stretched
      pose(standing, { torso: 10, upperArm: 100, farUpperArm: -100, foreArm: -12, farForeArm: 12 }),
      // Hands together in front of the chest
      pose(standing, { torso: 10, upperArm: 62, farUpperArm: -58, foreArm: -34, farForeArm: 32 }),
    ],
  },

  'push-ups': {
    duration: 2.8,
    emphasis: ['chest', 'core'],
    contractionIndex: 0,
    props: [{ kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Top of the push-up: straight line head to heels
      { hip: { x: 50, y: 76 }, torso: 72, head: -16, upperArm: -25, foreArm: 50, thigh: -67, shin: -4 },
      // Bottom: chest near the floor, elbows bent back
      { hip: { x: 50, y: 82 }, torso: 72, head: -16, upperArm: -48, foreArm: 96, thigh: -70, shin: -4 },
    ],
  },

  'assisted-dips': {
    duration: 3.0,
    emphasis: ['chest', 'triceps'],
    contractionIndex: 0,
    props: [
      { kind: 'machineFrame', x: 22, y: 22, w: 56, h: 14 },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      // Top: arms locked out, torso leaning forward
      pose(standing, { hip: { x: 50, y: 56 }, torso: 18, upperArm: 4, foreArm: 0, thigh: 30, shin: -68 }),
      // Bottom: elbows bent to ~90, deeper lean
      pose(standing, { hip: { x: 50, y: 68 }, torso: 24, upperArm: 26, foreArm: -70, thigh: 34, shin: -70 }),
    ],
  },

  // ─── LEGS ────────────────────────────────────────────────────────────────

  'leg-press': {
    duration: 3.4,
    emphasis: ['quads', 'glutes'],
    contractionIndex: 1,
    props: [
      { kind: 'machineFrame', x: 62, y: 20, w: 26, h: 22 },
      { kind: 'bench', y: 72, x: 14, width: 34, incline: -18 },
    ],
    poses: [
      // Knees bent toward 90
      { hip: { x: 40, y: 58 }, torso: -104, head: 14, upperArm: 25, foreArm: 0, thigh: 150, shin: -80 },
      // Legs extended, stopping short of locking out
      { hip: { x: 40, y: 58 }, torso: -104, head: 14, upperArm: 25, foreArm: 0, thigh: 120, shin: -10 },
    ],
  },

  'goblet-squat': {
    duration: 3.2,
    emphasis: ['quads', 'glutes'],
    contractionIndex: 0,
    props: [{ kind: 'dumbbell', grip: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Standing, weight held at chest
      pose(standing, { torso: 2, upperArm: 38, foreArm: -92 }),
      // Deep squat, chest up
      pose(standing, { hip: { x: 48, y: 70 }, torso: 20, upperArm: 40, foreArm: -96, thigh: 62, shin: -104 }),
    ],
  },

  'barbell-squat': {
    duration: 3.8,
    emphasis: ['quads', 'glutes'],
    contractionIndex: 0,
    props: [{ kind: 'barbell', grip: 'wrist', width: 38 }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Standing with the bar racked on the upper back
      pose(standing, { torso: 4, upperArm: 132, foreArm: -108 }),
      // Below parallel, torso angled forward
      pose(standing, { hip: { x: 47, y: 72 }, torso: 30, upperArm: 132, foreArm: -108, thigh: 66, shin: -110 }),
    ],
  },

  'romanian-deadlift': {
    duration: 3.6,
    emphasis: ['hamstrings', 'glutes'],
    contractionIndex: 0,
    props: [{ kind: 'barbell', grip: 'wrist', width: 34 }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Standing tall, bar at the hips
      pose(standing, { torso: 2, upperArm: 4, foreArm: 0 }),
      // Hips pushed back, bar tracking down the legs, knees soft
      pose(standing, { hip: { x: 42, y: 58 }, torso: 70, head: -28, upperArm: 8, foreArm: -2, thigh: 6, shin: -6 }),
    ],
  },

  'hip-thrust': {
    duration: 3.0,
    emphasis: ['glutes', 'hamstrings'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 52, x: 16, width: 24 },
      { kind: 'barbell', grip: 'wrist', width: 26 },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      // Hips lowered toward the floor. Hands rest on the bar across the hips,
      // so the arms reach forward-down rather than hanging.
      { hip: { x: 52, y: 70 }, torso: 118, head: -30, upperArm: -128, foreArm: -34, thigh: -52, shin: 88 },
      // Full hip extension, body in a straight line
      { hip: { x: 52, y: 58 }, torso: 106, head: -22, upperArm: -120, foreArm: -30, thigh: -60, shin: 96 },
    ],
  },

  'hamstring-curl': {
    duration: 2.8,
    emphasis: ['hamstrings'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 60, x: 20, width: 44 },
      { kind: 'machineFrame', x: 68, y: 62, w: 10, h: 18 },
    ],
    poses: [
      // Lying prone, legs straight
      { hip: { x: 54, y: 62 }, torso: 92, head: 12, upperArm: 118, foreArm: 40, thigh: -94, shin: 4 },
      // Heels curled toward the glutes
      { hip: { x: 54, y: 62 }, torso: 92, head: 12, upperArm: 118, foreArm: 40, thigh: -94, shin: 108 },
    ],
  },

  'calf-raises': {
    duration: 2.2,
    emphasis: ['calves'],
    contractionIndex: 1,
    props: [{ kind: 'machineFrame', x: 34, y: 84, w: 32, h: 8 }],
    poses: [
      // Heels dropped below the platform for a stretch
      pose(standing, { hip: { x: 50, y: 58 }, torso: 0, thigh: 2, shin: 0 }),
      // Risen onto the toes
      pose(standing, { hip: { x: 50, y: 50 }, torso: 0, thigh: 2, shin: 0 }),
    ],
  },

  'walking-lunges': {
    duration: 3.4,
    emphasis: ['quads', 'glutes'],
    contractionIndex: 1,
    props: [{ kind: 'dumbbell', grip: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Mid-stride, feet together
      pose(standing, { upperArm: 4, foreArm: 0, thigh: 6, farThigh: -4 }),
      // Lunge: front knee at 90, rear knee toward the floor
      pose(standing, {
        hip: { x: 48, y: 66 }, torso: 6, upperArm: 4, foreArm: 0,
        thigh: 44, shin: -86, farThigh: -40, farShin: 96,
      }),
    ],
  },

  // ─── SHOULDERS ───────────────────────────────────────────────────────────

  'machine-shoulder-press': {
    duration: 3.0,
    emphasis: ['shoulders'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 74, x: 34, width: 26 },
      { kind: 'machineFrame', x: 30, y: 30, w: 40, h: 10 },
    ],
    poses: [
      // Handles at shoulder height
      pose(seated, { torso: -2, upperArm: 148, foreArm: -66 }),
      // Pressed overhead
      pose(seated, { torso: -2, upperArm: 176, foreArm: -6 }),
    ],
  },

  'dumbbell-shoulder-press': {
    duration: 3.0,
    emphasis: ['shoulders', 'triceps'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 74, x: 34, width: 26 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      pose(seated, { torso: -2, upperArm: 146, foreArm: -70 }),
      pose(seated, { torso: -2, upperArm: 178, foreArm: -4 }),
    ],
  },

  'arnold-press': {
    duration: 3.4,
    emphasis: ['shoulders'],
    contractionIndex: 2,
    props: [
      { kind: 'bench', y: 74, x: 34, width: 26 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      // Start: palms facing in, dumbbells in front of the chest
      pose(seated, { torso: -2, upperArm: 116, foreArm: -96 }),
      // Mid: rotating out to the sides
      pose(seated, { torso: -2, upperArm: 148, foreArm: -66 }),
      // Top: pressed overhead, palms forward
      pose(seated, { torso: -2, upperArm: 178, foreArm: -4 }),
    ],
  },

  'lateral-raises': {
    duration: 2.6,
    emphasis: ['shoulders'],
    contractionIndex: 1,
    props: [{ kind: 'dumbbell', grip: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Dumbbells at the sides
      pose(standing, { upperArm: 8, foreArm: 4, farUpperArm: -8, farForeArm: -4 }),
      // Raised to shoulder height, no higher
      pose(standing, { upperArm: 88, foreArm: 6, farUpperArm: -88, farForeArm: -6 }),
    ],
  },

  'rear-delt-fly': {
    duration: 2.8,
    emphasis: ['shoulders', 'back'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 62, x: 28, width: 34, incline: 44 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      pose(standing, { hip: { x: 52, y: 58 }, torso: 52, head: -16, upperArm: 8, foreArm: 0, farUpperArm: -8, thigh: 22, shin: -14 }),
      pose(standing, { hip: { x: 52, y: 58 }, torso: 52, head: -16, upperArm: 84, foreArm: 8, farUpperArm: -84, farForeArm: -8, thigh: 22, shin: -14 }),
    ],
  },

  // ─── ARMS ────────────────────────────────────────────────────────────────

  'barbell-curl': {
    duration: 2.8,
    emphasis: ['biceps'],
    contractionIndex: 1,
    props: [{ kind: 'barbell', grip: 'wrist', width: 30 }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Arms extended, bar at the thighs
      pose(standing, { upperArm: 6, foreArm: 2 }),
      // Curled to the shoulders, elbows pinned
      pose(standing, { upperArm: 10, foreArm: 128 }),
    ],
  },

  'incline-dumbbell-curl': {
    duration: 3.0,
    emphasis: ['biceps'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 60, x: 26, width: 40, incline: -40 },
      { kind: 'dumbbell', grip: 'wrist' },
    ],
    poses: [
      // Arms hanging back, full biceps stretch
      pose(supine, { torso: 52, hip: { x: 52, y: 64 }, upperArm: -10, foreArm: -6, thigh: -58, shin: -34 }),
      pose(supine, { torso: 52, hip: { x: 52, y: 64 }, upperArm: -14, foreArm: -124, thigh: -58, shin: -34 }),
    ],
  },

  'hammer-curl': {
    duration: 2.6,
    emphasis: ['biceps'],
    contractionIndex: 1,
    props: [{ kind: 'dumbbell', grip: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      pose(standing, { upperArm: 6, foreArm: 2, farUpperArm: -6 }),
      // Neutral-grip curl; alternating arms reads as the far arm staying down
      pose(standing, { upperArm: 8, foreArm: 124, farUpperArm: -6, farForeArm: -2 }),
    ],
  },

  'rope-pushdown': {
    duration: 2.6,
    emphasis: ['triceps'],
    contractionIndex: 1,
    props: [
      { kind: 'cableStack', x: 50, topY: 8, attachTo: 'wrist' },
      { kind: 'floor', y: FLOOR_Y },
    ],
    poses: [
      // Elbows at the sides, forearms up
      pose(standing, { torso: 6, upperArm: 12, foreArm: -104 }),
      // Pushed down to full extension, rope split
      pose(standing, { torso: 6, upperArm: 10, foreArm: -6 }),
    ],
  },

  'overhead-tricep-extension': {
    duration: 3.0,
    emphasis: ['triceps'],
    contractionIndex: 1,
    props: [{ kind: 'dumbbell', grip: 'wrist' }, { kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Weight lowered behind the head
      pose(standing, { upperArm: 172, foreArm: -118 }),
      // Extended straight overhead
      pose(standing, { upperArm: 176, foreArm: -4 }),
    ],
  },

  'skull-crushers': {
    duration: 2.8,
    emphasis: ['triceps'],
    contractionIndex: 1,
    props: [
      { kind: 'bench', y: 64, x: 24, width: 46 },
      { kind: 'barbell', grip: 'wrist', width: 22 },
    ],
    poses: [
      // Bar lowered toward the forehead, upper arms vertical
      pose(supine, { upperArm: -178, foreArm: 74 }),
      // Extended to lockout
      pose(supine, { upperArm: -178, foreArm: -2 }),
    ],
  },

  // ─── CORE ────────────────────────────────────────────────────────────────

  plank: {
    duration: 4.0,
    emphasis: ['core'],
    contractionIndex: 0,
    props: [{ kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Isometric hold. There is no rep, so the "movement" is the breathing
      // cycle plus the hip drift a real plank fights against. Needs to be
      // visible enough to read as alive rather than as a frozen frame.
      { hip: { x: 50, y: 84 }, torso: 76, head: -12, upperArm: 0, foreArm: 90, thigh: -78, shin: -6 },
      { hip: { x: 50, y: 87 }, torso: 80, head: -8, upperArm: 2, foreArm: 88, thigh: -82, shin: -8 },
    ],
  },

  'dead-bug': {
    duration: 3.4,
    emphasis: ['core'],
    contractionIndex: 1,
    props: [{ kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Both limbs up, lower back pressed down
      { hip: { x: 58, y: 80 }, torso: 92, head: -4, upperArm: -178, foreArm: -2, thigh: -178, shin: 88, farUpperArm: -178, farThigh: -178, farShin: 88 },
      // Opposite arm and leg extended away
      { hip: { x: 58, y: 80 }, torso: 92, head: -4, upperArm: -128, foreArm: -4, thigh: -122, shin: 26, farUpperArm: -178, farThigh: -178, farShin: 88 },
    ],
  },

  'cable-crunch': {
    duration: 3.0,
    emphasis: ['core'],
    contractionIndex: 1,
    props: [
      { kind: 'cableStack', x: 50, topY: 6, attachTo: 'wrist' },
      { kind: 'mat', y: FLOOR_Y },
    ],
    poses: [
      // Kneeling tall: knees under the hips, shins folded back on the mat,
      // rope held at the temples.
      { hip: { x: 50, y: 74 }, torso: 4, head: 0, upperArm: 162, foreArm: 140, thigh: 8, shin: -100 },
      // Crunched: spine flexes toward the knees while the hips stay put.
      { hip: { x: 50, y: 74 }, torso: 46, head: 14, upperArm: 150, foreArm: 138, thigh: 8, shin: -100 },
    ],
  },

  'hanging-knee-raise': {
    duration: 3.0,
    emphasis: ['core'],
    contractionIndex: 1,
    props: [{ kind: 'pullupBar', y: 12 }],
    poses: [
      // Hanging, legs straight below
      { hip: { x: 50, y: 58 }, torso: 0, upperArm: 180, foreArm: 0, thigh: 2, shin: 0 },
      // Knees raised to the chest
      { hip: { x: 50, y: 58 }, torso: 0, upperArm: 180, foreArm: 0, thigh: 76, shin: -104 },
    ],
  },

  'russian-twist': {
    duration: 3.0,
    emphasis: ['core'],
    contractionIndex: 1,
    props: [{ kind: 'ball', grip: 'wrist', r: 5 }, { kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Rotated to one side
      { hip: { x: 50, y: 72 }, torso: 34, head: 6, upperArm: 68, foreArm: -48, thigh: 62, shin: -96 },
      // Rotated to the other side
      { hip: { x: 50, y: 72 }, torso: 34, head: -6, upperArm: 4, foreArm: -48, thigh: 62, shin: -96 },
    ],
  },

  // ─── CARDIO ──────────────────────────────────────────────────────────────

  'brisk-walking': {
    duration: 1.6,
    emphasis: ['cardio'],
    props: [{ kind: 'floor', y: FLOOR_Y }],
    poses: [
      // Mid-stride, opposite arm and leg forward
      pose(standing, { torso: 6, upperArm: -24, foreArm: 32, farUpperArm: 26, farForeArm: 30, thigh: 24, shin: -18, farThigh: -16, farShin: 24 }),
      pose(standing, { torso: 6, upperArm: 26, foreArm: 30, farUpperArm: -24, farForeArm: 32, thigh: -16, shin: 24, farThigh: 24, farShin: -18 }),
    ],
  },

  'treadmill-walk': {
    duration: 1.6,
    emphasis: ['cardio'],
    props: [{ kind: 'treadmill', y: 84 }],
    poses: [
      pose(standing, { hip: { x: 50, y: 50 }, torso: 4, upperArm: -20, foreArm: 28, farUpperArm: 22, farForeArm: 28, thigh: 22, shin: -16, farThigh: -14, farShin: 22 }),
      pose(standing, { hip: { x: 50, y: 50 }, torso: 4, upperArm: 22, foreArm: 28, farUpperArm: -20, farForeArm: 28, thigh: -14, shin: 22, farThigh: 22, farShin: -16 }),
    ],
  },

  'stationary-bike': {
    duration: 1.4,
    emphasis: ['cardio', 'quads'],
    props: [{ kind: 'bike', y: 78 }],
    poses: [
      // Near pedal down, far pedal up
      { hip: { x: 44, y: 56 }, torso: 22, head: -8, upperArm: 66, foreArm: 10, thigh: 62, shin: -70, farThigh: 108, farShin: -58 },
      { hip: { x: 44, y: 56 }, torso: 22, head: -8, upperArm: 66, foreArm: 10, thigh: 108, shin: -58, farThigh: 62, farShin: -70 },
    ],
  },

  // ─── MOBILITY ────────────────────────────────────────────────────────────

  'hip-opener-stretch': {
    duration: 4.4,
    emphasis: ['glutes'],
    contractionIndex: 1,
    props: [{ kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Low lunge, shallow
      { hip: { x: 50, y: 64 }, torso: 8, head: 0, upperArm: 34, foreArm: 8, thigh: 46, shin: -84, farThigh: -44, farShin: 104 },
      // Hips pressed forward, deeper stretch
      { hip: { x: 52, y: 68 }, torso: -4, head: 0, upperArm: 30, foreArm: 6, thigh: 54, shin: -92, farThigh: -52, farShin: 110 },
    ],
  },

  'hamstring-stretch': {
    duration: 4.4,
    emphasis: ['hamstrings'],
    contractionIndex: 1,
    props: [{ kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Supine, one leg raised partway
      { hip: { x: 58, y: 82 }, torso: 92, head: -4, upperArm: -140, foreArm: -22, thigh: -140, shin: 6, farThigh: -94, farShin: 2 },
      // Leg drawn closer to vertical
      { hip: { x: 58, y: 82 }, torso: 92, head: -4, upperArm: -162, foreArm: -16, thigh: -170, shin: 4, farThigh: -94, farShin: 2 },
    ],
  },

  'thoracic-opener': {
    duration: 4.4,
    emphasis: ['back'],
    contractionIndex: 1,
    props: [{ kind: 'foamRoller', x: 46, y: 66 }, { kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Lying over the roller, mild extension
      { hip: { x: 54, y: 70 }, torso: 106, head: -16, upperArm: -142, foreArm: -46, thigh: -58, shin: 74 },
      // Extending further back over the roller
      { hip: { x: 54, y: 72 }, torso: 116, head: -24, upperArm: -156, foreArm: -40, thigh: -54, shin: 70 },
    ],
  },

  'breathing-cooldown': {
    duration: 5.0,
    emphasis: ['core'],
    contractionIndex: 1,
    props: [{ kind: 'mat', y: FLOOR_Y }],
    poses: [
      // Seated cross-legged, exhaled
      { hip: { x: 50, y: 72 }, torso: 4, head: 2, upperArm: 44, foreArm: 30, thigh: 84, shin: -74, farThigh: 96, farShin: -84 },
      // Inhaled: chest opens, spine lengthens
      { hip: { x: 50, y: 70 }, torso: -2, head: -4, upperArm: 40, foreArm: 28, thigh: 84, shin: -74, farThigh: 96, farShin: -84 },
    ],
  },
};

/** Exercises that intentionally reuse another exercise's animation. */
export const animationAliases: Record<string, string> = {};

export function getExerciseAnimation(exerciseId: string): ExerciseAnimation | undefined {
  const aliased = animationAliases[exerciseId] ?? exerciseId;
  return exerciseAnimations[aliased];
}
