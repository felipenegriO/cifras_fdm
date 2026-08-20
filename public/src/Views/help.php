<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Central de Ajuda — Cifrô</title>
    <?php csrf_meta(); ?>
    <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
    <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
    <link href="<?= asset_url('/src/css/help.css') ?>" rel="stylesheet">
    <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
    <script>
        window.CIFRO_HELP_ENABLED = true;
        window.CIFRO_HELP_DISABLED = false;
        window.CIFRO_HELP_PAGE = true;
        window.CIFRO_USER_ID = <?= json_encode((string)($_SESSION['usuario']['id'] ?? '')) ?>;
        window.CIFRO_BAND_ID = <?= json_encode(current_band_id()) ?>;
        if (localStorage.getItem('cifro-ajudaDesativada') === 'true') location.replace('config.php#sec-ajuda');
    </script>
</head>
<body>
    <?php render_partial('topnav', ['loadHelpAssets' => false]); ?>

    <main class="help-page" id="main-content">
        <header class="help-hero">
            <a class="help-back" href="<?= e(base_url('/index.php')) ?>"><?= cifro_icon('arrow-left', 16) ?> Voltar</a>
            <p class="help-eyebrow">Central de Ajuda</p>
            <h1>Como podemos ajudar?</h1>
            <p>Encontre orientações rápidas para preparar cifras, repertórios, ensaios e apresentações.</p>
            <label class="help-search" for="helpSearch">
                <span class="sr-only">Buscar na Central de Ajuda</span>
                <?= cifro_icon('search', 20) ?>
                <input id="helpSearch" type="search" autocomplete="off" placeholder="Buscar por Live, offline, repertório…">
            </label>
            <p class="help-search-status" id="helpSearchStatus" role="status" aria-live="polite"></p>
        </header>

        <section class="help-diagnostic" aria-labelledby="helpDiagnosticTitle">
            <div>
                <p class="help-eyebrow">Diagnóstico rápido</p>
                <h2 id="helpDiagnosticTitle">Estado deste dispositivo</h2>
            </div>
            <div class="help-diagnostic-grid" id="helpDiagnosticGrid" aria-live="polite">
                <p>Verificando conexão e disponibilidade offline…</p>
            </div>
        </section>

        <section aria-labelledby="helpGuidesTitle">
            <div class="help-section-heading">
                <div><p class="help-eyebrow">Guias de tarefa</p><h2 id="helpGuidesTitle">Resolva uma tarefa do começo ao fim</h2></div>
                <span id="helpVisibleCount"><?= count($articles) ?> guias</span>
            </div>

            <nav class="help-categories" aria-label="Filtrar guias por categoria">
                <button type="button" class="help-category is-active" data-help-category="all" aria-pressed="true" aria-controls="helpArticles">Todos</button>
                <?php foreach ($categories as $category): ?>
                    <button type="button" class="help-category" data-help-category="<?= e($category) ?>" aria-pressed="false" aria-controls="helpArticles"><?= e($category) ?></button>
                <?php endforeach; ?>
            </nav>
            <p class="help-filter-feedback" id="helpFilterFeedback" role="status" aria-live="polite">Exibindo todos os <?= count($articles) ?> guias.</p>

            <div class="help-articles" id="helpArticles">
                <?php foreach ($articles as $article):
                    $search = implode(' ', array_merge([$article['title'], $article['summary'], $article['category']], $article['keywords']));
                ?>
                    <article class="help-article-card"
                             id="artigo-<?= e($article['id']) ?>"
                             data-help-id="<?= e($article['id']) ?>"
                             data-help-category-value="<?= e($article['category']) ?>"
                             data-help-search="<?= e($search) ?>">
                        <details class="help-article-details">
                            <summary>
                                <span class="help-article-category"><?= e($article['category']) ?></span>
                                <strong><?= e($article['title']) ?></strong>
                                <span><?= e($article['summary']) ?></span>
                            </summary>
                            <div class="help-article-body">
                                <h3>Passos</h3>
                                <ol>
                                    <?php foreach ($article['steps'] as $step): ?><li><?= e($step) ?></li><?php endforeach; ?>
                                </ol>
                                <h3>Problemas comuns</h3>
                                <ul>
                                    <?php foreach ($article['problems'] as $problem): ?><li><?= e($problem) ?></li><?php endforeach; ?>
                                </ul>
                                <?php if ($article['related']): ?>
                                    <div class="help-related">
                                        <strong>Veja também</strong>
                                        <?php foreach ($article['related'] as $related): $relatedArticle = (new HelpCenterService())->find($related); ?>
                                            <?php if ($relatedArticle): ?><a href="?artigo=<?= e($related) ?>" data-help-related="<?= e($related) ?>"><?= e($relatedArticle['title']) ?></a><?php endif; ?>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endif; ?>
                                <div class="help-article-footer">
                                    <span>Atualizado em <?= e(date('d/m/Y', strtotime($article['updated_at']))) ?> · disponível offline</span>
                                    <button type="button" class="btn btn--secondary btn--sm" data-help-complete="<?= e($article['id']) ?>">Concluí este guia</button>
                                </div>
                            </div>
                        </details>
                    </article>
                <?php endforeach; ?>
            </div>

            <div class="help-empty" id="helpEmpty" hidden>
                <h3>Nenhum guia encontrado</h3>
                <p>Tente buscar por outro termo ou consulte o glossário.</p>
            </div>
        </section>

        <section class="help-glossary" aria-labelledby="helpGlossaryTitle">
            <div class="help-section-heading"><div><p class="help-eyebrow">Glossário</p><h2 id="helpGlossaryTitle">Termos usados no Cifrô</h2></div></div>
            <dl>
                <?php foreach ($glossary as $item): ?>
                    <div data-help-glossary="<?= e($item['term'] . ' ' . $item['definition']) ?>">
                        <dt><?= e($item['term']) ?></dt>
                        <dd><?= e($item['definition']) ?></dd>
                    </div>
                <?php endforeach; ?>
            </dl>
        </section>

        <section class="help-preference" aria-labelledby="helpPreferenceTitle">
            <div>
                <h2 id="helpPreferenceTitle">Não quer usar a Central de Ajuda?</h2>
                <p>Esta preferência será salva na sua conta. Links, sugestões e a Central deixarão de aparecer em todos os dispositivos após a próxima atualização da sessão.</p>
            </div>
            <label><input type="checkbox" id="helpDisablePage"> Não mostrar a Central de Ajuda novamente</label>
        </section>
    </main>

    <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-help.js') ?>"></script>
</body>
</html>
