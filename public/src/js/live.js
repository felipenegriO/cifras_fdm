(function () {
    const salaId = (window.CIFRO_BAND_ID && window.CIFRO_BAND_ID !== '') ? window.CIFRO_BAND_ID : 'default';
    const apiBase = (window.APP_BASE || '') + '/api/live';
    const hostIdKey = 'cifroLiveHostId_' + salaId;
    const modeKey = 'cifroLiveMode_' + salaId;
    const pollMs = 2500;
    const keepAliveMs = 15000;
    const canHost = window.CIFRO_CAN_HOST === true;

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
    let unchangedPolls = 0;
    let lastPublishedScroll = '';
    let scrollPublishTimer = null;

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
        const nome = data && data.hostNome;
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
                hostBtn.textContent = 'Você está transmitindo';
            } else if (Date.now() < hostConfirmUntil) {
                hostBtn.textContent = 'Confirmar início';
            } else {
                hostBtn.textContent = 'Iniciar como líder';
            }
        }

        if (followBtn) {
            followBtn.classList.toggle('active', mode === 'follow');
            followBtn.textContent = mode === 'follow'
                ? 'Sair da sessão'
                : 'Entrar na sessão';
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
        // Quem esta no comando le "Você está exibindo"; quem acompanha le o nome
        // de quem esta exibindo. Antes os dois lados do ternario eram iguais e
        // o host via o proprio nome em terceira pessoa.
        const name = sanitizeText(currentHostName);
        const label = mode === 'host'
            ? '<span class="live-indicator-label">Você está exibindo</span>'
            : (name ? `<span class="live-indicator-label">${name} está exibindo</span>` : '');

        indicator.title = mode === 'host'
            ? 'Você está exibindo'
            : (currentHostName ? currentHostName + ' está exibindo' : 'Seguindo live');
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
            // O tom publicado é sempre o SOANTE. O capotraste/transpose de cada
            // aparelho é escolha pessoal e nunca trafega no live: host com capo 2
            // e seguidor sem capo tocam a mesma música, cada um na sua forma.
            const cifraEl = document.getElementById('song-cifra');
            const displayedTom = String(
                cifraEl?.dataset.tomSoante || document.getElementById('tom')?.textContent || ''
            ).trim();
            const playlistTom = displayedTom || params.get('playlistTom') || '';
            const validTom = /^[A-G](?:#|b)?(?:m)?$/.test(playlistTom);
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
            wrapper.setAttribute('aria-hidden', 'false');
        } else {
            wrapper.style.display = 'none';
            wrapper.setAttribute('aria-hidden', 'true');
            link.removeAttribute('href');
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
        if (!canHost) return;
        if (!navigator.onLine) {
            setDisconnectedStatus();
            return;
        }
        if (!window.CifroConnectivity?.isServerAvailable()
            && navigator.onLine
            && window.CifroConnectivity?.current() === 'verificando') {
            await window.CifroConnectivity.probe().catch(function () { return false; });
        }
        if (!window.CifroConnectivity?.isServerAvailable()) {
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
        if (typeof cifroConfirm === 'function') {
            const confirmed = await cifroConfirm({
                title: 'Virar Host',
                message: 'Você vai assumir o controle da música para todos os participantes.',
                confirmText: 'Virar Host',
                cancelText: 'Cancelar'
            });
            if (confirmed) await assumirHost();
        } else {
            if (confirm('Virar Host? Você vai controlar a música para todos.')) await assumirHost();
        }
    }

    async function atualizarHost(keepAlive) {
        if (getMode() !== 'host' || hostBusy) return;
        if (!window.CifroConnectivity?.isServerAvailable()
            && navigator.onLine
            && window.CifroConnectivity?.current() === 'verificando') {
            await window.CifroConnectivity.probe().catch(function () { return false; });
        }
        if (!window.CifroConnectivity?.isServerAvailable()) {
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
        if (document.visibilityState !== 'hidden') pollingTimer = setTimeout(consultarStatus, pollMs);
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
        if (!window.CifroConnectivity?.isServerAvailable()
            && navigator.onLine
            && window.CifroConnectivity?.current() === 'verificando') {
            await window.CifroConnectivity.probe().catch(function () { return false; });
        }
        if (!window.CifroConnectivity?.isServerAvailable()) {
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
                const incomingVersion = Number(status.version || 0);
                const changed = lastVersion === null || incomingVersion > Number(lastVersion);
                unchangedPolls = changed ? 0 : Math.min(unchangedPolls + 1, 5);
                if (!changed) return;
                lastVersion = incomingVersion;
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
            if (getMode() === 'follow' && document.visibilityState !== 'hidden') {
                clearTimeout(pollingTimer);
                pollingTimer = setTimeout(consultarStatus, pollMs);
            }
        }
    }

    function publishScrollIfChanged() {
        if (getMode() !== 'host' || document.visibilityState === 'hidden') return;
        clearTimeout(scrollPublishTimer);
        scrollPublishTimer = setTimeout(function () {
            const scroll = currentScrollState();
            const signature = scroll.canSync ? `${Math.round(scroll.scrollTop)}:${Math.round(scroll.scrollPercent || 0)}` : 'none';
            if (signature === lastPublishedScroll) return;
            lastPublishedScroll = signature;
            atualizarHost(false);
        }, 350);
    }

    function bind() {
        const hostBtn = document.getElementById('livePlay') || document.getElementById('liveHostButton');
        const followBtn = document.getElementById('entrarlivePlay') || document.getElementById('liveFollowButton');
        const shortcut = document.getElementById('entrarlivePlaynow');

        if (hostBtn && !canHost) {
            hostBtn.hidden = true;
            const leaderAction = hostBtn.closest('.music-leader-action');
            if (leaderAction) leaderAction.hidden = true;
            if (getMode() === 'host') setMode('');
        }

        if (hostBtn && canHost && !hostBtn.dataset.liveBound) {
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

        if (shortcut && !shortcut.dataset.liveBound) {
            shortcut.dataset.liveBound = '1';
            shortcut.addEventListener('click', function () {
                setMode('follow');
                setStatus('Seguindo live', 'follow');
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

    async function resumeAfterServerCheck() {
        if (window.CifroConnectivity && !await window.CifroConnectivity.probe()) {
            setDisconnectedStatus();
            return;
        }
        if (getMode() === 'host') {
            atualizarHost(false);
        } else if (getMode() === 'follow') {
            consultarStatus();
        }
    }

    window.addEventListener('online', function () {
        resumeAfterServerCheck();
    });

    window.addEventListener('scroll', publishScrollIfChanged, { passive: true });
    document.addEventListener('cifro:tom-changed', function () {
        if (getMode() === 'host') atualizarHost(false);
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            stopPolling();
            return;
        }
        if (getMode() === 'follow') {
            resumeAfterServerCheck();
            startPolling();
        } else if (getMode() === 'host') {
            resumeAfterServerCheck();
        }
    });

    window.LiveMode = {
        assumirHost,
        entrarOuSairLive,
        atualizarPaginaHost: atualizarHost,
        consultarStatus,
        // Exposto para que avisos não interrompam quem está no palco.
        getMode
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
