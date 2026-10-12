import { describe, expect, it } from 'vitest';
import { newObservation, type Observation, type ObservationInput } from '@/health/observation';
import { StoreFailure, type StoreResult } from '@/store/db';
import { addGapTime, finishWalk, leaveWalk, pauseWalk, resumeWalk, returnToWalk, startWalk, updateOpenSegment, type Walk, type WalkPlan } from './clock';
import { hasRecord, saveObservations, saveOutcome, summarise, walkObservationIds, walkObservations, walkRecords } from './record';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const s = (seconds: number) => T + seconds * 1000;
const time = () => '7:10 pm';

/**
 * A walk after dinner: 10 minutes, then the app hidden for 5, then 8 more
 * minutes, with GPS and steps throughout.
 */
function afterDinner(plan: Partial<WalkPlan> = {}): Walk {
  let w = startWalk('mgh3k2x1-1a2b3c4d', {
    kind: 'afterMeal', meal: { which: 'dinner', startedAt: s(-1200) }, targetMinutes: 10, gps: true, steps: true, ...plan,
  }, s(0));
  w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(5), end: s(595), distanceM: 712 }], steps: 1110, motion: true }));
  w = leaveWalk(w, s(600), 'hidden');
  w = returnToWalk(w, s(900)).walk;
  w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(905), end: s(1375), distanceM: 588 }], steps: 905, motion: true }));
  return finishWalk(w, s(1380), 'finish');
}

const byKind = (inputs: ObservationInput[], kind: string) => inputs.filter(i => i.kind === kind);

describe('summary', () => {
  it('reports observed time, measured distance, pace and steps', () => {
    const summary = summarise(afterDinner());
    expect(summary.observedMs).toBe(1_080_000);
    expect(summary.awayMs).toBe(300_000);
    expect(summary.addedMs).toBe(0);
    expect(summary.distanceM).toBe(1300);
    expect(summary.steps).toBe(2015);
    expect(summary.from).toBe(s(0));
    expect(summary.to).toBe(s(1380));
    // Pace over the time GPS covered, not over time it did not.
    expect(summary.paceSecPerKm).toBeCloseTo(1060 / 1.3, 5);
    expect(summary.gpsCoverage).toBeCloseTo(1060 / 1080, 5);
  });

  it('leaves out what was not measured, rather than reporting zero', () => {
    const off = summarise(afterDinner({ gps: false, steps: false }));
    expect(off.distanceM).toBeUndefined();
    expect(off.paceSecPerKm).toBeUndefined();
    expect(off.gpsCoverage).toBeUndefined();
    expect(off.steps).toBeUndefined();

    // GPS on but never two usable fixes: no distance, and coverage says why.
    const noSignal = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: true, steps: true }, s(0)), s(600), 'finish');
    const summary = summarise(noSignal);
    expect(summary.distanceM).toBeUndefined();
    expect(summary.gpsCoverage).toBe(0);
    expect(summary.steps).toBeUndefined();
  });

  it('gives no average pace for a few metres', () => {
    let w = startWalk('abcd-1234', { kind: 'walk', gps: true, steps: false }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(0), end: s(50), distanceM: 40 }] }));
    const summary = summarise(finishWalk(w, s(60), 'finish'));
    expect(summary.distanceM).toBe(40);
    expect(summary.paceSecPerKm).toBeUndefined();
  });

  it('counts time the person added separately from what was observed', () => {
    const w = addGapTime(afterDinner(), 0);
    const summary = summarise(w);
    expect(summary.observedMs).toBe(1_080_000);
    expect(summary.addedMs).toBe(300_000);
    expect(summary.awayMs).toBe(0);
  });
});

