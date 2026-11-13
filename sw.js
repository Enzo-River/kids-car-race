// 小车大冒险 Service Worker：离线可玩
const CACHE = 'car-race-v61';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面导航：有缓存先秒开，同时后台拉新；内容变了再通知页面更新
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html');
      if (!cached) {
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put('./index.html', res.clone()).catch(() => {});
          return res;
        } catch (err) {
          return (await caches.match('./')) || Response.error();
        }
      }
      fetch(req).then(async (res) => {
        if (!res || !res.ok) return;
        const oldTag = cached.headers.get('etag');
        const newTag = res.headers.get('etag');
        await cache.put('./index.html', res.clone());
        if (oldTag && newTag && oldTag !== newTag) {
          const list = await self.clients.matchAll({ type: 'window' });
          list.forEach((c) => c.postMessage({ type: 'content-updated' }));
        }
      }).catch(() => {});
      return cached;
    })());
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
