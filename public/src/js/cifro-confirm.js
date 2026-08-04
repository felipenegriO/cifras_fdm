(function () {
    if (window.cifroConfirm) return;

    var STYLE_ID = 'cifro-confirm-styles';
    if (!document.getElementById(STYLE_ID)) {
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.cifro-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;animation:cifroFadeIn .15s ease-out}',
            '@keyframes cifroFadeIn{from{opacity:0}to{opacity:1}}',
            '.cifro-confirm-box{background:#1a1a1a;color:#fff;border:1px solid #333;border-radius:8px;max-width:440px;width:100%;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.6);font-family:system-ui,-apple-system,Segoe UI,sans-serif}',
            '.cifro-confirm-title{font-size:1.1rem;font-weight:600;margin:0 0 12px;display:flex;align-items:center;gap:8px}',
            '.cifro-confirm-title-icon{font-size:1.4rem}',
            '.cifro-confirm-message{margin:0 0 20px;line-height:1.5;color:#ddd;font-size:.95rem}',
            '.cifro-confirm-message strong{color:#fff}',
            '.cifro-confirm-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
            '.cifro-confirm-btn{min-height:44px;padding:0 16px;border-radius:6px;font-size:.95rem;font-weight:500;cursor:pointer;border:1px solid transparent;transition:filter .15s}',
            '.cifro-confirm-btn:hover{filter:brightness(1.15)}',
            '.cifro-confirm-btn:focus{outline:2px solid #4a9eff;outline-offset:2px}',
            '.cifro-confirm-btn--cancel{background:transparent;color:#ddd;border-color:#555}',
            '.cifro-confirm-btn--danger{background:#c0392b;color:#fff}',
            '.cifro-confirm-btn--primary{background:#2563eb;color:#fff}',
            '@media (max-width:480px){.cifro-confirm-actions{flex-direction:column-reverse}.cifro-confirm-btn{width:100%}}'
        ].join('');
        document.head.appendChild(style);
    }

    window.cifroConfirm = function (options) {
        var opts = options || {};
        var title = opts.title || 'Confirmar ação';
        var message = opts.message || 'Tem certeza?';
        var confirmText = opts.confirmText || 'Confirmar';
        var cancelText = opts.cancelText || 'Cancelar';
        var danger = opts.danger !== false;
        var icon = opts.icon || (danger ? '⚠️' : '❓');

        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'cifro-confirm-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'cifro-confirm-title');

            var box = document.createElement('div');
            box.className = 'cifro-confirm-box';

            var h = document.createElement('h2');
            h.className = 'cifro-confirm-title';
            h.id = 'cifro-confirm-title';
            h.innerHTML = '<span class="cifro-confirm-title-icon" aria-hidden="true">' + icon + '</span><span></span>';
            h.lastChild.textContent = title;

            var p = document.createElement('div');
            p.className = 'cifro-confirm-message';
            p.innerHTML = message;

            var actions = document.createElement('div');
            actions.className = 'cifro-confirm-actions';

            var btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.className = 'cifro-confirm-btn cifro-confirm-btn--cancel';
            btnCancel.textContent = cancelText;

            var btnOk = document.createElement('button');
            btnOk.type = 'button';
            btnOk.className = 'cifro-confirm-btn ' + (danger ? 'cifro-confirm-btn--danger' : 'cifro-confirm-btn--primary');
            btnOk.textContent = confirmText;

            function close(result) {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Escape') close(false);
                if (e.key === 'Enter' && document.activeElement === btnOk) close(true);
            }

            btnCancel.addEventListener('click', function () { close(false); });
            btnOk.addEventListener('click', function () { close(true); });
            overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
            document.addEventListener('keydown', onKey);

            actions.appendChild(btnCancel);
            actions.appendChild(btnOk);
            box.appendChild(h);
            box.appendChild(p);
            box.appendChild(actions);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            setTimeout(function () { btnCancel.focus(); }, 50);
        });
    };
})();
