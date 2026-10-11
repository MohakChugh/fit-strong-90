import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { toDateString } from '@/lib/utils';
import {
  accrueOpen,
  addGapTime,
  CLOCK_JUMP_MS,
  daysAround,
  finishWalk,
  heartbeat,
  lastSeen,
  leaveWalk,
  leftOpen,
  nextMidnight,
  observedMs,
  openSegment,
  pauseWalk,
  REMOUNT_GRACE_MS,
  restoreWalk,
  resumeWalk,
  returnToWalk,
  splitAtClockChange,
  splitAtMidnight,
  splitAtOffsetChange,
  STALE_AFTER_MS,
  startWalk,
  stepOf,
  updateOpenSegment,
  type Walk,
  type WalkPlan,
} from './clock';

const PLAN: WalkPlan = { kind: 'walk', gps: true, steps: true };
const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const s = (seconds: number) => T + seconds * 1000;

function walkFor(): Walk {
  return startWalk('abc-123', PLAN, s(0));
}

describe('observed time', () => {
  it('runs from the moment the walk starts, from timestamps', () => {
    const w = walkFor();
    expect(observedMs(w, s(0))).toBe(0);
    expect(observedMs(w, s(90))).toBe(90_000);
    // A ticking counter would drift; a timestamp does not.
    expect(observedMs(w, s(3600))).toBe(3_600_000);
  });

  it('stops while paused and carries on from where it was', () => {
    let w = walkFor();
    w = pauseWalk(w, s(60));
    expect(w.status).toBe('paused');
    expect(observedMs(w, s(600))).toBe(60_000);
    w = resumeWalk(w, s(600));
    expect(w.status).toBe('running');
    expect(observedMs(w, s(630))).toBe(90_000);
    expect(w.segments.map(x => [x.start, x.end, x.endedBy])).toEqual([
      [s(0), s(60), 'paused'],
      [s(600), undefined, undefined],
    ]);
    // A pause is the person's choice, not a gap the app missed.
    expect(w.gaps).toEqual([]);
  });

  it('closes the segment and stamps a gap when the app is hidden, and opens a new one on return', () => {
    let w = walkFor();
    w = leaveWalk(w, s(120), 'hidden');
    expect(w.status).toBe('away');
    expect(openSegment(w)).toBeUndefined();
    expect(observedMs(w, s(400))).toBe(120_000);

    const back = returnToWalk(w, s(400));
    w = back.walk;
    expect(back.gap).toEqual({ start: s(120), end: s(400), cause: 'hidden', added: false });
    expect(w.status).toBe('running');
    expect(w.gaps).toEqual([back.gap]);
    expect(w.segments).toHaveLength(2);
    expect(w.segments[1].start).toBe(s(400));
    // The gap is not walking time.
    expect(observedMs(w, s(460))).toBe(180_000);
  });

  it('stamps a gap even for a short hide: nothing observed it', () => {
    const back = returnToWalk(leaveWalk(walkFor(), s(30), 'hidden'), s(31));
    expect(back.gap?.end).toBe(s(31));
    expect(observedMs(back.walk, s(31))).toBe(30_000);
  });

  it('carries the same segment on through an immediate remount of the screen', () => {
    // React's development double-mount closes and reopens the screen at once.
    const left = leaveWalk(walkFor(), s(30), 'left');
    const back = returnToWalk(left, s(30) + REMOUNT_GRACE_MS);
    expect(back.gap).toBeUndefined();
    expect(back.walk.segments).toHaveLength(1);
    expect(openSegment(back.walk)?.start).toBe(s(0));

    const later = returnToWalk(left, s(30) + REMOUNT_GRACE_MS + 1);
    expect(later.gap?.cause).toBe('left');
    expect(later.walk.segments).toHaveLength(2);
  });

  it('does nothing to a paused walk when the app is hidden', () => {
    const paused = pauseWalk(walkFor(), s(60));
    expect(leaveWalk(paused, s(70), 'hidden')).toBe(paused);
    expect(returnToWalk(paused, s(90)).walk).toBe(paused);
  });

  it('never goes negative when the clock steps backwards', () => {
    const w = pauseWalk(walkFor(), s(-30));
    expect(w.segments[0].end).toBe(s(0));
    expect(observedMs(w, s(100))).toBe(0);
  });
});

