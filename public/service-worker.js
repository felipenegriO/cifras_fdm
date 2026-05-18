const CACHE_NAME = 'cacheFDM22-1.4.7';
const DAILY_KEY  = 'fdm-daily-refresh';   // key stored inside the cache itself

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
  '/src/css/theme.css',
  '/src/css/fonts.css',
  '/src/js/fdm-theme.js',
  '/src/js/fdm-csrf.js',
  '/src/js/fdm-confirm.js',
  '/src/js/fdm-toast.js',
  '/src/js/fdm-presentation.js',
  '/manifest.json',
  '/favicon.ico',
  '/offline.php'
];

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getLastRefreshDate() {
  const cache = await caches.open(CACHE_NAME);
  const res   = await cache.match(DAILY_KEY);
  return res ? await res.text() : null;
}

async function setLastRefreshDate(date) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(DAILY_KEY, new Response(date, { headers: { 'Content-Type': 'text/plain' } }));
}

async function clearAndPrecache() {
  // Delete every existing cache
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));

  // Re-precache static assets
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
  await setLastRefreshDate(todayStr());
}

// ─── install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  // Remove old-named caches (version bumps)
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── message from page ───────────────────────────────────────────────────────
// The client page sends { type: 'ONLINE' } when it detects connectivity restored.
// We refresh the cache in the background without blocking navigation.

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ONLINE') {
    // Background refresh: don't block the sender
    clearAndPrecache().catch(() => {/* ignore – offline again */});
  }

  if (event.data && event.data.type === 'DAILY_CHECK') {
    getLastRefreshDate().then(last => {
      if (last !== todayStr()) {
        return clearAndPrecache();
      }
    }).catch(() => {});
  }
});

// ─── fetch ───────────────────────────────────────────────────────────────────

const IGNORED_PATHS = [
  'livePlayerLer.php', 'editor.php', 'login.php', 'livePlayerSalvar.php',
  'agenda', 'editoruser.php', 'salvar_user.php'
];

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.method !== 'GET') return;

  const path = url.pathname;
  if (IGNORED_PATHS.some(p => path.endsWith(p))) return;
  if (path.startsWith('/api/live/')) return;
  if (path.startsWith('/src/backend/editor/')) return;
  if (path.startsWith('/src/backend/users/')) return;

  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url  = new URL(request.url);
  const path = url.pathname;

  // Normalise music/roteiro cache keys (strip query string for page shell)
  const isMusicPage   = path === '/music.php';
  const isRoteiroPage = path === '/roteiro.php';
  const cacheKey      = isMusicPage   ? '/music.php'
                      : isRoteiroPage ? '/roteiro.php'
                      : request;

  if (navigator.onLine !== false) {
    // ── ONLINE: network-first, always update cache ───────────────────────────
    try {
      const networkRes = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(cacheKey, networkRes.clone()); // fire-and-forget update
      return networkRes;
    } catch {
      // Network failed even though we thought we were online → fall through to cache
    }
  }

  // ── OFFLINE (or network error): cache-only, no expiry ────────────────────
  const cached = await caches.match(cacheKey);
  if (cached) return cached;

  // Fallback for music/roteiro pages when not individually cached
  if (isMusicPage || isRoteiroPage) {
    const shell = await caches.match(isMusicPage ? '/music.php' : '/roteiro.php', { ignoreSearch: true });
    if (shell) return shell;
  }

  return caches.match('/offline.php') || new Response('Offline', { status: 503 });
}
