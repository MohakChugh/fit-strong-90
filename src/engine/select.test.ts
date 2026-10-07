import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { Readiness } from '@/types/checkin';
import { profileOnlyReadiness } from './readiness';
import { activeConditions, evaluateFlags } from './safety';
import { selectForSlot } from './select';
import { slotsFor } from './templates';
import { EQUIPMENT_BY_ACCESS, getMeta } from '@/data/catalog';

function ctxFor(p: ProfileInput, readiness: Partial<Readiness> = {}, access: keyof typeof EQUIPMENT_BY_ACCESS = 'fullGym') {
  const profile = createDefaultProfile(p);
  const r = { ...profileOnlyReadiness(profile), ...readiness };
  return { conditions: activeConditions(profile, r), equipment: EQUIPMENT_BY_ACCESS[access], dislikes: profile.dislikes, used: new Set<string>() };
}

const slot = (focus: Parameters<typeof slotsFor>[0], id: string) => slotsFor(focus).find(s => s.id === id)!;

const ALL_FOCUS = [
  'lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC',
  'upper', 'lower', 'push', 'pull', 'legs', 'fullA', 'fullB', 'fullC',
] as const;

/** The strength block's selection loop (session.ts): one `used` set per day. */
function fillDay(focus: (typeof ALL_FOCUS)[number], ctx: ReturnType<typeof ctxFor>): string[] {
  return slotsFor(focus).map(s => {
    const sel = selectForSlot(s, ctx);
    ctx.used.add(sel.exerciseId);
    return sel.exerciseId;
  });
}
const back: ProfileInput = { pain: { areas: ['lowerBack'] }, ladder: { hinge: 2, squat: 2 } };
const sciatica: ProfileInput = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: false } };

