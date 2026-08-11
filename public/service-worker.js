// SW_BASE é injetado pelo service-worker.php (valor de APP_BASE).
// Em dev local sem o PHP, cai para ''.
const _BASE = (typeof SW_BASE !== 'undefined' ? SW_BASE : '').replace(/\/$/, '');

const CACHE_PREFIX = 'cifro-';
const APP_VERSION = '0.0.1';
const STATIC_CACHE = `${CACHE_PREFIX}static-${APP_VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}pages-${APP_VERSION}`;
const META_CACHE = `${CACHE_PREFIX}meta`;
const CONTEXT_KEY = '/__cifro_context__';
const PREPARE_KEY_PREFIX = '/__cifro_prepare__/';
const SONG_MANIFEST_PREFIX = '/__cifro_songs__/';
const activePreparations = new Map();
const STATIC_ASSETS = [
  _BASE + '/offline.php', _BASE + '/src/js/script.js', _BASE + '/src/js/chords.js', _BASE + '/src/js/live.js', _BASE + '/src/js/offline-tools.js',
  _BASE + '/src/js/playlists.js', _BASE + '/src/js/playlist-share.js', _BASE + '/src/js/roteiros.js', _BASE + '/src/js/cifro-sync.js', _BASE + '/src/js/cifro-sanitize.js', _BASE + '/src/js/cifro-theme.js',
  _BASE + '/src/js/cifro-connectivity.js',
  _BASE + '/src/js/cifro-csrf.js', _BASE + '/src/js/cifro-confirm.js', _BASE + '/src/js/cifro-toast.js', _BASE + '/src/js/cifro-presentation.js',
  _BASE + '/src/js/bootstrap.min.js', _BASE + '/src/js/jquery-3.5.1.min.js', _BASE + '/src/js/music-view.js',
  _BASE + '/src/js/rehearsal/rehearsal.state.js', _BASE + '/src/js/rehearsal/rehearsal.youtube.js',
  _BASE + '/src/js/rehearsal/rehearsal.pitch.js', _BASE + '/src/js/rehearsal/rehearsal.audio.js',
  _BASE + '/src/js/rehearsal/rehearsal.ui.js', _BASE + '/src/js/rehearsal/rehearsal.bootstrap.js',
  _BASE + '/src/vendor/wavesurfer/wavesurfer.min.js', _BASE + '/src/vendor/soundtouch/soundtouch.min.js',
  _BASE + '/src/css/bootstrap.min.css', _BASE + '/src/css/fontlogin.css', _BASE + '/src/css/style2.css',
  _BASE + '/src/css/rehearsal.css', _BASE + '/src/css/music-view.css', _BASE + '/src/css/theme.css', _BASE + '/src/css/fonts.css',
  _BASE + '/manifest.json', _BASE + '/favicon.ico', _BASE + '/src/images/cifro-mark.svg', _BASE + '/src/images/cifro-logo.svg',
  _BASE + '/src/images/cifro-logo-dark.svg', _BASE + '/src/images/cifro-app-icon.svg'
];
const STAGE_PAGES = [_BASE + '/index.php', _BASE + '/music.php', _BASE + '/roteiro.php', _BASE + '/select-banda.php'];

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

// Cache key is the URL path+query. No user context in key — avoids the
// chicken-and-egg problem where context is lost after SW restart.
function pageKey(path) {
  return path;
}

async function populateStatic(cache, onProgress) {
  for (const url of STATIC_ASSETS) {
    if (await cache.match(url)) {
      await onProgress?.('assets', url);
      continue;
    }
    const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
    const expected = url.endsWith('.css') ? 'text/css' : url.endsWith('.js') ? 'javascript' : url.endsWith('.php') ? 'text/html' : null;
    if (!validAsset(response, expected)) throw new Error('Asset inválido: ' + url);
    await cache.put(url, response);
    await onProgress?.('assets', url);
  }
}

