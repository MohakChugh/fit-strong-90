import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { coolDownTarget, createRunner, initialState, position, segmentsWithExtra, stepDurationMs, type RunnerState } from './runner';
import { createClock, devTimescale } from './clock';
import { saveProgress, loadProgress, rehydrate, clearProgress } from './persistence';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const plan = buildSessionPlan({
  profile: createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: false } }),
  date: '2026-10-09', startDate: '2026-09-28', sessions: [],
});
const runner = createRunner(plan);
const T0 = 1_000_000;
const start = (): RunnerState => runner.reduce(initialState(plan), { type: 'start', now: T0 });

describe('runner', () => {
  it('starts at the first step and tracks the segment from elapsed time', () => {
    const s = start();
    expect(s.status).toBe('running');
    const p = position(plan, s, T0 + 5000);
    expect(p.stepIndex).toBe(0);
    expect(p.stepElapsedMs).toBe(5000);
    expect(p.sessionTotalMs).toBe(plan.totalSeconds * 1000);
  });

  it('auto-advances on tick when a step ends', () => {
    const first = stepDurationMs(plan.steps[0], start());
    const s = runner.reduce(start(), { type: 'tick', now: T0 + first + 10 });
    expect(s.index).toBe(1);
    expect(s.logs[0]).toMatchObject({ stepId: plan.steps[0].id, completed: true });
  });

  it('lands on the correct step after a long gap (throttled or locked screen)', () => {
    const s = runner.reduce(start(), { type: 'tick', now: T0 + 600_000 });
    const p = position(plan, s, T0 + 600_000);
    expect(p.sessionElapsedMs).toBeGreaterThanOrEqual(600_000 - 1);
    expect(p.sessionElapsedMs).toBeLessThanOrEqual(600_001);
    expect(plan.steps[s.index].block).toBe('mobility');
  });

  it('freezes time while paused and resumes where it left off', () => {
    let s = runner.reduce(start(), { type: 'pause', now: T0 + 10_000 });
    expect(position(plan, s, T0 + 999_999).stepElapsedMs).toBe(10_000);
    s = runner.reduce(s, { type: 'tick', now: T0 + 999_999 });
    expect(s.index).toBe(0);
    s = runner.reduce(s, { type: 'resume', now: T0 + 60_000 });
    expect(position(plan, s, T0 + 61_000).stepElapsedMs).toBe(11_000);
  });

  it('skips forward and records the skip', () => {
    const s = runner.reduce(start(), { type: 'next', now: T0 + 1000, reason: 'skip' });
    expect(s.index).toBe(1);
    expect(s.logs[0]).toMatchObject({ skipped: true, completed: false });
  });

  it('goes back a step within 3 seconds, otherwise restarts the current step', () => {
    let s = runner.reduce(start(), { type: 'next', now: T0 + 1000 });
    s = runner.reduce(s, { type: 'previous', now: T0 + 2000 });
    expect(s.index).toBe(0);
    s = runner.reduce(s, { type: 'previous', now: T0 + 9000 });
    expect(s.index).toBe(0);
    expect(s.stepStartedAt).toBe(T0 + 9000);
  });

  it('adds 15 seconds to the current segment', () => {
    const s0 = start();
    const before = stepDurationMs(plan.steps[0], s0);
    const s = runner.reduce(s0, { type: 'addTime', now: T0 + 1000, seconds: 15 });
    expect(stepDurationMs(plan.steps[0], s)).toBe(before + 15_000);
  });

  it('adds 15 seconds to a hold, not to the step around it', () => {
    const idx = plan.steps.findIndex(x => x.kind === 'hold');
    const step = plan.steps[idx];
    const s0: RunnerState = { ...start(), index: idx, stepStartedAt: T0 };
    const prep = segmentsWithExtra(step, s0)[0].ms;
    const s = runner.reduce(s0, { type: 'addTime', now: T0 + prep + 2000, seconds: 15 });
    const segs = segmentsWithExtra(step, s);
    expect(segs[1].segment.kind).toBe('hold');
    expect(segs[1].ms).toBe(segmentsWithExtra(step, s0)[1].ms + 15_000);
  });

  it('never stretches a rep phase: "+15 s" during a set becomes extra rest', () => {
    const idx = plan.steps.findIndex((x, i) => x.kind === 'set' && !x.holdSeconds && !x.carrySeconds && plan.steps[i + 1]?.kind === 'rest');
    const step = plan.steps[idx];
    const rest = plan.steps[idx + 1];
    const s0: RunnerState = { ...start(), index: idx, stepStartedAt: T0 };
    // Two seconds into the first rep, past the prep segment.
    const at = T0 + segmentsWithExtra(step, s0)[0].ms + 2000;
    expect(position(plan, s0, at).segment.kind).toBe('rep');
    const s = runner.reduce(s0, { type: 'addTime', now: at, seconds: 15 });
    expect(stepDurationMs(step, s)).toBe(stepDurationMs(step, s0));
    expect(stepDurationMs(rest, s)).toBe(stepDurationMs(rest, s0) + 15_000);
    // The ring and the 3D demo still read the planned tempo for that rep.
    const p = position(plan, s, at);
    expect(p.segmentElapsedMs + p.segmentRemainingMs).toBe(2000);
  });

  it('counts a new visit when a step is entered, not when the clock is re-anchored', () => {
    const s0 = start();
    const first = stepDurationMs(plan.steps[0], s0);
    const ticked = runner.reduce(s0, { type: 'tick', now: T0 + 1000 });
    expect(ticked.visit).toBe(s0.visit);
    const advanced = runner.reduce(s0, { type: 'tick', now: T0 + first + 10 });
    expect(advanced.visit).toBe(s0.visit + 1);
    const paused = runner.reduce(advanced, { type: 'pause', now: T0 + first + 20 });
    const resumed = runner.reduce(paused, { type: 'resume', now: T0 + first + 90_000 });
    expect(resumed.visit).toBe(advanced.visit);
    expect(runner.reduce(resumed, { type: 'previous', now: T0 + first + 95_000 }).visit).toBe(advanced.visit + 1);
  });

  it('keeps logged reps and weight when the set auto-completes', () => {
    const setIdx = plan.steps.findIndex(x => x.kind === 'set');
    const setStep = plan.steps[setIdx];
    let s: RunnerState = { ...start(), index: setIdx, stepStartedAt: T0 };
    s = runner.reduce(s, { type: 'log', entry: { stepId: setStep.id, kind: 'set', completed: true, reps: 7, weightKg: 40, at: T0 } });
    s = runner.reduce(s, { type: 'tick', now: T0 + stepDurationMs(setStep, s) + 1 });
    expect(s.logs.find(l => l.stepId === setStep.id)).toMatchObject({ reps: 7, weightKg: 40, completed: true });
  });

  it('finishes after the last step', () => {
    const s = runner.reduce(start(), { type: 'tick', now: T0 + plan.totalSeconds * 1000 + 5000 });
    expect(s.status).toBe('done');
    expect(s.logs).toHaveLength(plan.steps.length);
  });
});

