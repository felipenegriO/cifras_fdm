(function () {
    const salaId = 'default';
    const apiBase = '/api/live';
    const hostIdKey = 'fdmLiveHostId_' + salaId;
    const modeKey = 'fdmLiveMode_' + salaId;
    const pollMs = 1800;
    const keepAliveMs = 10000;
    const scrollSyncMs = 700;

    let pollingTimer = null;
    let keepAliveTimer = null;
    let pollingBusy = false;
    let hostBusy = false;
    let lastVersion = null;
    let lastStatusPage = '';
    let currentHostName = '';
    let lastLiveOkAt = null;
    let hostConfirmUntil = 0;
    let hostConfirmTimer = null;
    let statusTicker = null;
    let ignoreFollowerScrollUntil = 0;
    let disconnectedActive = false;

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
        renderLiveIndicator();
    }

    function getHostId() {
        return localStorage.getItem(hostIdKey) || '';
    }

    function setStatus(text, type) {
        const el = document.getElementById('liveStatus');
        if (!el) return;
        el.textContent = text;
        el.dataset.status = type || '';
        disconnectedActive = type === 'offline' && text.indexOf('ultimo contato') >= 0;
    }

    function setLiveOk() {
        lastLiveOkAt = Date.now();
    }

    function setDisconnectedStatus() {
        if (!lastLiveOkAt) {
            setStatus('Live desconectada', 'offline');
            return;
        }

        const seconds = Math.max(1, Math.round((Date.now() - lastLiveOkAt) / 1000));
        setStatus('Live desconectada (ultimo contato ha ' + seconds + 's)', 'offline');
    }

    function sanitizeText(value) {
        return String(value || '').replace(/[<>&"']/g, function (char) {
            return {
                '<': '&lt;',
                '>': '&gt;',
                '&': '&amp;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

    function hostDisplayName(data) {
        const nome = data && (data.hostNome || data.hostUsername);
        return String(nome || '').trim();
    }

    function setCurrentHostName(data) {
        const nome = hostDisplayName(data);
        if (nome) {
            currentHostName = nome;
        }
    }

    function renderButtons() {
        const hostBtn = document.getElementById('livePlay') || document.getElementById('liveHostButton');
        const followBtn = document.getElementById('entrarlivePlay') || document.getElementById('liveFollowButton');
        const mode = getMode();

        if (hostBtn) {
            hostBtn.classList.toggle('active', mode === 'host');
            if (mode === 'host') {
                hostBtn.innerHTML = '<i class="fa-solid fa-broadcast-tower"></i> VOCE E O HOST';
            } else if (Date.now() < hostConfirmUntil) {
                hostBtn.innerHTML = '<i class="fa-solid fa-check"></i> CONFIRMAR HOST';
            } else {
                hostBtn.innerHTML = '<i class="fa-solid fa-broadcast-tower"></i> VIRAR HOST';
            }
        }

        if (followBtn) {
            followBtn.classList.toggle('active', mode === 'follow');
            followBtn.innerHTML = mode === 'follow'
                ? '<i class="fa-solid fa-stop"></i> SAIR DO MODO LIVE'
                : '<i class="fa-solid fa-play"></i> ENTRAR NO MODO LIVE';
        }
    }

    function renderLiveIndicator() {
        let indicator = document.getElementById('liveModeIndicator');
        const mode = getMode();

        if (!mode) {
            if (indicator) {
                indicator.remove();
            }
            return;
        }

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'liveModeIndicator';
            document.body.appendChild(indicator);
        }

        indicator.className = 'live-mode-indicator live-mode-indicator-' + mode;
        const name = sanitizeText(currentHostName);
        const label = name
            ? `<span class="live-indicator-label">${name} ${mode === 'host' ? 'esta exibindo' : 'esta exibindo'}</span>`
            : '';

        indicator.title = mode === 'host'
            ? (currentHostName ? currentHostName + ' esta exibindo' : 'Voce e o host')
            : (currentHostName ? currentHostName + ' esta exibindo' : 'Seguindo live');
        indicator.setAttribute('aria-label', indicator.title);
        indicator.innerHTML = mode === 'host'
            ? '<span class="live-record-dot"></span>' + label
            : '<i class="fa-solid fa-play"></i>' + label;
    }

    function currentPageState() {
        const params = new URLSearchParams(window.location.search);
        const path = window.location.pathname.split('/').pop() || 'index.php';

        if (path === 'music.php') {
            const id = params.get('id') || '';
            const playlistTom = params.get('playlistTom') || '';
            const validTom = /^[A-G](?:#|b)?$/.test(playlistTom);
            const validId = /^\d{1,8}$/.test(id);
            const pagina = validId
                ? 'music.php?id=' + id + (validTom ? '&playlistTom=' + encodeURIComponent(playlistTom) : '')
                : '';
            return {
                cifraAtual: validId ? id : '',
                paginaAtual: pagina,
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

    function getScrollContainer() {
        return document.getElementById('song-cifra') || document.scrollingElement || document.documentElement;
    }

    function currentScrollState() {
        const el = getScrollContainer();
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const scrollTop = Math.max(0, el.scrollTop || 0);
        return {
            scrollTop,
            scrollPercent: max > 0 ? scrollTop / max : 0,
            canSync: max > 8
        };
    }

    function applyFollowerScroll(status) {
        if (getMode() !== 'follow' || Date.now() < ignoreFollowerScrollUntil) return;
        if (!status || !status.canSyncScroll) return;
        const el = getScrollContainer();
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const percent = Number(status.scrollPercent || 0);
        const top = max > 0 ? Math.round(max * Math.max(0, Math.min(1, percent))) : Number(status.scrollTop || 0);
        if (Math.abs((el.scrollTop || 0) - top) > 4) {
            ignoreFollowerScrollUntil = Date.now() + 500;
            el.scrollTop = top;
        }
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
            setDisconnectedStatus();
            return;
        }

        if (!confirmHostStart()) {
            return;
        }

        try {
            const data = await postJson(apiBase + '/host.php', { salaId });
            setLiveOk();
            localStorage.setItem(hostIdKey, data.hostId);
            setCurrentHostName(data);
            setMode('host');
            stopPolling();
            startKeepAlive();
            setStatus('Voce e o host', 'host');
            await atualizarHost(false);
        } catch (error) {
            setDisconnectedStatus();
        }
    }

    function confirmHostStart() {
        return true;
    }

    async function assumirHostComConfirmacao() {
        if (getMode() === 'host') { assumirHost(); return; }
        if (typeof fdmConfirm === 'function') {
            fdmConfirm({
                title: 'Virar Host',
                message: 'Você vai assumir o controle da música para todos os participantes.',
                confirmLabel: 'Virar Host',
                cancelLabel: 'Cancelar',
                onConfirm: function () { assumirHost(); }
            });
        } else {
            if (confirm('Virar Host? Você vai controlar a música para todos.')) assumirHost();
        }
    }

    async function atualizarHost(keepAlive) {
        if (getMode() !== 'host' || hostBusy) return;
        if (!navigator.onLine) {
            setDisconnectedStatus();
            return;
        }

        const hostId = getHostId();
        if (!hostId) {
            setMode('');
            setDisconnectedStatus();
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
            const scroll = currentScrollState();
            if (scroll.canSync) {
                payload.scrollTop = scroll.scrollTop;
                payload.scrollPercent = scroll.scrollPercent;
                payload.canSyncScroll = true;
            } else {
                payload.canSyncScroll = false;
            }

            if (state.podePublicar) {
                payload.cifraAtual = state.cifraAtual;
                payload.paginaAtual = state.paginaAtual;
            }

            const data = await postJson(apiBase + '/update.php', payload);
            setLiveOk();
            setCurrentHostName(data);
            renderLiveIndicator();
            setStatus('Voce e o host', 'host');
        } catch (error) {
            setDisconnectedStatus();
        } finally {
            hostBusy = false;
        }
    }

    function startKeepAlive() {
        stopKeepAlive();
        keepAliveTimer = setInterval(() => atualizarHost(true), keepAliveMs);
        if (getMode() === 'host') {
            window.clearInterval(window.__fdmLiveScrollTimer);
            window.__fdmLiveScrollTimer = setInterval(() => atualizarHost(true), scrollSyncMs);
        }
    }

    function stopKeepAlive() {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }
        if (window.__fdmLiveScrollTimer) {
            clearInterval(window.__fdmLiveScrollTimer);
            window.__fdmLiveScrollTimer = null;
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
            setDisconnectedStatus();
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

            setLiveOk();
            setLiveShortcut(status);
            setCurrentHostName(status);
            renderLiveIndicator();

            if (!status.hasHost) {
                currentHostName = '';
                renderLiveIndicator();
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
                    return;
                }
                applyFollowerScroll(status);
            }
        } catch (error) {
            setDisconnectedStatus();
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
                assumirHostComConfirmacao();
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
        renderLiveIndicator();

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
        setDisconnectedStatus();
    });

    statusTicker = setInterval(function () {
        if (getMode() && lastLiveOkAt && disconnectedActive) {
            setDisconnectedStatus();
        }
    }, 1000);

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
