<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
    <title>Cifrô</title>
    <link rel="manifest" href="manifest.json">
    <script src="/src/js/cifro-theme.js"></script>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/bootstrap.min.css" rel="stylesheet" defer>
    <link href="/src/css/theme.css" rel="stylesheet">
    <link href="/src/css/style2.css" rel="stylesheet" defer>
    <style>
        .btn-group {
            display: flex;
            flex-wrap: wrap;
        }

        .btn-group .btn {
            flex: 1;
            margin: 2px;
        }

 #letraAtiva {
    display: none;
  }
  #container {
    display: flex;
    gap: 20px;
  }
  ul#music-list {
    height: auto;
    max-height: calc(100vh - 215px);
    overflow-y: auto;
    border: 0;
    border-radius: var(--radius-md);
    padding: 0;
    margin: 0;
    background: var(--bg-1);
  }
  .filter-group {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
        padding: 1px;
  }
  .filter-group::-webkit-scrollbar { height: 4px; }
  .filter-group::-webkit-scrollbar-thumb { background: var(--bg-3); border-radius: 4px; }
  .filter-group .btn,
  .filter-group .chip {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
  #search {
    min-height: 44px;
    font-size: var(--text-base);
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-4);
  }
  #search::placeholder { color: var(--text-3); }
  .list-empty-state {
    padding: var(--space-6) var(--space-4);
    text-align: center;
    color: var(--text-2);
    font-size: var(--text-sm);
  }
  #mostrarbtnplay {
    left: 50%;
    bottom: 12px;
    width: min(560px, calc(100vw - 32px));
    transform: translateX(-50%);
  }
  .onboarding-card { max-width: 920px; margin: var(--space-4) auto 0; padding: var(--space-4); border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--bg-1); }
  .onboarding-card[hidden] { display: none; }
  .onboarding-card__header { display: flex; align-items: start; justify-content: space-between; gap: var(--space-3); }
  .onboarding-card__header h2 { margin: 0 0 var(--space-1); font-size: var(--text-lg); }
  .onboarding-card__header p { margin: 0; color: var(--text-2); }
  .onboarding-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin: var(--space-4) 0; padding: 0; list-style: none; }
  .onboarding-step { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--bg-2); color: var(--text-2); }
  .onboarding-step.is-done { color: var(--text-1); }
  .onboarding-step strong { display: block; color: var(--text-1); }
  @media (max-width: 600px) { .onboarding-steps { grid-template-columns: 1fr; } }
  .container { max-width: 920px; padding: var(--space-4); }
  .container h1 {
    font-size: var(--text-xl);
    font-weight: var(--fw-semibold);
    margin: var(--space-4) 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .container h1 img { height: 32px; width: auto; }
  @media (max-width: 480px) {
    .container { padding: var(--space-3); }
    .container h1 { font-size: var(--text-lg); }
    .container h1 img { height: 28px; }
  }
  .cifro-floating-actions {
    display: none !important;
    }
    .cifro-floating-actions .btn,
    .cifro-floating-actions .btn.btn-primary,
    .cifro-floating-actions .btn.btn--secondary {
        width: 44px;
        height: 44px;
        min-height: 44px;
        padding: 0;
        border-radius: 12px;
        border: 1px solid var(--border-1) !important;
        background: var(--bg-elevated) !important;
        background: color-mix(in srgb, var(--bg-elevated) 88%, #ffffff 12%) !important;
        color: var(--text-1) !important;
        box-shadow: var(--shadow-1);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: transform var(--t-fast), box-shadow var(--t-fast), background var(--t-fast), border-color var(--t-fast);
    }
    .cifro-floating-actions .btn:hover,
    .cifro-floating-actions .btn.btn-primary:hover,
    .cifro-floating-actions .btn.btn--secondary:hover {
        transform: translateY(-1px);
        background: var(--bg-3) !important;
        border-color: var(--border-2) !important;
        color: var(--text-1) !important;
        box-shadow: var(--shadow-2);
    }
    .cifro-floating-actions .btn:focus-visible {
        outline: 2px solid var(--border-2);
        outline-offset: 2px;
    }
    .cifro-floating-actions .btn svg {
        width: 18px;
        height: 18px;
  }
  #sideMenu {
    right: -100%;
    width: min(360px, 100vw);
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-elevated);
    border-left: 1px solid var(--border-1);
    box-shadow: var(--shadow-2);
  }
  #sideMenu h2 {
    min-height: 64px;
    margin: 0;
    padding: 20px 56px;
    border-bottom: 1px solid var(--border-1);
    font-size: var(--text-lg);
    font-weight: var(--fw-semibold);
  }
  #sideMenu #closeButton {
    top: 12px;
    left: 12px;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: var(--radius-sm);
    line-height: 1;
  }
  #sideMenu #closeButton:hover { background: var(--bg-2); }
  #lista-playlists {
    flex: 1;
    overflow-y: auto !important;
    height: auto !important;
    margin: 0;
    padding: var(--space-3) !important;
  }
  #lista-playlists .playlist-section-title {
    margin: var(--space-4) var(--space-2) var(--space-2);
    color: var(--text-3);
  }
  #lista-playlists .liPlaylist,
  #lista-playlists .liRoteiro {
    margin: 2px 0;
    border-radius: var(--radius-sm);
  }
  #lista-playlists .liPlaylist > a,
  #lista-playlists .liRoteiro > a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-size: var(--text-sm);
    font-weight: var(--fw-medium);
  }
  #lista-playlists .liPlaylist > a:hover,
  #lista-playlists .liRoteiro > a:hover {
    background: var(--bg-2);
    color: var(--brand);
    text-decoration: none;
  }
    </style>
