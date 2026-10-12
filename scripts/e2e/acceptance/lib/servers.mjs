/**
 * The suite's own servers: a watch-free dev server (so edits elsewhere cannot
 * reload a page mid-journey) and a production build with `vite preview` (the
 * service worker and CSP exist only there). Each is started on a port of our
 * own and stopped by us; nothing else is touched.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BASE_PATH, REPO } from './env.mjs';

const children = [];

export function stopServers() {
  for (const c of children.splice(0)) { try { c.kill('SIGTERM'); } catch { /* already gone */ } }
}
process.on('exit', stopServers);
process.on('SIGINT', () => { stopServers(); process.exit(130); });

export async function waitFor(url, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`${url} did not come up`);
}

function start(argv, log) {
  const child = spawn('npx', argv, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(log);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  children.push(child);
  return child;
}

/** A watch-free dev server on `port`; resolves to its app URL. */
export async function devServer(port, logDir = os.tmpdir()) {
  const url = `http://127.0.0.1:${port}${BASE_PATH}`;
  start(['vite', '--config', 'scripts/e2e/vite.nowatch.config.mjs', '--port', String(port), '--strictPort'], path.join(logDir, `dev-server-${port}.log`));
  await waitFor(url);
  return url;
}

/**
 * A production build in a temp directory outside the repository (so the
 * repo's own `dist/` is never overwritten), served by `vite preview`.
 */
export async function previewServer(port, logDir = os.tmpdir()) {
  // A fresh directory per build: a failed or concurrent build never empties one a server is using.
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `fit-acceptance-dist-${port}-`));
  await new Promise((resolve, reject) => {
    const b = spawn('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(logDir, `build-${port}.log`));
    b.stdout.pipe(log);
    b.stderr.pipe(log);
    b.on('exit', code => (code === 0 ? resolve() : reject(new Error(`vite build failed (${code}); see ${path.join(logDir, `build-${port}.log`)}`))));
  });
  const url = `http://127.0.0.1:${port}${BASE_PATH}`;
  start(['vite', 'preview', '--outDir', outDir, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], path.join(logDir, `preview-server-${port}.log`));
  await waitFor(url);
  return url;
}
