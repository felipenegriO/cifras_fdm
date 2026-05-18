(function () {
    const preparedAtKey = 'fdmOfflinePreparedAt';
    const coreUrls = [
        '/',
        '/index.php',
        '/music.php',
        '/roteiro.php',
        '/src/js/musicas.js',
        '/src/js/playlists.js',
        '/src/js/playlists_salvas.js',
        '/src/js/roteiros_salvos.js',
        '/src/js/live.js',
        '/src/js/offline-tools.js',
        '/src/js/script.js',
        '/src/css/bootstrap.min.css',
        '/src/css/style2.css',
        '/src/css/rehearsal.css',
        '/offline.php'
    ];

    function formatDate(timestamp) {
        if (!timestamp) return 'Nunca preparado';
        const date = new Date(Number(timestamp));
        if (Number.isNaN(date.getTime())) return 'Nunca preparado';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function ensurePanel() {
        let panel = document.getElementById('offlineToolsPanel');
        if (panel) return panel;

        const menu = document.getElementById('menusideMenu') || document.body;
        panel = document.createElement('div');
        panel.id = 'offlineToolsPanel';
        panel.className = 'offline-tools-panel';
        panel.innerHTML = [
            '<button type="button" class="btn btn-primary mt-3" id="prepareOfflineBtn">Preparar para offline</button>',
            '<div class="offline-progress"><div id="offlineProgressBar"></div></div>',
            '<div id="offlineToolsStatus" class="offline-tools-status"></div>'
        ].join('');
        menu.appendChild(panel);
        return panel;
    }

    function setStatus(text, type) {
        ensurePanel();
        const status = document.getElementById('offlineToolsStatus');
        if (!status) return;
        status.textContent = text;
        status.dataset.status = type || '';
    }

    function setProgress(done, total) {
        ensurePanel();
        const bar = document.getElementById('offlineProgressBar');
        if (!bar) return;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        bar.style.width = percent + '%';
        bar.textContent = percent > 0 && percent < 100 ? percent + '%' : '';
    }

    function renderStatus() {
        const preparedAt = localStorage.getItem(preparedAtKey);
        const prefix = navigator.onLine ? 'Online' : 'Offline';
        setStatus(prefix + ' | pacote offline preparado em: ' + formatDate(preparedAt), navigator.onLine ? 'online' : 'offline');
    }

    async function updateServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            await registration.update();
        }
    }

    async function prepareOffline() {
        if (!navigator.onLine) {
            setStatus('Sem internet para atualizar o offline.', 'offline');
            return;
        }

        const button = document.getElementById('prepareOfflineBtn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Preparando...';
        }

        try {
            const cache = 'caches' in window ? await caches.open('fdm-offline-manual') : null;
            setProgress(0, coreUrls.length);
            await updateServiceWorker();
            for (let i = 0; i < coreUrls.length; i += 1) {
                const url = coreUrls[i];
                setStatus('Atualizando pacote offline ' + (i + 1) + '/' + coreUrls.length + ': ' + url, 'online');
                const response = await fetch(url, { cache: 'reload' });
                if (!response.ok) throw new Error(url);
                if (cache) {
                    await cache.put(url, response.clone());
                }
                setProgress(i + 1, coreUrls.length);
            }

            localStorage.setItem(preparedAtKey, String(Date.now()));
            renderStatus();
            alert('Offline preparado com sucesso. Isso vale para as cifras e listas existentes agora; musicas novas precisam preparar offline de novo.');
        } catch (error) {
            setStatus('Falha ao preparar offline. Verifique a conexao.', 'offline');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Preparar para offline';
            }
        }
    }

    function bind() {
        ensurePanel();
        renderStatus();

        const button = document.getElementById('prepareOfflineBtn');
        if (button && !button.dataset.offlineBound) {
            button.dataset.offlineBound = '1';
            button.addEventListener('click', prepareOffline);
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(function (registration) {
                if (!registration) return;
                registration.addEventListener('updatefound', function () {
                    setStatus('Atualizacao encontrada. Feche e abra o app para usar a versao nova.', 'online');
                });
            });
        }
    }

    window.addEventListener('online', renderStatus);
    window.addEventListener('offline', renderStatus);

    window.OfflineTools = {
        prepareOffline,
        renderStatus
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
