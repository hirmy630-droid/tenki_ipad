'use strict';
const VERSION = '20261005-123000';
const BASE = self.registration.scope;
const PREFIX = 'weather-pwa-' + encodeURIComponent(BASE) + '-';
const CACHE_NAME = PREFIX + VERSION;
const INDEX = new URL('index.html', BASE).href;
const MANIFEST = new URL('manifest.json', BASE).href;
function isAppDocument(url) {
  return url.origin === new URL(BASE).origin &&
    (url.pathname === new URL(BASE).pathname || url.pathname === new URL(INDEX).pathname);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(INDEX, { cache: 'no-store' });
    if (!response.ok) throw new Error('index.html download failed');
    const cache = await caches.open(CACHE_NAME);
    await cache.put(INDEX, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    const clients = await self.clients.matchAll({ type: 'window' });
    await self.clients.claim();
    await Promise.all(clients.filter(client => isAppDocument(new URL(client.url))).map(async client => {
      client.postMessage({ type: 'WEATHER_APP_UPDATED', version: VERSION });
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && isAppDocument(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (!response.ok) throw new Error('Document fetch failed');
        const cache = await caches.open(CACHE_NAME);
        await cache.put(INDEX, response.clone());
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(INDEX) || new Response('通信できません。接続を確認して再度開いてください。', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
  } else if (url.href === MANIFEST) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
  }
  // Weather APIs and other pages bypass this cache.
});