describe('observations', () => {
  it('writes each observed segment over its own interval, never across the gap', () => {
    const inputs = walkObservations(afterDinner(), { time });
    const durations = byKind(inputs, 'walkDuration');
    expect(durations.map(d => [Date.parse(d.at!), d.coverageMs, d.value, d.source])).toEqual([
      [s(0), 600_000, 10, 'measured'],
      [s(900), 480_000, 8, 'measured'],
    ]);
    expect(byKind(inputs, 'movementMinutes').map(d => d.value)).toEqual([10, 8]);
    expect(byKind(inputs, 'walkDistance').map(d => d.value)).toEqual([0.712, 0.588]);
    expect(byKind(inputs, 'steps').map(d => d.value)).toEqual([1110, 905]);
    for (const i of inputs) {
      expect(i.scope).toBe('sessionObserved');
      expect(i.context).toBe('walk:mgh3k2x1-1a2b3c4d');
      expect(i.note).toBe('After dinner, which started at 7:10 pm.');
      // The meal as data, not only words: tagged, with the meal's own start.
      expect(i.tag).toBe('afterMeal');
      expect(Date.parse(i.mealStartedAt!)).toBe(s(-1200));
    }
  });

  it('tags nothing after a meal on an ordinary walk, and never a pain reading', () => {
    const plain = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, s(0)), s(300), 'finish');
    for (const i of walkObservations(plain)) {
      expect(i.tag).toBeUndefined();
      expect(i.mealStartedAt).toBeUndefined();
    }
    const pained: Walk = { ...afterDinner(), pain: { back: { value: 2, at: s(1400) } } };
    const back = walkObservations(pained, { time }).find(i => i.kind === 'backPain')!;
    expect(back.tag).toBeUndefined();
    expect(back.mealStartedAt).toBeUndefined();
  });

  it('builds records the observation model accepts', () => {
    const w = addGapTime(afterDinner(), 0);
    const pained: Walk = { ...w, pain: { back: { value: 3, at: s(1400) }, leg: { value: 2, at: s(1405) } } };
    for (const input of walkObservations(pained, { time })) expect(() => newObservation(input)).not.toThrow();
  });

  it('stores added time as manual, over the gap, and labels it', () => {
    const inputs = walkObservations(addGapTime(afterDinner(), 0), { time });
    const manual = inputs.filter(i => i.source === 'manual');
    expect(manual.map(m => [m.kind, Date.parse(m.at!), m.coverageMs, m.value])).toEqual([
      ['walkDuration', s(600), 300_000, 5],
      ['movementMinutes', s(600), 300_000, 5],
    ]);
    expect(manual[0].note).toMatch(/^Added by you/);
    expect(manual.every(m => m.tag === 'afterMeal')).toBe(true);
  });

  it('writes nothing for a gap the person did not add', () => {
    expect(walkObservations(afterDinner(), { time }).some(i => i.source === 'manual')).toBe(false);
  });

  it('writes back and leg pain as readings at the moment they were given', () => {
    const w: Walk = { ...afterDinner(), pain: { back: { value: 4, at: s(1500) } } };
    const pain = walkObservations(w, { time }).filter(i => i.kind === 'backPain' || i.kind === 'legPain');
    expect(pain).toHaveLength(1);
    expect(pain[0]).toMatchObject({ kind: 'backPain', value: 4, scope: 'pointInTime', source: 'manual', context: 'walk:mgh3k2x1-1a2b3c4d' });
    expect(Date.parse(pain[0].at!)).toBe(s(1500));
  });

  it('leaves out distance and steps that were not measured', () => {
    const inputs = walkObservations(afterDinner({ gps: false, steps: false }), { time });
    expect(inputs.map(i => i.kind)).toEqual(['walkDuration', 'movementMinutes', 'walkDuration', 'movementMinutes']);

    // Switched on, but one fix is not a distance and no motion is not a count.
    let w = startWalk('abcd-1234', { kind: 'walk', gps: true, steps: true }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(10), end: s(10), distanceM: 0 }], steps: 0, motion: false }));
    expect(walkObservations(finishWalk(w, s(300), 'finish')).map(i => i.kind)).toEqual(['walkDuration', 'movementMinutes']);
  });

  it('skips a segment too short to have observed anything', () => {
    let w = startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, s(0));
    w = pauseWalk(w, s(300));
    w = resumeWalk(w, s(400));
    w = finishWalk(w, s(400.4), 'finish');
    expect(byKind(walkObservations(w), 'walkDuration').map(d => d.value)).toEqual([5]);
    expect(hasRecord(finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, s(0)), s(0.5), 'finish'))).toBe(false);
  });

  it('says a walk ended with a low, and needs no note otherwise', () => {
    const plain = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, s(0)), s(300), 'finish');
    expect(walkObservations(plain)[0].note).toBeUndefined();
    const low = finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, s(0)), s(300), 'low');
    expect(walkObservations(low)[0].note).toBe('Ended because you felt low.');
  });

  it('keeps every id stable, so a retry recognises what it already wrote', () => {
    const a = walkObservations(afterDinner(), { time }).map(i => i.id);
    const b = walkObservations(afterDinner(), { time }).map(i => i.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('why a walk ended', () => {
  it('says so on its records when it ended for symptoms that need emergency help', () => {
    const w = finishWalk(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T), T + 300_000, 'emergency');
    for (const o of walkObservations(w, { time })) expect(o.note).toContain('Ended because of symptoms that need emergency help.');
  });
});

describe('saving (F09)', () => {
  /** A device that writes a batch all-or-nothing, as `addObservations` does. */
  function device(options: { failFirst?: boolean; arriveBefore?: string[]; arriveBeforeBatch?: ObservationInput[][] } = {}) {
    const stored = new Map<string, Observation>();
    const batches: string[][] = [];
    let failed = false;
    const addAll = async (inputs: readonly ObservationInput[]): Promise<StoreResult<Observation[]>> => {
      batches.push(inputs.map(i => i.id!));
      if (options.failFirst && !failed) {
        failed = true;
        return { ok: false, failure: new StoreFailure('quotaExceeded', 'There is not enough space on this device to save that.') };
      }
      // Records that reached the device since the caller looked (another copy of the app).
      for (const id of options.arriveBefore ?? []) {
        const input = inputs.find(i => i.id === id);
        if (input && !stored.has(id)) stored.set(id, newObservation(input));
      }
      // Another writer completing single records just before this batch, a different one each time.
      for (const input of options.arriveBeforeBatch?.[batches.length - 1] ?? []) {
        if (!stored.has(input.id!)) stored.set(input.id!, newObservation(input));
      }
      const clashing = inputs.map((input, index) => ({ input, index })).filter(({ input }) => stored.has(input.id!));
      if (clashing.length) {
        return {
          ok: false,
          failure: new StoreFailure('conflict', 'Nothing was saved.', undefined, clashing.map(({ input, index }) => ({ index, id: input.id, reason: 'already on this device' }))),
        };
      }
      const written = inputs.map(newObservation);
      for (const o of written) stored.set(o.id, o);
      return { ok: true, value: written };
    };
    return { stored, addAll, batches };
  }

  it('writes the whole walk in one batch', async () => {
    const d = device();
    const inputs = walkObservations(afterDinner(), { time });
    const result = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(result.ok).toBe(true);
    expect(d.batches).toEqual([inputs.map(i => i.id)]);
    expect(d.stored.size).toBe(inputs.length);
  });

  it('leaves nothing half-saved when the write fails, and writes all of it on retry', async () => {
    const d = device({ failFirst: true });
    const inputs = walkObservations(afterDinner(), { time });
    const first = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.failure.code).toBe('quotaExceeded');
    expect(d.stored.size).toBe(0);

    const second = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(second.ok).toBe(true);
    expect(d.stored.size).toBe(inputs.length);
  });

  it('writes only what is missing, so a walk already partly on the device is completed, not doubled', async () => {
    // A walk saved one record at a time by an older version, interrupted.
    const d = device();
    const inputs = walkObservations(afterDinner(), { time });
    for (const input of inputs.slice(0, 2)) d.stored.set(input.id!, newObservation(input));
    const result = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(result.ok).toBe(true);
    expect(d.batches).toEqual([inputs.slice(2).map(i => i.id)]);
    expect(d.stored.size).toBe(inputs.length);
  });

  it('treats records that arrived since it looked as saved, and writes the rest', async () => {
    const inputs = walkObservations(afterDinner(), { time });
    const d = device({ arriveBefore: [inputs[0].id!] });
    // The caller's own view is stale: only the store's answer says what arrived.
    const result = await saveObservations(inputs, () => new Set(), d.addAll);
    expect(result.ok).toBe(true);
    expect(d.batches).toHaveLength(2);
    expect(d.batches[1]).toEqual(inputs.slice(1).map(i => i.id));
    expect(d.stored.size).toBe(inputs.length);
  });

  it('keeps going through two conflicts in a row, and says saved only once every record is on the device (N02)', async () => {
    const inputs = walkObservations(afterDinner(), { time });
    // Before the first batch another writer stores one record; before the retry, another.
    const d = device({ arriveBeforeBatch: [[inputs[0]], [inputs[1]]] });
    const result = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(result.ok).toBe(true);
    expect(d.batches).toHaveLength(3);
    expect([...d.stored.keys()].sort()).toEqual(inputs.map(i => i.id).sort());
  });

  it('never says saved while a record is still missing: other writes that keep arriving end in a failure to retry (N02)', async () => {
    const inputs = walkObservations(afterDinner(), { time });
    expect(inputs.length).toBeGreaterThan(4);
    const d = device({ arriveBeforeBatch: inputs.map(i => [i]) });
    const result = await saveObservations(inputs, () => new Set(d.stored.keys()), d.addAll);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('conflict');
    const missing = inputs.filter(i => !d.stored.has(i.id!));
    expect(missing.length).toBeGreaterThan(0);
    // Asked again later, with nothing more arriving, it completes the walk.
    const again = await saveObservations(inputs, () => new Set(d.stored.keys()), async rest => {
      const written = rest.map(newObservation);
      for (const o of written) d.stored.set(o.id, o);
      return { ok: true, value: written };
    });
    expect(again.ok).toBe(true);
    expect(d.stored.size).toBe(inputs.length);
  });

  it('never calls a walk saved while the device is not saving: kept for now, and its draft stays (M-07)', () => {
    const notSaving = new StoreFailure('unavailable', 'The app is not storing data on this device yet. Nothing was saved.');
    const full = new StoreFailure('quotaExceeded', 'There is not enough space on this device to save that.');
    expect(saveOutcome({ ok: true, value: undefined }, true)).toEqual({ kind: 'kept' });
    expect(saveOutcome({ ok: false, failure: notSaving }, true)).toEqual({ kind: 'kept' });
    // A refusal for any other reason is still a failure to say.
    expect(saveOutcome({ ok: false, failure: full }, true)).toEqual({ kind: 'failed', message: full.message });
    expect(saveOutcome({ ok: true, value: undefined }, false)).toEqual({ kind: 'saved' });
    expect(saveOutcome({ ok: false, failure: full }, false)).toEqual({ kind: 'failed', message: full.message });
  });

  it('finds every record of a walk by its own context, for a discard to remove', () => {
    const inputs = walkObservations(afterDinner(), { time });
    const onDevice = [
      ...inputs.slice(0, 3).map(newObservation),
      newObservation({ kind: 'steps', value: 4000, scope: 'dayTotal', source: 'manual' }),
      newObservation({ ...inputs[0], id: 'other:s0:walkDuration', context: 'walk:other-walk' }),
    ];
    expect(walkObservationIds('mgh3k2x1-1a2b3c4d', onDevice)).toEqual(inputs.slice(0, 3).map(i => i.id));
  });
});

describe('F16: one pace, whichever screen shows it', () => {
  /** Five minutes walked, GPS measuring 500 m over four of them. */
  function fiveMinutes(): Walk {
    let w = startWalk('abcd-1600', { kind: 'walk', gps: true, steps: false }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(30), end: s(270), distanceM: 500 }] }));
    return finishWalk(w, s(300), 'finish');
  }

  it('gives the same pace on the summary and from the saved records', () => {
    const w = fiveMinutes();
    const summary = summarise(w);
    // 500 m in the four minutes GPS measured: 8 min/km, not 10.
    expect(summary.paceSecPerKm).toBeCloseTo(480, 6);
    const [saved] = walkRecords(walkObservations(w).map(newObservation));
    expect(saved.paceSecPerKm).toBeCloseTo(480, 6);
  });

  it('saves each stretch of GPS as its own distance, over the time GPS was measuring', () => {
    let w = startWalk('abcd-1601', { kind: 'walk', gps: true, steps: false }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(0), end: s(60), distanceM: 80 }, { start: s(120), end: s(240), distanceM: 160 }] }));
    w = finishWalk(w, s(300), 'finish');
    const distances = walkObservations(w).filter(i => i.kind === 'walkDistance');
    expect(distances.map(d => [Date.parse(d.at!), d.coverageMs, d.value])).toEqual([[s(0), 60_000, 0.08], [s(120), 120_000, 0.16]]);
    expect(summarise(w).paceSecPerKm).toBeCloseTo(180 / 0.24, 6);
  });

  it('leaves pace out when the saved distance cannot say how long GPS measured it', () => {
    // A distance stated without its interval, as an import or another app might.
    const w = fiveMinutes();
    const saved = walkObservations(w).map(newObservation).map(o =>
      o.kind === 'walkDistance' ? { ...o, coverageMs: undefined } : o);
    const [record] = walkRecords(saved as Observation[]);
    expect(record.paceSecPerKm).toBeUndefined();
  });

  it('leaves pace out when only part of the distance has its basis, rather than over-stating speed', () => {
    let w = startWalk('abcd-1603', { kind: 'walk', gps: true, steps: false }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(0), end: s(120), distanceM: 200 }, { start: s(130), end: s(290), distanceM: 300 }] }));
    w = finishWalk(w, s(300), 'finish');
    const saved = walkObservations(w).map(newObservation);
    const distances = saved.filter(o => o.kind === 'walkDistance');
    // The second stretch loses its interval: 500 m over two minutes would read as a sprint.
    const partial = saved.map(o => (o.id === distances[1].id ? { ...o, coverageMs: undefined } : o));
    expect(walkRecords(partial as Observation[])[0].paceSecPerKm).toBeUndefined();
    // A distance someone typed in has an interval but no GPS behind it.
    const typed = saved.map(o => (o.id === distances[1].id ? { ...o, source: 'manual' as const } : o));
    expect(walkRecords(typed)[0].paceSecPerKm).toBeUndefined();
    // Untouched, the pace is the summary's.
    expect(walkRecords(saved)[0].paceSecPerKm).toBeCloseTo(summarise(w).paceSecPerKm!, 6);
  });

  it('gives no pace from a few metres or a few seconds of signal', () => {
    let w = startWalk('abcd-1602', { kind: 'walk', gps: true, steps: false }, s(0));
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: s(0), end: s(30), distanceM: 60 }] }));
    w = finishWalk(w, s(300), 'finish');
    expect(summarise(w).paceSecPerKm).toBeUndefined();
    expect(walkRecords(walkObservations(w).map(newObservation))[0].paceSecPerKm).toBeUndefined();
  });
});

