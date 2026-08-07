<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Editor de Cifras - Cifrô</title>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
  <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/style2.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/editor.css') ?>" rel="stylesheet">
</head>
<body>
  <?php render_partial('topnav'); ?>

  <main class="editor-shell" id="editorShell">
    <div class="editor-mobile-tabs" role="tablist" aria-label="Áreas do editor">
      <button type="button" class="editor-tab" data-panel="library" role="tab"><?= cifro_icon('list', 16) ?> Músicas</button>
      <button type="button" class="editor-tab is-active" data-panel="workspace" role="tab" aria-selected="true"><?= cifro_icon('edit', 16) ?> Editar</button>
    </div>

    <aside class="song-library editor-panel" id="libraryPanel" data-panel-name="library" aria-label="Biblioteca de músicas">
      <div class="song-library__header">
        <div>
          <h1>Músicas</h1>
          <span id="songCount" class="song-count">Carregando...</span>
        </div>
        <button type="button" class="btn btn--icon btn--secondary" id="collapseLibrary" title="Recolher lista" aria-label="Recolher lista">
          <?= cifro_icon('arrow-left', 18) ?>
        </button>
      </div>

      <label class="search-field" for="buscaMusica">
        <?= cifro_icon('search', 17) ?>
        <input type="search" id="buscaMusica" placeholder="Buscar música" autocomplete="off">
      </label>

      <div id="libraryState" class="library-state" aria-live="polite">Carregando músicas...</div>
      <ul id="musicas" class="song-list" aria-label="Músicas cadastradas"></ul>
    </aside>

    <section class="editor-workspace editor-panel" id="workspacePanel" data-panel-name="workspace">
      <header class="document-bar">
        <button type="button" class="btn btn--icon btn--secondary library-expand" id="expandLibrary" title="Mostrar músicas" aria-label="Mostrar músicas">
          <?= cifro_icon('list', 18) ?>
        </button>

        <label class="compact-field compact-field--title" for="titulo">
          <span>Nome da música</span>
          <input id="titulo" type="text" autocomplete="off">
        </label>

        <div class="document-details" id="songDetails">
          <label class="compact-field compact-field--artist" for="artista">
            <span>Artista</span>
            <input id="artista" type="text" autocomplete="off">
          </label>
          <label class="compact-field compact-field--bpm" for="bit">
            <span>BPM</span>
            <input id="bit" type="number" min="1" max="400" inputmode="numeric">
          </label>
          <label class="compact-field compact-field--key" for="tomPadrao">
            <span>Tom padrão</span>
            <select id="tomPadrao" aria-label="Tom padrão da música" disabled>
              <option value="">Não identificado</option>
            </select>
          </label>
          <label class="compact-field compact-field--classification" for="classificacao">
            <span>Classificação</span>
            <select id="classificacao">
              <option value="">Não classificada</option>
            </select>
          </label>
        </div>

        <span class="dirty-indicator" id="dirtyIndicator" title="Alterações não salvas" aria-label="Alterações não salvas" hidden></span>

        <div class="document-actions">
          <button type="button" class="btn btn--secondary" id="newSongButton"><?= cifro_icon('plus', 16) ?> Nova música</button>
          <button type="button" class="btn btn--secondary" id="importSongButton" title="Importar cifra"><?= cifro_icon('download', 16) ?> Importar cifra</button>
          <button type="button" class="btn btn--secondary" id="previewButton"><?= cifro_icon('eye', 16) ?> Visualizar cifra</button>
          <button type="button" class="btn btn--icon btn--secondary details-toggle" id="toggleSongDetails" title="Detalhes da música" aria-label="Detalhes da música" aria-expanded="false" aria-controls="songDetails"><?= cifro_icon('settings', 18) ?></button>
          <button type="button" class="btn btn--primary" id="saveButton"><?= cifro_icon('save', 16) ?> <span id="saveButtonLabel">Salvar música</span></button>
          <details class="more-actions" id="moreActions">
            <summary class="btn btn--icon btn--secondary" title="Mais ações" aria-label="Mais ações">•••</summary>
            <div class="more-actions__menu">
              <button type="button" class="more-actions__mobile" id="newSongMenuButton"><?= cifro_icon('plus', 16) ?> Nova música</button>
              <button type="button" class="more-actions__danger" id="deleteSongButton"><?= cifro_icon('trash', 16) ?> Excluir música</button>
            </div>
          </details>
        </div>
      </header>

      <div class="editor-canvas" id="editorCanvas">
        <textarea id="cifraInput" aria-label="Cifra da música"></textarea>
        <div id="editorLoadError" class="editor-load-error" hidden>O editor visual não pôde ser carregado. A edição em texto continua disponível.</div>
      </div>

      <p id="status" class="editor-status" role="status" aria-live="polite"></p>
    </section>

  </main>

  <div class="editor-preview-modal" id="previewModal" role="dialog" aria-modal="true" aria-labelledby="previewModalTitle">
    <header class="editor-preview-modal__bar">
      <strong id="previewModalTitle">Visualização da música</strong>
      <button type="button" class="btn btn--secondary" id="closePreviewButton">Fechar</button>
    </header>
    <iframe id="previewFrame" title="Visualização da música"></iframe>
  </div>

  <div class="import-modal" id="importModal" role="dialog" aria-modal="true" aria-labelledby="importModalTitle" hidden>
    <div class="import-modal__box">
      <h2 id="importModalTitle">Importar cifra</h2>
      <div class="import-modal__tabs" role="tablist">
        <button type="button" class="import-modal__tab is-active" id="importTabLinkButton" role="tab" aria-selected="true" aria-controls="importTabLink">Colar link</button>
        <button type="button" class="import-modal__tab" id="importTabTextButton" role="tab" aria-selected="false" aria-controls="importTabText">Colar cifra completa</button>
      </div>

      <div class="import-modal__panel" id="importTabLink" role="tabpanel">
        <p>Cole o link de uma cifra do CifraClub e a aplicação busca o conteúdo automaticamente.</p>
        <label for="importUrlInput">Link do CifraClub</label>
        <input id="importUrlInput" type="url" placeholder="https://www.cifraclub.com.br/...">
        <div class="import-fetch-error" id="importFetchError" role="alert" hidden></div>
      </div>

      <div class="import-modal__panel" id="importTabText" hidden role="tabpanel">
        <p>Cole o conteúdo da cifra. Um link pode ser guardado como referência, mas não é acessado automaticamente.</p>
        <label for="importSourceUrl">Link de origem (opcional)</label>
        <input id="importSourceUrl" type="url" placeholder="https://www.cifraclub.com.br/...">
        <label for="importContent">Conteúdo da cifra</label>
        <textarea id="importContent" rows="14" placeholder="Nome da música&#10;Artista&#10;Tom: C&#10;&#10;C  G  Am  F"></textarea>
        <button type="button" class="btn btn--secondary" id="previewImportButton">Gerar preview</button>
      </div>

      <label class="import-rights"><input id="importRights" type="checkbox" checked> Confirmo que tenho autorização para usar este conteúdo.</label>
      <div class="import-preview" id="importPreview" role="status" aria-live="polite" hidden></div>
      <div class="import-modal__actions">
        <button type="button" class="btn btn--secondary" id="cancelImportButton">Cancelar</button>
        <button type="button" class="btn btn--primary" id="confirmImportButton" disabled>Usar no editor</button>
      </div>
    </div>
  </div>

  <script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';</script>
  <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
  <script src="<?= asset_url('/src/vendor/tinymce/tinymce.min.js') ?>"></script>
  <script src="<?= asset_url('/src/js/chords.js') ?>"></script>
  <script src="<?= asset_url('/src/js/editor.js') ?>"></script>
</body>
</html>
