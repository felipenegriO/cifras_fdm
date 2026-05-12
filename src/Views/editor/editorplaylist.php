<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Editor de Playlists</title>
  <style>
    body {
      font-family: sans-serif;
      padding: 0px;
      margin: 0px;
    }
    .body {
      padding: 20px;
      display: flex !important;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      cursor: pointer;
      padding: 2px;
      border-bottom: 1px solid #ccc;
    }
    .lists {
      display: flex;
      gap: 20px;
    }
    .lists ul {
      border: 1px solid #ccc;
      width: 28vw;
      height: 380px;
      overflow-y: auto;
      padding: 10px;
      padding-bottom: 0;
    }
    .lists-atual ul {
      height: 380px;
    }
    button {
      margin-right: 10px;
      padding: 5px 10px;
      cursor: pointer;
    }
    #filtroMusicas,
    #filtroMusicasAtual {
      width: 28vw;
      padding: 5px;
      font-size: 14px;
    }
    select,
    input {
      height: 30px;
    }
    .playlist-item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: default;
    }
    .playlist-item-row span {
      flex: 1;
    }
    .playlist-item-row select {
      width: 70px;
    }
  </style>
  <script src="/src/js/musicas.js"></script>
  <script src="/src/js/playlists_salvas.js"></script>
</head>
<body>
<?php render_partial('topnav'); ?>

<div class="body">
  <div>
    <button onclick="criarNovaPlaylist()">Nova Playlist</button>
    <button onclick="deletarPlaylist()" style="background:#c44; color:#fff;">Deletar Playlist</button>
    <button onclick="salvarPlaylist()">Salvar Playlist</button>

    <br><br>
    <label><b>Selecione a Playlist:</b></label>
    <select id="playlistSelecionada" onchange="carregarPlaylist()" style="width: 90%;"></select>
    <br><br>
    <label><b>Nome da Playlist:</b></label>
    <input id="nomePlaylist" placeholder="Nome da Playlist" style="width: 88%;">
    <br><br>
    <label><b>Visivel ate:</b></label>
    <input id="visivelAte" type="date" style="width: 88%;">
  </div>

  <div>
    <div class="lists">
      <div style="margin-left: 20px;">
        <h4 style="margin-top: 0;">Musicas Disponiveis</h4>
        <input type="text" id="filtroMusicas" placeholder="Pesquisar musicas..." oninput="montarListas()">
        <ul id="musicasDisponiveis"></ul>
      </div>
      <div class="lists-atual">
        <h4 style="margin-top: 0;">Playlist Atual</h4>
        <input type="text" id="filtroMusicasAtual" placeholder="Pesquisar musicas..." oninput="montarListasAtual()">
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
  if (!confirm(`Tem certeza que deseja deletar a playlist "${playlistAtual.nome}"?`)) return;

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

carregarPlaylistsDisponiveis();
</script>

</body>
</html>
