/**
 * One journey case in one project: a fresh browser context with the frozen
 * clock, the persona seeded before the first app script, and the evidence a
 * failure must carry (journey, step, project, input, screenshot, visible
 * result, database difference).
 *
 * A step that throws is a failure at that step, and the rest of the case is
 * not run: a missing control is a failure, never a skip (spec rule 6).
 * `check` records a failed assertion and carries on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BASE_PATH, MINUTE, NOW } from './env.mjs';
import { capabilityInit, faultInit, readDatabase, readWebStorage, seedInit, sensorInit, visibilityInit } from './inpage.mjs';
import { sweepInPage, unnamedControls } from './sweep.mjs';

export const SEED_GUARD = '__acceptance:seeded';
export const FAULT_KEY = '__acceptance:fault';

class StepFailed extends Error {}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export class Case {
  constructor({ journey, name, project, browser, origin, root, log }) {
    this.journey = journey;
    this.name = name;
    this.project = project;
    this.browser = browser;
    this.origin = origin; // e.g. http://127.0.0.1:49731
    this.dir = path.join(root, journey, project.id, slug(name) || 'main');
    fs.mkdirSync(this.dir, { recursive: true });
    this.log = log ?? (() => {});
    this.failures = [];
    this.sweep = [];
    this.checkpoints = [];
    this.notes = [];
    this.pendingItems = [];
    this.console = [];
    this.requests = [];
    this.allowed = [];
    this.shots = 0;
    this.time = NOW;
    this.aborted = undefined;
    this.currentStep = undefined;
    this.started = Date.now();
  }

  get base() { return `${this.origin}${BASE_PATH}`; }

  // ---------------------------------------------------------------- set-up

  /**
   * Open the app. `seed` is a v4 AppData object (or null for a first run);
   * `route` is the logical hash route (`/today`), or '' for the app root.
   */
  async open({ seed = null, extraStorage, route = '', sensors, visibility = false, capabilities, faults = true,
    reducedMotion = 'no-preference', contextOptions = {}, time = NOW, textScale, timeout = 12000 } = {}) {
    this.time = time;
    const p = this.project;
    this.context = await this.browser.newContext({
      viewport: { width: p.width, height: p.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'en-IN',
      timezoneId: contextOptions.timezoneId ?? 'Asia/Kolkata',
      colorScheme: p.scheme,
      reducedMotion,
      acceptDownloads: true,
      serviceWorkers: contextOptions.serviceWorkers ?? 'block',
      ...contextOptions,
    });
    // Long enough for a software-rendered 3D demo on a loaded machine; a missing control still fails.
    this.context.setDefaultTimeout(timeout);
    this.context.setDefaultNavigationTimeout(30000);
    // The wall clock is frozen at NOW and moves only when a journey moves it;
    // timers keep running so the interface works (spec "Execution").
    await this.context.clock.install({ time });
    await this.context.clock.setFixedTime(time);
    const blob = seed === null ? null : JSON.stringify(seed);
    await this.context.addInitScript(seedInit, { blob, extra: extraStorage ?? {}, guard: SEED_GUARD });
    if (faults) await this.context.addInitScript(faultInit);
    await this.context.addInitScript(sensorInit, sensors ?? {});
    if (visibility) await this.context.addInitScript(visibilityInit);
    if (capabilities) await this.context.addInitScript(capabilityInit, capabilities);
    if (textScale) {
      await this.context.addInitScript(scale => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${scale * 100}%`; });
      }, textScale);
    }
    this.page = await this.newPage();
    await this.page.goto(`${this.base}${route ? `#${route}` : ''}`, { waitUntil: 'domcontentloaded' });
    await this.ready();
    return this.page;
  }

  /** A page in this context with console, error and request capture. */
  async newPage() {
    const page = await this.context.newPage();
    const tag = this.context.pages().length;
    page.on('console', m => {
      if (m.type() === 'error') this.console.push({ at: this.currentStep, page: tag, text: m.text() });
    });
    page.on('pageerror', e => this.console.push({ at: this.currentStep, page: tag, text: `pageerror: ${e.message}` }));
    page.on('request', r => this.requests.push({ url: r.url(), method: r.method(), at: this.currentStep }));
    return page;
  }

  /** The app has finished booting: a screen heading or the storage screen is up. */
  async ready(page = this.page) {
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      if (!root || !root.firstElementChild) return false;
      if (root.querySelector(':scope > [aria-busy="true"]')) return false;
      return !!document.querySelector('h1, [role="alert"]');
    }, null, { timeout: 30000 });
    await page.waitForTimeout(150);
  }

  async reload(page = this.page) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await this.ready(page);
  }

  /** Go to a logical hash route by loading it, as a deep link or a bookmark does. */
  async goto(route, page = this.page) {
    await page.goto(`${this.base}#${route}`, { waitUntil: 'domcontentloaded' });
    // A hash change within an open document does not reload: force one so the
    // app boots from the link, as a pasted address would.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await this.ready(page);
  }

  /** Navigate within the running app, without a reload. */
  async hash(route, page = this.page) {
    await page.evaluate(r => { location.hash = r; }, route);
    await page.waitForTimeout(400);
  }

  /** The logical route: the part after `#`, within the base. */
  async route(page = this.page) {
    const url = new URL(page.url());
    return url.hash.replace(/^#/, '') || '/';
  }

  // ---------------------------------------------------------------- clock

  /** Move the wall clock and the timers forward together. */
  async advance(ms) {
    this.time += ms;
    await this.context.clock.setFixedTime(this.time);
    await this.context.clock.fastForward(ms);
    // Let the timers that just fired render before anyone reads the screen.
    await this.page.waitForTimeout(350);
  }

  async advanceMinutes(n) { await this.advance(n * MINUTE); }

  /** Jump the wall clock to an absolute moment (never backwards). */
  async setTime(ms) {
    if (ms < this.time) throw new Error(`Clock cannot go back from ${new Date(this.time).toISOString()} to ${new Date(ms).toISOString()}`);
    await this.advance(ms - this.time);
  }

  // ---------------------------------------------------------------- faults

  /** Rules that survive reload, stored under the test namespace. */
  async setFaults(rules, page = this.page) {
    await page.evaluate(([key, r]) => { if (r) localStorage.setItem(key, JSON.stringify(r)); else localStorage.removeItem(key); }, [FAULT_KEY, rules]);
  }

  /** Rules for this page only. */
  async setPageFaults(rules, page = this.page) {
    await page.evaluate(r => { window.__acc.fault = r ?? undefined; }, rules);
  }

  async faultLog(page = this.page) {
    return page.evaluate(() => window.__acc?.faultLog ?? []);
  }

  /** A console error the fault itself causes, exempted by its exact marker only. */
  allowConsole(pattern) { this.allowed.push(pattern); }

  // ---------------------------------------------------------------- reading state

  async db(page = this.page) {
    for (let i = 0; i < 4; i++) {
      try { return await page.evaluate(readDatabase); } catch (e) {
        if (!/context was destroyed|navigation/i.test(String(e))) throw e;
        await page.waitForTimeout(300);
      }
    }
    return page.evaluate(readDatabase);
  }

  async storage(page = this.page) { return page.evaluate(readWebStorage); }

  /** The visible result: the open sheet's text, else the main landmark's. */
  async visible(page = this.page) {
    try {
      return await page.evaluate(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(d => d.getBoundingClientRect().height > 0);
        const el = dialog ?? document.querySelector('main') ?? document.body;
        return el.innerText.replace(/\n{2,}/g, '\n').trim().slice(0, 1200);
      });
    } catch (e) { return `(could not read the page: ${String(e).slice(0, 120)})`; }
  }

  async shot(name, page = this.page, opts = {}) {
    const file = path.join(this.dir, `${String(++this.shots).padStart(2, '0')}-${slug(name)}.png`);
    try { await page.screenshot({ path: file, scale: 'css', fullPage: opts.fullPage ?? false, timeout: 15000 }); } catch { return '(screenshot failed)'; }
    return file;
  }

  // ---------------------------------------------------------------- checkpoints

  /**
   * Screenshot, database snapshot and the per-screen sweep. Returns the
   * snapshot so a journey can assert on it.
   */
  async checkpoint(name, { page = this.page, sweep = true } = {}) {
    await settle(page);
    const file = await this.shot(name, page);
    const snapshot = await this.db(page);
    // The snapshot is evidence too: kept beside the screenshot, with the page's web storage.
    const dbFile = file.endsWith('.png') ? file.replace(/\.png$/, '.db.json') : undefined;
    if (dbFile) {
      const web = await this.storage(page).catch(() => ({}));
      fs.writeFileSync(dbFile, JSON.stringify({ route: await this.route(page).catch(() => '?'), at: new Date(this.time).toISOString(), db: snapshot, webStorage: web }, null, 1));
    }
    const entry = { name, step: this.currentStep, screenshot: file, db: dbFile, route: await this.route(page).catch(() => '?') };
    if (sweep) {
      try {
        const res = await page.evaluate(sweepInPage);
        const aria = await page.locator('body').ariaSnapshot({ timeout: 5000 }).catch(() => '');
        const unnamed = unnamedControls(aria).filter(l => !/"[^"]+"/.test(l));
        for (const u of unnamed) res.issues.push({ check: 'name', detail: `control without an accessible name: ${u}`, where: '' });
        for (const issue of res.issues) this.sweep.push({ ...issue, checkpoint: name, step: this.currentStep, route: entry.route, screenshot: file });
        entry.issues = res.issues.length;
      } catch (e) {
        this.sweep.push({ check: 'sweep', detail: `sweep could not run: ${String(e).slice(0, 160)}`, checkpoint: name, route: entry.route, screenshot: file });
      }
    }
    this.checkpoints.push(entry);
    return snapshot;
  }

  // ---------------------------------------------------------------- steps and assertions

  /**
   * A numbered step of the journey table. `input` describes what was entered,
   * for the failure record. After a failed step the rest of the case is
   * recorded as not run.
   */
  async step(n, title, fn, { input } = {}) {
    if (this.aborted) return false;
    this.currentStep = n;
    this.stepInput = input;
    this.stepTitle = title;
    this.stepDb = await this.db().catch(() => undefined);
    this.log(`  ${this.journey} ${this.project.id} ${this.name} · step ${n}: ${title}`);
    try {
      await fn();
      return true;
    } catch (e) {
      const message = e instanceof StepFailed ? e.message : `${e.message?.split('\n').slice(0, 3).join(' ') ?? e}`;
      await this.fail(message, { thrown: !(e instanceof StepFailed) });
      this.aborted = n;
      return false;
    }
  }

  /** Record a failure with its evidence. */
  async fail(message, { thrown = false, page = this.page } = {}) {
    const screenshot = page ? await this.shot(`FAIL-step-${this.currentStep}`, page) : undefined;
    const visible = page ? await this.visible(page) : '';
    let dbDiff = '';
    try { dbDiff = diffDb(this.stepDb, page ? await this.db(page) : undefined); } catch (e) { dbDiff = `(no database snapshot: ${String(e).slice(0, 80)})`; }
    this.failures.push({
      journey: this.journey, case: this.name, project: this.project.id, step: this.currentStep, stepTitle: this.stepTitle,
      input: this.stepInput, message, thrown, screenshot, visible, dbDiff,
      route: page ? await this.route(page).catch(() => '?') : '?',
    });
    this.log(`    FAIL ${this.journey} ${this.project.id} ${this.name} step ${this.currentStep}: ${message}`);
  }

  /** A soft assertion: recorded, and the step carries on. */
  async check(ok, message) {
    if (!ok) await this.fail(message);
    return !!ok;
  }

  /** A hard assertion: the step stops here. */
  async must(ok, message) {
    if (!ok) throw new StepFailed(message);
  }

  note(text) { this.notes.push({ step: this.currentStep, text }); }

  /**
   * A requirement that cannot be checked until an agreed app change lands
   * (the coordinator names it). Not a pass and not a failure: the report lists
   * it, and the step's other assertions still run.
   */
  pending(message) {
    this.pendingItems.push({ journey: this.journey, case: this.name, project: this.project.id, step: this.currentStep, stepTitle: this.stepTitle, message });
    this.log(`    PENDING ${this.journey} ${this.project.id} ${this.name} step ${this.currentStep}: ${message}`);
  }

  // ---------------------------------------------------------------- end

  async close() {
    // Console errors and off-origin requests are failures of their own.
    const allowed = text => this.allowed.some(p => (p instanceof RegExp ? p.test(text) : text.includes(p)));
    const stray = this.console.filter(c => !allowed(c.text));
    for (const c of stray) this.sweep.push({ check: 'console', detail: c.text.slice(0, 300), step: c.at, checkpoint: '(any)', route: '' });
    const offOrigin = this.requests.filter(r => !r.url.startsWith(this.origin) && !/^(data|blob|about|chrome-extension):/.test(r.url));
    for (const r of offOrigin) this.failures.push({ journey: this.journey, case: this.name, project: this.project.id, step: r.at, message: `request left the device: ${r.method} ${r.url}`, input: '', visible: '', dbDiff: '' });
    await this.context?.close().catch(() => {});
    return {
      journey: this.journey, case: this.name, project: this.project.id,
      status: this.failures.length ? 'fail' : this.pendingItems.length ? 'pending' : 'pass',
      failures: this.failures, pending: this.pendingItems, sweep: this.sweep, checkpoints: this.checkpoints, notes: this.notes,
      abortedAt: this.aborted, durationMs: Date.now() - this.started, dir: this.dir,
    };
  }
}

/**
 * Wait until the screen is at rest before it is measured: no finite animation
 * or transition running, no sheet still in its opening or closing style, and
 * no open sheet still fading in. A sheet's fade can start a frame after it
 * mounts, so rest must hold for three looks in a row (about 100 ms); one quiet
 * look is not enough (a contrast reading taken 90 ms into a fade is not the
 * sheet's colour).
 */
export async function settle(page) {
  await page.evaluate(() => { window.__accQuiet = 0; }).catch(() => {});
  try {
    await page.waitForFunction(() => {
      const busy = document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming?.().iterations !== Infinity);
      const moving = !!document.querySelector('[data-starting-style],[data-ending-style]');
      const dialog = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].find(d => d.getBoundingClientRect().height > 0);
      let fading = false;
      for (let n = dialog; n && n.nodeType === 1; n = n.parentElement) {
        if (Number(getComputedStyle(n).opacity) < 1) { fading = true; break; }
      }
      if (busy || moving || fading) { window.__accQuiet = 0; return false; }
      window.__accQuiet = (window.__accQuiet || 0) + 1;
      return window.__accQuiet >= 3;
    }, null, { timeout: 3000, polling: 50 });
  } catch { /* an endless animation is not a reason to stop */ }
  await page.waitForTimeout(120);
}

