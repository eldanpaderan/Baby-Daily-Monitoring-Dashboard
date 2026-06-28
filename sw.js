/* ============================================================
   sw.js — BabyLog Service Worker
   Strategy: Cache-first for assets, network-first for HTML
   Version: bump CACHE_NAME to force update on deploy
   ============================================================ */

const CACHE_NAME   = 'babylog-v1.0.0';
const OFFLINE_URL  = './index.html';

/* Assets to pre-cache on install */
const PRECACHE = [
  './index.html',
  './css/style.css',
  './js/utils.js',
  './js/storage.js',
  './js/charts.js',
  './js/statistics.js',
  './js/reminders.js',
  './js/sample-data.js',
  './js/export.js',
  './js/import.js',
  './js/app.js',
  './manifest.json',
  /* CDN resources cached at runtime on first load */
];

/* CDN origins to cache at runtime */
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ---- INSTALL ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

/* ---- ACTIVATE ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- FETCH ---- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and chrome-extension requests */
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  /* CDN resources: cache-first */
  if (CDN_ORIGINS.some(o => url.origin === new URL(o).origin)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Local app shell: network-first with offline fallback */
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
});

/* ---- STRATEGIES ---- */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource unavailable', { status: 503 });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    /* Fallback to app shell for navigation requests */
    if (request.mode === 'navigate') {
      const fallback = await caches.match(OFFLINE_URL);
      if (fallback) return fallback;
    }
    return new Response('You are offline. Please reconnect.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/* ---- BACKGROUND SYNC (future) ---- */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
