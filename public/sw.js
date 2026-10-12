// Offline app shell and static-file cache (J§21.2; board D106, D120). Health
// data lives in IndexedDB and never passes through here; only the app's own
// static files are cached.

// Filled in at build (vite.config.ts): PRECACHE, every file of this release,
// each under a name that changes with its bytes, the 3D models and the icons
// included, and this release's own copy of index.html, `shell-<BUILD>.html`;
// BUILD, a hash of all their bytes and of this worker's code; and NUMBER,
// this release's place in order, higher for every later release (P8S-14,
// P8S-15).
const PRECACHE = [/* __PRECACHE__ */];
const BUILD = '__BUILD__';
const NUMBER = Number('__NUMBER__');
const CACHE = `fitstrong-${NUMBER}-${BUILD}`;
// v1's caches, and the voice clips', which outlive releases: they're large, and
// only change when a pack is re-rendered, which network-first picks up.
const V1 = 'fitstrong90-';
const MEDIA = `${V1}voice`;
const BASE = new URL('./', self.location).pathname;
const SHELL = `${BASE}shell-${BUILD}.html`;
/** A release cache's place in order, or undefined for any other cache. */
const numberOf = (name) => {
  const m = /^fitstrong-(\d+)-/.exec(name);
  return m ? Number(m[1]) : undefined;
};

// A release is cached whole or not at all, every file fetched afresh past the
// HTTP cache: `addAll` stores nothing if any file fails, and the empty cache it
// began is deleted, so a failed install leaves the release in use as it was.
// Each file's name changes with its bytes, so a deploy that moves on under a
// slow install can only make a file missing, never another release's (P8S-15).
// Then it waits, as every service worker does, until no window still runs the
// release before it: the next time FitStrong opens. It never skips waiting by
// itself (D106).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(new URL(url, self.location.href), { cache: 'reload' }))))
    .catch(async (error) => {
      await caches.delete(CACHE);
      throw error;
    }));
});

// A page asks two things, each answered on the port it sends. 'windows': this
// release, and how many windows of FitStrong are open, the asking one
// included. 'restart' (Home's "Restart to update"): take over now, which a
// waiting worker does only while the asking window is FitStrong's only one;
// that page then reloads once. Nothing else makes it take over.
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  const port = event.ports && event.ports[0];
  if ((type !== 'windows' && type !== 'restart') || !port) return;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The origin may hold other sites: only this app's windows count.
    const windows = all.filter((w) => new URL(w.url).pathname.startsWith(BASE));
    const alone = windows.length === 1 && !!event.source && windows[0].id === event.source.id;
    const restarting = type === 'restart' && alone;
    if (restarting) await self.skipWaiting();
    port.postMessage({ build: BUILD, windows: windows.length, restarting });
  })());
});

// Voice clips cached by v1's worker (one shared cache) move to the voice
// cache, so an update doesn't silently drop the offline coach.
async function keepVoice(from) {
  const [old, media] = await Promise.all([caches.open(from), caches.open(MEDIA)]);
  for (const request of await old.keys()) {
    if (!new URL(request.url).pathname.startsWith(BASE + 'voice/')) continue;
    const hit = await old.match(request);
    if (hit) await media.put(request, hit);
  }
}

// Activation comes only once no window runs the release before it, or when
// FitStrong's only window asked to restart and is reloading. Only the releases
// before this one go, by their place in order: never one installing or waiting
// behind it (P8S-14). v1's go too, their voice clips kept. The very first
// release on a device, with none before it, takes over the page it was
// installed from, so no window of FitStrong is ever left uncontrolled for a
// later release to slip past (P8S-11); every later release waits.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const v1 = keys.filter((k) => k.startsWith(V1) && k !== MEDIA);
    for (const k of v1) await keepVoice(k);
    const before = keys.filter((k) => v1.includes(k) || (numberOf(k) !== undefined && numberOf(k) < NUMBER));
    await Promise.all(before.map((k) => caches.delete(k)));
    if (before.length === 0) await self.clients.claim();
  })());
});

// Only complete same-origin 200s: a 206 (partial audio) or an opaque response can't be cached safely.
function keep(cacheName, request, response) {
  if (response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// Matched by URL alone: a `Vary: Origin` reply would otherwise miss for module
// scripts, which Chrome requests with an Origin header. Only ever this
// release's own cache: a window runs the release whose worker controls it, and
// reads that release's files, its shell and models included (P8R-10).
const OPTS = { ignoreVary: true };
const own = async (request, name = CACHE) => (await caches.open(name)).match(request, OPTS);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Range requests (audio playback and seeking) go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // This release's own copy of index.html, online or not: a newer release
    // reaches a window by installing and waiting, never through a navigation.
    event.respondWith(own(SHELL).then((hit) => hit || fetch(request)));
    return;
  }

  if (url.pathname.startsWith(BASE + 'voice/')) {
    // Voice clips and manifests: network first (a re-rendered pack replaces old clips), cache for offline.
    event.respondWith(fetch(request).then((res) => keep(MEDIA, request, res))
      .catch(() => own(request, MEDIA).then((hit) => hit || Response.error())));
    return;
  }

  // Everything else: this release's copy, else the network, and nothing written.
  event.respondWith(own(request).then((hit) => hit || fetch(request)));
});
