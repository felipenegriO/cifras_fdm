<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
    <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
    <title>Filhos de Maria</title>
    <link rel="manifest" href="manifest.json">
    <script src="/src/js/fdm-theme.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="/src/css/fonts.css" rel="stylesheet">
    <link href="/src/css/bootstrap.min.css" rel="stylesheet" defer>
    <link href="/src/css/theme.css" rel="stylesheet">
    <link href="/src/css/style2.css" rel="stylesheet" defer>
    <style>
        #menusideMenu button.btn,#menusideMenu a.btn {
             width: 100%;
        }
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
  .fdm-floating-actions {
    z-index: 999;
    position: fixed;
    right: var(--space-3);
    top: 10px;
    display: flex;
        gap: var(--space-2);
    }
    .fdm-floating-actions .btn,
    .fdm-floating-actions .btn.btn-primary,
    .fdm-floating-actions .btn.btn--secondary {
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
    .fdm-floating-actions .btn:hover,
    .fdm-floating-actions .btn.btn-primary:hover,
    .fdm-floating-actions .btn.btn--secondary:hover {
        transform: translateY(-1px);
        background: var(--bg-3) !important;
        border-color: var(--border-2) !important;
        color: var(--text-1) !important;
        box-shadow: var(--shadow-2);
    }
    .fdm-floating-actions .btn:focus-visible {
        outline: 2px solid var(--border-2);
        outline-offset: 2px;
    }
    .fdm-floating-actions .btn svg {
        width: 18px;
        height: 18px;
  }
  /* Em desktop a topnav já tem links — esconder floating */
  @media (min-width: 721px) {
    .fdm-floating-actions { display: none; }
  }

    </style>
</head>

<body>
<?php include __DIR__ . '/partials/topnav.php'; ?>
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
        <div class="btn-group fdm-floating-actions" role="group" aria-label="Ações rápidas">
            <button type="button" class="btn btn--icon btn--secondary" id="menuButton" aria-label="Abrir menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>
            <button type="button" class="btn btn--icon btn--secondary" id="playlistButton" aria-label="Abrir setlists">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
                </svg>
            </button>
        </div>

    <div id="menusideMenu">
        <button id="menucloseButton">×</button>
        <h2>Menu</h2>
        <div style="margin-bottom: 12px;">
            <label style="display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;cursor:pointer;">
                <input type="checkbox" id="themeToggle" aria-label="Alternar tema escuro">
                Tema escuro
            </label>
        </div>
        <a href="/config.php" class="btn btn-primary mb-3" style="display:block;text-align:center;">Configurações</a>
        <button type="button" class="btn btn-primary" id="clearCacheBtn">Limpar Cache</button>
        <button type="button" class="btn btn-primary mt-3" id="livePlay">
            <i class="fa-solid fa-broadcast-tower"></i> VIRAR HOST
        </button>
        <button type="button" class="btn btn-primary mt-3" id="entrarlivePlay">
            <i class="fa-solid fa-play"></i> ENTRAR NO MODO LIVE
        </button>
        <div id="liveStatus" class="live-status mt-2">Live desconectada</div>
        <?php if (function_exists('current_user_is_admin') && current_user_is_admin()): ?>
            <a href="src/backend/editor/editor.php" type="button" class="btn btn-primary mt-3" >Editor</a>
            <a href="src/backend/editor/roteiro.php" type="button" class="btn btn-primary mt-3">Editor Roteiros</a>
        <?php endif; ?>
        
    </div>
    <div id="sideMenu">
        <button id="closeButton" onclick="document.getElementById('sideMenu').style.right = '-300px';">×</button>
        <h2>PlayLists 
            <!-- <button class="btn" data-toggle="modal" data-target="#addPlayList"><i
                    class="fa-solid fa-plus"></i></button> -->
                </h2>
        <ul id="lista-playlists" style="    display: block;
    overflow: hidden;
    height: 100%;
    border: none;"></ul>
    </div>
    <div class="container">
        <div class="filter-group" role="group" aria-label="Filtros por categoria">
            <button type="button" class="chip chip--active" onclick="aplicarFiltro('')">Todas</button>
            <button type="button" class="chip" onclick="aplicarFiltro('Louvor Animado')">Louvores</button>
            <button type="button" class="chip" onclick="aplicarFiltro('Marianas')">Marianas</button>
            <button type="button" class="chip" onclick="aplicarFiltro('Oracionais')">Oracionais</button>
            <button type="button" class="chip" onclick="aplicarFiltro('Adoração')">Adoração</button>
            <button type="button" class="chip" onclick="aplicarFiltro('Missa')">Missa</button>
        </div>
        <input type="search" id="search" class="form-control" placeholder="Pesquisar música ou artista" aria-label="Pesquisar">
        <ul id="music-list" class="list-group mt-3" style=" width: 100%;">
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:60%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:75%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:50%;"></div></li>
            <li class="list-group-item" aria-hidden="true"><div class="skeleton" style="height:16px;width:65%;"></div></li>
        </ul>
        <div id="letraAtiva">A</div>
        <div id="mostrarbtnplay" class="hide">
             <a type="button" class="btn btn-primary col" id="entrarlivePlaynow"><i class="fa-solid fa-play"></i>
                ENTRAR PRO PLAY</a>
        </div>
    </div>

    <div class="modal fade" id="addPlayList" tabindex="-1" role="dialog" aria-labelledby="addPlayList"
        aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="myModalLabel">Add PlayList</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <span>Nome da PlaysList</span>
                    <input name="playlistnome" class="form-control" id="playlistnome" />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Fechar</button>
                    <button type="button" class="btn btn-primary" id="salvarPlayList">Salvar</button>
                </div>
            </div>
        </div>
    </div>

    <script src="/src/js/jquery-3.5.1.min.js" ></script>
    <script src="/src/js/bootstrap.min.js" defer></script>
    <script src="<?= asset_url('/src/js/musicas.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/script.js') ?>" defer></script>
    <script src="/src/js/06215d6691.js" defer></script>
    <script src="<?= asset_url('/src/js/playlists_salvas.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/roteiros_salvos.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/playlists.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/offline-tools.js') ?>"></script>
    <script src="<?= asset_url('/src/js/live.js') ?>"></script>
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registrado com sucesso:', registration);
                    })
                    .catch(error => {
                        console.warn('Falha ao registrar o Service Worker:', error);
                    });
            });
        }
        // Toggle do tema (módulo fdm-theme já carregado e aplicado no <head>)
        document.addEventListener('DOMContentLoaded', function () {
            var toggle = document.getElementById('themeToggle');
            if (!toggle || !window.fdmTheme) return;
            toggle.checked = window.fdmTheme.get() === 'dark';
            toggle.addEventListener('change', function () {
                window.fdmTheme.set(toggle.checked ? 'dark' : 'light');
            });
        });

        function aplicarFiltro(classificacao) {
            $("#search").val(classificacao).trigger("input");
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
        function normalizeString(str) {
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        }
        $(document).ready(function () {
              $(document).click(function(event) {
                var $menu = $('#sideMenu');
                var right = $menu.css('right');
            
                if (right === '0px' && !$(event.target).closest('#sideMenu').length) {
                    $menu.css('right', '-300px');
                }
            });
            document.getElementById('clearCacheBtn').addEventListener('click', async () => {
                const ok = await fdmConfirm({
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
            songs = songs.sort((a, b) => a.nome.localeCompare(b.nome));
            function renderList(filter = '') {
                $('#music-list').empty();
                const normalizedFilter = normalizeString(filter);
                const filteredSongs = songs.filter(song =>
                    normalizeString(song.nome).includes(normalizedFilter) ||
                    normalizeString(song.artista).includes(normalizedFilter) ||
                    normalizeString(song.classificacao).includes(normalizedFilter) ||
                    normalizeString(song.cifra).includes(normalizedFilter)
                );
                if (filteredSongs.length === 0) {
                    const termo = String(filter).replace(/[<>&]/g, '');
                    $('#music-list').append(
                        `<li class="empty-state" role="status">
                            <span class="empty-state__icon" aria-hidden="true">🔎</span>
                            <p class="empty-state__title">Nenhuma música encontrada</p>
                            <p class="empty-state__desc">${termo ? 'Tente outro termo em vez de <strong>' + termo + '</strong>.' : 'A lista está vazia no momento.'}</p>
                        </li>`
                    );
                } else {
                    filteredSongs.forEach(song => {
                        var nome = song.nome + " - " + song.artista;
                        $('#music-list').append(
                            `<li class="list-group-item">
                                <a href="music.php?id=${song.id}">${nome}</a>
                            </li>`
                        );
                    });
                }
                var lista = document.getElementById('music-list');
                const letraAtiva = document.getElementById('letraAtiva');
                const items = lista.querySelectorAll('li');

                lista.addEventListener('scroll', () => {

                     clearTimeout(scrollTimeout);

                    // Mostra a letra ativa
                    letraAtiva.classList.add('visible');
                    // Pega o scroll top do UL
                    const scrollTop = lista.scrollTop;

                    // Vamos identificar qual li está mais próximo do topo visível
                    let letra = '';

                    for (const li of items) {
                        const offsetTop = li.offsetTop;
                        const height = li.offsetHeight;

                        // Se o topo do li já passou do scrollTop (está visível)
                        if (offsetTop - scrollTop <= -5) {
                            // Pega a primeira letra do li (antes do '-')
                            letra = li.textContent.trim()[0];
                        }
                    }

                    if (letra) {
                        letraAtiva.textContent = letra;
                    }
                    var scrollTimeout = setTimeout(() => {
                      letraAtiva.classList.remove('visible');
                    }, 3000);
                });
            }

            $('#search').on('input', function () {
                renderList($(this).val());
            });

            renderList();

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
