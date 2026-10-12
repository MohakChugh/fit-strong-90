/**
 * Code that runs inside the page: the seed guard, the storage fault switch,
 * capability shims, and the read-only database inspector. Every function here
 * is serialised by Playwright, so it may use nothing from this module's scope.
 *
 * Test-owned state lives under keys starting `__acceptance:`, which the app's
 * Clear never touches (it removes only `fit-strong-90*`): the seed guard has
 * to survive Clear so an init script cannot quietly reseed erased records.
 */

/** Seed the v4 blob once per origin, before the first app script runs. */
export function seedInit({ blob, extra, guard }) {
  try {
    if (!location.pathname.startsWith('/fit-strong-90')) return;
    if (localStorage.getItem(guard) !== null) return;
    if (blob !== null) localStorage.setItem('fit-strong-90-data', blob);
    for (const [k, v] of Object.entries(extra ?? {})) localStorage.setItem(k, v);
    localStorage.setItem(guard, String(Date.now()));
  } catch {
    // A page with no storage (about:blank) has nothing to seed.
  }
}

/**
 * Storage faults, injected into the browser's IndexedDB API (never the app).
 *
 * Rules come from `localStorage['__acceptance:fault']` (survives reload) or
 * `window.__acc.fault` (this page only). A rule:
 *   { op: 'put'|'add'|'delete'|'clear'|'open', store?, match?: {field: value},
 *     action: 'quotaDom'|'quotaSafari'|'abortAfterQueue'|'throwUnknown', times? }
 * `abortAfterQueue` lets the request be queued (and succeed) and then aborts
 * the real readwrite transaction, so a successful `put` alone cannot pass for
 * a commit. Every injected error carries the marker `acceptance-injected`.
 */
export function faultInit() {
  if (window.__acc?.faultsInstalled) return;
  const acc = (window.__acc = window.__acc || {});
  acc.faultsInstalled = true;
  acc.faultLog = [];
  const KEY = '__acceptance:fault';
  const MARK = 'acceptance-injected';
  const proto = {
    open: IDBFactory.prototype.open,
    put: IDBObjectStore.prototype.put,
    add: IDBObjectStore.prototype.add,
    delete: IDBObjectStore.prototype.delete,
    clear: IDBObjectStore.prototype.clear,
  };
  acc.orig = proto;
  const rules = () => {
    const out = [];
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(stored)) out.push(...stored.map((r, i) => ({ ...r, _src: 'ls', _i: i })));
    } catch { /* unreadable: no stored rules */ }
    if (Array.isArray(acc.fault)) out.push(...acc.fault.map((r, i) => ({ ...r, _src: 'mem', _i: i })));
    return out;
  };
  const consume = rule => {
    if (rule.times === undefined) return;
    if (rule._src === 'mem') {
      acc.fault[rule._i].times -= 1;
      if (acc.fault[rule._i].times <= 0) acc.fault.splice(rule._i, 1);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
      stored[rule._i].times -= 1;
      const left = stored.filter(r => r.times === undefined || r.times > 0);
      if (left.length) localStorage.setItem(KEY, JSON.stringify(left));
      else localStorage.removeItem(KEY);
    } catch { /* nothing to consume */ }
  };
  const fits = (rule, op, store, value) => {
    if (rule.op !== op) return false;
    if (rule.store && rule.store !== store) return false;
    for (const [k, v] of Object.entries(rule.match ?? {})) {
      const actual = value && typeof value === 'object' ? value[k] : undefined;
      if (Array.isArray(v) ? !v.includes(actual) : actual !== v) return false;
    }
    return true;
  };
  const errorFor = action => {
    if (action === 'quotaDom') return new DOMException(`The quota has been exceeded (${MARK}).`, 'QuotaExceededError');
    if (action === 'quotaSafari') {
      // What Safari threw: a plain object carrying the legacy code, not an Error.
      return { name: 'QuotaExceededError', code: 22, message: `QuotaExceededError: DOM Exception 22 (${MARK})` };
    }
    return new DOMException(`The operation failed (${MARK}).`, 'UnknownError');
  };
  const wrap = op => function (...args) {
    const value = op === 'put' || op === 'add' ? args[0] : op === 'delete' ? { key: args[0] } : {};
    const rule = rules().find(r => fits(r, op, this.name, value));
    if (!rule) return proto[op].apply(this, args);
    consume(rule);
    acc.faultLog.push({ op, store: this.name, action: rule.action, id: value?.id ?? value?.key, at: Date.now() });
    if (rule.action === 'abortAfterQueue') {
      const req = proto[op].apply(this, args);
      const tx = this.transaction;
      req.addEventListener('success', () => { try { tx.abort(); } catch { /* already finished */ } });
      return req;
    }
    throw errorFor(rule.action);
  };
  IDBObjectStore.prototype.put = wrap('put');
  IDBObjectStore.prototype.add = wrap('add');
  IDBObjectStore.prototype.delete = wrap('delete');
  IDBObjectStore.prototype.clear = wrap('clear');
  IDBFactory.prototype.open = function (...args) {
    const rule = rules().find(r => r.op === 'open' && (!r.match?.name || r.match.name === args[0]));
    if (rule) {
      consume(rule);
      acc.faultLog.push({ op: 'open', action: rule.action, at: Date.now() });
      throw errorFor(rule.action);
    }
    return proto.open.apply(this, args);
  };
}

