// LotGuard Service Worker v3
// Self-clearing on activation to fix persistent Safari cache issues
// index.html: network-first (always fresh)
// Static assets: cache-first

const CACHE_NAME = 'lotguard-v9';
const STATIC_ASSETS = [
    '/manifest.json',
    '/icon-512.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.map(function(key) {
                    // Delete ALL old caches regardless of name
                    if (key !== CACHE_NAME) {
                        console.log('LotGuard SW: Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(function() {
            // Take control of all tabs immediately
            return self.clients.claim();
        }).then(function() {
            // Tell all open tabs to reload so they get the new version
            return self.clients.matchAll({ type: 'window' }).then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({ type: 'SW_ACTIVATED' });
                });
            });
        })
    );
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);

    // Never intercept external requests (Supabase, MyMemory API, CDN)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Network-first for HTML — always get latest app code
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(function(response) {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(function() {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) return cached;
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