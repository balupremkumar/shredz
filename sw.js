const VERSION = '0.1.0'; // Must match APP_VERSION in src/version.js; enforced by tests.
const CACHE = 'macro-diary-' + VERSION;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './fonts/schibsted-grotesk-latin.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './src/actions.js',
  './src/app.js',
  './src/backup.js',
  './src/diary.js',
  './src/format.js',
  './src/insights.js',
  './src/parser.js',
  './src/pwa.js',
  './src/store.js',
  './src/version.js',
  './src/ui/diary.js',
  './src/ui/dictate.js',
  './src/ui/dom.js',
  './src/ui/foods.js',
  './src/ui/settings.js',
  './src/ui/weight.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async url => {
      const request = new Request(url, { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Precache failed: ${url}`);
      await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('macro-diary-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html')) || fetch(request);
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