describe('finishing', () => {
  it('closes the open segment', () => {
    const w = finishWalk(walkFor(), s(600), 'finish');
    expect(w.status).toBe('finished');
    expect(w.finishedAt).toBe(s(600));
    expect(w.endedBy).toBe('finish');
    expect(w.segments[0]).toMatchObject({ end: s(600), endedBy: 'finished' });
    expect(observedMs(w, s(9_999))).toBe(600_000);
  });

  it('finishes a paused walk without counting the pause', () => {
    const w = finishWalk(pauseWalk(walkFor(), s(300)), s(900), 'stop');
    expect(observedMs(w, s(900))).toBe(300_000);
    expect(w.endedBy).toBe('stop');
  });

  it('is final', () => {
    const w = finishWalk(walkFor(), s(60), 'low');
    expect(finishWalk(w, s(90), 'finish')).toBe(w);
    expect(pauseWalk(w, s(90))).toBe(w);
    expect(resumeWalk(w, s(90))).toBe(w);
    expect(leaveWalk(w, s(90), 'hidden')).toBe(w);
    expect(heartbeat(w, s(90))).toBe(w);
  });
});

describe('a walk left too long', () => {
  it('is finished, not resumed, when the person comes back hours later', () => {
    const away = leaveWalk(walkFor(), s(1200), 'hidden');
    const back = returnToWalk(away, s(1200) + STALE_AFTER_MS + 1);
    expect(back.walk.status).toBe('finished');
    expect(back.walk.endedBy).toBe('stale');
    // Finished when it was last observed, with only what was recorded.
    expect(back.walk.finishedAt).toBe(s(1200));
    expect(observedMs(back.walk, s(99_999))).toBe(1_200_000);
    expect(back.gap).toBeUndefined();

    const justInTime = returnToWalk(away, s(1200) + STALE_AFTER_MS);
    expect(justInTime.walk.status).toBe('running');
  });
});

describe('when a walk is left open, as the Walk hub reads it (board D184)', () => {
  /** What coming back at `now` does to `walk`, as the live screen does it: restored, then returned to. */
  const comesBack = (walk: Walk, now: number) => returnToWalk(restoreWalk(walk, now), now).walk;

  it('says so exactly when coming back would finish it as left open, for a walk away, paused or still marked recording', () => {
    const away = leaveWalk(walkFor(), s(1200), 'left');
    const paused = pauseWalk(walkFor(), s(600));
    const recording = heartbeat(walkFor(), s(900));
    // Read back after the clock went back: away from the earlier moment, its last heartbeat later.
    const setBack = restoreWalk(recording, s(800));
    const cases = [['away', away, s(1200)], ['paused', paused, s(600)], ['recording', recording, s(900)], ['restored after the clock went back', setBack, s(800)]] as const;
    for (const [name, walk, since] of cases) {
      expect(lastSeen(walk), name).toBe(since);
      for (const now of [since + STALE_AFTER_MS, since + STALE_AFTER_MS + 1]) {
        expect(leftOpen(lastSeen(walk), now), `${name} at +${now - since}`).toBe(comesBack(walk, now).status === 'finished');
      }
      expect(leftOpen(lastSeen(walk), since + STALE_AFTER_MS), name).toBe(false);
      expect(leftOpen(lastSeen(walk), since + STALE_AFTER_MS + 1), name).toBe(true);
    }
  });
});

describe('after a reload', () => {
  it('ends a running segment at the last moment the screen was seen', () => {
    let w = walkFor();
    w = heartbeat(w, s(300));
    w = heartbeat(w, s(301));
    const restored = restoreWalk(w, s(500));
    expect(restored.status).toBe('away');
    expect(restored.segments[0]).toMatchObject({ end: s(301), endedBy: 'interrupted' });
    expect(restored.awaySince).toBe(s(301));

    const back = returnToWalk(restored, s(500));
    expect(back.gap).toEqual({ start: s(301), end: s(500), cause: 'interrupted', added: false });
    expect(observedMs(back.walk, s(560))).toBe(361_000);
  });

  it('finishes a walk paused and forgotten for hours', () => {
    const paused = pauseWalk(walkFor(), s(600));
    const restored = restoreWalk(paused, s(600) + STALE_AFTER_MS + 1);
    expect(restored.status).toBe('finished');
    expect(restored.endedBy).toBe('stale');
    expect(restored.finishedAt).toBe(s(600));
    expect(restoreWalk(paused, s(700))).toBe(paused);
  });

  it('leaves an away or finished walk as it was', () => {
    const away = leaveWalk(walkFor(), s(60), 'hidden');
    expect(restoreWalk(away, s(90))).toBe(away);
    const done = finishWalk(walkFor(), s(60), 'finish');
    expect(restoreWalk(done, s(90))).toBe(done);
  });
});

