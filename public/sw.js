// Offline app shell and static-file cache. Health data lives in localStorage
// and never passes through here; only the app's own static files are cached.

// Filled in at build (vite.config.ts): every hashed asset and the 3D models, so
// an installed app opens any screen offline, not only the ones it loaded online.
const PRECACHE = [/* __PRECACHE__ */];
const BUILD = '__BUILD__';
const PREFIX = 'fitstrong90-';
// App files belong to one build; voice clips outlive builds (they're large and
// only change when a pack is re-rendered, which network-first picks up).
const CACHE = `${PREFIX}app-${BUILD}`;
const MEDIA = `${PREFIX}voice`;
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'apple-touch-icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg']
  .map((f) => BASE + f);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SHELL, ...PRECACHE])));
  self.skipWaiting();
});

// Voice clips cached by an older worker (one shared cache) move to the voice
// cache, so an update doesn't silently drop the offline coach.
async function keepVoice(from) {
  const [old, media] = await Promise.all([caches.open(from), caches.open(MEDIA)]);
  for (const request of await old.keys()) {
    if (!new URL(request.url).pathname.startsWith(BASE + 'voice/')) continue;
    const hit = await old.match(request);
    if (hit) await media.put(request, hit);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys(); // in the order they were created
    const legacy = keys.filter((k) => k.startsWith(PREFIX) && !k.startsWith(`${PREFIX}app-`) && k !== MEDIA);
    for (const k of legacy) await keepVoice(k);
    // Keep the newest previous build too: a page still open on it can load its
    // remaining screens. Anything older goes.
    const older = keys.filter((k) => (k.startsWith(`${PREFIX}app-`) || legacy.includes(k)) && k !== CACHE);
    const previous = older[older.length - 1];
    await Promise.all(older.filter((k) => k !== previous).map((k) => caches.delete(k)));
  })());
  self.clients.claim();
});

// Only complete same-origin 200s: a 206 (partial audio) or an opaque response can't be cached safely.
function keep(cacheName, request, response) {
  if (response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// Cached files are matched by URL alone: hashed assets never change under one
// name, and a `Vary: Origin` reply would otherwise miss for module scripts,
// which Chrome requests with an Origin header. The preferred cache (this
// build's, or the voice cache) answers first: `caches.match` alone would search
// in creation order and hand an older build's index.html or model back. Kept
// older caches only fill in, for a page still running the previous build.
const OPTS = { ignoreVary: true };
const match = async (request, first = CACHE) => (await (await caches.open(first)).match(request, OPTS)) || caches.match(request, OPTS);
const fromCache = (request, first) => match(request, first).then((hit) => hit || Response.error());

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Range requests (audio playback and seeking) go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // Network first so updates arrive; offline falls back to the cached shell.
    event.respondWith(
      fetch(request).then((res) => keep(CACHE, request, res))
        .catch(() => match(request).then((hit) => hit || fromCache(BASE + 'index.html')))
    );
    return;
  }

  if (url.pathname.startsWith(BASE + 'voice/')) {
    // Voice clips and manifests: network first (a re-rendered pack replaces old clips), cache for offline.
    event.respondWith(fetch(request).then((res) => keep(MEDIA, request, res)).catch(() => fromCache(request, MEDIA)));
    return;
  }

  // Everything else (hashed JS/CSS, icons, models): cached copy now, refresh in the background.
  event.respondWith(
    match(request).then((cached) => {
      const network = fetch(request).then((res) => keep(CACHE, request, res));
      if (!cached) return network;
      event.waitUntil(network.catch(() => {}));
      return cached;
    })
  );
});
