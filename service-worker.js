// LotGuard Service Worker
// Cache-first strategy for all app assets
// Ensures the app loads instantly and works offline

const CACHE_NAME = 'lotguard-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return key !== CACHE_NAME;
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
self.addEventListener('fetch', function(event) {
    // Only cache same-origin requests — never cache Supabase API calls
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then(function(response) {
                // Cache valid responses for app assets only
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});