describe('clock', () => {
  it('scales time only when asked', () => {
    let real = 0;
    const c = createClock({ timescale: 30, realNow: () => real });
    real = 1000;
    expect(c.now()).toBe(30_000);
    expect(createClock({ realNow: () => 5 }).now()).toBe(5);
  });

  it('reads ?timescale only in dev builds', () => {
    expect(devTimescale(true, 'http://x/#/session?timescale=30')).toBe(30);
    expect(devTimescale(false, 'http://x/#/session?timescale=30')).toBe(1);
    expect(devTimescale(true, 'http://x/#/session?timescale=9999')).toBe(1);
  });
});

describe('persistence (Review Focus #2)', () => {
  beforeEach(() => { store.clear(); clearProgress(); });

  it('resumes across midnight with the original plan and date, paused at the same point', () => {
    const s = runner.reduce(start(), { type: 'tick', now: T0 + 120_000 });
    saveProgress(plan, s, T0 + 125_000, Date.parse('2026-10-09T23:58:00'));
    const loaded = loadProgress(Date.parse('2026-10-10T00:20:00'));
    expect(loaded?.plan.date).toBe('2026-10-09');
    const NOW = 50_000_000;
    const resumed = rehydrate(loaded!.state, loaded!.clockAt, NOW);
    expect(resumed.status).toBe('paused');
    expect(position(loaded!.plan, resumed, NOW).sessionElapsedMs).toBeCloseTo(125_000, -2);
  });

  it('does not offer very old progress', () => {
    saveProgress(plan, start(), T0, Date.parse('2026-10-08T06:00:00'));
    expect(loadProgress(Date.parse('2026-10-09T06:00:00'))).toBeNull();
  });

  it('does not offer finished sessions', () => {
    const done = runner.reduce(start(), { type: 'finish', now: T0 + 1 });
    saveProgress(plan, done, T0 + 1);
    expect(loadProgress()).toBeNull();
  });
});

