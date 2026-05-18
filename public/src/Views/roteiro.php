<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Roteiro</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/bootstrap.min.css" rel="stylesheet" defer>
  <link href="/src/css/theme.css" rel="stylesheet">
  <link href="/src/css/style2.css" rel="stylesheet" defer>
  <style>
    body, .roteiro-page, .roteiro-page * {
      background: black;
      color: white;
      line-height: normal;
    }

    body {
      padding: 20px;
    }

    .roteiro-meta {
      margin: 0;
      color: #cfcfcf;
    }

    #roteiro-body a {
      color: #8fd3ff;
      text-decoration: underline;
    }
    #roteiro-body a:hover { color: #b9e3ff; }

    @media print {
      body, .roteiro-page, .roteiro-page * {
        background: #fff !important;
        color: #000 !important;
      }
      a[href]::after { content: ""; }
      .topnav, .btn-group, button, #toast { display: none !important; }
      #roteiro-body { font-size: 12pt; }
    }
  </style>
</head>
<body>
  <div id="toast" style="
    position: fixed;
    bottom: 15%;
    right: 15%;
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
  <div class="btn-group" style="position: fixed; right: 10px; top: 10px; z-index: 999;" role="group" aria-label="Ações do roteiro">
    <button type="button" class="btn btn-primary" id="btnPrintRoteiro" aria-label="Imprimir roteiro" title="Imprimir" onclick="window.print()"><i class="fa-solid fa-print" aria-hidden="true"></i></button>
    <button type="button" class="btn btn-primary" id="playlistButton" aria-label="Abrir playlists"><i class="fa-solid fa-music" aria-hidden="true"></i></button>
  </div>

  <div id="sideMenu">
    <button id="closeButton" onclick="document.getElementById('sideMenu').style.right = '-300px';">×</button>
    <h2>PlayLists</h2>
    <ul id="lista-playlists" style="display: block; overflow: hidden; height: 100%; border: none;"></ul>
  </div>

  <div class="row">
    <div class="col-2">
      <a href="index.php" class="btn"><i class="fa-solid fa-2x fa-arrow-left"></i></a>
    </div>
    <div class="col-10">
      <h3 id="roteiro-title"></h3>
      <p id="roteiro-date" class="roteiro-meta"></p>
    </div>
  </div>

  <div class="row">
    <div class="container" style="margin-left: 0px; margin-right: 0; max-width: 100%;">
      <div id="roteiro-body" class="cifra" style="margin-bottom: 4rem !important;"></div>
    </div>
  </div>

  <script src="/src/js/jquery-3.5.1.min.js"></script>
  <script src="/src/js/bootstrap.min.js" defer></script>
  <script src="/src/js/06215d6691.js" defer></script>
  <script src="<?= asset_url('/src/js/script.js') ?>" defer></script>
  <script src="<?= asset_url('/src/js/musicas.js') ?>" defer></script>
  <script src="<?= asset_url('/src/js/playlists_salvas.js') ?>" defer></script>
  <script src="<?= asset_url('/src/js/roteiros_salvos.js') ?>" defer></script>
  <script src="<?= asset_url('/src/js/playlists.js') ?>" defer></script>
  <script src="<?= asset_url('/src/js/offline-tools.js') ?>"></script>
  <script src="<?= asset_url('/src/js/roteiros.js') ?>" defer></script>

  <script>
    window.addEventListener('DOMContentLoaded', function () {
      function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
      }

      const roteiroId = getQueryParam('id');
      if (typeof getRoteiroById !== 'function') return;

      const roteiro = getRoteiroById(roteiroId);

      if (!roteiro) {
        document.getElementById('roteiro-title').textContent = 'Roteiro nao encontrado';
      } else {
        if (!isRoteiroVisible(roteiro)) {
          document.getElementById('roteiro-title').textContent = 'Roteiro indisponivel';
          document.getElementById('roteiro-date').textContent = formatRoteiroDate(roteiro.visivel_ate);
          document.getElementById('roteiro-body').innerHTML = '';
        } else {
          document.getElementById('roteiro-title').textContent = roteiro.titulo || 'Roteiro';
          document.getElementById('roteiro-date').textContent = formatRoteiroDate(roteiro.visivel_ate);
          renderRoteiro('roteiro-body', roteiro.conteudo || '');
        }
      }
    });
  </script>
</body>
</html>
