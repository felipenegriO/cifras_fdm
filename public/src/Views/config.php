<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Configurações</title>
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
    <script src="/src/js/fdm-theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/theme.css" rel="stylesheet">
    <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
    <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
    <style>
        body { padding: 0; margin: 0; }
        .config-container {
            max-width: 720px;
            margin: 0 auto;
            padding: var(--space-4);
        }
        .config-section {
            background: var(--bg-1);
            border: 1px solid var(--border-1);
            border-radius: var(--radius-md);
            margin-bottom: var(--space-4);
            overflow: hidden;
        }
        .config-section__header {
            padding: var(--space-3) var(--space-4);
            border-bottom: 1px solid var(--border-1);
            background: var(--bg-2);
        }
        .config-section__title {
            margin: 0;
            font-size: var(--text-sm);
            font-weight: var(--fw-semibold);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-2);
        }
        .config-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3);
            padding: var(--space-4);
            border-bottom: 1px solid var(--border-1);
        }
        .config-row:last-child { border-bottom: 0; }
        .config-row__label {
            flex: 1;
            min-width: 0;
        }
        .config-row__title {
            font-size: var(--text-base);
            font-weight: var(--fw-medium);
            color: var(--text-1);
            margin: 0 0 2px;
        }
        .config-row__desc {
            font-size: var(--text-xs);
            color: var(--text-2);
            margin: 0;
        }
        .config-row__control {
            flex-shrink: 0;
        }
        .config-row__control select,
        .config-row__control input[type="number"] {
            min-width: 140px;
        }
        .config-page-title {
            font-size: var(--text-2xl);
            font-weight: var(--fw-semibold);
            margin: var(--space-4) 0;
            color: var(--text-1);
        }
        .config-back {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--text-2);
            text-decoration: none;
            font-size: var(--text-sm);
            margin-bottom: var(--space-2);
        }
        .config-back:hover { color: var(--text-1); }
        /* Toggle switch */
        .switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .switch__slider {
            position: absolute;
            cursor: pointer;
            inset: 0;
            background: var(--bg-3);
            border-radius: 24px;
            transition: background var(--t-fast);
        }
        .switch__slider::before {
            content: "";
            position: absolute;
            height: 18px;
            width: 18px;
            left: 3px;
            top: 3px;
            background: #fff;
            border-radius: 50%;
            transition: transform var(--t-fast);
        }
        .switch input:checked + .switch__slider { background: var(--brand); }
        .switch input:checked + .switch__slider::before { transform: translateX(20px); }
        .switch input:focus-visible + .switch__slider {
            outline: 2px solid var(--brand);
            outline-offset: 2px;
        }
        .config-storage {
            font-size: var(--text-xs);
            color: var(--text-2);
            font-family: var(--font-mono);
        }
        .config-user {
            display: flex;
            align-items: center;
            gap: var(--space-3);
        }
        .config-user__avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--brand-soft);
            color: var(--brand);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: var(--fw-bold);
            font-size: var(--text-lg);
            flex-shrink: 0;
        }
        @media (max-width: 480px) {
            .config-row { flex-direction: column; align-items: flex-start; }
            .config-row__control { width: 100%; }
            .config-row__control select,
            .config-row__control input[type="number"] { width: 100%; min-width: 0; }
        }
    </style>
