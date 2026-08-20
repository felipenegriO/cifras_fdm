<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <?php csrf_meta(); ?>
  <title>Minha Banda — Cifrô</title>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
  <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
  <style>
    body { margin: 0; background: var(--bg-0); color: var(--text-1); }
    .mb-page { max-width: 860px; margin: 0 auto; padding: var(--space-4); }
    .mb-titulo { margin: var(--space-4) 0 var(--space-2); font-size: var(--text-2xl); }
    .mb-banda { margin: 0 0 var(--space-5); color: var(--text-2); font-size: var(--text-sm); }

    /* Navegação de abas: rolagem horizontal no celular em vez de quebrar linha,
       para a lista continuar previsível com cinco itens em tela estreita. */
    .mb-abas {
      display: flex; gap: var(--space-1); margin-bottom: var(--space-5);
      border-bottom: 1px solid var(--border-1);
      overflow-x: auto; scrollbar-width: none;
    }
    .mb-abas::-webkit-scrollbar { display: none; }
    .mb-aba {
      flex: 0 0 auto; padding: var(--space-3) var(--space-4);
      border: 0; background: transparent; color: var(--text-2);
      font: inherit; font-size: var(--text-sm); cursor: pointer;
      border-bottom: 2px solid transparent; text-decoration: none;
      min-height: 44px; /* área de toque confortável no celular */
      display: inline-flex; align-items: center; white-space: nowrap;
    }
    .mb-aba:hover { color: var(--text-1); }
    .mb-aba[aria-selected="true"] { color: var(--brand); border-bottom-color: var(--brand); font-weight: var(--fw-medium); }

    .mb-checklist { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--bg-1); padding: var(--space-4); margin-bottom: var(--space-5); }
    .mb-checklist h2 { margin: 0 0 var(--space-3); font-size: var(--text-base); }
    .mb-checklist ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .mb-checklist li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
    .mb-checklist li[data-concluido="1"] { color: var(--text-2); }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>

  <main class="mb-page">
    <h1 class="mb-titulo">Minha Banda</h1>
    <p class="mb-banda"><?= e($_SESSION['banda_atual']['nome'] ?? '') ?></p>

    <?php if (!empty($checklist)): ?>
      <section class="mb-checklist" aria-label="Configuração da banda">
        <h2>Configure sua banda</h2>
        <ul>
          <?php foreach ($checklist as $passo): ?>
            <li data-concluido="<?= $passo['concluido'] ? '1' : '0' ?>" data-passo="<?= e($passo['id']) ?>">
              <span aria-hidden="true"><?= $passo['concluido'] ? '✓' : '○' ?></span>
              <?php if ($passo['concluido']): ?>
                <span><?= e($passo['rotulo']) ?></span>
              <?php else: ?>
                <a href="<?= e(base_url('/minha-banda.php?aba=' . $passo['aba'])) ?>"><?= e($passo['rotulo']) ?></a>
              <?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      </section>
    <?php endif; ?>

    <nav class="mb-abas" role="tablist" aria-label="Administração da banda">
      <?php foreach ($abasVisiveis as $aba): $ativa = $aba === $abaAtiva; ?>
        <a class="mb-aba"
           role="tab"
           id="mbAba-<?= e($aba) ?>"
           href="<?= e(base_url('/minha-banda.php?aba=' . $aba)) ?>"
           aria-selected="<?= $ativa ? 'true' : 'false' ?>"
           aria-controls="mbPainel-<?= e($aba) ?>"
           data-aba="<?= e($aba) ?>"><?= e(BandaAdminTabs::rotulo($aba)) ?></a>
      <?php endforeach; ?>
    </nav>

    <section class="mb-painel"
             role="tabpanel"
             id="mbPainel-<?= e($abaAtiva) ?>"
             aria-labelledby="mbAba-<?= e($abaAtiva) ?>"
             data-aba-ativa="<?= e($abaAtiva) ?>">
      <?php
        // Cada aba é um parcial com marcação, estilo e scripts próprios. Só o
        // parcial ativo é incluído: carregar os cinco de uma vez traria o
        // JavaScript de todos e eles disputariam os mesmos elementos.
        render_partial('banda/aba-' . $abaAtiva);
      ?>
    </section>
  </main>

  <script>
    window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>';
    window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';
  </script>
  <script src="<?= asset_url('/src/js/cifro-share.js') ?>"></script>
  <script src="<?= asset_url('/src/js/banda-convite-share.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
</body>
</html>
