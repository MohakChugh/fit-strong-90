/**
 * Strength catalogue: engine metadata only (coaching text lives in
 * src/data/coaching). Flags and ladder levels follow spec Appendix A and
 * docs/research/program-design.md §7.3.
 *
 * `weightBearing` marks every drill whose load travels through the foot, not
 * just standing ones: a leg press, a seated calf raise and a seated cable row
 * drive it through the forefoot while seated; a plank or push-up rests on the
 * toes; a half-kneeling drill stands on its front foot; an assisted tower or
 * captain's chair is climbed onto. A drill the coaching sets up standing "or
 * seated" counts as standing, since nothing makes the seated version the one
 * done. The FOOT modifier (spec §4.6) allows seated, upper-body or floor work
 * only, so it keys off this flag (audited 2026-10-08, acceptance P05).
 */

import type { ExerciseMeta } from '@/types/catalog';

type Def = Omit<ExerciseMeta, 'kind' | 'unilateral' | 'supersetEligible' | 'flags'> &
  Partial<Pick<ExerciseMeta, 'unilateral' | 'supersetEligible' | 'flags'>>;

const def = (d: Def): ExerciseMeta => ({
  kind: 'strength',
  unilateral: false,
  supersetEligible: true,
  flags: {},
  ...d,
});