</head>
<body>
    <?php render_partial('topnav'); ?>

    <div class="config-container">
        <a href="/index.php" class="config-back" aria-label="Voltar para a lista de músicas">
            <?= fdm_icon('arrow-left', 16) ?> Voltar
        </a>
        <h1 class="config-page-title">Configurações</h1>

        <!-- ===== Tema ===== -->
        <section class="config-section" aria-labelledby="sec-tema">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-tema">Aparência</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Tema</p>
                    <p class="config-row__desc">Escuro recomendado para palco. Claro para uso em ambientes muito iluminados.</p>
                </div>
                <div class="config-row__control">
                    <select id="cfgTheme" aria-label="Tema">
                        <option value="dark">Escuro</option>
                        <option value="light">Claro</option>
                        <option value="auto">Automático (sistema)</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- ===== Cifra ===== -->
        <section class="config-section" aria-labelledby="sec-cifra">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-cifra">Cifra</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Tamanho da fonte padrão</p>
                    <p class="config-row__desc">Pode ajustar individualmente em cada cifra com A− / A+.</p>
                </div>
                <div class="config-row__control">
                    <select id="cfgCifraSize" aria-label="Tamanho da fonte da cifra">
                        <option value="14">14px — Pequeno</option>
                        <option value="16">16px — Médio</option>
                        <option value="18" selected>18px — Padrão</option>
                        <option value="20">20px — Grande</option>
                        <option value="22">22px — Extra grande</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- ===== Apresentação ===== -->
        <section class="config-section" aria-labelledby="sec-apresentacao">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-apresentacao">Apresentação</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Velocidade padrão da rolagem</p>
                    <p class="config-row__desc">Pode alternar durante a apresentação com o botão de velocidade.</p>
                </div>
                <div class="config-row__control">
                    <select id="cfgScrollSpeed" aria-label="Velocidade da rolagem">
                        <option value="slow">Lenta</option>
                        <option value="normal" selected>Normal</option>
                        <option value="fast">Rápida</option>
                    </select>
                </div>
            </div>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Manter tela acesa</p>
                    <p class="config-row__desc">Impede que o celular bloqueie a tela durante apresentação (usa Wake Lock API).</p>
                </div>
                <div class="config-row__control">
                    <label class="switch">
                        <input type="checkbox" id="cfgKeepAwake" checked aria-label="Manter tela acesa">
                        <span class="switch__slider"></span>
                    </label>
                </div>
            </div>
        </section>

        <!-- ===== Offline ===== -->
        <section class="config-section" aria-labelledby="sec-offline">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-offline">Offline e cache</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Status</p>
                    <p class="config-row__desc">
                        <span class="sync-dot" id="cfgSyncDot"></span>
                        <span id="cfgSyncStatus">—</span>
                    </p>
                </div>
            </div>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Espaço usado</p>
                    <p class="config-row__desc config-storage" id="cfgStorageUsage">Calculando…</p>
                </div>
                <div class="config-row__control">
                    <button type="button" class="btn btn--secondary btn--sm" onclick="atualizarUso()">
                        Atualizar
                    </button>
                </div>
            </div>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Limpar cache do app</p>
                    <p class="config-row__desc">Remove cifras e dados salvos para uso offline. Recarrega ao confirmar.</p>
                </div>
                <div class="config-row__control">
                    <button type="button" class="btn btn--danger btn--sm" onclick="limparCache()">
                        <?= fdm_icon('trash', 14) ?> Limpar cache
                    </button>
                </div>
            </div>
        </section>

        <!-- ===== Conta ===== -->
        <section class="config-section" aria-labelledby="sec-conta">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-conta">Conta</h2></header>

            <div class="config-row">
                <div class="config-user">
                    <div class="config-user__avatar" aria-hidden="true"><?= e(strtoupper(substr($usuario['nome'] ?? 'U', 0, 1))) ?></div>
                    <div>
                        <p class="config-row__title"><?= e($usuario['nome'] ?? 'Usuário') ?></p>
                        <p class="config-row__desc">@<?= e($usuario['username'] ?? '—') ?> · <?= e(ucfirst($usuario['perfil'] ?? 'usuário')) ?></p>
                    </div>
                </div>
                <div class="config-row__control">
                    <a href="/logout.php" class="btn btn--secondary btn--sm">Sair</a>
                </div>
            </div>
        </section>

        <!-- ===== Sobre ===== -->
        <section class="config-section" aria-labelledby="sec-sobre">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-sobre">Sobre</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Cifras FDM</p>
                    <p class="config-row__desc">App de cifras dos Filhos de Maria · versão <span id="cfgVersion">—</span></p>
                </div>
            </div>
        </section>
    </div>

    <script>
        // Config vinda do servidor (PHP → JS)
        var _serverConfig = <?= json_encode($usuario['config'] ?? [], JSON_UNESCAPED_UNICODE) ?>;

        function cfgGet(key, fallback) {
            // servidor tem prioridade; localStorage é fallback para compatibilidade
            if (_serverConfig && _serverConfig[key] !== undefined) return _serverConfig[key];
            var ls = localStorage.getItem('fdm-' + key);
            return ls !== null ? ls : fallback;
        }

        function cfgSave(key, value) {
            // salva localStorage imediatamente (UX responsiva)
            localStorage.setItem('fdm-' + key, value);
            // persiste no servidor em background
            fetch('/src/backend/users/salvar_config.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: { [key]: value } })
            }).catch(function () {});
        }

        (function () {
            // ---- Tema ----
            var sel = document.getElementById('cfgTheme');
            var savedTheme = cfgGet('tema', window.fdmTheme ? window.fdmTheme.get() : 'dark');
            sel.value = savedTheme;
            sel.addEventListener('change', function () {
                if (!window.fdmTheme) return;
                cfgSave('tema', sel.value);
                if (sel.value === 'auto') {
                    localStorage.removeItem('fdm-theme');
                    document.documentElement.removeAttribute('data-theme');
                    fdmToast && fdmToast('Tema automático ativado', 'success', { duration: 2000 });
                } else {
                    window.fdmTheme.set(sel.value);
                    fdmToast && fdmToast('Tema ' + (sel.value === 'dark' ? 'escuro' : 'claro') + ' ativado', 'success', { duration: 2000 });
                }
            });

            // ---- Cifra: tamanho da fonte ----
            var savedSize = cfgGet('cifraSize', '18');
            var cifraSel = document.getElementById('cfgCifraSize');
            cifraSel.value = savedSize;
            document.documentElement.style.setProperty('--cifra-size', savedSize + 'px');
            cifraSel.addEventListener('change', function () {
                cfgSave('cifraSize', cifraSel.value);
                document.documentElement.style.setProperty('--cifra-size', cifraSel.value + 'px');
                fdmToast && fdmToast('Tamanho salvo: ' + cifraSel.value + 'px', 'success', { duration: 1500 });
            });

            // ---- Apresentação: velocidade ----
            var savedSpeed = cfgGet('scrollSpeed', 'normal');
            var speedSel = document.getElementById('cfgScrollSpeed');
            speedSel.value = savedSpeed;
            speedSel.addEventListener('change', function () {
                cfgSave('scrollSpeed', speedSel.value);
                fdmToast && fdmToast('Velocidade salva', 'success', { duration: 1500 });
            });

            // ---- Apresentação: wake lock ----
            var savedWake = cfgGet('keepAwake', 'true');
            var wakeChk = document.getElementById('cfgKeepAwake');
            wakeChk.checked = savedWake !== 'false' && savedWake !== false;
            wakeChk.addEventListener('change', function () {
                cfgSave('keepAwake', wakeChk.checked ? 'true' : 'false');
            });

            // ---- Sync status ----
            var syncDot = document.getElementById('cfgSyncDot');
            var syncTxt = document.getElementById('cfgSyncStatus');
            function updateSync() {
                if (navigator.onLine) {
                    syncDot.className = 'sync-dot sync-dot--online';
                    syncTxt.textContent = 'Online';
                } else {
                    syncDot.className = 'sync-dot sync-dot--offline';
                    syncTxt.textContent = 'Offline — você ainda pode acessar tudo que está salvo';
                }
            }
            updateSync();
            window.addEventListener('online', updateSync);
            window.addEventListener('offline', updateSync);

            // ---- Espaço usado ----
            async function atualizarUso() {
                var el = document.getElementById('cfgStorageUsage');
                if (!navigator.storage || !navigator.storage.estimate) {
                    el.textContent = 'Indisponível neste navegador';
                    return;
                }
                try {
                    var est = await navigator.storage.estimate();
                    var usedMB = (est.usage / 1024 / 1024).toFixed(1);
                    var quotaMB = (est.quota / 1024 / 1024).toFixed(0);
                    var pct = est.quota ? ((est.usage / est.quota) * 100).toFixed(1) : '?';
                    el.textContent = usedMB + ' MB usados de ' + quotaMB + ' MB (' + pct + '%)';
                } catch (e) {
                    el.textContent = 'Não foi possível calcular';
                }
            }
            window.atualizarUso = atualizarUso;
            atualizarUso();

            // ---- Limpar cache ----
            window.limparCache = async function () {
                var ok = await fdmConfirm({
                    title: 'Limpar cache do app',
                    message: 'Isso vai apagar dados salvos localmente (preferências e cifras em cache para uso offline) e recarregar a página. Você precisará de internet na próxima abertura.',
                    confirmText: 'Sim, limpar',
                    cancelText: 'Cancelar',
                    danger: true
                });
                if (!ok) return;
                localStorage.clear();
                sessionStorage.clear();
                if ('caches' in window) {
                    var keys = await caches.keys();
                    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
                }
                if ('serviceWorker' in navigator) {
                    var regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(function (r) { return r.unregister(); }));
                }
                location.reload();
            };

            // ---- Versão (via service-worker.js CACHE_NAME ou manifest) ----
            fetch('/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
                var v = document.getElementById('cfgVersion');
                if (v) v.textContent = (m && m.version) || '1.0';
            }).catch(function () {
                var v = document.getElementById('cfgVersion');
                if (v) v.textContent = '—';
            });
        })();
    </script>
</body>
</html>
