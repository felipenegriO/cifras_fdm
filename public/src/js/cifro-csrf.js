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
        if (response.ok && payload && window.cifroSync?.applyMutation) {
            try {
                var result = await response.clone().json();
                if (Number.isSafeInteger(Number(result.content_revision))) {
                    await window.cifroSync.applyMutation(typeof input === 'string' ? input : input.url, payload, result);
                }
            } catch (_) {}
        }
        return response;
    };
})();
