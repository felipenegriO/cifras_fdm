const cifroSync = (() => {
    const DB_NAME = 'cifro';
    const DB_VERSION = 6;
    const DATA_STORES = ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta'];
    const SNAPSHOT_STORES = ['cifro_snapshot_current', 'cifro_snapshot_previous'];
    const ALL_STORES = [...DATA_STORES, ...SNAPSHOT_STORES, 'cifro_bandas'];
    const inFlight = new Map();
    const locallyUpdated = new Set();
    const lastChecks = new Map();
    const CHECK_INTERVAL = 30000;
    const REQUEST_TIMEOUT = 8000;

    window.songs = Array.isArray(window.songs) ? window.songs : [];
    window.playlistsSalvas = Array.isArray(window.playlistsSalvas) ? window.playlistsSalvas : [];
    window.roteirosSalvos = Array.isArray(window.roteirosSalvos) ? window.roteirosSalvos : [];
    window.categorias = Array.isArray(window.categorias) ? window.categorias : [];
    function storageKey(bandaId) {
        return String(window.CIFRO_USER_ID || 'anonymous') + ':' + String(bandaId);
    }
    function offlineBandStorageKey() {
        return 'cifroOfflineBandId:' + String(window.CIFRO_USER_ID || 'anonymous');
    }
    function pendingBandStorageKey() {
        return 'cifroPendingBandId:' + String(window.CIFRO_USER_ID || 'anonymous');
    }
    const offlineBand = localStorage.getItem(offlineBandStorageKey());
    const pendingBand = localStorage.getItem(pendingBandStorageKey());
    if (offlineBand || pendingBand) window.CIFRO_BAND_ID = offlineBand || pendingBand;

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = event => {
                const db = event.target.result;
                ALL_STORES.forEach(name => {
                    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'banda_id' });
                });
            };
            req.onsuccess = event => resolve(event.target.result);
            req.onerror = event => reject(event.target.error);
        });
    }

    async function idbGet(storeName, bandaId) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(storageKey(bandaId));
            req.onsuccess = event => resolve(event.target.result ?? null);
            req.onerror = event => reject(event.target.error);
            tx.oncomplete = () => db.close();
        });
    }

    async function readSnapshotRows(bandaId) {
        const stores = ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta'];
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(stores, 'readonly');
            const rows = {};
            const key = storageKey(bandaId);
            stores.forEach(storeName => {
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => { rows[storeName] = req.result || null; };
            });
            tx.oncomplete = () => { db.close(); resolve(rows); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function writeSnapshot(bandaId, json) {
        validateSnapshot(bandaId, json);
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([...DATA_STORES, ...SNAPSHOT_STORES], 'readwrite');
            const revision = Number(json.content_revision || 0);
            const key = storageKey(bandaId);
            const currentStore = tx.objectStore('cifro_snapshot_current');
            const previousStore = tx.objectStore('cifro_snapshot_previous');
            const currentRequest = currentStore.get(key);
            currentRequest.onsuccess = () => {
                if (currentRequest.result) previousStore.put(currentRequest.result);
                currentStore.put({
                    banda_id: key,
                    actual_band_id: bandaId,
                    content_revision: revision,
                    saved_at: Date.now(),
                    data: {
                        musicas: json.musicas,
                        playlists: json.playlists,
                        roteiros: json.roteiros,
                        categorias: json.categorias,
                        plano: json.plano ?? null,
                        trial_expira_em: json.trial_expira_em ?? null
                    }
                });
            };
            tx.objectStore('cifro_musicas').put({ banda_id: key, actual_band_id: bandaId, data: json.musicas ?? [], content_revision: revision });
            tx.objectStore('cifro_playlists').put({ banda_id: key, actual_band_id: bandaId, data: json.playlists ?? [], content_revision: revision });
            tx.objectStore('cifro_roteiros').put({ banda_id: key, actual_band_id: bandaId, data: json.roteiros ?? [], content_revision: revision });
            tx.objectStore('cifro_categorias').put({ banda_id: key, actual_band_id: bandaId, data: json.categorias ?? [], content_revision: revision });
            tx.objectStore('cifro_sync_meta').put({
                banda_id: key,
                actual_band_id: bandaId,
                last_sync: Date.now(),
                last_checked_at: Date.now(),
                content_revision: revision,
                plano: json.plano ?? null,
                trial_expira_em: json.trial_expira_em ?? null,
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    }

    function validateSnapshot(bandaId, json) {
        const revision = Number(json?.content_revision);
        if (!json || json.banda_id !== bandaId || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Snapshot inválido');
        ['musicas', 'playlists', 'roteiros', 'categorias'].forEach(key => {
            if (!Array.isArray(json[key])) throw new Error('Snapshot inválido: ' + key);
        });
        if (json.musicas.some(item => !item || !Number.isFinite(Number(item.id)) || typeof item.nome !== 'string' || (item.cifra !== null && typeof item.cifra !== 'string'))) throw new Error('Músicas inválidas');
        if (json.playlists.some(item => !item || typeof item.nome !== 'string' || !Array.isArray(item.itens) || item.itens.some(entry => {
            const id = typeof entry === 'object' && entry ? entry.id : entry;
            const tone = typeof entry === 'object' && entry ? String(entry.tom || '') : '';
            return !Number.isFinite(Number(id)) || (tone !== '' && !/^[A-G](?:#|b)?m?$/.test(tone));
        }))) throw new Error('Playlists inválidas');
        if (json.roteiros.some(item => !item || !Number.isFinite(Number(item.id)) || typeof item.titulo !== 'string')) throw new Error('Roteiros inválidos');
        if (json.categorias.some(item => !item || !Number.isFinite(Number(item.id)) || typeof item.nome !== 'string')) throw new Error('Categorias inválidas');
    }

    async function updateMetaChecked(bandaId, meta, revision) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cifro_sync_meta', 'readwrite');
            tx.objectStore('cifro_sync_meta').put({ ...meta, banda_id: storageKey(bandaId), actual_band_id: bandaId, content_revision: revision, last_checked_at: Date.now() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function requestJson(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
            const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function applySnapshot(bandaId, json, changed = false) {
        window.songs = json.musicas ?? [];
        window.playlistsSalvas = json.playlists ?? [];
        window.roteirosSalvos = json.roteiros ?? [];
        window.categorias = json.categorias ?? [];
        window.CIFRO_BAND_ID = bandaId;
        document.dispatchEvent(new CustomEvent('cifro:sync', { detail: { bandaId, contentRevision: Number(json.content_revision || 0), changed } }));
    }

    function isOnline() {
        return Boolean(window.CifroConnectivity?.isServerAvailable());
    }

    async function loadCached(bandaId) {
        const snapshot = await idbGet('cifro_snapshot_current', bandaId);
        if (snapshot?.data) {
            applySnapshot(bandaId, { ...snapshot.data, content_revision: snapshot.content_revision });
            return true;
        }
        const rows = await readSnapshotRows(bandaId);
        const musicas = rows.cifro_musicas;
        const playlists = rows.cifro_playlists;
        const roteiros = rows.cifro_roteiros;
        const categorias = rows.cifro_categorias;
        const meta = rows.cifro_sync_meta;
        if (!musicas || !categorias) return false;
        applySnapshot(bandaId, {
            musicas: musicas.data, playlists: playlists?.data ?? [], roteiros: roteiros?.data ?? [],
            categorias: categorias.data, content_revision: meta?.content_revision ?? musicas.content_revision ?? 0,
        });
        return true;
    }

    async function restorePreviousSnapshot(bandaId = window.CIFRO_BAND_ID) {
        if (!bandaId) return false;
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SNAPSHOT_STORES, 'readwrite');
            const key = storageKey(bandaId);
            const currentStore = tx.objectStore('cifro_snapshot_current');
            const previousStore = tx.objectStore('cifro_snapshot_previous');
            const currentRequest = currentStore.get(key);
            const previousRequest = previousStore.get(key);
            let currentRow = null;
            let previousRow = null;
            let loaded = 0;
            const swapWhenReady = () => {
                loaded++;
                if (loaded < 2 || !previousRow) return;
                currentStore.put(previousRow);
                if (currentRow) previousStore.put(currentRow);
            };
            tx.oncomplete = async () => {
                db.close();
                if (!previousRequest.result?.data) return resolve(false);
                applySnapshot(bandaId, { ...previousRequest.result.data, content_revision: previousRequest.result.content_revision }, true);
                resolve(true);
            };
            currentRequest.onsuccess = () => { currentRow = currentRequest.result || null; swapWhenReady(); };
            previousRequest.onsuccess = () => { previousRow = previousRequest.result || null; swapWhenReady(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    }

    async function load(bandaId) {
        if (!bandaId) return false;
        window.CIFRO_BAND_ID = bandaId;
        const cached = await loadCached(bandaId);
        if (!isOnline()) {
            if (cached) checkOfflinePlanBanner(bandaId);
            return cached;
        }
        if (cached) {
            sync(bandaId, { throttle: true }).catch(() => {});
            return true;
        }
        return sync(bandaId, { force: true });
    }

    function sync(bandaId, options = {}) {
        if (!bandaId || !isOnline()) return Promise.resolve(false);
        if (!options.force && locallyUpdated.has(bandaId)) {
            locallyUpdated.delete(bandaId);
            return loadCached(bandaId);
        }
        if (inFlight.has(bandaId)) {
            const current = inFlight.get(bandaId);
            return options.throttle ? current : current.then(() => sync(bandaId, options));
        }
        const task = performSync(bandaId, options).finally(() => inFlight.delete(bandaId));
        inFlight.set(bandaId, task);
        return task;
    }

    async function performSync(bandaId, { force = false, throttle = false } = {}) {
        const now = Date.now();
        const meta = await idbGet('cifro_sync_meta', bandaId);
        const lastChecked = Math.max(lastChecks.get(bandaId) || 0, Number(meta?.last_checked_at || 0));
        if (throttle && !force && now - lastChecked < CHECK_INTERVAL) return loadCached(bandaId);
        lastChecks.set(bandaId, now);
        setSyncIndicator(true);
        try {
            if (!force && meta) {
                const version = await requestJson('/api/sync/version.php');
                if (version.banda_id !== bandaId) return false;
                localStorage.removeItem(pendingBandStorageKey());
                if (Number(version.content_revision) === Number(meta.content_revision || 0)) {
                    await updateMetaChecked(bandaId, meta, Number(version.content_revision));
                    return loadCached(bandaId);
                }
            }
            const json = await requestJson('/api/sync/data.php');
            if (json.banda_id !== bandaId) return false;
            localStorage.removeItem(pendingBandStorageKey());
            await writeSnapshot(bandaId, json);
            applySnapshot(bandaId, json, Boolean(meta));
            return true;
        } catch (error) {
            console.warn('[cifroSync] sync failed:', error);
            return false;
        } finally {
            setSyncIndicator(false);
        }
    }

    async function getRevision(bandaId = window.CIFRO_BAND_ID) {
        if (!bandaId) return 0;
        const meta = await idbGet('cifro_sync_meta', bandaId);
        return Number(meta?.content_revision || 0);
    }

    async function applyMutation(url, payload, response, bandaId = window.CIFRO_BAND_ID) {
        const revision = Number(response?.content_revision);
        if (!bandaId || !Number.isSafeInteger(revision)) return false;
        const path = new URL(url, window.location.href).pathname;
        const stores = ['cifro_sync_meta'];
        if (path.endsWith('/editor/api.php')) stores.push('cifro_musicas');
        else if (path.endsWith('/salvar_playlists.php')) stores.push('cifro_playlists');
        else if (path.endsWith('/salvar_roteiros.php')) stores.push('cifro_roteiros');
        else if (path.endsWith('/categorias/api.php')) stores.push('cifro_categorias', 'cifro_musicas');
        else return false;

        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(stores, 'readwrite');
            const metaStore = tx.objectStore('cifro_sync_meta');
            const key = storageKey(bandaId);
            const metaReq = metaStore.get(key);
            metaReq.onsuccess = () => metaStore.put({ ...(metaReq.result || {}), banda_id: key, actual_band_id: bandaId, content_revision: revision, last_checked_at: Date.now(), last_sync: Date.now() });

            const updateArray = (storeName, mutate) => {
                const store = tx.objectStore(storeName);
                const req = store.get(key);
                req.onsuccess = () => {
                    const row = req.result || { banda_id: key, actual_band_id: bandaId, data: [] };
                    row.data = mutate(Array.isArray(row.data) ? row.data : []);
                    row.content_revision = revision;
                    store.put(row);
                };
            };

            if (path.endsWith('/editor/api.php')) updateArray('cifro_musicas', items => {
                if (payload.action === 'delete') return items.filter(item => Number(item.id) !== Number(payload.id));
                if (!response.musica) return items;
                return [...items.filter(item => Number(item.id) !== Number(response.musica.id)), response.musica];
            });
            if (path.endsWith('/salvar_playlists.php')) updateArray('cifro_playlists', () => payload.playlists || []);
            if (path.endsWith('/salvar_roteiros.php')) updateArray('cifro_roteiros', items => {
                if (payload.deleteId) return items.filter(item => Number(item.id) !== Number(payload.deleteId));
                if (!response.roteiro) return items;
                return [...items.filter(item => Number(item.id) !== Number(response.roteiro.id)), response.roteiro];
            });
            if (path.endsWith('/categorias/api.php')) {
                updateArray('cifro_categorias', items => {
                    if (payload.action === 'delete') return items.filter(item => Number(item.id) !== Number(payload.id));
                    return [...items.filter(item => Number(item.id) !== Number(response.categoria?.id)), response.categoria].filter(Boolean);
                });
                if (payload.id && response.categoria) updateArray('cifro_musicas', items => {
                    const previous = window.categorias.find(item => Number(item.id) === Number(payload.id));
                    return previous ? items.map(item => item.classificacao === previous.nome ? { ...item, classificacao: response.categoria.nome } : item) : items;
                });
            }

            tx.oncomplete = async () => { db.close(); locallyUpdated.add(bandaId); await loadCached(bandaId); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    }

    async function cacheBands(bands) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cifro_bandas', 'readwrite');
            const store = tx.objectStore('cifro_bandas');
            bands.forEach(band => {
                const actualBandId = String(band.actual_band_id || band.banda_id || band.id);
                const key = storageKey(actualBandId);
                const req = store.get(key);
                req.onsuccess = () => store.put({ ...(req.result || {}), ...band, banda_id: key, actual_band_id: actualBandId });
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function markPrepared(bandaId = window.CIFRO_BAND_ID) {
        const meta = await idbGet('cifro_sync_meta', bandaId);
        if (!meta) return false;
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['cifro_bandas', 'cifro_sync_meta'], 'readwrite');
            const bandStore = tx.objectStore('cifro_bandas');
            const key = storageKey(bandaId);
            const req = bandStore.get(key);
            const preparedAt = Date.now();
            req.onsuccess = () => bandStore.put({ ...(req.result || {}), banda_id: key, actual_band_id: bandaId, snapshot_valid: true, content_revision: meta.content_revision, prepared_at: preparedAt });
            tx.objectStore('cifro_sync_meta').put({ ...meta, banda_id: key, actual_band_id: bandaId, snapshot_valid: true, prepared_at: preparedAt, app_version: '3.4.0' });
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function canUseOffline(bandaId) {
        const [band, meta] = await Promise.all([idbGet('cifro_bandas', bandaId), idbGet('cifro_sync_meta', bandaId)]);
        return Boolean(band?.snapshot_valid && band?.prepared_at && meta?.snapshot_valid && meta?.prepared_at);
    }

    async function getOfflineStatus(bandaId) {
        const band = await idbGet('cifro_bandas', bandaId);
        return {
            ready: Boolean(band?.snapshot_valid && band?.prepared_at),
            preparedAt: Number(band?.prepared_at || 0),
            contentRevision: Number(band?.content_revision || 0),
        };
    }

    async function getSyncStatus(bandaId = window.CIFRO_BAND_ID) {
        const [meta, current, previous] = await Promise.all([
            idbGet('cifro_sync_meta', bandaId),
            idbGet('cifro_snapshot_current', bandaId),
            idbGet('cifro_snapshot_previous', bandaId)
        ]);
        return {
            bandaId,
            contentRevision: Number(current?.content_revision ?? meta?.content_revision ?? 0),
            lastSync: Number(meta?.last_sync || 0),
            preparedAt: Number(meta?.prepared_at || 0),
            snapshotValid: Boolean(meta?.snapshot_valid),
            previousAvailable: Boolean(previous?.data),
            previousRevision: Number(previous?.content_revision || 0),
            previousSavedAt: Number(previous?.saved_at || 0),
            appVersion: meta?.app_version || '3.4.0',
        };
    }

    async function selectOfflineBand(bandaId) {
        if (!(await canUseOffline(bandaId))) return false;
        localStorage.setItem(offlineBandStorageKey(), String(bandaId));
        window.CIFRO_BAND_ID = String(bandaId);
        if ('serviceWorker' in navigator) {
            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise(resolve => setTimeout(() => resolve(null), 1500))
            ]);
            if (!registration) return true;
            const worker = navigator.serviceWorker.controller || registration.active;
            if (worker) await new Promise(resolve => {
                const channel = new MessageChannel();
                const timer = setTimeout(resolve, 1500);
                channel.port1.onmessage = () => { clearTimeout(timer); resolve(); };
                worker.postMessage({ type: 'SET_CONTEXT', userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID }, [channel.port2]);
            });
        }
        return true;
    }

    function selectOnlineBand(bandaId) {
        localStorage.setItem(pendingBandStorageKey(), String(bandaId));
        window.CIFRO_BAND_ID = String(bandaId);
        if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'SET_CONTEXT', userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID })).catch(() => {});
    }

    async function reconcileOfflineBand() {
        const bandaId = localStorage.getItem(offlineBandStorageKey());
        if (!bandaId || !isOnline()) return;
        try {
            const response = await fetch('/src/backend/bandas/selecionar.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bandaId })
            });
            const json = await response.json();
            if (response.ok && json.sucesso) {
                localStorage.removeItem(offlineBandStorageKey());
                window.location.reload();
            } else if ([401, 403].includes(response.status) || /acesso negado|não autenticado|sessão expirada/i.test(json.mensagem || '')) {
                await invalidateBand(bandaId);
                localStorage.removeItem(offlineBandStorageKey());
                window.location.href = '/select-banda.php';
            }
        } catch (_) {}
    }

    async function invalidateBand(bandaId) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ALL_STORES, 'readwrite');
            const key = storageKey(bandaId);
            ALL_STORES.forEach(store => tx.objectStore(store).delete(key));
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    function setSyncIndicator(active) {
        document.getElementById('topnavSyncDot')?.classList.toggle('sync-dot--syncing', active);
    }

    async function checkOfflinePlanBanner(bandaId) {
        const meta = await idbGet('cifro_sync_meta', bandaId);
        if (!meta?.trial_expira_em || !['trial', 'gratuito'].includes(meta.plano)) return;
        if (new Date(meta.trial_expira_em + 'T23:59:59') >= new Date() || document.getElementById('_planExpiredBanner')) return;
        const banner = document.createElement('div');
        banner.id = '_planExpiredBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-weight:600';
        banner.textContent = 'Seu plano expirou. O conteúdo preparado continua disponível offline.';
        document.body.prepend(banner);
    }

    document.addEventListener('cifro:connectivity', function (event) {
        if (event.detail?.state !== 'servidor_disponivel') return;
        reconcileOfflineBand();
        if (!localStorage.getItem(offlineBandStorageKey())) sync(window.CIFRO_BAND_ID).catch(() => {});
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') sync(window.CIFRO_BAND_ID, { throttle: true }).catch(() => {});
    });
    if (offlineBand && isOnline()) setTimeout(reconcileOfflineBand, 0);

    if ('serviceWorker' in navigator && window.CIFRO_USER_ID) {
        navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'SET_CONTEXT', userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID })).catch(() => {});
    }

    return { load, sync, isOnline, getRevision, getSyncStatus, cacheBands, selectOnlineBand, selectOfflineBand, canUseOffline, getOfflineStatus, markPrepared, applyMutation, restorePreviousSnapshot };
})();
window.cifroSync = cifroSync;
