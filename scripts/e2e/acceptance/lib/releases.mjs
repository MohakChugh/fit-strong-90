/**
 * Two real releases of the app at one origin, with their service workers
 * (B-21, board D121, Codex P8-21): `A`, this build, numbered 100, and `B`,
 * its successor, numbered 200, built with `VITE_ACCEPTANCE_SUCCESSOR=1`
 * (database and schema one higher, an empty migration). The server serves
 * one at a time, switched with `use`, as a deploy switches a site; `broken`
 * makes a later release whose worker names a file the server hasn't got, so
 * its install fails. Built in temp directories outside the repository, as the
 * preview build is.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { BASE_PATH, REPO } from './env.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

function build(name, env, logDir) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `fit-acceptance-release-${name}-`));
  return new Promise((resolve, reject) => {
    const b = spawn('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(logDir, `release-${name}.log`));
    b.stdout.pipe(log);
    b.stderr.pipe(log);
    b.on('exit', code => (code === 0 ? resolve(outDir) : reject(new Error(`release ${name} did not build (${code}); see ${path.join(logDir, `release-${name}.log`)}`))));
  });
}

export async function releaseServer(port, logDir = os.tmpdir()) {
  const dirs = {
    A: await build('A', { FITSTRONG_RELEASE_NUMBER: '100' }, logDir),
    B: await build('B', { VITE_ACCEPTANCE_SUCCESSOR: '1', FITSTRONG_RELEASE_NUMBER: '200' }, logDir),
  };
  const sw = name => fs.readFileSync(path.join(dirs[name], 'sw.js'), 'utf8');
  let current = 'A';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith(BASE_PATH)) { res.writeHead(404); res.end(); return; }
    const root = dirs[current];
    const file = path.join(root, decodeURIComponent(url.pathname.slice(BASE_PATH.length)) || 'index.html');
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (!target.startsWith(root) || !fs.existsSync(target)) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}${BASE_PATH}`,
    /** Serve this release from now on, as a deploy does. */
    use(name) {
      if (!dirs[name]) throw new Error(`no release ${name}`);
      current = name;
    },
    /**
     * A later copy of `from` (its number 50 more) whose worker is new and
     * names a file this server hasn't got: its install must fail. Made once.
     */
    broken(from, name) {
      if (dirs[name]) return;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fit-acceptance-release-${name}-`));
      fs.cpSync(dirs[from], dir, { recursive: true });
      const file = path.join(dir, 'sw.js');
      const src = fs.readFileSync(file, 'utf8')
        .replace(/const BUILD = "([0-9a-f]+)"/, (_, b) => `const BUILD = "${b}broken"`)
        .replace(/const NUMBER = Number\("(\d+)"\)/, (_, n) => `const NUMBER = Number("${Number(n) + 50}")`)
        .replace('const PRECACHE = [', `const PRECACHE = ["${BASE_PATH}assets/not-on-this-server.js",`);
      fs.writeFileSync(file, src);
      dirs[name] = dir;
    },
    /** A release's stamp, as its worker says it. */
    build(name) {
      const stamp = sw(name).match(/const BUILD = "([^"]+)"/);
      if (!stamp) throw new Error(`release ${name} has no stamp`);
      return stamp[1];
    },
    /** A release's cache: `fitstrong-<number>-<stamp>` (public/sw.js). */
    cache(name) {
      const number = sw(name).match(/const NUMBER = Number\("(\d+)"\)/);
      if (!number) throw new Error(`release ${name} has no number`);
      return `fitstrong-${number[1]}-${this.build(name)}`;
    },
    /** The script a release's own index.html loads first: what tells two releases' shells apart. */
    entry(name) {
      const html = fs.readFileSync(path.join(dirs[name], 'index.html'), 'utf8');
      const src = html.match(/<script type="module"[^>]*src="([^"]+)"/);
      if (!src) throw new Error(`release ${name} has no entry script`);
      return src[1];
    },
    close() { server.close(); },
  };
}

/** Polls `fn` in the page until it returns something truthy, through reloads; that value. */
export async function until(page, fn, what, ms = 60000) {
  const end = Date.now() + ms;
  for (;;) {
    const got = await page.evaluate(fn).catch(() => undefined);
    if (got) return got;
    if (Date.now() > end) throw new Error(`${what} (after ${Math.round(ms / 1000)} s)`);
    await page.waitForTimeout(500);
  }
}

/** The page's real worker in charge: a first install takes the page over once it has cached its release whole. */
export const controlled = page => until(page, () => !!navigator.serviceWorker.controller, 'no worker took the page over', 90000);

/**
 * The registration's next release, followed to the end of its install:
 * 'installed' (it waits, or takes over at once) or 'redundant' (it failed).
 * One already installing or waiting counts.
 */
export async function installNext(page, ms = 90000) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const seen = (window.__install = []);
    const follow = w => {
      seen.push(w.state);
      w.addEventListener('statechange', () => seen.push(w.state));
    };
    if (reg.waiting) seen.push('installed');
    else if (reg.installing) follow(reg.installing);
    else {
      reg.addEventListener('updatefound', () => follow(reg.installing), { once: true });
      await reg.update().catch(() => undefined);
    }
  });
  return until(page, () => window.__install?.find(s => s === 'installed' || s === 'redundant'), 'the next release never finished installing', ms);
}

/** Ask for the next release, as the app does on a return; the page may reload under it. */
export const checkForUpdate = page => page.evaluate(async () => {
  await (await navigator.serviceWorker.getRegistration())?.update().catch(() => undefined);
}).catch(() => undefined);

export const hasWaiting = page => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
export const cacheNames = page => page.evaluate(() => caches.keys());
/** The release this page runs, as its worker told it (Task 2's `data-build`). */
export const buildOf = page => until(page, () => document.documentElement.dataset.build, 'the page never learned its release', 30000);

/** This document, marked: a reload takes the mark with it. */
export const mark = page => page.evaluate(() => { window.__sameDocument = true; });
export const sameDocument = page => page.evaluate(() => window.__sameDocument === true).catch(() => false);