function prepareKey(userId, bandId) {
  return PREPARE_KEY_PREFIX + encodeURIComponent(String(userId)) + '/' + encodeURIComponent(String(bandId));
}

function songManifestKey(userId, bandId) {
  return SONG_MANIFEST_PREFIX + encodeURIComponent(String(userId)) + '/' + encodeURIComponent(String(bandId));
}

async function readMeta(key) {
  const response = await (await caches.open(META_CACHE)).match(key);
  if (!response) return null;
  try { return await response.json(); } catch { return null; }
}

async function writeMeta(key, value) {
  return (await caches.open(META_CACHE)).put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

async function preparePages(userId, bandId, songs = [], onProgress) {
  if (!userId || !bandId) throw new Error('Usuário ou banda não identificados');
  songs = songs.map(song => (typeof song === 'object' && song !== null) ? song : { id: song, token: '' });
  const cache = await caches.open(PAGE_CACHE);
  const manifestKey = songManifestKey(userId, bandId);
  const previousManifest = await readMeta(manifestKey) || {};
  const nextManifest = {};
  const basePages = [_BASE + '/index.php', _BASE + '/music.php', _BASE + '/roteiro.php', _BASE + '/select-banda.php'];
  for (const path of basePages) {
    if (await cache.match(pageKey(path))) {
      await onProgress?.('paginas', path);
      continue;
    }
    const response = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
    if (!(await validStagePage(response))) throw new Error('Página inválida: ' + path);
    await cache.put(pageKey(path), response);
    await onProgress?.('paginas', path);
  }
  for (const song of songs) {
    const id = String(song.id);
    const token = String(song.token || '');
    const path = _BASE + `/music.php?id=${encodeURIComponent(id)}`;
    nextManifest[id] = token;
    await onProgress?.('musicas', path);
  }
  for (const id of Object.keys(previousManifest)) {
    await cache.delete(pageKey(_BASE + `/music.php?id=${encodeURIComponent(id)}`));
  }
  await writeMeta(manifestKey, nextManifest);
}

function notifyPreparation(preparation, message) {
  preparation.status = { ...preparation.status, ...message, version: APP_VERSION };
  for (const port of preparation.ports) {
    try { port.postMessage(preparation.status); } catch {}
  }
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'OFFLINE_PREPARE_STATUS', ...preparation.status }));
  });
}