describe('F17: a walk across midnight', () => {
  /** Sunday 11 October 23:59 to Monday 00:02, local time, wherever the test runs. */
  const sunday2359 = new Date(2026, 9, 11, 23, 59).getTime();
  const monday0002 = new Date(2026, 9, 12, 0, 2).getTime();
  const dayOf = (at: string) => at.slice(0, 10);

  function overMidnight(): Walk {
    let w = startWalk('abcd-1700', { kind: 'walk', gps: true, steps: true }, sunday2359);
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: sunday2359, end: monday0002, distanceM: 240 }], steps: 330, motion: true }));
    return finishWalk(w, monday0002, 'finish');
  }

  it('counts the minute before midnight on Sunday and the two after on Monday', () => {
    const inputs = walkObservations(overMidnight());
    for (const kind of ['walkDuration', 'movementMinutes'] as const) {
      const byDay = inputs.filter(i => i.kind === kind).map(i => [dayOf(i.at!), i.value, i.coverageMs]);
      expect(byDay).toEqual([['2026-10-11', 1, 60_000], ['2026-10-12', 2, 120_000]]);
    }
  });

  it('does not guess how distance and steps divide between the days', () => {
    const inputs = walkObservations(overMidnight());
    for (const kind of ['walkDistance', 'steps'] as const) {
      const [one, ...more] = inputs.filter(i => i.kind === kind);
      expect(more).toEqual([]);
      // Kept whole, with its real interval, and said to be undivided.
      expect(one.value).toBe(kind === 'steps' ? 330 : 0.24);
      expect(one.note).toMatch(/across midnight/i);
    }
  });

  it('splits time the person added for a gap across midnight too', () => {
    let w = startWalk('abcd-1701', { kind: 'walk', gps: false, steps: false }, new Date(2026, 9, 11, 23, 50).getTime());
    w = leaveWalk(w, new Date(2026, 9, 11, 23, 58).getTime(), 'hidden');
    w = returnToWalk(w, new Date(2026, 9, 12, 0, 4).getTime()).walk;
    w = addGapTime(finishWalk(w, new Date(2026, 9, 12, 0, 10).getTime(), 'finish'), 0);
    const added = walkObservations(w).filter(i => i.source === 'manual' && i.kind === 'walkDuration');
    expect(added.map(i => [dayOf(i.at!), i.value])).toEqual([['2026-10-11', 2], ['2026-10-12', 4]]);
  });

  it('keeps the walk one walk, on the day it started', () => {
    const [record, ...rest] = walkRecords(walkObservations(overMidnight()).map(newObservation));
    expect(rest).toEqual([]);
    expect(record.day).toBe('2026-10-11');
    expect(record.minutes).toBe(3);
  });
});

