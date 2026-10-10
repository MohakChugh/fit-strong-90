import { describe, expect, it } from 'vitest';
import { finishWalk, startWalk } from './clock';
import { CHECKPOINT_MS, checkpointDue, journalEntry, parseJournalEntry } from './journal';
import type { RouteLine } from './routeRecord';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const W = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute: true }, T);
const LINE: RouteLine = { start: T, end: T + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };

describe('the walk journal (journey §9.4, §18.2)', () => {
  it('checkpoints at once the first time, then every 15 seconds', () => {
    expect(checkpointDue(undefined, T)).toBe(true);
    expect(checkpointDue(T, T + CHECKPOINT_MS - 1)).toBe(false);
    expect(checkpointDue(T, T + CHECKPOINT_MS)).toBe(true);
  });

  it('round-trips an entry with its route, leaving out lines too short to draw', () => {
    const entry = journalEntry(W, T + 5000, [LINE, { start: T, end: T, coords: [[1, 1]], ms: [0] }]);
    expect(entry.route).toHaveLength(1);
    expect(parseJournalEntry(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
  });

  it('keeps no route for a walk whose route is not kept', () => {
    expect('route' in journalEntry(W, T)).toBe(false);
  });

  it('drops anything it cannot trust, rather than guessing', () => {
    const entry = journalEntry(W, T, [LINE]);
    expect(parseJournalEntry({ ...entry, version: 2 })).toBeNull();
    expect(parseJournalEntry({ ...entry, id: 'another-walk' })).toBeNull();
    expect(parseJournalEntry({ ...entry, route: [{ ...LINE, ms: [0] }] })).toBeNull();
    expect(parseJournalEntry({ ...entry, walk: { ...W, segments: [] } })).toBeNull();
    expect(parseJournalEntry(finishWalk(W, T + 1, 'finish'))).toBeNull();
  });
});
