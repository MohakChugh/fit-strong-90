/**
 * Drawing a route (journey §9.2, §9.5; motion M13, M14), in Web Mercator
 * pixels: the space OpenStreetMap's tiles use, so our own drawing and the
 * map pictures under it line up. Pure; the screens lay out what this returns.
 */
import { metresBetween } from './gps';
import type { Bbox, LatLon, RouteLine } from './routeRecord';

export const TILE_PX = 256;
export const ZOOM = { min: 3, max: 18 } as const;
/** The drawing's own size, in its own pixels; it scales to the screen. */
export const VIEW_SIZE = { w: 400, h: 300 } as const;

/** What is on screen: a zoom, its centre in world pixels at that zoom, and a size. */
export interface View { z: number; cx: number; cy: number; w: number; h: number }

const MAX_LAT = 85.05112878;

export function worldPx(lat: number, lon: number, z: number): { x: number; y: number } {
  const scale = TILE_PX * 2 ** z;
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * scale,
  };
}

/** The largest zoom at which the box fits the view with `pad` px to spare, centred on it. */
export function fitView(box: Bbox, w: number, h: number, pad = 24): View {
  const [s, west, n, e] = box;
  const at = (z: number): View => {
    const a = worldPx(n, west, z);
    const b = worldPx(s, e, z);
    return { z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w, h };
  };
  for (let z = ZOOM.max; z > ZOOM.min; z--) {
    const a = worldPx(n, west, z);
    const b = worldPx(s, e, z);
    if (b.x - a.x <= w - 2 * pad && b.y - a.y <= h - 2 * pad) return at(z);
  }
  return at(ZOOM.min);
}

/** Where a point sits in the view, in view pixels. */
export function toView(lat: number, lon: number, v: View): { x: number; y: number } {
  const p = worldPx(lat, lon, v.z);
  return { x: p.x - v.cx + v.w / 2, y: p.y - v.cy + v.h / 2 };
}

/** Whether the box sits inside the view with `pad` px to spare. */
export function holds(v: View, box: Bbox, pad = 12): boolean {
  const a = toView(box[2], box[1], v);
  const b = toView(box[0], box[3], v);
  return a.x >= pad && a.y >= pad && b.x <= v.w - pad && b.y <= v.h - pad;
}

/** One step in or out, about the same centre. */
export function zoomed(v: View, by: 1 | -1): View {
  const z = Math.max(ZOOM.min, Math.min(ZOOM.max, v.z + by));
  const f = 2 ** (z - v.z);
  return { ...v, z, cx: v.cx * f, cy: v.cy * f };
}

/** The box, grown to hold one more point: the walker, in the live view. */
export function withPoint(box: Bbox | undefined, p: LatLon | undefined): Bbox | undefined {
  if (!p) return box;
  if (!box) return [p[0], p[1], p[0], p[1]];
  return [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])];
}

/**
 * The live view (M13, B-29). It keeps the whole route in view by stepping its
 * scale, never by animating, and only when the route no longer fits. Fixed
 * (under Reduce Motion, or after Zoom in or Zoom out), it stays where it is
 * until "Show whole route".
 */
export function liveView(prev: View | undefined, box: Bbox | undefined, mode: 'auto' | 'fixed', size: { w: number; h: number } = VIEW_SIZE): View | undefined {
  if (!box) return prev;
  if (!prev) return fitView(box, size.w, size.h);
  if (mode === 'fixed' || holds(prev, box)) return prev;
  return fitView(box, size.w, size.h);
}

/** One SVG path per line of two points or more. Lines are never joined (A-48). */
export function linePaths(lines: readonly RouteLine[], v: View): string[] {
  return lines
    .filter(l => l.coords.length >= 2)
    .map(l => l.coords.map(([lat, lon], i) => {
      const p = toView(lat, lon, v);
      return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(''));
}

/** The plain grid under the drawing: a line every `every` world px, so it moves with the map's own squares. */
export function gridLines(v: View, every = 64): { x: number[]; y: number[] } {
  const left = v.cx - v.w / 2;
  const top = v.cy - v.h / 2;
  const x: number[] = [];
  const y: number[] = [];
  for (let at = Math.ceil(left / every) * every; at <= left + v.w; at += every) x.push(at - left);
  for (let at = Math.ceil(top / every) * every; at <= top + v.h; at += every) y.push(at - top);
  return { x, y };
}

export interface Split { km: number; ms: number }

/**
 * The time of each complete kilometre (journey §9.5, B-17): distance and time
 * are read off the same lines, so a dropout's distance and its time are both
 * left out. A kilometre still under way is not a split.
 */
export function splitsOf(lines: readonly RouteLine[]): Split[] {
  const out: Split[] = [];
  let metres = 0;
  let covered = 0;
  let mark = 0;
  for (const line of lines) {
    for (let i = 1; i < line.coords.length; i++) {
      const [aLat, aLon] = line.coords[i - 1];
      const [bLat, bLon] = line.coords[i];
      const d = metresBetween({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
      const dt = line.ms[i] - line.ms[i - 1];
      while (d > 0 && metres + d >= (out.length + 1) * 1000) {
        const into = (out.length + 1) * 1000 - metres;
        const at = covered + dt * (into / d);
        out.push({ km: out.length + 1, ms: Math.round(at - mark) });
        mark = at;
      }
      metres += d;
      covered += dt;
    }
  }
  return out;
}
