<?php
$_bandaAtual  = $_SESSION['banda_atual'] ?? [];
$_bandaNome   = $_bandaAtual['nome'] ?? '';
$_userBandas  = $_SESSION['usuario']['bandas'] ?? [];
$_multiband   = is_master() || count($_userBandas) > 1;

$_canEdit     = function_exists('can_edit_content')     && can_edit_content();
$_canUsers    = function_exists('can_manage_band_users') && can_manage_band_users();
$_isMaster    = function_exists('is_master')            && is_master();
$_canBands    = function_exists('can_manage_bands')      && can_manage_bands();
$_planoAtual  = $_bandaAtual['plano'] ?? '';
$_showUpgrade = in_array($_planoAtual, ['trial', 'gratuito', 'bloqueado'], true);
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
    width: 30px; height: 30px;
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
  .topnav__band-chip svg, .topnav__band-logo { flex-shrink: 0; }
  .topnav__band-logo { width: 20px; height: 20px; border-radius: 4px; object-fit: contain; }

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

  .topnav__upgrade {
    display: inline-flex; align-items: center; gap: 6px;
    min-height: 34px; padding: 0 12px; border-radius: var(--radius-sm);
    background: var(--brand); color: #fff; text-decoration: none;
    font-size: var(--text-xs); font-weight: 800; white-space: nowrap;
    box-shadow: 0 6px 18px rgba(124,58,237,.2);
  }
  .topnav__upgrade:hover { opacity: .9; color: #fff; }

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
  #playlistButtonTop { display: none; }
  @media (max-width: 720px) {
    .topnav { gap: 6px; padding-inline: 8px; }
    .topnav__menu-btn, .topnav__sync { width: 44px; height: 44px; min-width: 44px; padding: 0; justify-content: center; }
    .topnav__sync > span:last-child { display: none; }
    .topnav__upgrade:not(.sidemenu-nav__upgrade) { display: none; }
    #playlistButtonTop { display: inline-flex; }
  }
  @media (max-width: 360px) {
    .topnav__sync { display: none; }
  }
</style>

<nav class="topnav" role="navigation">
  <a href="/index.php" class="topnav__brand" aria-label="Início — Cifrô">
    <span class="topnav__brand-mark">
      <img src="<?= e(asset_url('/src/images/cifro-mark.svg')) ?>" alt="" aria-hidden="true"
           style="width:30px;height:30px;object-fit:contain;background:transparent;">
    </span>
  </a>

  <?php if ($_bandaNome): ?>
    <a href="<?= $_multiband ? '/select-banda.php' : '#' ?>"
       class="topnav__band-chip"
       title="<?= e($_bandaNome) ?><?= $_multiband ? ' · trocar banda' : '' ?>"
       <?= !$_multiband ? 'style="pointer-events:none;cursor:default"' : '' ?>>
      <img class="topnav__band-logo" src="<?= e(band_logo_url($_bandaAtual['logo'] ?? null)) ?>" alt="" aria-hidden="true">
      <span class="band-name"><?= e($_bandaNome) ?></span>
      <?php if ($_multiband): ?>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <?php endif; ?>
    </a>
  <?php endif; ?>

  <span class="topnav__spacer"></span>

<?php if ($_showUpgrade): ?>
    <a href="/plano.php#planos" class="topnav__upgrade"
       aria-label="<?= $_planoAtual === 'bloqueado' ? 'Regularizar plano' : 'Fazer upgrade' ?>"
       title="Ver planos">
      <?= $_planoAtual === 'bloqueado' ? 'Regularizar plano' : 'Fazer upgrade' ?>
    </a>
  <?php endif; ?>

  <div class="topnav__links">
    <a href="/index.php" class="topnav__link">Início</a>

    <?php if ($_canEdit): ?>
      <a href="/categorias.php" class="topnav__link" data-requires-server>Categorias</a>
      <a href="/src/backend/editor/editor.php" class="topnav__link" data-requires-server>Músicas</a>
      <a href="/src/backend/editor/editorplaylist.php" class="topnav__link">Repertórios</a>
    <?php endif; ?>

    <?php if ($_canUsers): ?>
      <a href="/users.php" class="topnav__link" data-requires-server>Usuários</a>
    <?php endif; ?>

    <?php if ($_canBands): ?>
      <a href="/bandas.php" class="topnav__link" data-requires-server>Bandas</a>
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
          aria-label="Abrir repertórios" aria-expanded="false" aria-controls="sideMenu"
          style="margin-right:0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
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

<!-- Universal mobile nav drawer — available on every page -->
<style>
  #menusideMenu {
    position: fixed;
    top: 0; bottom: 0;
    right: -100%;
    width: min(300px, 90vw);
    z-index: calc(var(--z-header, 100) + 10);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-elevated);
    border-left: 1px solid var(--border-1);
    box-shadow: var(--shadow-2);
    transition: right 0.25s ease;
  }
  #menusideMenu h2 {
    min-height: 56px;
    margin: 0;
    padding: 16px 16px 16px 52px;
    border-bottom: 1px solid var(--border-1);
    font-size: var(--text-base);
    font-weight: var(--fw-semibold);
  }
  #menucloseButton {
    position: absolute;
    top: 8px; left: 8px;
    width: 40px; height: 40px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: var(--text-1);
  }
  #menucloseButton:hover { background: var(--bg-2); }
  .sidemenu-nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sidemenu-nav__section-label {
    padding: var(--space-3) var(--space-2) var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--fw-semibold);
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .sidemenu-nav__item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: var(--fw-medium);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .sidemenu-nav__item:hover,
  .sidemenu-nav__item:focus-visible {
    background: var(--bg-2);
    color: var(--brand);
  }
  .sidemenu-nav__upgrade {
    width: 100%;
    min-height: 44px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-2);
    box-shadow: 0 4px 12px rgba(124,58,237,.25);
  }
  #menusideMenuOverlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-header, 100) + 9);
    background: rgba(0,0,0,.4);
  }
  #menusideMenuOverlay.is-open { display: block; }
