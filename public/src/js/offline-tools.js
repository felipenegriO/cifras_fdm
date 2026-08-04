(function () {
    const preparedAtKey = 'cifroOfflinePreparedAt';

    function formatDate(timestamp) {
        if (!timestamp) return 'nunca';
        return new Date(Number(timestamp)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function ensurePanel() {
        let panel = document.getElementById('offlineToolsPanel');
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'offlineToolsPanel';
        panel.className = 'offline-tools-panel';
        panel.innerHTML = '<button type="button" class="btn btn-primary mt-3" id="prepareOfflineBtn">Preparar para offline</button><div class="offline-progress"><div id="offlineProgressBar"></div></div><div id="offlineToolsStatus" class="offline-tools-status"></div>';
        (document.getElementById('offlineToolsMount') || document.getElementById('menusideMenu') || document.body).appendChild(panel);
        return panel;
    }

    function setStatus(text, type) {
        ensurePanel();
        const status = document.getElementById('offlineToolsStatus');
        status.textContent = text;
        status.dataset.status = type || '';
    }

    function setProgress(percent) {
        const bar = document.getElementById('offlineProgressBar');
        if (bar) bar.style.width = percent + '%';
    }

    async function renderStatus() {
        const ready = localStorage.getItem(preparedAtKey);
        const status = window.cifroSync ? await cifroSync.getSyncStatus(window.CIFRO_BAND_ID) : null;
        const state = status?.snapshotValid ? 'Pronto para palco' : 'Pacote não validado';
        const details = status ? ` | revisão ${status.contentRevision} | sincronizado ${formatDate(status.lastSync)} | app ${status.appVersion}` : '';
        const serverAvailable = window.CifroConnectivity?.isServerAvailable() || false;
        setStatus(`${state} | ${serverAvailable ? 'Servidor disponível' : 'Servidor indisponível'} | preparado em ${formatDate(ready)}${details}`, status?.snapshotValid ? 'online' : 'offline');
    }

    async function prepareShell() {
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker indisponível')), 3000))
        ]);
        const worker = registration.active || registration.waiting;
        if (!worker) throw new Error('Service worker indisponível');
        return new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const timer = setTimeout(() => reject(new Error('Tempo excedido')), 20000);
            channel.port1.onmessage = event => {
                clearTimeout(timer);
                event.data?.ok ? resolve(event.data) : reject(new Error(event.data?.error || 'Falha no pacote'));
            };
            worker.postMessage({
                type: 'PREPARE_OFFLINE',
                userId: window.CIFRO_USER_ID,
                bandId: window.CIFRO_BAND_ID,
                songIds: (Array.isArray(window.songs) ? window.songs : []).map(song => song.id)
            }, [channel.port2]);
        });
    }

    async function prepareOffline() {
        if (!(await window.CifroConnectivity?.probe({ force: true }))) {
            setStatus('Servidor indisponível — a versão salva continua disponível. Tente preparar novamente quando a conexão voltar.', 'offline');
            return;
        }
        const button = document.getElementById('prepareOfflineBtn');
        button.disabled = true;
        button.textContent = 'Preparando...';
        setProgress(10);
        try {
            const synced = await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
            if (!synced) throw new Error('Falha ao atualizar os dados');
            setProgress(55);
            await prepareShell();
            setProgress(90);
            if (navigator.storage?.persist) await navigator.storage.persist();
            if (!(await cifroSync.markPrepared(window.CIFRO_BAND_ID))) throw new Error('Dados offline não validados');
            localStorage.setItem(preparedAtKey, String(Date.now()));
            setProgress(100);
            await renderStatus();
            if (window.cifroToast) cifroToast('Pacote offline validado.', 'success');
        } catch (error) {
            setProgress(0);
            setStatus(`Não foi possível atualizar o pacote — a versão salva foi mantida. ${error.message || 'Tente novamente mais tarde.'}`, 'offline');
        } finally {
            button.disabled = false;
            button.textContent = 'Preparar para offline';
        }
    }

    function bind() {
        ensurePanel();
        renderStatus();
        document.getElementById('prepareOfflineBtn').addEventListener('click', prepareOffline);
    }

    window.addEventListener('online', renderStatus);
    window.addEventListener('offline', renderStatus);
    document.addEventListener('cifro:connectivity', renderStatus);
    window.OfflineTools = { prepareOffline, renderStatus };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind) : bind();
})();
