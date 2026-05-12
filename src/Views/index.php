<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Filhos de Maria</title>
    <link rel="manifest" href="manifest.json">
    <link href="/src/css/bootstrap.min.css" rel="stylesheet" defer>
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
    font-size: 48px;
    font-weight: bold;
    width: 50px;
    border: 2px solid #333;
    text-align: center;
    user-select: none;
    position: fixed;
    right: 0;
    top: 50vh;
    opacity: 0;
    transition: opacity 0.3s;
     user-select: none;
  }
  #letraAtiva.visible {
    opacity: 1;
  }
  #container {
    display: flex;
    gap: 20px;
  }
  ul {
    height: 53vh;
    overflow-y: scroll;
    border: 1px solid #ccc;
    padding: 0;
    margin: 0;
  }

    </style>
</head>

<body>
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
        <div class="btn-group" style="    z-index: 999;position: fixed; right: 10px;   overflow: auto;" role="group" aria-label="Basic example">
            <button type="button" class="btn btn-primary" id="menuButton"><i class="fa-solid fa-list"></i></button>
            <button type="button" class="btn btn-primary" id="playlistButton"><i class="fa-solid fa-music"></i></button>
        </div>

    <div id="menusideMenu">
        <button id="menucloseButton">×</button>
        <h2>Menu</h2>
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
    <div class="container" style="margin-bottom: 2rem;">

        <h1 class="text-center">
            <img src="/src/images/imagemlogofdm.webp" style="height: 15vh;" />
            Músicas
        </h1>
        <div class="btn-group mb-3" style="width: 100%;" role="group">
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('Louvor Animado')">Louvores</button>
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('Marianas')">Marianas</button>
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('Oracionais')">Oracionais</button>
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('Adoração')">Adoração</button>
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('Missa')">Missa</button>
            <button type="button" class="btn btn-primary" onclick="aplicarFiltro('')">Todos</button>
        </div>
        <input type="text" id="search" class="form-control" placeholder="Pesquisar música ou artista">
        <ul id="music-list" class="list-group mt-3" stlye="margin-bottom: 4rem !important;width: 100%;"></ul>
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
                        debugger;
                        console.log('Falha ao registrar o Service Worker:', error);
                        alert("Seu navegador não suporta cache. Use internet!");
                    });
            });
        }
        function aplicarFiltro(classificacao) {
            $("#search").val(classificacao).trigger("input");
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
            checkAndCleanCache();
            document.getElementById('clearCacheBtn').addEventListener('click', () => {
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
                    alert('Cache Storage API não é suportada neste navegador.');
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
                filteredSongs.forEach(song => {
                    var nome = song.nome + " - " + song.artista;
                    $('#music-list').append(
                        `<li class="list-group-item">
                            <a href="music.php?id=${song.id}">${nome}</a>
                        </li>`
                    );
                });
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
