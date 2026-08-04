<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Categorias - Cifrô</title>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
  <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
  <style>
    body { margin: 0; background: var(--bg-0); color: var(--text-1); }
    .categories-page { max-width: 720px; margin: 0 auto; padding: var(--space-4); }
    .categories-page h1 { margin: var(--space-4) 0; font-size: var(--text-2xl); }
    .category-form { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
    .category-form input { flex: 1; min-width: 0; }
    .category-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-1); }
    .category-row { display: flex; align-items: center; gap: var(--space-3); min-height: 58px; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-1); }
    .category-row:last-child { border-bottom: 0; }
    .category-name { flex: 1; min-width: 0; font-weight: var(--fw-medium); overflow-wrap: break-word; word-break: normal; }
    .category-actions { display: flex; gap: var(--space-2); }
    .category-empty { padding: var(--space-6); text-align: center; color: var(--text-2); }
    @media (max-width: 480px) { .category-form { flex-wrap: wrap; } .category-form input { flex-basis: 100%; } }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>
  <main class="categories-page">
    <h1>Categorias</h1>
    <form class="category-form" id="categoryForm">
      <input type="hidden" id="categoryId">
      <label class="sr-only" for="categoryName">Nome da categoria</label>
      <input type="text" id="categoryName" maxlength="100" placeholder="Nome da categoria" required autocomplete="off">
      <button type="submit" class="btn btn--primary" id="saveCategory">Salvar categoria</button>
      <button type="button" class="btn btn--secondary" id="cancelEdit" hidden>Cancelar</button>
    </form>
    <ul class="category-list" id="categoryList" aria-live="polite"></ul>
  </main>
  <script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';</script>
  <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
  <script src="<?= asset_url('/src/js/categorias.js') ?>"></script>
</body>
</html>
