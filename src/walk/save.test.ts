import { describe, expect, it } from 'vitest';
import { finishWalk, startWalk, updateOpenSegment } from './clock';
import { walkObservations } from './record';
import { walkSave } from './save';
import type { RouteLine } from './routeRecord';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const LINE: RouteLine = { start: T + 1000, end: T + 21_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
const walked = (keepRoute: boolean) => finishWalk(
  updateOpenSegment(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute }, T), s => ({ ...s, gps: [{ start: T + 1000, end: T + 21_000, distanceM: 120 }] })),
  T + 600_000, 'finish');

describe('what saving a walk writes (journey §18.3)', () => {
  it('writes the walk’s records, and its route only when the person keeps routes', () => {
    const kept = walkSave(walked(true), { route: [LINE] });
    expect(kept.observations).toEqual(walkObservations(walked(true)));
    expect(kept.route).toMatchObject({ walkId: 'mgh3k2x1-1a2b3c4d', segments: [LINE] });
    expect(walkSave(walked(false), { route: [LINE] }).route).toBeUndefined();
    expect(walkSave(walked(true)).route).toBeUndefined();
  });

  it('says which erase generation a kept route began in, so the save keeps it after an erase made before the walk (K6R-12)', () => {
    const since = finishWalk(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute: true, routeGen: 2 }, T), T + 600_000, 'finish');
    expect(walkSave(since, { route: [LINE] }).routeGen).toBe(2);
    expect(walkSave(since).routeGen).toBe(2);
    expect(walkSave(walked(true)).routeGen).toBe(0);
    expect(walkSave(walked(false)).routeGen).toBeUndefined();
  });

  it('adds the energy estimate as one more record of the walk', () => {
    const energy = { id: 'mgh3k2x1-1a2b3c4d:activeEnergy', kind: 'activeEnergy' as const, value: 42, scope: 'sessionObserved' as const, source: 'measured' as const, coverageMs: 600_000 };
    expect(walkSave(walked(false), { energy }).observations.at(-1)).toBe(energy);
  });
});
