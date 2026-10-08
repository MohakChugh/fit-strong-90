/**
 * Mobility catalogue: stretches, nerve glides, breathing and RAMP drills.
 * Status and swaps follow docs/research/technique-mobility-cardio.md §3 and
 * back-sciatica-mobility.md §4 (spec Appendix B).
 */

import type { MobilityMeta } from '@/types/catalog';

type Def = Omit<MobilityMeta, 'kind' | 'flags' | 'equipment' | 'floor'> &
  Partial<Pick<MobilityMeta, 'flags' | 'equipment' | 'floor'>>;

const def = (d: Def): MobilityMeta => ({ kind: 'mobility', flags: {}, equipment: [], floor: false, ...d });

export const MOBILITY: MobilityMeta[] = [
  // ─── Neck ─────────────────────────────────────────────────────────────────
  def({ id: 'chin-tuck', name: 'Chin Tuck', regions: ['neck'], mode: 'reps', dose: { reps: 10, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'ok' }),
  def({ id: 'upper-trap-stretch', name: 'Upper Trap Stretch', regions: ['neck', 'shoulders'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok' }),
  def({ id: 'levator-scapulae-stretch', name: 'Levator Scapulae Stretch', regions: ['neck'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok' }),

  // ─── Upper back ───────────────────────────────────────────────────────────
  def({ id: 'cat-cow', name: 'Cat-Cow', regions: ['thoracic', 'lowerBack'], mode: 'reps', dose: { reps: 7, secondsPerRep: 6, sets: 1, sides: 'none' }, status: 'modify', floor: true, equipment: ['mat'] }),
  def({ id: 'thread-the-needle', name: 'Thread the Needle', regions: ['thoracic', 'shoulders'], mode: 'reps', dose: { reps: 6, secondsPerRep: 4, sets: 1, sides: 'each' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'open-book', name: 'Open Book', regions: ['thoracic', 'chest'], mode: 'reps', dose: { reps: 6, secondsPerRep: 4, sets: 1, sides: 'each' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'foam-roller-thoracic-extension', name: 'Foam Roller Thoracic Extension', regions: ['thoracic'], mode: 'reps', dose: { reps: 6, secondsPerRep: 5, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['foamRoller'] }),

  // ─── Shoulders, chest, arms ───────────────────────────────────────────────
  def({ id: 'doorway-pec-stretch', name: 'Doorway Pec Stretch', regions: ['chest', 'shoulders'], mode: 'hold', dose: { holdSeconds: 20, sets: 2, sides: 'none' }, status: 'ok', equipment: ['wall'], flags: { weightBearing: true } }),
  def({ id: 'cross-body-shoulder-stretch', name: 'Cross-Body Shoulder Stretch', regions: ['shoulders'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok', flags: { weightBearing: true } }),
  def({ id: 'kneeling-lat-stretch', name: 'Kneeling Lat Stretch', regions: ['lats', 'thoracic'], mode: 'hold', dose: { holdSeconds: 20, sets: 2, sides: 'none' }, status: 'modify', irritableSwap: 'standing-rack-lat-stretch', floor: true, equipment: ['chair'] }),
  def({ id: 'overhead-triceps-stretch', name: 'Overhead Triceps Stretch', regions: ['armsWrists', 'lats'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok', flags: { weightBearing: true } }),
  def({ id: 'wrist-flexor-extensor-stretch', name: 'Wrist Flexor and Extensor Stretch', regions: ['armsWrists'], mode: 'hold', dose: { holdSeconds: 20, sets: 2, sides: 'none' }, status: 'ok', flags: { weightBearing: true } }),
  def({ id: 'scapular-wall-slide', name: 'Scapular Wall Slide', regions: ['shoulders', 'thoracic'], mode: 'reps', dose: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'ok', equipment: ['wall'], flags: { weightBearing: true } }),
  def({ id: 'band-pull-apart', name: 'Band Pull-Apart', regions: ['shoulders'], mode: 'activation', dose: { reps: 15, secondsPerRep: 2, sets: 1, sides: 'none' }, status: 'ok', equipment: ['bands'], flags: { weightBearing: true } }),
  def({ id: 'biceps-wall-stretch', name: 'Biceps Wall Stretch', regions: ['armsWrists', 'chest'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok', equipment: ['wall'], flags: { weightBearing: true } }),
  def({ id: 'standing-rack-lat-stretch', name: 'Standing Lat Stretch', regions: ['lats'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'ok', flags: { weightBearing: true } }),

  // ─── Torso ────────────────────────────────────────────────────────────────
  def({ id: 'standing-side-bend', name: 'Standing Side Bend', regions: ['torso'], mode: 'reps', dose: { reps: 5, secondsPerRep: 4, sets: 1, sides: 'each' }, status: 'avoidWhenIrritable', flags: { weightBearing: true } }),
  def({ id: 'supine-twist', name: 'Supine Knee Rolls', regions: ['torso', 'lowerBack'], mode: 'reps', dose: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'modify', floor: true, equipment: ['mat'] }),
  def({ id: 'childs-pose', name: "Child's Pose", regions: ['lowerBack', 'lats'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'none' }, status: 'avoidWhenIrritable', irritableSwap: 'standing-rack-lat-stretch', floor: true, equipment: ['mat'], flags: { headBelowHeart: true, endRangeFlexion: true } }),

  // ─── Lower back ───────────────────────────────────────────────────────────
  def({ id: 'pelvic-tilt', name: 'Pelvic Tilt', regions: ['lowerBack'], mode: 'reps', dose: { reps: 10, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'knee-to-chest', name: 'Single Knee-to-Chest', regions: ['lowerBack', 'glutes'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'modify', floor: true, equipment: ['mat'], flags: { endRangeFlexion: true } }),
  def({ id: 'prone-press-up', name: 'Prone Press-Up', regions: ['lowerBack'], mode: 'reps', dose: { reps: 10, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'modify', floor: true, equipment: ['mat'], flags: { endRangeExtension: true } }),

  // ─── Hips and glutes ──────────────────────────────────────────────────────
  def({ id: 'supine-figure-4', name: 'Supine Figure-4 Stretch', regions: ['glutes'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'seated-piriformis-stretch', name: 'Seated Piriformis Stretch', regions: ['glutes'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'modify', equipment: ['chair'] }),
  def({ id: 'half-kneeling-hip-flexor-stretch', name: 'Half-Kneeling Hip Flexor Stretch', regions: ['hipFlexors', 'quads'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'modify', floor: true, equipment: ['mat'], flags: { femoralTension: 1, weightBearing: true } }),
  def({ id: 'ninety-ninety-hip-switch', name: '90/90 Hip Switch', regions: ['glutes', 'adductors', 'hipFlexors'], mode: 'reps', dose: { reps: 6, secondsPerRep: 5, sets: 1, sides: 'none' }, status: 'modify', floor: true, equipment: ['mat'] }),
  def({ id: 'adductor-rock-back', name: 'Adductor Rock-Back', regions: ['adductors', 'hipFlexors'], mode: 'reps', dose: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'modify', floor: true, equipment: ['mat'] }),

  // ─── Hamstrings and nerve ─────────────────────────────────────────────────
  def({ id: 'sciatic-nerve-glide-seated', name: 'Seated Sciatic Nerve Glide', regions: ['hamstrings'], mode: 'slider', dose: { reps: 12, secondsPerRep: 3, sets: 1, sides: 'affectedFirst' }, status: 'modify', equipment: ['chair'], flags: { sciaticTension: 1 } }),
  def({ id: 'sciatic-nerve-glide-supine', name: 'Supine Sciatic Nerve Glide', regions: ['hamstrings'], mode: 'slider', dose: { reps: 12, secondsPerRep: 3, sets: 1, sides: 'affectedFirst' }, status: 'ok', floor: true, equipment: ['mat'], flags: { sciaticTension: 1 } }),
  def({ id: 'supine-hamstring-stretch-strap', name: 'Supine Hamstring Stretch with Strap', regions: ['hamstrings'], mode: 'hold', dose: { holdSeconds: 20, sets: 2, sides: 'each' }, status: 'avoidWhenIrritable', irritableSwap: 'sciatic-nerve-glide-supine', floor: true, equipment: ['strap'], flags: { sciaticTension: 2 } }),
  def({ id: 'active-knee-extension', name: 'Active Knee Extension', regions: ['hamstrings'], mode: 'reps', dose: { reps: 8, secondsPerRep: 3, sets: 1, sides: 'each' }, status: 'modify', irritableSwap: 'sciatic-nerve-glide-supine', floor: true, equipment: ['mat'], flags: { sciaticTension: 1 } }),

  // ─── Quads and calves ─────────────────────────────────────────────────────
  def({ id: 'side-lying-quad-stretch', name: 'Side-Lying Quad Stretch', regions: ['quads', 'hipFlexors'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok', floor: true, equipment: ['mat'], flags: { femoralTension: 1 } }),
  def({ id: 'wall-calf-stretch', name: 'Wall Calf Stretch', regions: ['calves'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'modify', irritableSwap: 'soleus-stretch', equipment: ['wall'], flags: { sciaticTension: 1, weightBearing: true } }),
  def({ id: 'soleus-stretch', name: 'Bent-Knee Soleus Stretch', regions: ['calves'], mode: 'hold', dose: { holdSeconds: 20, sets: 1, sides: 'each' }, status: 'ok', equipment: ['wall'], flags: { weightBearing: true } }),
  def({ id: 'knee-to-wall-rock', name: 'Knee-to-Wall Ankle Rock', regions: ['calves'], mode: 'reps', dose: { reps: 8, secondsPerRep: 2, sets: 1, sides: 'each' }, status: 'ok', equipment: ['wall'], flags: { weightBearing: true } }),

  // ─── Breathing ────────────────────────────────────────────────────────────
  def({ id: 'diaphragmatic-breathing-90-90', name: '90/90 Breathing', regions: ['torso'], mode: 'breathing', dose: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'crocodile-breathing', name: 'Crocodile Breathing', regions: ['torso', 'lowerBack'], mode: 'breathing', dose: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'box-breathing', name: 'Calm Breathing', regions: ['torso'], mode: 'breathing', dose: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'none' }, status: 'ok' }),

  // ─── Raise, activate, potentiate drills ───────────────────────────────────
  def({ id: 'march-in-place', name: 'March in Place', regions: ['hipFlexors'], mode: 'activation', dose: { reps: 45, secondsPerRep: 2, sets: 1, sides: 'none' }, status: 'ok', flags: { weightBearing: true } }),
  def({ id: 'scapular-push-up', name: 'Scapular Push-Up', regions: ['shoulders'], mode: 'activation', dose: { reps: 10, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['mat'], flags: { weightBearing: true } }),
  def({ id: 'prone-y-t', name: 'Prone Y-T Raise', regions: ['shoulders', 'thoracic'], mode: 'activation', dose: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'ok', floor: true, equipment: ['mat'] }),
  def({ id: 'scapular-pull-up', name: 'Scapular Pull-Up', regions: ['lats', 'shoulders'], mode: 'activation', dose: { reps: 8, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'ok', equipment: ['pullupBar'], flags: { weightBearing: true } }),
  def({ id: 'band-walk', name: 'Lateral Band Walk', regions: ['glutes'], mode: 'activation', dose: { reps: 10, secondsPerRep: 2, sets: 1, sides: 'each' }, status: 'ok', equipment: ['bands'], flags: { weightBearing: true } }),
  def({ id: 'band-row', name: 'Band Row', regions: ['shoulders', 'thoracic'], mode: 'activation', dose: { reps: 12, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'ok', equipment: ['bands'], flags: { weightBearing: true } }),
  def({ id: 'dowel-hinge', name: 'Dowel Hip Hinge', regions: ['hamstrings', 'lowerBack'], mode: 'activation', dose: { reps: 10, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'ok', equipment: ['dowel'], flags: { weightBearing: true } }),
  def({ id: 'box-squat', name: 'Bodyweight Box Squat', regions: ['quads', 'glutes'], mode: 'activation', dose: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' }, status: 'ok', equipment: ['box'], flags: { weightBearing: true } }),
  def({ id: 'incline-push-up', name: 'Incline Push-Up', regions: ['chest', 'shoulders'], mode: 'activation', dose: { reps: 8, secondsPerRep: 3, sets: 1, sides: 'none' }, status: 'ok', flags: { weightBearing: true } }),
  def({ id: 'reverse-lunge-overhead-reach', name: 'Reverse Lunge with Overhead Reach', regions: ['hipFlexors', 'lats'], mode: 'reps', dose: { reps: 5, secondsPerRep: 5, sets: 1, sides: 'each' }, status: 'modify', flags: { femoralTension: 1, weightBearing: true } }),

  // ─── Retired and legacy ids (history only) ────────────────────────────────
  def({ id: 'knee-to-opposite-shoulder', name: 'Knee-to-Opposite-Shoulder Stretch', regions: ['glutes'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'excluded', retired: true, floor: true }),
  def({ id: 'hip-opener-stretch', name: 'Half-Kneeling Hip Flexor Stretch', regions: ['hipFlexors'], mode: 'hold', dose: { holdSeconds: 30, sets: 1, sides: 'each' }, status: 'modify', retired: true, aliasOf: 'half-kneeling-hip-flexor-stretch', floor: true, flags: { weightBearing: true } }),
  def({ id: 'hamstring-stretch', name: 'Supine Hamstring Stretch with Strap', regions: ['hamstrings'], mode: 'hold', dose: { holdSeconds: 20, sets: 2, sides: 'each' }, status: 'avoidWhenIrritable', retired: true, aliasOf: 'supine-hamstring-stretch-strap', floor: true }),
  def({ id: 'thoracic-opener', name: 'Foam Roller Thoracic Extension', regions: ['thoracic'], mode: 'reps', dose: { reps: 6, secondsPerRep: 5, sets: 1, sides: 'none' }, status: 'ok', retired: true, aliasOf: 'foam-roller-thoracic-extension', floor: true }),
  def({ id: 'breathing-cooldown', name: '90/90 Breathing', regions: ['torso'], mode: 'breathing', dose: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'none' }, status: 'ok', retired: true, aliasOf: 'diaphragmatic-breathing-90-90', floor: true }),
];
