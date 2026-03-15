const CACHE_NAME = 'charsos-pwa-v1';
const SHELL_URLS = [
  '/pwa/index.html',
  '/pwa/styles/app.css',
  '/pwa/scripts/app.js',
  '/pwa/scripts/api.js',
  '/pwa/scripts/ui.js',
  '/pwa/scripts/utils.js',
  '/pwa/manifest.json',
  '/pwa/assets/images/char-sos-logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(SHELL_URLS.map(url => cache.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls and uploads: network only
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
