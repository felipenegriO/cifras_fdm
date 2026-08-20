<?php
/**
 * Aba Categorias do "Minha Banda".
 * Recorte de Views/categorias.php, sem redesenho: mesma marcação, mesmo
 * JavaScript. A casca já fornece head, topnav e os scripts compartilhados.
 */
?>
<?php if (help_center_visible_for_user()): ?><button type="button" class="help-context-link" data-help-article="categorias" data-help-source="banda-categorias">Como funcionam as categorias?</button><?php endif; ?>
<style>
  .category-form { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .category-form input { flex: 1; min-width: 0; }
  .category-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-1); }
  .category-row { display: flex; align-items: center; gap: var(--space-3); min-height: 58px; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-1); }
  .category-row:last-child { border-bottom: 0; }
  .category-name { flex: 1; min-width: 0; font-weight: var(--fw-medium); overflow-wrap: break-word; word-break: normal; }
  .category-actions { display: flex; gap: var(--space-2); }
  .category-empty { padding: var(--space-6); text-align: center; color: var(--text-2); }
  .category-count { flex: 0 0 auto; font-size: var(--text-sm); color: var(--text-2); white-space: nowrap; }
  .category-row .btn[disabled] { opacity: .5; cursor: not-allowed; }
  @media (max-width: 480px) { .category-form { flex-wrap: wrap; } .category-form input { flex-basis: 100%; } }
  .category-onboarding { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--bg-1); padding: var(--space-5); margin-bottom: var(--space-4); }
  .category-onboarding h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .category-onboarding p { margin: 0 0 var(--space-4); color: var(--text-2); font-size: var(--text-sm); line-height: 1.5; }
  .category-kit { border: 1px solid var(--border-1); border-radius: var(--radius-sm); padding: var(--space-3); margin-bottom: var(--space-3); }
  .category-kit__title { font-weight: var(--fw-medium); font-size: var(--text-sm); margin-bottom: var(--space-2); }
  .category-kit__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  .category-kit__chip { font-size: var(--text-xs); padding: 2px var(--space-2); border-radius: 999px; border: 1px solid var(--border-1); color: var(--text-2); }
  .category-onboarding__foot { margin: var(--space-4) 0 0; font-size: var(--text-xs); }
</style>

<div id="categoryOnboarding" hidden></div>
<form class="category-form" id="categoryForm">
  <input type="hidden" id="categoryId">
  <label class="sr-only" for="categoryName">Nome da categoria</label>
  <input type="text" id="categoryName" maxlength="100" placeholder="Nome da categoria" required autocomplete="off">
  <button type="submit" class="btn btn--primary" id="saveCategory">Salvar categoria</button>
  <button type="button" class="btn btn--secondary" id="cancelEdit" hidden>Cancelar</button>
</form>
<ul class="category-list" id="categoryList" aria-live="polite"></ul>

<script src="<?= asset_url('/src/js/categorias.js') ?>" defer></script>
