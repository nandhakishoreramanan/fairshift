/* FairShift Service Worker - Network-first for fresh updates, cache-fallback for offline */
const CACHE_NAME = 'fairshift-v4';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/worker.html',
  '/admin.html',
  '/passport.html',
  '/css/app.css?v=4',
  '/js/common.js?v=4',
  '/js/i18n.js?v=4',
  '/js/index.js?v=4',
  '/js/worker.js?v=4',
  '/js/admin.js?v=4',
  '/js/passport.js?v=4',
  '/js/vendor/jsQR.js',
  '/js/scanner.js?v=4',
  '/icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  // Activate immediately
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  // Purge ALL older caches immediately
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-only for API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-FIRST strategy: Always try to get freshest copy from server first.
  // Only fall back to cache when offline!
  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const toCache = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
        }
        return networkRes;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
