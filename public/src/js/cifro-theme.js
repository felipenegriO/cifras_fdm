/**
 * Tema Cifrô — aplica o tema escolhido (ou auto via prefers-color-scheme)
 * antes do primeiro paint para evitar flash.
 *
 * Carregue ANTES de qualquer CSS condicional (idealmente no <head>).
 */
(function () {
    var KEY = 'cifro-theme';
    var saved = null;
    try {
        saved = localStorage.getItem(KEY);
    } catch (e) { /* localStorage bloqueado */ }

    function apply(theme) {
        var root = document.documentElement;
        if (theme === 'light') root.setAttribute('data-theme', 'light');
        else if (theme === 'dark') root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');
    }

    // Default: escuro (otimizado para uso em palco/igreja/ensaio noturno)
    apply(saved || 'dark');

    // Aplica tamanho de fonte da cifra (definido em /config.php)
    try {
        var sizeKey = 'cifro-cifra-size';
        var cifraSize = localStorage.getItem(sizeKey);
        if (cifraSize && /^\d+$/.test(cifraSize)) {
            document.documentElement.style.setProperty('--cifra-size', cifraSize + 'px');
        }
    } catch (e) {}

    window.cifroTheme = {
        get: function () { return localStorage.getItem(KEY) || 'dark'; },
        set: function (v) {
            try { localStorage.setItem(KEY, v); } catch (e) {}
            apply(v);
        },
        toggle: function () {
            var next = (this.get() === 'dark') ? 'light' : 'dark';
            this.set(next);
            return next;
        }
    };
})();