export const STRENGTH: ExerciseMeta[] = [
  // ─── Vertical pull ────────────────────────────────────────────────────────
  def({ id: 'lat-pulldown', name: 'Lat Pulldown', category: 'back', patterns: ['vPull'], equipment: ['cable'], level: 'beginner', setupSeconds: 45, flags: { valsalva: 1 } }),
  def({ id: 'assisted-pull-up', name: 'Assisted Pull-Up', category: 'back', patterns: ['vPull'], equipment: ['machine'], equipmentAlt: [['pullupBar', 'bands']], level: 'beginner', setupSeconds: 40, regressionId: 'lat-pulldown', flags: { valsalva: 1, weightBearing: true } }),

  // ─── Horizontal pull ──────────────────────────────────────────────────────
  def({ id: 'chest-supported-row', name: 'Chest-Supported Row', category: 'back', patterns: ['hPull'], equipment: ['dumbbells', 'bench'], equipmentAlt: [['machine']], level: 'beginner', setupSeconds: 40, regressionId: 'band-row', flags: { valsalva: 1 } }),
  def({ id: 'one-arm-dumbbell-row', name: 'One-Arm Dumbbell Row', category: 'back', patterns: ['hPull'], equipment: ['dumbbells', 'bench'], level: 'beginner', unilateral: true, setupSeconds: 30, regressionId: 'chest-supported-row', flags: { valsalva: 1, weightBearing: true } }),
  def({ id: 'seated-cable-row', name: 'Seated Cable Row', category: 'back', patterns: ['hPull'], equipment: ['cable'], level: 'beginner', setupSeconds: 40, regressionId: 'chest-supported-row', flags: { spinalFlexion: 1, valsalva: 1, sciaticTension: 1, seatedFlexion: true, weightBearing: true } }),
  def({ id: 'face-pull', name: 'Face Pull', category: 'back', patterns: ['rearDelt'], equipment: ['cable'], equipmentAlt: [['bands']], level: 'beginner', setupSeconds: 30, regressionId: 'band-pull-apart', flags: { weightBearing: true } }),

  // ─── Hinge ────────────────────────────────────────────────────────────────
  // Floor drill, bodyweight only: stays available under FOOT (spec §4.6 allows
  // seated, upper-body and floor work), unlike the loaded hip thrust below.
  def({ id: 'glute-bridge', name: 'Glute Bridge', category: 'legs', patterns: ['hinge'], equipment: ['mat'], level: 'beginner', ladder: { track: 'hinge', level: 0 }, setupSeconds: 15 }),
  def({ id: 'hip-thrust', name: 'Hip Thrust', category: 'legs', patterns: ['hinge'], equipment: ['barbell', 'bench'], equipmentAlt: [['dumbbells', 'bench']], level: 'beginner', ladder: { track: 'hinge', level: 1 }, setupSeconds: 60, regressionId: 'glute-bridge', flags: { loadedExtension: true, valsalva: 1, weightBearing: true } }),
  def({ id: 'cable-pull-through', name: 'Cable Pull-Through', category: 'legs', patterns: ['hinge'], equipment: ['cable'], equipmentAlt: [['bands']], level: 'beginner', ladder: { track: 'hinge', level: 1 }, setupSeconds: 35, regressionId: 'glute-bridge', flags: { lumbarMoment: 1, weightBearing: true } }),
  def({ id: 'kettlebell-deadlift', name: 'Kettlebell Deadlift', category: 'legs', patterns: ['hinge'], equipment: ['kettlebell'], equipmentAlt: [['dumbbells']], level: 'beginner', ladder: { track: 'hinge', level: 1 }, setupSeconds: 25, regressionId: 'glute-bridge', flags: { lumbarMoment: 1, valsalva: 1, weightBearing: true } }),
  def({ id: 'back-extension-45', name: '45-Degree Back Extension', category: 'back', patterns: ['backExtension'], equipment: ['backExtensionBench'], level: 'beginner', ladder: { track: 'hinge', level: 0 }, setupSeconds: 35, regressionId: 'bird-dog', flags: { headBelowHeart: true, sciaticTension: 1, weightBearing: true } }),
  def({ id: 'trap-bar-deadlift', name: 'Trap Bar Deadlift', category: 'legs', patterns: ['hinge'], equipment: ['trapBar'], level: 'intermediate', ladder: { track: 'hinge', level: 2 }, setupSeconds: 60, supersetEligible: false, regressionId: 'kettlebell-deadlift', flags: { axialLoad: 1, lumbarMoment: 1, valsalva: 2, weightBearing: true } }),
  def({ id: 'single-leg-rdl', name: 'Single-Leg Romanian Deadlift', category: 'legs', patterns: ['hinge'], equipment: ['dumbbells'], equipmentAlt: [['kettlebell']], level: 'intermediate', ladder: { track: 'hinge', level: 2 }, unilateral: true, setupSeconds: 25, regressionId: 'kettlebell-deadlift', flags: { lumbarMoment: 1, sciaticTension: 2, balance: 2, weightBearing: true } }),
  def({ id: 'romanian-deadlift', name: 'Romanian Deadlift', category: 'legs', patterns: ['hinge'], equipment: ['barbell'], equipmentAlt: [['dumbbells']], level: 'intermediate', ladder: { track: 'hinge', level: 3 }, setupSeconds: 45, supersetEligible: false, regressionId: 'cable-pull-through', flags: { spinalFlexion: 1, lumbarMoment: 2, valsalva: 1, sciaticTension: 2, deepHipFlexionLoaded: true, weightBearing: true } }),
  def({ id: 'rack-pull', name: 'Rack Pull', category: 'back', patterns: ['hinge'], equipment: ['barbell'], level: 'intermediate', ladder: { track: 'hinge', level: 3 }, setupSeconds: 75, supersetEligible: false, regressionId: 'trap-bar-deadlift', flags: { axialLoad: 2, lumbarMoment: 1, valsalva: 2, weightBearing: true } }),
  def({ id: 'deadlift', name: 'Deadlift', category: 'back', patterns: ['hinge'], equipment: ['barbell'], level: 'advanced', ladder: { track: 'hinge', level: 4 }, setupSeconds: 75, supersetEligible: false, regressionId: 'trap-bar-deadlift', flags: { spinalFlexion: 1, axialLoad: 2, lumbarMoment: 2, valsalva: 2, sciaticTension: 1, weightBearing: true } }),

  // ─── Squat ────────────────────────────────────────────────────────────────
  def({ id: 'goblet-box-squat', name: 'Goblet Box Squat', category: 'legs', patterns: ['squat'], equipment: ['dumbbells', 'box'], equipmentAlt: [['kettlebell', 'box']], level: 'beginner', ladder: { track: 'squat', level: 1 }, setupSeconds: 30, regressionId: 'box-squat', flags: { axialLoad: 1, valsalva: 1, weightBearing: true } }),
  def({ id: 'goblet-squat', name: 'Goblet Squat', category: 'legs', patterns: ['squat'], equipment: ['dumbbells'], equipmentAlt: [['kettlebell']], level: 'beginner', ladder: { track: 'squat', level: 2 }, setupSeconds: 25, regressionId: 'goblet-box-squat', flags: { axialLoad: 1, valsalva: 1, weightBearing: true } }),
  def({ id: 'leg-press', name: 'Leg Press', category: 'legs', patterns: ['squat'], equipment: ['machine'], level: 'beginner', ladder: { track: 'squat', level: 2 }, setupSeconds: 50, supersetEligible: false, regressionId: 'goblet-squat', flags: { spinalFlexion: 1, valsalva: 2, deepHipFlexionLoaded: true, weightBearing: true } }),
  def({ id: 'barbell-squat', name: 'Barbell Back Squat', category: 'legs', patterns: ['squat'], equipment: ['barbell'], level: 'intermediate', ladder: { track: 'squat', level: 4 }, setupSeconds: 75, supersetEligible: false, regressionId: 'goblet-squat', flags: { spinalFlexion: 1, axialLoad: 2, lumbarMoment: 1, valsalva: 2, weightBearing: true } }),

  // ─── Single leg ───────────────────────────────────────────────────────────
  def({ id: 'split-squat', name: 'Split Squat', category: 'legs', patterns: ['lunge'], equipment: [], level: 'beginner', ladder: { track: 'squat', level: 1 }, unilateral: true, setupSeconds: 20, regressionId: 'box-squat', flags: { femoralTension: 1, balance: 1, weightBearing: true } }),
  def({ id: 'step-up', name: 'Step-Up', category: 'legs', patterns: ['lunge'], equipment: ['box'], level: 'beginner', ladder: { track: 'squat', level: 2 }, unilateral: true, setupSeconds: 25, regressionId: 'split-squat', flags: { balance: 1, weightBearing: true } }),
  def({ id: 'reverse-lunge', name: 'Reverse Lunge', category: 'legs', patterns: ['lunge'], equipment: [], level: 'beginner', ladder: { track: 'squat', level: 2 }, unilateral: true, setupSeconds: 20, regressionId: 'split-squat', flags: { femoralTension: 1, balance: 1, weightBearing: true } }),
  def({ id: 'rear-foot-elevated-split-squat', name: 'Rear-Foot-Elevated Split Squat', category: 'legs', patterns: ['lunge'], equipment: ['bench'], equipmentAlt: [['box']], level: 'intermediate', ladder: { track: 'squat', level: 3 }, unilateral: true, setupSeconds: 30, regressionId: 'split-squat', flags: { femoralTension: 2, balance: 2, weightBearing: true } }),
  def({ id: 'walking-lunges', name: 'Walking Lunges', category: 'legs', patterns: ['lunge'], equipment: ['dumbbells'], level: 'intermediate', ladder: { track: 'squat', level: 3 }, unilateral: true, setupSeconds: 30, regressionId: 'split-squat', flags: { axialLoad: 1, femoralTension: 1, balance: 2, weightBearing: true } }),

  // ─── Knee flexion and calves ──────────────────────────────────────────────
  def({ id: 'lying-leg-curl', name: 'Lying Leg Curl', category: 'legs', patterns: ['kneeFlexion'], equipment: ['machine'], level: 'beginner', setupSeconds: 35, flags: { femoralTension: 1 } }),
  // Appendix A's seated-leg-curl (NTs1, "when sciatica is quiet"): kept under
  // its legacy id so logged history still resolves.
  def({ id: 'hamstring-curl', name: 'Seated Leg Curl', category: 'legs', patterns: ['kneeFlexion'], equipment: ['machine'], level: 'beginner', setupSeconds: 35, regressionId: 'lying-leg-curl', flags: { sciaticTension: 1 } }),
  def({ id: 'seated-calf-raise', name: 'Seated Calf Raise', category: 'legs', patterns: ['calf'], equipment: ['machine'], equipmentAlt: [['dumbbells', 'bench']], level: 'beginner', setupSeconds: 30, flags: { weightBearing: true } }),
  def({ id: 'single-leg-calf-raise', name: 'Single-Leg Calf Raise', category: 'legs', patterns: ['calf'], equipment: [], level: 'beginner', unilateral: true, setupSeconds: 15, regressionId: 'seated-calf-raise', flags: { balance: 1, weightBearing: true } }),
  def({ id: 'calf-raises', name: 'Standing Calf Raise', category: 'legs', patterns: ['calf'], equipment: ['machine'], level: 'beginner', setupSeconds: 30, regressionId: 'seated-calf-raise', flags: { axialLoad: 1, weightBearing: true } }),

  // ─── Horizontal push ──────────────────────────────────────────────────────
  def({ id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', category: 'chest', patterns: ['hPush'], equipment: ['dumbbells', 'bench'], level: 'beginner', setupSeconds: 40, regressionId: 'push-ups', flags: { valsalva: 1 } }),
  def({ id: 'machine-chest-press', name: 'Machine Chest Press', category: 'chest', patterns: ['hPush'], equipment: ['machine'], level: 'beginner', setupSeconds: 40, regressionId: 'push-ups', flags: { valsalva: 1 } }),
  def({ id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'chest', patterns: ['hPush'], equipment: ['dumbbells', 'bench'], level: 'beginner', setupSeconds: 40, regressionId: 'push-ups', flags: { valsalva: 1 } }),
  def({ id: 'push-ups', name: 'Push-Ups', category: 'chest', patterns: ['hPush'], equipment: [], level: 'beginner', setupSeconds: 15, regressionId: 'incline-push-up', flags: { valsalva: 1, weightBearing: true } }),
  def({ id: 'assisted-dips', name: 'Assisted Dips', category: 'chest', patterns: ['hPush', 'triceps'], equipment: ['machine'], level: 'beginner', setupSeconds: 40, regressionId: 'push-ups', flags: { valsalva: 1, weightBearing: true } }),
  def({ id: 'cable-fly', name: 'Cable Fly', category: 'chest', patterns: ['chestFly'], equipment: ['cable'], equipmentAlt: [['dumbbells', 'bench']], level: 'beginner', setupSeconds: 35, flags: { valsalva: 1, weightBearing: true } }),

  // ─── Vertical push ────────────────────────────────────────────────────────
  def({ id: 'landmine-press', name: 'Half-Kneeling Landmine Press', category: 'shoulders', patterns: ['vPush'], equipment: ['landmine', 'barbell'], level: 'beginner', unilateral: true, setupSeconds: 40, regressionId: 'dumbbell-shoulder-press', flags: { valsalva: 1, weightBearing: true } }),
  def({ id: 'dumbbell-shoulder-press', name: 'Seated Dumbbell Shoulder Press', category: 'shoulders', patterns: ['vPush'], equipment: ['dumbbells', 'bench'], level: 'beginner', setupSeconds: 35, regressionId: 'machine-shoulder-press', flags: { overhead: true, valsalva: 1 } }),
  def({ id: 'machine-shoulder-press', name: 'Machine Shoulder Press', category: 'shoulders', patterns: ['vPush'], equipment: ['machine'], level: 'beginner', setupSeconds: 40, flags: { overhead: true, valsalva: 1 } }),
  def({ id: 'arnold-press', name: 'Seated Arnold Press', category: 'shoulders', patterns: ['vPush'], equipment: ['dumbbells', 'bench'], level: 'intermediate', setupSeconds: 35, regressionId: 'dumbbell-shoulder-press', flags: { overhead: true, valsalva: 1 } }),

  // ─── Shoulder isolation ───────────────────────────────────────────────────
  def({ id: 'lateral-raises', name: 'Lateral Raises', category: 'shoulders', patterns: ['sideDelt'], equipment: ['dumbbells'], level: 'beginner', setupSeconds: 20, flags: { weightBearing: true } }),
  def({ id: 'rear-delt-fly', name: 'Chest-Supported Rear Delt Fly', category: 'shoulders', patterns: ['rearDelt'], equipment: ['dumbbells', 'bench'], equipmentAlt: [['machine']], level: 'beginner', setupSeconds: 30, regressionId: 'band-pull-apart' }),

  // ─── Arms ─────────────────────────────────────────────────────────────────
  def({ id: 'seated-cable-curl', name: 'Seated Cable Curl', category: 'arms', patterns: ['biceps'], equipment: ['cable'], level: 'beginner', setupSeconds: 30, regressionId: 'hammer-curl' }),
  def({ id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', category: 'arms', patterns: ['biceps'], equipment: ['dumbbells', 'bench'], level: 'beginner', setupSeconds: 25, regressionId: 'hammer-curl' }),
  def({ id: 'hammer-curl', name: 'Hammer Curl', category: 'arms', patterns: ['biceps'], equipment: ['dumbbells'], level: 'beginner', setupSeconds: 15, flags: { weightBearing: true } }),
  def({ id: 'barbell-curl', name: 'Barbell Curl', category: 'arms', patterns: ['biceps'], equipment: ['barbell'], level: 'beginner', setupSeconds: 20, regressionId: 'hammer-curl', flags: { weightBearing: true } }),
  def({ id: 'rope-pushdown', name: 'Rope Pushdown', category: 'arms', patterns: ['triceps'], equipment: ['cable'], equipmentAlt: [['bands']], level: 'beginner', setupSeconds: 25, flags: { weightBearing: true } }),
  def({ id: 'overhead-tricep-extension', name: 'Seated Overhead Triceps Extension', category: 'arms', patterns: ['triceps'], equipment: ['dumbbells', 'bench'], level: 'beginner', setupSeconds: 25, regressionId: 'rope-pushdown', flags: { overhead: true } }),
  def({ id: 'skull-crushers', name: 'Skull Crushers', category: 'arms', patterns: ['triceps'], equipment: ['dumbbells', 'bench'], level: 'intermediate', setupSeconds: 30, regressionId: 'rope-pushdown' }),

  // ─── Trunk ────────────────────────────────────────────────────────────────
  def({ id: 'mcgill-curl-up', name: 'McGill Curl-Up', category: 'core', patterns: ['antiExtension'], equipment: ['mat'], level: 'beginner', setupSeconds: 15, flags: { isometricHold: 2, valsalva: 1 } }),
  def({ id: 'dead-bug', name: 'Dead Bug', category: 'core', patterns: ['antiExtension'], equipment: ['mat'], level: 'beginner', setupSeconds: 15, flags: { isometricHold: 1, valsalva: 1 } }),
  def({ id: 'bird-dog', name: 'Bird Dog', category: 'core', patterns: ['antiRotation', 'antiExtension'], equipment: ['mat'], level: 'beginner', unilateral: true, setupSeconds: 15, flags: { isometricHold: 1 } }),
  def({ id: 'side-plank', name: 'Side Plank', category: 'core', patterns: ['antiLateral'], equipment: ['mat'], level: 'beginner', unilateral: true, setupSeconds: 15, regressionId: 'dead-bug', flags: { isometricHold: 2, weightBearing: true } }),
  def({ id: 'plank', name: 'Plank', category: 'core', patterns: ['antiExtension'], equipment: ['mat'], level: 'beginner', setupSeconds: 15, regressionId: 'dead-bug', flags: { isometricHold: 2, valsalva: 1, weightBearing: true } }),
  def({ id: 'pallof-press', name: 'Pallof Press', category: 'core', patterns: ['antiRotation'], equipment: ['cable'], equipmentAlt: [['bands']], level: 'beginner', unilateral: true, setupSeconds: 25, regressionId: 'bird-dog', flags: { isometricHold: 1, weightBearing: true } }),
  def({ id: 'cable-chop', name: 'Cable Chop', category: 'core', patterns: ['rotation'], equipment: ['cable'], equipmentAlt: [['bands']], level: 'intermediate', unilateral: true, setupSeconds: 25, regressionId: 'pallof-press', flags: { weightBearing: true } }),
  def({ id: 'suitcase-carry', name: 'Suitcase Carry', category: 'core', patterns: ['carry', 'antiLateral'], equipment: ['dumbbells'], equipmentAlt: [['kettlebell']], level: 'beginner', unilateral: true, setupSeconds: 20, supersetEligible: false, regressionId: 'side-plank', flags: { axialLoad: 1, weightBearing: true } }),
  def({ id: 'farmer-carry', name: 'Farmer Carry', category: 'core', patterns: ['carry'], equipment: ['dumbbells'], equipmentAlt: [['kettlebell']], level: 'beginner', setupSeconds: 20, supersetEligible: false, regressionId: 'suitcase-carry', flags: { axialLoad: 1, weightBearing: true } }),
  def({ id: 'hanging-knee-raise', name: 'Hanging Knee Raise', category: 'core', patterns: ['antiExtension'], equipment: ['pullupBar'], level: 'intermediate', setupSeconds: 20, regressionId: 'dead-bug', flags: { spinalFlexion: 1, valsalva: 1, weightBearing: true } }),
  def({ id: 'cable-crunch', name: 'Cable Crunch', category: 'core', patterns: ['antiExtension'], equipment: ['cable'], level: 'intermediate', setupSeconds: 25, regressionId: 'mcgill-curl-up', flags: { spinalFlexion: 2 } }),
  def({ id: 'russian-twist', name: 'Russian Twist', category: 'core', patterns: ['rotation'], equipment: ['mat'], level: 'beginner', setupSeconds: 15, regressionId: 'pallof-press', flags: { spinalFlexion: 2, loadedRotation: true } }),

  // ─── Retired duplicates (kept so history resolves) ────────────────────────
  def({ id: 'face-pulls-shoulder', name: 'Face Pull', category: 'shoulders', patterns: ['rearDelt'], equipment: ['cable'], level: 'beginner', setupSeconds: 30, retired: true, aliasOf: 'face-pull', flags: { weightBearing: true } }),
];
