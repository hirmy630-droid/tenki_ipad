// Change VERSION for each published update.
const VERSION = '20261004-ff088d9abe25';
const PREFIX = 'kyowa-weather-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + VERSION;
const INDEX = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(INDEX, {cache: 'no-store'});
    if (!response.ok) throw new Error('index.html download failed');
    await cache.put(INDEX, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Weather APIs and external resources always use normal browser networking.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate' && (url.pathname === new URL(INDEX).pathname || url.pathname === new URL(self.registration.scope).pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, {cache: 'no-store'});
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(INDEX, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await (await caches.open(CACHE)).match(INDEX);
        if (cached) return cached;
        throw error;
      }
    })());
  }
});
