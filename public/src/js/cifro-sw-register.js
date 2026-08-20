(function () {
    if (!('serviceWorker' in navigator)) {
        window.cifroServiceWorkerReady = Promise.resolve(null);
        return;
    }

    const configuredBase = String(window.APP_BASE || '').replace(/\/$/, '');
    const scriptUrl = document.currentScript?.src || '';
    const inferredBase = scriptUrl
        ? new URL(scriptUrl, location.href).pathname.replace(/\/src\/js\/cifro-sw-register\.js$/, '')
        : '';
    const appBase = configuredBase || inferredBase;
    const workerPath = appBase + '/service-worker.php';
    const workerUrl = workerPath + '?base=' + encodeURIComponent(appBase);
    const scope = (appBase || '') + '/';
    const previousController = navigator.serviceWorker.controller;
    let reloading = false;
    let controllerChanged = false;

    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.has('_cifro_auth')) {
        currentUrl.searchParams.delete('_cifro_auth');
        history.replaceState(history.state, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
    }

    function isCurrent(worker) {
        if (!worker?.scriptURL) return false;
        return new URL(worker.scriptURL).pathname === workerPath;
    }

    function activate(worker) {
        if (!worker) return;
        if (worker.state === 'installed') {
            worker.postMessage({ type: 'SKIP_WAITING' });
            return;
        }
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
        });
    }

    function waitForCurrentController(registration, mustReplace) {
        if (!previousController || controllerChanged || (!mustReplace && isCurrent(navigator.serviceWorker.controller))) {
            return Promise.resolve(registration);
        }
        return new Promise(resolve => {
            const finish = () => {
                if (!isCurrent(navigator.serviceWorker.controller)) return;
                navigator.serviceWorker.removeEventListener('controllerchange', finish);
                resolve(registration);
            };
            navigator.serviceWorker.addEventListener('controllerchange', finish);
            setTimeout(() => {
                navigator.serviceWorker.removeEventListener('controllerchange', finish);
                resolve(registration);
            }, 8000);
        });
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        controllerChanged = true;
        if (!previousController) return;
        localStorage.setItem('cifroAppUpdatePending', '1');
        if (!window.CIFRO_USER_ID || reloading) return;
        reloading = true;
        location.reload();
    });

    window.cifroServiceWorkerReady = navigator.serviceWorker.register(workerUrl, {
        scope,
        updateViaCache: 'none'
    }).then(async registration => {
        let updateFound = false;
        registration.addEventListener('updatefound', () => {
            updateFound = true;
            document.dispatchEvent(new CustomEvent('cifro:app-update', { detail: { state: 'baixando' } }));
            activate(registration.installing);
        });
        activate(registration.waiting || registration.installing);
        if (navigator.onLine) await registration.update();
        const pendingWorker = registration.waiting || registration.installing;
        activate(pendingWorker);
        const mustReplace = Boolean(previousController && (updateFound || pendingWorker || !isCurrent(previousController)));
        const ready = await waitForCurrentController(registration, mustReplace);
        if (!window.CIFRO_USER_ID) ready.active?.postMessage({ type: 'CLEAR_CONTEXT' });
        return ready;
    }).catch(() => null);

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('loginForm');
        if (!form) return;
        let submitting = false;
        form.addEventListener('submit', async event => {
            if (event.defaultPrevented || submitting) return;
            event.preventDefault();
            submitting = true;
            const button = form.querySelector('button[type="submit"]');
            if (button) button.disabled = true;
            await Promise.race([
                window.cifroServiceWorkerReady,
                new Promise(resolve => setTimeout(resolve, 8000))
            ]);
            HTMLFormElement.prototype.submit.call(form);
        });
    });
})();
