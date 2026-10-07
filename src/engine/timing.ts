/**
 * Steps expand into deterministic segments. The planner sums them for the
 * time budget and the runner walks them in real time, so the two can never
 * disagree (spec §6.1–§6.2).
 */

import type { Segment, Step } from '@/types/plan';
import { getStrength } from '@/data/catalog';

/** Patterns whose rep starts with the lifting (concentric) phase. */
const CONCENTRIC_FIRST_PATTERNS = ['vPull', 'hPull', 'biceps', 'triceps', 'sideDelt', 'rearDelt', 'kneeFlexion', 'calf', 'backExtension', 'chestFly', 'vPush', 'antiExtension', 'antiRotation', 'rotation'];
const CONCENTRIC_FIRST_IDS = ['deadlift', 'trap-bar-deadlift', 'kettlebell-deadlift', 'rack-pull', 'hip-thrust', 'glute-bridge', 'cable-pull-through'];

export function concentricFirst(exerciseId: string): boolean {
  if (CONCENTRIC_FIRST_IDS.includes(exerciseId)) return true;
  const meta = getStrength(exerciseId);
  return !!meta && meta.patterns.some(p => CONCENTRIC_FIRST_PATTERNS.includes(p));
}

const sideLabel = (s: 'left' | 'right') => (s === 'left' ? 'Left side' : 'Right side');

export function segmentsFor(step: Step): Segment[] {
  switch (step.kind) {
    case 'talk':
      return [{ kind: 'talk', seconds: step.seconds, label: step.title }];

    case 'setup':
      return [{ kind: 'prep', seconds: step.seconds, label: 'Set up' }];

    case 'rest':
      return [{ kind: 'rest', seconds: step.seconds, label: 'Rest' }];

    case 'checkpoint':
      return [{ kind: 'checkpoint', seconds: step.seconds, label: 'Quick check' }];

    case 'cardio':
      return step.parts.map(p => ({ kind: 'cardio' as const, seconds: p.seconds, label: p.label, intensity: p.intensity }));

    case 'hold': {
      const out: Segment[] = [{ kind: 'prep', seconds: step.prepSeconds, label: 'Get into position' }];
      const sides = step.sides ?? [undefined];
      for (let set = 1; set <= step.sets; set++) {
        sides.forEach((side, i) => {
          out.push({
            kind: 'hold', seconds: step.holdSeconds, set, of: step.sets,
            label: side ? `${sideLabel(side)}${step.sets > 1 ? ` · ${set} of ${step.sets}` : ''}` : `Hold${step.sets > 1 ? ` ${set} of ${step.sets}` : ''}`,
            ...(side ? { side } : {}),
          });
          const last = set === step.sets && i === sides.length - 1;
          if (!last) out.push({ kind: 'switch', seconds: step.switchSeconds, label: side && i < sides.length - 1 ? 'Switch sides' : 'Relax' });
        });
      }
      return out;
    }

    case 'drill': {
      const out: Segment[] = [{ kind: 'prep', seconds: step.prepSeconds, label: 'Get into position' }];
      const sides = step.sides ?? [undefined];
      for (let set = 1; set <= step.sets; set++) {
        sides.forEach((side, i) => {
          if (step.breathing) {
            for (let r = 1; r <= step.reps; r++) {
              out.push({ kind: 'work', seconds: step.breathing.inhale, label: 'Breathe in', breath: 'in', rep: r });
              out.push({ kind: 'work', seconds: step.breathing.exhale, label: 'Breathe out', breath: 'out', rep: r });
            }
          } else {
            out.push({
              kind: 'work', seconds: step.reps * step.secondsPerRep, set, of: step.sets,
              label: side ? `${sideLabel(side)} · ${step.reps} reps` : `${step.reps} reps`,
              ...(side ? { side } : {}),
            });
          }
          const last = set === step.sets && i === sides.length - 1;
          if (!last) out.push({ kind: 'switch', seconds: step.switchSeconds, label: side && i < sides.length - 1 ? 'Switch sides' : 'Relax' });
        });
      }
      return out;
    }

    case 'set': {
      const out: Segment[] = [{ kind: 'prep', seconds: step.prepSeconds, label: step.ramp ? 'Warm-up set' : `Set ${step.set} of ${step.of}` }];
      const sides = step.sides ?? [undefined];
      sides.forEach((side, i) => {
        if (step.holdSeconds) {
          out.push({ kind: 'hold', seconds: step.holdSeconds, label: side ? sideLabel(side) : 'Hold', ...(side ? { side } : {}) });
        } else if (step.carrySeconds) {
          out.push({ kind: 'work', seconds: step.carrySeconds, label: side ? `Walk · ${side === 'left' ? 'left' : 'right'} hand` : 'Walk', ...(side ? { side } : {}) });
        } else {
          const t = step.tempo;
          const ecc = (rep: number): Segment[] => [
            { kind: 'rep', seconds: t.lower, label: `Rep ${rep}`, rep, repPhase: 'lower', breath: 'in', ...(side ? { side } : {}) },
            ...(t.pauseBottom > 0 ? [{ kind: 'rep' as const, seconds: t.pauseBottom, label: `Rep ${rep}`, rep, repPhase: 'pauseBottom' as const, ...(side ? { side } : {}) }] : []),
          ];
          const con = (rep: number): Segment[] => [
            { kind: 'rep', seconds: t.lift, label: `Rep ${rep}`, rep, repPhase: 'lift', breath: 'out', ...(side ? { side } : {}) },
            ...(t.pauseTop > 0 ? [{ kind: 'rep' as const, seconds: t.pauseTop, label: `Rep ${rep}`, rep, repPhase: 'pauseTop' as const, ...(side ? { side } : {}) }] : []),
          ];
          const first = concentricFirst(step.exerciseId);
          for (let r = 1; r <= step.reps; r++) out.push(...(first ? [...con(r), ...ecc(r)] : [...ecc(r), ...con(r)]));
        }
        if (i < sides.length - 1) out.push({ kind: 'switch', seconds: 8, label: 'Switch sides' });
      });
      return out;
    }
  }
}

export function stepSeconds(step: Step): number {
  return segmentsFor(step).reduce((s, x) => s + x.seconds, 0);
}

export function totalSeconds(steps: Step[]): number {
  return steps.reduce((s, x) => s + stepSeconds(x), 0);
}