describe('runner: completion, safety gates and active time', () => {
  const hypoPlan = buildSessionPlan({
    profile: createDefaultProfile({ health: { diabetes: 'type1', insulin: 'mdi', glucoseMonitor: 'meter' } as never }),
    date: '2026-10-09', startDate: '2026-09-28', sessions: [],
  });
  const hypo = createRunner(hypoPlan);
  const at = (p: typeof plan, r: typeof runner, index: number): RunnerState => ({ ...r.reduce(initialState(p), { type: 'start', now: T0 }), index, stepStartedAt: T0 });
  const logOf = (s: RunnerState, id: string) => s.logs.find(l => l.stepId === id);

  it('counts a set as done when it finishes after the weight was changed mid-set', () => {
    const idx = plan.steps.findIndex(x => x.kind === 'set' && !x.ramp);
    const set = plan.steps[idx];
    let s = at(plan, runner, idx);
    // The weight stepper logs while the set is still running.
    s = runner.reduce(s, { type: 'log', entry: { stepId: set.id, kind: 'set', completed: false, reps: 8, weightKg: 30, at: T0 + 1 } });
    s = runner.reduce(s, { type: 'tick', now: T0 + stepDurationMs(set, s) + 1 });
    expect(logOf(s, set.id)).toMatchObject({ completed: true, reps: 8, weightKg: 30 });
  });

  it('counts a step as done when the user goes back to it after skipping and finishes it', () => {
    let s = runner.reduce(start(), { type: 'next', now: T0 + 1000, reason: 'skip' });
    s = runner.reduce(s, { type: 'previous', now: T0 + 2000 });
    s = runner.reduce(s, { type: 'tick', now: T0 + 2000 + stepDurationMs(plan.steps[0], s) + 1 });
    expect(logOf(s, plan.steps[0].id)).toMatchObject({ completed: true });
    expect(logOf(s, plan.steps[0].id)?.skipped).toBeUndefined();
  });

  it('keeps a skipped set skipped even after its weight was logged', () => {
    const idx = plan.steps.findIndex(x => x.kind === 'set' && !x.ramp);
    const set = plan.steps[idx];
    let s = at(plan, runner, idx);
    s = runner.reduce(s, { type: 'log', entry: { stepId: set.id, kind: 'set', completed: false, weightKg: 30, at: T0 + 1 } });
    s = runner.reduce(s, { type: 'next', now: T0 + 2000, reason: 'skip' });
    expect(logOf(s, set.id)).toMatchObject({ completed: false, skipped: true, weightKg: 30 });
  });

  it('waits at the glucose check before cardio until it is answered', () => {
    const idx = hypoPlan.steps.findIndex(x => x.kind === 'checkpoint' && x.question === 'glucose');
    expect(idx).toBeGreaterThan(0);
    const check = hypoPlan.steps[idx];
    let s = at(hypoPlan, hypo, idx);
    s = hypo.reduce(s, { type: 'tick', now: T0 + 10 * 60_000 });
    expect(s.index).toBe(idx);
    expect(position(hypoPlan, s, T0 + 10 * 60_000).stepRemainingMs).toBe(0);
    s = hypo.reduce(s, { type: 'log', entry: { stepId: check.id, kind: 'checkpoint', completed: true, answer: 'ok', at: T0 + 10 * 60_000 } });
    s = hypo.reduce(s, { type: 'next', now: T0 + 10 * 60_000 });
    expect(hypoPlan.steps[s.index].kind).toBe('cardio');
  });

  it('after a low, "cool-down only" lands on the cool-down and does not count the cardio as done', () => {
    const from = hypoPlan.steps.findIndex(x => x.kind === 'set' && !x.ramp);
    let s = hypo.reduce(at(hypoPlan, hypo, from), { type: 'pause', now: T0 + 5000 });
    const target = coolDownTarget(hypoPlan, from);
    const cardioIdx = hypoPlan.steps.findIndex(x => x.kind === 'cardio');
    expect(target).toMatchObject({ index: cardioIdx });
    s = hypo.reduce(s, { type: 'seek', now: T0 + 6000, ...target! });
    s = hypo.reduce(s, { type: 'resume', now: T0 + 7000 });
    const p = position(hypoPlan, s, T0 + 7000);
    expect(p.stepIndex).toBe(cardioIdx);
    expect(p.segment.intensity).toBe('cooldown');
    // Nothing in between was done; the glucose check the user just answered by treating is skipped too.
    for (let i = from; i < cardioIdx; i++) expect(logOf(s, hypoPlan.steps[i].id)).toMatchObject({ completed: false });
    s = hypo.reduce(s, { type: 'tick', now: T0 + 7000 + p.stepRemainingMs + 1 });
    expect(logOf(s, hypoPlan.steps[cardioIdx].id)).toMatchObject({ completed: false });
  });

  it('"cool-down only" jumps ahead within the cardio, and to the wrap-up once the cool-down has begun', () => {
    const cardioIdx = plan.steps.findIndex(x => x.kind === 'cardio');
    const cool = segmentsWithExtra(plan.steps[cardioIdx], start()).findIndex(x => x.segment.intensity === 'cooldown');
    expect(coolDownTarget(plan, cardioIdx, 0)).toEqual({ index: cardioIdx, segment: cool });
    expect(coolDownTarget(plan, cardioIdx, cool)).toEqual({ index: plan.steps.length - 1, segment: 0 });
  });

  it('records active time without pauses', () => {
    let s = start();
    s = runner.reduce(s, { type: 'pause', now: T0 + 10_000 });
    s = runner.reduce(s, { type: 'resume', now: T0 + 610_000 });
    s = runner.reduce(s, { type: 'finish', now: T0 + 620_000 });
    expect(s.activeMs).toBe(20_000);
  });

  it('a session reopened after closing counts only the time before it was saved', () => {
    const s = runner.reduce(start(), { type: 'tick', now: T0 + 30_000 });
    const back = rehydrate(s, T0 + 30_000, T0 + 3_600_000);
    expect(back.status).toBe('paused');
    expect(back.activeMs).toBe(30_000);
    const done = runner.reduce(runner.reduce(back, { type: 'resume', now: T0 + 3_600_000 }), { type: 'finish', now: T0 + 3_605_000 });
    expect(done.activeMs).toBe(35_000);
  });
});

