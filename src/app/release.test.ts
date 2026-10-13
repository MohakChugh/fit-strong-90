import { describe, expect, it } from 'vitest';
import { releaseFiles, releaseStamp } from './release';

const enc = (s: string) => new TextEncoder().encode(s);
/** What Vite emits: every file under a name that changes with its bytes, but index.html; and the worker, copied from public/. */
const BUNDLE = [
  'index.html', 'assets/index-a1b2c3d4.js', 'assets/index-a1b2c3d4.js.map', 'assets/index-e5f6a7b8.css',
  'assets/coach-female-0f1e2d3c.bin', 'assets/apple-touch-icon-4b5a6978.png', 'assets/favicon-9a8b7c6d.svg', 'sw.js',
];

function stamp(over: Record<string, string> = {}, worker = 'worker code') {
  const bytes: Record<string, string> = {
    'index.html': '<html>A</html>', 'assets/index-a1b2c3d4.js': 'console.log(1)', 'assets/index-e5f6a7b8.css': 'body{}',
    'assets/coach-female-0f1e2d3c.bin': 'BIN-A', 'assets/apple-touch-icon-4b5a6978.png': 'PNG', 'assets/favicon-9a8b7c6d.svg': '<svg/>', ...over,
  };
  return releaseStamp(f => enc(bytes[f]), [...releaseFiles(BUNDLE), 'index.html'], worker);
}

describe('one release, one stamp (J§21.2, D120)', () => {
  it('is Vite’s own files once, sorted, each named by its bytes: never index.html’s fixed name, a source map or the worker (P8S-15)', () => {
    expect(releaseFiles([...BUNDLE, 'assets/index-a1b2c3d4.js'])).toEqual([
      'assets/apple-touch-icon-4b5a6978.png', 'assets/coach-female-0f1e2d3c.bin', 'assets/favicon-9a8b7c6d.svg', 'assets/index-a1b2c3d4.js', 'assets/index-e5f6a7b8.css',
    ]);
  });

  it('is the same for the same files, in any order', async () => {
    expect(await stamp()).toMatch(/^[0-9a-f]{12}$/);
    expect(await stamp()).toBe(await stamp());
    const list = releaseFiles(BUNDLE);
    expect(await releaseStamp(enc, [...list].reverse(), 'w')).toBe(await releaseStamp(enc, list, 'w'));
  });

  it('changes with any file’s bytes, index.html’s and the worker’s included (P8-07)', async () => {
    const base = await stamp();
    expect(await stamp({ 'assets/coach-female-0f1e2d3c.bin': 'BIN-B' })).not.toBe(base);
    expect(await stamp({ 'index.html': '<html>B</html>' })).not.toBe(base);
    expect(await stamp({ 'assets/apple-touch-icon-4b5a6978.png': 'PNG2' })).not.toBe(base);
    expect(await stamp({}, 'worker code, changed')).not.toBe(base);
  });
});
