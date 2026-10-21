// Offline support.
// - Page loads: network first (so updates arrive on the next open), cached copy when offline or slow.
// - Other files (hashed JS/CSS, sprites, fonts): cache first, refreshed in the background.
// - The Claude API and other origins are never cached.
const CACHE = 'roadtrip-rpg-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './sprites/dungeon.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await Promise.race([fetch(req), timeout(4000)]);
          if (res && res.ok) cache.put('./index.html', res.clone());
          return res;
        } catch {
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
