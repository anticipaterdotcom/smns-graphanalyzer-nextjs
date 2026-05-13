// Service worker for the SMNS Graph Analyzer PWA.
//
// Strategy:
//   - Precache the app shell and known static assets on install.
//   - On fetch: respond from cache when possible; otherwise hit the network,
//     stash a copy of any successful same-origin GET into the runtime cache.
//   - Skip POST/non-GET (those are user actions; never appropriate to cache).
//   - For navigation requests (HTML), fall back to the cached "/" when the
//     network is unavailable -- that keeps the SPA loadable offline.
//
// The cache name is versioned so a future SW deploy can clean old assets.

const VERSION = 'v1';
const APP_CACHE = `smns-app-${VERSION}`;
const RUNTIME_CACHE = `smns-runtime-${VERSION}`;

// Files that must be in the cache before we go offline. Next.js' static export
// puts JS/CSS under /_next/static, but we cannot enumerate them at install
// time -- they'll be picked up by the runtime cache on first navigation.
const SHELL = [
  './',
  './manifest.webmanifest',
  './anticipater-logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    try { await cache.addAll(SHELL); } catch (e) { console.warn('[sw] shell precache failed', e); }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== APP_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Sentry tunnel, analytics, and the optional Python backend are
  // network-only; failing closed offline is correct (they're not the
  // app shell).
  if (
    url.pathname.startsWith('/monitoring') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Navigations: prefer fresh network when possible, fall back to cache
  // and finally to the root shell.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        const shell = await caches.match('./');
        if (shell) return shell;
        return new Response('Offline and the app shell is not in the cache yet.', { status: 503 });
      }
    })());
    return;
  }

  // Static assets and same-origin GETs: cache-first.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      // Last-ditch: if this is a JS/CSS module the page won't render at all,
      // so we just rethrow rather than serve broken content.
      throw err;
    }
  })());
});
