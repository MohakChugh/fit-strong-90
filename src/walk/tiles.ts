/**
 * Map pictures (journey §9.5, J§22, B-23): OpenStreetMap's standard tiles,
 * only those the current view shows, as plain <img>s. No prefetching, no
 * offline copies and no bulk download, as the tile usage policy asks; the
 * browser's ordinary HTTP cache and the page's Referer.
 */
import { TILE_PX, type View } from './route';

export const TILE_ORIGIN = 'https://tile.openstreetmap.org';

export const ATTRIBUTION = { text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' } as const;

export interface Tile {
  z: number;
  x: number;
  y: number;
  url: string;
  /** Where the tile's top-left corner sits in the view, in view pixels. */
  left: number;
  top: number;
}

export const tileUrl = (z: number, x: number, y: number): string => `${TILE_ORIGIN}/${z}/${x}/${y}.png`;

/** The tiles covering the view, wrapped across the date line and clipped to the world's rows. */
export function viewTiles(v: View): Tile[] {
  const n = 2 ** v.z;
  const left = v.cx - v.w / 2;
  const top = v.cy - v.h / 2;
  const x0 = Math.floor(left / TILE_PX);
  const x1 = Math.floor((left + v.w - 1) / TILE_PX);
  const y0 = Math.max(0, Math.floor(top / TILE_PX));
  const y1 = Math.min(n - 1, Math.floor((top + v.h - 1) / TILE_PX));
  const out: Tile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = ((tx % n) + n) % n;
      out.push({ z: v.z, x, y: ty, url: tileUrl(v.z, x, ty), left: tx * TILE_PX - left, top: ty * TILE_PX - top });
    }
  }
  return out;
}

/** In place of the pictures, when they can't be shown (journey §9.4, V-J16). */
export function mapUnavailable(offline: boolean): string {
  return offline ? 'Map pictures unavailable. Needs a connection.' : 'Map pictures unavailable.';
}
