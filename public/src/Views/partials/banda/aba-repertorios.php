<?php
/**
 * Aba Repertórios do "Minha Banda".
 * Recorte de Views/editor/editorplaylist.php, sem redesenho. É a MESMA
 * tela que o menu abre — um código só, dois pontos de entrada.
 */
?>
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
      align-items: flex-start;
    }
    .body > div { min-width: 0; }
    .playlist-sidebar {
      flex: 1 1 320px;
      max-width: 420px;
      position: sticky;
      top: 16px;
    }
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
    li:last-child { border-bottom: 0; }
    li[draggable="true"] { cursor: grab; }
    li.is-dragging { opacity: .45; }
    .playlist-panel {
      background: var(--bg-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
      padding: 14px;
    }
    .playlist-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--bg-0);
      padding-bottom: 12px;
    }
    .playlist-actions button { margin-right: 0; }
    .playlist-fields {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .playlist-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .playlist-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      color: var(--text-2);
      font-size: 13px;
    }
    .playlist-badge {
      border: 1px solid var(--border-1);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--bg-2);
    }
    .playlist-badge--dirty {
      color: #b8860b;
      border-color: #b8860b;
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
    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .list-header h4 { margin: 0; }
    .list-count {
      color: var(--text-2);
      font-size: 13px;
      white-space: nowrap;
    }
    .song-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .song-row span {
      overflow-wrap: anywhere;
    }
    .song-row__add {
      flex: 0 0 auto;
      margin-right: 0;
      min-height: 32px;
      padding: 4px 10px;
    }
    .empty-state {
      cursor: default;
      color: var(--text-2);
      text-align: center;
      padding: 28px 12px;
      border-bottom: 0;
    }
    button {
      margin-right: 10px;
      padding: 8px 14px;
      min-height: 40px;
      cursor: pointer;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: .55;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      min-height: 32px;
      width: 32px;
      background: transparent;
      color: var(--text-3);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background var(--t-fast), color var(--t-fast);
    }
    .btn-remover:hover {
      background: rgba(239, 68, 68, .12);
      color: var(--danger, #ef4444);
    }
    .btn-icon-sm {
      margin-right: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      min-height: 32px;
      width: 32px;
      border: 0;
      background: transparent;
      color: var(--text-2);
    }
    .btn-icon-sm:hover:not(:disabled) { background: var(--bg-3); color: var(--text-1); }
    .playlist-item-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      cursor: default;
    }
    .playlist-drag-handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 24px;
      width: 24px;
      height: 32px;
      color: var(--text-3);
      cursor: grab;
    }
    .playlist-position {
      width: 24px;
      flex: 0 0 24px;
      color: var(--text-2);
      font-size: 13px;
      text-align: right;
    }
    .playlist-song-name {
      flex: 1;
      min-width: 120px;
      overflow-wrap: break-word;
      word-break: normal;
      font-weight: var(--fw-medium, 500);
    }
    .playlist-item-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
      margin-left: auto;
    }
    .playlist-tom-control {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-2);
      font-size: 12px;
    }
    .playlist-tom-control select {
      width: 72px;
      min-width: 72px;
      min-height: 32px;
      padding-block: 3px;
    }
    .playlist-move-actions {
      display: inline-flex;
      overflow: hidden;
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
    }
    .playlist-move-actions .btn-icon-sm + .btn-icon-sm {
      border-left: 1px solid var(--border-1);
    }
    .playlist-modal {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 0, 0, .55);
      z-index: 99990;
    }
    .playlist-modal.is-open { display: flex; }
    .playlist-modal__box {
      width: min(440px, 100%);
      background: var(--bg-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
      padding: 20px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
    }
    .playlist-modal__box h2 {
      margin: 0 0 16px;
      font-size: 20px;
    }
    .playlist-modal__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    @media (max-width: 700px) {
      .body { padding: 12px; gap: 12px; }
      select, input, #filtroMusicas, #filtroMusicasAtual { min-height: 44px; }
      .playlist-sidebar, .playlist-main { flex: 1 1 100%; max-width: none; position: static; }
      .lists { flex-direction: column; }
      .lists ul { max-height: 50vh; }
      .playlist-actions {
        position: sticky;
        top: 0;
        margin: -12px -12px 0;
        padding: 12px;
        border-bottom: 1px solid var(--border-1);
      }
      .playlist-actions button { flex: 1 1 120px; min-height: 44px; }
      .lists > div { width: 100%; }
      .lists ul { padding: 8px; }
      .lists li:not(.empty-state) {
        margin-bottom: 8px;
        padding: 10px;
        min-height: 44px;
        border: 1px solid var(--border-1);
        border-radius: var(--radius-sm);
        background: var(--bg-2);
      }
      .song-row__add, .btn-remover, .btn-icon-sm, .playlist-tom-control select { min-height: 44px; }
      .btn-remover, .btn-icon-sm { width: 44px; }
      .playlist-item-row {
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .playlist-drag-handle { display: none; }
      .playlist-song-name {
        flex: 1 1 calc(100% - 36px);
        min-width: 120px;
      }
      .playlist-item-actions {
        flex: 1 1 100%;
        justify-content: flex-end;
        padding-left: 32px;
      }
    }
  </style>

<div class="body">
  <h2 class="sr-only">Editar repertórios</h2>
  <div class="playlist-sidebar">
    <div class="playlist-actions">
      <button type="button" class="btn btn--secondary" onclick="criarNovaPlaylist()"><?= cifro_icon('plus', 16) ?> Novo repertório</button>
      <button type="button" class="btn btn--primary" id="btnSalvarPlaylist" onclick="salvarPlaylist()"><?= cifro_icon('save', 16) ?> Salvar repertório</button>
      <button type="button" class="btn btn--secondary" id="btnCompartilharPlaylist" onclick="compartilharPlaylist()"><?= cifro_icon('share-2', 16) ?> Compartilhar</button>
      <button type="button" class="btn btn--danger" id="btnDeletarPlaylist" onclick="deletarPlaylist()"><?= cifro_icon('trash', 16) ?> Excluir repertório</button>
    </div>

    <div class="playlist-panel">
    <div class="playlist-fields">
      <label class="playlist-field">
        <b>Selecione o repertório</b>
        <select id="playlistSelecionada" onchange="selecionarPlaylist()" style="width:100%;"></select>
      </label>
      <label class="playlist-field">
        <b>Nome do repertório</b>
        <input id="nomePlaylist" placeholder="Nome do repertório" style="width:100%;" oninput="marcarAlterado()">
      </label>
      <label class="playlist-field">
        <b>Visível até</b>
        <input id="visivelAte" type="date" style="width:100%;" onchange="marcarAlterado()">
      </label>
    </div>
    <div class="playlist-meta">
      <span class="playlist-badge" id="playlistResumo">Nenhum repertório selecionado</span>
      <span class="playlist-badge playlist-badge--dirty" id="playlistAlterada" hidden>Alterações não salvas</span>
    </div>
    </div>
  </div>

  <div class="playlist-main">
    <div class="lists">
      <div>
        <div class="list-header">
          <h2 class="playlist-section-title">Músicas disponíveis</h2>
          <span class="list-count" id="contadorDisponiveis">0</span>
        </div>
        <label class="sr-only" for="filtroMusicas">Pesquisar músicas disponíveis</label>
        <input type="search" id="filtroMusicas" placeholder="Pesquisar músicas..." oninput="montarListas()">
        <ul id="musicasDisponiveis"></ul>
      </div>
      <div>
        <div class="list-header">
          <h2 class="playlist-section-title">Músicas adicionadas</h2>
          <span class="list-count" id="contadorAtual">0</span>
        </div>
        <label class="sr-only" for="filtroMusicasAtual">Pesquisar músicas adicionadas</label>
        <input type="search" id="filtroMusicasAtual" placeholder="Pesquisar músicas..." oninput="montarListasAtual()">
        <ul id="musicasNaPlaylist"></ul>
      </div>
    </div>
  </div>
</div>

<div class="playlist-modal" id="modalNovaPlaylist" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="modalNovaPlaylistTitulo">
  <div class="playlist-modal__box">
    <h2 id="modalNovaPlaylistTitulo">Novo repertório</h2>
    <label class="playlist-field">
      <b>Nome do repertório</b>
      <input id="novaPlaylistNome" placeholder="Nome do repertório">
    </label>
    <label class="playlist-field" style="margin-top:10px;">
      <b>Visível até</b>
      <input id="novaPlaylistVisivelAte" type="date">
    </label>
    <div class="playlist-modal__actions">
      <button type="button" class="btn btn--secondary" onclick="fecharModalNovaPlaylist()">Cancelar</button>
      <button type="button" class="btn btn--primary" onclick="confirmarNovaPlaylist()"><?= cifro_icon('check', 16) ?> Criar repertório</button>
    </div>
  </div>
</div>

<script>
// Mesmo limite do backend (cifro_require_plan_limit / PlaylistFormValidator) —
// só para avisar antes de abrir o modal. Quem decide de verdade é o servidor.
const LIMITE_PLAYLISTS = <?= json_encode(is_master() ? -1 : (cifro_plan_limits($_SESSION['banda_atual']['plano'] ?? 'bloqueado')['playlists'] ?? 0)) ?>;
const PLANO_LABEL_ATUAL = <?= json_encode(cifro_plan_label($_SESSION['banda_atual']['plano'] ?? 'bloqueado')) ?>;

let playlistAtual = null;
let playlistAtualIndex = '';
let playlistAlterada = false;
let novaPlaylistResolve = null;
let playlistSnapshot = '';
let playlistModalTrigger = null;
let salvandoPlaylist = false;

function toast(mensagem, tipo = 'info') {
  if (window.cifroToast) {
    cifroToast(mensagem, tipo);
  } else {
    alert(mensagem);
  }
}

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function dataExpiracaoPadrao() {
  const hoje = new Date();
  const dia = hoje.getDate();
  const data = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(dia, ultimoDia));
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const diaFormatado = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${diaFormatado}`;
}

function setPlaylistAlterada(alterada) {
  playlistAlterada = alterada;
  document.getElementById('playlistAlterada').hidden = !alterada;
  atualizarEstadoAcoes();
}

function marcarAlterado() {
  if (!playlistAtual) return;
  setPlaylistAlterada(true);
}

function atualizarEstadoAcoes() {
  const temPlaylist = !!playlistAtual;
  const btnSalvar = document.getElementById('btnSalvarPlaylist');
  const btnDeletar = document.getElementById('btnDeletarPlaylist');
  const btnCompartilhar = document.getElementById('btnCompartilharPlaylist');
  const resumo = document.getElementById('playlistResumo');

  btnSalvar.disabled = !temPlaylist || !playlistAlterada;
  btnDeletar.disabled = !temPlaylist;
  btnCompartilhar.disabled = !temPlaylist;
  resumo.textContent = temPlaylist
    ? `${playlistAtual.itens.length} música${playlistAtual.itens.length === 1 ? '' : 's'} no repertório`
    : 'Nenhum repertório selecionado';
}

async function compartilharPlaylist() {
  if (!playlistAtual) return;
  if (playlistAlterada) {
    toast('Salve as alterações antes de compartilhar.', 'warning');
    return;
  }
  try {
    const result = await window.CifroPlaylistShare.share(playlistAtual, songs);
    if (result === 'copied') toast('Repertório copiado para a área de transferência.', 'success');
  } catch (error) {
    toast('Não foi possível compartilhar o repertório.', 'error');
  }
}

function criarEmptyState(texto) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  li.textContent = texto;
  return li;
}

async function confirmarDescarteAlteracoes() {
  if (!playlistAlterada) return true;
  const ok = await cifroConfirm({
    title: 'Descartar alterações?',
    message: 'Existem alterações não salvas neste repertório.',
    confirmText: 'Descartar',
    cancelText: 'Continuar editando',
    danger: true
  });
  if (ok) descartarAlteracoesAtuais();
  return ok;
}

function descartarAlteracoesAtuais() {
  if (!playlistAtual || playlistAtualIndex === '' || !playlistSnapshot) return;
  const restaurada = JSON.parse(playlistSnapshot);
  playlistsSalvas[Number(playlistAtualIndex)] = restaurada;
  playlistAtual = restaurada;
  document.getElementById('nomePlaylist').value = playlistAtual.nome;
  document.getElementById('visivelAte').value = playlistAtual.visivel_ate || '';
  setPlaylistAlterada(false);
  montarListas();
}

function getItemId(item) {
  return typeof item === 'object' && item !== null ? Number(item.id) : Number(item);
}

function getItemTom(item) {
  return typeof item === 'object' && item !== null ? (item.tom || '') : '';
}

function normalizarTom(tom) {
  return window.CifroChords.normalizeKey(tom);
}

function detectarTomOriginal(song) {
  if (!song) return '';
  return normalizarTom(song.tom) || window.CifroChords.identifyKey(song.cifra)?.key || '';
}

function getTomOriginalPorId(id) {
  const song = songs.find(s => Number(s.id) === Number(id));
  return detectarTomOriginal(song);
}

function normalizarItensPlaylist(playlist) {
  playlist.itens = (playlist.itens || []).map(item => {
    const id = getItemId(item);
    const original = getTomOriginalPorId(id);
    const selecionado = normalizarTom(getItemTom(item));
    const tom = selecionado && original
      ? window.CifroChords.tonicOf(selecionado) + (window.CifroChords.modeOf(original) === 'minor' ? 'm' : '')
      : selecionado || original;
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
    carregarPlaylist(0);
  } else {
    playlistAtual = null;
    playlistAtualIndex = '';
    playlistSnapshot = '';
    document.getElementById('nomePlaylist').value = '';
    document.getElementById('visivelAte').value = '';
    setPlaylistAlterada(false);
    montarListas();
  }
}

async function selecionarPlaylist() {
  const select = document.getElementById('playlistSelecionada');
  const novoIndex = select.value;
  if (!(await confirmarDescarteAlteracoes())) {
    select.value = playlistAtualIndex;
    return;
  }
  carregarPlaylist(novoIndex);
}

function carregarPlaylist(index = document.getElementById('playlistSelecionada').value) {
  playlistAtual = playlistsSalvas[index];
  playlistAtualIndex = String(index);
  normalizarItensPlaylist(playlistAtual);
  playlistSnapshot = JSON.stringify(playlistAtual);
  document.getElementById('nomePlaylist').value = playlistAtual.nome;
  document.getElementById('visivelAte').value = playlistAtual.visivel_ate || '';
  setPlaylistAlterada(false);
  montarListas();
}

function montarListas() {
  const disponiveis = document.getElementById('musicasDisponiveis');
  disponiveis.innerHTML = '';

  if (!playlistAtual) {
    disponiveis.appendChild(criarEmptyState(playlistsSalvas.length ? 'Selecione um repertório.' : 'Nenhum repertório criado.'));
    document.getElementById('contadorDisponiveis').textContent = '0';
    montarListasAtual();
    atualizarEstadoAcoes();
    return;
  }

  const filtro = normalizarTexto(document.getElementById('filtroMusicas').value);
  let total = 0;

  songs.forEach(song => {
    const jaIncluida = playlistAtual.itens.some(item => getItemId(item) === Number(song.id));
    if (!jaIncluida && normalizarTexto(song.nome).includes(filtro)) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'song-row';

      const nome = document.createElement('span');
      const tom = detectarTomOriginal(song);
      nome.textContent = song.nome + (tom ? ` [${tom}]` : '');

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn--secondary song-row__add';
      add.textContent = 'Adicionar ao repertório';
      add.onclick = () => adicionarMusica(song.id);

      row.appendChild(nome);
      row.appendChild(add);
      li.appendChild(row);
      disponiveis.appendChild(li);
      total++;
    }
  });

  document.getElementById('contadorDisponiveis').textContent = total;
  if (total === 0) {
    disponiveis.appendChild(criarEmptyState(filtro ? 'Nenhuma música encontrada.' : 'Todas as músicas já estão no repertório.'));
  }
  montarListasAtual();
  atualizarEstadoAcoes();
}

function montarListasAtual() {
  const ulAtual = document.getElementById('musicasNaPlaylist');
  ulAtual.innerHTML = '';

  if (!playlistAtual) {
    ulAtual.appendChild(criarEmptyState('Nenhum repertório selecionado.'));
    document.getElementById('contadorAtual').textContent = '0';
    atualizarEstadoAcoes();
    return;
  }

  const filtro = normalizarTexto(document.getElementById('filtroMusicasAtual').value);
  let total = 0;

  playlistAtual.itens.forEach((item, index) => {
    const id = getItemId(item);
    const song = songs.find(s => Number(s.id) === Number(id));
    const tomMusica = normalizarTom(getItemTom(item)) || detectarTomOriginal(song);
    const nome = song ? song.nome : `ID ${id}`;

    if (normalizarTexto(nome).includes(filtro)) {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = index;
      li.addEventListener('dragstart', iniciarArrastePlaylist);
      li.addEventListener('dragover', permitirSoltarPlaylist);
      li.addEventListener('drop', soltarPlaylist);
      li.addEventListener('dragend', finalizarArrastePlaylist);

      const row = document.createElement('div');
      row.className = 'playlist-item-row';

      const handle = document.createElement('span');
      handle.className = 'playlist-drag-handle';
      handle.innerHTML = `<?= cifro_icon('grip-vertical', 18) ?>`;
      handle.title = `Arrastar ${nome}`;
      handle.setAttribute('aria-hidden', 'true');

      const posicao = document.createElement('strong');
      posicao.className = 'playlist-position';
      posicao.textContent = `${index + 1}.`;

      const label = document.createElement('span');
      label.className = 'playlist-song-name';
      label.textContent = nome + (tomMusica ? ` [${tomMusica}]` : '');

      const actions = document.createElement('div');
      actions.className = 'playlist-item-actions';

      const tomControl = document.createElement('label');
      tomControl.className = 'playlist-tom-control';
      const tomLabel = document.createElement('span');
      tomLabel.textContent = 'Tom';

      const selectTom = document.createElement('select');
      selectTom.setAttribute('aria-label', `Tom de ${nome}`);
      if (tomMusica) {
        window.CifroChords.keysForMode(window.CifroChords.modeOf(tomMusica)).forEach(tom => {
          const option = document.createElement('option');
          option.value = tom;
          option.textContent = tom;
          selectTom.appendChild(option);
        });
        selectTom.value = tomMusica;
      } else {
        selectTom.add(new Option('Não identificado', ''));
        selectTom.disabled = true;
      }
      selectTom.onchange = () => alterarTomMusica(id, selectTom.value);

      const remover = document.createElement('button');
      remover.type = 'button';
      remover.className = 'btn-remover';
      remover.innerHTML = `<?= cifro_icon('trash', 16) ?>`;
      remover.setAttribute('aria-label', `Remover ${nome}`);
      remover.title = 'Remover do repertório';
      remover.onclick = () => removerMusica(id);

      const moverActions = document.createElement('div');
      moverActions.className = 'playlist-move-actions';

      const subir = document.createElement('button');
      subir.type = 'button';
      subir.className = 'btn-icon-sm';
      subir.innerHTML = `<?= cifro_icon('chevron-up', 16) ?>`;
      subir.disabled = index === 0;
      subir.setAttribute('aria-label', `Mover ${nome} para cima`);
      subir.title = 'Mover para cima';
      subir.onclick = () => moverMusica(index, index - 1);

      const descer = document.createElement('button');
      descer.type = 'button';
      descer.className = 'btn-icon-sm';
      descer.innerHTML = `<?= cifro_icon('chevron-down', 16) ?>`;
      descer.disabled = index === playlistAtual.itens.length - 1;
      descer.setAttribute('aria-label', `Mover ${nome} para baixo`);
      descer.title = 'Mover para baixo';
      descer.onclick = () => moverMusica(index, index + 1);

      tomControl.appendChild(tomLabel);
      tomControl.appendChild(selectTom);
      moverActions.appendChild(subir);
      moverActions.appendChild(descer);
      actions.appendChild(tomControl);
      actions.appendChild(moverActions);
      actions.appendChild(remover);
      row.appendChild(handle);
      row.appendChild(posicao);
      row.appendChild(label);
      row.appendChild(actions);
      li.appendChild(row);
      ulAtual.appendChild(li);
      total++;
    }
  });

  document.getElementById('contadorAtual').textContent = playlistAtual.itens.length;
  if (total === 0) {
    ulAtual.appendChild(criarEmptyState(filtro ? 'Nenhuma música encontrada neste repertório.' : 'Repertório vazio. Adicione músicas disponíveis.'));
  }
  atualizarEstadoAcoes();
}

function limparListas() {
  document.getElementById('musicasDisponiveis').innerHTML = '';
  document.getElementById('musicasNaPlaylist').innerHTML = '';
  document.getElementById('contadorDisponiveis').textContent = '0';
  document.getElementById('contadorAtual').textContent = '0';
  atualizarEstadoAcoes();
}

function adicionarMusica(id) {
  if (!playlistAtual.itens.some(item => getItemId(item) === Number(id))) {
    playlistAtual.itens.push({ id: Number(id), tom: getTomOriginalPorId(id) });
    setPlaylistAlterada(true);
    montarListas();
  }
}

function removerMusica(id) {
  playlistAtual.itens = playlistAtual.itens.filter(item => getItemId(item) !== Number(id));
  setPlaylistAlterada(true);
  montarListas();
}

function alterarTomMusica(id, tom) {
  const item = playlistAtual.itens.find(itemAtual => getItemId(itemAtual) === Number(id));
  if (!item) return;
  item.tom = normalizarTom(tom) || getTomOriginalPorId(id);
  setPlaylistAlterada(true);
  montarListasAtual();
}

function moverMusica(origem, destino) {
  if (!playlistAtual || destino < 0 || destino >= playlistAtual.itens.length || origem === destino) return;
  const [item] = playlistAtual.itens.splice(origem, 1);
  playlistAtual.itens.splice(destino, 0, item);
  setPlaylistAlterada(true);
  montarListasAtual();
}

function iniciarArrastePlaylist(event) {
  if (!event.target.closest('.playlist-drag-handle')) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData('text/plain', event.currentTarget.dataset.index);
  event.currentTarget.classList.add('is-dragging');
}

function permitirSoltarPlaylist(event) {
  event.preventDefault();
}

function soltarPlaylist(event) {
  event.preventDefault();
  const origem = Number(event.dataTransfer.getData('text/plain'));
  const destino = Number(event.currentTarget.dataset.index);
  moverMusica(origem, destino);
}

function finalizarArrastePlaylist(event) {
  event.currentTarget.classList.remove('is-dragging');
}

async function salvarPlaylist() {
  if (salvandoPlaylist) return;
  if (!playlistAtual) {
    toast('Nenhum repertório selecionado para salvar.', 'warning');
    return;
  }

  playlistAtual.nome = document.getElementById('nomePlaylist').value.trim();
  playlistAtual.visivel_ate = document.getElementById('visivelAte').value || dataExpiracaoPadrao();
  document.getElementById('visivelAte').value = playlistAtual.visivel_ate;
  playlistsSalvas.forEach(normalizarItensPlaylist);

  if (playlistAtual.nome === '') {
    toast('Informe um nome válido para a playlist.', 'warning');
    return;
  }

  salvandoPlaylist = true;
  const saveButton = document.getElementById('btnSalvarPlaylist');
  saveButton.disabled = true;
  try {
    const res = await fetch('salvar_playlists.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: playlistsSalvas })
    });
    const data = await res.json();
    toast(data.mensagem, data.sucesso ? 'success' : 'error');
    if (data.sucesso) {
      await cifroSync.sync(window.CIFRO_BAND_ID);
      const select = document.getElementById('playlistSelecionada');
      const option = select.options[Number(playlistAtualIndex)];
      if (option) option.textContent = playlistAtual.nome;
      playlistSnapshot = JSON.stringify(playlistAtual);
      setPlaylistAlterada(false);
    }
  } catch {
    toast('Erro na comunicação com o servidor.', 'error');
  } finally {
    salvandoPlaylist = false;
    atualizarEstadoAcoes();
  }
}

async function criarNovaPlaylist() {
  if (LIMITE_PLAYLISTS !== -1 && playlistsSalvas.length >= LIMITE_PLAYLISTS) {
    toast('Limite do plano ' + PLANO_LABEL_ATUAL + ' atingido: máximo de ' + LIMITE_PLAYLISTS + ' repertório(s). Faça upgrade do plano para adicionar mais.', 'error');
    return;
  }
  if (!(await confirmarDescarteAlteracoes())) return;

  const dados = await abrirModalNovaPlaylist();
  if (!dados) return;

  let nome = dados.nome.trim();
  if (nome === '') {
    toast('Nome inválido.', 'warning');
    return;
  }

  if (playlistsSalvas.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    toast('Já existe uma playlist com esse nome.', 'warning');
    return;
  }

  const nova = { nome: nome, visivel_ate: dados.visivel_ate || dataExpiracaoPadrao(), itens: [] };
  playlistsSalvas.push(nova);

  try {
    const res = await fetch('salvar_playlists.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: playlistsSalvas })
    });
    const data = await res.json();
    if (data.sucesso) {
      await cifroSync.sync(window.CIFRO_BAND_ID);
      carregarPlaylistsDisponiveis();
      const select = document.getElementById('playlistSelecionada');
      select.value = playlistsSalvas.length - 1;
      carregarPlaylist(playlistsSalvas.length - 1);
      toast(data.mensagem, 'success');
    } else {
      playlistsSalvas.pop();
      toast(data.mensagem || 'Erro ao criar playlist.', 'error');
    }
  } catch {
    playlistsSalvas.pop();
    toast('Erro na comunicação com o servidor.', 'error');
  }
}

async function deletarPlaylist() {
  if (!playlistAtual) {
    toast('Nenhuma playlist selecionada para deletar.', 'warning');
    return;
  }
  const nome = (playlistAtual.nome || '').replace(/[<>&]/g, '');
  const ok = await cifroConfirm({
    title: 'Deletar playlist',
    message: 'A playlist <strong>' + nome + '</strong> será removida permanentemente.',
    confirmText: 'Sim, deletar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;

  const index = Number(playlistAtualIndex);
  if (index >= 0 && index < playlistsSalvas.length) {
    playlistAtual = playlistsSalvas[index];
    const removida = playlistsSalvas.splice(index, 1)[0];

    try {
      const res = await fetch('salvar_playlists.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: playlistsSalvas })
      });
      const data = await res.json();
      if (data.sucesso) {
        await cifroSync.sync(window.CIFRO_BAND_ID);
        playlistAtual = null;
        playlistAtualIndex = '';
        playlistSnapshot = '';
        carregarPlaylistsDisponiveis();
        toast(data.mensagem, 'success');
      } else {
        toast(data.mensagem || 'Erro ao deletar playlist.', 'error');
        playlistsSalvas.splice(index, 0, removida);
      }
    } catch {
      playlistsSalvas.splice(index, 0, removida);
      toast('Erro na comunicação com o servidor.', 'error');
    }
  }
}

function abrirModalNovaPlaylist() {
  const modal = document.getElementById('modalNovaPlaylist');
  const nome = document.getElementById('novaPlaylistNome');
  const visivelAte = document.getElementById('novaPlaylistVisivelAte');

  playlistModalTrigger = document.activeElement;
  nome.value = '';
  visivelAte.value = dataExpiracaoPadrao();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  return new Promise(resolve => {
    novaPlaylistResolve = resolve;
    setTimeout(() => nome.focus(), 50);
  });
}

function fecharModalNovaPlaylist() {
  const modal = document.getElementById('modalNovaPlaylist');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  playlistModalTrigger?.focus();
  if (novaPlaylistResolve) {
    novaPlaylistResolve(null);
    novaPlaylistResolve = null;
  }
}

function confirmarNovaPlaylist() {
  const nome = document.getElementById('novaPlaylistNome').value;
  const visivelAte = document.getElementById('novaPlaylistVisivelAte').value;
  const modal = document.getElementById('modalNovaPlaylist');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  playlistModalTrigger?.focus();
  if (novaPlaylistResolve) {
    novaPlaylistResolve({ nome: nome, visivel_ate: visivelAte || dataExpiracaoPadrao() });
    novaPlaylistResolve = null;
  }
}

document.getElementById('modalNovaPlaylist').addEventListener('click', event => {
  if (event.target.id === 'modalNovaPlaylist') fecharModalNovaPlaylist();
});

document.addEventListener('keydown', event => {
  const modalAberto = document.getElementById('modalNovaPlaylist').classList.contains('is-open');
  if (!modalAberto) return;
  if (event.key === 'Escape') fecharModalNovaPlaylist();
  if (event.key === 'Enter') confirmarNovaPlaylist();
  if (event.key === 'Tab') {
    const focusable = [...document.querySelectorAll('#modalNovaPlaylist input, #modalNovaPlaylist button')].filter(item => !item.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

window.addEventListener('beforeunload', event => {
  if (!playlistAlterada) return;
  event.preventDefault();
  event.returnValue = '';
});

cifroSync.load(window.CIFRO_BAND_ID)
  .then(() => carregarPlaylistsDisponiveis())
  .catch(() => {
    limparListas();
    toast('Erro ao carregar dados sincronizados.', 'error');
  });
</script>

<?php
// chords.js e playlist-share.js ficavam no <head> da página original; a casca
// só carrega os scripts comuns a todas as abas, então eles vêm aqui.
?>
<script src="<?= asset_url('/src/js/chords.js') ?>" defer></script>
<script src="<?= asset_url('/src/js/cifro-share.js') ?>" defer></script>
<script src="<?= asset_url('/src/js/playlist-share.js') ?>" defer></script>
