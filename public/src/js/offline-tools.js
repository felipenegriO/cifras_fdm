(function () {
    const preparedAtKey = 'cifroOfflinePreparedAt';
    const inFlight = new Map();
    let failureToastShownThisSession = false;

    function formatDate(timestamp) {
        if (!timestamp) return 'nunca';
        return new Date(Number(timestamp)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // Retorna null (sem criar nada) quando a página não tem um contêiner de
    // destino dedicado — evita um painel perdido flutuando no body de
    // páginas (como config.php) que só usam OfflineTools.forceSync().
    function ensurePanel() {
        let panel = document.getElementById('offlineToolsPanel');
        if (panel) return panel;
        const mount = document.getElementById('offlineToolsMount');
        if (!mount) return null;
        panel = document.createElement('div');
        panel.id = 'offlineToolsPanel';
        panel.className = 'offline-tools-panel';
        panel.innerHTML = '<button type="button" class="btn btn-primary mt-3" id="prepareOfflineBtn">Sincronizar</button><div class="offline-progress"><div id="offlineProgressBar"></div></div><div id="offlineToolsStatus" class="offline-tools-status"></div>';
        mount.appendChild(panel);
        return panel;
    }

    function setStatus(text, type) {
        if (!ensurePanel()) return;
        const status = document.getElementById('offlineToolsStatus');
        status.textContent = text;
        status.dataset.status = type || '';
        status.setAttribute('aria-live', 'polite');
    }

    function setProgress(percent) {
        const bar = document.getElementById('offlineProgressBar');
        if (bar) bar.style.width = percent + '%';
    }

    async function renderStatus() {
        if (!document.getElementById('offlineToolsPanel') && !document.getElementById('offlineToolsMount')) return;
        const ready = localStorage.getItem(preparedAtKey);
        const status = window.cifroSync ? await cifroSync.getSyncStatus(window.CIFRO_BAND_ID) : null;
        const state = status?.snapshotValid && status?.shellReady ? 'Pronto para palco' : 'Pacote não validado';
        const details = status ? ` | revisão ${status.contentRevision} | sincronizado ${formatDate(status.lastSync)} | app ${status.appVersion}` : '';
        const serverAvailable = window.CifroConnectivity?.isServerAvailable() || false;
        setStatus(`${state} | ${serverAvailable ? 'Servidor disponível' : 'Servidor indisponível'} | preparado em ${formatDate(ready)}${details}`, status?.snapshotValid && status?.shellReady ? 'online' : 'offline');
    }

    function setBusy(busy) {
        const panel = document.getElementById('offlineToolsPanel');
        const status = document.getElementById('offlineToolsStatus');
        if (panel) panel.classList.toggle('is-syncing', busy);
        if (status) status.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    function songToken(song) {
        const source = JSON.stringify([song.id, song.nome, song.artista, song.classificacao, song.bit, song.cifra, song.source_url]);
        let hash = 2166136261;
        for (let index = 0; index < source.length; index++) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    async function prepareShell(contentRevision, onProgress) {
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker indisponível')), 3000))
        ]);
        const worker = registration.active || registration.waiting;
        if (!worker) throw new Error('Service worker indisponível');
        return new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const timer = setTimeout(() => reject(new Error('Tempo excedido')), 120000);
            channel.port1.onmessage = event => {
                if (event.data?.state === 'running' || event.data?.type === 'progress') {
                    onProgress?.(event.data);
                    return;
                }
                clearTimeout(timer);
                event.data?.ok ? resolve(event.data) : reject(new Error(event.data?.error || 'Falha no pacote'));
            };
            worker.postMessage({
                type: 'PREPARE_OFFLINE',
                userId: window.CIFRO_USER_ID,
                bandId: window.CIFRO_BAND_ID,
                contentRevision,
                songs: (Array.isArray(window.songs) ? window.songs : []).map(song => ({ id: song.id, token: songToken(song) }))
            }, [channel.port2]);
        });
    }

    // Rotina completa: sincroniza dados, cacheia o shell (assets + páginas
    // de cada música via service worker) e pede armazenamento persistente.
    // Usada pelo botão manual "Sincronizar" (force: true) — o usuário pediu
    // uma atualização explícita, então dados E shell são sempre refeitos.
    //
    // Dedupe: uma segunda chamada para a mesma banda enquanto a primeira
    // ainda roda simplesmente aguarda a promise em andamento — nunca
    // dispara duas preparações concorrentes.
    function runFullPreparation(bandaId, { force = false, showProgress = false } = {}) {
        if (!bandaId) return Promise.resolve(false);
        const existing = inFlight.get(bandaId);
        if (existing) {
            // Uma preparação silenciosa (automática) já está em andamento
            // para esta banda. Não duplica o trabalho de rede — só espera
            // ela terminar — mas ainda assim aplica o feedback visual que
            // o clique manual pediu (barra de progresso/toast), já que a
            // tarefa em andamento pode ter sido disparada com showProgress
            // desligado e por isso nunca notificaria o usuário sozinha.
            return existing.then(ok => {
                if (showProgress) {
                    if (ok) {
                        setProgress(100);
                        renderStatus();
                        if (window.cifroToast) cifroToast('Pacote offline validado.', 'success');
                    } else {
                        setProgress(0);
                        setStatus('Não foi possível atualizar o pacote — a versão salva foi mantida.', 'offline');
                    }
                }
                return ok;
            });
        }
        const task = performPreparation(bandaId, { syncData: true, force, showProgress, forceProbe: true }).finally(() => inFlight.delete(bandaId));
        inFlight.set(bandaId, task);
        return task;
    }

    // Disparo automático a partir de 'cifro:sync-checked': os DADOS acabaram
    // de ser sincronizados pelo próprio evento que chamou esta função — só
    // falta completar o SHELL (assets + páginas via service worker). Chamar
    // cifroSync.sync() de novo aqui duplicaria a checagem de revisão a cada
    // abertura, exatamente o tráfego redundante que devemos evitar.
    //
    // forceProbe:false — o próprio boot da página já fez seu próprio probe
    // de conectividade; um probe FORÇADO aqui republicaria 'cifro:connectivity',
    // e cifro-sync.js reage a esse evento re-sincronizando os dados, gerando
    // uma segunda checagem de revisão redundante a cada abertura. Sem forçar,
    // probe() reaproveita o resultado recente (janela de 10s) sem novo fetch
    // nem novo evento.
    function runShellOnlyPreparation(bandaId) {
        if (!bandaId) return Promise.resolve(false);
        if (inFlight.has(bandaId)) return inFlight.get(bandaId);
        const task = performPreparation(bandaId, { syncData: false, force: false, showProgress: false, forceProbe: false }).finally(() => inFlight.delete(bandaId));
        inFlight.set(bandaId, task);
        return task;
    }

    async function performPreparation(bandaId, { syncData, force, showProgress, forceProbe }) {
        const button = document.getElementById('prepareOfflineBtn');
        if (!(await window.CifroConnectivity?.probe({ force: forceProbe }))) {
            if (showProgress) setStatus('Servidor indisponível — a versão salva continua disponível. Tente sincronizar novamente quando a conexão voltar.', 'offline');
            return false;
        }
        setBusy(true);
        setProgress(5);
        setStatus('Sincronizando dados para uso offline…', 'syncing');
        if (showProgress && button) {
            button.disabled = true;
            button.textContent = 'Sincronizando...';
        }
        try {
            if (syncData) {
                const synced = await cifroSync.sync(bandaId, { force });
                if (!synced) throw new Error('Falha ao atualizar os dados');
            }
            setProgress(15);
            setStatus('Preparando páginas e músicas para uso offline…', 'syncing');
            const revision = await cifroSync.getRevision(bandaId);
            const preparedShell = await prepareShell(revision, progress => {
                const percent = 15 + Math.round((Number(progress.completed) / Math.max(1, Number(progress.total))) * 75);
                setProgress(percent);
                const phase = progress.phase === 'musicas' ? 'músicas' : progress.phase === 'assets' ? 'arquivos do aplicativo' : 'páginas';
                setStatus(`Sincronizando ${phase}… ${progress.completed} de ${progress.total}`, 'syncing');
            });
            setProgress(95);
            setStatus('Finalizando sincronização offline…', 'syncing');
            if (navigator.storage?.persist) await navigator.storage.persist();
            await cifroSync.markShellPrepared(bandaId, revision, preparedShell?.version);
            localStorage.setItem(preparedAtKey, String(Date.now()));
            setProgress(100);
            await renderStatus();
            if (showProgress && window.cifroToast) cifroToast('Pacote offline validado.', 'success');
            return true;
        } catch (error) {
            setProgress(0);
            setStatus(`Não foi possível atualizar o pacote — a versão salva foi mantida. ${error.message || 'Tente novamente mais tarde.'}`, 'offline');
            if (!showProgress && !failureToastShownThisSession) {
                failureToastShownThisSession = true;
                if (window.cifroToast) cifroToast('Não foi possível atualizar o pacote offline automaticamente. Toque em Sincronizar para tentar de novo.', 'warning');
            }
            return false;
        } finally {
            setBusy(false);
            if (showProgress && button) {
                button.disabled = false;
                button.textContent = 'Sincronizar';
            }
        }
    }

    // Disparo automático: escuta o evento emitido pelo cifro-sync.js toda
    // vez que um sync (com ou sem mudança de dados) termina. Só refaz o
    // pacote completo quando a revisão do shell já preparado difere da
    // revisão de dados atual (ou nunca foi preparado) — nunca a cada abertura.
    async function handleSyncChecked(event) {
        const { bandaId, contentRevision } = event.detail || {};
        if (!bandaId || !window.cifroSync) return;
        const status = await cifroSync.getOfflineStatus(bandaId);
        if (status.shellReady && status.shellPreparedRevision === Number(contentRevision)) return;
        runShellOnlyPreparation(bandaId).catch(() => {});
    }

    // Só monta o painel (botão + barra de progresso + status) em páginas que
    // já têm um contêiner de destino dedicado. Em páginas sem esse
    // contêiner (ex.: config.php, que só usa o botão "Sincronizar" próprio
    // dela chamando OfflineTools.forceSync), o listener automático de
    // 'cifro:sync-checked' continua ativo sem criar nenhum elemento na tela.
    function bind() {
        const panel = ensurePanel();
        if (!panel) return;
        renderStatus();
        document.getElementById('prepareOfflineBtn').addEventListener('click', function () {
            runFullPreparation(window.CIFRO_BAND_ID, { force: true, showProgress: true });
        });
        if (localStorage.getItem('cifroAppUpdatePending') === '1' && window.CIFRO_BAND_ID) {
            setStatus('Nova versão encontrada. Atualizando dados e músicas…', 'syncing');
            runFullPreparation(window.CIFRO_BAND_ID, { force: true, showProgress: false }).then(ok => {
                if (ok) localStorage.removeItem('cifroAppUpdatePending');
            });
        }
    }

    window.addEventListener('online', renderStatus);
    window.addEventListener('offline', renderStatus);
    document.addEventListener('cifro:connectivity', renderStatus);
    document.addEventListener('cifro:sync-checked', handleSyncChecked);
    document.addEventListener('cifro:app-update', () => {
        setBusy(true);
        setProgress(5);
        setStatus('Nova versão encontrada. Baixando atualização…', 'syncing');
    });
    window.OfflineTools = {
        prepareOffline: () => runFullPreparation(window.CIFRO_BAND_ID, { force: true, showProgress: true }),
        forceSync: bandaId => runFullPreparation(bandaId || window.CIFRO_BAND_ID, { force: true, showProgress: true }),
        renderStatus,
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind) : bind();
})();
