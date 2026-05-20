/**
 * fdm-sync.js — StageBox offline data cache via IndexedDB
 *
 * Stores musicas, playlists and roteiros per banda in IndexedDB so the app
 * works offline and survives cache clears.
 *
 * Usage:
 *   await fdmSync.load(bandaId)   — loads data from IDB into window globals
 *   await fdmSync.sync(bandaId)   — fetches fresh data from server → IDB → globals
 *   fdmSync.isOnline()            — true when navigator.onLine
 *
 * Globals populated:
 *   window.songs              (array)
 *   window.playlistsSalvas    (array)
 *   window.roteirosSalvos     (array)
 *   window.FDM_BAND_ID        (string)
 */

const fdmSync = (() => {
    const DB_NAME    = 'stagebox';
    const DB_VERSION = 1;
    const STORES     = ['fdm_musicas', 'fdm_playlists', 'fdm_roteiros', 'fdm_sync_meta'];

    // ---------- IndexedDB ----------

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                STORES.forEach(name => {
                    if (!db.objectStoreNames.contains(name)) {
                        db.createObjectStore(name, { keyPath: 'banda_id' });
                    }
                });
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = e => reject(e.target.error);
        });
    }

    async function idbGet(storeName, bandaId) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(bandaId);
            req.onsuccess = e => resolve(e.target.result ?? null);
            req.onerror   = e => reject(e.target.error);
        });
    }

    async function idbPut(storeName, record) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(record);
            req.onsuccess = () => resolve();
            req.onerror   = e => reject(e.target.error);
        });
    }

    // ---------- public API ----------

    function isOnline() {
        return navigator.onLine !== false;
    }

    /**
     * Load data from IndexedDB into window globals.
     * If IDB is empty and online, triggers a sync first.
     */
    async function load(bandaId) {
        if (!bandaId) return;
        window.FDM_BAND_ID = bandaId;

        const [musRow, plRow, rtRow] = await Promise.all([
            idbGet('fdm_musicas',   bandaId),
            idbGet('fdm_playlists', bandaId),
            idbGet('fdm_roteiros',  bandaId),
        ]);

        const hasData = musRow && Array.isArray(musRow.data) && musRow.data.length > 0;

        if (!hasData) {
            if (isOnline()) {
                await sync(bandaId);
            }
            // else: stay empty — offline with no cache yet
            return;
        }

        window.songs           = musRow.data;
        window.playlistsSalvas = plRow  ? plRow.data  : [];
        window.roteirosSalvos  = rtRow  ? rtRow.data  : [];

        // Background version check — update silently if newer data available
        if (isOnline()) {
            _checkAndRefreshInBackground(bandaId, musRow.version ?? 0);
        } else {
            _checkOfflinePlanBanner(bandaId);
        }
    }

    /**
     * Fetch fresh data from server, store in IDB, populate globals.
     * Shows sync indicator in topnav during fetch.
     */
    async function sync(bandaId) {
        if (!bandaId) return;
        _setSyncIndicator(true);
        try {
            const url = '/api/sync/data.php?banda_id=' + encodeURIComponent(bandaId);
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();

            await Promise.all([
                idbPut('fdm_musicas',   { banda_id: bandaId, data: json.musicas   ?? [], version: json.version }),
                idbPut('fdm_playlists', { banda_id: bandaId, data: json.playlists ?? [], version: json.version }),
                idbPut('fdm_roteiros',  { banda_id: bandaId, data: json.roteiros  ?? [], version: json.version }),
                idbPut('fdm_sync_meta', {
                    banda_id: bandaId,
                    last_sync: Date.now(),
                    version: json.version,
                    plano: json.plano ?? null,
                    trial_expira_em: json.trial_expira_em ?? null,
                }),
            ]);

            window.songs           = json.musicas   ?? [];
            window.playlistsSalvas = json.playlists ?? [];
            window.roteirosSalvos  = json.roteiros  ?? [];
            window.FDM_BAND_ID     = bandaId;

            _setSyncIndicator(false);
            return true;
        } catch (err) {
            console.warn('[fdmSync] sync failed:', err);
            _setSyncIndicator(false);
            return false;
        }
    }

    async function _checkAndRefreshInBackground(bandaId, cachedVersion) {
        try {
            const res  = await fetch('/api/sync/version.php?banda_id=' + encodeURIComponent(bandaId),
                                     { credentials: 'same-origin' });
            const json = await res.json();
            if ((json.version ?? 0) > cachedVersion) {
                await sync(bandaId);
            }
        } catch (_) { /* silent */ }
    }

    function _setSyncIndicator(active) {
        const dot = document.getElementById('topnavSyncDot');
        if (dot) dot.classList.toggle('sync-dot--syncing', active);
    }

    async function _checkOfflinePlanBanner(bandaId) {
        if (isOnline()) return;
        const meta = await idbGet('fdm_sync_meta', bandaId);
        if (!meta) return;
        const plano = meta.plano;
        const expira = meta.trial_expira_em;
        if (!expira || !['trial', 'gratuito'].includes(plano)) return;
        const expired = new Date(expira + 'T23:59:59') < new Date();
        if (!expired) return;
        // Show banner — don't block offline access but warn the user
        if (document.getElementById('_planExpiredBanner')) return;
        const banner = document.createElement('div');
        banner.id = '_planExpiredBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-weight:600';
        banner.textContent = '⚠ Seu plano expirou. Você está no modo offline — acesso liberado para o palco. Conecte-se para regularizar.';
        document.body.prepend(banner);
    }

    return { load, sync, isOnline };
})();