</style>

<div id="menusideMenuOverlay" aria-hidden="true"></div>
<div id="menusideMenu" aria-hidden="true">
  <button id="menucloseButton" type="button" aria-label="Fechar menu">×</button>
  <h2>Menu</h2>
  <nav class="sidemenu-nav" aria-label="Navegação principal">
    <?php if ($_showUpgrade): ?>
    <a href="/plano.php#planos" class="topnav__upgrade sidemenu-nav__upgrade"
       aria-label="<?= $_planoAtual === 'bloqueado' ? 'Regularizar plano' : 'Fazer upgrade' ?>">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      <?= $_planoAtual === 'bloqueado' ? 'Regularizar plano' : 'Fazer upgrade' ?>
    </a>
    <?php endif; ?>
    <div class="sidemenu-nav__section-label">Navegar</div>

    <a href="/index.php" class="sidemenu-nav__item">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      Home
    </a>

    <?php if ($_canEdit): ?>
    <a href="/categorias.php" class="sidemenu-nav__item" data-requires-server>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Categorias
    </a>
    <a href="/src/backend/editor/editor.php" class="sidemenu-nav__item" data-requires-server>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      Músicas
    </a>
    <a href="/src/backend/editor/editorplaylist.php" class="sidemenu-nav__item">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>
      Repertórios
    </a>
    <?php endif; ?>

    <?php if ($_canUsers): ?>
    <a href="/users.php" class="sidemenu-nav__item" data-requires-server>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Usuários
    </a>
    <?php endif; ?>

    <?php if ($_canBands): ?>
    <a href="/bandas.php" class="sidemenu-nav__item" data-requires-server>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21v-8l9-6 9 6v8"/><path d="M9 21v-6h6v6"/></svg>
      Bandas
    </a>
    <?php endif; ?>

    <div class="sidemenu-nav__section-label">Conta</div>

    <a href="/config.php" class="sidemenu-nav__item">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Configuração
    </a>
  </nav>
</div>

<script>
  (function () {
    var menu    = document.getElementById('menusideMenu');
    var overlay = document.getElementById('menusideMenuOverlay');

    function openMenu() {
      if (!menu) return;
      menu.style.right = '0';
      menu.setAttribute('aria-hidden', 'false');
      if (overlay) overlay.classList.add('is-open');
      var btn = document.getElementById('menuButtonTop');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      if (!menu) return;
      menu.style.right = '';
      menu.setAttribute('aria-hidden', 'true');
      if (overlay) overlay.classList.remove('is-open');
      var btn = document.getElementById('menuButtonTop');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    var btn = document.getElementById('menuButtonTop');
    if (btn) btn.addEventListener('click', openMenu);

    var closeBtn = document.getElementById('menucloseButton');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay)  overlay.addEventListener('click', closeMenu);

    /* index.php also has a floating #menuButton — wire it up if present */
    document.addEventListener('DOMContentLoaded', function () {
      var floatingBtn = document.getElementById('menuButton');
      if (floatingBtn) floatingBtn.addEventListener('click', openMenu);
    });

    var dot   = document.getElementById('topnavSyncDot');
    var label = document.getElementById('topnavSyncLabel');
    function updateSync() {
      if (!dot || !label) return;
      var state = window.CifroConnectivity?.current() || 'verificando';
      if (state === 'servidor_disponivel') {
        dot.className   = 'sync-dot sync-dot--online';
        label.textContent = 'Servidor disponível';
      } else if (state === 'verificando') {
        dot.className = 'sync-dot sync-dot--syncing';
        label.textContent = 'Verificando';
      } else {
        dot.className   = 'sync-dot sync-dot--offline';
        label.textContent = 'Usando versão local';
      }
    }
    updateSync();
    window.addEventListener('online',  updateSync);
    window.addEventListener('offline', updateSync);
    document.addEventListener('cifro:connectivity', updateSync);

    document.addEventListener('click', async function (event) {
      var link = event.target.closest('a[data-requires-server]');
      if (!link) return;
      event.preventDefault();
      var available = await window.CifroConnectivity?.probe({ force: true });
      if (available) {
        location.href = link.href;
        return;
      }
      if (window.cifroConfirm) {
        await cifroConfirm({
          title: 'Sem conexão com o servidor',
          message: 'Este menu precisa de conexão com o servidor e não está disponível no modo offline. Suas músicas e repertórios salvos continuam acessíveis.',
          confirmText: 'Entendi',
          cancelText: '',
          danger: false,
          icon: '📡'
        });
      } else if (window.cifroToast) {
        cifroToast('Este menu precisa de conexão com o servidor.', 'warning');
      }
    });
  })();
</script>
