const CACHE_NAME = 'cacheFDM22-1.4.5';
const STATIC_ASSETS = [
  '/',
  '/index.php',
  '/music.php',
  '/roteiro.php',
  '/src/js/script.js',
  '/src/js/live.js',
  '/src/js/offline-tools.js',
  '/src/js/musicas.js',
  '/src/js/playlists.js',
  '/src/js/playlists_salvas.js',
  '/src/js/roteiros_salvos.js',
  '/src/js/roteiros.js',
  '/src/js/06215d6691.js',
  '/src/js/bootstrap.bundle.min.js',
  '/src/js/bootstrap.min.js',
  '/src/js/jquery-3.5.1.min.js',
  '/src/js/rehearsal/rehearsal.state.js',
  '/src/js/rehearsal/rehearsal.youtube.js',
  '/src/js/rehearsal/rehearsal.pitch.js',
  '/src/js/rehearsal/rehearsal.audio.js',
  '/src/js/rehearsal/rehearsal.ui.js',
  '/src/js/rehearsal/rehearsal.bootstrap.js',
  '/src/css/bootstrap.min.css',
  '/src/css/fontlogin.css',
  '/src/css/style2.css',
  '/src/css/rehearsal.css',
  '/manifest.json',
  '/favicon.ico',
  '/offline.php'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia Network First
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.method !== 'GET') return;

  const path = url.pathname;
  const ignoredPaths = ['livePlayerLer.php', 'editor.php', 'login.php', 'livePlayerSalvar.php', 'agenda'];
  if (ignoredPaths.some(p => path.endsWith(p))) return;
  if (path.startsWith('/api/live/')) return;
  if (path.startsWith('/src/backend/editor/')) return;

  const isMusicPage = path === '/music.php';
  const isIndexPage = path === '/' || path.endsWith('/index.php');
  const isRoteiroPage = path === '/roteiro.php';
  const isDataFile = path === '/src/js/musicas.js' || path === '/src/js/playlists_salvas.js' || path === '/src/js/roteiros_salvos.js';
  const coreData = ['/src/js/musicas.js', '/src/js/playlists.js', '/src/js/playlists_salvas.js', '/src/js/roteiros_salvos.js'];
  const isCoreData = coreData.includes(path);
  const assetExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'];
  const isAsset = assetExts.some(ext => path.endsWith(ext));

  if (isMusicPage && url.searchParams.has('id')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put('/music.php', networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request).then(cachedById => {
          if (cachedById) return cachedById;
          return caches.match('/music.php', { ignoreSearch: true }).then(basePage => {
            return basePage || caches.match('/offline.php');
          });
        });
      })
    );
    return;
  }

  if (isRoteiroPage && url.searchParams.has('id')) {
    event.respondWith(
      caches.match('/roteiro.php', { ignoreSearch: true }).then(response => {
        return response || fetch('/roteiro.php').then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put('/roteiro.php', networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  if (isDataFile) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  if (isCoreData || isAsset) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  if (isIndexPage || isMusicPage || isRoteiroPage) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          const cacheKey = isMusicPage ? '/music.php' : (isRoteiroPage ? '/roteiro.php' : event.request);
          cache.put(cacheKey, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        const cacheKey = isMusicPage ? '/music.php' : (isRoteiroPage ? '/roteiro.php' : event.request);
        return caches.match(cacheKey).then(cachedResponse => {
          return cachedResponse || caches.match('/offline.php');
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || caches.match('/offline.php');
        });
      })
  );
});



