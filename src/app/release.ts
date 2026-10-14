/**
 * What one release is made of (J§21.2, board D120), and its stamp. Every
 * file the build emits is named by its bytes, the 3D models and the icons
 * included, so a precached URL can never answer with another release's
 * bytes (P8S-15); index.html, the one fixed name, is copied to the release's
 * own `shell-<stamp>.html` by the build. The stamp still hashes every byte,
 * index.html's and the worker's code included, so any change at all is a new
 * release with a cache of its own (P8-07). Pure: the build reads the files and
 * hands them in.
 */

/** The release's files, once and sorted: what Vite emits, each named by its bytes; never index.html, a source map, or the worker itself. */
export function releaseFiles(files: readonly string[]): string[] {
  return [...new Set(files.filter(f => !f.endsWith('.map') && f !== 'sw.js' && f !== 'index.html'))].sort();
}

/** The release's stamp: 12 hex digits of SHA-256 over every file's name and bytes, then the worker's code. */
export async function releaseStamp(read: (file: string) => Uint8Array, files: readonly string[], worker: string): Promise<string> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const file of [...files].sort()) parts.push(encoder.encode(`${file}\u0000`), read(file), encoder.encode('\u0000'));
  parts.push(encoder.encode(worker));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
  return [...digest.slice(0, 6)].map(b => b.toString(16).padStart(2, '0')).join('');
}