/**
 * Permission and sensor requests, counted (J01 step 1, J10 step 2), with a
 * geolocation that the test drives: `grant` | `deny` | `prompt-deny`.
 * Positions are stamped with the page's (frozen, test-driven) clock.
 */
export function sensorInit({ geo = 'deny' } = {}) {
  if (window.__acc?.sensorsInstalled) return;
  const acc = (window.__acc = window.__acc || {});
  acc.sensorsInstalled = true;
  const calls = (acc.calls = { geolocation: 0, permissionsQuery: [], notification: 0, motion: 0, wakeLock: 0 });
  const g = (acc.geo = { mode: geo, watchers: new Map(), nextId: 1, last: undefined });
  const denied = () => ({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'User denied Geolocation' });
  const position = p => ({
    coords: {
      latitude: p.lat, longitude: p.lon, accuracy: p.accuracy ?? 3, altitude: null, altitudeAccuracy: null,
      heading: null, speed: p.speed ?? null, toJSON() { return { ...this }; },
    },
    timestamp: p.timestamp ?? Date.now(),
    toJSON() { return { coords: this.coords, timestamp: this.timestamp }; },
  });
  const geoApi = {
    getCurrentPosition(ok, err) {
      calls.geolocation += 1;
      setTimeout(() => {
        if (g.mode === 'grant' && g.last) ok(position(g.last));
        else if (g.mode === 'grant') err?.({ code: 3, TIMEOUT: 3, message: 'Timeout' });
        else err?.(denied());
      }, 0);
    },
    watchPosition(ok, err) {
      calls.geolocation += 1;
      const id = g.nextId++;
      if (g.mode === 'grant') g.watchers.set(id, { ok, err });
      else setTimeout(() => err?.(denied()), 0);
      return id;
    },
    clearWatch(id) { g.watchers.delete(id); },
  };
  try { Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => geoApi }); } catch { /* keep the real one */ }
  /** Deliver a fix to every active watcher (the test calls this). */
  acc.emitPosition = p => {
    g.last = p;
    for (const w of g.watchers.values()) w.ok(position(p));
    return g.watchers.size;
  };
  if (navigator.permissions?.query) {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = desc => {
      calls.permissionsQuery.push(desc?.name);
      if (desc?.name === 'geolocation') {
        const state = g.mode === 'grant' ? 'granted' : g.mode === 'deny' ? 'denied' : 'prompt';
        return Promise.resolve({ state, name: 'geolocation', onchange: null, addEventListener() {}, removeEventListener() {} });
      }
      return query(desc);
    };
  }
  if (window.Notification) {
    const req = Notification.requestPermission?.bind(Notification);
    Notification.requestPermission = (...a) => { calls.notification += 1; return req ? req(...a) : Promise.resolve('default'); };
  }
  if (navigator.storage?.persist) {
    const persist = navigator.storage.persist.bind(navigator.storage);
    calls.persist = 0;
    navigator.storage.persist = () => { calls.persist += 1; return persist(); };
  }
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (this === window && (type === 'devicemotion' || type === 'deviceorientation')) calls.motion += 1;
    return add.call(this, type, ...rest);
  };
}

/** A document visibility the test can flip, which changes the getters *and* fires the event (J11). */
export function visibilityInit() {
  if (window.__acc?.visibilityInstalled) return;
  const acc = (window.__acc = window.__acc || {});
  acc.visibilityInstalled = true;
  let state = 'visible';
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => state === 'hidden' });
  acc.setVisibility = next => {
    state = next;
    document.dispatchEvent(new Event('visibilitychange'));
    if (next === 'hidden') window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    else window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    return document.visibilityState;
  };
}

