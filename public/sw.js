// Offline app shell and static-file cache. Health data lives in localStorage
// and never passes through here; only the app's own static files are cached.
const CACHE = 'fitstrong90-v2';
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'apple-touch-icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg']
  .map((f) => BASE + f);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Only complete same-origin 200s: a 206 (partial audio) or an opaque response can't be cached safely.
function keep(request, response) {
  if (response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

const fromCache = (request) => caches.match(request).then((hit) => hit || Response.error());

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Range requests (audio playback and seeking) go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // Network first so updates arrive; offline falls back to the cached shell.
    event.respondWith(
      fetch(request).then((res) => keep(request, res))
        .catch(() => caches.match(request).then((hit) => hit || fromCache(BASE + 'index.html')))
    );
    return;
  }

  if (url.pathname.startsWith(BASE + 'voice/')) {
    // Voice clips and manifests: network first (a re-rendered pack replaces old clips), cache for offline.
    event.respondWith(fetch(request).then((res) => keep(request, res)).catch(() => fromCache(request)));
    return;
  }

  // Everything else (hashed JS/CSS, icons, models): cached copy now, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => keep(request, res));
      if (!cached) return network;
      event.waitUntil(network.catch(() => {}));
      return cached;
    })
  );
});
