<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
  <title>Editor de Playlists — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body {
      font-family: var(--font-ui, sans-serif);
      padding: 0;
      margin: 0;
      background: var(--bg-0);
      color: var(--text-1);
    }
    .body {
      padding: 20px;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .body > div { min-width: 0; }
    .playlist-sidebar { flex: 1 1 320px; max-width: 420px; }
    .playlist-main { flex: 3 1 600px; min-width: 0; }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      cursor: pointer;
      padding: 6px 4px;
      border-bottom: 1px solid var(--border-1);
      min-height: 36px;
      color: var(--text-1);
    }
    .lists {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .lists > div { flex: 1 1 280px; min-width: 0; }
    .lists ul {
      border: 1px solid var(--border-1);
      width: 100%;
      max-height: 380px;
      overflow-y: auto;
      padding: 10px;
      padding-bottom: 0;
      box-sizing: border-box;
      background: var(--bg-1);
      border-radius: var(--radius-sm);
    }
    button {
      margin-right: 10px;
      padding: 8px 14px;
      min-height: 40px;
      cursor: pointer;
    }
    .btn-danger { background-color: #c0392b !important; color: #fff !important; border: none; }
    .btn-success { background-color: #1f7a3f !important; color: #fff !important; border: none; }
    select,
    input,
    #filtroMusicas,
    #filtroMusicasAtual {
      width: 100%;
      padding: 6px 10px;
      min-height: 36px;
      font-size: 14px;
      box-sizing: border-box;
      background: var(--bg-2);
      color: var(--text-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
    }
    select:focus, input:focus {
      outline: none;
      border-color: var(--border-2);
    }
    .btn-remover {
      margin-right: 0;
      padding: 4px 10px;
      min-height: 30px;
      font-size: 12px;
      background: transparent;
      color: var(--danger, #ef4444);
      border: 1px solid var(--danger, #ef4444);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background var(--t-fast), color var(--t-fast);
    }
    .btn-remover:hover {
      background: var(--danger, #ef4444);
      color: #fff;
    }
    .playlist-item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: default;
    }
    .playlist-item-row span {
      flex: 1;
      min-width: 56%;
      overflow-wrap: anywhere;
    }
    .playlist-item-row select {
      min-width: 90px;
    }
    @media (max-width: 700px) {
      .body { padding: 12px; gap: 12px; }
      .playlist-sidebar, .playlist-main { flex: 1 1 100%; max-width: none; }
      .lists { flex-direction: column; }
      .lists ul { max-height: 50vh; }
    }
  </style>
  <script>window.FDM_BAND_ID = '<?= e(current_band_id()) ?>';</script>
  <script src="<?= asset_url('/src/js/fdm-sync.js') ?>"></script>
</head>
<body>
<?php render_partial('topnav'); ?>

<div class="body">
  <div class="playlist-sidebar">
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <button type="button" class="btn btn--secondary" onclick="criarNovaPlaylist()"><?= fdm_icon('plus', 16) ?> Nova Setlist</button>
      <button type="button" class="btn btn--primary" onclick="salvarPlaylist()"><?= fdm_icon('save', 16) ?> Salvar</button>
      <button type="button" class="btn btn--danger" onclick="deletarPlaylist()"><?= fdm_icon('trash', 16) ?> Deletar</button>
    </div>

    <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px;">
      <label style="display:flex;flex-direction:column;gap:4px;">
        <b>Selecione a Playlist</b>
        <select id="playlistSelecionada" onchange="carregarPlaylist()" style="width:100%;"></select>
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">
        <b>Nome da Playlist</b>
        <input id="nomePlaylist" placeholder="Nome da Playlist" style="width:100%;">
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;">
        <b>Visível até</b>
        <input id="visivelAte" type="date" style="width:100%;">
      </label>
    </div>
  </div>

  <div class="playlist-main">
    <div class="lists">
      <div>
        <h4 style="margin-top: 0;">Músicas Disponíveis</h4>
        <input type="text" id="filtroMusicas" placeholder="Pesquisar músicas..." oninput="montarListas()">
        <ul id="musicasDisponiveis"></ul>
      </div>
      <div>
        <h4 style="margin-top: 0;">Playlist Atual</h4>
        <input type="text" id="filtroMusicasAtual" placeholder="Pesquisar músicas..." oninput="montarListasAtual()">
        <ul id="musicasNaPlaylist"></ul>
      </div>
    </div>
  </div>
</div>

<script>
let playlistAtual = null;
const tonsPlaylist = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getItemId(item) {
  return typeof item === 'object' && item !== null ? Number(item.id) : Number(item);
}

function getItemTom(item) {
  return typeof item === 'object' && item !== null ? (item.tom || '') : '';
}

function normalizarTom(tom) {
  const equivalentes = {
    'DB': 'C#',
    'EB': 'D#',
    'GB': 'F#',
    'AB': 'G#',
    'BB': 'A#'
  };
  const valor = String(tom || '').trim().toUpperCase();
  return equivalentes[valor] || valor;
}

function detectarTomOriginal(song) {
  if (!song || !song.cifra) return 'C';

  const div = document.createElement('div');
  div.innerHTML = song.cifra;
  const acordes = Array.from(div.querySelectorAll('b'))
    .map(el => (el.textContent || '').trim())
    .map(texto => texto.match(/^([A-Ga-g])(#|b)?/))
    .filter(Boolean)
    .map(match => normalizarTom(match[1] + (match[2] || '')))
    .filter(tom => tonsPlaylist.includes(tom));

  if (acordes.length === 0) return 'C';

  const contagem = {};
  acordes.forEach(tom => {
    contagem[tom] = (contagem[tom] || 0) + 1;
  });

  return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];
}

function getTomOriginalPorId(id) {
  const song = songs.find(s => Number(s.id) === Number(id));
  return detectarTomOriginal(song);
}

function normalizarItensPlaylist(playlist) {
  playlist.itens = (playlist.itens || []).map(item => {
    const id = getItemId(item);
    const tom = normalizarTom(getItemTom(item)) || getTomOriginalPorId(id);
    return { id: id, tom: tom };
  });
}

function carregarPlaylistsDisponiveis() {
  const select = document.getElementById('playlistSelecionada');
  select.innerHTML = '';
  playlistsSalvas.forEach((p, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = p.nome;
    select.appendChild(option);
  });

  if (playlistsSalvas.length > 0) {
    select.value = 0;
    carregarPlaylist();
  } else {
    playlistAtual = null;
    document.getElementById('nomePlaylist').value = '';
    limparListas();
  }
}

function carregarPlaylist() {
  const index = document.getElementById('playlistSelecionada').value;
  playlistAtual = playlistsSalvas[index];
  normalizarItensPlaylist(playlistAtual);
  document.getElementById('nomePlaylist').value = playlistAtual.nome;
  document.getElementById('visivelAte').value = playlistAtual.visivel_ate || '';
  montarListas();
}

function montarListas() {
  const disponiveis = document.getElementById('musicasDisponiveis');
  disponiveis.innerHTML = '';

  if (!playlistAtual) return;

  const filtro = document.getElementById('filtroMusicas').value.toLowerCase();

  songs.forEach(song => {
    const jaIncluida = playlistAtual.itens.some(item => getItemId(item) === Number(song.id));
    if (!jaIncluida && song.nome.toLowerCase().includes(filtro)) {
      const li = document.createElement('li');
      li.textContent = song.nome;
      li.onclick = () => adicionarMusica(song.id);
      disponiveis.appendChild(li);
    }
  });

  montarListasAtual();
}

function montarListasAtual() {
  const ulAtual = document.getElementById('musicasNaPlaylist');
  ulAtual.innerHTML = '';

  if (!playlistAtual) return;

  const filtro = document.getElementById('filtroMusicasAtual').value.toLowerCase();

  playlistAtual.itens.forEach(item => {
    const id = getItemId(item);
    const song = songs.find(s => Number(s.id) === Number(id));
    const nome = song ? song.nome : `ID ${id}`;

    if (nome.toLowerCase().includes(filtro)) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'playlist-item-row';

      const label = document.createElement('span');
      label.textContent = nome;

      const selectTom = document.createElement('select');
      tonsPlaylist.forEach(tom => {
        const option = document.createElement('option');
        option.value = tom;
        option.textContent = tom;
        selectTom.appendChild(option);
      });
      selectTom.value = normalizarTom(getItemTom(item)) || getTomOriginalPorId(id);
      selectTom.onchange = () => alterarTomMusica(id, selectTom.value);

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'btn-remover';
      remover.textContent = 'Remover';
      remover.onclick = () => removerMusica(id);

      row.appendChild(label);
      row.appendChild(selectTom);
      row.appendChild(remover);
      li.appendChild(row);
      ulAtual.appendChild(li);
    }
  });
}

function limparListas() {
  document.getElementById('musicasDisponiveis').innerHTML = '';
  document.getElementById('musicasNaPlaylist').innerHTML = '';
}

function adicionarMusica(id) {
  if (!playlistAtual.itens.some(item => getItemId(item) === Number(id))) {
    playlistAtual.itens.push({ id: Number(id), tom: getTomOriginalPorId(id) });
    montarListas();
  }
}

function removerMusica(id) {
  playlistAtual.itens = playlistAtual.itens.filter(item => getItemId(item) !== Number(id));
  montarListas();
}

function alterarTomMusica(id, tom) {
  const item = playlistAtual.itens.find(itemAtual => getItemId(itemAtual) === Number(id));
  if (!item) return;
  item.tom = normalizarTom(tom) || getTomOriginalPorId(id);
}

async function salvarPlaylist() {
  if (!playlistAtual) {
    alert('Nenhuma playlist selecionada para salvar.');
    return;
  }

  playlistAtual.nome = document.getElementById('nomePlaylist').value.trim();
  playlistAtual.visivel_ate = document.getElementById('visivelAte').value || '';
  playlistsSalvas.forEach(normalizarItensPlaylist);

  if (playlistAtual.nome === '') {
    alert('Informe um nome valido para a playlist.');
    return;
  }

  try {
    const res = await fetch('salvar_playlists.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: playlistsSalvas })
    });
    const data = await res.json();
    alert(data.mensagem);
    if (data.sucesso) carregarPlaylistsDisponiveis();
  } catch {
    alert('Erro na comunicacao com o servidor.');
  }
}

async function criarNovaPlaylist() {
  let nome = prompt('Digite o nome da nova playlist:');
  if (!nome) return;
  nome = nome.trim();
  if (nome === '') {
    alert('Nome invalido.');
    return;
  }

  if (playlistsSalvas.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    alert('Ja existe uma playlist com esse nome.');
    return;
  }

  const nova = { nome: nome, visivel_ate: '', itens: [] };
  playlistsSalvas.push(nova);

  try {
    const res = await fetch('salvar_playlists.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: playlistsSalvas })
    });
    const data = await res.json();
    if (data.sucesso) {
      carregarPlaylistsDisponiveis();
      const select = document.getElementById('playlistSelecionada');
      select.value = playlistsSalvas.length - 1;
      carregarPlaylist();
      alert(data.mensagem);
    } else {
      alert('Erro: ' + data.mensagem);
    }
  } catch {
    alert('Erro na comunicacao com o servidor.');
  }
}

async function deletarPlaylist() {
  if (!playlistAtual) {
    alert('Nenhuma playlist selecionada para deletar.');
    return;
  }
  const nome = (playlistAtual.nome || '').replace(/[<>&]/g, '');
  const ok = await fdmConfirm({
    title: 'Deletar playlist',
    message: 'A playlist <strong>' + nome + '</strong> será removida permanentemente.',
    confirmText: 'Sim, deletar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;

  const index = playlistsSalvas.indexOf(playlistAtual);
  if (index > -1) {
    playlistsSalvas.splice(index, 1);

    try {
      const res = await fetch('salvar_playlists.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: playlistsSalvas })
      });
      const data = await res.json();
      if (data.sucesso) {
        playlistAtual = null;
        carregarPlaylistsDisponiveis();
        alert(data.mensagem);
      } else {
        alert('Erro: ' + data.mensagem);
      }
    } catch {
      alert('Erro na comunicacao com o servidor.');
    }
  }
}

fdmSync.load(window.FDM_BAND_ID).then(() => carregarPlaylistsDisponiveis());
</script>

</body>
</html>
