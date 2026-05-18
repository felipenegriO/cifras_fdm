(function () {
    var meta = document.querySelector('meta[name="csrf-token"]');
    var token = meta ? meta.getAttribute('content') : '';
    window.FDM_CSRF = token;

    window.fdmCsrfHeaders = function (extra) {
        var headers = extra ? Object.assign({}, extra) : {};
        if (token) {
            headers['X-CSRF-Token'] = token;
        }
        return headers;
    };

    var originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    window.fetch = function (input, init) {
        init = init || {};
        var method = (init.method || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && token) {
            var headers = new Headers(init.headers || {});
            if (!headers.has('X-CSRF-Token')) {
                headers.set('X-CSRF-Token', token);
            }
            init.headers = headers;
        }
        return originalFetch(input, init);
    };
})();
