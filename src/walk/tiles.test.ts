import { describe, expect, it } from 'vitest';
import { TILE_PX } from './route';
import { ATTRIBUTION, mapUnavailable, tileUrl, viewTiles } from './tiles';

describe('map pictures (journey §9.5, J§22, B-23)', () => {
  const v = { z: 15, cx: 1000 * TILE_PX, cy: 500 * TILE_PX, w: 400, h: 300 };

  it('asks only for the tiles the view shows, each placed where it sits', () => {
    const tiles = viewTiles(v);
    expect(tiles.map(t => `${t.x}/${t.y}`)).toEqual(['999/499', '1000/499', '999/500', '1000/500']);
    expect(tiles[0]).toMatchObject({ z: 15, left: -56, top: -106, url: 'https://tile.openstreetmap.org/15/999/499.png' });
  });

  it('never asks for more than nine tiles at the drawing’s size, wherever the view sits', () => {
    for (const dx of [0, 37, 128, 255]) {
      for (const dy of [0, 64, 200, 255]) expect(viewTiles({ ...v, cx: v.cx + dx, cy: v.cy + dy }).length).toBeLessThanOrEqual(9);
    }
  });

  it('wraps across the date line, and never asks for a row outside the world', () => {
    const tiles = viewTiles({ z: 3, cx: 100, cy: 100, w: 400, h: 300 });
    expect(tiles.every(t => t.x >= 0 && t.x < 8 && t.y >= 0 && t.y < 8)).toBe(true);
    expect(tiles.map(t => t.x)).toEqual([7, 0, 1]);
  });

  it('uses the standard tile address, and credits OpenStreetMap with a link', () => {
    expect(tileUrl(18, 1, 2)).toBe('https://tile.openstreetmap.org/18/1/2.png');
    expect(ATTRIBUTION).toEqual({ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' });
  });

  it('says why there are no pictures (journey §9.4, V-J16)', () => {
    expect(mapUnavailable(true)).toBe('Map pictures unavailable. Needs a connection.');
    expect(mapUnavailable(false)).toBe('Map pictures unavailable.');
  });
});
