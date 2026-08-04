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
        const settingsTabs = Array.from(document.querySelectorAll('[data-settings-tab]'));
        const settingsPanels = Array.from(document.querySelectorAll('[data-settings-panel]'));
        let scrolling = false;
        let frame = null;
        let lastTime = 0;

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
            const levels = [14, 22, 34, 50, 72];
            const value = Math.max(1, Math.min(5, Number(speedInput ? speedInput.value : 2)));
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
            if (frame) cancelAnimationFrame(frame);
            frame = null;
            updateAutoScrollUi();
        }

        function autoScrollStep(time) {
            if (!scrolling) return;
            const target = getScrollTarget();
            if (!target) return stopAutoScroll();
            if (!lastTime) lastTime = time;
            const next = target.scrollTop + speedInPixels() * ((time - lastTime) / 1000);
            target.scrollTop = next;
            lastTime = time;
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 2) return stopAutoScroll();
            frame = requestAnimationFrame(autoScrollStep);
        }

        function toggleAutoScroll() {
            if (scrolling) return stopAutoScroll();
            scrolling = true;
            updateAutoScrollUi();
            frame = requestAnimationFrame(autoScrollStep);
        }

        autoScrollButtons.forEach(function (button) {
            button.addEventListener('click', toggleAutoScroll);
        });

        if (speedInput) {
            speedInput.value = safeStorageGet('musicAutoScrollSpeed', '2');
            const updateSpeed = function () {
                safeStorageSet('musicAutoScrollSpeed', speedInput.value);
                if (speedValue) speedValue.textContent = speedInput.value + '/5';
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
            showQuickBar.checked = safeStorageGet('musicShowQuickBar', '0') === '1';
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
                    const autoActive = cifra.classList.contains('auto-columns');
                    if (mode === 'auto') {
                        cifra.dataset.manualColumns = '';
                        cifra.style.columnCount = '';
                        if (!autoActive) columnsSource.click();
                    } else {
                        if (autoActive) columnsSource.click();
                        cifra.dataset.manualColumns = mode;
                        cifra.style.columnCount = mode;
                        cifra.style.columnGap = '2rem';
                    }
                    syncColumnMode(mode);
                });
            });
            new MutationObserver(function () {
                const mode = cifra.classList.contains('auto-columns') ? 'auto' : (cifra.dataset.manualColumns || '1');
                syncColumnMode(mode);
            }).observe(cifra, { attributes: true, attributeFilter: ['class'] });
            syncColumnMode('auto');
        }

        const fontSizeDisplay = document.getElementById('fontSizeDisplay');
        const fontButtons = [document.getElementById('decrease-text'), document.getElementById('increase-text')].filter(Boolean);
        function updateFontSizeDisplay() {
            if (!fontSizeDisplay || !cifra) return;
            fontSizeDisplay.textContent = Math.round(parseFloat(window.getComputedStyle(cifra).fontSize)) + 'px';
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
                    cifra.dataset.manualColumns = '';
                    cifra.style.fontSize = '';
                    cifra.style.columnCount = '';
                }
                if (speedInput) {
                    speedInput.value = '2';
                    speedInput.dispatchEvent(new Event('input'));
                }
                if (showQuickBar) {
                    showQuickBar.checked = false;
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
