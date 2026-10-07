/**
 * Weekly structure (spec §4.1) and the movement-pattern slots for each day.
 * Candidates are ranked best-first; selection takes the first one the user's
 * equipment, safety flags and spinal-loading level allow, so the same slot
 * progresses automatically as the ladder rises (e.g. goblet → barbell squat).
 */

import type { DayOfWeek, MuscleGroup } from '@/types';
import type { DayFocus, MobilityDayType, SlotRole } from '@/types/plan';
import type { UserProfile } from '@/types/profile';

export interface Slot {
  /** Unique within the day, e.g. "lowerC.main". */
  id: string;
  role: SlotRole;
  candidates: string[];
  /** Slots sharing a pair id alternate set by set (antagonist supersets). */
  pair?: string;
  /** Slots sharing a circuit id rotate one set each per round. */
  circuit?: string;
  /** Spinal pattern: a symptom checkpoint follows for back profiles. */
  spinal?: boolean;
}

export const WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const SQUAT_MAIN = ['barbell-squat', 'goblet-squat', 'goblet-box-squat', 'box-squat'];
const HINGE_MAIN = ['deadlift', 'trap-bar-deadlift', 'kettlebell-deadlift', 'cable-pull-through', 'glute-bridge'];
const SINGLE_LEG = ['split-squat', 'reverse-lunge', 'step-up', 'box-squat'];
const KNEE_FLEXION = ['lying-leg-curl', 'hamstring-curl', 'glute-bridge'];
const CALF = ['seated-calf-raise', 'single-leg-calf-raise'];
const H_PUSH = ['dumbbell-bench-press', 'machine-chest-press', 'push-ups', 'incline-push-up'];
const H_PUSH_2 = ['incline-dumbbell-press', 'machine-chest-press', 'push-ups', 'incline-push-up'];
const H_PULL = ['chest-supported-row', 'seated-cable-row', 'one-arm-dumbbell-row', 'band-row', 'prone-y-t'];
const H_PULL_2 = ['one-arm-dumbbell-row', 'chest-supported-row', 'band-row', 'prone-y-t'];
const V_PULL = ['lat-pulldown', 'assisted-pull-up', 'band-row', 'prone-y-t'];
const V_PUSH = ['landmine-press', 'dumbbell-shoulder-press', 'machine-shoulder-press', 'incline-push-up'];
const REAR_DELT = ['face-pull', 'rear-delt-fly', 'band-pull-apart', 'prone-y-t'];
const SIDE_DELT = ['lateral-raises', 'band-pull-apart'];
const BICEPS = ['seated-cable-curl', 'incline-dumbbell-curl', 'hammer-curl'];
const TRICEPS = ['rope-pushdown', 'overhead-tricep-extension', 'skull-crushers', 'incline-push-up'];
const ANTI_EXT = ['dead-bug', 'mcgill-curl-up'];

