const CACHE_NAME = 'wm-manager-v2';
const PRECACHE_URLS = [
  './',
  './inicio.html',
  './index.html',
  './calculadora.html',
  './visita_campo.html',
  './proyectos.html',
  './app.js',
  './logo.png',
  './manifest.json',
  './sw.js',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Navigation requests -> try network first, fallback to cached index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(resp => {
        // Update cache with latest index.html
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', resp.clone()));
        return resp;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(networkResp => {
      // Put a copy in cache for future
      caches.open(CACHE_NAME).then(cache => {
        try { cache.put(event.request, networkResp.clone()); } catch (e) { /* Some requests may be opaque */ }
      });
      return networkResp;
    }).catch(() => {
      // If request is an image and offline, try logo.png
      if (event.request.destination === 'image') return caches.match('./logo.png');
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }))
  );
});

// Permitir que la página le indique al SW que haga skipWaiting para activar nueva versión inmediatamente
self.addEventListener('message', event => {
  try {
    if (!event.data) return;
    if (event.data.action === 'skipWaiting') {
      self.skipWaiting();
    }
  } catch (e) { console.warn('SW message handler error', e); }
});