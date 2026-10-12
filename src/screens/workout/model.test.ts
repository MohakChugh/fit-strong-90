import { describe, it, expect } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { SessionPlan } from '@/types/plan';
import { buildSessionPlan } from '@/engine/session';
import { sessionSeconds } from '@/session/logging';
import { newObservation, nowAt } from '@/health/observation';
import { recordedMovement, sessionInterval } from '@/screens/track/movement';
import { createDefaultProfile } from '@/profile/defaults';
import {
  currentItem, itemFor, pendingCheck, planKey, prefill, progress, restLeftMs, restoreWorkout, resumed, sequence,
  startWorkout, toSession, workoutReducer, type Planned, type WorkoutAction, type WorkoutState,
} from './model';

const profile = createDefaultProfile({ weightKg: 80 });
const back = createDefaultProfile({ weightKg: 80, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' } });
/** Monday: Lower A. Tuesday: Upper A (a two-exercise circuit). Saturday: Upper C (a three-exercise circuit). */
const MONDAY = '2026-10-05';
const T0 = Date.parse('2026-10-05T18:00:00.000Z');

const planFor = (date = MONDAY, p = profile): SessionPlan =>
  buildSessionPlan({ profile: p, date, startDate: '2026-09-28', sessions: [] });
const start = (plan = planFor()) => startWorkout(plan, { id: 'w1', defaultRest: 90 });
const run = (state: WorkoutState, ...actions: WorkoutAction[]) => actions.reduce(workoutReducer, state);
const log = (key: string, reps = 10, weightKg: number | null = 20, now = T0): WorkoutAction => ({ type: 'log', key, reps, weightKg, now });
const finish = (now = T0, activeMinutes: number | null = null, notes = ''): WorkoutAction => ({ type: 'finish', now, notes, activeMinutes });

describe('starting from the plan', () => {
  it('logs the same exercises and doses the guided session would run', () => {
    const plan = planFor();
    const w = start(plan);
    expect(w.items.map(i => i.exerciseId)).toEqual(plan.exercises.map(e => e.exerciseId));
    for (const [n, item] of w.items.entries()) {
      expect(item.sets).toHaveLength(plan.exercises[n].rx.sets);
      expect(item.sets.every(s => s.status === 'pending' && s.plannedReps === plan.exercises[n].rx.targetReps)).toBe(true);
    }
    expect(w).toMatchObject({ begun: false, revision: 0, status: 'in_progress', date: MONDAY, focus: 'lowerA', planId: plan.id });
  });

  it('counts holds and carries in seconds', () => {
    const w = start(planFor('2026-10-07'));
    expect(itemFor(w, 'lowerB.lateral')).toMatchObject({ exerciseId: 'side-plank', target: { timed: true, reps: 20, perSide: true } });
    expect(itemFor(w, 'lowerB.lateral')!.sets[0].plannedReps).toBe(20);
    expect(itemFor(w, 'lowerB.carry')).toMatchObject({ exerciseId: 'suitcase-carry', target: { timed: true, reps: 30 } });
  });

  it("keeps the planner's reason when it swapped an exercise for safety", () => {
    // The default ladder is at squat level 3; a barbell back squat needs level 4.
    expect(itemFor(start(), 'lowerA.main')).toMatchObject({
      exerciseId: 'goblet-squat',
      plannerSwap: { from: 'barbell-squat', reason: 'unlocks at squat level 4' },
    });
  });

  it("groups the plan's supersets and circuits with the plan's own rests", () => {
    expect(start().groups).toEqual([
      { id: 'lowerA.p1', kind: 'superset', keys: ['lowerA.single', 'lowerA.trunk'], restBetween: 60, restAfterRound: 60 },
      { id: 'lowerA.p2', kind: 'superset', keys: ['lowerA.curl', 'lowerA.calf'], restBetween: 60, restAfterRound: 60 },
    ]);
    expect(start(planFor('2026-10-06')).groups.find(g => g.id === 'upperA.c'))
      .toMatchObject({ kind: 'circuit', restBetween: 30, restAfterRound: 45 });
  });

  it("orders sets the guided session's way: an exercise's sets together, a group one set each in turn", () => {
    const seq = sequence(start(planFor('2026-10-10'))).map(e => `${e.key}:${e.index + 1}`);
    expect(seq.slice(0, 6)).toEqual(['upperC.push:1', 'upperC.pull:1', 'upperC.push:2', 'upperC.pull:2', 'upperC.push:3', 'upperC.pull:3']);
    expect(seq.slice(-6)).toEqual(['upperC.side:1', 'upperC.bi:1', 'upperC.tri:1', 'upperC.side:2', 'upperC.bi:2', 'upperC.tri:2']);
  });

  it('follows a plan that changes before anything is logged, and only then', () => {
    expect(planKey(planFor())).toBe(planKey(planFor()));
    expect(planKey(planFor())).not.toBe(planKey(planFor('2026-10-06')));
  });
});

describe('logging sets', () => {
  it('logs the next set, begins the record and starts the rest from the clock', () => {
    const w = run(start(), log('lowerA.main', 9, 24));
    expect(itemFor(w, 'lowerA.main')!.sets[0]).toMatchObject({ status: 'completed', actualReps: 9, weight: 24 });
    expect(w).toMatchObject({ begun: true, revision: 1, startedAt: new Date(T0).toISOString(), current: 'lowerA.main' });
    // The plan's rest between goblet squat sets.
    expect(w.rest).toEqual({ endsAt: T0 + 120_000, seconds: 120 });
  });

  it('keeps time from the deadline, however long the phone slept', () => {
    const { rest } = run(start(), log('lowerA.main'));
    expect(restLeftMs(rest, T0 + 30_000)).toBe(90_000);
    expect(restLeftMs(rest, T0 + 3_600_000)).toBe(0);
    expect(restLeftMs(null, T0)).toBe(0);
    // A clock last read before the set was logged cannot show more than the rest.
    expect(restLeftMs(rest, T0 - 600_000)).toBe(120_000);
  });

  it('skips a rest without storing anything', () => {
    const resting = run(start(), log('lowerA.main'));
    const skipped = run(resting, { type: 'endRest' });
    expect(skipped.rest).toBeNull();
    expect(skipped.revision).toBe(resting.revision);
    expect(run(skipped, { type: 'endRest' })).toBe(skipped);
  });

  it("alternates a superset set by set, with the plan's rests", () => {
    let w = run(start(), log('lowerA.single'));
    expect(w.current).toBe('lowerA.trunk');
    expect(w.rest?.seconds).toBe(60);
    w = run(w, log('lowerA.trunk', 7, null));
    expect(w.current).toBe('lowerA.single');
    expect(itemFor(w, 'lowerA.single')!.sets.map(s => s.status)).toEqual(['completed', 'pending']);
  });

  it("moves on after an exercise's last set, resting the user's default between exercises", () => {
    const w = run(start(), log('lowerA.main'), log('lowerA.main'), log('lowerA.main'));
    expect(w.current).toBe('lowerA.secondary');
    expect(w.rest?.seconds).toBe(90);
  });

  it('owes no rest after the last set of all', () => {
    const w = start();
    const actions = sequence(w).map(e => log(e.key));
    const done = run(w, ...actions);
    expect(progress(done)).toMatchObject({ done: done.items.flatMap(i => i.sets).length, pending: 0 });
    expect(done.rest).toBeNull();
    expect(currentItem(done)).toBeUndefined();
  });

  it('goes back to an exercise left behind once the rest is done', () => {
    // Jump ahead to leg press after one squat set: the squats are picked up afterwards.
    let w = run(start(), log('lowerA.main'), { type: 'focus', key: 'lowerA.secondary' });
    expect(currentItem(w)?.key).toBe('lowerA.secondary');
    w = run(w, log('lowerA.secondary'), log('lowerA.secondary'));
    expect(w.current).toBe('lowerA.single');
    const rest = sequence(w).filter(e => e.key !== 'lowerA.main').map(e => log(e.key));
    w = run(w, ...rest);
    expect(w.current).toBe('lowerA.main');
  });

  it('offers the weight just lifted for the next set, aiming at the planned reps', () => {
    const fresh = start();
    expect(prefill(fresh, itemFor(fresh, 'lowerA.main')!)).toEqual({ reps: 9, weightKg: null });
    const w = run(fresh, log('lowerA.main', 7, 22.5));
    expect(prefill(w, itemFor(w, 'lowerA.main')!)).toEqual({ reps: 9, weightKg: 22.5 });
  });

  it("offers the planner's suggested load before the first set", () => {
    const plan = planFor();
    plan.exercises[0] = { ...plan.exercises[0], rx: { ...plan.exercises[0].rx, load: { kg: 20, note: 'same' } } };
    const w = start(plan);
    expect(prefill(w, w.items[0]).weightKg).toBe(20);
  });
});

describe('correcting sets', () => {
  it('undo takes back the last set, stops its rest and offers its values again', () => {
    let w = run(start(), log('lowerA.main', 9, 24), log('lowerA.main', 8, 24));
    w = run(w, { type: 'undo' });
    const squat = itemFor(w, 'lowerA.main')!;
    expect(squat.sets.map(s => s.status)).toEqual(['completed', 'pending', 'pending']);
    expect(squat.sets[1]).toMatchObject({ actualReps: null, weight: null });
    expect(w.rest).toBeNull();
    expect(prefill(w, squat)).toEqual({ reps: 8, weightKg: 24 });
    w = run(w, { type: 'undo' }, { type: 'undo' });
    expect(progress(w).done).toBe(0);
    expect(w.revision).toBe(4);
  });

  it('edits a logged set in place and can mark it not done again', () => {
    let w = run(start(), log('lowerA.main', 9, 24), log('lowerA.main', 9, 24));
    const [first, second] = itemFor(w, 'lowerA.main')!.sets;
    w = run(w, { type: 'edit', setId: first.id, reps: 10, weightKg: 26 });
    expect(itemFor(w, 'lowerA.main')!.sets[0]).toMatchObject({ status: 'completed', actualReps: 10, weight: 26 });
    w = run(w, { type: 'unlog', setId: second.id });
    expect(itemFor(w, 'lowerA.main')!.sets.map(s => s.status)).toEqual(['completed', 'pending', 'pending']);
    // Undo skips the set already marked not done and takes back the one before it.
    w = run(w, { type: 'undo' });
    expect(progress(w).done).toBe(0);
  });

  it('refuses to edit a set that was never logged', () => {
    const w = start();
    expect(run(w, { type: 'edit', setId: w.items[0].sets[0].id, reps: 5, weightKg: 5 })).toBe(w);
    expect(run(w, { type: 'undo' })).toBe(w);
  });
});

describe('skipping and swapping', () => {
  it('skips the rest of an exercise, begins the record, and can bring it back', () => {
    let w = run(start(), { type: 'skip', key: 'lowerA.main' });
    expect(itemFor(w, 'lowerA.main')!.sets.every(s => s.status === 'skipped')).toBe(true);
    expect(w).toMatchObject({ begun: true, current: 'lowerA.secondary', startedAt: null });
    w = run(w, { type: 'unskip', key: 'lowerA.main' });
    expect(itemFor(w, 'lowerA.main')!.sets.every(s => s.status === 'pending')).toBe(true);
    expect(w.current).toBe('lowerA.main');
  });

  it("finishes a superset's other exercise after its partner is skipped, rather than moving on", () => {
    let w = run(start(), log('lowerA.single'));
    expect(w.current).toBe('lowerA.trunk');
    w = run(w, { type: 'skip', key: 'lowerA.trunk' });
    expect(w.current).toBe('lowerA.single');
    // A lone exercise skipped part-way moves on to the next one.
    w = run(start(), log('lowerA.main'), { type: 'skip', key: 'lowerA.main' });
    expect(w.current).toBe('lowerA.secondary');
  });

  const boxSquat: Planned = {
    exerciseId: 'box-squat',
    target: { sets: 2, reps: 12, timed: false, perSide: false, rampSets: 0, caps: [] },
    checkpoint: false,
  };

  it('swaps an exercise not yet started, remembers what it replaced, and swaps back', () => {
    let w = run(start(), { type: 'swap', key: 'lowerA.main', to: boxSquat });
    const swapped = itemFor(w, 'lowerA.main')!;
    expect(swapped).toMatchObject({ exerciseId: 'box-squat', swappedFrom: { exerciseId: 'goblet-squat' } });
    expect(swapped.sets.map(s => [s.exerciseId, s.plannedReps])).toEqual([['box-squat', 12], ['box-squat', 12]]);
    // Not stored until something is logged: a swap alone is not a workout.
    expect(w.begun).toBe(false);
    w = run(w, { type: 'swap', key: 'lowerA.main', to: { ...boxSquat, exerciseId: 'goblet-squat' } });
    expect(itemFor(w, 'lowerA.main')).toMatchObject({ exerciseId: 'goblet-squat', plannerSwap: { from: 'barbell-squat' } });
    expect(itemFor(w, 'lowerA.main')!.swappedFrom).toBeUndefined();
    expect(itemFor(w, 'lowerA.main')!.sets).toHaveLength(3);
  });

  it('will not swap away work already done', () => {
    const w = run(start(), log('lowerA.main'));
    expect(run(w, { type: 'swap', key: 'lowerA.main', to: boxSquat })).toBe(w);
  });
});

describe('the back-symptom checkpoint', () => {
  it("is due once the planner's checkpointed exercise is settled, and only until it is answered", () => {
    let w = start(planFor(MONDAY, back));
    expect(itemFor(w, 'lowerA.main')!.checkpoint).toBe(true);
    w = run(w, log('lowerA.main'), log('lowerA.main'));
    expect(pendingCheck(w)).toBeUndefined();
    w = run(w, log('lowerA.main'));
    expect(pendingCheck(w)?.exerciseId).toBe('goblet-squat');
    w = run(w, { type: 'answer', exerciseId: 'goblet-squat', answer: 'same' });
    expect(pendingCheck(w)).toBeUndefined();
    expect(toSession(w).symptomChecks).toEqual({ 'goblet-squat': 'same' });
  });

  it('is not asked about an exercise skipped without a set done', () => {
    const w = run(start(planFor(MONDAY, back)), { type: 'skip', key: 'lowerA.main' });
    expect(pendingCheck(w)).toBeUndefined();
  });

  it('is not asked where the planner does not ask it', () => {
    const w = run(start(), log('lowerA.main'), log('lowerA.main'), log('lowerA.main'));
    expect(pendingCheck(w)).toBeUndefined();
  });
});

describe('finishing', () => {
  it('records a workout with at least half its sets done as completed', () => {
    const w = start();
    const half = sequence(w).slice(0, Math.ceil(progress(w).total / 2)).map(e => log(e.key));
    const done = run(w, ...half, finish(T0 + 2_700_000, null, 'Knees fine.'));
    expect(done).toMatchObject({ status: 'completed', completedAt: new Date(T0 + 2_700_000).toISOString(), notes: 'Knees fine.', rest: null });
  });

  it('records fewer than half as partly done, and nothing done as skipped', () => {
    expect(run(start(), log('lowerA.main'), finish()).status).toBe('partial');
    expect(run(start(), { type: 'skip', key: 'lowerA.main' }, finish()).status).toBe('skipped');
  });

  it('reopens a finish that could not be saved, as it was, ready to finish again', () => {
    const going = run(start(), log('lowerA.main'));
    const finished = run(going, finish(T0 + 60_000, 30, 'Kept.'));
    const reopened = run(finished, { type: 'reopen' });
    expect(reopened).toMatchObject({ status: 'in_progress', completedAt: null, notes: 'Kept.', activeMinutes: 30 });
    expect(reopened.items).toBe(going.items);
    expect(run(going, { type: 'reopen' })).toBe(going);
    expect(run(reopened, log('lowerA.main')).items[0].sets.filter(s => s.status === 'completed')).toHaveLength(2);
  });

  it('cannot finish a workout that never began, or change one that has finished', () => {
    const fresh = start();
    expect(run(fresh, finish())).toBe(fresh);
    const finished = run(fresh, log('lowerA.main'), finish());
    expect(run(finished, log('lowerA.main'))).toBe(finished);
  });
});

describe('one sitting', () => {
  // Whether sets have been logged without a break decides which readiness
  // question the next one asks (re-audit B03), so it is never stored.
  it('is live from the first set logged in it', () => {
    const fresh = start();
    expect(fresh.live).toBe(false);
    expect(run(fresh, log('lowerA.main')).live).toBe(true);
    // Choosing what to do next is not exercise, though it begins the record:
    // a skip before the first set must not get round the start's check-in.
    expect(run(fresh, { type: 'skip', key: 'lowerA.main' })).toMatchObject({ begun: true, live: false });
  });

  it('ends when the workout is restored from its record', () => {
    const going = run(start(), log('lowerA.main'));
    const restored = restoreWorkout(toSession(going), planFor(), { defaultRest: 90 });
    expect(restored).toMatchObject({ begun: true, live: false });
    expect(run(restored, { type: 'skip', key: 'lowerA.main' }).live).toBe(false);
    expect(run(restored, log('lowerA.main')).live).toBe(true);
  });

  it('ends with a finish, and stays ended if a failed save reopens the workout', () => {
    const reopened = run(start(), log('lowerA.main'), finish(), { type: 'reopen' });
    expect(reopened).toMatchObject({ status: 'in_progress', live: false });
    expect(run(reopened, log('lowerA.main')).live).toBe(true);
  });

  it('ends when the screen takes up a workout it held in memory, keeping all else', () => {
    const going = run(start(), log('lowerA.main'));
    const back2 = resumed(going);
    expect(back2).toEqual({ ...going, live: false });
    expect(back2.items).toBe(going.items);
  });

  it('knows when its last set was logged, so a long gap can end it (M-04)', () => {
    const going = run(start(), log('lowerA.main', 10, 20, T0), log('lowerA.main', 10, 20, T0 + 120_000));
    expect(going.lastSetAt).toBe(T0 + 120_000);
    expect(start().lastSetAt).toBeNull();
  });

  it('ends when the page is hidden, keeping everything else and storing nothing (M-04)', () => {
    const going = run(start(), log('lowerA.main'));
    const away = run(going, { type: 'away' });
    expect(away).toEqual({ ...going, live: false });
    expect(run(start(), { type: 'away' })).toEqual(start());
  });
});

describe('active time', () => {
  const nine = Date.parse('2026-10-05T09:00:00');
  const one = Date.parse('2026-10-05T13:00:00');

  it('credits no movement for hours the app did not see, however long the workout stayed open', () => {
    // One set at 09:00, the phone locked, finished at 13:00: four hours elapsed, none of it known to be exercise.
    const s = toSession(run(start(), log('lowerA.main', 10, 20, nine), finish(one)));
    expect(s).toMatchObject({ startedAt: new Date(nine).toISOString(), completedAt: new Date(one).toISOString(), durationSeconds: 0 });
    expect(sessionSeconds(s)).toBe(0);
    expect(sessionInterval(s)).toBeUndefined();
  });

  it('records the minutes the person gives as their active time: entered, on its day, never placed in time', () => {
    const s = toSession(run(start(), log('lowerA.main', 10, 20, nine), finish(one, 45)));
    expect(s.durationSeconds).toBe(2700);
    // No interval is invented from the first set's time (Track's R01)...
    expect(sessionInterval(s)).toBeUndefined();
    // ...so a walk measured in the same hours still counts beside the 45 entered minutes,
    // and the total says the entered minutes are the person's and may include it.
    const walk = newObservation({
      kind: 'movementMinutes', value: 3, scope: 'sessionObserved', source: 'measured',
      at: nowAt(new Date(nine + 60_000)), coverageMs: 180_000, context: 'walk:w',
    });
    expect(recordedMovement({ from: s.date, to: s.date }, [walk], [s])).toMatchObject({ minutes: 48, enteredMinutes: 45, mayRepeat: true });
  });

  it('states no active time while the workout is going, and keeps what was given through a reload', () => {
    expect(toSession(run(start(), log('lowerA.main'))).durationSeconds).toBe(0);
    const saved = toSession(run(start(), log('lowerA.main'), finish(T0, 30)));
    const back2 = restoreWorkout({ ...saved, status: 'in_progress', completedAt: null }, planFor(), { defaultRest: 90 });
    expect(back2.activeMinutes).toBe(30);
    expect(toSession(back2).durationSeconds).toBe(1800);
  });
});

describe('logging a past day after the fact', () => {
  const past = () => startWorkout(planFor(MONDAY, back), { id: 'w1', defaultRest: 90, afterTheFact: true });

  it('records the sets without rests or made-up times', () => {
    let w = run(past(), log('lowerA.main', 9, 24, T0));
    expect(w).toMatchObject({ begun: true, startedAt: null, rest: null, afterTheFact: true });
    w = run(w, log('lowerA.main'), log('lowerA.main'), finish());
    expect(w).toMatchObject({ status: 'partial', completedAt: null });
  });

  it('asks no back-symptom question in hindsight', () => {
    const w = run(past(), log('lowerA.main'), log('lowerA.main'), log('lowerA.main'));
    expect(itemFor(w, 'lowerA.main')!.checkpoint).toBe(true);
    expect(pendingCheck(w)).toBeUndefined();
  });

  it('continues a stored record the same way', () => {
    const stored = toSession(run(past(), log('lowerA.main')));
    const again = restoreWorkout(stored, planFor(MONDAY, back), { defaultRest: 90, afterTheFact: true });
    expect(run(again, log('lowerA.main'))).toMatchObject({ startedAt: null, rest: null });
  });
});

describe('the stored record', () => {
  it('is a manual session with its volume, groups and plan', () => {
    const w = run(start(), log('lowerA.main', 10, 20), log('lowerA.main', 8, 20));
    const s = toSession(w);
    expect(s).toMatchObject({
      id: 'w1', date: MONDAY, dayOfWeek: 'monday', muscleGroup: 'lower', status: 'in_progress', focus: 'lowerA',
      planId: w.planId, totalVolume: 360, startedAt: new Date(T0).toISOString(), completedAt: null,
    });
    expect(s.guided).toBeUndefined();
    expect(s.sets).toHaveLength(progress(w).total);
    expect(s.supersetGroups).toEqual([
      { id: 'lowerA.p1', exerciseIds: ['split-squat', 'dead-bug'], restBetweenSeconds: 60, restAfterRoundSeconds: 60 },
      { id: 'lowerA.p2', exerciseIds: ['lying-leg-curl', 'seated-calf-raise'], restBetweenSeconds: 60, restAfterRoundSeconds: 60 },
    ]);
  });

  it("stores the weight lifted without a loaded carry's seconds", () => {
    // Wednesday is Lower B, which ends with a suitcase carry dosed in seconds.
    const w = run(start(planFor('2026-10-07')), log('lowerB.main', 10, 40), log('lowerB.carry', 30, 20));
    expect(toSession(w).totalVolume).toBe(400);
  });

  it('comes back as it was after a reload: sets, swap, groups and answers', () => {
    const plan = planFor(MONDAY, back);
    const boxSquat = { exerciseId: 'box-squat', target: { sets: 2, reps: 12, timed: false, perSide: false, rampSets: 0, caps: ['From the box.'] }, checkpoint: true };
    const w = run(startWorkout(plan, { id: 'w1', defaultRest: 90 }),
      { type: 'swap', key: 'lowerA.main', to: boxSquat }, log('lowerA.main', 12, 16), log('lowerA.main', 11, 16),
      { type: 'answer', exerciseId: 'box-squat', answer: 'better' }, log('lowerA.single'));

    const asked: string[] = [];
    const back2 = restoreWorkout(toSession(w), plan, {
      defaultRest: 90,
      alternativeFor: (slot, planned, id) => { asked.push(`${slot}:${planned}:${id}`); return id === 'box-squat' ? boxSquat : undefined; },
    });
    expect(asked).toEqual(['lowerA.main:goblet-squat:box-squat']);
    expect(back2.items.map(i => [i.key, i.exerciseId])).toEqual(w.items.map(i => [i.key, i.exerciseId]));
    expect(back2.items.map(i => i.sets)).toEqual(w.items.map(i => i.sets));
    expect(itemFor(back2, 'lowerA.main')).toMatchObject({ target: { caps: ['From the box.'] }, swappedFrom: { exerciseId: 'goblet-squat' } });
    expect(back2.groups).toEqual(w.groups);
    expect(back2).toMatchObject({ begun: true, revision: 0, startedAt: w.startedAt, symptomChecks: { 'box-squat': 'better' }, rest: null, logged: [] });
    // With no choice remembered, the next set in the plan's order is in front.
    expect(currentItem(back2)?.key).toBe('lowerA.trunk');
  });

  it('keeps every logged set when the plan has changed since', () => {
    const w = run(start(), log('lowerA.main', 9, 24), { type: 'skip', key: 'lowerA.secondary' });
    const elsewhere = planFor('2026-10-06');
    const back2 = restoreWorkout(toSession(w), elsewhere, { defaultRest: 90 });
    expect(back2.items.flatMap(i => i.sets)).toEqual(w.items.flatMap(i => i.sets));
    expect(back2.items[0]).toMatchObject({ exerciseId: 'goblet-squat', target: { sets: 3, reps: 9, caps: [] } });
    expect(back2.items[0].plannerSwap).toBeUndefined();
    expect(back2.focus).toBe('lowerA');
  });

  it('does not carry a stored group it could not rebuild into the rewritten record', () => {
    const stored: WorkoutSession = {
      ...toSession(run(start(), log('lowerA.main'))),
      supersetGroups: [{ id: 'old', exerciseIds: ['goblet-squat', 'not-in-this-workout'], restBetweenSeconds: 20, restAfterRoundSeconds: 40 }],
    };
    const back2 = restoreWorkout(stored, planFor('2026-10-06'), { defaultRest: 90 });
    expect(back2.groups).toEqual([]);
    expect(toSession(back2).supersetGroups).toBeUndefined();
  });

  it("keeps what an older version stored that this screen does not edit", () => {
    const legacy: WorkoutSession = {
      ...toSession(run(start(), log('lowerA.main'))),
      planId: undefined,
      warmup: [{ exerciseId: 'hip-opener-stretch', completed: true }],
      exerciseNotes: { 'goblet-squat': 'Heels down.' },
    };
    delete legacy.planId;
    const again = toSession(run(restoreWorkout(legacy, planFor(), { defaultRest: 90 }), log('lowerA.main')));
    expect(again).toMatchObject({ warmup: legacy.warmup, exerciseNotes: legacy.exerciseNotes });
    expect(again.planId).toBeUndefined();
    expect(again.sets.filter(s => s.status === 'completed')).toHaveLength(2);
  });
});
