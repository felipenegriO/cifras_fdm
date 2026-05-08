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
    .body{
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
      padding-bottom:  0;
    }
     .lists-atual ul {
      height: 380px;
    }
    button {
      margin-right: 10px;
      padding: 5px 10px;
      cursor: pointer;
    }
    #filtroMusicas {
      width: 28vw;
      padding: 5px;
      font-size: 14px;
    }
    #filtroMusicasAtual {
      width: 28vw;
      padding: 5px;
      font-size: 14px;
    }
    select,input{
        height: 30px;
    }
  </style>
  <script src="/src/js/musicas.js"></script>
  <script src="/src/js/playlists_salvas.js"></script>
</head>
<body>
    <?php render_partial('topnav'); ?>

<div class="body">
    <div>
        <button onclick="criarNovaPlaylist()">➕ Nova Playlist</button>
        <button onclick="deletarPlaylist()" style="background:#c44; color:#fff;">🗑️ Deletar Playlist</button>
        <button onclick="salvarPlaylist()">💾 Salvar Playlist</button>
        
        <br/><br/>
        <label><b>Selecione a Playlist:</b></label>
        <select id="playlistSelecionada" onchange="carregarPlaylist()" style="width: 90%;"></select>
        <br />
        <br />
        <label><b>Nome da Playlist:</b></label>
        <input id="nomePlaylist" placeholder="Nome da Playlist"  style="width: 88%;">
        <br />
        <br />
        <label><b>Visivel ate:</b></label>
        <input id="visivelAte" type="date" style="width: 88%;">
    </div>
    <div>
      <div class="lists">
      <div style="margin-left: 20px;">
        <h4 style="margin-top: 0;">Músicas Disponíveis</h4>
        <input type="text" id="filtroMusicas" placeholder="Pesquisar músicas..." oninput="montarListas()" />
        <ul id="musicasDisponiveis"></ul>
      </div>
      <div class="lists-atual">
        <h4 style="margin-top: 0;">Playlist Atual</h4>
        <input type="text" id="filtroMusicasAtual" placeholder="Pesquisar músicas..." oninput="montarListasAtual()" />
        <ul id="musicasNaPlaylist" ></ul>
      </div>
    </div>    
    </div>
    </div>
<script>
let playlistAtual = null;

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
    // disponíveis = NÃO estão na playlist + batem com filtro
    if (!playlistAtual.itens.includes(song.id) && song.nome.toLowerCase().includes(filtro)) {
      const li = document.createElement('li');
      li.textContent = song.nome;
      li.onclick = () => adicionarMusica(song.id);
      disponiveis.appendChild(li);
    }
  });

  // monta a lista da playlist atual usando o filtro próprio dela
  montarListasAtual();
}
function montarListasAtual() {
  const ulAtual = document.getElementById('musicasNaPlaylist');
  ulAtual.innerHTML = '';

  if (!playlistAtual) return;

  const filtro = document.getElementById('filtroMusicasAtual').value.toLowerCase();

  // percorre só os IDs da playlist
  playlistAtual.itens.forEach(id => {
    const song = songs.find(s => s.id === id);
    const nome = song ? song.nome : `ID ${id}`;

    // aplica filtro apenas na playlist atual
    if (nome.toLowerCase().includes(filtro)) {
      const li = document.createElement('li');
      li.textContent = nome;
      li.onclick = () => removerMusica(id);
      ulAtual.appendChild(li);
    }
  });
}

function limparListas() {
  document.getElementById('musicasDisponiveis').innerHTML = '';
  document.getElementById('musicasNaPlaylist').innerHTML = '';
}

function adicionarMusica(id) {
  if (!playlistAtual.itens.includes(id)) {
    playlistAtual.itens.push(id);
    montarListas();
  }
}

function removerMusica(id) {
  playlistAtual.itens = playlistAtual.itens.filter(x => x !== id);
  montarListas();
}

async function salvarPlaylist() {
  if (!playlistAtual) {
    alert('Nenhuma playlist selecionada para salvar.');
    return;
  }
  playlistAtual.nome = document.getElementById('nomePlaylist').value.trim();
  playlistAtual.visivel_ate = document.getElementById('visivelAte').value || '';
  if (playlistAtual.nome === '') {
    alert('Informe um nome válido para a playlist.');
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
    alert('Erro na comunicação com o servidor.');
  }
}

async function criarNovaPlaylist() {
  let nome = prompt('Digite o nome da nova playlist:');
  if (!nome) return; // cancelado ou vazio
  nome = nome.trim();
  if (nome === '') {
    alert('Nome inválido.');
    return;
  }

  if (playlistsSalvas.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    alert('Já existe uma playlist com esse nome.');
    return;
  }

  const nova = { nome: nome, visivel_ate: '', itens: [] };
  playlistsSalvas.push(nova);

  // Chama backend para salvar
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
    alert('Erro na comunicação com o servidor.');
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

    // Chama backend para salvar
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
      alert('Erro na comunicação com o servidor.');
    }
  }
}

carregarPlaylistsDisponiveis();
</script>

</body>
</html>
