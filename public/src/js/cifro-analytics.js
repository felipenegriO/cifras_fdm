/**
 * Camada de eventos do Cifrô — agnóstica de ferramenta.
 *
 * Não carrega nenhum script de terceiro por conta própria e não envia nada para
 * lugar nenhum se não houver provedor configurado. O objetivo é que os eventos
 * do funil já existam e estejam nomeados; plugar GA4, Plausible ou outro depois
 * é só definir window.CIFRO_ANALYTICS antes deste arquivo.
 *
 *   window.CIFRO_ANALYTICS = { debug: true }            // só loga no console
 *   window.CIFRO_ANALYTICS = { sink: fn }               // recebe (nome, dados)
 *
 * Sem configuração, os eventos vão para window.dataLayer (que o GTM lê quando
 * e se for instalado) e nada mais acontece.
 */
(function () {
    'use strict';

    var config = window.CIFRO_ANALYTICS || {};

    window.dataLayer = window.dataLayer || [];

    function track(name, data) {
        var payload = Object.assign({ event: name, page: 'landing' }, data || {});
        try {
            window.dataLayer.push(payload);
            if (typeof config.sink === 'function') config.sink(name, payload);
            if (typeof window.gtag === 'function') window.gtag('event', name, payload);
            if (typeof window.plausible === 'function') window.plausible(name, { props: payload });
            if (config.debug) console.info('[cifro-analytics]', name, payload);
        } catch (e) {
            /* telemetria nunca pode quebrar a página */
        }
    }

    window.cifroTrack = track;

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(function () {
        track('view_landing');

        // ── Cliques em CTA ────────────────────────────────────────────────────
        document.addEventListener('click', function (event) {
            var el = event.target && event.target.closest
                ? event.target.closest('[data-cifro-event]')
                : null;
            if (!el) return;
            track(el.getAttribute('data-cifro-event'), {
                label: (el.textContent || '').trim().slice(0, 60),
                href: el.getAttribute('href') || ''
            });
        }, true);

        // ── Profundidade de rolagem ───────────────────────────────────────────
        var marks = [25, 50, 75, 100];
        var fired = {};
        var ticking = false;

        function checkScroll() {
            ticking = false;
            var doc = document.documentElement;
            var scrollable = doc.scrollHeight - window.innerHeight;
            if (scrollable <= 0) return;
            var pct = ((window.scrollY || doc.scrollTop) / scrollable) * 100;
            for (var i = 0; i < marks.length; i++) {
                var mark = marks[i];
                if (pct >= mark && !fired[mark]) {
                    fired[mark] = true;
                    track('scroll_depth', { depth: mark });
                }
            }
        }

        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(checkScroll);
        }, { passive: true });

        // ── Seções vistas (preço e FAQ são os sinais de intenção) ─────────────
        if ('IntersectionObserver' in window) {
            var watched = { precos: 'view_pricing', 'como-funciona': 'view_how_it_works' };
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var name = watched[entry.target.id];
                    if (name) {
                        track(name);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.35 });

            Object.keys(watched).forEach(function (id) {
                var el = document.getElementById(id);
                if (el) observer.observe(el);
            });
        }

        // ── Abertura de pergunta da FAQ ───────────────────────────────────────
        document.querySelectorAll('.faq details').forEach(function (details) {
            details.addEventListener('toggle', function () {
                if (!details.open) return;
                var summary = details.querySelector('summary');
                track('faq_open', { question: summary ? summary.textContent.trim().slice(0, 80) : '' });
            });
        });
    });
})();
