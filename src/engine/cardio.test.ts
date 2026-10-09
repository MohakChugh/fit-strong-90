import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { DayFocus } from '@/types/plan';
import type { Readiness } from '@/types/checkin';
import { EQUIPMENT_BY_ACCESS } from '@/data/catalog';
import { activeConditions } from './safety';
import { profileOnlyReadiness } from './readiness';
import { totalSeconds } from './timing';
import { cardioBlock, cardioPlan, intervalsAllowed, pickModality } from './cardio';

const BUDGET = 690;

function ctxFor(p: ProfileInput, focus: DayFocus = 'upperB', patch: Partial<Readiness> = {}, budgetSeconds = BUDGET) {
  const profile = createDefaultProfile(p);
  const readiness = { ...profileOnlyReadiness(profile), ...patch };
  return {
    focus, profile, readiness, conditions: activeConditions(profile, readiness),
    equipment: EQUIPMENT_BY_ACCESS[profile.equipment], week: 6, mode: 'normal' as const,
    budgetSeconds, idPrefix: 'c',
  };
}

describe('cardio with nothing suitable to hand', () => {
  it('never prescribes a machine the user does not have', () => {
    const c = ctxFor({ equipment: 'homeNone' }, 'upperB', { modifiers: ['FOOT'] });
    expect(c.conditions.foot).toBe(true);
    // No machines, and a foot problem rules out walking: no cardio rather than a bike that isn't there.
    expect(pickModality(c)).toBeNull();
    expect(cardioPlan(c)).toBeNull();
    expect(cardioBlock(c)).toEqual([]);
  });
});

describe('cardio block', () => {
  it('always fills its budget exactly', () => {
    for (const p of [{}, { equipment: 'homeNone' } as ProfileInput, { health: { peripheralNeuropathy: 'yes' } } as ProfileInput]) {
      for (const focus of ['lowerA', 'upperB', 'lowerC'] as DayFocus[]) {
        expect(totalSeconds(cardioBlock(ctxFor(p, focus))), `${focus}`).toBe(BUDGET);
      }
    }
  });

  // A hot day caps the hard work at 8 minutes but must not shorten the session.
  it('caps hot-day work at 8 minutes and gives the rest back as cool-down', () => {
    const c = ctxFor({}, 'upperB', { modifiers: ['HEAT'] });
    const plan = cardioPlan(c);
    expect(plan?.seconds).toBeLessThanOrEqual(480);
    const steps = cardioBlock(c);
    expect(totalSeconds(steps)).toBe(BUDGET);
    const step = steps[0];
    if (step.kind !== 'cardio') throw new Error('expected a cardio step');
    const cooldown = step.parts.filter(x => x.intensity === 'cooldown').reduce((n, x) => n + x.seconds, 0);
    expect(cooldown).toBeGreaterThanOrEqual(BUDGET - 480);
  });

  it('gives a 5-minute cool-down when COOL applies, without changing the total', () => {
    const steps = cardioBlock(ctxFor({}, 'upperB', { modifiers: ['COOL'] }));
    const step = steps[0];
    if (step.kind !== 'cardio') throw new Error('expected a cardio step');
    expect(step.parts.at(-1)?.seconds).toBeGreaterThanOrEqual(300);
    expect(totalSeconds(steps)).toBe(BUDGET);
  });

  it('picks a foot-sparing machine when the feet need protecting', () => {
    const c = ctxFor({ health: { footStatus: 'current_wound_or_active_charcot', peripheralNeuropathy: 'yes' } });
    expect(c.readiness.modifiers).toContain('FOOT');
    expect(['recumbent-bike', 'stationary-bike', 'rowing-machine']).toContain(pickModality(c));
  });

  it('never prescribes intervals when effort must stay moderate', () => {
    for (const patch of [
      { modifiers: ['INT'] as Readiness['modifiers'] },
      { vigorousLocked: true },
      { capHeavy: true },
      { nerveFlag: true },
      { back: 'amber' as const },
    ]) {
      const c = ctxFor({}, 'upperB', patch);
      expect(intervalsAllowed(c).ok, JSON.stringify(patch)).toBe(false);
      expect(cardioPlan(c)?.format).toBe('zone2');
    }
  });

  it('explains why intervals were dropped', () => {
    const c = ctxFor({ health: { retinopathy: 'severe_or_proliferative' } });
    const verdict = intervalsAllowed(c);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBeTruthy();
  });

  it('labels every part and never emits a zero-length one', () => {
    for (const patch of [{}, { modifiers: ['HEAT'] as Readiness['modifiers'] }, { modifiers: ['COOL'] as Readiness['modifiers'] }]) {
      const step = cardioBlock(ctxFor({ health: { clearance: 'vigorous' } }, 'upperB', patch))[0];
      if (step.kind !== 'cardio') throw new Error('expected a cardio step');
      for (const part of step.parts) {
        expect(part.seconds, part.label).toBeGreaterThan(0);
        expect(part.label.trim()).not.toBe('');
      }
    }
  });
});

// Contract H-DIZZY and Codex re-audit F13, as the rest line says it: told
// there is a fluid limit, the hot day's spare cool-down never says to drink;
// told there is none it may; not told, only unless there is a limit.
describe('the hot day’s spare cool-down follows the fluid limit', () => {
  const FOCI: DayFocus[] = ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC'];
  const labels = (health: ProfileInput['health']) => FOCI.flatMap(focus => {
    const steps = cardioBlock(ctxFor({ health: { medicinesReviewed: true, ...health } }, focus, { modifiers: ['HEAT'] }));
    return steps.flatMap(s => (s.kind === 'cardio' ? s.parts.map(p => p.label) : []));
  });

  it.each([
    ['a recorded fluid limit', { fluidRestriction: true }],
    ['an unsure answer about one', { fluidRestriction: 'unsure' }],
    ['kidney disease', { kidneyDisease: 'ckd' }],
  ] as [string, ProfileInput['health']][])('with %s no part says drink', (_, health) => {
    const all = labels(health);
    expect(all).toContain('Easy cool-down, cool off and keep to your fluid plan');
    expect(all.filter(l => /drink|water|\bsip\b/i.test(l))).toEqual([]);
  });

  it('with no fluid limit it says drink; not asked yet, only unless there is a limit', () => {
    expect(labels({ fluidRestriction: false })).toContain('Easy cool-down, cool off and drink');
    const unknown = labels({});
    expect(unknown).toContain('Easy cool-down, cool off and drink unless you have a fluid limit');
    expect(unknown.filter(l => /drink/i.test(l) && !l.includes('unless you have a fluid limit'))).toEqual([]);
  });
});
