const CACHE_NAME = 'bingo-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/components.css',
  '/css/responsive.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/config.js',
  '/js/card-manager.js',
  '/js/ui-manager.js',
  '/assets/images/logo.png',
  '/assets/images/background-pattern.png',
  '/assets/sounds/bingo.mp3',
  '/assets/sounds/card-select.mp3',
  '/assets/sounds/number-drawn.mp3',
  '/assets/sounds/win.mp3',
  '/assets/sounds/button-click.mp3'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch Events
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Listen for messages
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