</head>

<body>
<?php include __DIR__ . '/partials/topnav.php'; ?>
    <h1 class="sr-only">Músicas da banda</h1>
    <section class="onboarding-card" id="onboardingCard" aria-labelledby="onboardingTitle" hidden>
        <div class="onboarding-card__header">
            <div><h2 id="onboardingTitle">Comece seu repertório</h2><p>Três passos rápidos para deixar a primeira cifra pronta.</p></div>
            <button type="button" class="btn btn--secondary btn--sm" id="dismissOnboarding">Continuar depois</button>
        </div>
        <ol class="onboarding-steps">
            <li class="onboarding-step is-done"><strong>1. Banda selecionada</strong>Seu espaço de trabalho está pronto.</li>
            <li class="onboarding-step" id="onboardingSongStep"><strong>2. Adicione uma cifra</strong>Cadastre o nome, artista e conteúdo.</li>
            <li class="onboarding-step" id="onboardingOpenStep"><strong>3. Abra e transponha</strong>Escolha o tom adequado para tocar.</li>
        </ol>
        <a class="btn btn--primary" id="onboardingAction" href="/src/backend/editor/editor.php">Adicionar primeira cifra</a>
    </section>
    <!-- <button id="playlistButton"><i class="fa-solid fa-music"></i></button> -->
<div id="toast" style="
  position: fixed;
  top: 15%;
  left: 15%;
  transform: translateX(-50%);
  background: white;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 14px;
  display: none;
  z-index: 9999;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
