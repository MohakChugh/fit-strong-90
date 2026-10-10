import { describe, it, expect } from 'vitest';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { createRunner, initialState, type RunnerState } from './runner';
import { toWorkoutSession, newRecords, withGuidedSession, activeSeconds, bankProgress } from './logging';
import { buildStretchPlan } from '@/engine/stretch';
import type { Step as SessionPlanStep } from '@/types/plan';

const profile = createDefaultProfile({ pain: { areas: ['lowerBack'] }, ladder: { hinge: 2, squat: 2 } });
const plan = buildSessionPlan({ profile, date: '2026-10-09', startDate: '2026-09-28', sessions: [] });
const runner = createRunner(plan);

/** A run that reached the end of the plan, as the runner leaves it. */
function finishedRun(): RunnerState {
  const started = runner.reduce(initialState(plan), { type: 'start', now: 0 });
  return runner.reduce(started, { type: 'tick', now: plan.totalSeconds * 1000 + 1 });
}

describe('toWorkoutSession', () => {
  it('logs a finished guided session with sets, mobility, cardio and symptom checks', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    const firstSet = plan.steps.find(x => x.kind === 'set' && !x.ramp)!;
    const check = plan.steps.find(x => x.kind === 'checkpoint' && x.question === 'backSymptoms')!;
    s = runner.reduce(s, { type: 'log', entry: { stepId: firstSet.id, kind: 'set', completed: true, reps: 6, weightKg: 50, at: 1 } });
    s = runner.reduce(s, { type: 'log', entry: { stepId: check.id, kind: 'checkpoint', completed: true, answer: 'same', at: 1 } });
    s = runner.reduce(s, { type: 'tick', now: plan.totalSeconds * 1000 + 1 });

    const w = toWorkoutSession(plan, s, { sessionId: 'g1', painAfter: 2 });
    expect(w).toMatchObject({ id: 'g1', date: '2026-10-09', dayOfWeek: 'friday', muscleGroup: 'lower', status: 'completed', guided: true, focus: 'lowerC', painAfter: 2 });
    expect(w.sets.length).toBe(plan.steps.filter(x => x.kind === 'set' && !x.ramp).length);
    expect(w.sets.find(x => x.id === `g1-${firstSet.id}`)).toMatchObject({ actualReps: 6, weight: 50, status: 'completed' });
    expect(w.totalVolume).toBeGreaterThanOrEqual(300);
    expect(w.mobility!.length).toBeGreaterThan(5);
    expect(w.cardio?.minutes).toBeGreaterThanOrEqual(10);
    expect(Object.values(w.symptomChecks ?? {})).toContain('same');
  });

  it('marks an abandoned session partial with skipped sets', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'tick', now: 400_000 });
    const w = toWorkoutSession(plan, s, { sessionId: 'g2' });
    expect(w.status).toBe('partial');
    expect(w.completedAt).toBeNull();
  });

  // Review Focus #2: "Finish now" and the low-glucose exit both reach `done`.
  it('marks a session ended early partial, not completed', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'tick', now: 400_000 });
    s = runner.reduce(s, { type: 'finish', now: 400_000 });
    const w = toWorkoutSession(plan, s, { sessionId: 'g4' });
    expect(s.status).toBe('done');
    expect(w.status).toBe('partial');
    expect(w.completedAt).toBeNull();
    expect(w.sets.filter(x => x.status === 'completed')).toHaveLength(0);
    // …while a run that consumed the last step still counts as completed.
    expect(toWorkoutSession(plan, finishedRun(), { sessionId: 'g5' }).status).toBe('completed');
  });

  // Review Focus #4: wall-clock span across an overnight pause is not time spent.
  it('reports time spent, not the span across an overnight pause', () => {
    const start = Date.parse('2026-10-09T23:50:00Z');
    let s = runner.reduce(initialState(plan), { type: 'start', now: start });
    s = runner.reduce(s, { type: 'tick', now: start + 480_000 });        // 8 minutes in
    s = runner.reduce(s, { type: 'pause', now: start + 480_000 });        // 23:58
    s = runner.reduce(s, { type: 'resume', now: start + 33_000_000 });    // 09:00 next morning
    s = runner.reduce(s, { type: 'finish', now: start + 33_060_000 });
    const w = toWorkoutSession(plan, s, { sessionId: 'g6' });
    expect(s.finishedAt! - s.startedAt!).toBeGreaterThan(33_000_000);     // the 9-hour span
    expect(w.durationSeconds).toBeLessThan(900);                          // under 15 minutes
    expect(w.durationSeconds).toBeGreaterThanOrEqual(480);
    expect(activeSeconds(plan, s)).toBe(w.durationSeconds);
    expect(w.completedAt).toBeNull();                                     // ended early
  });

  it('does not count a run skipped from start to finish as a session done', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    for (let i = 0; i < plan.steps.length && s.status !== 'done'; i++) s = runner.reduce(s, { type: 'next', now: 1000 + i, reason: 'skip' });
    expect(s.status).toBe('done');
    const w = toWorkoutSession(plan, s, { sessionId: 'g8' });
    expect(w.status).toBe('skipped');
    expect(w.completedAt).toBeNull();
  });

  it('counts a run that reached the end with most of the work skipped as partial', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'tick', now: 120_000 });   // the first couple of minutes, done
    for (let i = 0; i < plan.steps.length && s.status !== 'done'; i++) s = runner.reduce(s, { type: 'next', now: 130_000 + i, reason: 'skip' });
    expect(toWorkoutSession(plan, s, { sessionId: 'g9' }).status).toBe('partial');
  });

  it('records the time actually spent, without pauses or the unfinished rest of a step', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'pause', now: 10_000 });
    s = runner.reduce(s, { type: 'resume', now: 610_000 });
    s = runner.reduce(s, { type: 'finish', now: 620_000 });
    expect(toWorkoutSession(plan, s, { sessionId: 'g10' }).durationSeconds).toBe(20);
  });

  it('records when a finished session actually ended, and how long it took', () => {
    const state = finishedRun();
    const done = toWorkoutSession(plan, state, { sessionId: 'g7' });
    expect(new Date(done.completedAt!).getTime()).toBe(state.finishedAt);
    expect(done.durationSeconds).toBe(activeSeconds(plan, state));
  });
});

