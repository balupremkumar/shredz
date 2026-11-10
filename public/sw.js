// Shredz v3 interim worker. Its only job is to retire the v2 worker and its cached files,
// so a phone that had v2 installed loads v3 from the network. The offline worker arrives in wave 4.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.clients.claim();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
