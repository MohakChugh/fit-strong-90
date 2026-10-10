import { describe, expect, it } from 'vitest';
import { bboxOf, capLines, routeProblem, routeRecord, ROUTE_LIMITS, type LatLon, type RouteLine } from './routeRecord';

const line = (start: number, pts: LatLon[], stepMs = 10_000): RouteLine => ({
  start, end: start + (pts.length - 1) * stepMs, coords: pts, ms: pts.map((_, i) => i * stepMs),
});
const A = line(1_760_000_000_000, [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]]);
const B = line(1_760_000_300_000, [[12.98, 77.6], [12.9801, 77.6003]]);
const AT = '2026-10-08T09:00:00.000+05:30';
const ID = 'k8f0a1-abc12345';

describe('a route record (journey §18.2, B-17)', () => {
  it('keeps the lines with two points or more, with their box', () => {
    const r = routeRecord(ID, AT, [A, B, line(1_760_000_600_000, [[1, 1]])])!;
    expect(r.segments).toHaveLength(2);
    // [south, west, north, east]: B's second point, at 12.9801, is the northernmost.
    expect(r.bbox).toEqual([12.97, 77.59, 12.9801, 77.6003]);
    expect(routeProblem(r as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it('is nothing when no line has two points', () => {
    expect(routeRecord(ID, AT, [line(1, [[1, 1]])])).toBeUndefined();
  });

  it('refuses anything a walk could not have recorded', () => {
    const good = routeRecord(ID, AT, [A])! as unknown as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => routeProblem({ ...good, ...patch });
    expect(bad({ walkId: 'no spaces allowed' })).toMatch(/walk/);
    expect(bad({ version: 2 })).toMatch(/version/);
    expect(bad({ startedAt: '2026-10-08 09:00' })).toMatch(/startedAt/);
    expect(bad({ segments: [{ ...A, coords: [[91, 0], [0, 0], [0, 0]] }] })).toMatch(/coordinate/);
    expect(bad({ segments: [{ ...A, ms: [0, 20_000, 10_000] }] })).toMatch(/time/);
    expect(bad({ segments: [{ ...A, ms: [0, 10_000] }] })).toMatch(/time/);
    // Each on its own: out of order though it ends on its span, and in order though it doesn't.
    expect(bad({ segments: [{ ...A, ms: [0, 25_000, 20_000] }] })).toMatch(/out of time order/);
    expect(bad({ segments: [{ ...A, ms: [0, 10_000, 15_000] }] })).toMatch(/do not match its span/);
    expect(bad({ bbox: [0, 0, 1, 1] })).toMatch(/box/);
    expect(bad({ segments: [] })).toMatch(/lines/);
    expect(bad({ segments: Array.from({ length: ROUTE_LIMITS.lines + 1 }, () => A) })).toMatch(/lines/);
  });

  it('refuses more points than one walk could hold', () => {
    const many = line(0, Array.from({ length: ROUTE_LIMITS.points + 1 }, (_, i): LatLon => [12 + i * 1e-6, 77]), 1000);
    const r = { walkId: ID, version: 1, startedAt: AT, segments: [many], bbox: bboxOf([many]) };
    expect(routeProblem(r)).toMatch(/points/);
  });

  it('keeps the earliest points when a walk runs past the limit', () => {
    const capped = capLines([A, B], 4);
    expect(capped.map(l => l.coords.length)).toEqual([3]);
    expect(capLines([A, B], 5).map(l => l.coords.length)).toEqual([3, 2]);
    expect(capLines([A], 2)[0]).toMatchObject({ coords: A.coords.slice(0, 2), ms: [0, 10_000], end: A.start + 10_000 });
  });
});
