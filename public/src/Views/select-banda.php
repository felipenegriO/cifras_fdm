<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Selecionar Banda — Cifrô</title>
    <?php csrf_meta(); ?>
    <script src="/src/js/cifro-theme.js"></script>
    <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
    <script>window.CIFRO_USER_ID = '<?= e($usuario['id'] ?? '') ?>';</script>
    <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/theme.css" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .sb-page { width: 100%; max-width: 560px; padding: var(--space-6) var(--space-4); }
        .sb-back { display: inline-flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); color: var(--text-2); font-size: var(--text-sm); text-decoration: none; }
        .sb-back:hover { color: var(--text-1); }
        .sb-logo { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
        .sb-logo img { width: 132px; height: auto; object-fit: contain; }
        .sb-title { font-size: var(--text-2xl); font-weight: var(--fw-semibold); color: var(--text-1); margin: 0 0 var(--space-1); }
        .sb-sub { font-size: var(--text-sm); color: var(--text-2); margin: 0 0 var(--space-6); }
        .sb-grid { display: flex; flex-direction: column; gap: var(--space-3); }
        .sb-card {
            display: flex; align-items: center; gap: var(--space-4);
            background: var(--bg-1); border: 1px solid var(--border-1);
            border-radius: var(--radius-md); padding: var(--space-4);
            cursor: pointer; text-decoration: none; color: inherit;
            transition: background var(--t-fast), border-color var(--t-fast);
        }
        .sb-card:hover { background: var(--bg-2); border-color: var(--brand); }
        .sb-card--offline-disabled { opacity: .5; cursor: not-allowed; border-style: dashed; }
        .sb-card__avatar {
            width: 48px; height: 48px; border-radius: var(--radius-md);
            background: var(--brand-soft); color: var(--brand);
            display: flex; align-items: center; justify-content: center;
            font-weight: var(--fw-bold); font-size: var(--text-lg); flex-shrink: 0;
        }
        .sb-card__avatar img { width: 34px; height: 34px; object-fit: contain; }
        .sb-card__info { flex: 1; min-width: 0; }
        .sb-card__name { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); margin: 0 0 2px; }
        .sb-card__role { font-size: var(--text-xs); color: var(--text-2); margin: 0; }
        .sb-card__arrow { color: var(--text-3); flex-shrink: 0; }
        .sb-empty { text-align: center; color: var(--text-2); padding: var(--space-8) 0; }
        .sb-logout { display: block; text-align: center; margin-top: var(--space-6); font-size: var(--text-sm); color: var(--text-2); text-decoration: none; }
        .sb-logout:hover { color: var(--text-1); }
        .sb-new-band {
            display: flex; align-items: center; justify-content: center; gap: var(--space-2);
            margin-top: var(--space-4); padding: var(--space-3) var(--space-4);
            border: 2px dashed var(--border-1); border-radius: var(--radius-md);
            background: transparent; color: var(--text-2);
            cursor: pointer; font-size: var(--text-sm); font-family: inherit;
            width: 100%; transition: border-color var(--t-fast), color var(--t-fast);
        }
        .sb-new-band:hover { border-color: var(--brand); color: var(--brand); }
        .sb-modal-overlay {
            display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6);
            z-index: 100; align-items: center; justify-content: center;
        }
        .sb-modal-overlay.open { display: flex; }
        .sb-modal {
            background: var(--bg-0); border: 1px solid var(--border-1);
            border-radius: var(--radius-lg); padding: var(--space-6);
            width: 100%; max-width: 400px; margin: var(--space-4);
        }
        .sb-modal h2 { font-size: var(--text-xl); font-weight: var(--fw-semibold); color: var(--text-1); margin: 0 0 var(--space-4); }
        .sb-modal input {
            width: 100%; box-sizing: border-box;
            padding: var(--space-2) var(--space-3);
            background: var(--bg-1); border: 1px solid var(--border-1);
            border-radius: var(--radius-sm); color: var(--text-1);
            font-size: var(--text-sm); font-family: inherit;
        }
        .sb-modal input:focus { outline: none; border-color: var(--brand); }
        .sb-modal-actions { display: flex; gap: var(--space-3); margin-top: var(--space-4); justify-content: flex-end; }
        .sb-btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--text-sm); cursor: pointer; border: 1px solid transparent; font-family: inherit; }
        .sb-btn-ghost { background: transparent; border-color: var(--border-1); color: var(--text-2); }
        .sb-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: var(--fw-medium); }
        .sb-btn:disabled { opacity: .5; cursor: not-allowed; }
    </style>
</head>
<body>
<div class="sb-page">
    <a href="/index.php" class="sb-back" aria-label="Voltar para o início">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        Voltar
    </a>
    <div class="sb-logo">
        <img src="/src/images/cifro-logo.svg" alt="Cifrô">
    </div>
    <h1 class="sb-title">Selecionar banda</h1>
    <p class="sb-sub">Bem-vindo, <?= e($usuario['nome'] ?? 'Usuário') ?>. Escolha a banda que deseja acessar.</p>

    <div class="sb-grid">
        <?php if (empty($bandas)): ?>
            <div class="sb-empty">Você ainda não tem uma banda. Crie uma para começar seu repertório.</div>
        <?php else: ?>
            <?php foreach ($bandas as $banda): ?>
                <?php
                    $perfil = $banda['usuario_perfil'] ?? 'basico';
                    $perfilLabel = ['master' => 'Master', 'administrador' => 'Administrador', 'gestor' => 'Gestor', 'basico' => 'Básico'][$perfil] ?? ucfirst($perfil);
                    $logo = $banda['logo'] ?: '/src/images/cifro-mark.svg';
                ?>
                <a class="sb-card" data-band-id="<?= e($banda['id']) ?>" href="#" onclick="selecionarBanda('<?= e($banda['id']) ?>', event)">
                    <div class="sb-card__avatar"><img src="<?= e($logo) ?>" alt=""></div>
                    <div class="sb-card__info">
                        <p class="sb-card__name"><?= e($banda['nome']) ?></p>
                        <p class="sb-card__role"><?= $perfilLabel ?><?= $banda['ativo'] ? '' : ' · Inativa' ?></p>
                    </div>
                    <svg class="sb-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <button class="sb-new-band" id="btnNovaBanda" onclick="abrirModalNovaBanda()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Criar nova banda
    </button>

    <a href="/logout.php" class="sb-logout">Sair da conta</a>
