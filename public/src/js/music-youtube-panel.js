(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const panelState = window.CifroYoutubePanelState;
        const youtubeModule = window.Rehearsal && window.Rehearsal.youtube;
        if (!panelState || !youtubeModule) return;

        const musicaId = new URLSearchParams(window.location.search).get('id');
        if (!musicaId) return;

        const panel = document.getElementById('youtubePlayerPanel');
        const panelTitle = document.getElementById('youtubePlayerPanelTitle');
        const panelBody = document.getElementById('youtubePlayerPanelBody');
        const btnMinimize = document.getElementById('btnYoutubePanelMinimize');
        const btnRestore = document.getElementById('btnYoutubePanelRestore');
        const btnClose = document.getElementById('btnYoutubePanelClose');
        const btnCloseMini = document.getElementById('btnYoutubePanelCloseMini');
        const linkInput = document.getElementById('youtubeVideoLinkInput');
        const btnTocarAqui = document.getElementById('btnTocarYoutubeAqui');
        const linkError = document.getElementById('youtubeVideoLinkError');
        const showPanelRow = document.getElementById('youtubeShowPanelRow');
        const btnMostrar = document.getElementById('btnMostrarYoutube');
        const showPanelTitle = document.getElementById('youtubeShowPanelTitle');
        if (!panel || !panelTitle || !panelBody) return;

        let current = null; // { videoId, title, state }

        function persist() {
            if (!current) return;
            localStorage.setItem(panelState.storageKey(musicaId), panelState.serialize(current));
        }

        function destroyIframe() {
            panelBody.replaceChildren();
        }

        function createIframe(videoId) {
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId);
            iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
            iframe.setAttribute('allowfullscreen', '');
            panelBody.replaceChildren(iframe);
        }

        function updateShowPanelRow() {
            if (!showPanelRow || !btnMostrar || !showPanelTitle) return;
            if (current && current.state === 'hidden') {
                showPanelTitle.textContent = current.title || current.videoId;
                showPanelRow.hidden = false;
            } else {
                showPanelRow.hidden = true;
            }
        }

        function applyStateToDom() {
            panel.classList.remove('is-open', 'is-minimized');
            if (!current) return;
            if (current.state === 'open') {
                panel.classList.add('is-open');
            } else if (current.state === 'minimized') {
                panel.classList.add('is-minimized');
            }
            panelTitle.textContent = current.title || '';
            updateShowPanelRow();
        }

        function setState(nextState, options) {
            options = options || {};
            if (!current) return;
            const cameFromHidden = current.state === 'hidden';
            current = Object.assign({}, current, { state: nextState });
            if (nextState === 'hidden') {
                destroyIframe();
            } else if (cameFromHidden || options.forceRecreateIframe) {
                createIframe(current.videoId);
            }
            persist();
            applyStateToDom();
        }

        function loadVideo(videoId, title) {
            current = { videoId, title: title || '', state: 'open' };
            createIframe(videoId);
            persist();
            applyStateToDom();
        }

        function showLinkError(message) {
            if (!linkError) return;
            linkError.textContent = message;
            linkError.hidden = false;
        }

        function clearLinkError() {
            if (!linkError) return;
            linkError.hidden = true;
        }

        if (btnTocarAqui && linkInput) {
            btnTocarAqui.addEventListener('click', function () {
                clearLinkError();
                const videoId = youtubeModule.extractYoutubeVideoId(linkInput.value);
                if (!videoId) {
                    showLinkError('Link do YouTube inválido.');
                    return;
                }
                loadVideo(videoId, '');
                youtubeModule.fetchYoutubeMeta(videoId).then(function (meta) {
                    if (!meta || !current || current.videoId !== videoId) return;
                    current = Object.assign({}, current, { title: meta.title });
                    persist();
                    applyStateToDom();
                });
            });
        }

        if (btnMinimize) btnMinimize.addEventListener('click', function () { setState('minimized'); });
        if (btnRestore) btnRestore.addEventListener('click', function () { setState('open'); });
        if (btnClose) btnClose.addEventListener('click', function () { setState('hidden'); });
        if (btnCloseMini) btnCloseMini.addEventListener('click', function () { setState('hidden'); });

        // Clique na miniatura (fora dos botões da mini-bar) restaura.
        panel.addEventListener('click', function (event) {
            if (!panel.classList.contains('is-minimized')) return;
            if (event.target.closest('.yt-panel__mini-bar')) return;
            setState('open');
        });

        if (btnMostrar) {
            btnMostrar.addEventListener('click', function () {
                if (!current) return;
                setState('open', { forceRecreateIframe: true });
            });
        }

        // Restaura o estado salvo ao carregar a página.
        const stored = panelState.parseStored(localStorage.getItem(panelState.storageKey(musicaId)));
        if (stored) {
            current = stored;
            if (stored.state === 'hidden') {
                applyStateToDom();
            } else {
                createIframe(stored.videoId);
                applyStateToDom();
            }
        }
    });
})();
