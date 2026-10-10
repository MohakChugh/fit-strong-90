import { describe, expect, it } from 'vitest';
import {
  addGapTime,
  finishWalk,
  heartbeat,
  leaveWalk,
  observedMs,
  openSegment,
  pauseWalk,
  REMOUNT_GRACE_MS,
  restoreWalk,
  resumeWalk,
  returnToWalk,
  STALE_AFTER_MS,
  startWalk,
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
