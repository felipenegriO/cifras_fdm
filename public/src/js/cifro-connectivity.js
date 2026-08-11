(function () {
    if (window.CifroConnectivity) return;

    var state = 'verificando';
    var lastCheck = 0;
    var inFlight = null;
    var CHECK_TTL = 10000;
    var TIMEOUT = 3000;

    function publish(next, detail) {
        state = next;
        document.dispatchEvent(new CustomEvent('cifro:connectivity', {
            detail: Object.assign({ state: next }, detail || {})
        }));
        return next === 'servidor_disponivel';
    }

    async function probe(options) {
        options = options || {};
        var now = Date.now();
        if (!options.force && inFlight) return inFlight;
        if (!options.force && now - lastCheck < CHECK_TTL) return state === 'servidor_disponivel';
        state = 'verificando';
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, options.timeout || TIMEOUT);
        inFlight = fetch((window.APP_BASE || '') + '/health.php?probe=' + now, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Cifro-Probe': '1' },
            signal: controller.signal
        }).then(async function (response) {
            var type = response.headers.get('content-type') || '';
            if (!response.ok || !type.includes('application/json') || response.redirected) throw new Error('invalid_response');
            var data = await response.json();
            if (data.status !== 'ok' || data.service !== 'cifro' || typeof data.request_id !== 'string' || !data.request_id) {
                throw new Error('invalid_identity');
            }
            lastCheck = Date.now();
            return publish('servidor_disponivel', { status: response.status });
        }).catch(function (error) {
            lastCheck = Date.now();
            return publish('servidor_indisponivel', { reason: error && error.name === 'AbortError' ? 'timeout' : 'network' });
        }).finally(function () {
            clearTimeout(timer);
            inFlight = null;
        });
        return inFlight;
    }

    function current() { return state; }
    function isServerAvailable() { return state === 'servidor_disponivel'; }

    window.CifroConnectivity = { probe: probe, current: current, isServerAvailable: isServerAvailable };
    window.addEventListener('online', function () { probe({ force: true }); });
    window.addEventListener('offline', function () { publish('servidor_indisponivel', { reason: 'network' }); });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') probe({ force: true });
    });
    var startProbe = function () { setTimeout(function () { probe({ force: true }); }, 0); };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if (window.requestAnimationFrame) requestAnimationFrame(startProbe);
            else startProbe();
        }, { once: true });
    } else if (window.requestAnimationFrame) requestAnimationFrame(startProbe);
    else startProbe();
})();
