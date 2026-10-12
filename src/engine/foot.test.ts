/**
 * The FOOT restriction (spec §4.6): with an open wound or active Charcot
 * foot, seated, upper-body or floor work only. It keys off one catalogue
 * flag, `weightBearing`, so the flag is audited here exercise by exercise
 * (acceptance P05, 2026-10-08), and a new exercise cannot join the catalogue
 * without a decision.
 */

import { describe, expect, it } from 'vitest';
import { CATALOG, getMeta } from '@/data/catalog';
import { createDefaultProfile } from '@/profile/defaults';
import type { DailyCheckIn } from '@/types/checkin';
import { buildSessionPlan } from './session';
import { STRETCH_FOCI, STRETCH_MINUTES, buildStretchPlan } from './stretch';

/** Load through the foot: standing, a planted front foot, toes on the floor, a machine climbed onto, a foot plate. */
const LOADS_THE_FOOT = [
  // Standing, or a machine climbed onto by its steps.
  'assisted-pull-up', 'assisted-dips', 'hanging-knee-raise', 'face-pull', 'face-pulls-shoulder', 'cable-fly', 'cable-pull-through',
  'pallof-press', 'cable-chop', 'rope-pushdown', 'barbell-curl', 'kettlebell-deadlift', 'trap-bar-deadlift', 'single-leg-rdl',
  'romanian-deadlift', 'rack-pull', 'deadlift', 'goblet-box-squat', 'goblet-squat', 'barbell-squat', 'split-squat', 'step-up',
  'reverse-lunge', 'rear-foot-elevated-split-squat', 'walking-lunges', 'single-leg-calf-raise', 'calf-raises', 'suitcase-carry',
  'farmer-carry', 'doorway-pec-stretch', 'scapular-wall-slide', 'band-pull-apart', 'biceps-wall-stretch', 'standing-rack-lat-stretch',
  'standing-side-bend', 'wall-calf-stretch', 'soleus-stretch', 'knee-to-wall-rock', 'march-in-place', 'band-walk', 'band-row',
  'dowel-hinge', 'box-squat', 'reverse-lunge-overhead-reach', 'scapular-pull-up', 'treadmill-walk', 'elliptical', 'brisk-walking',
  // Set up "standing, or seated": nothing makes the seated version the one done.
  'lateral-raises', 'hammer-curl', 'cross-body-shoulder-stretch', 'overhead-triceps-stretch', 'wrist-flexor-extensor-stretch',
  // A foot planted on the floor, or the toes taking the body's weight.
  'one-arm-dumbbell-row', 'landmine-press', 'half-kneeling-hip-flexor-stretch', 'hip-opener-stretch', 'push-ups', 'incline-push-up',
  'scapular-push-up', 'plank', 'side-plank', 'hip-thrust', 'back-extension-45',
  // Foot-plate work while seated.
  'leg-press', 'seated-calf-raise', 'seated-cable-row', 'rowing-machine',
];

/** Lying, quadruped, kneeling, or seated with the feet merely resting. */
const SPARES_THE_FOOT = [
  'lat-pulldown', 'chest-supported-row', 'lying-leg-curl', 'hamstring-curl', 'dumbbell-bench-press', 'machine-chest-press',
  'incline-dumbbell-press', 'dumbbell-shoulder-press', 'machine-shoulder-press', 'arnold-press', 'rear-delt-fly', 'seated-cable-curl',
  'incline-dumbbell-curl', 'overhead-tricep-extension', 'skull-crushers', 'mcgill-curl-up', 'dead-bug', 'bird-dog', 'cable-crunch',
  'russian-twist', 'chin-tuck', 'upper-trap-stretch', 'levator-scapulae-stretch', 'cat-cow', 'thread-the-needle', 'open-book',
  'foam-roller-thoracic-extension', 'kneeling-lat-stretch', 'supine-twist', 'childs-pose', 'pelvic-tilt', 'knee-to-chest',
  'prone-press-up', 'supine-figure-4', 'seated-piriformis-stretch', 'ninety-ninety-hip-switch', 'adductor-rock-back',
  'sciatic-nerve-glide-seated', 'sciatic-nerve-glide-supine', 'supine-hamstring-stretch-strap', 'active-knee-extension',
  'side-lying-quad-stretch', 'diaphragmatic-breathing-90-90', 'crocodile-breathing', 'box-breathing', 'prone-y-t',
  'knee-to-opposite-shoulder', 'hamstring-stretch', 'thoracic-opener', 'breathing-cooldown',
  // A floor drill kept available on purpose (strength catalogue note): bodyweight through the heels, lying down.
  'glute-bridge',
  // The engine's foot-sparing cardio (engine/cardio.ts): seated pedalling, the non-weight-bearing option.
  'recumbent-bike', 'stationary-bike',
];

describe('the weight-bearing flag, audited', () => {
  it('every exercise is decided, once', () => {
    const decided = [...LOADS_THE_FOOT, ...SPARES_THE_FOOT];
    expect(new Set(decided).size).toBe(decided.length);
    expect([...decided].sort()).toEqual(CATALOG.map(e => e.id).sort());
  });

  it('the catalogue agrees with each decision', () => {
    for (const id of LOADS_THE_FOOT) expect(getMeta(id)?.flags.weightBearing, id).toBe(true);
    for (const id of SPARES_THE_FOOT) expect(getMeta(id)?.flags.weightBearing, id).toBeUndefined();
  });
});

describe('persona P05, an open foot wound: nothing that loads the foot is ever run', () => {
  // The persona's own answers, as the acceptance suite seeds them; and the same with everything else answered.
  const persona = { diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' } as const;
  const healths = [persona, { ...persona, medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter' } as const];
  const normal = (date: string): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 });
  // Judged by the audit above, not by the flag the planner reads, so a flag
  // lost from the catalogue shows here as the drill it lets through.
  const loads = new Set(LOADS_THE_FOOT);
  const loaded = (steps: readonly { kind: string; exerciseId?: string }[]) =>
    steps.filter(s => s.kind !== 'checkpoint' && s.exerciseId && loads.has(s.exerciseId)).map(s => s.exerciseId);

  it('in any guided session, at home or in a gym, on every day of the fortnight', () => {
    let runs = 0;
    for (const health of healths) for (const equipment of ['homeNone', 'homeDumbbells', 'fullGym'] as const) {
      const profile = createDefaultProfile({ equipment, health });
      for (const startDate of ['', '2026-09-28']) for (let d = 1; d <= 14; d++) {
        const date = `2026-10-${String(d).padStart(2, '0')}`;
        const plan = buildSessionPlan({ profile, date, startDate, sessions: [], checkIn: normal(date) });
        expect(loaded(plan.steps), `${equipment} ${startDate} ${date} ${plan.focus}`).toEqual([]);
        if (plan.steps.length) runs++;
      }
    }
    expect(runs).toBeGreaterThan(0);
  });

  it('in any stretch, of any area and length', () => {
    let built = 0;
    for (const health of healths) for (const focus of STRETCH_FOCI) {
      const profile = createDefaultProfile({ equipment: 'homeNone', health });
      for (const minutes of STRETCH_MINUTES) {
        const plan = buildStretchPlan({ profile, date: '2026-10-08', startDate: '', sessions: [], checkIn: normal('2026-10-08'), focus, minutes });
        expect(loaded(plan.steps), `${focus} ${minutes}`).toEqual([]);
        if (plan.kind === 'stretch') built++;
      }
    }
    expect(built).toBeGreaterThan(0);
  });
});