describe('evaluateFlags (spec §4.8)', () => {
  it('always excludes loaded rotation and designed spinal flexion with a back history', () => {
    const c = ctxFor(back).conditions;
    expect(evaluateFlags(getMeta('russian-twist')!.flags, c).excluded).toBe(true);
    expect(evaluateFlags(getMeta('cable-crunch')!.flags, c).excluded).toBe(true);
  });

  it('allows the same moves for users without a back history', () => {
    const c = ctxFor({}).conditions;
    expect(evaluateFlags(getMeta('cable-crunch')!.flags, c).excluded).toBe(false);
  });

  it('excludes heavy axial loading on an irritable back day', () => {
    const c = ctxFor(back, { back: 'amber' }).conditions;
    expect(evaluateFlags(getMeta('barbell-squat')!.flags, c).excluded).toBe(true);
  });

  it('excludes high nerve tension while sciatica is active and gates it while quiet', () => {
    expect(evaluateFlags(getMeta('romanian-deadlift')!.flags, ctxFor(sciatica, { nerveFlag: true }).conditions).excluded).toBe(true);
    expect(evaluateFlags(getMeta('romanian-deadlift')!.flags, ctxFor(sciatica).conditions).needsNeuralGate).toBe(true);
  });

  it('excludes head-below-heart positions with severe retinopathy or the HEAD modifier', () => {
    expect(evaluateFlags(getMeta('back-extension-45')!.flags, ctxFor({ health: { retinopathy: 'severe_or_proliferative' } }).conditions).excluded).toBe(true);
    expect(evaluateFlags(getMeta('childs-pose')!.flags, ctxFor({}, { modifiers: ['HEAD'] }).conditions).excluded).toBe(true);
  });

  it('caps breath-hold-prone lifts with hypertension', () => {
    const v = evaluateFlags(getMeta('leg-press')!.flags, ctxFor({ health: { hypertension: 'treated' } }).conditions);
    expect(v.excluded).toBe(false);
    expect(v.caps.minRir).toBeGreaterThanOrEqual(3);
    expect(v.caps.minReps).toBeGreaterThanOrEqual(6);
    expect(v.caps.exhale).toBe(true);
  });

  it('caps isometric holds at 30 seconds with hypertension', () => {
    expect(evaluateFlags(getMeta('plank')!.flags, ctxFor({ health: { hypertension: 'treated' } }).conditions).caps.maxHoldSeconds).toBe(30);
  });

  it('excludes everything that loads the foot with the FOOT modifier, seated machines included', () => {
    const c = ctxFor({}, { modifiers: ['FOOT'] }).conditions;
    for (const id of ['leg-press', 'seated-calf-raise', 'hip-thrust', 'goblet-squat', 'split-squat', 'trap-bar-deadlift']) {
      expect(evaluateFlags(getMeta(id)!.flags, c).excluded, id).toBe(true);
    }
    // Floor and upper-body work stays: that is what the spec leaves a FOOT day.
    expect(evaluateFlags(getMeta('glute-bridge')!.flags, c).excluded).toBe(false);
    expect(evaluateFlags(getMeta('lying-leg-curl')!.flags, c).excluded).toBe(false);
  });

  it('caps every paused core drill at 30 seconds with the exhale cue under hypertension', () => {
    const treated = ctxFor({ health: { hypertension: 'treated' } }).conditions;
    for (const id of ['pallof-press', 'bird-dog', 'dead-bug', 'mcgill-curl-up', 'plank', 'side-plank']) {
      const v = evaluateFlags(getMeta(id)!.flags, treated);
      expect(v.excluded, id).toBe(false);
      expect(v.caps.maxHoldSeconds, id).toBe(30);
      expect(v.caps.exhale, id).toBe(true);
    }
  });

  it('bars sustained braces with proliferative retinopathy but keeps paused reps, exhale-cued', () => {
    const c = ctxFor({ health: { retinopathy: 'severe_or_proliferative' } }).conditions;
    for (const id of ['plank', 'side-plank', 'mcgill-curl-up']) {
      expect(evaluateFlags(getMeta(id)!.flags, c).excluded, id).toBe(true);
    }
    for (const id of ['dead-bug', 'bird-dog', 'pallof-press']) {
      const v = evaluateFlags(getMeta(id)!.flags, c);
      expect(v.excluded, id).toBe(false);
      expect(v.caps.maxHoldSeconds, id).toBe(5);
      expect(v.caps.exhale, id).toBe(true);
      expect(v.caps.notes.join(' '), id).toMatch(/breathing out/i);
    }
  });

  it('limits front-of-thigh nerve tension by leg-symptom status, never by the sciatic gate', () => {
    const active = ctxFor(sciatica, { nerveFlag: true }).conditions;
    const quiet = ctxFor(sciatica).conditions;
    const rfe = getMeta('rear-foot-elevated-split-squat')!.flags;
    expect(evaluateFlags(rfe, active).excluded).toBe(true);
    expect(evaluateFlags(rfe, quiet)).toMatchObject({ excluded: false, needsNeuralGate: false });
    expect(evaluateFlags(rfe, quiet).caps.notes.join(' ')).toMatch(/back thigh/i);
    // Grade 1 only adds a range cue: Appendix A keeps these available with sciatica.
    for (const id of ['split-squat', 'lying-leg-curl']) {
      const v = evaluateFlags(getMeta(id)!.flags, active);
      expect(v.excluded, id).toBe(false);
      expect(v.caps.notes.join(' '), id).toMatch(/front-of-thigh/i);
    }
  });
});

