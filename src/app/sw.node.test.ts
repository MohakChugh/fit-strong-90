import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://example.test';
const BASE = '/fit-strong-90/';
const pathOf = (r: { url: string } | string) => (typeof r === 'string' ? new URL(r, ORIGIN).pathname : new URL(r.url).pathname);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** A release's files, as the build names them (P8S-15): each under a name that changes with its bytes, its own copy of index.html among them. */
function filesOf(build: string) {
  const tag = build.slice(0, 8);
  const names = {
    shell: `${BASE}shell-${build}.html`, main: `${BASE}assets/index-${tag}.js`, lazy: `${BASE}assets/WalkSummary-${tag}.js`,
    model: `${BASE}assets/coach-female-${tag}.bin`, icon: `${BASE}assets/apple-touch-icon-${tag}.png`,
  };
  const list = Object.values(names);
  return { names, list, bodies: new Map(list.map(u => [u, `${build} ${u}`] as const)) };
}
type Files = ReturnType<typeof filesOf>;

/** A same-origin response as a browser hands one to its worker: of type `basic`, which `new Response` in Node is not (P8S-17). */
const basic = (body: string, status = 200): Response => Object.defineProperty(new Response(body, { status }), 'type', { value: 'basic' });

/** The server: what it holds now, whether the phone can reach it, the HTTP cache in front of it, and a slow line a request can wait on. */
function network(files: Map<string, string>) {
  const net = {
    online: true,
    files,
    /** What the browser's HTTP cache still holds, by URL: handed back unless a request goes past it. */
    http: new Map<string, string>(),
    /** Every request: its path, and what it asked of the HTTP cache. */
    asked: [] as { path: string; cache?: string }[],
    holding: false,
    waiting: [] as (() => void)[],
    release() {
      net.holding = false;
      for (const go of net.waiting.splice(0)) go();
    },
    async fetch(r: { url: string; cache?: string } | string): Promise<Response> {
      const path = pathOf(r);
      const cache = typeof r === 'string' ? undefined : r.cache;
      net.asked.push({ path, ...(cache ? { cache } : {}) });
      if (net.holding) await new Promise<void>(resolve => net.waiting.push(resolve));
      if (!net.online) throw new TypeError('offline');
      const body = (cache === 'reload' ? undefined : net.http.get(path)) ?? net.files.get(path);
      return body === undefined ? basic('missing', 404) : basic(body);
    },
  };
  return net;
}
type Net = ReturnType<typeof network>;

