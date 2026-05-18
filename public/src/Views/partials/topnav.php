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
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-1);
    text-decoration: none;
    font-weight: var(--fw-semibold);
    font-size: var(--text-base);
    flex-shrink: 0;
  }

  .topnav__brand-mark {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--brand-soft);
    color: var(--brand);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--fw-bold);
    font-size: 13px;
    letter-spacing: -.02em;
  }

  .topnav__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .topnav__sync {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--radius-pill);
    background: var(--bg-2);
    color: var(--text-2);
    font-size: var(--text-xs);
    cursor: pointer;
    border: none;
  }

  .topnav__sync:hover { background: var(--bg-3); }

  .topnav__links {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .topnav__link {
    text-decoration: none;
    color: var(--text-2);
    font-size: var(--text-sm);
    font-weight: var(--fw-medium);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    transition: background var(--t-fast), color var(--t-fast);
    white-space: nowrap;
  }

  .topnav__link:hover {
    background: var(--bg-2);
    color: var(--text-1);
  }

  .topnav__menu-btn {
    display: none;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 0;
    color: var(--text-1);
    cursor: pointer;
    padding: 0;
  }

  .topnav__menu-btn:hover { background: var(--bg-2); }
  .topnav__menu-btn svg { width: 20px; height: 20px; }

  @media (max-width: 720px) {
    .topnav__links { display: none; }
    .topnav__menu-btn { display: inline-flex; }
    .topnav__title { display: none; }
  }
  /* Botão de playlists visível em qualquer largura */
  #playlistButtonTop { display: inline-flex; }
</style>

<?php $isAdmin = function_exists('current_user_is_admin') && current_user_is_admin(); ?>
<nav class="topnav" role="navigation">
  <a href="/index.php" class="topnav__brand" aria-label="Início — Filhos de Maria">
    <img src="/src/images/imagemlogofdm.webp" alt="" aria-hidden="true" class="topnav__brand-mark" style="object-fit:contain;background:transparent;">
  </a>
  <span class="topnav__title" id="topnavPageTitle"></span>
  <button type="button" class="topnav__sync" id="topnavSync" aria-label="Status de sincronização" title="Status">
    <span class="sync-dot" id="topnavSyncDot"></span>
    <span id="topnavSyncLabel">—</span>
  </button>
  <div class="topnav__links">
    <a href="/index.php" class="topnav__link">Músicas</a>
    <?php if ($isAdmin): ?>
      <a href="/src/backend/editor/editorplaylist.php" class="topnav__link">Setlists</a>
      <a href="/src/backend/editor/editor.php" class="topnav__link">Editor</a>
      <a href="/src/backend/editor/roteiro.php" class="topnav__link">Roteiros</a>
      <a href="/users.php" class="topnav__link">Usuários</a>
    <?php endif; ?>
    <a href="/config.php" class="topnav__link" aria-label="Configurações" title="Configurações">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </a>
  </div>
  <button class="topnav__menu-btn" type="button" id="playlistButtonTop" aria-label="Abrir setlists" aria-expanded="false" aria-controls="sideMenu" style="margin-right:0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/>
    </svg>
  </button>
  <button class="topnav__menu-btn" type="button" id="menuButtonTop" aria-label="Abrir menu" aria-expanded="false" aria-controls="menusideMenu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
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

    var titleEl = document.getElementById('topnavPageTitle');
    if (titleEl) {
      var t = (document.title || '').replace(/\s*[-—|]\s*Filhos de Maria.*$/i, '').trim();
      titleEl.textContent = t || '';
    }

    var dot = document.getElementById('topnavSyncDot');
    var label = document.getElementById('topnavSyncLabel');
    function updateSync() {
      if (!dot || !label) return;
      if (navigator.onLine) {
        dot.className = 'sync-dot sync-dot--online';
        label.textContent = 'Online';
      } else {
        dot.className = 'sync-dot sync-dot--offline';
        label.textContent = 'Offline';
      }
    }
    updateSync();
    window.addEventListener('online', updateSync);
    window.addEventListener('offline', updateSync);
  })();
</script>
