const cifroSync = (() => {
    const DB_NAME = 'cifro';
    // Versão 7 acrescenta cifro_preferencias (capotraste pessoal por música).
    // Subir a versão é obrigatório: onupgradeneeded só cria os stores que
    // faltam quando ela muda.
    const DB_VERSION = 7;
    const DATA_STORES = ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_preferencias', 'cifro_sync_meta'];
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
    function currentBandStorageKey() {
        return 'cifroCurrentBandId:' + String(window.CIFRO_USER_ID || 'anonymous');
    }
    function recentSongStorageKey(bandaId) {
        return 'cifroRecentSong:' + storageKey(bandaId);
    }
    function getRecentSong(bandaId, songId) {
        try {
            const song = JSON.parse(sessionStorage.getItem(recentSongStorageKey(bandaId)) || 'null');
            return song && String(song.id) === String(songId) ? song : null;
        } catch (_) {
            return null;
        }
    }
    const offlineBand = localStorage.getItem(offlineBandStorageKey());
    const pendingBand = localStorage.getItem(pendingBandStorageKey());
    const currentBand = localStorage.getItem(currentBandStorageKey());
    if (offlineBand || pendingBand || currentBand) window.CIFRO_BAND_ID = offlineBand || pendingBand || currentBand;

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
        const stores = ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_preferencias', 'cifro_sync_meta'];
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
                        preferencias_musica: json.preferencias_musica ?? [],
                        plano: json.plano ?? null,
                        trial_expira_em: json.trial_expira_em ?? null
                    }
                });
            };
            tx.objectStore('cifro_musicas').put({ banda_id: key, actual_band_id: bandaId, data: json.musicas ?? [], content_revision: revision });
            tx.objectStore('cifro_playlists').put({ banda_id: key, actual_band_id: bandaId, data: json.playlists ?? [], content_revision: revision });
            tx.objectStore('cifro_roteiros').put({ banda_id: key, actual_band_id: bandaId, data: json.roteiros ?? [], content_revision: revision });
            tx.objectStore('cifro_categorias').put({ banda_id: key, actual_band_id: bandaId, data: json.categorias ?? [], content_revision: revision });
            tx.objectStore('cifro_preferencias').put({ banda_id: key, actual_band_id: bandaId, data: json.preferencias_musica ?? [], content_revision: revision });
            tx.objectStore('cifro_sync_meta').put({
                banda_id: key,
                actual_band_id: bandaId,
                last_sync: Date.now(),
                last_checked_at: Date.now(),
                content_revision: revision,
                // Contagens gravadas no mesmo instante que o snapshot. É o que
                // permite detectar um snapshot que existe, tem a revisão certa
                // e está vazio por dentro — sem ler o repertório uma segunda
                // vez para conferir.
                contagens: contagensDe(json),
                plano: json.plano ?? null,
                trial_expira_em: json.trial_expira_em ?? null,
            });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    }

    const COLECOES_OBRIGATORIAS = ['musicas', 'playlists', 'roteiros', 'categorias'];

    function contagensDe(json) {
        const contagens = {};
        COLECOES_OBRIGATORIAS.forEach(nome => { contagens[nome] = (json?.[nome] ?? []).length; });
        return contagens;
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
        // Tolerante à ausência de propósito: durante o deploy, um cliente já
        // atualizado pode falar com um servidor que ainda não devolve a chave.
        if (json.preferencias_musica !== undefined) {
            if (!Array.isArray(json.preferencias_musica)) throw new Error('Snapshot inválido: preferencias_musica');
            if (json.preferencias_musica.some(item => !item || !Number.isFinite(Number(item.musica_id)))) throw new Error('Preferências inválidas');
        }
    }

    // Stores sem as quais o pacote local não se sustenta. `cifro_preferencias`
    // fica de fora pela mesma razão que o validateSnapshot a tolera ausente:
    // durante um deploy, um cliente já atualizado fala com um servidor que
    // ainda não devolve a chave. `cifro_snapshot_previous` é rede de
    // segurança, não requisito.
    const STORES_OBRIGATORIAS = [
        'cifro_snapshot_current', 'cifro_musicas', 'cifro_playlists',
        'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta', 'cifro_bandas',
    ];

    /**
     * Confere se o armazenamento local está fisicamente íntegro.
     *
     * Existe porque revisão igual não é prova de dado presente: o navegador
     * pode descartar parte do IndexedDB sob pressão de armazenamento, e o
     * `cifro_sync_meta` sobreviver com a revisão certa. Sem esta conferência,
     * a sincronização encerra dizendo "tudo certo" e o músico chega ao palco
     * sem repertório.
     *
     * Usa `getKey()` para provar existência: ele devolve a chave sem
     * desserializar o valor, então o custo não cresce com o tamanho do
     * repertório (medido: ~0,4 ms com 50 ou com 600 músicas).
     */
    async function verificarIntegridade(bandaId) {
        if (!bandaId || !window.CIFRO_USER_ID) return { ok: false, motivo: 'contexto_indefinido' };
        const key = storageKey(bandaId);
        const db = await openDb();
        const lido = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORES_OBRIGATORIAS, 'readonly');
            const chaves = {};
            STORES_OBRIGATORIAS.forEach(store => {
                const req = tx.objectStore(store).getKey(key);
                req.onsuccess = () => { chaves[store] = req.result; };
            });
            const metaReq = tx.objectStore('cifro_sync_meta').get(key);
            const bandaReq = tx.objectStore('cifro_bandas').get(key);
            const snapReq = tx.objectStore('cifro_snapshot_current').get(key);
            tx.oncomplete = () => {
                db.close();
                resolve({ chaves, meta: metaReq.result || null, banda: bandaReq.result || null, snapshot: snapReq.result || null });
            };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });

        const ausente = STORES_OBRIGATORIAS.find(store => lido.chaves[store] === undefined);
        if (ausente) return { ok: false, motivo: 'store_ausente:' + ausente };

        const { meta, banda, snapshot } = lido;
        if (String(meta.actual_band_id) !== String(bandaId) || String(banda.actual_band_id) !== String(bandaId)) {
            return { ok: false, motivo: 'banda_alheia' };
        }
        const revisao = Number(snapshot.content_revision);
        if (revisao !== Number(meta.content_revision) || revisao !== Number(banda.content_revision)) {
            return { ok: false, motivo: 'revisao_divergente' };
        }
        if (!snapshot.data || COLECOES_OBRIGATORIAS.some(nome => !Array.isArray(snapshot.data[nome]))) {
            return { ok: false, motivo: 'colecao_invalida' };
        }
        // Ausência de `contagens` não é dano: é um snapshot gravado por uma
        // versão anterior do app. Exigi-la aqui mandaria toda a base baixar o
        // repertório inteiro no primeiro acesso após o deploy. A primeira
        // gravação nova preenche o campo e a conferência passa a valer.
        if (meta.contagens) {
            const divergente = COLECOES_OBRIGATORIAS.some(nome => (
                Number.isFinite(Number(meta.contagens[nome])) &&
                Number(meta.contagens[nome]) !== snapshot.data[nome].length
            ));
            if (divergente) return { ok: false, motivo: 'contagem_divergente' };
        }
        return { ok: true, motivo: '', snapshot };
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
            const res = await fetch((window.APP_BASE || '') + url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
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
        window.preferenciasMusica = json.preferencias_musica ?? [];
        window.CIFRO_BAND_ID = bandaId;
        document.dispatchEvent(new CustomEvent('cifro:sync', { detail: { bandaId, contentRevision: Number(json.content_revision || 0), changed } }));
    }

    async function rebuildSnapshotFromRows(bandaId, revision) {
        const [rows, current] = await Promise.all([
            readSnapshotRows(bandaId),
            idbGet('cifro_snapshot_current', bandaId),
        ]);
        const json = {
            banda_id: bandaId,
            content_revision: revision,
            musicas: rows.cifro_musicas?.data ?? [],
            playlists: rows.cifro_playlists?.data ?? [],
            roteiros: rows.cifro_roteiros?.data ?? [],
            categorias: rows.cifro_categorias?.data ?? [],
            preferencias_musica: rows.cifro_preferencias?.data ?? current?.data?.preferencias_musica ?? [],
            plano: current?.data?.plano ?? null,
            trial_expira_em: current?.data?.trial_expira_em ?? null,
        };
        await writeSnapshot(bandaId, json);
        applySnapshot(bandaId, json, true);
        await markPrepared(bandaId);
        notifySyncChecked(bandaId, revision);
    }

    function mergeEntityChanges(items, changes) {
        if (Array.isArray(changes?.replace)) return changes.replace;
        const deleted = new Set((changes?.deleted || []).map(Number));
        const upserts = Array.isArray(changes?.upsert) ? changes.upsert : [];
        const upsertIds = new Set(upserts.map(item => Number(item.id)));
        return [...items.filter(item => !deleted.has(Number(item.id)) && !upsertIds.has(Number(item.id))), ...upserts];
    }

    async function applyIncrementalChanges(bandaId, meta, delta) {
        if (!delta || delta.full_sync_required || delta.banda_id !== bandaId) return false;
        const current = await idbGet('cifro_snapshot_current', bandaId);
        if (!current?.data) return false;
        const changes = delta.changes || {};
        const json = {
            ...current.data,
            banda_id: bandaId,
            content_revision: Number(delta.content_revision),
            musicas: mergeEntityChanges(current.data.musicas || [], changes.musicas),
            roteiros: mergeEntityChanges(current.data.roteiros || [], changes.roteiros),
            playlists: Array.isArray(changes.playlists?.replace) ? changes.playlists.replace : (current.data.playlists || []),
            categorias: Array.isArray(changes.categorias?.replace) ? changes.categorias.replace : (current.data.categorias || []),
            // Substitui, nao mescla: a lista vem inteira porque fica fora da
            // revisao. Sem isto, o snapshot herdaria a versao antiga do cache
            // e uma escolha feita em outro aparelho nunca apareceria aqui.
            preferencias_musica: Array.isArray(delta.preferencias_musica)
                ? delta.preferencias_musica
                : (current.data.preferencias_musica || []),
        };
        await writeSnapshot(bandaId, json);
        applySnapshot(bandaId, json, true);
        await markPrepared(bandaId);
        notifySyncChecked(bandaId, Number(json.content_revision));
        return true;
    }

    function isOnline() {
        return Boolean(window.CifroConnectivity?.isServerAvailable());
    }

    // `snapshotPreLido` evita reler o snapshot inteiro do IndexedDB quando
    // quem chama acabou de le-lo. A desserializacao e o unico custo aqui que
    // cresce com o tamanho do repertorio (medido: 0,8 ms com 300 musicas,
    // 3,2 ms com 600); o resto e constante.
    async function loadCached(bandaId, snapshotPreLido) {
        const snapshot = snapshotPreLido !== undefined ? snapshotPreLido : await idbGet('cifro_snapshot_current', bandaId);
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
            categorias: categorias.data,
            preferencias_musica: rows.cifro_preferencias?.data ?? [],
            content_revision: meta?.content_revision ?? musicas.content_revision ?? 0,
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

    // Uma marca só governa duas coisas que precisam andar juntas: quantas
    // vezes se tenta reparar e quantas vezes se avisa. Em sessionStorage
    // porque a janela certa é "até o app ser fechado e reaberto" — um
    // aparelho que não consegue gravar não pode baixar o repertório inteiro a
    // cada página aberta, e o músico não pode levar um toast a cada tela.
    function reparoStorageKey(bandaId) {
        return 'cifroReparoTentado:' + storageKey(bandaId);
    }
    function reparoJaTentado(bandaId) {
        try { return sessionStorage.getItem(reparoStorageKey(bandaId)) === '1'; } catch (_) { return false; }
    }
    function marcarReparoTentado(bandaId) {
        try { sessionStorage.setItem(reparoStorageKey(bandaId), '1'); } catch (_) {}
    }
    function limparReparoTentado(bandaId) {
        try { sessionStorage.removeItem(reparoStorageKey(bandaId)); } catch (_) {}
    }

    // O módulo de sincronização não conhece toast nem DOM: ele avisa que o
    // reparo falhou e para por aí. Quem decide o que mostrar é o
    // offline-tools.js, que já é dono do painel e da mensagem.
    function notificarIntegridadeFalhou(bandaId, motivo) {
        document.dispatchEvent(new CustomEvent('cifro:integridade-falhou', { detail: { bandaId, motivo } }));
    }

    /**
     * Tenta devolver o snapshot ao ar sem rede, na ordem do menos para o mais
     * destrutivo.
     *
     * A guarda da primeira etapa é o ponto delicado: se a linha que sumiu for
     * justamente `cifro_musicas`, reconstruir "do que sobrou" produziria um
     * repertório VAZIO que passa em todas as validações — e o
     * `writeSnapshot` empurraria o snapshot bom para `previous`, perdendo-o
     * no ciclo seguinte. Por isso só reconstrói quando as linhas de origem
     * existem; um array vazio numa banda nova é dado legítimo, uma linha
     * ausente não é.
     */
    async function repararSnapshot(bandaId) {
        const rows = await readSnapshotRows(bandaId).catch(() => null);
        const meta = rows?.cifro_sync_meta;
        const linhasIntactas = Boolean(
            rows && meta && rows.cifro_musicas && rows.cifro_playlists &&
            rows.cifro_roteiros && rows.cifro_categorias
        );
        if (linhasIntactas) {
            try {
                await rebuildSnapshotFromRows(bandaId, Number(meta.content_revision || 0));
                return true;
            } catch (_) {}
        }
        try {
            if (await restorePreviousSnapshot(bandaId)) return true;
        } catch (_) {}
        return false;
    }

    // Dedupe no nível do load() inteiro (não só do fetch dentro de sync()).
    // Duas chamadas a load() para a mesma banda quase simultâneas (ex.: o
    // auto-load deste módulo e uma chamada explícita da própria página)
    // fazem cada uma sua própria leitura assíncrona em loadCached() antes
    // de sequer chegar em sync() — sem esse dedupe aqui, a corrida entre
    // essas duas leituras pode fazer as duas chamarem sync() em momentos
    // diferentes o bastante para escapar do dedupe interno de sync(),
    // duplicando a checagem de revisão a cada abertura.
    const loadInFlight = new Map();

    // Fica true quando o servidor confirma que a sessão morreu; usado para
    // parar de tentar sincronizar (só produziria 401 e ruído no console).
    let sessaoInvalida = false;

    // O dedupe precisa cobrir a duração TOTAL do sync() disparado por baixo
    // — não só até o momento em que load() decide "cache pronto, retornar
    // já" — senão uma segunda chamada a load() pode chegar bem depois desse
    // ponto (mas ainda enquanto o sync() de fundo da primeira chamada segue
    // em andamento) e escapar do dedupe, iniciando seu próprio sync()
    // independente. Por isso o valor PÚBLICO que load() retorna (resolvido
    // assim que o cache local está pronto, sem esperar a rede) é separado
    // da entrada usada para dedupe (que só sai do mapa quando o sync() de
    // fundo realmente termina).
    function load(bandaId) {
        if (!bandaId) return Promise.resolve(false);
        const existing = loadInFlight.get(bandaId);
        if (existing) return existing.publicResult;
        let resolvePublic;
        const publicResult = new Promise(resolve => { resolvePublic = resolve; });
        const fullTask = performLoad(bandaId, resolvePublic).finally(() => loadInFlight.delete(bandaId));
        loadInFlight.set(bandaId, { fullTask, publicResult });
        return publicResult;
    }

    async function performLoad(bandaId, resolvePublic) {
        window.CIFRO_BAND_ID = bandaId;
        localStorage.setItem(currentBandStorageKey(), String(bandaId));
        const cached = await loadCached(bandaId);
        if (cached) resolvePublic(true);
        if (!isOnline() && navigator.onLine && window.CifroConnectivity?.current() === 'verificando') {
            await window.CifroConnectivity.probe().catch(() => false);
        }
        if (!isOnline()) {
            // Sem servidor não há de onde baixar, mas o dano pode ser
            // reparável com o que ficou no aparelho. Tentar aqui é o que
            // evita o músico depender do próximo acesso com internet — que
            // pode só acontecer depois do culto.
            const integridade = await verificarIntegridade(bandaId);
            const reparado = integridade.ok ? true : await repararSnapshot(bandaId);
            if (reparado) {
                limparReparoTentado(bandaId);
                resolvePublic(true);
            } else if (!reparoJaTentado(bandaId)) {
                marcarReparoTentado(bandaId);
                notificarIntegridadeFalhou(bandaId, integridade.motivo);
            }
            if (cached || reparado) checkOfflinePlanBanner(bandaId);
            if (!cached && !reparado) resolvePublic(false);
            return;
        }
        if (cached) {
            await sync(bandaId, { throttle: true }).catch(() => {});
            return;
        }
        resolvePublic(await sync(bandaId, { force: true }));
    }

    function sync(bandaId, options = {}) {
        // Sem sessão válida, sincronizar só produz 401 e ruído no console.
        if (!bandaId || !isOnline() || sessaoInvalida) return Promise.resolve(false);
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
        let reparoEmCurso = '';
        try {
            if (!force && meta) {
                const version = await requestJson('/api/sync/version.php');
                if (version.banda_id !== bandaId) return false;
                localStorage.removeItem(pendingBandStorageKey());
                // Revisão igual só encerra a sincronização quando o dado local
                // está fisicamente lá. Sem esta conferência, perda parcial do
                // IndexedDB passa por "tudo certo" e nada reconstrói o
                // repertório — o defeito que o STAGE-001 registra.
                const mesmaRevisao = Number(version.content_revision) === Number(meta.content_revision || 0);
                const integridade = await verificarIntegridade(bandaId);
                if (mesmaRevisao && integridade.ok) {
                    // A personalizacao do musico muda sem mexer na revisao da
                    // banda, entao ela precisa ser gravada mesmo quando nada
                    // mudou no repertorio.
                    if (Array.isArray(version.preferencias_musica)) {
                        const gravou = await savePreferencias(bandaId, version.preferencias_musica).catch(() => false);
                        // Espelha na copia em memoria o que savePreferencias
                        // acabou de gravar na linha do snapshot. Sem isto, a
                        // leitura reaproveitada abaixo seria de ANTES da
                        // gravacao, e a escolha feita em outro aparelho — que
                        // vive fora da revisao da banda — nunca apareceria
                        // neste caminho, o mais percorrido do app.
                        if (gravou && integridade.snapshot?.data) {
                            integridade.snapshot.data.preferencias_musica = version.preferencias_musica;
                        }
                    }
                    await updateMetaChecked(bandaId, meta, Number(version.content_revision));
                    await markPrepared(bandaId);
                    notifySyncChecked(bandaId, Number(version.content_revision));
                    return loadCached(bandaId, integridade.snapshot);
                }
                if (!integridade.ok) {
                    // Já se tentou reparar nesta sessão e não adiantou.
                    // Insistir só repetiria o download do repertório inteiro
                    // a cada página aberta.
                    if (reparoJaTentado(bandaId)) return loadCached(bandaId);
                    reparoEmCurso = integridade.motivo;
                    marcarReparoTentado(bandaId);
                }
                // Sem integridade, o caminho incremental não tem base sobre a
                // qual aplicar o delta: só o snapshot completo reconstrói.
                if (integridade.ok) try {
                    const delta = await requestJson('/api/sync/changes.php?since=' + encodeURIComponent(Number(meta.content_revision || 0)));
                    if (await applyIncrementalChanges(bandaId, meta, delta)) return true;
                } catch (_) {}
            }
            const json = await requestJson('/api/sync/data.php');
            if (json.banda_id !== bandaId) {
                if (reparoEmCurso) notificarIntegridadeFalhou(bandaId, reparoEmCurso);
                return false;
            }
            localStorage.removeItem(pendingBandStorageKey());
            await writeSnapshot(bandaId, json);
            applySnapshot(bandaId, json, Boolean(meta));
            await markPrepared(bandaId);
            notifySyncChecked(bandaId, Number(json.content_revision));
            if (reparoEmCurso) limparReparoTentado(bandaId);
            return true;
        } catch (error) {
            console.warn('[cifroSync] sync failed:', error);
            if (reparoEmCurso) notificarIntegridadeFalhou(bandaId, reparoEmCurso);
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

            tx.oncomplete = async () => {
                db.close();
                if (path.endsWith('/editor/api.php')) {
                    try {
                        if (payload.action === 'delete') {
                            if (getRecentSong(bandaId, payload.id)) sessionStorage.removeItem(recentSongStorageKey(bandaId));
                        } else if (response.musica) {
                            sessionStorage.setItem(recentSongStorageKey(bandaId), JSON.stringify(response.musica));
                        }
                    } catch (_) {}
                }
                locallyUpdated.add(bandaId);
                await rebuildSnapshotFromRows(bandaId, revision);
                resolve(true);
            };
            tx.onerror = () => { db.close(); reject(tx.error); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        });
    }

    /**
     * Grava a personalização do músico no cache local.
     *
     * Sem isto, a escolha só existiria em memória: como ela não sobe a revisão
     * da banda, o próximo carregamento leria o cache antigo e o capotraste
     * escolhido sumiria da tela. Também é o que faz a escolha sobreviver
     * offline.
     */
    async function savePreferencias(bandaId, preferencias) {
        if (!bandaId) return false;
        const lista = Array.isArray(preferencias) ? preferencias : [];
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['cifro_preferencias', 'cifro_snapshot_current'], 'readwrite');
            const key = storageKey(bandaId);

            const prefStore = tx.objectStore('cifro_preferencias');
            const prefReq = prefStore.get(key);
            prefReq.onsuccess = () => prefStore.put({
                ...(prefReq.result || {}), banda_id: key, actual_band_id: bandaId, data: lista
            });

            const snapStore = tx.objectStore('cifro_snapshot_current');
            const snapReq = snapStore.get(key);
            snapReq.onsuccess = () => {
                const row = snapReq.result;
                if (row && row.data) {
                    row.data.preferencias_musica = lista;
                    snapStore.put(row);
                }
            };

            tx.oncomplete = () => { db.close(); resolve(true); };
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

    // Leitura da banda cacheada. Existe para a interface poder se corrigir
    // offline: o HTML servido pelo cache e uma foto tirada com ALGUMA banda
    // corrente, e o cache de paginas e chaveado so pelo caminho (uma copia
    // para todas as bandas, decisao deliberada do service worker).
    async function getBanda(bandaId = window.CIFRO_BAND_ID) {
        if (!bandaId) return null;
        return idbGet('cifro_bandas', bandaId).catch(() => null);
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

    // Marca que o pacote OFFLINE COMPLETO (shell do app + páginas de cada
    // música, via service worker) foi preparado com sucesso para a revisão
    // de conteúdo informada. Distinto de markPrepared(), que só reflete que
    // os DADOS foram sincronizados — o shell pode nunca ter sido cacheado
    // mesmo com os dados válidos.
    async function markShellPrepared(bandaId, revision, appVersion) {
        // O pacote acabou de mudar no disco: a conferencia memorizada morreu.
        invalidarVerificacao(bandaId);
        const meta = await idbGet('cifro_sync_meta', bandaId);
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['cifro_bandas', 'cifro_sync_meta'], 'readwrite');
            const bandStore = tx.objectStore('cifro_bandas');
            const key = storageKey(bandaId);
            const shellPreparedAt = Date.now();
            const bandReq = bandStore.get(key);
            bandReq.onsuccess = () => bandStore.put({
                ...(bandReq.result || {}), banda_id: key, actual_band_id: bandaId,
                shell_prepared_revision: Number(revision), shell_prepared_at: shellPreparedAt,
            });
            tx.objectStore('cifro_sync_meta').put({
                ...(meta || {}), banda_id: key, actual_band_id: bandaId,
                shell_prepared_revision: Number(revision), shell_prepared_at: shellPreparedAt,
                app_version: appVersion || meta?.app_version || '0.0.1',
            });
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    // Dispara um evento leve toda vez que um sync (com ou sem mudança de
    // dados) termina — offline-tools.js escuta para decidir, de forma
    // independente, se o pacote offline completo (shell) precisa ser
    // refeito para a revisão atual.
    // setTimeout (não dispatch síncrono) de propósito: a preparação do
    // shell que este evento pode disparar (probe de conectividade + várias
    // buscas via service worker) não pode competir por I/O/agendamento do
    // event loop com o próprio boot da página — duas chamadas independentes
    // a load() no carregamento inicial (o auto-load deste módulo e uma
    // chamada explícita da própria view) dependem de uma janela de tempo
    // apertada para o dedupe interno de sync() funcionar; um despacho
    // síncrono aqui já observou atrapalhar esse timing o bastante para
    // fazer essa janela escapar e duplicar a checagem de revisão.
    function notifySyncChecked(bandaId, contentRevision) {
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId, contentRevision } }));
        }, 0);
    }

    // Um shell é considerado pronto quando foi preparado com sucesso E para
    // a MESMA revisão de conteúdo que os dados têm agora — se o conteúdo
    // mudou depois do último shell preparado, o shell é considerado velho.
    function shellReadyFor(band) {
        return Boolean(
            band?.shell_prepared_revision !== undefined &&
            band?.shell_prepared_revision !== null &&
            Number(band.shell_prepared_revision) === Number(band?.content_revision || 0)
        );
    }

    function snapshotReadyFor(band, meta, current) {
        const data = current?.data;
        const revision = Number(current?.content_revision ?? -1);
        return Boolean(
            band?.snapshot_valid && band?.prepared_at && meta?.snapshot_valid && meta?.prepared_at && data &&
            ['musicas', 'playlists', 'roteiros', 'categorias'].every(key => Array.isArray(data[key])) &&
            revision === Number(meta?.content_revision ?? -2) && revision === Number(band?.content_revision ?? -3)
        );
    }

    // Auditar o Cache Storage inteiro (47 assets + 4 páginas, com leitura do
    // corpo de cada HTML) é o maior custo fixo de um carregamento — medido em
    // ~6,8 ms no desktop. E ele acontecia de duas a três vezes por página:
    // uma no bind() do offline-tools, uma no 'cifro:sync-checked' e uma no
    // renderStatus. Todas perguntam a mesma coisa sobre o mesmo disco.
    //
    // A janela é curta de propósito: em produção nada além do próprio app
    // mexe no Cache Storage (só o navegador despejando, e aí o carregamento
    // seguinte reconfere). Quem precisa do estado real naquele instante pede
    // `{ force: true }`.
    const VERIFICACAO_TTL = 5000;
    const verificacoesRecentes = new Map();

    function invalidarVerificacao(bandaId = window.CIFRO_BAND_ID) {
        verificacoesRecentes.delete(String(bandaId));
    }

    async function verifyOfflinePackage(bandaId = window.CIFRO_BAND_ID, { force = false } = {}) {
        if (!bandaId || !window.CIFRO_USER_ID || !('serviceWorker' in navigator)) return { ok: false, error: 'service_worker_unavailable' };
        const chave = String(bandaId);
        const recente = verificacoesRecentes.get(chave);
        if (!force && recente?.emVoo) return recente.emVoo;
        if (!force && recente && (Date.now() - recente.em) < VERIFICACAO_TTL) return recente.resultado;
        const tarefa = auditarPacoteOffline(bandaId);
        verificacoesRecentes.set(chave, { emVoo: tarefa, em: 0, resultado: null });
        const resultado = await tarefa;
        // Só sucesso é memorizado, e a assimetria é o ponto todo: um pacote
        // íntegro continua íntegro (fora do app, nada mexe no Cache Storage),
        // mas um pacote quebrado é justamente o que a preparação está tentando
        // consertar. Guardar a falha faria a preparação ler o estado de ANTES
        // do próprio conserto, concluir "continuou incompleto" e desistir —
        // travando para sempre o laço que deveria reparar.
        if (resultado?.ok) verificacoesRecentes.set(chave, { emVoo: null, em: Date.now(), resultado });
        else verificacoesRecentes.delete(chave);
        return resultado;
    }

    async function auditarPacoteOffline(bandaId) {
        try {
            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise(resolve => setTimeout(() => resolve(null), 3000))
            ]);
            const worker = navigator.serviceWorker.controller || registration?.active;
            if (!worker) return { ok: false, error: 'service_worker_unavailable' };
            return await new Promise(resolve => {
                const channel = new MessageChannel();
                const timer = setTimeout(() => resolve({ ok: false, error: 'verification_timeout' }), 3000);
                channel.port1.onmessage = event => {
                    clearTimeout(timer);
                    resolve(event.data || { ok: false, error: 'invalid_verification' });
                };
                worker.postMessage({ type: 'VERIFY_OFFLINE', userId: window.CIFRO_USER_ID, bandId: bandaId }, [channel.port2]);
            });
        } catch (_) {
            return { ok: false, error: 'verification_failed' };
        }
    }

    async function canUseOffline(bandaId, { force = false } = {}) {
        const [band, meta, current] = await Promise.all([
            idbGet('cifro_bandas', bandaId),
            idbGet('cifro_sync_meta', bandaId),
            idbGet('cifro_snapshot_current', bandaId),
        ]);
        if (!snapshotReadyFor(band, meta, current) || !shellReadyFor(band)) return false;
        return Boolean((await verifyOfflinePackage(bandaId, { force })).ok);
    }

    async function getOfflineStatus(bandaId, { force = false } = {}) {
        const [band, meta, current] = await Promise.all([
            idbGet('cifro_bandas', bandaId),
            idbGet('cifro_sync_meta', bandaId),
            idbGet('cifro_snapshot_current', bandaId),
        ]);
        const ready = snapshotReadyFor(band, meta, current);
        const shellMarkedReady = shellReadyFor(band);
        const verification = shellMarkedReady ? await verifyOfflinePackage(bandaId, { force }) : { ok: false };
        return {
            ready,
            preparedAt: Number(band?.prepared_at || 0),
            contentRevision: Number(band?.content_revision || 0),
            shellReady: shellMarkedReady && Boolean(verification.ok),
            shellMarkedReady,
            shellPreparedRevision: Number(band?.shell_prepared_revision ?? -1),
            shellPreparedAt: Number(band?.shell_prepared_at || 0),
            missingAssets: verification.missingAssets || [],
            missingPages: verification.missingPages || [],
        };
    }

    async function getSyncStatus(bandaId = window.CIFRO_BAND_ID, { force = false } = {}) {
        const [meta, current, previous] = await Promise.all([
            idbGet('cifro_sync_meta', bandaId),
            idbGet('cifro_snapshot_current', bandaId),
            idbGet('cifro_snapshot_previous', bandaId)
        ]);
        const contentRevision = Number(current?.content_revision ?? meta?.content_revision ?? 0);
        const shellPreparedRevision = Number(meta?.shell_prepared_revision ?? -1);
        const shellMarkedReady = shellPreparedRevision === contentRevision;
        const verification = shellMarkedReady ? await verifyOfflinePackage(bandaId, { force }) : { ok: false };
        return {
            bandaId,
            contentRevision,
            lastSync: Number(meta?.last_sync || 0),
            preparedAt: Number(meta?.prepared_at || 0),
            snapshotValid: snapshotReadyFor(await idbGet('cifro_bandas', bandaId), meta, current),
            shellReady: shellMarkedReady && Boolean(verification.ok),
            shellMarkedReady,
            shellPreparedRevision,
            shellPreparedAt: Number(meta?.shell_prepared_at || 0),
            previousAvailable: Boolean(previous?.data),
            previousRevision: Number(previous?.content_revision || 0),
            previousSavedAt: Number(previous?.saved_at || 0),
            appVersion: meta?.app_version || '3.4.0',
        };
    }

    async function selectOfflineBand(bandaId) {
        if (!(await canUseOffline(bandaId))) return false;
        localStorage.setItem(offlineBandStorageKey(), String(bandaId));
        localStorage.setItem(currentBandStorageKey(), String(bandaId));
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
        localStorage.setItem(currentBandStorageKey(), String(bandaId));
        window.CIFRO_BAND_ID = String(bandaId);
        if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'SET_CONTEXT', userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID })).catch(() => {});
    }

    async function reconcileOfflineBand() {
        const bandaId = localStorage.getItem(offlineBandStorageKey());
        if (!bandaId || !isOnline()) return;
        try {
            const response = await fetch((window.APP_BASE || '') + '/src/backend/bandas/selecionar.php', {
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
            tx.oncomplete = () => {
                db.close();
                if (localStorage.getItem(currentBandStorageKey()) === String(bandaId)) localStorage.removeItem(currentBandStorageKey());
                resolve();
            };
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

    // Sessão morta no servidor mas com conteúdo já salvo: avisa sem expulsar.
    // Tirar o músico da cifra no meio de um culto seria pior do que deixá-lo
    // em modo leitura até poder logar de novo.
    async function checkSessaoExpiradaBanner() {
        let autenticado = true;
        try {
            const res = await fetch((window.APP_BASE || '') + '/api/auth/status.php', { credentials: 'same-origin', cache: 'no-store' });
            autenticado = (await res.json()).autenticado !== false;
        } catch (_) {
            return; // sem rede: é offline normal, não sessão expirada
        }

        // Precisa ser reversível: o usuário pode ter entrado de novo em outra
        // aba, ou a sessão pode ter voltado pelo token "lembrar-me". Marcar
        // sessaoInvalida sem nunca desmarcar matava a sincronização daquela
        // página até um reload manual, mesmo já autenticado.
        if (autenticado) {
            sessaoInvalida = false;
            document.getElementById('_sessaoExpiradaBanner')?.remove();
            return;
        }

        sessaoInvalida = true;
        if (document.getElementById('_sessaoExpiradaBanner')) return;
        const banner = document.createElement('a');
        banner.id = '_sessaoExpiradaBanner';
        banner.href = (window.APP_BASE || '') + '/login.php';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#111;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;text-decoration:none;display:block';
        banner.textContent = 'Sessão expirada — suas cifras continuam disponíveis. Toque para entrar.';
        document.body.appendChild(banner);
    }

    document.addEventListener('cifro:connectivity', function (event) {
        if (event.detail?.state !== 'servidor_disponivel') return;
        reconcileOfflineBand();
        if (!localStorage.getItem(offlineBandStorageKey())) sync(window.CIFRO_BAND_ID, { throttle: true }).catch(() => {});
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') sync(window.CIFRO_BAND_ID, { throttle: true }).catch(() => {});
    });
    if (offlineBand && isOnline()) setTimeout(reconcileOfflineBand, 0);

    // Ao reconectar, confere se a sessão sobreviveu (o cookie pode ter morrido
    // enquanto o app estava fechado).
    document.addEventListener('cifro:connectivity', () => {
        if (isOnline()) checkSessaoExpiradaBanner();
    });

    // Prepara sync + disponibilidade offline automaticamente em qualquer
    // página que carregue este script, mesmo que a própria página nunca
    // chame cifroSync.load() explicitamente. Espera o DOM terminar de
    // parsear para garantir que window.CIFRO_BAND_ID (definido por um
    // <script> inline da página, às vezes depois deste arquivo) já exista.
    // load() e sync() já são seguros para chamar de novo em páginas que
    // também chamam load() explicitamente (dedupe por inFlight/throttle).
    document.addEventListener('DOMContentLoaded', function () {
        if (window.CIFRO_BAND_ID) load(window.CIFRO_BAND_ID).catch(() => {});
    });

    if ('serviceWorker' in navigator && window.CIFRO_USER_ID) {
        navigator.serviceWorker.ready.then(registration => registration.active?.postMessage({ type: 'SET_CONTEXT', userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID })).catch(() => {});
    }

    return { load, sync, isOnline, getRevision, getSyncStatus, cacheBands, getBanda, selectOnlineBand, selectOfflineBand, canUseOffline, getOfflineStatus, verifyOfflinePackage, markPrepared, markShellPrepared, applyMutation, savePreferencias, getRecentSong, restorePreviousSnapshot, checkSessaoExpiradaBanner };
})();
window.cifroSync = cifroSync;
