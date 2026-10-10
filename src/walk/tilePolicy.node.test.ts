/**
 * The tile request's network policy, read from the files that set it
 * (J§22, B-23): the CSP admits OpenStreetMap's tile server for images and
 * nothing else new; the Referer stays valid; the service worker never
 * touches another origin; the map never prefetches.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = fs.readFileSync('vite.config.ts', 'utf8');
const worker = fs.readFileSync('public/sw.js', 'utf8');
const map = fs.readFileSync('src/screens/walk/StaticMap.tsx', 'utf8');
const directives = [...config.matchAll(/"([a-z-]+-src [^"]*)"/g)].map(m => m[1]);

describe('map pictures and the network (J§22, B-23)', () => {
  it('admits images from the tile server, and no other origin anywhere', () => {
    expect(directives).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
    expect(directives.filter(d => /https?:/.test(d))).toEqual(["img-src 'self' data: blob: https://tile.openstreetmap.org"]);
    expect(directives).toContain("connect-src 'self'");
  });

  it('keeps a valid Referer on every tile', () => {
    expect(config).toContain("content: 'strict-origin-when-cross-origin'");
    expect(map).not.toMatch(/referrer/i);
  });

  it('leaves tiles to the browser’s own cache: the worker passes other origins by and precaches no tile', () => {
    expect(worker).toContain('url.origin !== self.location.origin');
    expect(worker).not.toMatch(/openstreetmap|tile/i);
  });

  it('never prefetches a tile', () => {
    expect(map).not.toMatch(/prefetch|preload|new Image\(|fetch\(/);
  });
});
