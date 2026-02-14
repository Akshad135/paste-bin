const CACHE_NAME = 'pastebin-v4';
const STATIC_ASSETS = [
    '/',
    '/icon.svg',
    '/icon-maskable.svg',
    '/favicon.svg',
];

// Install — pre-cache shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch — strategy depends on request type
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET
    if (request.method !== 'GET') return;

    // API requests — skip SW caching entirely.
    // Offline caching for paste data is handled by IndexedDB in the app layer,
    // which filters out private pastes.
    if (url.pathname.startsWith('/api')) {
        return;
    }

    // Navigation requests — network-first, fallback to cached shell
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match('/'))
        );
        return;
    }

    // Static assets — cache first, fallback to network
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ||
                fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
        )
    );
});