describe('runner: second-review fixes', () => {
  const hypoPlan = buildSessionPlan({
    profile: createDefaultProfile({ health: { diabetes: 'type1', insulin: 'mdi', glucoseMonitor: 'meter' } as never }),
    date: '2026-10-09', startDate: '2026-09-28', sessions: [],
  });
  const hypo = createRunner(hypoPlan);
  const at = (index: number): RunnerState => ({ ...hypo.reduce(initialState(hypoPlan), { type: 'start', now: T0 }), index, stepStartedAt: T0 });

  it('after "cool-down only", Previous never rewinds into the warm-up or the intervals', () => {
    const from = hypoPlan.steps.findIndex(x => x.kind === 'set' && !x.ramp);
    const target = coolDownTarget(hypoPlan, from)!;
    let s = hypo.reduce(hypo.reduce(at(from), { type: 'pause', now: T0 + 1000 }), { type: 'seek', now: T0 + 2000, ...target });
    s = hypo.reduce(s, { type: 'resume', now: T0 + 2000 });
    for (const dt of [1000, 20_000]) {           // within 3 s, and later
      s = hypo.reduce(s, { type: 'previous', now: T0 + 2000 + dt });
      const p = position(hypoPlan, s, T0 + 2000 + dt);
      expect(p.stepIndex).toBe(target.index);
      expect(p.segment.intensity).toBe('cooldown');
    }
    s = hypo.reduce(s, { type: 'tick', now: T0 + 3_600_000 });
    expect(s.logs.find(l => l.stepId === hypoPlan.steps[target.index].id)).toMatchObject({ completed: false });
  });

  it('Next cannot skip the glucose check before cardio while it is unanswered', () => {
    const idx = hypoPlan.steps.findIndex(x => x.kind === 'checkpoint' && x.question === 'glucose');
    const s = hypo.reduce(at(idx), { type: 'next', now: T0 + 1000, reason: 'skip' });
    expect(s.index).toBe(idx);
  });
});

describe('persistence: run identity and older saves', () => {
  it('keeps the run id with saved progress, so a resumed run updates its own record', () => {
    saveProgress(plan, start(), T0, Date.now(), 'guided-run-7');
    expect(loadProgress()?.sessionId).toBe('guided-run-7');
    clearProgress();
  });

  it('a session saved by an older build keeps its earlier time when resumed', () => {
    // Older builds kept no activeMs or runningSince.
    const legacy: RunnerState = { ...runner.reduce(start(), { type: 'tick', now: T0 + 10_000 }), activeMs: undefined, runningSince: undefined };
    const back = rehydrate(legacy, T0 + 10_000, T0 + 100_000, plan);
    const done = runner.reduce(runner.reduce(back, { type: 'resume', now: T0 + 100_000 }), { type: 'finish', now: T0 + 105_000 });
    expect(done.activeMs).toBe(15_000);
  });
});

describe('a finished run (scan M-03)', () => {
  it('stays finished: Previous, from the screen or an earphone, changes nothing', () => {
    const done = runner.reduce(start(), { type: 'finish', now: T0 + 60_000 });
    expect(done.status).toBe('done');
    for (const dt of [500, 10_000]) expect(runner.reduce(done, { type: 'previous', now: T0 + 60_000 + dt })).toBe(done);
    // Before it ends, Previous still steps back or restarts the step.
    const moved = runner.reduce(runner.reduce(start(), { type: 'next', now: T0 + 1000 }), { type: 'previous', now: T0 + 2000 });
    expect(moved.index).toBe(0);
    expect(moved.status).toBe('running');
  });
});
