<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Configurações</title>
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
    <script src="/src/js/cifro-theme.js"></script>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/theme.css" rel="stylesheet">
    <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
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
            overflow-wrap: break-word;
            word-break: normal;
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
            min-height: 44px;
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
            width: 52px;
            height: 44px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .switch__slider {
            position: absolute;
            cursor: pointer;
            inset: 6px 0;
            background: var(--bg-3);
            border-radius: 24px;
            transition: background var(--t-fast);
        }
        .switch__slider::before {
            content: "";
            position: absolute;
            height: 24px;
            width: 24px;
            left: 4px;
            top: 4px;
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
            flex: 1;
            min-width: 0;
        }
        .config-user > div:last-child { min-width: 0; }
        .config-user .config-row__desc { overflow-wrap: anywhere; }
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
        .config-advanced {
            border-top: 1px solid var(--border-1);
        }
        .config-advanced__summary {
            cursor: pointer;
            list-style: none;
            padding: var(--space-4);
            color: var(--text-1);
            font-size: var(--text-sm);
            font-weight: var(--fw-medium);
        }
        .config-advanced__summary::-webkit-details-marker { display: none; }
        .config-advanced__summary::after {
            content: "+";
            float: right;
            color: var(--text-2);
            font-size: var(--text-lg);
            line-height: 1;
        }
        .config-advanced[open] .config-advanced__summary::after { content: "−"; }
        .config-advanced__content {
            border-top: 1px solid var(--border-1);
        }
        @media (max-width: 480px) {
            .config-container { padding: 12px; }
            .config-row { flex-direction: column; align-items: flex-start; }
            .config-row__control { width: 100%; }
            .config-row__control select,
            .config-row__control input[type="number"] { width: 100%; min-width: 0; }
            .config-row--compact { flex-direction: row; align-items: center; }
            .config-row--compact .config-row__control { width: auto; }
            .config-row--compact .btn { min-height: 44px; }
            .config-row__control .btn { width: 100%; min-height: 44px; }
        }
    </style>