describe('walkRecords', () => {
  it('puts a saved walk back together as one walk', () => {
    const w: Walk = { ...addGapTime(afterDinner(), 0), pain: { back: { value: 3, at: s(1500) } } };
    const stored = walkObservations(w, { time }).map(newObservation);
    const other = newObservation({ kind: 'steps', value: 4000, scope: 'dayTotal', source: 'manual', at: stored[0].at });
    const [record, ...rest] = walkRecords([other, ...stored]);
    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      id: 'mgh3k2x1-1a2b3c4d',
      minutes: 18,
      addedMinutes: 5,
      distanceKm: 1.3,
      steps: 2015,
      backPain: 3,
      note: 'After dinner, which started at 7:10 pm.',
    });
    expect(Date.parse(record.at)).toBe(s(0));
    expect(Date.parse(record.mealStartedAt!)).toBe(s(-1200));
    expect(record.legPain).toBeUndefined();
    expect(record.observations).toHaveLength(stored.length);
  });

  it('keeps walks apart and in order', () => {
    const later = finishWalk(startWalk('zzzz-0002', { kind: 'walk', gps: false, steps: false }, s(5000)), s(5600), 'finish');
    const earlier = finishWalk(startWalk('aaaa-0001', { kind: 'walk', gps: false, steps: false }, s(100)), s(400), 'finish');
    const records = walkRecords([...walkObservations(later), ...walkObservations(earlier)].map(newObservation));
    expect(records.map(r => [r.id, r.minutes, r.distanceKm])).toEqual([['aaaa-0001', 5, undefined], ['zzzz-0002', 10, undefined]]);
  });
});
