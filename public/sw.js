/**
 * KaamMilega service worker — offline shell.
 *
 * Deliberately conservative: the app shell is precached, static assets are
 * cache-first, and everything else is network-first with a cache fallback.
 * Firebase and auth traffic is never cached — stale auth state is worse than
 * no auth state.
 */

const VERSION = 'v3';
const SHELL_CACHE = `km-shell-${VERSION}`;
const ASSET_CACHE = `km-assets-${VERSION}`;

// Precache the prerendered routes so a first offline visit to any of them
// works, not just the home page.
const SHELL = [
  '/',
  '/workers',
  '/jobs',
  '/about',
  '/privacy',
  '/terms',
  '/site.webmanifest',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll rejects the whole install if any single URL 404s, so add
      // individually and tolerate misses.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Hosts whose responses must never be cached. */
const NEVER_CACHE = [
  'googleapis.com',
  'firebaseio.com',
  'firebaseinstallations',
  'identitytoolkit',
  'securetoken',
  'google.com/recaptcha',
];

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only for caching decisions; let everything else pass through.
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((host) => url.href.includes(host))) return;

  // Navigation requests: network-first so a deploy is picked up immediately,
  // falling back to cache when offline.
  //
  // Each route is cached under its OWN url. The build prerenders /, /workers,
  // /jobs, /about, /privacy and /terms into distinct HTML files with different
  // titles and canonicals — caching them all under one '/index.html' key would
  // mean that after visiting /about, an offline load of / serves the About
  // page. Falling back to '/' (the app shell) only happens when the requested
  // route has never been visited; the SPA router then renders the right view.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request, { ignoreSearch: true });
          if (exact) return exact;
          const shell = await caches.match('/');
          if (shell) return shell;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<div style="font-family:system-ui;padding:2rem;max-width:34rem;margin:auto">' +
              '<h1>You are offline</h1><p>This page has not been saved for offline use. ' +
              'Reconnect and try again.</p></div>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }),
    );
    return;
  }

  // Hashed build assets are immutable: cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else: network-first, cache fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