</div>

<!-- Modal Nova Banda -->
<div class="sb-modal-overlay" id="modalNovaBanda">
    <div class="sb-modal">
        <h2>Nova banda</h2>
        <input type="text" id="inputNomeBanda" placeholder="Nome da banda" maxlength="120" autocomplete="off">
        <div class="sb-modal-actions">
            <button class="sb-btn sb-btn-ghost" onclick="fecharModalNovaBanda()">Cancelar</button>
            <button class="sb-btn sb-btn-primary" id="btnCriarBanda" onclick="criarBanda()">Criar banda</button>
        </div>
    </div>
</div>

<script>
cifroSync.cacheBands(<?= json_encode(array_map(fn($b) => [
    'banda_id' => $b['id'], 'nome' => $b['nome'], 'perfil' => $b['usuario_perfil'] ?? 'basico',
    'logo' => $b['logo'] ?? null, 'ativo' => (bool)($b['ativo'] ?? true)
], $bandas), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>).catch(() => {});

async function refreshOfflineCards() {
    const serverAvailable = window.CifroConnectivity?.isServerAvailable() || false;
    const cards = Array.from(document.querySelectorAll('.sb-card[data-band-id]'));
    for (const card of cards) {
        const status = await cifroSync.getOfflineStatus(card.dataset.bandId);
        const role = card.querySelector('.sb-card__role');
        const suffix = status.ready
            ? ` · Offline pronto · revisão ${status.contentRevision} · ${new Date(status.preparedAt).toLocaleString('pt-BR')}`
            : ' · Offline não preparado';
        if (!role.dataset.baseText) role.dataset.baseText = role.textContent;
        role.textContent = role.dataset.baseText + suffix;
        card.classList.toggle('sb-card--offline-disabled', !serverAvailable && !status.ready);
        card.setAttribute('aria-disabled', String(!serverAvailable && !status.ready));
    }
}
refreshOfflineCards().catch(() => {});
window.addEventListener('online', () => refreshOfflineCards().catch(() => {}));
window.addEventListener('offline', () => refreshOfflineCards().catch(() => {}));
document.addEventListener('cifro:connectivity', () => refreshOfflineCards().catch(() => {}));

function abrirModalNovaBanda() {
    document.getElementById('modalNovaBanda').classList.add('open');
    setTimeout(() => document.getElementById('inputNomeBanda').focus(), 50);
}
function fecharModalNovaBanda() {
    document.getElementById('modalNovaBanda').classList.remove('open');
    document.getElementById('inputNomeBanda').value = '';
}

async function criarBanda() {
    const nome = document.getElementById('inputNomeBanda').value.trim();
    if (!nome) { cifroToast && cifroToast('Informe o nome da banda.', 'warning'); return; }

    const btn = document.getElementById('btnCriarBanda');
    btn.disabled = true;
    btn.textContent = 'Criando…';

    try {
        const csrf = window.cifroCsrf ? window.cifroCsrf() : (document.querySelector('meta[name=csrf-token]')?.content ?? '');
        const res = await fetch('/api/bandas/criar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ nome })
        });
        const json = await res.json();

        if (res.ok && json.ok) {
            // Auto-select the new band
            const sel = await fetch('/src/backend/bandas/selecionar.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                body: JSON.stringify({ bandaId: json.id })
            });
            const selJson = await sel.json();
            if (selJson.sucesso) {
                cifroSync.selectOnlineBand(json.id);
                window.location.href = '/index.php';
            } else {
                cifroToast && cifroToast(selJson.mensagem || 'Banda criada, mas erro ao selecionar.', 'error');
            }
        } else if (json.plano_limit) {
            fecharModalNovaBanda();
            cifroToast && cifroToast(json.mensagem || 'Limite do plano atingido.', 'error');
            setTimeout(() => window.location.href = '/plano.php', 2000);
        } else {
            cifroToast && cifroToast(json.mensagem || 'Erro ao criar banda.', 'error');
        }
    } catch {
        cifroToast && cifroToast('Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar banda';
    }
}

document.getElementById('inputNomeBanda').addEventListener('keydown', e => {
    if (e.key === 'Enter') criarBanda();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('modalNovaBanda').classList.contains('open')) {
        fecharModalNovaBanda();
    }
});

async function selecionarBanda(bandaId, e) {
    e.preventDefault();
    try {
        const csrf = window.cifroCsrf ? window.cifroCsrf() : (document.querySelector('meta[name=csrf-token]')?.content ?? '');
        const res = await fetch('/src/backend/bandas/selecionar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ bandaId })
        });
        const json = await res.json();
        if (json.sucesso) {
            cifroSync.selectOnlineBand(bandaId);
            window.location.href = '/index.php';
        } else {
            cifroToast && cifroToast(json.mensagem || 'Erro ao selecionar banda.', 'error');
        }
    } catch {
        if (await cifroSync.selectOfflineBand(bandaId)) {
            window.location.href = '/index.php';
        } else {
            cifroToast && cifroToast('O servidor está indisponível e esta banda ainda não foi preparada para uso offline.', 'warning');
        }
    }
}
</script>
</body>
</html>
