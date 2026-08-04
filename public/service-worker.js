const CACHE_PREFIX = 'cifro-';
const APP_VERSION = '0.0.1';
const STATIC_CACHE = `${CACHE_PREFIX}static-${APP_VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}pages`;
const META_CACHE = `${CACHE_PREFIX}meta`;
const CONTEXT_KEY = '/__cifro_context__';
const STATIC_ASSETS = [
  '/offline.php', '/src/js/script.js', '/src/js/chords.js', '/src/js/live.js', '/src/js/offline-tools.js',
  '/src/js/playlists.js', '/src/js/roteiros.js', '/src/js/cifro-sync.js', '/src/js/cifro-sanitize.js', '/src/js/cifro-theme.js',
  '/src/js/cifro-connectivity.js',
  '/src/js/cifro-csrf.js', '/src/js/cifro-confirm.js', '/src/js/cifro-toast.js', '/src/js/cifro-presentation.js',
  '/src/js/bootstrap.min.js', '/src/js/jquery-3.5.1.min.js', '/src/js/music-view.js',
  '/src/js/rehearsal/rehearsal.state.js', '/src/js/rehearsal/rehearsal.youtube.js',
  '/src/js/rehearsal/rehearsal.pitch.js', '/src/js/rehearsal/rehearsal.audio.js',
  '/src/js/rehearsal/rehearsal.ui.js', '/src/js/rehearsal/rehearsal.bootstrap.js',
  '/src/vendor/wavesurfer/wavesurfer.min.js', '/src/vendor/soundtouch/soundtouch.min.js',
  '/src/css/bootstrap.min.css', '/src/css/fontlogin.css', '/src/css/style2.css',
  '/src/css/rehearsal.css', '/src/css/music-view.css', '/src/css/theme.css', '/src/css/fonts.css',
  '/manifest.json', '/favicon.ico', '/src/images/cifro-mark.svg', '/src/images/cifro-logo.svg',
  '/src/images/cifro-logo-dark.svg', '/src/images/cifro-app-icon.svg'
];
const STAGE_PAGES = ['/index.php', '/music.php', '/roteiro.php', '/select-banda.php'];

function validAsset(response, expectedType) {
  if (!response?.ok || response.redirected) return false;
  const type = response.headers.get('content-type') || '';
  return expectedType ? type.includes(expectedType) : !type.includes('text/html');
}

async function validStagePage(response) {
  if (!validAsset(response, 'text/html')) return false;
  const html = await response.clone().text();
  return (html.includes('CIFRO_USER_ID') || html.includes('CIFRO_USER_ID')) && !html.includes('id="loginForm"');
}

async function setContext(userId, bandId) {
  const cache = await caches.open(META_CACHE);
  if (!userId) return cache.delete(CONTEXT_KEY);
  return cache.put(CONTEXT_KEY, new Response(JSON.stringify({ userId: String(userId), bandId: String(bandId || '') }), { headers: { 'Content-Type': 'application/json' } }));
}

async function getContext() {
  const response = await (await caches.open(META_CACHE)).match(CONTEXT_KEY);
  if (!response) return null;
  try {
    const context = await response.json();
    return context.userId ? context : null;
  } catch { return null; }
}

function pageKey(path, context) {
  return `/__cifro_page__?path=${encodeURIComponent(path)}&user=${encodeURIComponent(context.userId)}&band=${encodeURIComponent(context.bandId || '')}`;
}

async function populateStatic(cache) {
  for (const url of STATIC_ASSETS) {
    const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
    const expected = url.endsWith('.css') ? 'text/css' : url.endsWith('.js') ? 'javascript' : url.endsWith('.php') ? 'text/html' : null;
    if (!validAsset(response, expected)) throw new Error('Asset inválido: ' + url);
    await cache.put(url, response);
  }
}

async function preparePages(userId, bandId, songIds = []) {
  if (!userId || !bandId) throw new Error('Usuário ou banda não identificados');
  const context = { userId: String(userId), bandId: String(bandId) };
  const cache = await caches.open(PAGE_CACHE);
  const pages = ['/index.php', '/roteiro.php', '/select-banda.php', ...songIds.map(id => `/music.php?id=${encodeURIComponent(id)}`)];
  for (const path of pages) {
    const response = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
    if (!(await validStagePage(response))) throw new Error('Página inválida: ' + path);
    await cache.put(pageKey(path, context), response);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(populateStatic));
});

self.addEventListener('activate', event => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE, META_CACHE]);
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && !keep.has(key)).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'SET_CONTEXT') event.waitUntil(setContext(event.data.userId, event.data.bandId).then(() => event.ports[0]?.postMessage({ ok: true })));
  if (event.data?.type === 'CLEAR_CONTEXT') event.waitUntil(setContext(null, null));
  if (event.data?.type === 'PREPARE_OFFLINE') {
    const userId = event.data.userId;
    event.waitUntil(Promise.all([
      setContext(userId, event.data.bandId),
      caches.open(STATIC_CACHE).then(populateStatic),
      preparePages(userId, event.data.bandId, Array.isArray(event.data.songIds) ? event.data.songIds : []),
    ]).then(
      () => event.ports[0]?.postMessage({ ok: true, version: APP_VERSION }),
      error => event.ports[0]?.postMessage({ ok: false, error: error.message })
    ));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/src/backend/')) return;
  if (url.pathname === '/' || STAGE_PAGES.includes(url.pathname)) {
    const requestedPath = url.pathname === '/' ? '/index.php' : url.pathname + url.search;
    event.respondWith(stagePage(event, request, requestedPath));
    return;
  }
  event.respondWith(staticFirst(event, request, url.pathname));
});

async function stagePage(event, request, path) {
  const context = await getContext();
  const cached = context ? await (await caches.open(PAGE_CACHE)).match(pageKey(path, context)) : null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: 'no-store' });
    const authenticated = await validStagePage(response);
    if (authenticated) {
      if (context) await (await caches.open(PAGE_CACHE)).put(pageKey(path, context), response.clone());
      return response;
    }
    const responsePath = new URL(response.url).pathname;
    if (response.status === 401 || response.status === 403 || ['/login.php', '/landing.php'].includes(responsePath)) return response;
    if (cached) return cached;
    return response;
  } catch {
    if (cached) return cached;
    return await caches.match('/offline.php') || new Response('Offline', { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}

async function staticFirst(event, request, path) {
  const cached = await (await caches.open(STATIC_CACHE)).match(path);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (validAsset(response)) {
      const cacheResponse = response.clone();
      event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.put(path, cacheResponse)));
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}
