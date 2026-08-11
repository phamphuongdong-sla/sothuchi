/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Service Worker
   Cache Version: so-thu-chi-v1
   ========================================================================== */

const CACHE_NAME = 'so-thu-chi-v1';

// Essential App Shell resources to precache upon installation
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

/* --------------------------------------------------------------------------
   1. Install Event
   - Precaches essential assets
   - Forces immediate activation via skipWaiting()
   -------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Install Event: Precaching App Shell assets');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Precache failed:', err);
      })
  );
});

/* --------------------------------------------------------------------------
   2. Activate Event
   - Purges outdated cache versions
   - Claims control of all open clients immediately
   -------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate Event: Cleaning old caches');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting obsolete cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

/* --------------------------------------------------------------------------
   3. Fetch Event
   - Intercepts HTTP/HTTPS GET requests
   - Implements Stale-While-Revalidate and Cache-First strategies
   - Bypasses non-GET and API requests (e.g. Google Apps Script)
   -------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (e.g., POST/PUT requests for GAS sync)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Skip unsupported schemes (e.g. chrome-extension://, file://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Bypass Service Worker cache for Google Apps Script Web App requests
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return; // Pass through directly to network
  }

  // 4. Handle Navigation Requests (SPA fallback to index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match('./index.html') || caches.match('index.html') || caches.match('./');
        })
    );
    return;
  }

  // 5. Strategy: Cache-First for External CDN Assets & Static Images/Icons
  if (url.hostname.includes('cdn.jsdelivr.net') || url.pathname.endsWith('.png') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. Strategy: Stale-While-Revalidate for local App Shell assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[SW] Fetch failed, relying on cache:', request.url, err);
        });

      // Return cached response immediately if present; fallback to network request promise
      return cachedResponse || fetchPromise;
    })
  );
});
