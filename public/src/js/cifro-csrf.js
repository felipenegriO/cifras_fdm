(function () {
    var meta = document.querySelector('meta[name="csrf-token"]');
    var token = meta ? meta.getAttribute('content') : '';
    window.CIFRO_CSRF = token;

    window.cifroCsrfHeaders = function (extra) {
        var headers = extra ? Object.assign({}, extra) : {};
        if (token) {
            headers['X-CSRF-Token'] = token;
        }
        return headers;
    };
    var legacyPrefix = ["f", "d", "m"].join("");
    window[legacyPrefix.toUpperCase() + '_CSRF'] = token;
    window[legacyPrefix + 'CsrfHeaders'] = window.cifroCsrfHeaders;
    window[legacyPrefix + 'Csrf'] = function () { return token; };

    var originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    /**
     * Busca um token novo no servidor e atualiza o que este módulo guarda.
     *
     * Necessário porque o token é lido do DOM uma única vez, no load: se a
     * sessão for recriada depois (o login persistente revive a sessão quando o
     * PHPSESSID morre), o token da aba fica velho e todo POST vira 403 — numa
     * aba deixada aberta durante o ensaio, sem nada indicando o motivo.
     */
    async function renovarToken() {
        try {
            var res = await originalFetch((window.APP_BASE || '') + '/api/csrf.php', {
                credentials: 'same-origin', cache: 'no-store'
            });
            var novo = (await res.json()).csrf_token || '';
            if (!novo || novo === token) return false;
            token = novo;
            window.CIFRO_CSRF = novo;
            window[legacyPrefix.toUpperCase() + '_CSRF'] = novo;
            var metaAtual = document.querySelector('meta[name="csrf-token"]');
            if (metaAtual) metaAtual.setAttribute('content', novo);
            return true;
        } catch (_) {
            return false;
        }
    }

    /** O 403 é de CSRF (e não de permissão)? Só nesse caso vale repetir. */
    async function ehFalhaDeCsrf(response) {
        try {
            var corpo = await response.clone().json();
            var texto = (corpo.error || '') + ' ' + (corpo.mensagem || '');
            return /csrf/i.test(texto);
        } catch (_) {
            return false;
        }
    }

    window.fetch = async function (input, init) {
        init = init || {};
        var payload = null;
        var method = (init.method || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && token) {
            var headers = new Headers(init.headers || {});
            if (!headers.has('X-CSRF-Token')) {
                headers.set('X-CSRF-Token', token);
            }
            init.headers = headers;
            if (typeof init.body === 'string' && headers.get('Content-Type')?.includes('application/json') && window.cifroSync) {
                try {
                    payload = JSON.parse(init.body);
                    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.baseRevision === undefined) {
                        payload.baseRevision = await window.cifroSync.getRevision();
                        init.body = JSON.stringify(payload);
                    }
                } catch (_) {}
            }
        }
        var response = await originalFetch(input, init);

        // Token velho numa aba antiga: renova e repete UMA vez. Sem isso o
        // usuário só descobre o problema recarregando a página na mão.
        if (response.status === 403 && method !== 'GET' && method !== 'HEAD' && await ehFalhaDeCsrf(response)) {
            if (await renovarToken()) {
                var headersRetry = new Headers(init.headers || {});
                headersRetry.set('X-CSRF-Token', token);
                init.headers = headersRetry;
                response = await originalFetch(input, init);
            }
        }

        if (response.ok && payload && window.cifroSync?.applyMutation) {
            try {
                var result = await response.clone().json();
                if (Number.isSafeInteger(Number(result.content_revision))) {
                    await window.cifroSync.applyMutation(typeof input === 'string' ? input : input.url, payload, result);
                }
            } catch (_) {}
        }
        if (response.status === 409 && window.cifroSync?.sync && window.CIFRO_BAND_ID) {
            await window.cifroSync.sync(window.CIFRO_BAND_ID, { force: true }).catch(function () {});
        }
        return response;
    };
})();