const SLOTS: Record<Exclude<DayFocus, 'rest' | 'activeRecovery'>, Slot[]> = {
  lowerA: [
    { id: 'lowerA.main', role: 'main', candidates: SQUAT_MAIN, spinal: true },
    { id: 'lowerA.secondary', role: 'secondary', candidates: ['leg-press', 'goblet-box-squat', 'split-squat'], spinal: true },
    { id: 'lowerA.single', role: 'secondary', candidates: SINGLE_LEG, pair: 'lowerA.p1' },
    { id: 'lowerA.trunk', role: 'trunk', candidates: ANTI_EXT, pair: 'lowerA.p1' },
    { id: 'lowerA.curl', role: 'isolation', candidates: KNEE_FLEXION, pair: 'lowerA.p2' },
    { id: 'lowerA.calf', role: 'isolation', candidates: CALF, pair: 'lowerA.p2' },
  ],
  upperA: [
    { id: 'upperA.press', role: 'main', candidates: H_PUSH, pair: 'upperA.p1' },
    { id: 'upperA.row', role: 'main', candidates: H_PULL, pair: 'upperA.p1' },
    { id: 'upperA.press2', role: 'secondary', candidates: H_PUSH_2, pair: 'upperA.p2' },
    { id: 'upperA.row2', role: 'secondary', candidates: H_PULL_2, pair: 'upperA.p2' },
    { id: 'upperA.rear', role: 'isolation', candidates: REAR_DELT, circuit: 'upperA.c' },
    { id: 'upperA.side', role: 'isolation', candidates: SIDE_DELT, circuit: 'upperA.c' },
    { id: 'upperA.tri', role: 'isolation', candidates: TRICEPS, circuit: 'upperA.c' },
    { id: 'upperA.bi', role: 'isolation', candidates: ['hammer-curl', ...BICEPS], circuit: 'upperA.c' },
  ],
  lowerB: [
    { id: 'lowerB.main', role: 'main', candidates: ['hip-thrust', 'glute-bridge'], spinal: true },
    { id: 'lowerB.single', role: 'secondary', candidates: ['step-up', 'split-squat', 'reverse-lunge', 'box-squat'], pair: 'lowerB.p1' },
    { id: 'lowerB.lateral', role: 'trunk', candidates: ['side-plank', 'bird-dog'], pair: 'lowerB.p1' },
    { id: 'lowerB.hinge', role: 'secondary', candidates: ['cable-pull-through', 'kettlebell-deadlift', 'glute-bridge'], pair: 'lowerB.p2', spinal: true },
    { id: 'lowerB.rotation', role: 'trunk', candidates: ['pallof-press', 'bird-dog'], pair: 'lowerB.p2' },
    { id: 'lowerB.carry', role: 'carry', candidates: ['suitcase-carry', 'farmer-carry', 'side-plank'] },
  ],
  upperB: [
    { id: 'upperB.pull', role: 'main', candidates: V_PULL, pair: 'upperB.p1' },
    { id: 'upperB.press', role: 'main', candidates: V_PUSH, pair: 'upperB.p1' },
    { id: 'upperB.row', role: 'secondary', candidates: ['seated-cable-row', 'chest-supported-row', 'band-row', 'prone-y-t'], pair: 'upperB.p2' },
    { id: 'upperB.chest', role: 'secondary', candidates: ['machine-chest-press', 'dumbbell-bench-press', 'push-ups'], pair: 'upperB.p2' },
    { id: 'upperB.side', role: 'isolation', candidates: SIDE_DELT, circuit: 'upperB.c' },
    { id: 'upperB.bi', role: 'isolation', candidates: ['incline-dumbbell-curl', 'hammer-curl', 'seated-cable-curl'], circuit: 'upperB.c' },
    { id: 'upperB.tri', role: 'isolation', candidates: ['overhead-tricep-extension', 'rope-pushdown', 'incline-push-up'], circuit: 'upperB.c' },
  ],
  lowerC: [
    { id: 'lowerC.main', role: 'main', candidates: HINGE_MAIN, spinal: true },
    { id: 'lowerC.squat', role: 'secondary', candidates: ['goblet-squat', 'goblet-box-squat', 'box-squat'], pair: 'lowerC.p1', spinal: true },
    { id: 'lowerC.birddog', role: 'trunk', candidates: ['bird-dog', 'dead-bug'], pair: 'lowerC.p1' },
    { id: 'lowerC.backext', role: 'secondary', candidates: ['back-extension-45', 'glute-bridge'], pair: 'lowerC.p2' },
    { id: 'lowerC.curl', role: 'isolation', candidates: KNEE_FLEXION, pair: 'lowerC.p2' },
    { id: 'lowerC.calf', role: 'isolation', candidates: ['single-leg-calf-raise', 'seated-calf-raise'] },
  ],
  upperC: [
    { id: 'upperC.push', role: 'main', candidates: ['push-ups', 'incline-push-up'], pair: 'upperC.p1' },
    { id: 'upperC.pull', role: 'main', candidates: ['assisted-pull-up', 'lat-pulldown', 'band-row', 'prone-y-t'], pair: 'upperC.p1' },
    { id: 'upperC.press', role: 'secondary', candidates: ['dumbbell-shoulder-press', 'machine-shoulder-press', 'landmine-press', 'incline-push-up'], pair: 'upperC.p2' },
    { id: 'upperC.rear', role: 'secondary', candidates: ['rear-delt-fly', 'face-pull', 'band-pull-apart', 'prone-y-t'], pair: 'upperC.p2' },
    { id: 'upperC.fly', role: 'isolation', candidates: ['cable-fly', 'push-ups'], circuit: 'upperC.c' },
    { id: 'upperC.side', role: 'isolation', candidates: SIDE_DELT, circuit: 'upperC.c' },
    { id: 'upperC.bi', role: 'isolation', candidates: BICEPS, circuit: 'upperC.c' },
    { id: 'upperC.tri', role: 'isolation', candidates: ['skull-crushers', 'rope-pushdown', 'incline-push-up'], circuit: 'upperC.c' },
  ],
  upper: [
    { id: 'upper.press', role: 'main', candidates: H_PUSH, pair: 'upper.p1' },
    { id: 'upper.row', role: 'main', candidates: H_PULL, pair: 'upper.p1' },
    { id: 'upper.pull', role: 'secondary', candidates: V_PULL, pair: 'upper.p2' },
    { id: 'upper.vpress', role: 'secondary', candidates: V_PUSH, pair: 'upper.p2' },
    { id: 'upper.side', role: 'isolation', candidates: SIDE_DELT, circuit: 'upper.c' },
    { id: 'upper.bi', role: 'isolation', candidates: BICEPS, circuit: 'upper.c' },
    { id: 'upper.tri', role: 'isolation', candidates: TRICEPS, circuit: 'upper.c' },
  ],
  lower: [
    { id: 'lower.main', role: 'main', candidates: SQUAT_MAIN, spinal: true },
    { id: 'lower.single', role: 'secondary', candidates: SINGLE_LEG, pair: 'lower.p1' },
    { id: 'lower.trunk', role: 'trunk', candidates: ANTI_EXT, pair: 'lower.p1' },
    { id: 'lower.curl', role: 'isolation', candidates: KNEE_FLEXION, pair: 'lower.p2' },
    { id: 'lower.calf', role: 'isolation', candidates: CALF, pair: 'lower.p2' },
  ],
  push: [
    { id: 'push.main', role: 'main', candidates: H_PUSH_2 },
    { id: 'push.press', role: 'secondary', candidates: V_PUSH, pair: 'push.p1' },
    { id: 'push.trunk', role: 'trunk', candidates: ['pallof-press', 'dead-bug'], pair: 'push.p1' },
    { id: 'push.fly', role: 'isolation', candidates: ['cable-fly', 'push-ups'], circuit: 'push.c' },
    { id: 'push.side', role: 'isolation', candidates: SIDE_DELT, circuit: 'push.c' },
    { id: 'push.tri', role: 'isolation', candidates: TRICEPS, circuit: 'push.c' },
  ],
  pull: [
    { id: 'pull.main', role: 'main', candidates: V_PULL },
    { id: 'pull.row', role: 'secondary', candidates: H_PULL, pair: 'pull.p1' },
    { id: 'pull.rear', role: 'isolation', candidates: REAR_DELT, pair: 'pull.p1' },
    { id: 'pull.bi', role: 'isolation', candidates: BICEPS, pair: 'pull.p2' },
    { id: 'pull.trunk', role: 'trunk', candidates: ['bird-dog', 'dead-bug'], pair: 'pull.p2' },
    { id: 'pull.carry', role: 'carry', candidates: ['farmer-carry', 'suitcase-carry', 'side-plank'] },
  ],
  legs: [
    { id: 'legs.main', role: 'main', candidates: HINGE_MAIN, spinal: true },
    { id: 'legs.single', role: 'secondary', candidates: SINGLE_LEG, pair: 'legs.p1' },
    { id: 'legs.trunk', role: 'trunk', candidates: ['bird-dog', 'side-plank'], pair: 'legs.p1' },
    { id: 'legs.thrust', role: 'secondary', candidates: ['hip-thrust', 'glute-bridge'], pair: 'legs.p2', spinal: true },
    { id: 'legs.curl', role: 'isolation', candidates: KNEE_FLEXION, pair: 'legs.p2' },
    { id: 'legs.calf', role: 'isolation', candidates: CALF },
  ],
  fullA: [
    { id: 'fullA.main', role: 'main', candidates: SQUAT_MAIN, spinal: true },
    { id: 'fullA.press', role: 'secondary', candidates: H_PUSH, pair: 'fullA.p1' },
    { id: 'fullA.row', role: 'secondary', candidates: H_PULL, pair: 'fullA.p1' },
    { id: 'fullA.curl', role: 'isolation', candidates: KNEE_FLEXION, pair: 'fullA.p2' },
    { id: 'fullA.trunk', role: 'trunk', candidates: ANTI_EXT, pair: 'fullA.p2' },
    { id: 'fullA.carry', role: 'carry', candidates: ['suitcase-carry', 'farmer-carry', 'side-plank'] },
  ],
  fullB: [
    { id: 'fullB.main', role: 'main', candidates: HINGE_MAIN, spinal: true },
    { id: 'fullB.pull', role: 'secondary', candidates: V_PULL, pair: 'fullB.p1' },
    { id: 'fullB.press', role: 'secondary', candidates: V_PUSH, pair: 'fullB.p1' },
    { id: 'fullB.single', role: 'secondary', candidates: SINGLE_LEG, pair: 'fullB.p2' },
    { id: 'fullB.trunk', role: 'trunk', candidates: ['pallof-press', 'bird-dog'], pair: 'fullB.p2' },
  ],
  fullC: [
    { id: 'fullC.main', role: 'main', candidates: ['hip-thrust', 'glute-bridge'], spinal: true },
    { id: 'fullC.push', role: 'secondary', candidates: ['push-ups', 'incline-push-up'], pair: 'fullC.p1' },
    { id: 'fullC.pull', role: 'secondary', candidates: ['assisted-pull-up', 'lat-pulldown', 'band-row', 'prone-y-t'], pair: 'fullC.p1' },
    { id: 'fullC.single', role: 'secondary', candidates: ['step-up', 'reverse-lunge', 'split-squat'], pair: 'fullC.p2' },
    { id: 'fullC.trunk', role: 'trunk', candidates: ['side-plank', 'dead-bug'], pair: 'fullC.p2' },
    { id: 'fullC.side', role: 'isolation', candidates: SIDE_DELT },
  ],
};

