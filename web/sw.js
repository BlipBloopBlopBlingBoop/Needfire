/* Service worker: keep the app shell available even if the server restarts
   or the client briefly drops. API calls always go to the network (live data).

   Strategy:
   - navigations: network-first, fall back to the cached /index.html
   - shell assets: stale-while-revalidate, so UI updates ship on next load
   Bump CACHE whenever any shell file changes — old caches are deleted on
   activate. */
const CACHE = 'needfire-shell-v7';
const SHELL = [
  '/', '/index.html',
  '/css/tokens.css', '/css/shell.css', '/css/library.css',
  '/css/emergency.css', '/css/toolkit.css', '/css/system.css', '/css/studio.css',
  '/assets/icons.js', '/assets/logo.svg',
  '/assets/icon-192.png', '/assets/icon-512.png', '/assets/icon-maskable-512.png',
  '/js/api.js', '/js/prefs.js', '/js/components.js', '/js/markdown.js',
  '/js/instruments.js', '/js/views.js', '/js/emergency.js', '/js/tools.js',
  '/js/system.js', '/js/models.js', '/js/content.js', '/js/studio.js', '/js/app.js',
  '/data/protocols.json',
  '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // per-URL add: one missing asset must not break the whole install
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // never cache the API

  if (e.request.mode === 'navigate') {
    // network-first so a fresh deploy is picked up; cached shell if offline
    e.respondWith(
      fetch(e.request).then((resp) => {
        caches.open(CACHE).then((c) => c.put('/index.html', resp.clone())).catch(() => {});
        return resp;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // assets: serve from cache immediately, refresh the cache in the background
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const refresh = fetch(e.request).then((resp) => {
        if (resp.ok) caches.open(CACHE).then((c) => c.put(e.request, resp.clone())).catch(() => {});
        return resp;
      });
      // no index.html fallback here: a failed CSS/JS fetch must fail, not
      // silently return HTML with the wrong MIME type
      return hit || refresh;
    })
  );
});
