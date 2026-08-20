(function () {
    'use strict';

    if (window.__cifroHelpBound) return;
    window.__cifroHelpBound = true;

    var base = String(window.APP_BASE || '').replace(/\/$/, '');
    var locallyDisabled = localStorage.getItem('cifro-ajudaDesativada') === 'true';
    var globallyEnabled = window.CIFRO_HELP_ENABLED !== false;
    var serverDisabled = window.CIFRO_HELP_DISABLED === true;
    if (!globallyEnabled || serverDisabled || locallyDisabled) {
        document.querySelectorAll('[data-help-entry], [data-help-article]').forEach(function (element) { element.remove(); });
        return;
    }

    var lastFocused = null;
    var drawer = null;
    var overlay = null;

    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    function track(event, article) {
        fetch(base + '/api/help/event.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: event, article: article || '' }),
            keepalive: true
        }).catch(function () {});
    }

    async function saveDisabled(disabled) {
        var response = await fetch(base + '/src/backend/users/salvar_config.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: { ajudaDesativada: disabled ? 'true' : 'false' } })
        });
        var result = await response.json();
        if (!response.ok || !result.sucesso) throw new Error('save_failed');
        localStorage.setItem('cifro-ajudaDesativada', disabled ? 'true' : 'false');
        return true;
    }

    function ensureDrawer() {
        if (drawer) return drawer;
        overlay = document.createElement('div');
        overlay.className = 'help-drawer-overlay';
        overlay.hidden = true;
        overlay.addEventListener('click', closeDrawer);

        drawer = document.createElement('aside');
        drawer.id = 'helpDrawer';
        drawer.className = 'help-drawer';
        drawer.hidden = true;
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-labelledby', 'helpDrawerTitle');
        drawer.innerHTML = '<div class="help-drawer__header"><strong id="helpDrawerTitle">Ajuda</strong><button type="button" class="help-drawer__close" aria-label="Fechar ajuda">×</button></div>'
            + '<div class="help-drawer__body" id="helpDrawerBody"><p>Carregando…</p></div>'
            + '<div class="help-drawer__footer"><label><input type="checkbox" id="helpDisableDrawer"> Não mostrar a Central de Ajuda novamente</label></div>';
        drawer.querySelector('.help-drawer__close').addEventListener('click', closeDrawer);
        drawer.querySelector('#helpDisableDrawer').addEventListener('change', async function (event) {
            if (!event.target.checked) return;
            event.target.disabled = true;
            try {
                await saveDisabled(true);
                closeDrawer();
                document.querySelectorAll('[data-help-entry], [data-help-article]').forEach(function (element) { element.remove(); });
                if (window.cifroToast) cifroToast('Central de Ajuda desativada na sua conta.', 'success');
            } catch (_) {
                event.target.checked = false;
                event.target.disabled = false;
                if (window.cifroToast) cifroToast('Não foi possível salvar a preferência.', 'error');
            }
        });
        document.body.append(overlay, drawer);
        return drawer;
    }

    function appendList(container, title, items, ordered) {
        var heading = document.createElement('h3');
        heading.textContent = title;
        container.appendChild(heading);
        var list = document.createElement(ordered ? 'ol' : 'ul');
        items.forEach(function (item) {
            var li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    async function openDrawer(articleId, source) {
        lastFocused = document.activeElement;
        ensureDrawer();
        overlay.hidden = false;
        drawer.hidden = false;
        document.body.style.overflow = 'hidden';
        drawer.querySelector('#helpDrawerTitle').textContent = 'Ajuda';
        var body = drawer.querySelector('#helpDrawerBody');
        body.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Carregando…' }));
        drawer.querySelector('.help-drawer__close').focus();
        try {
            var response = await fetch(base + '/api/help/article.php?id=' + encodeURIComponent(articleId));
            var result = await response.json();
            if (!response.ok || !result.ok) throw new Error('load_failed');
            var article = result.article;
            drawer.querySelector('#helpDrawerTitle').textContent = article.title;
            body.replaceChildren();
            var summary = document.createElement('p');
            summary.textContent = article.summary;
            body.appendChild(summary);
            appendList(body, 'Passos', article.steps || [], true);
            appendList(body, 'Problemas comuns', article.problems || [], false);
            var full = document.createElement('a');
            full.className = 'btn btn--secondary';
            full.href = base + '/ajuda.php?artigo=' + encodeURIComponent(article.id);
            full.textContent = 'Abrir guia completo';
            body.appendChild(full);
            track('article_opened', article.id);
            document.dispatchEvent(new CustomEvent('cifro:help-opened', { detail: { article: article.id, source: source || 'context' } }));
        } catch (_) {
            body.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Não foi possível carregar esta orientação agora.' }));
        }
    }

    function closeDrawer() {
        if (!drawer) return;
        drawer.hidden = true;
        overlay.hidden = true;
        document.body.style.overflow = '';
        if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    }

    function bindContextualHelp() {
        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('[data-help-article]');
            if (!trigger) return;
            event.preventDefault();
            openDrawer(trigger.getAttribute('data-help-article'), trigger.getAttribute('data-help-source'));
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && drawer && !drawer.hidden) closeDrawer();
            if (event.key === 'Tab' && drawer && !drawer.hidden) {
                var focusable = drawer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])');
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
    }

    function bindHelpPage() {
        if (!window.CIFRO_HELP_PAGE) return;
        track('opened');
        var input = document.getElementById('helpSearch');
        var cards = Array.from(document.querySelectorAll('.help-article-card'));
        var glossary = Array.from(document.querySelectorAll('[data-help-glossary]'));
        var buttons = Array.from(document.querySelectorAll('[data-help-category]'));
        var filterFeedback = document.getElementById('helpFilterFeedback');
        var selectedCategory = 'all';
        var timer = null;

        function applyFilter() {
            var query = normalize(input.value);
            var visible = 0;
            cards.forEach(function (card) {
                var categoryMatches = selectedCategory === 'all' || card.dataset.helpCategoryValue === selectedCategory;
                var queryMatches = !query || normalize(card.dataset.helpSearch).includes(query);
                card.hidden = !(categoryMatches && queryMatches);
                if (!card.hidden) visible++;
            });
            glossary.forEach(function (item) { item.hidden = Boolean(query) && !normalize(item.dataset.helpGlossary).includes(query); });
            document.getElementById('helpVisibleCount').textContent = visible + (visible === 1 ? ' guia' : ' guias');
            document.getElementById('helpEmpty').hidden = visible !== 0;
            document.getElementById('helpSearchStatus').textContent = query ? visible + ' resultado(s) para “' + input.value.trim() + '”.' : '';
            if (filterFeedback) {
                var categoryLabel = selectedCategory === 'all' ? 'todas as categorias' : '“' + selectedCategory + '”';
                filterFeedback.textContent = 'Exibindo ' + visible + (visible === 1 ? ' guia em ' : ' guias em ') + categoryLabel + '.';
            }
            clearTimeout(timer);
            if (query) timer = setTimeout(function () { track(visible ? 'search' : 'search_empty'); }, 350);
        }

        input.addEventListener('input', applyFilter);
        function selectCategory(category) {
            selectedCategory = category;
            buttons.forEach(function (item) {
                var active = item.dataset.helpCategory === category;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            applyFilter();
        }
        buttons.forEach(function (button) {
            button.addEventListener('click', function () { selectCategory(button.dataset.helpCategory); });
        });

        document.querySelectorAll('.help-article-details').forEach(function (details) {
            details.addEventListener('toggle', function () {
                if (details.open) track('article_opened', details.closest('[data-help-id]').dataset.helpId);
            });
        });
        document.querySelectorAll('[data-help-related]').forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                openArticle(link.dataset.helpRelated);
            });
        });
        document.querySelectorAll('[data-help-complete]').forEach(function (button) {
            button.addEventListener('click', function () {
                track('guide_completed', button.dataset.helpComplete);
                button.textContent = 'Guia concluído';
                button.disabled = true;
                if (window.cifroToast) cifroToast('Guia marcado como concluído.', 'success');
            });
        });

        function openArticle(id) {
            var card = cards.find(function (item) { return item.dataset.helpId === id; });
            if (!card) return;
            input.value = '';
            selectCategory('all');
            var details = card.querySelector('details');
            details.open = true;
            card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            history.replaceState(null, '', '?artigo=' + encodeURIComponent(id));
        }

        var requested = new URLSearchParams(location.search).get('artigo');
        if (requested) openArticle(requested);

        var disable = document.getElementById('helpDisablePage');
        disable.addEventListener('change', async function () {
            if (!disable.checked) return;
            disable.disabled = true;
            try {
                await saveDisabled(true);
                if (window.cifroToast) cifroToast('Central de Ajuda desativada na sua conta.', 'success');
                location.replace(base + '/config.php#sec-ajuda');
            } catch (_) {
                disable.checked = false;
                disable.disabled = false;
                if (window.cifroToast) cifroToast('Não foi possível salvar a preferência.', 'error');
            }
        });

        renderDiagnostics();
    }

    function diagnosticItem(title, value, article) {
        var item = document.createElement('div');
        item.className = 'help-diagnostic-item';
        var strong = document.createElement('strong');
        strong.textContent = title;
        var span = document.createElement('span');
        span.textContent = value;
        item.append(strong, span);
        if (article) {
            var link = document.createElement('a');
            link.href = base + '/ajuda.php?artigo=' + article;
            link.textContent = 'Como resolver';
            item.appendChild(link);
        }
        return item;
    }

    function renderDiagnostics() {
        var grid = document.getElementById('helpDiagnosticGrid');
        if (!grid) return;
        var state = window.CifroConnectivity && window.CifroConnectivity.current ? window.CifroConnectivity.current() : (navigator.onLine ? 'verificando' : 'sem_internet');
        var connection = state === 'servidor_disponivel' ? 'Servidor disponível' : state === 'verificando' ? 'Verificando servidor' : 'Servidor indisponível';
        var sw = navigator.serviceWorker && navigator.serviceWorker.controller ? 'Aplicativo controlado pelo cache offline' : 'Pacote offline ainda não controlado';
        var band = window.CIFRO_BAND_ID ? 'Banda selecionada' : 'Nenhuma banda selecionada';
        grid.replaceChildren(
            diagnosticItem('Conexão', connection, state === 'servidor_disponivel' ? '' : 'resolver-offline'),
            diagnosticItem('Uso offline', sw, sw.startsWith('Aplicativo') ? '' : 'preparar-palco'),
            diagnosticItem('Contexto', band, window.CIFRO_BAND_ID ? '' : 'perfis-permissoes')
        );
    }

    bindContextualHelp();
    bindHelpPage();
    window.CifroHelp = { open: openDrawer, close: closeDrawer, disable: function () { return saveDisabled(true); } };
})();