describe('bankProgress', () => {
  const empty: AppData = {
    version: 3, settings: {} as AppData['settings'], sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], profile,
  };
  it('saves the work of progress that can no longer be resumed', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'tick', now: 400_000 });
    s = runner.reduce(s, { type: 'pause', now: 400_000 });
    const data = bankProgress(empty, { plan, state: s }, 'old-1');
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ id: 'old-1', status: 'partial', guided: true });
  });
  it('keeps the time spent in the banked record', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(s, { type: 'tick', now: 400_000 });
    s = runner.reduce(s, { type: 'pause', now: 400_000 });
    expect(bankProgress(empty, { plan, state: s, clockAt: 400_000 }, 'old-3').sessions[0].durationSeconds).toBe(400);
    // Saved while still running: the stretch up to the save counts too.
    const running = runner.reduce(runner.reduce(initialState(plan), { type: 'start', now: 0 }), { type: 'tick', now: 300_000 });
    expect(bankProgress(empty, { plan, state: running, clockAt: 300_000 }, 'old-4').sessions[0].durationSeconds).toBe(300);
  });

  it('is not wiped out when another guided run that day is saved', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    s = runner.reduce(runner.reduce(s, { type: 'tick', now: 400_000 }), { type: 'pause', now: 400_000 });
    const banked = bankProgress(empty, { plan, state: s, clockAt: 400_000 }, 'banked');
    const later = withGuidedSession(banked, toWorkoutSession(plan, finishedRun(), { sessionId: 'second-run' }));
    expect(later.sessions.map(x => x.id).sort()).toEqual(['banked', 'second-run']);
  });

  it('leaves History alone when nothing was done', () => {
    const s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    expect(bankProgress(empty, { plan, state: s }, 'old-2')).toBe(empty);
  });
});

