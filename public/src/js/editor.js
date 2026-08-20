(function () {
  const state = {
    selected: null,
    editor: null,
    baseline: '',
    dirty: false,
    saving: false,
    previewSetlist: null,
    keyDetectionTimer: null,
    transposing: false,
    importSourceUrl: ''
  };

  const elements = {
    shell: document.getElementById('editorShell'),
    list: document.getElementById('musicas'),
    listState: document.getElementById('libraryState'),
    count: document.getElementById('songCount'),
    search: document.getElementById('buscaMusica'),
    title: document.getElementById('titulo'),
    artist: document.getElementById('artista'),
    bpm: document.getElementById('bit'),
    key: document.getElementById('tomPadrao'),
    transposicao: document.getElementById('transposicaoInstrumento'),
    transposicaoLabel: document.getElementById('transposicaoLabel'),
    transposicaoHint: document.getElementById('transposicaoHint'),
    sugerirTransposicao: document.getElementById('sugerirTransposicao'),
    classification: document.getElementById('classificacao'),
    categoriaAviso: document.getElementById('categoriaAviso'),
    novaCategoriaCampo: document.getElementById('novaCategoriaCampo'),
    novaCategoriaNome: document.getElementById('novaCategoriaNome'),
    novaCategoriaSalvar: document.getElementById('novaCategoriaSalvar'),
    novaCategoriaCancelar: document.getElementById('novaCategoriaCancelar'),
    dirtyIndicator: document.getElementById('dirtyIndicator'),
    saveButton: document.getElementById('saveButton'),
    saveButtonLabel: document.getElementById('saveButtonLabel'),
    deleteButton: document.getElementById('deleteSongButton'),
    status: document.getElementById('status'),
    previewModal: document.getElementById('previewModal'),
    previewFrame: document.getElementById('previewFrame'),
    previewModalTitle: document.getElementById('previewModalTitle'),
    importModal: document.getElementById('importModal'),
    importTabLinkButton: document.getElementById('importTabLinkButton'),
    importTabTextButton: document.getElementById('importTabTextButton'),
    importTabLink: document.getElementById('importTabLink'),
    importTabText: document.getElementById('importTabText'),
    importUrlInput: document.getElementById('importUrlInput'),
    importFetchError: document.getElementById('importFetchError'),
    importSourceUrl: document.getElementById('importSourceUrl'),
    importContent: document.getElementById('importContent'),
    importRights: document.getElementById('importRights'),
    importPreview: document.getElementById('importPreview'),
    importCapoBox: document.getElementById('importCapoBox'),
    importAplicarCapo: document.getElementById('importAplicarCapo'),
    importCapoTexto: document.getElementById('importCapoTexto'),
    importCapoAviso: document.getElementById('importCapoAviso'),
    confirmImportButton: document.getElementById('confirmImportButton'),
    textarea: document.getElementById('cifraInput'),
    editorError: document.getElementById('editorLoadError')
  };

  function songs() {
    return Array.isArray(window.songs) ? window.songs : [];
  }

  const NOVA_CATEGORIA = '__nova__';

  // "+ Nova categoria…" é uma ação de menu, não uma opção selecionável: o
  // select nunca pode ficar parado em NOVA_CATEGORIA, senão salvar a música
  // (inclusive via Ctrl+S) mandaria esse sentinela como classificacao.
  // categoriaAnterior guarda a última categoria "de verdade" para restaurar
  // o select assim que NOVA_CATEGORIA aparecer como valor.
  let categoriaAnterior = '';

  function definirCategoriaSelecionada(valor) {
    categoriaAnterior = valor || '';
    elements.classification.value = categoriaAnterior;
    // Atribuição programática de .value não dispara "input", então
    // detectDirty() (ligado a esse evento) nunca rodaria sozinho aqui. Sem
    // esta chamada, criar uma categoria pelo editor marca a música como
    // selecionada mas não como suja: o indicador fica apagado, o toast diz
    // "selecionada" e trocar de música descarta a categorização em silêncio.
    detectDirty();
  }

  function podeCriarCategoria() {
    return window.CIFRO_PODE_EDITAR_CONTEUDO === true;
  }

  function renderCategories() {
    const selected = elements.classification.value;
    const categorias = Array.isArray(window.categorias) ? window.categorias : [];
    elements.classification.replaceChildren(new Option('Sem categoria', ''));
    categorias.forEach(category => {
      elements.classification.add(new Option(category.nome, category.nome));
    });
    if (podeCriarCategoria()) {
      elements.classification.add(new Option('+ Nova categoria…', NOVA_CATEGORIA));
    }
    definirCategoriaSelecionada(selected === NOVA_CATEGORIA ? '' : selected);
    renderCategoriaAviso(categorias.length);
  }

  function renderCategoriaAviso(total) {
    const aviso = elements.categoriaAviso;
    if (!aviso) return;
    aviso.replaceChildren();
    if (total > 0) {
      if (!podeCriarCategoria()) aviso.textContent = 'Só gestores criam categorias novas.';
      aviso.hidden = !aviso.textContent;
      return;
    }
    aviso.append(document.createTextNode('Sua banda ainda não tem categorias.'));
    if (podeCriarCategoria()) {
      const link = document.createElement('a');
      link.href = (window.APP_BASE || '') + '/minha-banda.php?aba=categorias';
      link.textContent = 'Criar agora';
      aviso.append(document.createTextNode(' '), link);
    }
    aviso.hidden = false;
  }

  function abrirCampoNovaCategoria() {
    elements.novaCategoriaCampo.hidden = false;
    elements.novaCategoriaNome.value = '';
    elements.novaCategoriaNome.focus();
  }

  function fecharCampoNovaCategoria() {
    elements.novaCategoriaCampo.hidden = true;
  }

  // Garante que o <select> tenha uma <option> para `nome` mesmo que o sync
  // pós-criação não tenha atualizado window.categorias (offline ou sessão
  // marcada inválida, ver cifro-sync.js). Sem isso, selecionar `nome` deixa
  // o select com selectedIndex -1 e .value '' — a música salva sem
  // categoria enquanto o toast afirma que ela foi selecionada.
  function garantirOpcaoCategoria(nome) {
    const options = Array.from(elements.classification.options);
    if (options.some(option => option.value === nome)) return;
    const indexNova = options.findIndex(option => option.value === NOVA_CATEGORIA);
    const option = new Option(nome, nome);
    if (indexNova >= 0) elements.classification.add(option, indexNova);
    else elements.classification.add(option);
  }

  async function criarCategoria() {
    const nome = elements.novaCategoriaNome.value.trim();
    if (!nome) return;
    const api = (window.APP_BASE || '') + '/src/backend/categorias/api.php';
    elements.novaCategoriaSalvar.disabled = true;
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const data = await response.json().catch(() => ({}));
      // 409 com categoria significa que já existe uma equivalente: seleciona a
      // que existe em vez de insistir em criar uma segunda.
      if (!response.ok && !(response.status === 409 && data.categoria)) {
        throw new Error(data.error || 'Não foi possível criar a categoria.');
      }
      const criada = data.categoria || { nome };
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      renderCategories();
      garantirOpcaoCategoria(criada.nome);
      definirCategoriaSelecionada(criada.nome);
      elements.novaCategoriaCampo.hidden = true;
      if (window.cifroToast) cifroToast('Categoria "' + criada.nome + '" selecionada.', 'success');
    } catch (error) {
      if (window.cifroToast) cifroToast(error.message, 'error');
    } finally {
      elements.novaCategoriaSalvar.disabled = false;
    }
  }

  elements.classification.addEventListener('change', () => {
    if (elements.classification.value === NOVA_CATEGORIA) {
      // Restaura a seleção anterior imediatamente: o select nunca fica
      // parado em NOVA_CATEGORIA, então salvar enquanto o popup está aberto
      // (botão Salvar ou Ctrl+S) usa a categoria de antes, não o sentinela.
      // Passa por definirCategoriaSelecionada (em vez de atribuir .value
      // direto) para que detectDirty() rode de novo: selecionar o sentinela
      // dispara "input" com valor __nova__ antes deste "change", o que liga
      // o indicador de sujeira; sem recalcular aqui ele fica aceso mesmo
      // depois de Cancelar.
      definirCategoriaSelecionada(categoriaAnterior);
      abrirCampoNovaCategoria();
    } else {
      definirCategoriaSelecionada(elements.classification.value);
      elements.novaCategoriaCampo.hidden = true;
    }
  });
  elements.novaCategoriaSalvar.addEventListener('click', criarCategoria);
  elements.novaCategoriaCancelar.addEventListener('click', fecharCampoNovaCategoria);
  // Não há <form> em editor.php, então Enter não tem submissão implícita
  // nenhuma para acionar: sem este handler, digitar o nome e apertar Enter
  // não fazia nada. stopPropagation evita que o Enter também alcance o
  // keydown global (Ctrl+S etc.) enquanto o popup está aberto.
  elements.novaCategoriaNome.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      criarCategoria();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      fecharCampoNovaCategoria();
    }
  });

  function getContent() {
    if (!state.editor) return elements.textarea.value;
    const body = state.editor.getBody().cloneNode(true);
    preserveAlignmentSpacesIn(body);
    return state.editor.serializer.serialize(body, { getInner: true });
  }

  function setContent(value) {
    if (state.editor) state.editor.setContent(value || '');
    else elements.textarea.value = value || '';
    scheduleKeyDetection();
  }

  function detectedKey(content) {
    return window.CifroChords?.identifyKey(content || '');
  }

  function renderDetectedKey(analysis, selectedKey) {
    if (!elements.key) return;
    elements.key.replaceChildren();

    if (!analysis) {
      elements.key.add(new Option('Não identificado', ''));
      elements.key.disabled = true;
      elements.key.title = 'Marque ou digite os acordes para identificar o tom.';
      return;
    }

    window.CifroChords.keysForMode(analysis.mode).forEach(key => {
      elements.key.add(new Option(key, key));
    });
    elements.key.value = window.CifroChords.normalizeKey(selectedKey || analysis.key);
    elements.key.disabled = false;
    elements.key.title = `Detectado automaticamente com ${Math.round(analysis.confidence * 100)}% de confiança. Escolha outro tom para transpor a cifra.`;
  }

  function updateDetectedKey() {
    const analysis = detectedKey(getContent());
    renderDetectedKey(analysis);
    return analysis;
  }

  function scheduleKeyDetection() {
    clearTimeout(state.keyDetectionTimer);
    state.keyDetectionTimer = setTimeout(updateDetectedKey, 180);
  }

  function changeDefaultKey() {
    if (state.transposing || !elements.key?.value) return;
    const content = getContent();
    const analysis = detectedKey(content);
    const target = window.CifroChords.normalizeKey(elements.key.value);
    if (!analysis || !target) {
      renderDetectedKey(analysis);
      return;
    }

    if (window.CifroChords.modeOf(target) !== analysis.mode) {
      renderDetectedKey(analysis);
      return;
    }

    const interval = window.CifroChords.intervalBetweenKeys(analysis.key, target);
    if (!interval) {
      renderDetectedKey(analysis, target);
      return;
    }

    state.transposing = true;
    const transposed = window.CifroChords.transposeHtml(content, interval);
    setContent(transposed);
    state.transposing = false;
    const result = detectedKey(transposed);
    renderDetectedKey(result, target);
    detectDirty();
    setStatus(`Cifra transposta de ${analysis.key} para ${target}.`, 'success');
  }

  function snapshot() {
    return JSON.stringify({
      nome: elements.title.value.trim(),
      artista: elements.artist.value,
      bit: elements.bpm.value,
      classificacao: elements.classification.value,
      cifra: getContent(),
      source_url: state.importSourceUrl,
      transposicao_instrumento: elements.transposicao.value
    });
  }

  function instrumentoDoUsuario() {
    return (window.CIFRO_CONFIG && window.CIFRO_CONFIG.instrumento) || 'outro';
  }

  // O rótulo segue o instrumento de quem edita, mas a faixa é a união dos
  // instrumentos: o cadastro vale para a banda inteira, não só para quem digitou.
  function configurarCampoTransposicao() {
    elements.transposicaoLabel.textContent = window.CifroChords.rotuloDeslocamento(instrumentoDoUsuario());
  }

  function atualizarLegendaTransposicao() {
    const valor = Number(elements.transposicao.value) || 0;
    const tom = detectedKey(getContent())?.key || '';
    elements.transposicaoHint.textContent = (!valor || !tom)
      ? ''
      : 'formas em ' + window.CifroChords.tomDasFormas(tom, valor);
  }

  function setBaseline() {
    state.baseline = snapshot();
    setDirty(false);
  }

  function setDirty(value) {
    state.dirty = Boolean(value);
    elements.dirtyIndicator.hidden = !state.dirty;
  }

  function detectDirty() {
    setDirty(snapshot() !== state.baseline);
    updateDocumentTitle();
  }

  function updateDocumentTitle() {
    document.title = `${elements.title.value.trim() || 'Nova música'} · Editor de Cifras - Cifrô`;
  }

  function setStatus(message, kind) {
    elements.status.textContent = message || '';
    if (kind) elements.status.dataset.kind = kind;
    else delete elements.status.dataset.kind;
  }

  function renderSongs() {
    const query = elements.search.value.trim().toLocaleLowerCase('pt-BR');
    const ordered = songs().slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    const filtered = ordered.filter(song => String(song.nome || '').toLocaleLowerCase('pt-BR').includes(query));

    elements.list.replaceChildren();
    elements.count.textContent = `${ordered.length} ${ordered.length === 1 ? 'música' : 'músicas'}`;

    if (!ordered.length) {
      elements.listState.textContent = 'Seu repertório está vazio. Use “Nova música” para adicionar a primeira cifra.';
      elements.listState.hidden = false;
      return;
    }

    if (!filtered.length) {
      elements.listState.textContent = 'Nenhuma música encontrada.';
      elements.listState.hidden = false;
      return;
    }

    elements.listState.hidden = true;
    filtered.forEach(song => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const title = document.createElement('span');
      const meta = document.createElement('span');
      button.type = 'button';
      button.dataset.songId = song.id;
      button.setAttribute('aria-current', state.selected && String(state.selected.id) === String(song.id) ? 'true' : 'false');
      title.className = 'song-list__title';
      title.textContent = song.nome || 'Sem título';
      meta.className = 'song-list__meta';
      const key = song.tom || detectedKey(song.cifra)?.key;
      meta.textContent = [song.artista, song.classificacao, key ? `Tom ${key}` : ''].filter(Boolean).join(' · ') || 'Sem detalhes';
      button.append(title, meta);
      button.addEventListener('click', () => selectSong(song));
      item.appendChild(button);
      elements.list.appendChild(item);
    });
  }

  async function confirmDiscard() {
    if (!state.dirty) return true;
    return cifroConfirm({
      title: 'Descartar alterações?',
      message: 'As alterações feitas nesta música ainda não foram salvas.',
      confirmText: 'Descartar',
      cancelText: 'Continuar editando',
      danger: true
    });
  }

  async function selectSong(song) {
    if (state.selected && String(state.selected.id) === String(song.id)) return;
    if (!await confirmDiscard()) return;

    state.selected = song;
    elements.title.value = song.nome || '';
    elements.bpm.value = song.bit || '';
    elements.artist.value = song.artista || '';
    definirCategoriaSelecionada(song.classificacao || '');
    elements.transposicao.value = Number(song.transposicao_instrumento) || 0;
    state.importSourceUrl = song.source_url || '';
    setContent(String(song.cifra || '').trim());
    updateDetectedKey();
    atualizarLegendaTransposicao();
    updateDocumentTitle();
    setStatus('');
    setBaseline();
    renderSongs();
    activateMobilePanel('workspace');
  }

  async function newSong() {
    if (!await confirmDiscard()) return;
    state.selected = null;
    state.importSourceUrl = '';
    elements.title.value = '';
    elements.bpm.value = '';
    elements.artist.value = '';
    definirCategoriaSelecionada('');
    elements.transposicao.value = 0;
    setContent('');
    updateDetectedKey();
    atualizarLegendaTransposicao();
    updateDocumentTitle();
    setStatus('');
    setBaseline();
    renderSongs();
    activateMobilePanel('workspace');
    elements.title.focus();
  }

  function normaliseChordMarkup(html) {
    const notes = /^(?:[A-G](?:#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-G](?:#|b)?)?)$/i;
    const container = document.createElement('div');
    container.innerHTML = html;

    container.querySelectorAll('b,strong').forEach(element => {
      const text = (element.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (!text) {
        element.remove();
        return;
      }
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.every(token => notes.test(token.replace(/[.,;:!?]/g, '')))) {
        const chord = document.createElement('b');
        chord.innerHTML = element.innerHTML;
        element.replaceWith(chord);
      }
    });

    moveTrailingBreaksOutsideChord(container);
    return container.innerHTML;
  }

  function moveTrailingBreaksOutsideChord(root) {
    root.querySelectorAll('b,strong').forEach(element => {
      let reference = element;
      while (element.lastChild?.nodeName === 'BR') {
        element.lastChild.remove();
        const lineBreak = document.createElement('br');
        reference.after(lineBreak);
        reference = lineBreak;
      }
    });
  }

  function normaliseChordLineBreaks(html) {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    moveTrailingBreaksOutsideChord(container);
    return container.innerHTML;
  }

  function preserveAlignmentSpacesIn(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.nodeValue) node.nodeValue = node.nodeValue.replace(/ {2,}/g, spaces => '\u00a0'.repeat(spaces.length));
    });
  }

  function preserveAlignmentSpaces(html) {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    preserveAlignmentSpacesIn(container);
    return container.innerHTML;
  }

  function cleanForSave(html) {
    const container = document.createElement('div');
    container.innerHTML = String(html || '').replace(/<span[^>]*?>\s*<\/span>/g, '');
    container.querySelectorAll('span').forEach(span => {
      const style = span.getAttribute('style');
      if (style && style.includes('#ff7700')) {
        span.setAttribute('style', 'color: #ff7700;');
      } else {
        span.replaceWith(...span.childNodes);
      }
    });
    return normaliseChordLineBreaks(normaliseChordMarkup(container.innerHTML))
      .replace(/class="js-modal-trigger"/g, '')
      .replace(/ class=""/g, '')
      .replace(/ style=""/g, '')
      .replace(/\n/g, '<br />')
      .trim();
  }

  async function parseJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || `Erro HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  }

  async function saveSong() {
    if (state.saving) return;
    const title = elements.title.value.trim();
    if (!title) {
      setStatus('Digite o nome da música.', 'error');
      elements.title.focus();
      return;
    }

    const content = cleanForSave(getContent());
    if (!content.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, '').replace(/\s+/g, '')) {
      setStatus('A cifra está vazia.', 'error');
      return;
    }
    if (/(cifra-column|player--music|player-core|cifra_cnt|js-pl-v)/i.test(content)) {
      setStatus('Use "Limpar colagem" antes de salvar.', 'error');
      return;
    }

    state.saving = true;
    elements.saveButton.disabled = true;
    elements.saveButtonLabel.textContent = 'Salvando...';
    setStatus('Salvando...');

    const payload = {
      id: state.selected?.id,
      nome: title,
      cifra: content,
      source_url: state.importSourceUrl,
      bit: elements.bpm.value,
      artista: elements.artist.value,
      classificacao: elements.classification.value,
      transposicao_instrumento: Number(elements.transposicao.value) || 0
    };

    try {
      let data;
      try {
        const response = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await parseJsonResponse(response);
      } catch (error) {
        if (!error.data?.duplicate) throw error;
        const existing = error.data.existing;
        const overwrite = await cifroConfirm({
          title: 'Link já cadastrado',
          message: `Já existe a música <strong>${String(existing.nome || '').replace(/[<>&]/g, '')}</strong> com esse link. Deseja sobrescrevê-la?`,
          confirmText: 'Sobrescrever',
          cancelText: 'Cancelar',
          danger: true
        });
        if (!overwrite) {
          setStatus('Cadastro cancelado: link já existe.', 'error');
          return;
        }
        payload.id = existing.id;
        payload.confirm_overwrite = true;
        const response = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await parseJsonResponse(response);
        state.selected = songs().find(song => String(song.id) === String(existing.id)) || null;
      }
      const saved = state.selected || {};
      Object.assign(saved, payload, { id: data.id || saved.id, tom: detectedKey(content)?.key || '' });
      if (!state.selected) window.songs.push(saved);
      state.selected = saved;
      await cifroSync.sync(window.CIFRO_BAND_ID);
      const refreshed = songs().find(song => String(song.id) === String(saved.id));
      if (!refreshed) songs().push(saved);
      state.selected = refreshed || saved;
      setContent(content);
      setBaseline();
      renderSongs();
      setStatus('Música salva com sucesso.', 'success');
      if (window.cifroToast) cifroToast('Música salva com sucesso!', 'success');
    } catch (error) {
      setStatus(error.message || 'Falha de rede ao salvar.', 'error');
      if (window.cifroToast) cifroToast(error.message || 'Falha de rede ao salvar.', 'error');
    } finally {
      state.saving = false;
      elements.saveButton.disabled = false;
      elements.saveButtonLabel.textContent = 'Salvar música';
    }
  }

  async function deleteSong() {
    document.getElementById('moreActions').open = false;
    if (!state.selected?.id) {
      setStatus('Selecione uma música para excluir.', 'error');
      return;
    }

    const name = String(state.selected.nome || 'esta música').replace(/[<>&]/g, '');
    const confirmed = await cifroConfirm({
      title: 'Excluir música',
      message: `A música <strong>${name}</strong> será removida permanentemente para todos os usuários.`,
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!confirmed) return;

    elements.deleteButton.disabled = true;
    try {
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: state.selected.id })
      });
      await parseJsonResponse(response);
      const index = songs().findIndex(song => String(song.id) === String(state.selected.id));
      if (index >= 0) songs().splice(index, 1);
      await cifroSync.sync(window.CIFRO_BAND_ID);
      state.dirty = false;
      await newSong();
      setStatus('Música excluída com sucesso.', 'success');
      if (window.cifroToast) cifroToast('Música excluída com sucesso!', 'success');
    } catch (error) {
      setStatus(error.message || 'Falha de rede ao excluir.', 'error');
    } finally {
      elements.deleteButton.disabled = false;
    }
  }

  function openPreview() {
    const previewSong = {
      id: state.selected?.id || 'editor-preview',
      nome: elements.title.value.trim() || 'Sem título',
      artista: elements.artist.value,
      bit: elements.bpm.value,
      classificacao: elements.classification.value,
      cifra: getContent(),
      tom: detectedKey(getContent())?.key || ''
    };
    state.previewSetlist = sessionStorage.getItem('cifroSetlist');
    sessionStorage.removeItem('cifroSetlist');
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify(previewSong));
    elements.previewModalTitle.textContent = `Preview: ${previewSong.nome}`;
    elements.previewFrame.src = `/music.php?id=${encodeURIComponent(previewSong.id)}&editorPreview=1`;
    elements.previewModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    elements.previewModal.classList.remove('is-open');
    elements.previewFrame.src = 'about:blank';
    sessionStorage.removeItem('cifroEditorPreview');
    if (state.previewSetlist === null) sessionStorage.removeItem('cifroSetlist');
    else sessionStorage.setItem('cifroSetlist', state.previewSetlist);
    state.previewSetlist = null;
    document.body.style.overflow = '';
  }

  // Mesma regra usada em music.php (chordTokenRegex) para reconhecer um
  // acorde isolado.
  const CHORD_LINE_TOKEN_REGEX = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|M)?\d{0,2}(?:M)?(?:\([^)]+\))*(?:[+º°])?(?:\/[A-G](?:#|b)?)?$/i;
  // Tokens que podem aparecer numa linha de acordes sem serem eles mesmos
  // um acorde: marcador de seção sem espaço ("[Intro]", "[Final]") e
  // parênteses isolados que envolvem um trecho instrumental ("( E7  Em7 )").
  const CHORD_LINE_ALLOWED_EXTRA_REGEX = /^(\[[^\]\s]+\]|\(|\))$/;

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function isChordToken(token) {
    return CHORD_LINE_TOKEN_REGEX.test(token);
  }

  // Marca com <b> os acordes de linhas de cifra (mesmo critério do
  // chordTokenRegex de music.php, tolerando marcador de seção e parênteses
  // isolados), para que o estilo global `b { color: var(--chord) }`
  // reconheça automaticamente cifras importadas — igual ao que o botão
  // "Acorde" do editor faz manualmente.
  function markChordLines(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => {
        const parts = line.split(/(\s+)/);
        const tokens = parts.filter((part, index) => index % 2 === 0 && part !== '');
        const cleanedTokens = tokens.map(token => token.replace(/[.,;:!?]/g, ''));
        const hasChord = cleanedTokens.some(isChordToken);
        const isChordLine = hasChord && cleanedTokens.every(
          token => isChordToken(token) || CHORD_LINE_ALLOWED_EXTRA_REGEX.test(token)
        );
        if (!isChordLine) return escapeHtml(line);
        return parts.map((part, index) => {
          if (index % 2 !== 0) {
            // Espaço simples entre tags <b> pode ser descartado pelo TinyMCE
            // ao serializar; usar &nbsp; garante que o espaçamento sobreviva.
            return part.replace(/ /g, '&nbsp;');
          }
          if (part === '') return part;
          const cleaned = part.replace(/[.,;:!?]/g, '');
          return isChordToken(cleaned) ? `<b>${escapeHtml(part)}</b>` : escapeHtml(part);
        }).join('');
      })
      .join('\n');
  }

  // Linha que começa marcando uma seção da cifra, ex.: "[Refrão]" ou
  // "[Intro] Em  C  D9(11)" (o marcador pode vir seguido de acordes na
  // mesma linha).
  const SECTION_HEADER_REGEX = /^\[([^\]]+)\]/;

  // Mapeia o nome da seção para a tag já usada pelos botões manuais do
  // editor (versoBtn/preRefraoBtn/refraoBtn/ponteBtn usam os mesmos
  // formatos). Qualquer nome não reconhecido (Intro, Primeira Parte,
  // Segunda Parte, Final, Solo etc.) vira um bloco "verso" genérico (div),
  // igual ao botão "Verso"/"Intro" do editor.
  function classifySectionTag(label) {
    const normalized = String(label || '').trim().toLowerCase();
    if (/^refr[aã]o/.test(normalized)) return 'refrao';
    if (/^pr[eé]-?\s?refr[aã]o/.test(normalized)) return 'prerefrao';
    if (/^ponte/.test(normalized)) return 'ponte';
    return 'div';
  }

  // Agrupa as linhas em seções a partir dos marcadores "[Nome]": cada
  // marcador inicia uma nova seção que engloba todas as linhas até o
  // próximo marcador (ou o fim do texto). Conteúdo antes do primeiro
  // marcador (se houver) fica sem tag, como hoje.
  function splitIntoSections(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const sections = [];
    let current = null;
    lines.forEach(line => {
      const match = line.trim().match(SECTION_HEADER_REGEX);
      if (match) {
        if (current) sections.push(current);
        current = { tag: classifySectionTag(match[1]), lines: [line] };
      } else {
        if (!current) current = { tag: null, lines: [] };
        current.lines.push(line);
      }
    });
    if (current) sections.push(current);
    return sections;
  }

  function sectionToHtml(section) {
    const inner = markChordLines(section.lines.join('\n'))
      .replace(/ {2}/g, ' &nbsp;')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/\n/g, '<br/>');
    return section.tag ? `<${section.tag}>${inner}</${section.tag}>` : inner;
  }

  function plainTextToHtml(text) {
    const html = splitIntoSections(text).map(sectionToHtml).join('').trim();
    if (!html) return '';
    // O TinyMCE fragmenta em vários <p> quando recebe muitos <b> adjacentes
    // separados só por espaço (comum em linhas de acorde). Envolver tudo
    // num único bloco evita essa quebra e mantém a cifra como um bloco só.
    return `<div>${html}</div>`;
  }

  // Espelha TransposicaoInstrumento::casaDeCapo do PHP: a aba de colar texto
  // não passa pelo servidor, então precisa entender "2ª casa" por conta própria.
  function casaDeCapo(texto) {
    const encontrado = String(texto ?? '').match(/(?<![\d-])(\d{1,2})/);
    if (!encontrado) return null;
    const casa = parseInt(encontrado[1], 10);
    return casa >= 1 && casa <= 12 ? casa : null;
  }

  function parseImportedSong(rawText) {
    const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
    const firstContent = lines.findIndex(line => line.trim() !== '');
    if (firstContent < 0) throw new Error('Cole o conteúdo da cifra antes de gerar o preview.');
    const header = lines[firstContent].trim();
    const separator = header.match(/^(.+?)\s+-\s+(.+)$/);
    let title = separator ? separator[1].trim() : header;
    let artist = separator ? separator[2].trim() : '';
    let contentStart = firstContent + 1;
    if (!artist && lines[contentStart]?.trim() && !/^(tom|capo|afina[cç][aã]o)\s*:/i.test(lines[contentStart].trim())) {
      artist = lines[contentStart].trim();
      contentStart += 1;
    }
    const metadata = {};
    while (contentStart < lines.length) {
      const match = lines[contentStart].trim().match(/^(tom|capo|afina[cç][aã]o)\s*:\s*(.+)$/i);
      if (!match) break;
      metadata[match[1].toLocaleLowerCase('pt-BR')] = match[2].trim();
      contentStart += 1;
    }
    const content = lines.slice(contentStart).join('\n').trim();
    if (!content) throw new Error('A cifra não possui letra ou acordes para importar.');
    metadata.capo = casaDeCapo(metadata.capo);
    return { title: title.slice(0, 200), artist: artist.slice(0, 200), content, metadata };
  }

  function switchImportTab(tab) {
    const isLink = tab === 'link';
    elements.importTabLinkButton.classList.toggle('is-active', isLink);
    elements.importTabLinkButton.setAttribute('aria-selected', String(isLink));
    elements.importTabTextButton.classList.toggle('is-active', !isLink);
    elements.importTabTextButton.setAttribute('aria-selected', String(!isLink));
    elements.importTabLink.hidden = !isLink;
    elements.importTabText.hidden = isLink;
    elements.importFetchError.hidden = true;
    elements.importPreview.hidden = true;
    elements.importCapoBox.hidden = true;
    elements.importCapoAviso.hidden = true;
    elements.importModal.dataset.preview = '';
    elements.confirmImportButton.disabled = true;
  }

  function applyImportPreview(parsed, source) {
    elements.importModal.dataset.preview = JSON.stringify({ ...parsed, source });
    const detected = detectedKey(parsed.content);
    elements.importPreview.textContent = `${parsed.title}${parsed.artist ? ` — ${parsed.artist}` : ''} · ${parsed.content.split('\n').length} linhas${detected?.key ? ` · tom ${detected.key}` : ''}`;
    elements.importPreview.hidden = false;
    elements.confirmImportButton.disabled = !elements.importRights.checked;
    montarConfirmacaoDeCapo(parsed, detected?.key || '');
  }

  // O CifraClub escreve o "Tom:" como o som que sai e o corpo da cifra como as
  // formas a tocar. Guardamos sempre o tom soante, então importar com capotraste
  // significa subir a cifra — e isso nunca acontece sem o usuário confirmar.
  function montarConfirmacaoDeCapo(parsed, tomDoCorpo) {
    const capo = Number(parsed.metadata?.capo) || 0;
    elements.importCapoBox.hidden = !capo || !tomDoCorpo;
    elements.importCapoAviso.hidden = true;
    if (elements.importCapoBox.hidden) return;

    const tomReal = window.CifroChords.tomDasFormas(tomDoCorpo, -capo);
    elements.importCapoTexto.textContent =
      `A página informa capotraste na ${capo}ª casa. Os acordes estão em ${tomDoCorpo}, então o tom real é ${tomReal}. Salvar no tom real com capotraste ${capo}.`;

    // Trava contra corromper cifra: se o tom declarado não bater com o corpo
    // somado ao capotraste, o layout da origem mudou ou a página está errada.
    const tomDaPagina = window.CifroChords.normalizeKey(parsed.metadata?.tom || '');
    const confere = !tomDaPagina || tomDaPagina === window.CifroChords.normalizeKey(tomReal);
    elements.importAplicarCapo.checked = confere;
    if (!confere) {
      elements.importCapoAviso.textContent =
        `A página informa tom ${parsed.metadata.tom}, mas o corpo somado ao capotraste dá ${tomReal}. Confira antes de aplicar.`;
      elements.importCapoAviso.hidden = false;
    }
  }

  async function fetchImportFromUrl() {
    elements.importFetchError.hidden = true;
    elements.confirmImportButton.disabled = true;

    const url = elements.importUrlInput.value.trim();
    if (!url) {
      elements.importFetchError.textContent = 'Informe o link da cifra.';
      elements.importFetchError.hidden = false;
      return;
    }
    if (!elements.importRights.checked) {
      elements.importPreview.hidden = true;
      elements.importFetchError.textContent = 'Confirme que você tem autorização para usar o conteúdo.';
      elements.importFetchError.hidden = false;
      return;
    }

    elements.importUrlInput.disabled = true;
    elements.importPreview.textContent = 'Buscando cifra...';
    elements.importPreview.hidden = false;
    try {
      const response = await fetch('import.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await parseJsonResponse(response);
      applyImportPreview({ title: data.title, artist: data.artist, content: data.content, metadata: data.metadata }, data.source);
    } catch (error) {
      elements.importPreview.hidden = true;
      elements.importFetchError.innerHTML = '';
      const message = document.createElement('span');
      message.textContent = (error.message || 'Não foi possível buscar a cifra.') + ' ';
      const switchLink = document.createElement('button');
      switchLink.type = 'button';
      switchLink.className = 'link-button';
      switchLink.textContent = 'Colar cifra completa manualmente';
      switchLink.addEventListener('click', () => switchImportTab('text'));
      elements.importFetchError.appendChild(message);
      elements.importFetchError.appendChild(switchLink);
      elements.importFetchError.hidden = false;
    } finally {
      elements.importUrlInput.disabled = false;
    }
  }

  function maybeAutoFetchImportUrl() {
    if (elements.importUrlInput.value.trim()) fetchImportFromUrl();
  }

  function openImport() {
    elements.importModal.hidden = false;
    switchImportTab('link');
    elements.importUrlInput.value = '';
    elements.importUrlInput.focus();
  }

  function closeImport() {
    elements.importModal.hidden = true;
    document.getElementById('importSongButton')?.focus();
  }

  function previewImport() {
    try {
      const parsed = parseImportedSong(elements.importContent.value);
      const source = elements.importSourceUrl?.value.trim() || '';
      if (!elements.importRights.checked) throw new Error('Confirme que você tem autorização para usar o conteúdo.');
      applyImportPreview(parsed, source);
    } catch (error) {
      elements.importPreview.textContent = error.message;
      elements.importPreview.hidden = false;
      elements.confirmImportButton.disabled = true;
    }
  }

  async function confirmImport() {
    const parsed = JSON.parse(elements.importModal.dataset.preview || 'null');
    if (!parsed || !await confirmDiscard()) return;
    state.selected = null;
    state.importSourceUrl = parsed.source;
    elements.title.value = parsed.title;
    elements.artist.value = parsed.artist;
    elements.bpm.value = '';
    definirCategoriaSelecionada('');

    const capo = Number(parsed.metadata?.capo) || 0;
    const aplicarCapo = capo > 0 && !elements.importCapoBox.hidden && elements.importAplicarCapo.checked;
    // Subir a cifra em `capo` semitons leva das formas para o tom que soa.
    const conteudo = aplicarCapo ? window.CifroChords.transposeHtml(parsed.content, capo) : parsed.content;

    setContent(plainTextToHtml(conteudo));
    elements.transposicao.value = aplicarCapo ? capo : 0;
    atualizarLegendaTransposicao();
    setDirty(true);
    updateDocumentTitle();
    closeImport();
    setStatus(
      aplicarCapo
        ? `Cifra importada no tom real, com capotraste ${capo}. Confira antes de salvar.`
        : 'Cifra importada para revisão. Confira o conteúdo antes de salvar.',
      'success'
    );
  }

  function cleanImportedHtml(rawHtml) {
    const preserveSpaces = html => {
      const wrap = document.createElement('div');
      wrap.innerHTML = String(html || '');
      const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        if (node.nodeValue) node.nodeValue = node.nodeValue.replace(/ {2,}/g, match => '\u00a0'.repeat(match.length - 1) + ' ');
      });
      return wrap.innerHTML;
    };

    const root = document.createElement('div');
    root.innerHTML = String(rawHtml || '');
    root.querySelectorAll('section.player, .cifra-column--right, script, style, iframe').forEach(element => element.remove());
    const pre = root.querySelector('pre');
    if (pre) {
      return preserveSpaces((pre.innerHTML || '')
        .replace(/class="js-modal-trigger"/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '<br/>')).trim();
    }

    root.querySelectorAll('div,p').forEach(element => {
      element.insertAdjacentHTML('beforebegin', element.innerHTML + '<br/>');
      element.remove();
    });

    return preserveSpaces(root.innerHTML
      .replace(/\u00a0/g, '&nbsp;')
      .replace(/<br\s*\/?>/gi, '<br/>')
      .replace(/<(?!\/?(?:b|strong|em|i|br|refrao|prerefrao|ponte|div)\b)[^>]+>/gi, '')
      .replace(/class="js-modal-trigger"/g, '')).trim();
  }

  function applySection(editor, tagName, label) {
    const range = editor.selection.getRng();
    const selection = document.createElement('div');
    selection.appendChild(range.cloneContents());
    preserveAlignmentSpacesIn(selection);
    const selected = selection.innerHTML;
    if (selected) {
      const normalised = selected.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br/>');
      editor.selection.setContent(`<${tagName}>${normalised}</${tagName}>`);
    } else {
      editor.insertContent(`<${tagName}>[${label}]<br/></${tagName}><br/>`);
    }
  }

  async function initialiseEditor() {
    if (!window.tinymce) {
      elements.editorError.hidden = false;
      elements.textarea.addEventListener('input', () => {
        detectDirty();
        scheduleKeyDetection();
      });
      setStatus('Editor visual indisponível. Usando edição em texto.', 'error');
      return;
    }

    const dark = (window.cifroTheme ? window.cifroTheme.get() : 'dark') !== 'light';
    try {
      tinymce.addI18n('pt_BR', {
        Undo: 'Desfazer',
        Redo: 'Refazer',
        Italic: 'Itálico',
        'Source code': 'Código-fonte',
        Cancel: 'Cancelar',
        Save: 'Salvar música'
      });
      const editors = await tinymce.init({
        selector: '#cifraInput',
        license_key: 'gpl',
        base_url: (window.APP_BASE || '') + '/src/vendor/tinymce',
        suffix: '.min',
        language: 'pt_BR',
        plugins: 'code',
        toolbar: 'undo redo | acordeBtn italic | versoBtn preRefraoBtn refraoBtn ponteBtn introBtn | code',
        toolbar_mode: 'wrap',
        menubar: false,
        branding: false,
        promotion: false,
        valid_elements: '*[*]',
        custom_elements: 'refrao,prerefrao,ponte,div,b',
        extended_valid_elements: 'refrao[*],prerefrao[*],ponte[*],div[*],b[*]',
        skin: dark ? 'oxide-dark' : 'oxide',
        content_css: false,
        content_style: `body { font-family: Consolas, "Courier New", monospace; font-size: 15px; white-space: pre-wrap; line-height: 1.6; ${dark ? 'background:#1c1c22;color:#f4f4f5' : 'background:#fff;color:#18181b'} } b, strong { color:${dark ? '#fb923c' : '#ea580c'} !important; } refrao { color:${dark ? '#00ff00' : '#008800'} !important;font-weight:bold;display:block } prerefrao { color:${dark ? '#00e5ff' : '#0088aa'} !important;font-weight:bold;display:block } ponte { color:${dark ? '#ff6b6b' : '#cc2222'} !important;display:block }`,
        resize: false,
        newline_behavior: 'linebreak',
        remove_trailing_brs: false,
        entity_encoding: 'raw',
        convert_fonts_to_spans: false,
        formats: {
          acorde: { inline: 'b' },
          refrao: { block: 'refrao', remove: 'all' },
          prerefrao: { block: 'prerefrao', remove: 'all' },
          ponte: { block: 'ponte', remove: 'all' }
        },
        setup(editor) {
          const addSectionButton = (name, label, tagName) => editor.ui.registry.addButton(name, {
            text: label,
            tooltip: `Marcar como ${label}`,
            onAction: () => applySection(editor, tagName, label)
          });

          addSectionButton('versoBtn', 'Verso', 'div');
          addSectionButton('preRefraoBtn', 'Pré-refrão', 'prerefrao');
          addSectionButton('refraoBtn', 'Refrão', 'refrao');
          addSectionButton('ponteBtn', 'Ponte', 'ponte');
          addSectionButton('introBtn', 'Intro', 'div');
          editor.ui.registry.addToggleButton('acordeBtn', {
            text: 'Acorde',
            tooltip: 'Marcar como acorde',
            onAction: () => editor.formatter.toggle('acorde'),
            onSetup: api => editor.formatter.formatChanged('acorde', state => api.setActive(state))
          });
          editor.on('change input undo redo', () => {
            detectDirty();
            scheduleKeyDetection();
          });
          editor.on('BeforeSetContent', event => {
            event.content = normaliseChordLineBreaks(preserveAlignmentSpaces(event.content)).replace(/<br\s*?>/g, '<br/>');
          });
          editor.on('PastePreProcess', event => {
            if (typeof event.content === 'string' && !event.content.includes('<')) event.content = plainTextToHtml(event.content);
            else if (typeof event.content === 'string') event.content = cleanImportedHtml(event.content);
          });
        }
      });
      state.editor = editors[0] || null;
      if (!state.editor) throw new Error('TinyMCE não inicializado');
    } catch (error) {
      if (window.tinymce) tinymce.remove('#cifraInput');
      elements.textarea.style.display = 'block';
      elements.editorError.hidden = false;
      elements.textarea.addEventListener('input', () => {
        detectDirty();
        scheduleKeyDetection();
      });
      setStatus('Editor visual indisponível. Usando edição em texto.', 'error');
    }
  }

  function activateMobilePanel(name) {
    document.querySelectorAll('[data-panel-name]').forEach(panel => panel.classList.toggle('is-mobile-active', panel.dataset.panelName === name));
    document.querySelectorAll('.editor-tab').forEach(tab => {
      const active = tab.dataset.panel === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function bindLayout() {
    document.querySelectorAll('.editor-tab').forEach(tab => tab.addEventListener('click', () => activateMobilePanel(tab.dataset.panel)));
    document.getElementById('collapseLibrary')?.addEventListener('click', () => elements.shell?.classList.add('library-collapsed'));
    document.getElementById('expandLibrary')?.addEventListener('click', () => elements.shell?.classList.remove('library-collapsed'));
    document.getElementById('toggleSongDetails')?.addEventListener('click', event => {
      const open = document.querySelector('.document-bar')?.classList.toggle('details-open') || false;
      event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  async function initialise() {
    bindLayout();
    activateMobilePanel('workspace');
    elements.search?.addEventListener('input', renderSongs);
    [elements.title, elements.artist, elements.bpm, elements.classification].filter(Boolean).forEach(input => input.addEventListener('input', detectDirty));
    elements.transposicao?.addEventListener('input', () => {
      atualizarLegendaTransposicao();
      detectDirty();
    });
    elements.sugerirTransposicao?.addEventListener('click', () => {
      const nivel = window.CIFRO_CONFIG?.transposicaoPreferencia === 'basico' ? 'basico' : 'simplificar';
      elements.transposicao.value = window.CifroChords.sugerirDeslocamento(getContent(), {
        instrumento: instrumentoDoUsuario(),
        nivel
      });
      atualizarLegendaTransposicao();
      detectDirty();
    });
    elements.key?.addEventListener('change', changeDefaultKey);
    document.getElementById('newSongButton')?.addEventListener('click', newSong);
    document.getElementById('newSongMenuButton')?.addEventListener('click', () => {
      document.getElementById('moreActions').open = false;
      newSong();
    });
    document.getElementById('previewButton')?.addEventListener('click', openPreview);
    document.getElementById('importSongButton')?.addEventListener('click', () => {
      document.getElementById('moreActions').open = false;
      openImport();
    });
    document.getElementById('cancelImportButton')?.addEventListener('click', closeImport);
    document.getElementById('previewImportButton')?.addEventListener('click', previewImport);
    elements.importTabLinkButton?.addEventListener('click', () => switchImportTab('link'));
    elements.importTabTextButton?.addEventListener('click', () => switchImportTab('text'));
    elements.importUrlInput?.addEventListener('blur', maybeAutoFetchImportUrl);
    elements.importUrlInput?.addEventListener('paste', () => setTimeout(maybeAutoFetchImportUrl, 0));
    elements.confirmImportButton?.addEventListener('click', confirmImport);
    elements.importRights?.addEventListener('change', () => {
      elements.confirmImportButton.disabled = !elements.importRights.checked || !elements.importModal.dataset.preview;
    });
    document.getElementById('closePreviewButton')?.addEventListener('click', closePreview);
    elements.saveButton?.addEventListener('click', saveSong);
    elements.deleteButton?.addEventListener('click', deleteSong);
    window.addEventListener('beforeunload', event => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && elements.previewModal?.classList.contains('is-open')) {
        closePreview();
        return;
      }
      if (event.key === 'Escape' && !elements.importModal?.hidden) {
        closeImport();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveSong();
      }
    });

    configurarCampoTransposicao();
    await Promise.all([initialiseEditor(), cifroSync.load(window.CIFRO_BAND_ID)]);
    renderCategories();
    renderSongs();
    setBaseline();
  }

  window.__cifroEditorReady = initialise();
})();