describe('selectForSlot', () => {
  it('picks the conventional deadlift only at hinge level 4', () => {
    expect(selectForSlot(slot('lowerC', 'lowerC.main'), ctxFor({ ladder: { hinge: 4 } })).exerciseId).toBe('deadlift');
    expect(selectForSlot(slot('lowerC', 'lowerC.main'), ctxFor({ ladder: { hinge: 3 } })).exerciseId).toBe('trap-bar-deadlift');
  });

  it('progresses the squat slot with the ladder', () => {
    const s = slot('lowerA', 'lowerA.main');
    expect(selectForSlot(s, ctxFor({ ladder: { squat: 4 } })).exerciseId).toBe('barbell-squat');
    expect(selectForSlot(s, ctxFor({ ladder: { squat: 2 } })).exerciseId).toBe('goblet-squat');
    expect(selectForSlot(s, ctxFor({ ladder: { squat: 1 } })).exerciseId).toBe('goblet-box-squat');
    expect(selectForSlot(s, ctxFor({ ladder: { squat: 0 } })).exerciseId).toBe('box-squat');
  });

  it('caps the hinge at level 1 while sciatica is active', () => {
    const sel = selectForSlot(slot('lowerC', 'lowerC.main'), ctxFor(sciatica, { nerveFlag: true }));
    expect(sel.exerciseId).toBe('kettlebell-deadlift');
    expect(sel.swappedFrom).toBe('deadlift');
    expect(sel.reason).toBeTruthy();
  });

  it('falls back to what home equipment allows', () => {
    expect(selectForSlot(slot('upperB', 'upperB.pull'), ctxFor({}, {}, 'homeDumbbells')).exerciseId).toBe('band-row');
    expect(selectForSlot(slot('upperB', 'upperB.pull'), ctxFor({}, {}, 'homeNone')).exerciseId).toBe('prone-y-t');
    expect(selectForSlot(slot('lowerC', 'lowerC.main'), ctxFor({}, {}, 'homeNone')).exerciseId).toBe('glute-bridge');
  });

  it('respects dislikes and avoids duplicates', () => {
    const ctx = ctxFor({ dislikes: ['dumbbell-bench-press'] });
    expect(selectForSlot(slot('upperA', 'upperA.press'), ctx).exerciseId).toBe('machine-chest-press');
    ctx.used.add('machine-chest-press');
    expect(selectForSlot(slot('upperA', 'upperA.press'), ctx).exerciseId).toBe('push-ups');
  });

  it('never plans a loaded leg press or a seated calf raise for a wound foot', () => {
    const ctx = ctxFor({ health: { diabetes: 'type2', peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' } });
    const picked = fillDay('lowerA', ctx);
    expect(picked).not.toContain('leg-press');
    expect(picked).not.toContain('seated-calf-raise');
    expect(picked.join(' ')).not.toMatch(/calf-raise|squat|lunge|step-up/);
  });

  it('gives a proliferative-retinopathy profile a named paused-rep trunk drill, not a brace', () => {
    const profile: ProfileInput = {
      pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' },
      health: { diabetes: 'type2', retinopathy: 'severe_or_proliferative' },
      ladder: { hinge: 1, squat: 1, neuralGate: false },
    };
    const PAUSED = ['dead-bug', 'bird-dog', 'pallof-press'];
    for (const access of ['homeNone', 'fullGym'] as const) {
      for (const focus of ALL_FOCUS) {
        const ctx = ctxFor(profile, {}, access);
        const slots = slotsFor(focus);
        const picked = fillDay(focus, ctx);
        const trunk = slots.map((s, i) => [s.role, picked[i]] as const).filter(([role]) => role === 'trunk');
        for (const [, id] of trunk) expect(PAUSED, `${access} · ${focus}`).toContain(id);
        for (const brace of ['plank', 'side-plank', 'mcgill-curl-up']) {
          expect(picked, `${access} · ${focus}`).not.toContain(brace);
        }
      }
    }
    // The side-plank slot lands on its listed alternative, not a generic fallback.
    expect(fillDay('lowerB', ctxFor(profile))[2]).toBe('bird-dog');
  });

  it('never fills two slots in one session with the same exercise', () => {
    for (const access of ['homeNone', 'homeDumbbells', 'fullGym'] as const) {
      for (const focus of ALL_FOCUS) {
        const ids = fillDay(focus, ctxFor({}, {}, access));
        expect(new Set(ids).size, `${access} · ${focus}: ${ids.join(' ')}`).toBe(ids.length);
      }
    }
  });

  it('never leaves a slot empty, even with every restriction at once (Review Focus #3)', () => {
    const everything: ProfileInput = {
      pain: { areas: ['lowerBack', 'sciatica', 'hamstring', 'calf'], sciaticaSide: 'left' },
      health: { diabetes: 'type1', insulin: 'injections_or_pump', hypertension: 'treated', retinopathy: 'severe_or_proliferative', peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' },
      ladder: { hinge: 0, squat: 0, neuralGate: false },
    };
    const ctx = ctxFor(everything, { back: 'amber', nerveFlag: true, modifiers: ['FOOT', 'HEAD', 'LOAD', 'INT', 'IMPACT'] }, 'homeNone');
    for (const focus of ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC'] as const) {
      for (const s of slotsFor(focus)) {
        const sel = selectForSlot(s, ctx);
        expect(sel.exerciseId, s.id).toBeTruthy();
        expect(getMeta(sel.exerciseId), s.id).toBeDefined();
      }
    }
  });
});
