import { describe, it, expect } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { StoreResult } from '@/store/db';
import { StoreFailure } from '@/store/db';
import { buildSessionPlan } from '@/engine/session';
import { evaluateCheckIn } from '@/engine/readiness';
import { createDefaultProfile } from '@/profile/defaults';
import { startWorkout, toSession, workoutReducer, type WorkoutAction, type WorkoutState } from './model';
import { finalise } from './finalise';
import { setGate } from './gate';

const plan = buildSessionPlan({ profile: createDefaultProfile({ weightKg: 80 }), date: '2026-10-05', startDate: '2026-09-28', sessions: [] });
const T0 = Date.parse('2026-10-05T18:00:00.000Z');
const log = (now: number): WorkoutAction => ({ type: 'log', key: 'lowerA.main', reps: 9, weightKg: 20, now });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * The screen as the review's probe had it: a workout that autosaves its whole
 * record after every change while in progress, over a store that commits
 * writes in the order they were asked for — here with the finish held back.
 */
function harness() {
  const committed: WorkoutSession[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let current: WorkoutState = startWorkout(plan, { id: 'w1', defaultRest: 90 });
  let lastWrite: Promise<unknown> = Promise.resolve();

  const write = (session: WorkoutSession, wait?: Promise<void>, result: StoreResult = { ok: true, value: undefined }) => {
    const done = queue.then(() => wait).then(() => { if (result.ok) committed.push(session); return result; });
    queue = done;
    return done;
  };
  const dispatch = (action: WorkoutAction) => {
    const next = workoutReducer(current, action);
    if (next === current) return;
    const changed = next.revision !== current.revision;
    current = next;
    if (changed && next.begun && next.status === 'in_progress') lastWrite = write(toSession(next));
  };
  return {
    committed, dispatch, release, held, write,
    get state() { return current; },
    get pending() { return lastWrite; },
  };
}

describe('finishing a workout', () => {
  it('is the last word on the record, even when a set is logged while it is still being saved', async () => {
    const h = harness();
    h.dispatch(log(T0));
    const saving = finalise(h.state, { type: 'finish', now: T0 + 60_000, notes: 'Steady.', activeMinutes: 40 }, {
      pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s, h.held),
    });
    await tick();
    // The review's trigger: keep going and log another set before the finish has landed.
    h.dispatch(log(T0 + 90_000));
    h.release();
    const result = await saving;
    expect(result.ok).toBe(true);
    const last = h.committed[h.committed.length - 1];
    expect(last).toMatchObject({ status: 'partial', notes: 'Steady.', completedAt: new Date(T0 + 60_000).toISOString(), durationSeconds: 2400 });
    expect(h.committed).toHaveLength(2);
    expect(last.sets.filter(s => s.status === 'completed')).toHaveLength(1);
  });

  it('reopens the workout as it was when the save fails, with no false success', async () => {
    const h = harness();
    h.dispatch(log(T0));
    const failure = new StoreFailure('quotaExceeded', 'There is not enough space on this device to save that.');
    const result = await finalise(h.state, { type: 'finish', now: T0, notes: 'Note kept.', activeMinutes: null }, {
      pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s, undefined, { ok: false, failure }),
    });
    expect(result).toEqual({ ok: false, failure });
    expect(h.state).toMatchObject({ status: 'in_progress', completedAt: null, notes: 'Note kept.' });
    h.dispatch(log(T0 + 60_000));
    expect(h.state.items[0].sets.filter(s => s.status === 'completed')).toHaveLength(2);
  });

  it('saves nothing, and changes nothing, when nothing has been logged', async () => {
    const h = harness();
    const before = h.state;
    const result = await finalise(before, { type: 'finish', now: T0, notes: '', activeMinutes: null }, {
      pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s),
    });
    expect(result.ok).toBe(false);
    expect(h.state).toBe(before);
    expect(h.committed).toEqual([]);
  });
});

describe('a finish that fails, then Keep going (review R04)', () => {
  // An insulin user, gated as the screen gates the next set: what it shows,
  // and what it asks again at the tap.
  const at = (h: number, m: number) => new Date(2026, 9, 5, h, m, 0);
  const insulin = createDefaultProfile({
    weightKg: 80,
    health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', diabetes: 'type2', insulin: 'injections_or_pump' },
  });
  const measured = (h: number, m: number) => {
    const c: DailyCheckIn = {
      date: '2026-10-05', urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
      glucose: { value: 140, unit: 'mg/dL', measuredAt: at(h, m).toISOString() },
    };
    const record: CheckInRecord = { ...c, readiness: evaluateCheckIn(insulin, c) };
    return { profile: insulin, checkIns: [record] };
  };
  const failure = new StoreFailure('quotaExceeded', 'There is not enough space on this device to save that.');
  const finish = (h: number, m: number): Extract<WorkoutAction, { type: 'finish' }> =>
    ({ type: 'finish', now: at(h, m).getTime(), notes: 'Note kept.', activeMinutes: null });

  it('ends the sitting: the next set asks the restart question, and nothing logged is lost', async () => {
    const h = harness();
    h.dispatch(log(at(9, 0).getTime()));
    const result = await finalise(h.state, finish(9, 1), {
      pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s, undefined, { ok: false, failure }),
    });
    expect(result.ok).toBe(false);
    // 09:31, stopped since 09:01: a new start, so the 09:00 reading is too old.
    expect(setGate(h.state, measured(9, 0), at(9, 31)))
      .toMatchObject({ kind: 'checkIn', permission: { release: 'Check your glucose now and add the reading.' } });
    expect(h.state).toMatchObject({ status: 'in_progress', completedAt: null, notes: 'Note kept.' });
    expect(h.state.items[0].sets.filter(s => s.status === 'completed')).toHaveLength(1);
    // A fresh reading clears the next set.
    expect(setGate(h.state, measured(9, 30), at(9, 31)).kind).toBe('log');
  });

  it('still saves without asking: saving is not exercise', async () => {
    const h = harness();
    h.dispatch(log(at(9, 0).getTime()));
    await finalise(h.state, finish(9, 1), { pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s, undefined, { ok: false, failure }) });
    expect(setGate(h.state, measured(9, 0), at(9, 31)).kind).toBe('checkIn');
    const again = await finalise(h.state, finish(9, 31), { pending: h.pending, dispatch: h.dispatch, commit: s => h.write(s) });
    expect(again.ok).toBe(true);
    expect(h.committed.at(-1)).toMatchObject({ status: 'partial', notes: 'Note kept.' });
  });

  it('leaves logging that never stopped on the live question', () => {
    const h = harness();
    // Sets keep coming, so the 09:00 reading turning 31 minutes old stops nothing.
    for (const m of [0, 12, 24, 29]) h.dispatch(log(at(9, m).getTime()));
    expect(setGate(h.state, measured(9, 0), at(9, 31)).kind).toBe('log');
  });

  it('takes a set after a silence longer than 30 minutes as a restart (M-04)', () => {
    const h = harness();
    h.dispatch(log(at(9, 0).getTime()));
    expect(setGate(h.state, measured(9, 0), at(9, 31)).kind).toBe('checkIn');
  });
});
