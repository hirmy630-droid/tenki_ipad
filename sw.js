// Update version whenever index.html changes. Scoped caches only.
'use strict';
const VERSION = '20261004-cb77d9d04771';
const ROOT = new URL(self.registration.scope);
const PREFIX = 'weather-pwa-' + encodeURIComponent(ROOT.pathname) + '-';
const CACHE = PREFIX + VERSION;
const INDEX = new URL('index.html', ROOT).href;
const MARKER = new URL('__pwa_update_marker__', ROOT).href;
function isApp(url) {
    return url.origin === ROOT.origin &&
        (url.pathname === ROOT.pathname || url.pathname === new URL(INDEX).pathname);
}
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const response = await fetch(INDEX, {cache:'no-store'});
        if (!response.ok) throw new Error('Cannot retrieve index.html');
        const cache = await caches.open(CACHE);
        await cache.put(INDEX, response);
        await cache.put(MARKER, new Response(self.registration.active ? 'update' : 'first'));
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        const marker = await cache.match(MARKER);
        const shouldRefresh = marker && (await marker.text()) === 'update';
        for (const name of await caches.keys()) {
            if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
        }
        await self.clients.claim();
        if (shouldRefresh) {
            const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
            await Promise.all(windows.map(async client => {
                const url = new URL(client.url);
                if (!isApp(url)) return;
                url.searchParams.set('v', VERSION);
                try {await client.navigate(url.href);} catch (_) {}
            }));
        }
    })());
});
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== ROOT.origin) return;
    if (isApp(url) && request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request, {cache:'no-store'});
                if (!response.ok) throw new Error('Navigation failed');
                const cache = await caches.open(CACHE);
                await cache.put(INDEX, response.clone());
                return response;
            } catch (error) {
                const cached = await (await caches.open(CACHE)).match(INDEX);
                if (cached) return cached;
                throw error;
            }
        })());
    }
});
