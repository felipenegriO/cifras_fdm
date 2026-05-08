(function () {
    const salaId = 'default';
    const apiBase = '/api/live';
    const hostIdKey = 'fdmLiveHostId_' + salaId;
    const modeKey = 'fdmLiveMode_' + salaId;
    const pollMs = 1800;
    const keepAliveMs = 10000;

    let pollingTimer = null;
    let keepAliveTimer = null;
    let pollingBusy = false;
    let hostBusy = false;
    let lastVersion = null;
    let lastStatusPage = '';

    function getMode() {
        return sessionStorage.getItem(modeKey) || '';
    }

    function setMode(mode) {
        if (mode) {
            sessionStorage.setItem(modeKey, mode);
        } else {
            sessionStorage.removeItem(modeKey);
        }
        renderButtons();
    }

    function getHostId() {
        return localStorage.getItem(hostIdKey) || '';
    }

    function setStatus(text, type) {
        const el = document.getElementById('liveStatus');
        if (!el) return;
        el.textContent = text;
        el.dataset.status = type || '';
    }

    function renderButtons() {
        const hostBtn = document.getElementById('livePlay') || document.getElementById('liveHostButton');
        const followBtn = document.getElementById('entrarlivePlay') || document.getElementById('liveFollowButton');
        const mode = getMode();

        if (hostBtn) {
            hostBtn.classList.toggle('active', mode === 'host');
            hostBtn.innerHTML = mode === 'host'
                ? '<i class="fa-solid fa-broadcast-tower"></i> VOCE E O HOST'
                : '<i class="fa-solid fa-broadcast-tower"></i> VIRAR HOST';
        }

        if (followBtn) {
            followBtn.classList.toggle('active', mode === 'follow');
            followBtn.innerHTML = mode === 'follow'
                ? '<i class="fa-solid fa-stop"></i> SAIR DO MODO LIVE'
                : '<i class="fa-solid fa-play"></i> ENTRAR NO MODO LIVE';
        }
    }

    function currentPageState() {
        const params = new URLSearchParams(window.location.search);
        const path = window.location.pathname.split('/').pop() || 'index.php';

        if (path === 'music.php') {
            const id = params.get('id') || '';
            const validId = /^\d{1,8}$/.test(id);
            return {
                cifraAtual: validId ? id : '',
                paginaAtual: validId ? 'music.php?id=' + id : '',
                podePublicar: validId
            };
        }

        if (path === 'roteiro.php') {
            return {
                cifraAtual: '',
                paginaAtual: '',
                podePublicar: false
            };
        }

        return {
            cifraAtual: '',
            paginaAtual: '',
            podePublicar: false
        };
    }

    function samePage(paginaAtual) {
        return paginaAtual === currentPageState().paginaAtual;
    }

    function setLiveShortcut(status) {
        const wrapper = document.getElementById('mostrarbtnplay');
        const link = document.getElementById('entrarlivePlaynow');
        if (!wrapper || !link) return;

        const canShow = status && status.hasHost && status.paginaAtual
            && status.paginaAtual !== 'index.php'
            && !samePage(status.paginaAtual)
            && getMode() !== 'follow';

        if (canShow) {
            link.href = status.paginaAtual;
            link.innerHTML = '<i class="fa-solid fa-play"></i> IR PARA LIVE';
            wrapper.style.display = 'block';
        } else {
            wrapper.style.display = 'none';
        }

        if (window.__reflowCifra) {
            window.__reflowCifra();
        }
    }

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erro na live');
        }
        return data;
    }

    async function assumirHost() {
        if (!navigator.onLine) {
            setStatus('Live desconectada', 'offline');
            return;
        }

        try {
            const data = await postJson(apiBase + '/host.php', { salaId });
            localStorage.setItem(hostIdKey, data.hostId);
            setMode('host');
            stopPolling();
            startKeepAlive();
            setStatus('Voce e o host', 'host');
            await atualizarHost(false);
        } catch (error) {
            setStatus('Live desconectada', 'offline');
        }
    }

    async function atualizarHost(keepAlive) {
        if (getMode() !== 'host' || hostBusy) return;
        if (!navigator.onLine) {
            setStatus('Live desconectada', 'offline');
            return;
        }

        const hostId = getHostId();
        if (!hostId) {
            setMode('');
            setStatus('Live desconectada', 'offline');
            return;
        }

        hostBusy = true;
        try {
            const state = currentPageState();
            const payload = {
                salaId,
                hostId,
                keepAlive: !!keepAlive || !state.podePublicar
            };

            if (state.podePublicar) {
                payload.cifraAtual = state.cifraAtual;
                payload.paginaAtual = state.paginaAtual;
            }

            await postJson(apiBase + '/update.php', payload);
            setStatus('Voce e o host', 'host');
        } catch (error) {
            setStatus('Live desconectada', 'offline');
        } finally {
            hostBusy = false;
        }
    }

    function startKeepAlive() {
        stopKeepAlive();
        keepAliveTimer = setInterval(() => atualizarHost(true), keepAliveMs);
    }

    function stopKeepAlive() {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }
    }

    function entrarOuSairLive() {
        if (getMode() === 'follow') {
            setMode('');
            stopPolling();
            setStatus('Live desconectada', 'offline');
            setLiveShortcut(null);
            return;
        }

        stopKeepAlive();
        setMode('follow');
        setStatus('Seguindo live', 'follow');
        consultarStatus();
        startPolling();
    }

    function startPolling() {
        stopPolling();
        pollingTimer = setInterval(consultarStatus, pollMs);
    }

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
        pollingBusy = false;
    }

    async function consultarStatus() {
        if (pollingBusy) return;
        if (!navigator.onLine) {
            setStatus('Live desconectada', 'offline');
            return;
        }

        pollingBusy = true;
        try {
            const response = await fetch(apiBase + '/status.php?salaId=' + encodeURIComponent(salaId) + '&t=' + Date.now(), {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-store'
                }
            });
            const status = await response.json();

            if (!response.ok || !status.success) {
                throw new Error(status.message || 'Erro na live');
            }

            setLiveShortcut(status);

            if (!status.hasHost) {
                setStatus('Aguardando host', 'waiting');
                return;
            }

            if (getMode() === 'follow') {
                setStatus('Seguindo live', 'follow');
                const changed = lastVersion !== status.version || lastStatusPage !== status.paginaAtual;
                lastVersion = status.version;
                lastStatusPage = status.paginaAtual;

                if (changed && status.paginaAtual && status.paginaAtual !== 'index.php' && !samePage(status.paginaAtual)) {
                    window.location.href = status.paginaAtual;
                }
            }
        } catch (error) {
            setStatus('Live desconectada', 'offline');
        } finally {
            pollingBusy = false;
        }
    }

    function bind() {
        const hostBtn = document.getElementById('livePlay') || document.getElementById('liveHostButton');
        const followBtn = document.getElementById('entrarlivePlay') || document.getElementById('liveFollowButton');

        if (hostBtn && !hostBtn.dataset.liveBound) {
            hostBtn.dataset.liveBound = '1';
            hostBtn.addEventListener('click', function (event) {
                event.preventDefault();
                assumirHost();
            });
        }

        if (followBtn && !followBtn.dataset.liveBound) {
            followBtn.dataset.liveBound = '1';
            followBtn.addEventListener('click', function (event) {
                event.preventDefault();
                entrarOuSairLive();
            });
        }

        renderButtons();

        if (getMode() === 'host') {
            setStatus('Voce e o host', 'host');
            atualizarHost(false);
            startKeepAlive();
        } else if (getMode() === 'follow') {
            setStatus('Seguindo live', 'follow');
            consultarStatus();
            startPolling();
        } else {
            consultarStatus();
        }
    }

    window.addEventListener('offline', function () {
        setStatus('Live desconectada', 'offline');
    });

    window.addEventListener('online', function () {
        if (getMode() === 'host') {
            atualizarHost(false);
        } else {
            consultarStatus();
        }
    });

    window.LiveMode = {
        assumirHost,
        entrarOuSairLive,
        atualizarPaginaHost: atualizarHost,
        consultarStatus
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