</head>
<body>
    <?php render_partial('topnav'); ?>

    <div class="config-container">
        <a href="/index.php" class="config-back" aria-label="Voltar para a lista de músicas">
            <?= cifro_icon('arrow-left', 16) ?> Voltar
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
                        <option value="14">Pequeno</option>
                        <option value="16">Médio</option>
                        <option value="18" selected>Padrão</option>
                        <option value="20">Grande</option>
                        <option value="22">Extra grande</option>
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
                    <p class="config-row__desc">Evita que o celular bloqueie a tela durante a apresentação.</p>
                </div>
                <div class="config-row__control">
                    <label class="switch">
                        <input type="checkbox" id="cfgKeepAwake" checked aria-label="Manter tela acesa">
                        <span class="switch__slider"></span>
                    </label>
                </div>
            </div>
        </section>

        <!-- ===== Conta ===== -->
        <section class="config-section" aria-labelledby="sec-conta">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-conta">Conta</h2></header>

            <div class="config-row config-row--compact">
                <div class="config-user">
                    <div class="config-user__avatar" aria-hidden="true"><?= e(strtoupper(substr($usuario['nome'] ?? 'U', 0, 1))) ?></div>
                    <div>
                        <p class="config-row__title"><?= e($usuario['nome'] ?? 'Usuário') ?></p>
                        <p class="config-row__desc"><?= e($usuario['email'] ?? '—') ?> · <?= e(ucfirst($usuario['perfil'] ?? 'usuário')) ?></p>
                    </div>
                </div>
                <div class="config-row__control">
                    <a href="/logout.php" class="btn btn--secondary btn--sm"><?= cifro_icon('log-out', 14) ?> Sair da conta</a>
                </div>
            </div>
            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Privacidade e dados</p>
                    <p class="config-row__desc">Baixe seus dados pessoais ou exclua definitivamente sua conta.</p>
                </div>
                <div class="config-row__control" style="display:flex;gap:8px;flex-wrap:wrap">
                    <a href="/api/account/export.php" class="btn btn--secondary btn--sm">Exportar meus dados</a>
                    <button type="button" id="deleteAccountButton" class="btn btn--danger btn--sm">Excluir conta</button>
                </div>
            </div>
        </section>

        <!-- ===== Offline ===== -->
        <section class="config-section" aria-labelledby="sec-offline">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-offline">Dados offline</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Status</p>
                    <p class="config-row__desc">
                        <span class="sync-dot" id="cfgSyncDot"></span>
                        <span id="cfgSyncStatus">—</span>
                    </p>
                </div>
            </div>

            <div class="config-row config-row--compact">
                <div class="config-row__label">
                    <p class="config-row__title">Sincronizar dados</p>
                    <p class="config-row__desc">Baixa músicas e repertórios atualizados do servidor.</p>
                </div>
                <div class="config-row__control">
                    <button type="button" class="btn btn--primary btn--sm" id="btnSyncDados" onclick="sincronizarDados()">
                        <?= cifro_icon('refresh', 14) ?> Sincronizar
                    </button>
                </div>
            </div>

            <details class="config-advanced">
                <summary class="config-advanced__summary">Armazenamento e recuperação</summary>
                <div class="config-advanced__content">
                    <div class="config-row config-row--compact">
                        <div class="config-row__label">
                            <p class="config-row__title">Espaço usado</p>
                            <p class="config-row__desc config-storage" id="cfgStorageUsage">Calculando…</p>
                        </div>
                        <div class="config-row__control">
                            <button type="button" class="btn btn--secondary btn--sm" onclick="atualizarUso()">
                                Recalcular espaço usado
                            </button>
                        </div>
                    </div>

                    <div class="config-row config-row--compact">
                        <div class="config-row__label">
                            <p class="config-row__title">Resetar dados locais</p>
                            <p class="config-row__desc">Remove preferências e cifras salvas neste dispositivo. Sua conta e os dados do servidor não serão apagados.</p>
                        </div>
                        <div class="config-row__control">
                            <button type="button" class="btn btn--danger btn--sm" onclick="limparCache()">
                                <?= cifro_icon('trash', 14) ?> Resetar dados
                            </button>
                        </div>
                    </div>

                    <div class="config-row config-row--compact">
                        <div class="config-row__label">
                            <p class="config-row__title">Versão offline anterior</p>
                            <p class="config-row__desc" id="cfgPreviousSnapshot">Verificando disponibilidade…</p>
                        </div>
                        <div class="config-row__control">
                            <button type="button" class="btn btn--secondary btn--sm" id="btnRestoreSnapshot" disabled>
                                Restaurar versão anterior
                            </button>
                        </div>
                    </div>
                </div>
            </details>
        </section>

        <!-- ===== Sobre ===== -->
        <section class="config-section" aria-labelledby="sec-sobre">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-sobre">Sobre</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Cifrô</p>
                    <p class="config-row__desc">versão <span id="cfgVersion">—</span></p>
                </div>
            </div>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Reportar problema</p>
                    <p class="config-row__desc">Esta aplicação está em fase beta. Encontrou um erro? Nos avise.</p>
                </div>
                <div class="config-row__control">
                    <a class="btn btn--secondary" href="mailto:contato@cifro.online?subject=Reportar%20problema%20-%20Cifr%C3%B4">Reportar problema</a>
                </div>
            </div>
        </section>
    </div>

    <script>window.CIFRO_USER_ID = '<?= e($usuario['id'] ?? '') ?>';</script>
    <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
    <script src="<?= asset_url('/src/js/offline-tools.js') ?>"></script>
    <script>
        window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';
        // Config vinda do servidor (PHP → JS)
        var _serverConfig = <?= json_encode($usuario['config'] ?? [], JSON_UNESCAPED_UNICODE) ?>;

        function cfgGet(key, fallback) {
            // servidor tem prioridade; localStorage é fallback para compatibilidade
            if (_serverConfig && _serverConfig[key] !== undefined) return _serverConfig[key];
            var ls = localStorage.getItem('cifro-' + key);
            return ls !== null ? ls : fallback;
        }

        function cfgGetEnum(key, allowed, fallback) {
            var value = String(cfgGet(key, fallback));
            return allowed.indexOf(value) !== -1 ? value : fallback;
        }

        async function cfgSave(key, value) {
            localStorage.setItem('cifro-' + key, value);
            try {
                var response = await fetch('/src/backend/users/salvar_config.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config: { [key]: value } })
                });
                var result = await response.json();
                if (!response.ok || !result.sucesso) throw new Error('save_failed');
                _serverConfig[key] = value;
                return true;
            } catch (e) {
                return false;
            }
        }

        function showSaveResult(saved, successMessage) {
            if (!window.cifroToast) return;
            cifroToast(
                saved ? successMessage : 'Alteração aplicada neste dispositivo, mas não foi salva na conta.',
                saved ? 'success' : 'error',
                { duration: saved ? 1800 : 4000 }
            );
        }

        (function () {
            // ---- Tema ----
            var sel = document.getElementById('cfgTheme');
            var savedTheme = cfgGetEnum('tema', ['dark', 'light', 'auto'], window.cifroTheme ? window.cifroTheme.get() : 'dark');
            sel.value = savedTheme;
            sel.addEventListener('change', async function () {
                if (!window.cifroTheme) return;
                if (sel.value === 'auto') {
                    localStorage.removeItem('cifro-theme');
                    document.documentElement.removeAttribute('data-theme');
                } else {
                    window.cifroTheme.set(sel.value);
                }
                var saved = await cfgSave('tema', sel.value);
                var message = sel.value === 'auto'
                    ? 'Tema automático ativado'
                    : 'Tema ' + (sel.value === 'dark' ? 'escuro' : 'claro') + ' ativado';
                showSaveResult(saved, message);
            });

            // ---- Cifra: tamanho da fonte ----
            var savedSize = cfgGetEnum('cifraSize', ['14', '16', '18', '20', '22'], '18');
            var cifraSel = document.getElementById('cfgCifraSize');
            cifraSel.value = savedSize;
            document.documentElement.style.setProperty('--cifra-size', savedSize + 'px');
            cifraSel.addEventListener('change', async function () {
                document.documentElement.style.setProperty('--cifra-size', cifraSel.value + 'px');
                var saved = await cfgSave('cifraSize', cifraSel.value);
                showSaveResult(saved, 'Tamanho da cifra salvo');
            });

            // ---- Apresentação: velocidade ----
            var savedSpeed = cfgGetEnum('scrollSpeed', ['slow', 'normal', 'fast'], 'normal');
            var speedSel = document.getElementById('cfgScrollSpeed');
            speedSel.value = savedSpeed;
            speedSel.addEventListener('change', async function () {
                var saved = await cfgSave('scrollSpeed', speedSel.value);
                showSaveResult(saved, 'Velocidade salva');
            });

            // ---- Apresentação: wake lock ----
            var savedWake = cfgGetEnum('keepAwake', ['true', 'false'], 'true');
            var wakeChk = document.getElementById('cfgKeepAwake');
            wakeChk.checked = savedWake === 'true';
            wakeChk.addEventListener('change', async function () {
                var saved = await cfgSave('keepAwake', wakeChk.checked ? 'true' : 'false');
                showSaveResult(saved, 'Preferência salva');
            });

            // ---- Sync status ----
            var syncDot = document.getElementById('cfgSyncDot');
            var syncTxt = document.getElementById('cfgSyncStatus');
            function updateSync() {
                var connectionState = window.CifroConnectivity?.current() || 'verificando';
                if (connectionState === 'servidor_disponivel') {
                    syncDot.className = 'sync-dot sync-dot--online';
                    syncTxt.textContent = 'Servidor disponível';
                } else if (connectionState === 'verificando') {
                    syncDot.className = 'sync-dot sync-dot--syncing';
                    syncTxt.textContent = 'Verificando conexão com o servidor…';
                } else {
                    syncDot.className = 'sync-dot sync-dot--offline';
                    syncTxt.textContent = 'Servidor indisponível — usando a versão salva neste dispositivo. Sincronize quando a conexão voltar.';
                }
            }
            updateSync();
            document.addEventListener('cifro:connectivity', updateSync);

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

            async function atualizarVersaoAnterior() {
                var status = await cifroSync.getSyncStatus(window.CIFRO_BAND_ID);
                var description = document.getElementById('cfgPreviousSnapshot');
                var restoreButton = document.getElementById('btnRestoreSnapshot');
                restoreButton.disabled = !status.previousAvailable;
                description.textContent = status.previousAvailable
                    ? 'Revisão ' + status.previousRevision + ', salva em ' + new Date(status.previousSavedAt).toLocaleString('pt-BR') + '.'
                    : 'Nenhuma versão anterior disponível neste dispositivo.';
            }
            document.getElementById('btnRestoreSnapshot').addEventListener('click', async function () {
                var confirmed = await cifroConfirm({
                    title: 'Restaurar versão offline anterior',
                    message: 'A versão atual e a anterior trocarão de lugar. Você poderá desfazer restaurando novamente.',
                    confirmText: 'Restaurar versão anterior',
                    cancelText: 'Cancelar'
                });
                if (!confirmed) return;
                var restored = await cifroSync.restorePreviousSnapshot(window.CIFRO_BAND_ID);
                cifroToast && cifroToast(restored ? 'Versão offline anterior restaurada.' : 'Nenhuma versão anterior disponível.', restored ? 'success' : 'warning');
                await atualizarVersaoAnterior();
            });
            atualizarVersaoAnterior();

            // ---- Sincronizar dados ----
            window.sincronizarDados = async function () {
                if (!window.CIFRO_BAND_ID) {
                    cifroToast && cifroToast('Banda não identificada. Faça login novamente.', 'error');
                    return;
                }
                var btn = document.getElementById('btnSyncDados');
                if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
                try {
                    var ok = await window.OfflineTools.forceSync(window.CIFRO_BAND_ID);
                    cifroToast && cifroToast(ok ? 'Dados sincronizados!' : 'Servidor indisponível. Seus dados locais foram mantidos; tente sincronizar novamente mais tarde.', ok ? 'success' : 'error', { duration: 4000 });
                } finally {
                    if (btn) { btn.disabled = false; btn.innerHTML = '<?= addslashes(cifro_icon('refresh', 14)) ?> Sincronizar'; }
                    atualizarUso();
                }
            };

            // ---- Limpar cache (Resetar app) ----
            window.limparCache = async function () {
                var ok = await cifroConfirm({
                    title: 'Resetar dados locais',
                    message: 'Preferências e cifras salvas neste dispositivo serão removidas. Sua conta e os dados do servidor não serão apagados. Você precisará de internet na próxima abertura.',
                    confirmText: 'Resetar dados',
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
    <script>
      document.getElementById('deleteAccountButton')?.addEventListener('click', async () => {
        const email = prompt('Digite seu e-mail para confirmar a exclusão definitiva da conta:');
        if (!email) return;
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const response = await fetch('/api/account/delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (!response.ok) {
          alert(result.error?.message || result.mensagem || 'Não foi possível excluir a conta.');
          return;
        }
        location.href = '/landing.php?conta_excluida=1';
      });
    </script>
</body>
</html>
