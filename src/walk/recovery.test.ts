import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import { accrueOpen, startWalk } from './clock';
import { JOURNAL_STALE_MS, journalEntry } from './journal';
import { walkObservations } from './record';
import { interruptedWalk, recoveryPlan, recoveryText } from './recovery';

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
