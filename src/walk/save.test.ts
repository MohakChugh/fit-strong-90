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
});
