const CACHE_NAME = 'streamflow-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/globals.css',
  '/manifest.json'
];

// Installation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes (Network-first with local fallback)
self.addEventListener('fetch', (e) => {
  // Ignorer les requêtes d'API externes (AllDebrid, TMDB, Firebase)
  if (
    e.request.url.includes('api.alldebrid.com') ||
    e.request.url.includes('api.themoviedb.org') ||
    e.request.url.includes('firebase') ||
    e.request.url.includes('firestore')
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Mettre à jour le cache si la réponse est valide
        if (res && res.status === 200 && e.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, resClone);
          });
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cachedRes) => cachedRes))
  );
});