/** One origin's Cache API: named caches; `addAll` stores every file or none, as the real one does; a cache deleted under an open handle is that handle's alone. */
function cacheStorage(net: Net) {
  const stores = new Map<string, Map<string, string>>();
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const rows = stores.get(name)!;
    return {
      async addAll(requests: ({ url: string; cache?: string } | string)[]) {
        const got: [string, string][] = [];
        for (const r of requests) {
          const res = await net.fetch(r);
          if (!res.ok) throw new TypeError(`${pathOf(r)}: ${res.status}`);
          got.push([pathOf(r), await res.text()]);
        }
        for (const [u, body] of got) rows.set(u, body);
      },
      async put(r: { url: string } | string, res: Response) { rows.set(pathOf(r), await res.text()); },
      async match(r: { url: string } | string) { const body = rows.get(pathOf(r)); return body === undefined ? undefined : new Response(body); },
      async keys() { return [...rows.keys()].map(u => ({ url: ORIGIN + u })); },
    };
  };
  return {
    stores,
    caches: {
      open: async (name: string) => cache(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
  };
}
type Store = ReturnType<typeof cacheStorage>;

const SOURCE = fs.readFileSync('public/sw.js', 'utf8');
type Window = { id: string; url: string };
const app = (id: string): Window => ({ id, url: `${ORIGIN}${BASE}#/home` });

/** public/sw.js as one release, numbered `number`: the test fires its events, as a browser does, and counts what it asked for. */
function release(build: string, number: number, files: Files, net: Net, store: Store, windows: Window[] = []) {
  const listeners = new Map<string, (event: unknown) => void>();
  const calls = { skipWaiting: 0, claim: 0 };
  const self = {
    location: new URL(`${ORIGIN}${BASE}sw.js`),
    addEventListener: (type: string, fn: (event: unknown) => void) => void listeners.set(type, fn),
    skipWaiting: () => { calls.skipWaiting += 1; return Promise.resolve(); },
    clients: {
      claim: () => { calls.claim += 1; return Promise.resolve(); },
      matchAll: async () => [...windows],
    },
  };
  const code = SOURCE.replace('[/* __PRECACHE__ */]', JSON.stringify(files.list))
    .replace("'__BUILD__'", JSON.stringify(build)).replace("'__NUMBER__'", JSON.stringify(String(number)));
  vm.runInNewContext(code, { self, caches: store.caches, fetch: (r: { url: string } | string) => net.fetch(r), URL, Request, Response, Headers });
  const fire = async (type: 'install' | 'activate' | 'message', extra: object = {}) => {
    const waits: Promise<unknown>[] = [];
    listeners.get(type)?.({ waitUntil: (p: Promise<unknown>) => void waits.push(p), ...extra });
    await Promise.all(waits);
  };
  /** A page's question, on a port of its own: the answer, or undefined when there is none. */
  const ask = async (type: string, from: Window) => {
    const answers: unknown[] = [];
    await fire('message', { data: { type }, source: from, ports: [{ postMessage: (m: unknown) => void answers.push(m) }] });
    return answers[0];
  };
  /** A request through the worker: its answer's body, or 'error'. */
  const get = async (path: string, mode: 'navigate' | 'no-cors' = 'no-cors') => {
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    const request = { url: ORIGIN + path, method: 'GET', mode, headers: new Headers() };
    listeners.get('fetch')?.({ request, respondWith: (p: Promise<Response>) => { answer = p; }, waitUntil: (p: Promise<unknown>) => void waits.push(p) });
    if (!answer) return undefined;
    const res = await answer.catch(() => Response.error());
    await Promise.all(waits);
    return res.type === 'error' ? 'error' : res.text();
  };
  return { calls, fire, ask, get, cache: `fitstrong-${number}-${build}`, windows };
}

/** Release `build`, numbered `number`, deployed, installed and active. */
async function active(build: string, number: number, net: Net, store: Store, windows: Window[] = []) {
  const files = filesOf(build);
  net.files = files.bodies;
  const r = release(build, number, files, net, store, windows);
  await r.fire('install');
  await r.fire('activate');
  return { ...r, files };
}

describe('the worker waits, and takes a page over by itself only as the first release on a device (J§21.2, D106, P8S-11)', () => {
  it('the first release takes over the page it was installed from; every later one waits; none skips waiting', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect(a.calls).toEqual({ skipWaiting: 0, claim: 1 });
    const b = await active('bbbbbbbbbbbb', 200, net, store);
    expect(b.calls).toEqual({ skipWaiting: 0, claim: 0 });
  });

  it('on a device v1’s worker served, the first of these releases takes nothing over', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await (await store.caches.open('fitstrong90-app-0123456789ab')).put(`${BASE}index.html`, basic('v1'));
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect(a.calls.claim).toBe(0);
  });

  it('says its release and FitStrong’s windows, and takes over at a restart only from FitStrong’s only window', async () => {
    const one = app('w1');
    const net = network(new Map());
    const store = cacheStorage(net);
    await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    const b = release('bbbbbbbbbbbb', 200, files, net, store, [one]);
    await b.fire('install');
    expect(await b.ask('windows', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 1, restarting: false });
    expect(b.calls.skipWaiting).toBe(0);
    // A second window of FitStrong: no takeover, and the count says why.
    b.windows.push(app('w2'));
    expect(await b.ask('restart', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 2, restarting: false });
    expect(b.calls.skipWaiting).toBe(0);
    // Another site on the same origin isn't FitStrong's.
    b.windows.splice(1, 1, { id: 'w3', url: `${ORIGIN}/another-site/` });
    expect(await b.ask('restart', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 1, restarting: true });
    expect(b.calls.skipWaiting).toBe(1);
    // Nothing else moves it.
    await b.fire('message', { data: { type: 'activate' }, source: one, ports: [] });
    await b.fire('message', { data: null, source: one, ports: [] });
    expect(b.calls.skipWaiting).toBe(1);
  });
});

