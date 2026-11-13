/* 天気予報（iPad版） Service Worker
   - アプリ本体（index.html / manifest.json）はキャッシュしてオフラインでも開けるようにする
   - 天気データ（ウェザーニュース・国土地理院・OpenStreetMap等、他ドメイン）は
     Service Workerでは扱わず、常にネットワークから取得する（アプリ側にキャッシュ機能あり）
   - 更新時は新しいService Workerへ即時切り替えし、古いキャッシュを削除する
*/
const CACHE_NAME = 'wn-ipad-pwa-v20261112-20';
const CORE_FILES = ['./', './index.html', './manifest.json'];
const ICON_FILES = ['./icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_FILES);
    // アイコンは1つ失敗してもインストール全体を止めない
    await Promise.allSettled(ICON_FILES.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 他ドメイン（天気データ等）はそのままネットワークへ
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 画面遷移はネットワーク優先（常に最新版を取得し、失敗時のみキャッシュ）
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('./index.html');
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // 同一ドメインの静的ファイルは stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('offline', { status: 504, statusText: 'Offline' });
  })());
});
