const CACHE_NAME = 'swingsense-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker caching files...');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker cache failed:', error);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip caching for authentication-related requests
  if (event.request.url.includes('/manifest.json') || 
      event.request.url.includes('/auth/') ||
      event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker serving from cache:', event.request.url);
          return response;
        }
        
        return fetch(event.request).catch((error) => {
          console.error('Service Worker fetch failed:', error);
          return new Response('Network error occurred', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});