describe('each release is whole, named by its bytes, and its windows’ own (J§21.2, D120, P8R-10, P8R-11, P8S-14, P8S-15)', () => {
  it('answers a navigation with its own copy of index.html, online, though the server now has a newer one', async () => {
    const net = network(new Map());
    const a = await active('aaaaaaaaaaaa', 100, net, cacheStorage(net));
    net.files = filesOf('bbbbbbbbbbbb').bodies;
    expect(await a.get(`${BASE}#/home`, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
    expect(await a.get(`${BASE}?from=home`, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
  });

  it('keeps every file of its own release, a model and a screen not yet loaded included, after a newer one installs, offline too', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    await b.fire('install');
    expect([...store.stores.keys()].sort()).toEqual([a.cache, b.cache].sort());
    net.online = false;
    expect(await a.get(a.files.names.model)).toBe(`aaaaaaaaaaaa ${a.files.names.model}`);
    expect(await a.get(a.files.names.lazy)).toBe(`aaaaaaaaaaaa ${a.files.names.lazy}`);
    expect(await a.get(BASE, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
    // The waiting release answers with its own, for the window it will run.
    expect(await b.get(BASE, 'navigate')).toBe(`bbbbbbbbbbbb ${files.names.shell}`);
  });

  it('fetches every file past the HTTP cache, so a stale copy there never becomes part of a release (P8S-15)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    // The browser's HTTP cache still holds another copy under the model's name.
    net.http.set(files.names.model, 'stale model');
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    await b.fire('install');
    expect(net.asked.filter(r => files.list.includes(r.path)).every(r => r.cache === 'reload')).toBe(true);
    net.online = false;
    expect(await b.get(files.names.model)).toBe(`bbbbbbbbbbbb ${files.names.model}`);
  });

  it('refuses an install the deploy moved on under, deletes its cache, and leaves the release in use as it was, offline too (P8S-15)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    net.holding = true;
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    const installing = b.fire('install');
    await settle();
    // The site moves on to the next deploy while B's install waits on the line: B's files are gone from it.
    net.files = filesOf('cccccccccccc').bodies;
    net.release();
    await expect(installing).rejects.toThrow(/404/);
    expect([...store.stores.keys()]).toEqual([a.cache]);
    net.online = false;
    expect(await a.get(a.files.names.lazy)).toBe(`aaaaaaaaaaaa ${a.files.names.lazy}`);
    expect(await a.get(BASE, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
  });

  it('lets only the releases before it go at its activation, never one installing after it, which then activates and serves offline (P8S-14)', async () => {
    const one = app('w1');
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const bFiles = filesOf('bbbbbbbbbbbb');
    net.files = bFiles.bodies;
    const b = release('bbbbbbbbbbbb', 200, bFiles, net, store, [one]);
    await b.fire('install');
    // C deployed, its install slow on the line, while B waits.
    const cFiles = filesOf('cccccccccccc');
    net.files = cFiles.bodies;
    net.holding = true;
    const c = release('cccccccccccc', 300, cFiles, net, store, [one]);
    const installing = c.fire('install');
    await settle();
    // FitStrong's only window restarts onto B: B activates, and only A, before it, goes.
    expect(await b.ask('restart', one)).toMatchObject({ restarting: true });
    expect(store.stores.has(a.cache)).toBe(true);
    await b.fire('activate');
    expect([...store.stores.keys()].sort()).toEqual([b.cache, c.cache].sort());
    net.release();
    await installing;
    await c.fire('activate');
    expect([...store.stores.keys()]).toEqual([c.cache]);
    net.online = false;
    expect(await c.get(cFiles.names.lazy)).toBe(`cccccccccccc ${cFiles.names.lazy}`);
    expect(await c.get(BASE, 'navigate')).toBe(`cccccccccccc ${cFiles.names.shell}`);
  });

  it('lets v1’s caches go at its activation, and keeps the voice clips', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await (await store.caches.open('fitstrong90-app-0123456789ab')).put(`${BASE}voice/en/old.mp3`, basic('old clip'));
    await (await store.caches.open('fitstrong90-voice')).put(`${BASE}voice/en/hello.mp3`, basic('clip'));
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect([...store.stores.keys()].sort()).toEqual([a.cache, 'fitstrong90-voice'].sort());
    expect([...store.stores.get('fitstrong90-voice')!.keys()].sort()).toEqual([`${BASE}voice/en/hello.mp3`, `${BASE}voice/en/old.mp3`]);
  });

  it('writes nothing at run time but the voice clips, which a real same-origin response lets it keep (P8S-17)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    net.files.set(`${BASE}assets/not-in-the-release.js`, 'stray');
    net.files.set(`${BASE}voice/en/hello.mp3`, 'clip');
    expect(await a.get(`${BASE}assets/not-in-the-release.js`)).toBe('stray');
    expect(await a.get(`${BASE}voice/en/hello.mp3`)).toBe('clip');
    await settle();
    expect([...store.stores.get(a.cache)!.keys()].sort()).toEqual([...a.files.list].sort());
    expect([...store.stores.get('fitstrong90-voice')!.keys()]).toEqual([`${BASE}voice/en/hello.mp3`]);
  });
});
