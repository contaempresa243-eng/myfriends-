const CACHE_NAME = 'myfriens-v6';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./', './index.html', './style.css', './app.js', './manifest.json']);
    })
  );
});

// Apaga caches de versões antigas para nunca mais ficar preso em ficheiros desatualizados
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
