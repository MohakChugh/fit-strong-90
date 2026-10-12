import { describe, expect, it } from 'vitest';
import { getMeta } from '@/data/catalog';
import { stretchPlanFor } from '@/engine/stretch';
import { evaluateCheckIn } from '@/engine/readiness';
import { stepSeconds } from '@/engine/timing';
import { createDefaultProfile } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { SessionPlan, Step } from '@/types/plan';
import { carriedOn, todayDose, withBackChecks, type DoseContext } from './carryOn';
import { reconcilePlan } from './gate';
import { initialState } from './runner';

/**
 * A saved run as it would carry on now: the hub that offers "Continue"
 * describes what the player will run, re-dosed to today (codex H2-02,
 * round 3 B05, B-30).
 */
const DATE = '2026-10-08';
const START = '2026-09-28';
const BACK = createDefaultProfile({
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
  ladder: { hinge: 2, squat: 2, neuralGate: false },
});
const data = (settings: object = {}) => ({ settings: { startDate: START, ...settings }, sessions: [] }) as unknown as DoseContext['data'];
const FLARE = { statusPeriods: [{ kind: 'flare' as const, from: DATE }] };
const SPEC = { focus: 'hipsLegs' as const, minutes: 15 as const };
const moves = (steps: readonly Step[]) => steps.filter(s => s.kind === 'hold' || s.kind === 'drill') as (Step & { exerciseId: string })[];
const avoided = (id: string) => { const m = getMeta(id); return m?.kind === 'mobility' && m.status === 'avoidWhenIrritable'; };
const ctx = (settings: object, todayPlan: SessionPlan): DoseContext => ({ data: data(settings), checkIns: [], profile: BACK, date: DATE, todayPlan, spec: SPEC });
const INPUT = { profile: BACK, now: new Date(2026, 9, 8, 9, 0), recent: [] };

/** Hips & legs at 15 minutes, built on a Normal day and saved `at` steps in. */
function savedNormal(at: number) {
  const plan = stretchPlanFor({ ...data(), checkIns: [] }, BACK, DATE, SPEC);
  return { plan, state: { ...initialState(plan), status: 'paused' as const, index: at } };
}

describe('a stretch saved on a Normal day, carried on during a flare (B-30, codex H2-02)', () => {
  it('what is left is the gentler routine’s: nothing a flare leaves out, and the minutes it takes', () => {
    const saved = savedNormal(2);
    const gentle = stretchPlanFor({ ...data(FLARE), checkIns: [] }, BACK, DATE, SPEC);
    const run = carriedOn(saved, ctx(FLARE, gentle), INPUT);
    // The rule is exercised: the Normal routine still to come held movements a flare leaves out.
    expect(moves(saved.plan.steps.slice(2)).some(s => avoided(s.exerciseId))).toBe(true);
    expect(moves(run.left).length).toBeGreaterThan(0);
    for (const s of moves(run.left)) expect(avoided(s.exerciseId), s.exerciseId).toBe(false);
    expect(run.left.every(s => !run.refused.has(s.id))).toBe(true);
    // From where it stopped: nothing already done is listed again.
    expect(run.left.every(s => saved.plan.steps.slice(0, 2).every(d => d.id !== s.id))).toBe(true);
    expect(run.minutesLeft).toBe(Math.max(1, Math.round(run.left.reduce((t, s) => t + stepSeconds(s), 0) / 60)));
    // Less than the saved run's own count, which still includes what the flare leaves out.
    const savedLeft = Math.round(saved.plan.steps.slice(2).reduce((t, s) => t + stepSeconds(s), 0) / 60);
    expect(run.minutesLeft).toBeLessThan(savedLeft);
  });

  it('is exactly the player’s reconciliation of the same run', () => {
    const saved = savedNormal(2);
    const gentle = stretchPlanFor({ ...data(FLARE), checkIns: [] }, BACK, DATE, SPEC);
    const c = ctx(FLARE, gentle);
    const r = reconcilePlan(saved.plan, 2, todayDose(saved.plan, c), INPUT);
    const run = carriedOn(saved, c, INPUT);
    expect(run.plan.steps).toEqual(r.plan.steps);
    expect([...run.refused].sort()).toEqual([...withBackChecks(r.plan, r.refused)].sort());
  });

  it('on a day that changes nothing, what is left is the saved run’s own steps', () => {
    const saved = savedNormal(2);
    const run = carriedOn(saved, ctx({}, saved.plan), INPUT);
    expect(run.left.map(s => s.id)).toEqual(saved.plan.steps.slice(2).map(s => s.id));
  });
});

describe('todayDose: what the builders prescribe now for the run’s own day and focus', () => {
  it('a stretch: today’s build of its routine, or the run itself when there is none to build', () => {
    const saved = savedNormal(0).plan;
    const gentle = stretchPlanFor({ ...data(FLARE), checkIns: [] }, BACK, DATE, SPEC);
    expect(todayDose(saved, ctx(FLARE, gentle)).steps).toEqual(gentle.steps);
    const none = { ...saved, id: 'stretch-unknown' };
    expect(todayDose(none, { ...ctx(FLARE, gentle), spec: null })).toBe(none);
    // A day the builder makes no stretch for (here, feeling unwell): the routine under way is held to its own steps.
    const unwell: DailyCheckIn = { date: DATE, urgentSymptoms: false, news: ['unwell'], sleep: 'gt7', energy: 4 };
    const record = { ...unwell, readiness: evaluateCheckIn(BACK, unwell) } as CheckInRecord;
    expect(stretchPlanFor({ ...data(), checkIns: [record] }, BACK, DATE, SPEC).kind).toBe('none');
    expect(todayDose(saved, { ...ctx({}, gentle), checkIns: [record], checkIn: record })).toBe(saved);
  });

  it('a guided run of today’s focus: today’s own plan', () => {
    const today = { ...savedNormal(0).plan, kind: 'full', focus: 'upperA', date: DATE } as SessionPlan;
    expect(todayDose(today, ctx({}, today))).toBe(today);
  });
});

describe('withBackChecks: a back check goes with the exercise it asks about (scan J2-02)', () => {
  it('refused once all its exercise’s work is refused, and kept otherwise', () => {
    const plan = {
      steps: [
        { id: 'a', kind: 'hold', exerciseId: 'x' },
        { id: 'b', kind: 'checkpoint', question: 'backSymptoms', exerciseId: 'x' },
        { id: 'c', kind: 'hold', exerciseId: 'y' },
        { id: 'd', kind: 'checkpoint', question: 'backSymptoms', exerciseId: 'y' },
      ],
    } as unknown as SessionPlan;
    expect([...withBackChecks(plan, new Set(['a']))].sort()).toEqual(['a', 'b']);
    const none = new Set<string>();
    expect(withBackChecks(plan, none)).toBe(none);
  });
});
