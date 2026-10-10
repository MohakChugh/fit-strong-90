import { describe, expect, it } from 'vitest';
import { fitView, gridLines, holds, linePaths, liveView, splitsOf, toView, VIEW_SIZE, withPoint, worldPx, zoomed, ZOOM } from './route';
import type { Bbox, LatLon, RouteLine } from './routeRecord';

const R = 6_371_008.8;
const north = (lat: number, lon: number, m: number): LatLon => [lat + (m / R) * (180 / Math.PI), lon];

/** A straight line north: a point every `step` metres, every `dt` ms. */
function walkLine(start: number, from: LatLon, metres: number, step = 100, dt = 60_000): RouteLine {
  const n = Math.round(metres / step);
  const coords = Array.from({ length: n + 1 }, (_, i) => north(from[0], from[1], i * step));
  return { start, end: start + n * dt, coords, ms: coords.map((_, i) => i * dt) };
}

const BOX: Bbox = [12.97, 77.59, 12.975, 77.6];

describe('Web Mercator, the tiles’ own space', () => {
  it('puts 0°, 0° at the centre of the world tile', () => {
    expect(worldPx(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(worldPx(0, 0, 1)).toEqual({ x: 256, y: 256 });
  });
});

describe('the view', () => {
  it('fits a route at the largest zoom that holds it, centred', () => {
    const v = fitView(BOX, 400, 300);
    expect(holds(v, BOX)).toBe(true);
    expect(holds(zoomed(v, 1), BOX, 24)).toBe(false);
    expect(toView((BOX[0] + BOX[2]) / 2, (BOX[1] + BOX[3]) / 2, v).x).toBeCloseTo(200, 0);
  });

  it('steps in and out about the same centre, within the zoom range', () => {
    const v = fitView(BOX, 400, 300);
    expect(zoomed(v, 1).z).toBe(Math.min(v.z + 1, ZOOM.max));
    expect(zoomed(zoomed(v, 1), -1)).toEqual(v);
    const centre = toView((BOX[0] + BOX[2]) / 2, (BOX[1] + BOX[3]) / 2, zoomed(v, 1));
    expect(centre.x).toBeCloseTo(200, 0);
    expect(centre.y).toBeCloseTo(150, 0);
    const top = { ...v, z: ZOOM.max };
    expect(zoomed(top, 1)).toEqual(top);
    expect(zoomed({ ...v, z: ZOOM.min }, -1).z).toBe(ZOOM.min);
  });

  it('leaves room around the route, stepping out rather than touching the edge', () => {
    // 380 px wide at zoom 16: inside the 400 px view, but not with 24 px either side.
    const wide = (380 / (256 * 2 ** 16)) * 360;
    const box: Bbox = [12.97, 77.59, 12.9701, 77.59 + wide];
    const v = fitView(box, 400, 300);
    expect(v.z).toBe(15);
    expect(holds(v, box, 24)).toBe(true);
  });

  it('steps out only when the route no longer fits, and never moves while fixed (M13, B-29)', () => {
    const small: Bbox = [12.97, 77.59, 12.9705, 77.5905];
    const v = liveView(undefined, small, 'auto')!;
    expect(liveView(v, small, 'auto')).toBe(v);
    const grown: Bbox = [12.97, 77.59, 12.99, 77.62];
    expect(liveView(v, grown, 'auto')!.z).toBeLessThan(v.z);
    expect(liveView(v, grown, 'fixed')).toBe(v);
  });

  it('grows the box to hold the walker', () => {
    expect(withPoint(undefined, [1, 2])).toEqual([1, 2, 1, 2]);
    expect(withPoint([0, 0, 1, 1], [2, -1])).toEqual([0, -1, 2, 1]);
    expect(withPoint([0, 0, 1, 1], undefined)).toEqual([0, 0, 1, 1]);
  });
});

describe('drawing', () => {
  it('draws each line on its own and never joins two (A-48)', () => {
    const a = walkLine(0, [12.97, 77.59], 300);
    const b = walkLine(600_000, [12.98, 77.59], 300);
    const v = fitView([12.97, 77.59, 12.983, 77.59], 400, 300);
    const paths = linePaths([a, b, { start: 0, end: 0, coords: [[1, 1]], ms: [0] }], v);
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p.match(/M/g)).toHaveLength(1);
  });

  it('lays a plain grid across the whole view', () => {
    const g = gridLines(fitView(BOX, VIEW_SIZE.w, VIEW_SIZE.h));
    expect(g.x.length).toBeGreaterThanOrEqual(6);
    expect(g.y.every(y => y >= 0 && y <= VIEW_SIZE.h)).toBe(true);
  });
});

describe('splits (journey §9.5, B-17)', () => {
  it('gives each complete kilometre its time, and nothing for the one under way', () => {
    const splits = splitsOf([walkLine(0, [12.97, 77.59], 2400)]);
    expect(splits.map(s => s.km)).toEqual([1, 2]);
    for (const s of splits) expect(s.ms).toBeCloseTo(600_000, -3);
  });

  it('leaves out a dropout’s time, as its distance is left out', () => {
    const a = walkLine(0, [12.97, 77.59], 600, 100, 36_000);
    const b = walkLine(3_600_000, [12.99, 77.59], 700, 100, 60_000);
    const [first] = splitsOf([a, b]);
    // The kilometre ends 400 m into the second line: 216 s, then 240 s. The hour between isn't walking.
    expect(first.ms).toBeCloseTo(456_000, -3);
  });
});