describe('withGuidedSession', () => {
  const empty: AppData = {
    version: 3, settings: {} as AppData['settings'], sessions: [], bodyMetrics: [],
    personalRecords: [], checkIns: [], profile,
  };

  // Review Focus #1: the runner saves at `done`, the Summary saves again with
  // painAfter — one record, updated, never two.
  it('updates the same session when it is saved twice', () => {
    const s = finishedRun();
    const first = toWorkoutSession(plan, s, { sessionId: 'g-same' });
    const second = toWorkoutSession(plan, s, { sessionId: 'g-same', painAfter: 3 });
    const data = withGuidedSession(withGuidedSession(empty, first), second);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ id: 'g-same', status: 'completed', painAfter: 3 });
  });

  it('replaces an empty unfinished record for the same day and keeps other days', () => {
    const partial = toWorkoutSession(plan, runner.reduce(initialState(plan), { type: 'start', now: 0 }), { sessionId: 'g-part' });
    const other = { ...partial, id: 'g-old', date: '2026-10-08' };
    const finished = toWorkoutSession(plan, finishedRun(), { sessionId: 'g-done' });
    const data = withGuidedSession({ ...empty, sessions: [partial, other] }, finished);
    expect(data.sessions.map(s => s.id)).toEqual(['g-done', 'g-old']);
  });

  // Review Focus #8: a "Worse" checkpoint must step the loading ladder down.
  it('steps the loading ladder down after a "worse" symptom checkpoint', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    const check = plan.steps.find(x => x.kind === 'checkpoint' && x.question === 'backSymptoms')!;
    s = runner.reduce(s, { type: 'log', entry: { stepId: check.id, kind: 'checkpoint', completed: true, answer: 'worse', at: 1 } });
    s = runner.reduce(s, { type: 'tick', now: plan.totalSeconds * 1000 + 1 });
    const data = withGuidedSession(empty, toWorkoutSession(plan, s, { sessionId: 'g-worse' }));
    expect(data.profile!.ladder.hinge).toBeLessThan(profile.ladder.hinge);
    expect(data.profile!.ladder.changedOn).toBe('2026-10-09');
  });

  // Scan J2-02: a stop for leg symptoms is that movement answered "worse", and a later "Same" never overrules it.
  it('records a stop for leg symptoms as "worse" for the movement, over any later answer, and steps the ladder down', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    const check = plan.steps.find(x => x.kind === 'checkpoint' && x.question === 'backSymptoms')! as Extract<SessionPlanStep, { kind: 'checkpoint' }>;
    const lift = check.exerciseId!;
    s = runner.reduce(s, { type: 'log', entry: { stepId: `stop-${lift}`, kind: 'checkpoint', exerciseId: lift, completed: true, answer: 'worse', at: 1 } });
    s = runner.reduce(s, { type: 'log', entry: { stepId: check.id, kind: 'checkpoint', completed: true, answer: 'same', at: 2 } });
    s = runner.reduce(s, { type: 'tick', now: plan.totalSeconds * 1000 + 1 });
    const w = toWorkoutSession(plan, s, { sessionId: 'g-stop' });
    expect(w.symptomChecks?.[lift]).toBe('worse');
    const data = withGuidedSession(empty, w);
    expect(data.profile!.ladder.hinge + data.profile!.ladder.squat).toBeLessThan(profile.ladder.hinge + profile.ladder.squat);
    expect(data.profile!.ladder.changedOn).toBe('2026-10-09');
  });

  it('leaves a legacy user without a stored profile alone', () => {
    const data = withGuidedSession({ ...empty, profile: undefined }, toWorkoutSession(plan, finishedRun(), { sessionId: 'g-np' }));
    expect(data.profile).toBeUndefined();
    expect(data.sessions).toHaveLength(1);
  });
});

