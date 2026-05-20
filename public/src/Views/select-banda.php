<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Selecionar Banda — StageBox</title>
    <?php csrf_meta(); ?>
    <script src="/src/js/fdm-theme.js"></script>
    <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/theme.css" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .sb-page { width: 100%; max-width: 560px; padding: var(--space-6) var(--space-4); }
        .sb-logo { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
        .sb-logo img { width: 36px; height: 36px; object-fit: contain; }
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
        .sb-card__avatar {
            width: 48px; height: 48px; border-radius: var(--radius-md);
            background: var(--brand-soft); color: var(--brand);
            display: flex; align-items: center; justify-content: center;
            font-weight: var(--fw-bold); font-size: var(--text-lg); flex-shrink: 0;
        }
        .sb-card__info { flex: 1; min-width: 0; }
        .sb-card__name { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); margin: 0 0 2px; }
        .sb-card__role { font-size: var(--text-xs); color: var(--text-2); margin: 0; }
        .sb-card__arrow { color: var(--text-3); flex-shrink: 0; }
        .sb-empty { text-align: center; color: var(--text-2); padding: var(--space-8) 0; }
        .sb-logout { display: block; text-align: center; margin-top: var(--space-6); font-size: var(--text-sm); color: var(--text-2); text-decoration: none; }
        .sb-logout:hover { color: var(--text-1); }
    </style>
</head>
<body>
<div class="sb-page">
    <div class="sb-logo">
        <img src="/src/images/imagemlogofdm.webp" alt="StageBox">
    </div>
    <h1 class="sb-title">Selecionar banda</h1>
    <p class="sb-sub">Bem-vindo, <?= e($usuario['nome'] ?? 'Usuário') ?>. Escolha a banda que deseja acessar.</p>

    <div class="sb-grid">
        <?php if (empty($bandas)): ?>
            <div class="sb-empty">Você não está vinculado a nenhuma banda.</div>
        <?php else: ?>
            <?php foreach ($bandas as $banda): ?>
                <?php
                    $perfil = $banda['usuario_perfil'] ?? 'basico';
                    $perfilLabel = ['master' => 'Master', 'administrador' => 'Administrador', 'gestor' => 'Gestor', 'basico' => 'Básico'][$perfil] ?? ucfirst($perfil);
                    $inicial = strtoupper(mb_substr($banda['nome'] ?? 'B', 0, 1));
                ?>
                <a class="sb-card" href="#" onclick="selecionarBanda('<?= e($banda['id']) ?>', event)">
                    <div class="sb-card__avatar"><?= $inicial ?></div>
                    <div class="sb-card__info">
                        <p class="sb-card__name"><?= e($banda['nome']) ?></p>
                        <p class="sb-card__role"><?= $perfilLabel ?><?= $banda['ativo'] ? '' : ' · Inativa' ?></p>
                    </div>
                    <svg class="sb-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <a href="/logout.php" class="sb-logout">Sair da conta</a>
</div>

<script>
async function selecionarBanda(bandaId, e) {
    e.preventDefault();
    try {
        const res = await fetch('/src/backend/bandas/selecionar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bandaId })
        });
        const json = await res.json();
        if (json.sucesso) {
            window.location.href = '/index.php';
        } else {
            fdmToast && fdmToast(json.mensagem || 'Erro ao selecionar banda.', 'error');
        }
    } catch {
        fdmToast && fdmToast('Erro de conexão.', 'error');
    }
}
</script>
</body>
</html>
