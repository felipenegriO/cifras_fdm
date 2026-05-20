<?php
$_bandaAtual  = $_SESSION['banda_atual'] ?? [];
$_bandaNome   = $_bandaAtual['nome'] ?? '';
$_userBandas  = $_SESSION['usuario']['bandas'] ?? [];
$_multiband   = is_master() || count($_userBandas) > 1;

$_canEdit     = function_exists('can_edit_content')     && can_edit_content();
$_canUsers    = function_exists('can_manage_band_users') && can_manage_band_users();
$_isMaster    = function_exists('is_master')            && is_master();
?>
<style>
  .topnav {
    position: sticky;
    top: 0;
    z-index: var(--z-header, 100);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--header-height, 56px);
    padding: 0 var(--space-4);
    background: var(--bg-1);
    border-bottom: 1px solid var(--border-1);
    font-family: var(--font-ui);
  }

  .topnav__brand {
    display: flex; align-items: center; gap: var(--space-2);
    color: var(--text-1); text-decoration: none;
    font-weight: var(--fw-semibold); font-size: var(--text-base); flex-shrink: 0;
  }
  .topnav__brand-mark {
    width: 28px; height: 28px; border-radius: var(--radius-sm);
    background: var(--brand-soft);
    display: inline-flex; align-items: center; justify-content: center;
  }

  .topnav__band-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: var(--radius-pill);
    background: var(--bg-2); border: 1px solid var(--border-1);
    font-size: var(--text-xs); color: var(--text-2); white-space: nowrap;
    text-decoration: none; cursor: pointer; flex-shrink: 0;
    transition: background var(--t-fast), border-color var(--t-fast);
    max-width: 160px; overflow: hidden; text-overflow: ellipsis;
  }
  .topnav__band-chip:hover { background: var(--bg-3); border-color: var(--brand); color: var(--text-1); }
  .topnav__band-chip svg { flex-shrink: 0; }

  .topnav__spacer { flex: 1; min-width: 0; }

  .topnav__sync {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: var(--radius-pill);
    background: var(--bg-2); color: var(--text-2);
    font-size: var(--text-xs); cursor: pointer; border: none;
  }
  .topnav__sync:hover { background: var(--bg-3); }

  .topnav__links {
    display: flex; align-items: center; gap: var(--space-1);
  }
  .topnav__link {
    text-decoration: none; color: var(--text-2);
    font-size: var(--text-sm); font-weight: var(--fw-medium);
    padding: 8px 12px; border-radius: var(--radius-sm);
    transition: background var(--t-fast), color var(--t-fast);
    white-space: nowrap;
  }
  .topnav__link:hover { background: var(--bg-2); color: var(--text-1); }

  .topnav__menu-btn {
    display: none; width: 40px; height: 40px;
    align-items: center; justify-content: center;
    border-radius: var(--radius-sm); background: transparent;
    border: 0; color: var(--text-1); cursor: pointer; padding: 0;
  }
  .topnav__menu-btn:hover { background: var(--bg-2); }
  .topnav__menu-btn svg { width: 20px; height: 20px; }

  @media (max-width: 720px) {
    .topnav__links { display: none; }
    .topnav__menu-btn { display: inline-flex; }
    .topnav__band-chip span.band-name { display: none; }
  }
  #playlistButtonTop { display: inline-flex; }
</style>

<nav class="topnav" role="navigation">
  <a href="/index.php" class="topnav__brand" aria-label="Início — StageBox">
    <span class="topnav__brand-mark">
      <img src="/src/images/imagemlogofdm.webp" alt="" aria-hidden="true"
           style="width:24px;height:24px;object-fit:contain;background:transparent;">
    </span>
  </a>

  <?php if ($_bandaNome): ?>
    <a href="<?= $_multiband ? '/select-banda.php' : '#' ?>"
       class="topnav__band-chip"
       title="<?= e($_bandaNome) ?><?= $_multiband ? ' · trocar banda' : '' ?>"
       <?= !$_multiband ? 'style="pointer-events:none;cursor:default"' : '' ?>>
      <?php if ($_multiband): ?>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <?php else: ?>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <?php endif; ?>
      <span class="band-name"><?= e($_bandaNome) ?></span>
      <?php if ($_multiband): ?>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <?php endif; ?>
    </a>
  <?php endif; ?>

  <span class="topnav__spacer"></span>

  <button type="button" class="topnav__sync" id="topnavSync" aria-label="Status de sincronização" title="Status">
    <span class="sync-dot" id="topnavSyncDot"></span>
    <span id="topnavSyncLabel">—</span>
  </button>

  <div class="topnav__links">
    <a href="/index.php" class="topnav__link">Músicas</a>

    <?php if ($_canEdit): ?>
      <a href="/src/backend/editor/editorplaylist.php" class="topnav__link">Setlists</a>
      <a href="/src/backend/editor/editor.php" class="topnav__link">Editor</a>
      <a href="/src/backend/editor/roteiro.php" class="topnav__link">Roteiros</a>
    <?php endif; ?>

    <?php if ($_canUsers): ?>
      <a href="/users.php" class="topnav__link">Usuários</a>
    <?php endif; ?>

    <?php if ($_isMaster): ?>
      <a href="/bandas.php" class="topnav__link">Bandas</a>
    <?php endif; ?>

    <a href="/config.php" class="topnav__link" aria-label="Configurações" title="Configurações">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </a>
  </div>

  <!-- Mobile: playlist menu button -->
  <button class="topnav__menu-btn" type="button" id="playlistButtonTop"
          aria-label="Abrir setlists" aria-expanded="false" aria-controls="sideMenu"
          style="margin-right:0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="8" y1="6"  x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/>
    </svg>
  </button>

  <!-- Mobile: hamburger -->
  <button class="topnav__menu-btn" type="button" id="menuButtonTop"
          aria-label="Abrir menu" aria-expanded="false" aria-controls="menusideMenu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>
</nav>

<script>
  (function () {
    var btn = document.getElementById('menuButtonTop');
    if (btn) {
      btn.addEventListener('click', function () {
        var menu = document.getElementById('menusideMenu');
        if (!menu) return;
        var open = menu.style.right === '0px' || menu.style.right === '0';
        menu.style.right = open ? '-300px' : '0';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    }

    var dot   = document.getElementById('topnavSyncDot');
    var label = document.getElementById('topnavSyncLabel');
    function updateSync() {
      if (!dot || !label) return;
      if (navigator.onLine) {
        dot.className   = 'sync-dot sync-dot--online';
        label.textContent = 'Online';
      } else {
        dot.className   = 'sync-dot sync-dot--offline';
        label.textContent = 'Offline';
      }
    }
    updateSync();
    window.addEventListener('online',  updateSync);
    window.addEventListener('offline', updateSync);
  })();
</script>