describe('time the person adds', () => {
  it('marks a gap as walking, without making it observed', () => {
    const back = returnToWalk(leaveWalk(walkFor(), s(60), 'hidden'), s(360));
    const w = addGapTime(back.walk, 0);
    expect(w.gaps[0].added).toBe(true);
    expect(observedMs(w, s(360))).toBe(60_000);
    expect(addGapTime(w, 5)).toBe(w);
  });
});

describe('the open segment', () => {
  it('takes updates only while one is open', () => {
    const w = updateOpenSegment(walkFor(), x => ({ ...x, steps: x.steps + 12 }));
    expect(w.segments[0].steps).toBe(12);
    const paused = pauseWalk(w, s(10));
    expect(updateOpenSegment(paused, x => ({ ...x, steps: 99 }))).toBe(paused);
  });
});

describe('time under a changed clock (B-19)', () => {
  it('counts the monotonic step, never the device clock’s, while the two agree (H6-09)', () => {
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(1), mono: 1000 })).toEqual({ ms: 1000, jumped: false });
    // The device clock moved on a minute in a second: too little to be a change to the clock, and no walking either.
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(60), mono: 1000 })).toEqual({ ms: 1000, jumped: false });
    // Or it stood still, or went back a little: the time walked still counts.
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(0), mono: 900 })).toEqual({ ms: 900, jumped: false });
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(-90), mono: 1000 })).toEqual({ ms: 1000, jumped: false });
  });

  it('takes the monotonic step, and says the clock changed, when they disagree by more than two minutes', () => {
    expect(CLOCK_JUMP_MS).toBe(120_000);
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(-3600), mono: 1000 })).toEqual({ ms: 1000, jumped: true });
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(3600), mono: 1000 })).toEqual({ ms: 1000, jumped: true });
    // Exactly two minutes apart still agree.
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(121), mono: 1000 })).toEqual({ ms: 1000, jumped: false });
    // A monotonic clock never runs back; if one seems to, nothing is counted.
    expect(stepOf({ wall: s(0), mono: 5000 }, { wall: s(1), mono: 4000 })).toEqual({ ms: 0, jumped: false });
  });

  it('leaves which readings each change left untimed to the device, which keeps every change (H6-02, H6R-02, board D174)', () => {
    let w = splitAtClockChange(accrueOpen(walkFor(), 60_000, s(60)), s(3600), 1000);
    // A reading taken between two changes was timed by a clock that moved again: the device's generation says so (gate.test).
    w = splitAtClockChange(accrueOpen(w, 60_000, s(3660)), s(7200), 1000);
    expect(w.untimedReadings).toBeUndefined();
    expect(w.clockChangedAt).toBe(s(7200));
  });

  it('looks for those readings on the days either side of both clocks', () => {
    const noon = new Date(2026, 9, 8, 12).getTime();
    expect(daysAround(noon)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(daysAround(noon, noon - 3 * 86_400_000)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  });

  it('keeps the latest change, so only a reading taken since it is timed', () => {
    let w = splitAtClockChange(accrueOpen(walkFor(), 60_000, s(60)), s(3600), 1000);
    w = splitAtClockChange(accrueOpen(w, 60_000, s(3660)), s(7200), 1000);
    expect(w.clockChangedAt).toBe(s(7200));
    expect(w.segments.map(x => x.endedBy)).toEqual(['clockChange', 'clockChange', undefined]);
  });

  it('closes the segment at a change of clock and opens the next at the new time, with no gap and nothing lost', () => {
    let w = accrueOpen(walkFor(), 600_000, s(600));
    w = splitAtClockChange(w, s(600) - 3_600_000, 1000);
    expect(w.segments.map(x => [x.endedBy, x.accruedMs])).toEqual([['clockChange', 601_000], [undefined, 0]]);
    expect(w.segments[1].start).toBe(s(600) - 3_600_000);
    expect(w.gaps).toEqual([]);
    expect(w.clockChangedAt).toBe(s(600) - 3_600_000);
    expect(observedMs(w, s(600) - 3_600_000 + 5000)).toBe(606_000);
  });

  it('accrues tick by tick, so a close adds only what came after the last tick', () => {
    let w = accrueOpen(walkFor(), 10_000, s(10));
    w = pauseWalk(w, s(12));
    expect(w.segments[0].accruedMs).toBe(12_000);
  });

  it('stamps each segment with the local day and offset it began in', () => {
    const w = walkFor();
    expect(w.segments[0].day).toBe(toDateString(new Date(s(0))));
    expect(w.segments[0].offsetMin).toBe(-new Date(s(0)).getTimezoneOffset());
  });

  it('moves time accrued past midnight into the new day’s segment', () => {
    const mid = nextMidnight(T);
    let w = startWalk('abc-123', PLAN, mid - 60_000);
    w = accrueOpen(w, 90_000, mid + 30_000);
    w = splitAtMidnight(w, mid + 30_000);
    expect(w.segments.map(x => x.accruedMs)).toEqual([60_000, 30_000]);
    expect(w.segments[1].day).not.toBe(w.segments[0].day);
  });
});