// ---------------------------------------------------------------- database helpers

export function docs(snapshot) {
  const out = {};
  for (const row of snapshot?.settings ?? []) out[row.key] = row.value;
  return out;
}

export function content(snapshot) {
  const out = {};
  for (const row of snapshot?.['content-state'] ?? []) out[row.key] = row.value;
  return out;
}

const brief = o => {
  const keep = ['kind', 'value', 'unit', 'scope', 'source', 'at', 'context', 'tag', 'day'];
  return JSON.stringify(Object.fromEntries(keep.filter(k => o?.[k] !== undefined).map(k => [k, o[k]])));
};

/** What changed between two snapshots, for a failure record. Ignores `revision` and `seq`. */
export function diffDb(before, after) {
  if (!before || !after) return '(no snapshot)';
  const lines = [];
  const byId = (rows, key = 'id') => new Map((rows ?? []).map(r => [r[key], r]));
  const strip = o => { if (!o || typeof o !== 'object') return o; const { seq, ...rest } = o; void seq; return rest; };
  for (const [store, key] of [['observations', 'id'], ['sessions', 'id'], ['settings', 'key'], ['content-state', 'key']]) {
    const a = byId(before[store], key);
    const b = byId(after[store], key);
    for (const [id, row] of b) {
      if (store === 'settings' && id === 'revision') continue;
      if (!a.has(id)) lines.push(`+ ${store} ${id} ${store === 'observations' ? brief(row) : JSON.stringify(row).slice(0, 200)}`);
      else if (JSON.stringify(strip(a.get(id))) !== JSON.stringify(strip(row))) lines.push(`~ ${store} ${id} ${store === 'observations' ? brief(row) : JSON.stringify(row?.value ?? row).slice(0, 300)}`);
    }
    for (const [id] of a) if (!b.has(id)) lines.push(`- ${store} ${id}`);
  }
  return lines.length ? lines.slice(0, 40).join('\n') : '(no database change)';
}