"></div>
        <div class="btn-group cifro-floating-actions" role="group" aria-label="Ações rápidas">
            <button type="button" class="btn btn--icon btn--secondary" id="menuButton" aria-label="Abrir menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>
            <button type="button" class="btn btn--icon btn--secondary" id="playlistButton" aria-label="Abrir repertórios">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </button>
        </div>

    <!-- Hidden functional elements for index.php features (live, theme, cache) -->
    <div style="display:none">
        <input type="checkbox" id="themeToggle" aria-label="Alternar tema escuro">
        <button type="button" id="livePlay"></button>
        <button type="button" id="entrarlivePlay"></button>
        <div id="liveStatus"></div>
        <button type="button" id="clearCacheBtn"></button>
    </div>
        <div id="sideMenu">
        <button id="closeButton" onclick="document.getElementById('sideMenu').style.right = '-100%';">×</button>
        <h2>Repertórios
            <!-- <button class="btn" data-toggle="modal" data-target="#addPlayList"><i
                    class="fa-solid fa-plus"></i></button> -->
                </h2>
        <ul id="lista-playlists"></ul>
    </div>
    <div class="container" id="musicLibrary">
        <div class="filter-group" role="group" aria-label="Filtros por categoria">
        </div>
        <input type="search" id="search" class="form-control" placeholder="Pesquisar música ou artista" aria-label="Pesquisar">
        <ul id="music-list" class="list-group mt-3" style=" width: 100%;">
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:60%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:75%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:50%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:65%;"></div></li>
        </ul>
        <div id="letraAtiva">A</div>
    </div>

    <div id="mostrarbtnplay" style="display:none" aria-hidden="true">
        <a class="btn btn-primary col" id="entrarlivePlaynow">
            Entrar na sessão ao vivo
        </a>
    </div>

    <div class="modal fade" id="addPlayList" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="myModalLabel">Novo repertório</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <label for="playlistnome">Nome do repertório</label>
                    <input name="playlistnome" class="form-control" id="playlistnome" />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Fechar</button>
                    <button type="button" class="btn btn-primary" id="salvarPlayList">Criar repertório</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="betaWelcomeModal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="betaWelcomeModalLabel"
        aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="betaWelcomeModalLabel">Bem-vindo ao Cifrô — versão beta</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p>Esta aplicação está em fase beta. Alguns erros podem ocorrer durante o uso.</p>
                    <p>Se precisar, você pode reportar problemas em <strong>Configurações &rarr; Sobre &rarr; Reportar problema</strong>.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal">Entendi</button>
                </div>
            </div>
        </div>
    </div>

    <script src="/src/js/jquery-3.5.1.min.js" ></script>
    <script src="/src/js/bootstrap.min.js" defer></script>
    <script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>'; window.CIFRO_CAN_HOST = <?= can_host_live() ? 'true' : 'false' ?>;</script>
    <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
    <script src="<?= asset_url('/src/js/chords.js') ?>"></script>
    <script src="<?= asset_url('/src/js/script.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/cifro-install.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/playlist-share.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/playlists.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/offline-tools.js') ?>"></script>
    <script src="<?= asset_url('/src/js/live.js') ?>"></script>
    <script>
        // Toggle do tema (módulo cifro-theme já carregado e aplicado no <head>)
        document.addEventListener('DOMContentLoaded', function () {
            var toggle = document.getElementById('themeToggle');
            if (!toggle || !window.cifroTheme) return;
            toggle.checked = window.cifroTheme.get() === 'dark';
            toggle.addEventListener('change', function () {
                window.cifroTheme.set(toggle.checked ? 'dark' : 'light');
            });
        });

        // Aviso de versão beta: aparece uma vez por navegador, na primeira
        // vez que a pessoa abre o app depois de logar.
        $(function () {
            var BETA_WELCOME_KEY = 'cifroBetaWelcomeSeen';
            try {
                if (!localStorage.getItem(BETA_WELCOME_KEY)) {
                    $('#betaWelcomeModal').modal('show');
                    localStorage.setItem(BETA_WELCOME_KEY, '1');
                }
            } catch (error) {
                // localStorage indisponível (modo privado etc.) — não bloqueia o uso.
            }
        });

        function aplicarFiltro(classificacao) {
            $("#search").val(classificacao).trigger("input");
            sessionStorage.setItem('cifroHomeCategory', classificacao);
            document.querySelectorAll('.filter-group .chip').forEach(function (el) {
                el.classList.remove('chip--active');
            });
            var target = Array.from(document.querySelectorAll('.filter-group .chip')).find(function (el) {
                return el.textContent.trim().localeCompare(
                    classificacao === '' ? 'Todas' : classificacao,
                    'pt-BR',
                    { sensitivity: 'base' }
                ) === 0;
            });
            if (target) target.classList.add('chip--active');
        }
        function renderCategoryFilters() {
            var group = document.querySelector('.filter-group');
            group.replaceChildren();
            var all = document.createElement('button');
            all.type = 'button';
            all.className = 'chip chip--active';
            all.textContent = 'Todas';
            all.addEventListener('click', function () { aplicarFiltro(''); });
            group.appendChild(all);
            (Array.isArray(window.categorias) ? window.categorias : []).forEach(function (categoria) {
                var button = document.createElement('button');
                button.type = 'button';
                button.className = 'chip';
                button.textContent = categoria.nome;
                button.addEventListener('click', function () { aplicarFiltro(categoria.nome); });
                group.appendChild(button);
            });
        }
        function normalizeString(str) {
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        }
        document.addEventListener('cifro:sync', renderCategoryFilters);
        $(document).ready(async function () {
            await cifroSync.load(window.CIFRO_BAND_ID);
            renderCategoryFilters();
              $(document).click(function(event) {
                var $menu = $('#sideMenu');
                var right = $menu.css('right');
            
                if (right === '0px' && !$(event.target).closest('#sideMenu').length) {
                    $menu.css('right', '-100%');
                }
            });
            document.getElementById('clearCacheBtn').addEventListener('click', async () => {
                const ok = await cifroConfirm({
                    title: 'Limpar cache do app',
                    message: 'Isso vai apagar dados salvos localmente (preferências e músicas em cache para uso offline) e recarregar a página. Você precisará de internet na próxima abertura.',
                    confirmText: 'Sim, limpar',
                    cancelText: 'Cancelar',
                    danger: true
                });
                if (!ok) return;
                localStorage.clear();
                sessionStorage.clear();
                if ('caches' in window) {
                    caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => {
                                return caches.delete(cacheName);
                            })
                        );
                    }).then(() => {
                        location.reload();
                    }).catch(error => {
                        console.error('Falha ao limpar o cache:', error);
                    });
                } else {
                    location.reload();
                }
            });
            let songs = (Array.isArray(window.songs) ? window.songs : []).slice()
                .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
            const SONG_PAGE_SIZE = 100;
            let visibleSongLimit = SONG_PAGE_SIZE;
            let activeFilter = '';
            function renderList(filter = '', resetPage = true) {
                $('#music-list').empty();
                const normalizedFilter = normalizeString(filter);
                if (resetPage || normalizedFilter !== activeFilter) visibleSongLimit = SONG_PAGE_SIZE;
                activeFilter = normalizedFilter;
                const filteredSongs = songs.filter(song =>
                    normalizeString(song.nome || '').includes(normalizedFilter) ||
                    normalizeString(song.artista || '').includes(normalizedFilter) ||
                    normalizeString(song.classificacao || '').includes(normalizedFilter) ||
                    normalizeString(song.cifra || '').includes(normalizedFilter)
                );
                if (filteredSongs.length === 0) {
                    const termo = String(filter).replace(/[<>&]/g, '');
                    $('#music-list').append(
                        `<li class="empty-state" role="status">
                            <span class="empty-state__icon" aria-hidden="true">🔎</span>
                            <p class="empty-state__title">${termo ? 'Nenhuma música encontrada' : 'Você ainda não tem músicas cadastradas'}</p>
                            <p class="empty-state__desc">${termo ? 'Tente outro termo em vez de <strong>' + termo + '</strong>.' : 'Comece adicionando uma cifra ao repertório.'}</p>
                            ${termo ? '' : '<a class="btn btn-primary" href="/src/backend/editor/editor.php">Adicionar primeira cifra</a>'}
                        </li>`
                    );
                } else {
                    filteredSongs.slice(0, visibleSongLimit).forEach(song => {
                        const item = document.createElement('li');
                        item.className = 'list-group-item';
                        const link = document.createElement('a');
                        link.href = 'music.php?id=' + encodeURIComponent(song.id);
                        link.textContent = String(song.nome || '') + ' - ' + String(song.artista || '');
                        item.appendChild(link);
                        document.getElementById('music-list').appendChild(item);
                    });
                    if (filteredSongs.length > visibleSongLimit) {
                        const item = document.createElement('li');
                        item.className = 'list-group-item text-center';
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'btn btn-outline-primary';
                        button.textContent = `Carregar mais (${filteredSongs.length - visibleSongLimit})`;
                        button.addEventListener('click', () => {
                            visibleSongLimit += SONG_PAGE_SIZE;
                            renderList(filter, false);
                        });
                        item.appendChild(button);
                        document.getElementById('music-list').appendChild(item);
                    }
                }
            }

            const musicList = document.getElementById('music-list');
            const activeLetter = document.getElementById('letraAtiva');
            let scrollTimeout;
            musicList.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                activeLetter.classList.add('visible');
                let letter = '';
                for (const item of musicList.querySelectorAll('li')) {
                    if (item.offsetTop - musicList.scrollTop <= -5) letter = item.textContent.trim()[0] || '';
                }
                if (letter) activeLetter.textContent = letter;
                scrollTimeout = setTimeout(() => activeLetter.classList.remove('visible'), 3000);
            }, { passive: true });

            $('#search').on('input', function () {
                renderList($(this).val());
            });

            document.addEventListener('cifro:sync', function () {
                songs = (Array.isArray(window.songs) ? window.songs : []).slice()
                    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
                renderList($('#search').val());
                if (typeof window.renderPlaylistsMenu === 'function') window.renderPlaylistsMenu();
            });

            renderList('');
            const savedScroll = Number(sessionStorage.getItem('cifroHomeScroll') || 0);
            document.getElementById('music-list').scrollTop = savedScroll;
            document.getElementById('music-list').addEventListener('scroll', function () {
                sessionStorage.setItem('cifroHomeScroll', String(this.scrollTop));
            }, { passive: true });
            const savedCategory = sessionStorage.getItem('cifroHomeCategory');
            if (savedCategory) aplicarFiltro(savedCategory);

            const onboarding = document.getElementById('onboardingCard');
            const onboardingAction = document.getElementById('onboardingAction');
            const onboardingSongStep = document.getElementById('onboardingSongStep');
            const onboardingOpenStep = document.getElementById('onboardingOpenStep');
            const musicLibrary = document.getElementById('musicLibrary');
            function updateHomeContentState() {
                const hasSongs = Array.isArray(window.songs) && window.songs.length > 0;
                const dismissed = localStorage.getItem('cifroOnboardingDismissed') === '1';
                const showOnboarding = !hasSongs && !dismissed;
                onboarding.hidden = !showOnboarding;
                musicLibrary.hidden = showOnboarding;
                onboardingSongStep.toggleAttribute('aria-current', showOnboarding);
            }
            updateHomeContentState();
            document.addEventListener('cifro:sync', updateHomeContentState);
            document.getElementById('dismissOnboarding').addEventListener('click', function () {
                localStorage.setItem('cifroOnboardingDismissed', '1');
                updateHomeContentState();
            });
            window.__cifroHomeRenderAt = performance.now();
            if (typeof window.renderPlaylistsMenu === 'function') window.renderPlaylistsMenu();

             // Verifica a cada 5 segundos

            // Verifica já no carregamento inicial também


            
        });
        window.addEventListener('offline', () => {
            $("#mostrarbtnplay").hide();
        });

        window.addEventListener('online', () => {
            if (window.LiveMode) window.LiveMode.consultarStatus();
        });
        
    </script>
</body>

</html>
