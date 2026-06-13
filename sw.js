/* Vaqueros Performance OS — Service Worker */
var CACHE = 'vq-os-v1';
var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: precache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(APP_SHELL).catch(function() { /* tolerate misses */ });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// Fetch strategy:
//  - Supabase / API calls: always network (data must be fresh), no caching.
//  - Navigations: network-first, fall back to cached index.html when offline.
//  - Other GET assets (fonts, CDN libs, logo): cache-first, then network + cache.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Never cache Supabase or other API traffic
  if (url.hostname.indexOf('supabase') !== -1) {
    return; // default: go to network
  }

  // Navigation requests -> network first, offline fallback to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function() {
        return caches.match('/index.html').then(function(r) {
          return r || caches.match('/');
        });
      })
    );
    return;
  }

  // Static assets -> cache first
  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function() {
        return cached;
      });
    })
  );
});