function startPreparation(data, port) {
  const userId = String(data.userId || '');
  const bandId = String(data.bandId || '');
  const revision = Number(data.contentRevision || 0);
  const songs = Array.isArray(data.songs)
    ? data.songs
    : (Array.isArray(data.songIds) ? data.songIds.map(id => ({ id, token: '' })) : []);
  const key = `${userId}:${bandId}:${revision}:${APP_VERSION}`;
  const existing = activePreparations.get(key);
  if (existing) {
    if (port) existing.ports.add(port);
    if (port) port.postMessage(existing.status);
    return existing.promise;
  }
  const preparation = {
    ports: new Set(port ? [port] : []),
    status: { type: 'progress', state: 'running', userId, bandId, contentRevision: revision, completed: 0, total: STATIC_ASSETS.length + 4 + songs.length }
  };
  const stateKey = prepareKey(userId, bandId);
  preparation.promise = (async () => {
    const saved = await readMeta(stateKey);
    if (saved?.state === 'completed' && Number(saved.contentRevision) === revision && saved.version === APP_VERSION) {
      notifyPreparation(preparation, { ...saved, type: 'complete', ok: true });
      return saved;
    }
    await writeMeta(stateKey, preparation.status);
    let completed = 0;
    const onProgress = async (phase, current) => {
      completed += 1;
      const status = { type: 'progress', state: 'running', phase, current, completed, total: preparation.status.total, userId, bandId, contentRevision: revision, version: APP_VERSION };
      notifyPreparation(preparation, status);
      await writeMeta(stateKey, status);
    };
    try {
      await setContext(userId, bandId);
      await populateStatic(await caches.open(STATIC_CACHE), onProgress);
      await preparePages(userId, bandId, songs, onProgress);
      const status = { type: 'complete', state: 'completed', ok: true, completed: preparation.status.total, total: preparation.status.total, userId, bandId, contentRevision: revision, version: APP_VERSION, finishedAt: Date.now() };
      await writeMeta(stateKey, status);
      notifyPreparation(preparation, status);
      return status;
    } catch (error) {
      const status = { type: 'complete', state: 'failed', ok: false, error: error.message, completed, total: preparation.status.total, userId, bandId, contentRevision: revision, version: APP_VERSION };
      await writeMeta(stateKey, status);
      notifyPreparation(preparation, status);
      throw error;
    }
  })().finally(() => activePreparations.delete(key));
  activePreparations.set(key, preparation);
  return preparation.promise;
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

async function cacheOpenClients() {
  const clients = await self.clients.matchAll({ type: 'window' });
  const cache = await caches.open(PAGE_CACHE);
  for (const client of clients) {
    try {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin) continue;
      const isStage = url.pathname === _BASE + '/' || url.pathname === _BASE || STAGE_PAGES.includes(url.pathname);
      if (!isStage) continue;
      const path = url.pathname + url.search;
      const genericMusic = url.pathname === _BASE + '/music.php' ? _BASE + '/music.php' : null;
      if (await cache.match(pageKey(path)) || (genericMusic && await cache.match(pageKey(genericMusic)))) continue;
      const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin' });
      if (await validStagePage(response)) await cache.put(pageKey(path), response);
    } catch {}
  }
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: APP_VERSION });
  if (event.data?.type === 'SET_CONTEXT') {
    event.waitUntil(
      setContext(event.data.userId, event.data.bandId)
        .then(() => { event.ports[0]?.postMessage({ ok: true }); })
        .then(() => cacheOpenClients())
    );
  }
  if (event.data?.type === 'CLEAR_CONTEXT') event.waitUntil(setContext(null, null));
  if (event.data?.type === 'GET_PREPARE_STATUS') {
    event.waitUntil(readMeta(prepareKey(event.data.userId, event.data.bandId)).then(status => event.ports[0]?.postMessage(status || { state: 'idle' })));
  }
  if (event.data?.type === 'PREPARE_OFFLINE') {
    event.waitUntil(startPreparation(event.data, event.ports[0]).catch(() => {}));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith(_BASE + '/api/')
    || url.pathname.startsWith(_BASE + '/src/backend/')
    || url.pathname === _BASE + '/service-worker.php'
    || url.pathname === _BASE + '/health.php'
    || url.pathname === _BASE + '/ready.php'
  ) return;
  if (url.pathname === _BASE + '/' || url.pathname === _BASE || STAGE_PAGES.includes(url.pathname)) {
    const requestedPath = (url.pathname === _BASE + '/' || url.pathname === _BASE)
      ? _BASE + '/index.php'
      : url.pathname + url.search;
    event.respondWith(stagePage(event, request, requestedPath));
    return;
  }
  event.respondWith(staticFirst(event, request, url.pathname));
});

async function stagePage(event, request, path) {
  const cache = await caches.open(PAGE_CACHE);
  const isMusicPage = path.startsWith(_BASE + '/music.php?');
  const cached = await cache.match(pageKey(path)) || (isMusicPage ? await cache.match(pageKey(_BASE + '/music.php')) : null);

  if (cached) {
    if (isMusicPage) return cached;
    event.waitUntil((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(request, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        if (await validStagePage(response)) await cache.put(pageKey(path), response);
      } catch { clearTimeout(timeout); }
    })());
    return cached;
  }

  // Cache miss: try network with short timeout. On failure serve offline.php.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    if (await validStagePage(response)) {
      await cache.put(pageKey(isMusicPage ? _BASE + '/music.php' : path), response.clone());
    }
    return response;
  } catch {
    clearTimeout(timeout);
    return await caches.match(_BASE + '/offline.php') || new Response('Offline', { status: 503 });
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