export function slotsFor(focus: DayFocus): Slot[] {
  if (focus === 'rest' || focus === 'activeRecovery') return [];
  return SLOTS[focus];
}

const SEQUENCES: Record<number, DayFocus[]> = {
  1: ['fullA'],
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  4: ['upperA', 'lowerA', 'upperB', 'lowerC'],
  5: ['upper', 'lower', 'push', 'pull', 'legs'],
  6: ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC'],
};

/** Days that load the spine heavily; avoid them on consecutive calendar days. */
const HEAVY: DayFocus[] = ['lowerA', 'lowerC', 'lower', 'legs', 'fullA', 'fullB'];

/** Map the user's training days onto the template for their days per week. */
export function weekFocus(profile: Pick<UserProfile, 'trainingDays'>): Record<DayOfWeek, DayFocus> {
  const picked = WEEK.filter(d => profile.trainingDays.includes(d));
  const result = Object.fromEntries(WEEK.map(d => [d, 'rest'])) as Record<DayOfWeek, DayFocus>;
  if (picked.length === 0) return result;

  const n = Math.min(picked.length, 6);
  const seq = [...SEQUENCES[n]];
  if (picked.length === 7) seq.push('activeRecovery');
  picked.forEach((day, i) => { result[day] = seq[i]; });

  // Avoid heavy spinal days back to back (including Sunday → Monday).
  for (let pass = 0; pass < 7; pass++) {
    let swapped = false;
    for (let i = 0; i < 7; i++) {
      const a = WEEK[i];
      const b = WEEK[(i + 1) % 7];
      if (!HEAVY.includes(result[a]) || !HEAVY.includes(result[b])) continue;
      const light = picked.find(d => d !== a && d !== b && !HEAVY.includes(result[d]) && result[d] !== 'rest'
        && !isAdjacentToHeavy(result, d, b));
      if (light) {
        [result[b], result[light]] = [result[light], result[b]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return result;
}

function isAdjacentToHeavy(map: Record<DayOfWeek, DayFocus>, day: DayOfWeek, ignore: DayOfWeek): boolean {
  const i = WEEK.indexOf(day);
  const neighbours = [WEEK[(i + 6) % 7], WEEK[(i + 1) % 7]].filter(d => d !== ignore);
  return neighbours.some(d => HEAVY.includes(map[d]));
}

export function isHeavyFocus(focus: DayFocus): boolean {
  return HEAVY.includes(focus);
}

export function isUpperFocus(focus: DayFocus): boolean {
  return ['upperA', 'upperB', 'upperC', 'upper', 'push', 'pull'].includes(focus);
}

const MOBILITY_TYPE: Record<DayFocus, MobilityDayType> = {
  lowerA: 'lowerSquat',
  upperA: 'upperPush',
  lowerB: 'fullBody',
  upperB: 'upperPull',
  lowerC: 'lowerHinge',
  upperC: 'fullBody',
  upper: 'upperPush',
  lower: 'lowerSquat',
  push: 'upperPush',
  pull: 'upperPull',
  legs: 'lowerHinge',
  fullA: 'lowerSquat',
  fullB: 'lowerHinge',
  fullC: 'fullBody',
  activeRecovery: 'core',
  rest: 'core',
};

export function mobilityDayType(focus: DayFocus): MobilityDayType {
  return MOBILITY_TYPE[focus];
}

const LABELS: Record<DayFocus, string> = {
  lowerA: 'Lower A · Squat',
  upperA: 'Upper A · Push & Row',
  lowerB: 'Lower B · Single-Leg & Carries',
  upperB: 'Upper B · Pull-Down & Press',
  lowerC: 'Lower C · Hinge',
  upperC: 'Upper C · Muscle Builder',
  upper: 'Upper Body',
  lower: 'Lower Body · Squat',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs · Hinge',
  fullA: 'Full Body A',
  fullB: 'Full Body B',
  fullC: 'Full Body C',
  activeRecovery: 'Active Recovery',
  rest: 'Rest Day',
};

export function focusLabel(focus: DayFocus): string {
  return LABELS[focus];
}

/** Legacy muscle-group tag stored on WorkoutSession for History and Progress. */
export function focusMuscleGroup(focus: DayFocus): MuscleGroup {
  if (focus.startsWith('lower') || focus === 'legs') return 'lower';
  if (focus.startsWith('upper') || focus === 'push' || focus === 'pull') return 'upper';
  if (focus.startsWith('full')) return 'fullBody';
  return 'mobility';
}
