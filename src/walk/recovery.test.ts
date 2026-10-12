import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import { accrueOpen, leaveWalk, pauseWalk, startWalk } from './clock';
import { JOURNAL_STALE_MS, journalEntry } from './journal';
import { loadWalk, storeWalk, type WalkStorage } from './persist';
import { walkObservations } from './record';
import { endOpenWalk, interruptedWalk, recoveryPlan, recoveryText } from './recovery';

const MIN = 60_000;
const START = new Date(2026, 9, 8, 8, 0).getTime();

/** A walk journalled after `minutes` of recording, then nothing: the app went away. */
function lost(id: string, minutes: number, start = START) {
  const walk = accrueOpen(startWalk(id, { kind: 'walk', gps: false, steps: false }, start), minutes * MIN, start + minutes * MIN);
  return journalEntry(walk, start + minutes * MIN);
}

describe('a walk the app lost mid-way (journey §9.4, V-J34)', () => {
  it('ends at its last checkpoint, not when the app opened again (B-19)', () => {
    const e = lost('walk-aaaa', 18);
    const w = interruptedWalk(e.walk);
    expect(w).toMatchObject({ status: 'finished', endedBy: 'interrupted' });
    expect(w.segments[0]).toMatchObject({ end: e.at, accruedMs: 18 * MIN });
  });

  it('is offered once its journal has been quiet for two minutes', () => {
    const e = lost('walk-aaaa', 18);
    const plan = recoveryPlan({ entries: [e], now: e.at + JOURNAL_STALE_MS, observations: [] });
    expect(plan.offer.map(r => [r.entry.id, r.minutes])).toEqual([['walk-aaaa', 18]]);
    expect(plan.retire).toEqual([]);
  });

  it('is left alone while another tab may still be recording it, and looked at again once it would be stale (Review Focus 2)', () => {
    const e = lost('walk-aaaa', 18);
    const plan = recoveryPlan({ entries: [e], now: e.at + 30_000, observations: [] });
    expect(plan).toEqual({ offer: [], retire: [], wakeAt: e.at + JOURNAL_STALE_MS });
  });

  it('is left alone while this tab’s draft holds it: the Walk hub offers it already (Review Focus 2)', () => {
    const e = lost('walk-aaaa', 18);
    expect(recoveryPlan({ entries: [e], now: e.at + 10 * MIN, observations: [], draftId: 'walk-aaaa' })).toEqual({ offer: [], retire: [] });
  });

  it('retires the journal of a walk already saved, and of one with nothing to save', () => {
    const saved = lost('walk-aaaa', 18);
    const empty = lost('walk-bbbb', 0);
    const records = walkObservations(interruptedWalk(saved.walk)).map(i => newObservation(i));
    const plan = recoveryPlan({ entries: [saved, empty], now: saved.at + 10 * MIN, observations: records });
    expect(plan.offer).toEqual([]);
    expect([...plan.retire].sort()).toEqual(['walk-aaaa', 'walk-bbbb']);
  });

  it('says when the walk was, as a person would', () => {
    const tuesday = new Date(2026, 9, 6, 18, 0).getTime();
    const r = recoveryPlan({ entries: [lost('walk-aaaa', 18, tuesday)], now: tuesday + 3 * MIN * 60, observations: [] }).offer[0];
    expect(recoveryText(r, tuesday + 60 * MIN)).toBe('Your walk today was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 7, 9, 0).getTime())).toBe('Your walk yesterday was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 8, 9, 0).getTime())).toBe('Your walk on Tuesday was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 20, 9, 0).getTime())).toBe('Your walk on 6 Oct was interrupted at 18 min. Save it?');
  });
});

describe('a walk still open on this device, ended from the Walk hub to be reviewed and saved (codex H2-01)', () => {
  const memory = (): WalkStorage => {
    const map = new Map<string, string>();
    return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k) };
  };
  const walking = (minutes: number) => accrueOpen(startWalk('walk-bbbb', { kind: 'walk', gps: false, steps: false }, START), minutes * MIN, START + minutes * MIN);

  it('a walk left for another screen ends when it was left: nothing records again, and nothing walked is lost', () => {
    const storage = memory();
    storeWalk(storage, leaveWalk(walking(12), START + 12 * MIN, 'left'));
    expect(endOpenWalk(storage, START + 90 * MIN)).toBe(true);
    const w = loadWalk(storage)!;
    expect(w).toMatchObject({ status: 'finished', endedBy: 'stop', finishedAt: START + 12 * MIN });
    expect(w.segments.every(s => s.end !== undefined)).toBe(true);
    expect(w.segments[0].accruedMs).toBe(12 * MIN);
  });

  it('a walk still marked as recording (the page went away) ends when it was last seen, not now', () => {
    const storage = memory();
    storeWalk(storage, walking(5));
    endOpenWalk(storage, START + 60 * MIN);
    const w = loadWalk(storage)!;
    expect(w.status).toBe('finished');
    expect(w.segments.at(-1)!.end).toBeLessThanOrEqual(START + 5 * MIN);
  });

  it('a paused walk ends without another second added; a finished one is left as it is; with none, false', () => {
    const storage = memory();
    storeWalk(storage, pauseWalk(walking(7), START + 7 * MIN));
    endOpenWalk(storage, START + 20 * MIN);
    const paused = loadWalk(storage)!;
    expect(paused.status).toBe('finished');
    expect(paused.segments.reduce((t, s) => t + s.accruedMs, 0)).toBe(7 * MIN);
    endOpenWalk(storage, START + 40 * MIN);
    expect(loadWalk(storage)).toEqual(paused);
    expect(endOpenWalk(memory(), START)).toBe(false);
  });
});
