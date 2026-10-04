self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Manejo directo de peticiones para garantizar velocidad online
  e.respondWith(fetch(e.request).catch(() => new Response('Conexión requerida')));
});