/** Capabilities a journey takes away (Wake Lock, voice, compression, sharing) or records (the app badge). */
export function capabilityInit(opts) {
  if (opts.badge === 'record') {
    // An installed iOS web app has the Badging API; this Chromium does not. Record what the app asks for.
    window.__acc = window.__acc || {};
    window.__acc.badge = [];
    navigator.setAppBadge = n => { window.__acc.badge.push(n ?? 'dot'); return Promise.resolve(); };
    navigator.clearAppBadge = () => { window.__acc.badge.push(0); return Promise.resolve(); };
  }
  if (opts.wakeLock === 'absent') {
    try { Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => undefined }); } catch { /* ignore */ }
  }
  if (opts.wakeLock === 'reject' && navigator.wakeLock) {
    navigator.wakeLock.request = () => Promise.reject(new DOMException('Wake Lock permission request denied', 'NotAllowedError'));
  }
  if (opts.speech === 'absent') {
    try { delete window.speechSynthesis; } catch { /* ignore */ }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => undefined }); } catch { /* ignore */ }
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, get: () => undefined }); } catch { /* ignore */ }
  }
  if (opts.compression === 'absent') {
    try { delete window.CompressionStream; delete window.DecompressionStream; } catch { /* ignore */ }
    try { Object.defineProperty(window, 'CompressionStream', { configurable: true, value: undefined }); } catch { /* ignore */ }
    try { Object.defineProperty(window, 'DecompressionStream', { configurable: true, value: undefined }); } catch { /* ignore */ }
  }
  if (opts.share === 'absent') {
    try { Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined }); } catch { /* ignore */ }
    try { Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined }); } catch { /* ignore */ }
  }
  if (opts.share === 'cannot') {
    navigator.share = () => Promise.reject(new DOMException('Sharing files is not supported', 'NotAllowedError'));
    navigator.canShare = () => false;
  }
  if (opts.share === 'cancel') {
    window.__acc = window.__acc || {};
    window.__acc.shares = [];
    navigator.canShare = () => true;
    navigator.share = data => { window.__acc.shares.push({ files: (data?.files ?? []).map(f => f.name) }); return Promise.reject(new DOMException('Share canceled', 'AbortError')); };
  }
  if (opts.share === 'capture') {
    window.__acc = window.__acc || {};
    window.__acc.shares = [];
    navigator.canShare = () => true;
    navigator.share = async data => {
      const files = [];
      for (const f of data?.files ?? []) files.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
      window.__acc.shares.push({ files });
    };
  }
}

/**
 * The whole record, read in one readonly transaction over every store, then
 * closed (spec "Database assertions"). It never creates the database: a
 * missing one aborts its own upgrade, and it closes on a version change so it
 * cannot block the app's own open.
 */
export async function readDatabase() {
  const open = window.__acc?.orig?.open ?? IDBFactory.prototype.open;
  try {
    const list = indexedDB.databases ? await indexedDB.databases() : null;
    if (list && !list.some(d => d.name === 'fit-strong')) return { exists: false };
  } catch { /* fall through and try to open */ }
  return new Promise(resolve => {
    let req;
    try { req = open.call(indexedDB, 'fit-strong'); } catch (e) { resolve({ exists: false, error: String(e) }); return; }
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { /* ignore */ } };
    req.onblocked = () => resolve({ exists: true, error: 'blocked' });
    req.onerror = ev => { ev.preventDefault?.(); resolve({ exists: false, error: req.error?.name }); };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      const names = [...db.objectStoreNames];
      const out = { exists: true, version: db.version, storeNames: names };
      if (!names.length) { db.close(); resolve(out); return; }
      const tx = db.transaction(names, 'readonly');
      for (const n of names) {
        const r = tx.objectStore(n).getAll();
        r.onsuccess = () => { out[n] = r.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onabort = () => { db.close(); resolve({ ...out, error: String(tx.error) }); };
    };
  });
}

/** Every key the page holds in web storage, for privacy and leftover checks. */
export function readWebStorage() {
  const dump = s => {
    const out = {};
    try { for (let i = 0; i < s.length; i++) { const k = s.key(i); out[k] = s.getItem(k); } } catch { /* blocked */ }
    return out;
  };
  return { local: dump(localStorage), session: dump(sessionStorage) };
}
