(function () {
    if (window.fdmToast) return;

    var STYLE_ID = 'fdm-toast-styles';
    if (!document.getElementById(STYLE_ID)) {
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.fdm-toast-stack{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;z-index:99998;pointer-events:none;max-width:calc(100vw - 32px);width:auto}',
            '.fdm-toast{pointer-events:auto;background:#1a1a1a;color:#fff;border:1px solid #333;border-left:4px solid #2563eb;border-radius:6px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,.5);font-size:.95rem;font-family:system-ui,-apple-system,Segoe UI,sans-serif;min-width:240px;max-width:480px;display:flex;align-items:center;gap:10px;animation:fdmToastIn .2s ease-out}',
            '.fdm-toast--success{border-left-color:#1f7a3f}',
            '.fdm-toast--error{border-left-color:#c0392b}',
            '.fdm-toast--warning{border-left-color:#b8860b}',
            '.fdm-toast-icon{font-size:1.1rem}',
            '.fdm-toast-message{flex:1;line-height:1.4}',
            '.fdm-toast-close{background:transparent;border:0;color:#aaa;cursor:pointer;font-size:1.2rem;padding:0 4px;line-height:1}',
            '.fdm-toast-close:hover{color:#fff}',
            '@keyframes fdmToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
            '@keyframes fdmToastOut{to{opacity:0;transform:translateY(8px)}}',
            '.fdm-toast--leaving{animation:fdmToastOut .2s ease-in forwards}',
            '@media (max-width:480px){.fdm-toast-stack{bottom:12px;left:12px;right:12px;transform:none;width:auto}.fdm-toast{min-width:0;width:100%}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureStack() {
        var stack = document.querySelector('.fdm-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'fdm-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            stack.setAttribute('aria-atomic', 'false');
            document.body.appendChild(stack);
        }
        return stack;
    }

    var icons = { success: '✓', error: '✕', warning: '!', info: 'ℹ' };

    window.fdmToast = function (message, type, opts) {
        opts = opts || {};
        type = type || 'info';
        var duration = opts.duration != null ? opts.duration : 3500;

        var stack = ensureStack();
        var el = document.createElement('div');
        el.className = 'fdm-toast fdm-toast--' + type;
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');

        var icon = document.createElement('span');
        icon.className = 'fdm-toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = icons[type] || icons.info;

        var msg = document.createElement('span');
        msg.className = 'fdm-toast-message';
        msg.textContent = String(message || '');

        var close = document.createElement('button');
        close.className = 'fdm-toast-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Fechar notificação');
        close.textContent = '×';

        function dismiss() {
            el.classList.add('fdm-toast--leaving');
            setTimeout(function () { el.remove(); }, 200);
        }

        close.addEventListener('click', dismiss);
        el.appendChild(icon);
        el.appendChild(msg);
        el.appendChild(close);
        stack.appendChild(el);

        if (duration > 0) setTimeout(dismiss, duration);
        return dismiss;
    };
})();
