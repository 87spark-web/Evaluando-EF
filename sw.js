/**
 * Service Worker — Evaluando Educación Física v3
 * 
 * Estrategia:
 * - Network-First para HTML (asegura actualizaciones de seguridad rápidas)
 * - Cache-First con actualización en background para CDN assets
 * - Network-Only para APIs de Google
 */

const CACHE_NAME = 'evaluando-ef-v3';

const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js'
];

/* ── INSTALL: cachea todos los recursos del shell ── */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

/* ── ACTIVATE: limpia caches antiguas ── */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

/* ── FETCH: Network-First para HTML, Cache-First para assets, Network-Only para Google ── */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Google APIs siempre van a la red
    if (url.hostname === 'www.googleapis.com' ||
        url.hostname === 'accounts.google.com' ||
        url.hostname === 'oauth2.googleapis.com') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'offline', message: 'Sin conexión a Internet' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // HTML pages: Network-First (para actualizaciones de seguridad rápidas)
    if (event.request.mode === 'navigate' ||
        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                return caches.match(event.request).then((cached) => cached || caches.match('./index.html'));
            })
        );
        return;
    }

    // Todo lo demás (CSS, JS, fonts): Cache-First con actualización en background
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || networkFetch;
        })
    );
});