describe('newRecords', () => {
  it('reports the best set per exercise when it beats the record', () => {
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    const sets = plan.steps.filter(x => x.kind === 'set' && !x.ramp && x.exerciseId === 'trap-bar-deadlift');
    s = runner.reduce(s, { type: 'log', entry: { stepId: sets[0].id, kind: 'set', completed: true, reps: 6, weightKg: 60, at: 1 } });
    s = runner.reduce(s, { type: 'log', entry: { stepId: sets[1].id, kind: 'set', completed: true, reps: 6, weightKg: 70, at: 2 } });
    const w = toWorkoutSession(plan, s, { sessionId: 'g3' });
    expect(newRecords(w, [{ exerciseId: 'trap-bar-deadlift', weight: 60, reps: 6, volume: 360, date: '2026-10-01' }]))
      .toEqual([{ exerciseId: 'trap-bar-deadlift', weight: 70, reps: 6, volume: 420, date: '2026-10-09' }]);
  });
});

describe('stretch and programme sessions on the same day', () => {
  const empty: AppData = {
    version: 3, settings: {} as AppData['settings'], sessions: [], bodyMetrics: [],
    personalRecords: [], checkIns: [], profile,
  };
  const stretch = buildStretchPlan({ profile, date: '2026-10-09', startDate: '2026-09-28', sessions: [], focus: 'backHips', minutes: 10 });
  const stretchRunner = createRunner(stretch);
  const finishedStretch = (): RunnerState => {
    const started = stretchRunner.reduce(initialState(stretch), { type: 'start', now: 0 });
    return stretchRunner.reduce(started, { type: 'tick', now: stretch.totalSeconds * 1000 + 1 });
  };

  it('marks a stretch so it can never count as the day\'s programme workout', () => {
    const session = toWorkoutSession(stretch, finishedStretch(), { sessionId: 's-1' });
    expect(session.planKind).toBe('stretch');
    expect(toWorkoutSession(plan, finishedRun(), { sessionId: 'g-1' }).planKind).toBe('full');
  });

  it('never replaces an unfinished programme record with a stretch', () => {
    const partial = toWorkoutSession(plan, runner.reduce(initialState(plan), { type: 'start', now: 0 }), { sessionId: 'g-part' });
    const done = toWorkoutSession(stretch, finishedStretch(), { sessionId: 's-done' });
    const data = withGuidedSession({ ...empty, sessions: [partial] }, done);
    expect(data.sessions.map(s => s.id).sort()).toEqual(['g-part', 's-done']);
  });

  it('banks a partial programme hour even when a stretch was finished that day', () => {
    const done = toWorkoutSession(stretch, finishedStretch(), { sessionId: 's-done' });
    let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    for (let i = 0; i < 8; i++) s = runner.reduce(s, { type: 'next', now: 1000 * (i + 1) });
    const banked = bankProgress({ ...empty, sessions: [done] }, { plan, state: s, clockAt: 9000 }, 'g-banked');
    expect(banked.sessions.some(x => x.id === 'g-banked')).toBe(true);
  });
});

describe('timed sets in a guided session', () => {
  it('marks a hold or a carry as counted in seconds, so it adds no weight lifted', () => {
    const isTimed = (st: SessionPlanStep) => st.kind === 'set' && !st.ramp && (st.holdSeconds !== undefined || st.carrySeconds !== undefined);
    // A week of plans: find a day whose strength block doses something in seconds.
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    const timedPlan = days.map(date => buildSessionPlan({ profile, date, startDate: '2026-09-28', sessions: [] })).find(p => p.steps.some(isTimed));
    expect(timedPlan).toBeDefined();
    const r = createRunner(timedPlan!);
    const done = r.reduce(r.reduce(initialState(timedPlan!), { type: 'start', now: 0 }), { type: 'tick', now: timedPlan!.totalSeconds * 1000 + 1 });
    const session = toWorkoutSession(timedPlan!, done, { sessionId: 'g-timed' });
    const timed = timedPlan!.steps.filter(isTimed);
    expect(timed.length).toBeGreaterThan(0);
    for (const st of timed) {
      const set = session.sets.find(x => x.id === `g-timed-${st.id}`);
      expect(set?.unit).toBe('seconds');
    }
    const lifted = session.sets.filter(x => x.unit !== 'seconds' && x.status === 'completed' && x.weight && x.actualReps)
      .reduce((t, x) => t + x.weight! * x.actualReps!, 0);
    expect(session.totalVolume).toBe(lifted);
  });
});
