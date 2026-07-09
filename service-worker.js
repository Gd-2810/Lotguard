// LotGuard Service Worker v2
// Strategy:
//   index.html      → network-first (always get latest app code)
//   manifest.json   → cache-first (rarely changes)
//   icon-512.png    → cache-first (never changes)
// This ensures drivers always get the latest version of the app
// while still supporting offline use for the timer.

const CACHE_NAME = 'lotguard-v9';
const CACHE_FIRST_ASSETS = [
    '/manifest.json',
    '/icon-512.png'
];

// Install: cache static assets only (not index.html)
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CACHE_FIRST_ASSETS);
        })
    );
    // Activate immediately — don't wait for old service worker to finish
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
    // Take control of all open tabs immediately
    self.clients.claim();
});

// Fetch: network-first for index.html, cache-first for assets
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);

    // Only handle same-origin requests
    // Never intercept Supabase API calls or translation API calls
    if (url.origin !== self.location.origin) {
        return;
    }

    // Network-first for index.html
    // Always try to get the latest version from the network
    // Fall back to cache only if network is unavailable
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request)
                .then(function(networkResponse) {
                    // Got a fresh response — cache it and return it
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    // Network failed — serve from cache as fallback
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache-first for static assets (manifest, icon)
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then(function(response) {
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