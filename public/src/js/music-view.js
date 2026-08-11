(function () {
    function safeStorageGet(key, fallback) {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            return;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const cifra = document.getElementById('song-cifra');
        const title = document.getElementById('song-title');
        const menu = document.getElementById('menusideMenu');
        const playlists = document.getElementById('sideMenu');
        const connection = document.getElementById('connectionStatus');
        const autoScrollButtons = [
            document.getElementById('quickAutoScroll'),
            document.getElementById('autoScrollToggle')
        ].filter(Boolean);
        const speedInput = document.getElementById('autoScrollSpeed');
        const speedValue = document.getElementById('autoScrollSpeedValue');
        const quickBar = document.getElementById('musicQuickBar');
        const showQuickBar = document.getElementById('showQuickBar');
        const fullscreenBtn = document.getElementById('headerFullscreenBtn');
        const settingsTabs = Array.from(document.querySelectorAll('[data-settings-tab]'));
        const settingsPanels = Array.from(document.querySelectorAll('[data-settings-panel]'));
        let scrolling = false;
        let frame = null;
        let lastTime = 0;
        let scrollAccumulator = 0;
        let savedCifraOverflowY = null;

        // ── Fullscreen ──────────────────────────────────────────────
        function updateFullscreenBtn() {
            if (!fullscreenBtn) return;
            fullscreenBtn.style.display = document.fullscreenElement ? '' : 'none';
        }

        function requestFullscreen() {
            if (document.fullscreenElement) return;
            const target = document.documentElement;
            if (target.requestFullscreen) {
                target.requestFullscreen().catch(function () {});
            }
        }

        document.addEventListener('fullscreenchange', updateFullscreenBtn);
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function () {
                if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
            });
        }
        requestFullscreen();

        // ── Wake Lock ───────────────────────────────────────────────
        let wakeLock = null;

        async function requestWakeLock() {
            if (!('wakeLock' in navigator)) return;
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', function () { wakeLock = null; });
            } catch (e) {}
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
        });
        requestWakeLock();

        // ── Setlist ─────────────────────────────────────────────────
        function loadSetlist() {
            try {
                const raw = sessionStorage.getItem('cifroSetlist');
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;
                const currentId = parseInt(new URLSearchParams(location.search).get('id'), 10);
                let idx = data.items.findIndex(function (it) { return parseInt(it.id, 10) === currentId; });
                if (idx < 0) idx = (typeof data.currentIndex === 'number') ? data.currentIndex : 0;
                data.currentIndex = idx;
                return data;
            } catch (e) { return null; }
        }

        const setlist = loadSetlist();

        function navigateSetlist(direction) {
            if (!setlist) return;
            const newIndex = setlist.currentIndex + direction;
            if (newIndex < 0 || newIndex >= setlist.items.length) return;
            const next = setlist.items[newIndex];
            setlist.currentIndex = newIndex;
            try { sessionStorage.setItem('cifroSetlist', JSON.stringify(setlist)); } catch (e) {}
            const params = new URLSearchParams();
            params.set('id', next.id);
            if (next.tom) params.set('playlistTom', next.tom);
            location.href = 'music.php?' + params.toString();
        }

        if (setlist) {
            let swipeStartX = 0, swipeStartY = 0, swipeT0 = 0;
            const swipeTarget = cifra || document.body;
            swipeTarget.addEventListener('touchstart', function (e) {
                const t = e.touches[0];
                swipeStartX = t.clientX; swipeStartY = t.clientY; swipeT0 = Date.now();
            }, { passive: true });
            swipeTarget.addEventListener('touchend', function (e) {
                const t = e.changedTouches[0];
                const dx = t.clientX - swipeStartX;
                const dy = t.clientY - swipeStartY;
                if (Date.now() - swipeT0 > 600 || Math.abs(dx) < 80) return;
                if (Math.abs(dy) > Math.abs(dx) * 0.58) return;
                navigateSetlist(dx < 0 ? 1 : -1);
            }, { passive: true });
        }

        function setDrawerState(drawer, open) {
            if (!drawer) return;
            drawer.setAttribute('aria-hidden', String(!open));
        }

        function closeDrawers() {
            [menu, playlists].forEach(function (drawer) {
                if (!drawer) return;
                drawer.style.right = '-100%';
                setDrawerState(drawer, false);
            });
        }

        [menu, playlists].forEach(function (drawer) {
            if (!drawer) return;
            new MutationObserver(function () {
                setDrawerState(drawer, drawer.style.right === '0px' || drawer.style.right === '0');
            }).observe(drawer, { attributes: true, attributeFilter: ['style'] });
        });

        function updateConnection() {
            if (!connection) return;
            const available = window.CifroConnectivity?.isServerAvailable() || false;
            connection.dataset.online = String(available);
            connection.textContent = available ? 'Servidor disponível' : 'Versão local';
        }

        function getScrollTarget() {
            if (cifra && cifra.scrollHeight > cifra.clientHeight + 2) return cifra;
            return document.scrollingElement;
        }

        function speedInPixels() {
            const levels = [3, 4, 6, 9, 13, 18, 26, 38, 54, 75];
            const value = Math.max(1, Math.min(10, Number(speedInput ? speedInput.value : 5)));
            return levels[value - 1];
        }

        function updateAutoScrollUi() {
            autoScrollButtons.forEach(function (button) {
                button.setAttribute('aria-pressed', String(scrolling));
                if (button.id === 'autoScrollToggle') {
                    button.textContent = scrolling ? 'Pausar' : 'Iniciar';
                }
            });
        }

        function stopAutoScroll() {
            scrolling = false;
            lastTime = 0;
            scrollAccumulator = 0;
            if (frame) cancelAnimationFrame(frame);
            frame = null;
            if (savedCifraOverflowY !== null && cifra) {
                cifra.style.overflowY = savedCifraOverflowY;
                savedCifraOverflowY = null;
            }
            updateAutoScrollUi();
        }

        function autoScrollStep(time) {
            if (!scrolling) return;
            const target = getScrollTarget();
            if (!target) return stopAutoScroll();
            if (!lastTime) lastTime = time;
            const dt = time - lastTime;
            lastTime = time;
            scrollAccumulator += speedInPixels() * (dt / 1000);
            if (scrollAccumulator >= 1) {
                const px = Math.floor(scrollAccumulator);
                scrollAccumulator -= px;
                const before = target.scrollTop;
                target.scrollTop = before + px;
                if (target.scrollTop === before && before + target.clientHeight >= target.scrollHeight - 2) return stopAutoScroll();
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 2) return stopAutoScroll();
            }
            frame = requestAnimationFrame(autoScrollStep);
        }

        function toggleAutoScroll() {
            if (scrolling) return stopAutoScroll();
            // Quando auto-columns está ativo com overflow-y:hidden, libera o overflow do cifra
            // para que o scroll funcione internamente (mesmo comportamento da apresentação).
            // Só desabilita auto-columns se o cifra genuinamente não tiver conteúdo a rolar.
            if (cifra && cifra.classList.contains('auto-columns')) {
                const computedOY = window.getComputedStyle(cifra).overflowY;
                if (computedOY === 'hidden' || cifra.style.overflowY === 'hidden') {
                    savedCifraOverflowY = cifra.style.overflowY;
                    cifra.style.overflowY = 'auto';
                }
                // Se mesmo com scroll liberado não há conteúdo a rolar, desabilita auto-columns.
                if (cifra.scrollHeight <= cifra.clientHeight + 2) {
                    cifra.style.overflowY = savedCifraOverflowY !== null ? savedCifraOverflowY : '';
                    savedCifraOverflowY = null;
                    const toggleColumnsBtn = document.getElementById('toggle-columns');
                    if (toggleColumnsBtn) toggleColumnsBtn.click();
                }
            }
            scrolling = true;
            updateAutoScrollUi();
            frame = requestAnimationFrame(autoScrollStep);
        }

        autoScrollButtons.forEach(function (button) {
            button.addEventListener('click', toggleAutoScroll);
        });

        if (speedInput) {
            speedInput.value = safeStorageGet('musicAutoScrollSpeed', '5');
            const updateSpeed = function () {
                safeStorageSet('musicAutoScrollSpeed', speedInput.value);
                if (speedValue) speedValue.textContent = speedInput.value + '/10';
            };
            speedInput.addEventListener('input', updateSpeed);
            updateSpeed();
        }

        function updateQuickBar() {
            if (!quickBar || !showQuickBar) return;
            const visible = showQuickBar.checked;
            quickBar.classList.toggle('is-hidden', !visible);
            quickBar.setAttribute('aria-hidden', String(!visible));
            document.body.classList.toggle('has-quick-bar', visible);
            safeStorageSet('musicShowQuickBar', visible ? '1' : '0');
        }

        if (showQuickBar) {
            const mobileDefault = window.matchMedia('(max-width: 768px)').matches ? '1' : '0';
            showQuickBar.checked = safeStorageGet('musicShowQuickBar', mobileDefault) === '1';
            showQuickBar.addEventListener('change', updateQuickBar);
            updateQuickBar();
        }

        function activateSettingsTab(name, focus) {
            settingsTabs.forEach(function (tabButton) {
                const active = tabButton.dataset.settingsTab === name;
                tabButton.classList.toggle('is-active', active);
                tabButton.setAttribute('aria-selected', String(active));
                tabButton.tabIndex = active ? 0 : -1;
                if (active && focus) tabButton.focus();
            });
            settingsPanels.forEach(function (panel) {
                panel.hidden = panel.dataset.settingsPanel !== name;
            });
            safeStorageSet('musicSettingsTab', name);
        }

        settingsTabs.forEach(function (tabButton, index) {
            tabButton.addEventListener('click', function () {
                activateSettingsTab(tabButton.dataset.settingsTab, false);
            });
            tabButton.addEventListener('keydown', function (event) {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const next = (index + direction + settingsTabs.length) % settingsTabs.length;
                activateSettingsTab(settingsTabs[next].dataset.settingsTab, true);
            });
        });

        if (settingsTabs.length) {
            const savedTab = safeStorageGet('musicSettingsTab', 'reading');
            const initialTab = settingsTabs.some(function (tabButton) {
                return tabButton.dataset.settingsTab === savedTab;
            }) ? savedTab : 'reading';
            activateSettingsTab(initialTab, false);
        }

        document.querySelectorAll('[data-music-action]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                const target = document.getElementById(button.dataset.musicAction);
                if (button.dataset.musicAction === 'menuButton' || button.dataset.musicAction === 'playlistButton') {
                    event.stopPropagation();
                }
                if (target) target.click();
            });
        });

        const lyricSource = document.getElementById('toggle-cifra-letra');
        const lyricQuick = document.getElementById('quickLyrics');
        const viewModeButtons = Array.from(document.querySelectorAll('[data-view-mode]'));
        if (lyricSource) {
            const syncLyrics = function () {
                const lyricsActive = lyricSource.classList.contains('active');
                if (lyricQuick) lyricQuick.setAttribute('aria-pressed', String(lyricsActive));
                viewModeButtons.forEach(function (button) {
                    button.setAttribute('aria-pressed', String((button.dataset.viewMode === 'lyrics') === lyricsActive));
                });
            };
            new MutationObserver(syncLyrics).observe(lyricSource, { attributes: true, attributeFilter: ['class'] });
            viewModeButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    const wantsLyrics = button.dataset.viewMode === 'lyrics';
                    if (wantsLyrics !== lyricSource.classList.contains('active')) lyricSource.click();
                    syncLyrics();
                });
            });
            syncLyrics();
        }

        const columnsSource = document.getElementById('toggle-columns');
        const columnModeButtons = Array.from(document.querySelectorAll('[data-column-mode]'));
        function syncColumnMode(mode) {
            columnModeButtons.forEach(function (button) {
                button.setAttribute('aria-pressed', String(button.dataset.columnMode === mode));
            });
        }

        if (columnsSource && cifra) {
            columnModeButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    const mode = button.dataset.columnMode;
                    // Garante que o layout automático está sempre ativo.
                    // Os modos 1/2/3 apenas forçam o número de colunas dentro do algoritmo.
                    if (!cifra.classList.contains('auto-columns')) {
                        cifra.classList.add('auto-columns');
                        columnsSource.classList.add('active');
                        columnsSource.textContent = 'Desativar ajuste automático';
                    }
                    if (mode === 'auto') {
                        cifra.dataset.forceMaxColumns = '';
                        cifra.dataset.forceMinColumns = '';
                    } else {
                        cifra.dataset.forceMaxColumns = mode;
                        cifra.dataset.forceMinColumns = mode;
                    }
                    syncColumnMode(mode);
                    if (window.__reflowCifra) window.__reflowCifra();
                });
            });
            new MutationObserver(function () {
                if (!cifra.classList.contains('auto-columns')) return;
                const forced = cifra.dataset.forceMaxColumns;
                const mode = (forced && ['1', '2', '3'].includes(forced)) ? forced : 'auto';
                syncColumnMode(mode);
            }).observe(cifra, { attributes: true, attributeFilter: ['class'] });
            syncColumnMode('auto');
        }

        const fontSizeDisplay = document.getElementById('fontSizeDisplay');
        const fontButtons = [document.getElementById('decrease-text'), document.getElementById('increase-text')].filter(Boolean);
        function updateFontSizeDisplay() {
            if (!fontSizeDisplay || !cifra) return;
            fontSizeDisplay.textContent = Math.round(parseFloat(window.getComputedStyle(cifra).fontSize));
        }
        fontButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                requestAnimationFrame(updateFontSizeDisplay);
            });
        });
        if (cifra) {
            new MutationObserver(updateFontSizeDisplay).observe(cifra, { attributes: true, attributeFilter: ['style'] });
        }
        updateFontSizeDisplay();

        document.querySelectorAll('.music-tool').forEach(function (tool) {
            tool.addEventListener('toggle', function () {
                if (!tool.open) return;
                document.querySelectorAll('.music-tool').forEach(function (other) {
                    if (other !== tool) other.open = false;
                });
            });
        });

        const resetReadingSettings = document.getElementById('resetReadingSettings');
        if (resetReadingSettings) {
            resetReadingSettings.addEventListener('click', function () {
                stopAutoScroll();
                if (lyricSource && lyricSource.classList.contains('active')) lyricSource.click();
                if (columnsSource && cifra && !cifra.classList.contains('auto-columns')) columnsSource.click();
                if (cifra) {
                    cifra.dataset.forceMaxColumns = '';
                    cifra.dataset.forceMinColumns = '';
                    cifra.style.fontSize = '';
                    cifra.style.columnCount = '';
                }
                if (speedInput) {
                    speedInput.value = '5';
                    speedInput.dispatchEvent(new Event('input'));
                }
                if (showQuickBar) {
                    showQuickBar.checked = window.matchMedia('(max-width: 768px)').matches;
                    updateQuickBar();
                }
                if (window.__reflowCifra) window.__reflowCifra();
                syncColumnMode('auto');
                updateFontSizeDisplay();
            });
        }

        if (title) {
            const syncTitle = function () {
                const value = title.textContent.trim();
                if (value && value !== 'Carregando música…') document.title = value + ' — Cifrô';
            };
            new MutationObserver(syncTitle).observe(title, { childList: true, subtree: true });
            syncTitle();
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeDrawers();
                stopAutoScroll();
            }
            if (event.code === 'Space' && !event.target.closest('input, textarea, select, button, a')) {
                event.preventDefault();
                toggleAutoScroll();
            }
            if (setlist && (event.key === 'ArrowRight' || event.key === 'PageDown')) {
                if (!event.target.closest('input, textarea, select')) {
                    event.preventDefault();
                    navigateSetlist(1);
                }
            }
            if (setlist && (event.key === 'ArrowLeft' || event.key === 'PageUp')) {
                if (!event.target.closest('input, textarea, select')) {
                    event.preventDefault();
                    navigateSetlist(-1);
                }
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stopAutoScroll();
        });
        window.addEventListener('online', updateConnection);
        window.addEventListener('offline', updateConnection);
        document.addEventListener('cifro:connectivity', updateConnection);
        updateConnection();
        updateAutoScrollUi();
    });
})();
