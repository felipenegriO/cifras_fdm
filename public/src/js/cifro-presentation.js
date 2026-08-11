/**
 * Modo Apresentação + Rolagem Automática
 * Etapa 4 — Cifras CIFRO
 *
 * Uso: setup automático se houver #song-cifra na página.
 * - Botões: #cifroPresentToggle, #cifroAutoScrollToggle (criados pelo init)
 * - Atalhos: Esc sai do modo apresentação; espaço pausa/retoma scroll
 */
(function () {
    if (window.cifroPresentation) return;

    var SPEEDS = { slow: 0.5, normal: 1.0, fast: 1.7 };
    var state = {
        presenting: false,
        scrolling: false,
        speed: 'normal',
        rafId: null,
        wakeLock: null,
        accumulator: 0,
        lastTimestamp: 0,
        setlist: null
    };

    function loadSetlist() {
        try {
            var raw = sessionStorage.getItem('cifroSetlist');
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;
            var params = new URLSearchParams(location.search);
            var currentId = parseInt(params.get('id'), 10);
            var idx = data.items.findIndex(function (it) { return parseInt(it.id, 10) === currentId; });
            if (idx < 0) idx = (typeof data.currentIndex === 'number') ? data.currentIndex : 0;
            data.currentIndex = idx;
            return data;
        } catch (e) { return null; }
    }

    function navigateSetlist(direction) {
        if (!state.setlist) return;
        var newIndex = state.setlist.currentIndex + direction;
        if (newIndex < 0 || newIndex >= state.setlist.items.length) {
            window.cifroToast && cifroToast(direction > 0 ? 'Última música da setlist' : 'Primeira música da setlist', 'info', { duration: 1500 });
            return;
        }
        var next = state.setlist.items[newIndex];
        state.setlist.currentIndex = newIndex;
        try { sessionStorage.setItem('cifroSetlist', JSON.stringify(state.setlist)); } catch (e) {}
        var params = new URLSearchParams();
        params.set('id', next.id);
        if (next.tom) params.set('playlistTom', next.tom);
        location.href = 'music.php?' + params.toString();
    }

    function injectStyles() {
        if (document.getElementById('cifro-presentation-styles')) return;
        var s = document.createElement('style');
        s.id = 'cifro-presentation-styles';
        s.textContent = [
            'body.cifro-presenting { overflow: hidden; }',
            'body.cifro-presenting #song-cifra { font-size: calc(var(--cifra-size, 18px) * 1.15); }',
            'body.cifro-presenting .topnav,',
            'body.cifro-presenting #menusideMenu,',
            'body.cifro-presenting #sideMenu,',
            'body.cifro-presenting .btn-group[role="group"],',
            'body.cifro-presenting #toast,',
            'body.cifro-presenting .row:first-of-type,',
            'body.cifro-presenting #modo-ensaio { display: none !important; }',
            'body.cifro-presenting #song-cifra { margin: 0 auto !important; max-width: 760px; padding: 24px 16px 80px; }',
            '.cifro-presenting-overlay { position: fixed; bottom: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }',
            'body.has-quick-bar.cifro-presenting .cifro-presenting-overlay { bottom: 80px; }',
            '.cifro-presenting-overlay button { width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(0,0,0,.7); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }',
            '.cifro-presenting-overlay button:hover { background: rgba(0,0,0,.85); }',
            '.cifro-presenting-overlay button:focus-visible { outline: 2px solid var(--brand, #10b981); outline-offset: 2px; }',
            '.cifro-scroll-progress { position: fixed; right: 2px; top: 0; bottom: 0; width: 2px; background: var(--brand, #10b981); z-index: 999; transform: scaleY(0); transform-origin: top; transition: transform .15s linear; pointer-events: none; }',
            '.cifro-scroll-active .cifro-scroll-progress { transform-origin: top; }',
            /* Setlist UI */
            '.cifro-setlist-info { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.7); color: #fff; padding: 6px 14px; border-radius: 999px; font-size: 13px; backdrop-filter: blur(8px); z-index: 999; display: flex; align-items: center; gap: 8px; max-width: 90vw; }',
            '.cifro-setlist-info__counter { font-weight: 600; color: var(--brand, #10b981); }',
            '.cifro-setlist-info__name { color: #ddd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }',
            '.cifro-setlist-nav { position: fixed; bottom: 16px; left: 16px; display: flex; gap: 8px; z-index: 999; }',
            'body.has-quick-bar.cifro-presenting .cifro-setlist-nav { bottom: 80px; }',
            '.cifro-setlist-nav button { width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(0,0,0,.7); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }',
            '.cifro-setlist-nav button:hover { background: rgba(0,0,0,.85); }',
            '.cifro-setlist-nav button:disabled { opacity: .3; cursor: not-allowed; }',
            /* Swipe hint */
            '.cifro-swipe-hint { position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%); color: rgba(255,255,255,.5); font-size: 12px; pointer-events: none; animation: cifroHintFade 4s ease-out forwards; }',
            '@keyframes cifroHintFade { 0%,40% { opacity: 1; } 100% { opacity: 0; } }'
        ].join('\n');
        document.head.appendChild(s);
    }

    function getScrollContainer() {
        return document.scrollingElement || document.documentElement;
    }

    function step(timestamp) {
        if (!state.scrolling) return;
        if (!state.lastTimestamp) state.lastTimestamp = timestamp;
        var dt = timestamp - state.lastTimestamp;
        state.lastTimestamp = timestamp;

        // pixels per ms baseado na velocidade
        var pxPerMs = SPEEDS[state.speed] * 0.04;
        state.accumulator += dt * pxPerMs;

        if (state.accumulator >= 1) {
            var px = Math.floor(state.accumulator);
            state.accumulator -= px;
            var el = getScrollContainer();
            var before = el.scrollTop;
            el.scrollBy({ top: px, behavior: 'auto' });
            if (el.scrollTop === before && before + el.clientHeight >= el.scrollHeight - 1) {
                stopScroll();
                return;
            }
            updateProgress();
        }
        state.rafId = requestAnimationFrame(step);
    }

    function updateProgress() {
        var bar = document.querySelector('.cifro-scroll-progress > i');
        if (!bar) return;
        var el = getScrollContainer();
        var max = el.scrollHeight - el.clientHeight;
        var ratio = max > 0 ? el.scrollTop / max : 0;
        bar.style.transform = 'scaleY(' + ratio + ')';
    }

    function startScroll() {
        if (state.scrolling) return;
        state.scrolling = true;
        state.lastTimestamp = 0;
        state.accumulator = 0;
        document.body.classList.add('cifro-scroll-active');
        state.rafId = requestAnimationFrame(step);
        var btn = document.getElementById('cifroAutoScrollToggle');
        if (btn) {
            btn.setAttribute('aria-pressed', 'true');
            btn.title = 'Pausar rolagem (espaço)';
            btn.innerHTML = pauseSvg();
        }
        window.cifroToast && cifroToast('Rolagem automática ativada — toque para pausar', 'info', { duration: 2000 });
    }

    function stopScroll() {
        if (!state.scrolling) return;
        state.scrolling = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = null;
        document.body.classList.remove('cifro-scroll-active');
        var btn = document.getElementById('cifroAutoScrollToggle');
        if (btn) {
            btn.setAttribute('aria-pressed', 'false');
            btn.title = 'Iniciar rolagem (espaço)';
            btn.innerHTML = playSvg();
        }
    }

    function toggleScroll() {
        state.scrolling ? stopScroll() : startScroll();
    }

    function cycleSpeed() {
        state.speed = state.speed === 'slow' ? 'normal' : state.speed === 'normal' ? 'fast' : 'slow';
        var label = state.speed === 'slow' ? 'Lento' : state.speed === 'normal' ? 'Médio' : 'Rápido';
        try { localStorage.setItem('cifro-scrollSpeed', state.speed); } catch (e) {}
        window.cifroToast && cifroToast('Velocidade: ' + label, 'info', { duration: 1500 });
    }

    function keepAwakeEnabled() {
        try { return localStorage.getItem('cifro-keepAwake') !== 'false'; } catch (e) { return true; }
    }

    async function requestWakeLock() {
        if (!keepAwakeEnabled()) return;
        if (!('wakeLock' in navigator)) {
            window.cifroToast && cifroToast('Este navegador não permite manter a tela acesa.', 'warning');
            return;
        }
        try {
            state.wakeLock = await navigator.wakeLock.request('screen');
            state.wakeLock.addEventListener('release', function () { state.wakeLock = null; });
        } catch (e) {
            window.cifroToast && cifroToast('Não foi possível manter a tela acesa.', 'warning');
        }
    }
    function releaseWakeLock() {
        if (state.wakeLock) {
            try { state.wakeLock.release(); } catch (e) {}
            state.wakeLock = null;
        }
    }

    function enterPresentation() {
        if (state.presenting) return;
        state.presenting = true;
        state.setlist = loadSetlist();
        document.body.classList.add('cifro-presenting');
        injectOverlay();
        injectStageReady();
        requestWakeLock();
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(function () {});
        }
    }

    function exitPresentation() {
        if (!state.presenting) return;
        state.presenting = false;
        document.body.classList.remove('cifro-presenting');
        stopScroll();
        releaseWakeLock();
        ['.cifro-presenting-overlay', '.cifro-scroll-progress', '.cifro-setlist-info', '.cifro-setlist-nav', '.cifro-swipe-hint', '.cifro-stage-ready'].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (el) el.remove();
        });
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
        }
    }

    function playSvg() {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }
    function pauseSvg() {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
    function xSvg() {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
    }
    function gaugeSvg() {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    }

    function injectOverlay() {
        if (document.querySelector('.cifro-presenting-overlay')) return;
        var ov = document.createElement('div');
        ov.className = 'cifro-presenting-overlay';
        ov.innerHTML = [
            '<button type="button" id="cifroAutoScrollToggle" aria-pressed="false" aria-label="Iniciar rolagem">' + playSvg() + '</button>',
            '<button type="button" id="cifroSpeedToggle" aria-label="Velocidade da rolagem">' + gaugeSvg() + '</button>',
            '<button type="button" id="cifroExitPresent" aria-label="Sair do modo apresentação">' + xSvg() + '</button>'
        ].join('');
        document.body.appendChild(ov);

        var pb = document.createElement('div');
        pb.className = 'cifro-scroll-progress';
        pb.innerHTML = '<i style="display:block;width:100%;height:100%;background:currentColor;transform:scaleY(0);transform-origin:top;transition:transform .15s linear;"></i>';
        document.body.appendChild(pb);

        document.getElementById('cifroAutoScrollToggle').addEventListener('click', toggleScroll);
        document.getElementById('cifroSpeedToggle').addEventListener('click', cycleSpeed);
        document.getElementById('cifroExitPresent').addEventListener('click', exitPresentation);

        // ---- Setlist UI ----
        if (state.setlist) injectSetlistUI();
    }

    function injectStageReady() {
        var ready = document.createElement('div');
        ready.className = 'cifro-stage-ready';
        ready.textContent = 'Pronto para palco';
        ready.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1000;background:#15803d;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700';
        document.body.appendChild(ready);
    }

    function injectSetlistUI() {
        var sl = state.setlist;
        if (!sl) return;
        var info = document.createElement('div');
        info.className = 'cifro-setlist-info';
        var name = String(sl.name || 'Setlist').replace(/[<>&]/g, '');
        info.innerHTML = [
            '<span class="cifro-setlist-info__name">' + name + '</span>',
            '<span class="cifro-setlist-info__counter">' + (sl.currentIndex + 1) + '/' + sl.items.length + '</span>'
        ].join('');
        document.body.appendChild(info);

        var nav = document.createElement('div');
        nav.className = 'cifro-setlist-nav';
        nav.innerHTML = [
            '<button type="button" id="cifroSetlistPrev" aria-label="Música anterior"' + (sl.currentIndex === 0 ? ' disabled' : '') + '>',
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
            '</button>',
            '<button type="button" id="cifroSetlistNext" aria-label="Próxima música"' + (sl.currentIndex >= sl.items.length - 1 ? ' disabled' : '') + '>',
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
            '</button>'
        ].join('');
        document.body.appendChild(nav);

        document.getElementById('cifroSetlistPrev').addEventListener('click', function () { navigateSetlist(-1); });
        document.getElementById('cifroSetlistNext').addEventListener('click', function () { navigateSetlist(1); });

        // Dica de swipe (some em 4s)
        var hint = document.createElement('div');
        hint.className = 'cifro-swipe-hint';
        hint.textContent = '← arraste para trocar de música →';
        document.body.appendChild(hint);
        setTimeout(function () { hint.remove(); }, 4500);

        // Touch swipe
        attachSwipe();
    }

    function attachSwipe() {
        var startX = 0, startY = 0, t0 = 0;
        var threshold = 80;
        var maxAngle = 30;
        var target = document.getElementById('song-cifra') || document.body;

        function onStart(e) {
            var t = e.touches ? e.touches[0] : e;
            startX = t.clientX; startY = t.clientY; t0 = Date.now();
        }
        function onEnd(e) {
            var t = e.changedTouches ? e.changedTouches[0] : e;
            var dx = t.clientX - startX;
            var dy = t.clientY - startY;
            var dt = Date.now() - t0;
            if (dt > 600) return;
            if (Math.abs(dx) < threshold) return;
            if (Math.abs(dy) > Math.abs(dx) * Math.tan(maxAngle * Math.PI / 180)) return;
            navigateSetlist(dx < 0 ? 1 : -1);
        }
        target.addEventListener('touchstart', onStart, { passive: true });
        target.addEventListener('touchend', onEnd, { passive: true });
    }

    function onKey(e) {
        if (!state.presenting) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            exitPresentation();
        } else if (e.key === ' ') {
            e.preventDefault();
            toggleScroll();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            if (state.setlist) { e.preventDefault(); navigateSetlist(1); }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            if (state.setlist) { e.preventDefault(); navigateSetlist(-1); }
        }
    }

    function init() {
        if (!document.getElementById('song-cifra')) return;
        injectStyles();
        document.addEventListener('keydown', onKey);
        try {
            var savedSpeed = localStorage.getItem('cifro-scrollSpeed') || localStorage.getItem('cifro-scroll-speed');
            if (savedSpeed && SPEEDS[savedSpeed]) state.speed = savedSpeed;
        } catch (e) {}
    }

    window.cifroPresentation = {
        enter: enterPresentation,
        exit: exitPresentation,
        toggleScroll: toggleScroll,
        cycleSpeed: cycleSpeed
    };
    document.addEventListener('visibilitychange', function () {
        if (state.presenting && document.visibilityState === 'visible' && !state.wakeLock) requestWakeLock();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