describe('a change of time zone mid-walk (H6-10)', () => {
  // The phone's zone, as `getTimezoneOffset` reports it: minutes west of UTC.
  let zone: MockInstance<() => number>;
  beforeEach(() => { zone = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330); });
  afterEach(() => zone.mockRestore());
  // 11:50 pm on the 8th in India (+05:30).
  const START = Date.UTC(2026, 9, 8, 18, 20);

  it('closes the segment in the offset it was recorded in, and opens the next in the new one, with that zone’s day', () => {
    let w = startWalk('abc-123', PLAN, START);
    expect([w.segments[0].day, w.segments[0].offsetMin]).toEqual(['2026-10-08', 330]);
    w = accrueOpen(w, 300_000, START + 300_000);
    expect(splitAtOffsetChange(w, START + 300_000)).toBe(w);
    // Five minutes on, the phone is an hour east (+06:30): five to one in the morning, on the 9th.
    zone.mockReturnValue(-390);
    w = splitAtOffsetChange(w, START + 300_000);
    expect(w.segments.map(x => [x.endedBy, x.day, x.offsetMin, x.accruedMs])).toEqual([
      ['timeZone', '2026-10-08', 330, 300_000],
      [undefined, '2026-10-09', 390, 0],
    ]);
    expect([w.segments[0].end, w.segments[1].start, w.segments[1].accruedAt]).toEqual([START + 300_000, START + 300_000, START + 300_000]);
    // Nothing went unwatched, and the clock itself never jumped.
    expect(w.gaps).toEqual([]);
    expect(w.clockChangedAt).toBeUndefined();
  });

  it('splits only a walk that is recording', () => {
    const paused = pauseWalk(accrueOpen(startWalk('abc-123', PLAN, START), 60_000, START + 60_000), START + 60_000);
    zone.mockReturnValue(-240);
    expect(splitAtOffsetChange(paused, START + 120_000)).toBe(paused);
  });

  it('never closes a segment before it began, when the clock was set back a little as well', () => {
    const w = startWalk('abc-123', PLAN, START);
    zone.mockReturnValue(-390);
    const split = splitAtOffsetChange(w, START - 30_000);
    expect(split.segments[0]).toMatchObject({ start: START, end: START, endedBy: 'timeZone' });
  });

  it('dates a segment by its own offset, so its day and its records agree', () => {
    zone.mockReturnValue(-390);
    expect(startWalk('abc-123', PLAN, START).segments[0]).toMatchObject({ day: '2026-10-09', offsetMin: 390 });
  });

  it('finds midnight in the offset the segment was recorded in, and starts the new offset only at the change (H6R-12)', () => {
    // 9:30 pm in Paris in winter (UTC+1); at 10:30 pm the phone is set to UTC+3, where it is already half past midnight.
    zone.mockReturnValue(-60);
    const start = Date.UTC(2026, 10, 1, 20, 30);
    let w = accrueOpen(startWalk('abc-123', PLAN, start), 3_600_000, start + 3_600_000);
    zone.mockReturnValue(-180);
    // As the live walk does: midnight first, then the offset.
    w = splitAtOffsetChange(splitAtMidnight(w, start + 3_600_000), start + 3_600_000);
    expect(w.segments.map(x => [x.endedBy, x.day, x.offsetMin, x.accruedMs])).toEqual([
      ['timeZone', '2026-11-01', 60, 3_600_000],
      [undefined, '2026-11-02', 180, 0],
    ]);
    // A walk through its own midnight before a change is seen, here to New York, keeps its offset and its day across midnight.
    zone.mockReturnValue(-60);
    let night = accrueOpen(startWalk('abc-124', PLAN, Date.UTC(2026, 10, 1, 22, 50)), 1_200_000, Date.UTC(2026, 10, 1, 23, 10));
    zone.mockReturnValue(300);
    night = splitAtMidnight(night, Date.UTC(2026, 10, 1, 23, 10));
    expect(night.segments.map(x => [x.endedBy, x.day, x.offsetMin, x.accruedMs])).toEqual([
      ['midnight', '2026-11-01', 60, 600_000],
      [undefined, '2026-11-02', 60, 600_000],
    ]);
  });

});
