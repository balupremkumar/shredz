// Imported by the generated service worker. Removes the caches the v2 worker left behind (named macro-diary-*).
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('macro-diary-')).map(name => caches.delete(name)))));
});
