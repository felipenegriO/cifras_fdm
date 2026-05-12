<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Editor de Cifras</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="/src/css/style2.css" rel="stylesheet">
  <style>
    * { background-color: white !important; color: black !important; }
    body { padding: 0; margin: 0; font-family: sans-serif; }

    .app {
      display: grid;
      grid-template-columns: 280px 1fr 1fr;
      gap: 12px;
      padding: 12px;
      height: calc(100vh - 60px);
      box-sizing: border-box;
    }

    /* Sidebar */
    #lista {
      border-right: 1px solid #ddd;
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    #listaHeader {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
      margin-bottom: 8px;
    }
    #listaHeader h3 { margin: 0; font-size: 16px; }
    #buscaMusica {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-sizing: border-box;
      outline: none;
    }
    #buscaMusica:focus { border-color: #333; }

    #musicas {
      list-style: none;
      padding: 0;
      margin: 10px 0 0 0;
      overflow: auto;
      flex: 1;
    }
    #musicas li {
      padding: 10px 10px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      border-radius: 8px;
      margin: 2px 0;
      user-select: none;
    }
    #musicas li:hover { background: #f4f4f4 !important; }
    #musicas li.active {
      background: #e9f2ff !important;
      border: 1px solid #b7d4ff;
    }

    /* Editor */
    #editor, #preview {
      height: 100%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .toolbarTop {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      border: 1px solid #eee;
      padding: 10px;
      border-radius: 10px;
      background: #fafafa !important;
    }

    .toolbarTop .left,
    .toolbarTop .right {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .spacer { flex: 1; }

    button {
      margin: 0;
      color: white !important;
      background-color: #333 !important;
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary {
      background-color: #666 !important;
    }
    button.good {
      background-color: #1f7a3f !important;
    }
    button:disabled {
      opacity: .55;
      cursor: not-allowed;
    }

    input, select {
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 10px;
      outline: none;
      box-sizing: border-box;
    }
    input:focus, select:focus { border-color: #333; }

    .fields {
      display: grid;
      grid-template-columns: 1.4fr .6fr 1fr 1fr;
      gap: 8px;
    }

    #preview {
      border: 1px solid #ddd;
      border-radius: 10px;
      overflow: hidden;
    }
    #previewHeader {
      padding: 10px;
      border-bottom: 1px solid #eee;
      background: #fafafa !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #livePreview {
      padding: 10px;
      overflow: auto;
      height: 100%;
      background: #f9f9f9 !important;
    }

    /* Tags preview */
    refrao { color: green !important; font-weight: bold; }
    prerefrao { color: teal !important; font-weight: bold; }
    ponte { color: red !important; font-weight: bold; font-weight: unset; }
    b { color: #f70 !important; }

    /* Toast */
    #toastMsg {
      position: fixed;
      right: 18px;
      bottom: 18px;
      background: #111 !important;
      color: #fff !important;
      padding: 12px 14px;
      border-radius: 12px;
      box-shadow: 0 10px 26px rgba(0,0,0,.18);
      display: none;
      z-index: 9999;
      max-width: 360px;
      font-size: 14px;
    }

    .badgeDirty {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid #ffd6a5;
      background: #fff3e6 !important;
      font-size: 12px;
      font-weight: 700;
    }

    /* Modes */
    .mode-editor-only #preview { display: none; }
    .mode-editor-only { grid-template-columns: 280px 1fr; }

    /* Responsive */
    @media (max-width: 980px) {
      .app { grid-template-columns: 260px 1fr; }
      #preview { display: none; }
    }
    @media (max-width: 680px) {
      .app { grid-template-columns: 1fr; }
      #lista { border-right: none; border-bottom: 1px solid #ddd; height: 40vh; }
      #editor { height: auto; }
    }
  </style>
  
  <script src="<?= asset_url('/src/js/musicas.js') ?>"></script>

</head>

<body>
  <?php render_partial('topnav'); ?>
  <?php render_partial('topnav'); ?>

  <div id="toastMsg"></div>

  <div id="app" class="app mode-split">
    <!-- Sidebar -->
    <div id="lista">
      <div id="listaHeader">
        <h3>Músicas</h3>
        <button class="secondary" id="btnToggleLayout" type="button" title="Alternar layout">🪟</button>
      </div>

      <input type="text" id="buscaMusica" placeholder="🔍 Buscar..." />

      <ul id="musicas"></ul>
    </div>

    <!-- Editor -->
    <div id="editor">
      <div class="toolbarTop">
        <div class="left">
          <button class="secondary" type="button" id="btnNova">Limpar</button>
          <button class="good" type="button" id="btnSalvar">💾 Salvar (Ctrl+S)</button>
          <span id="dirtyBadge" style="display:none" class="badgeDirty">⚠️ Alterações não salvas</span>
        </div>

        <div class="spacer"></div>

        <div class="right">
          <button class="secondary" type="button" id="btnPrevSong" title="Anterior (↑)">⬆️</button>
          <button class="secondary" type="button" id="btnNextSong" title="Próxima (↓)">⬇️</button>
        </div>
      </div>

      <div class="fields">
        <input id="titulo" placeholder="Nome da música">
        <input id="bit" type="number" placeholder="BPM">
        <input id="artista" type="text" placeholder="Artista">
        <select id="classificacao">
          <option value="">N/A</option>
          <option value="Louvor Animado">Louvor Animado</option>
          <option value="Marianas">Marianas</option>
          <option value="Oracionais">Oracionais</option>
          <option value="Adoração">Adoração</option>
          <option value="Missa">Missa</option>
        </select>
      </div>

      <textarea id="cifraInput"></textarea>

      <p id="status" style="margin:0;"></p>
    </div>

    <!-- Preview -->
    <div id="preview">
      <div id="previewHeader">
        <strong>Preview</strong>
        <div style="display:flex; gap:8px;">
          <button class="secondary" type="button" id="btnScrollSync" title="Sincronizar rolagem (beta)">🔗</button>
        </div>
      </div>
      <div id="livePreview" class="cifra"></div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="/src/js/jquery-3.5.1.min.js"></script>

  <script src="https://cdn.tiny.cloud/1/56uixiy3yc6tkjs0wqt9924yoehc5nhmyjo3tj0i9xtn0d0m/tinymce/7/tinymce.min.js"
    referrerpolicy="origin"></script>

  <script>
    // =========================
    // UX helpers
    // =========================
    const toast = (msg, ms = 1800) => {
      const el = document.getElementById('toastMsg');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastT);
      window.__toastT = setTimeout(() => el.style.display = 'none', ms);
    };

    let selecionada = null;
    let dirty = false;
    let activeIndex = -1; // índice na lista ordenada e filtrada
    let currentList = []; // lista filtrada e ordenada atual

    function setDirty(v) {
      dirty = v;
      document.getElementById('dirtyBadge').style.display = dirty ? 'inline-flex' : 'none';
      document.getElementById('btnSalvar').disabled = !dirty;
    }

    function confirmLoseChanges() {
      if (!dirty) return true;
      return confirm('Você tem alterações não salvas. Quer descartar e continuar?');
    }

    // Bloqueia fechar página se tiver alterações
    window.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  </script>

  <script>
    tinymce.init({
      selector: '#cifraInput',
      plugins: 'code searchreplace',
      toolbar: 'undo redo | bold italic | code | versoBtn preRefraoBtn refraoBtn ponteBtn introBtn limparCifraBtn | removeformat',
      valid_elements: '*[*]',
      custom_elements: 'refrao,prerefrao,ponte,div,b',
      extended_valid_elements: 'refrao[*],prerefrao[*],ponte[*],div[*],b[*]',
      height: '66vh',
      content_style: `
        body { font-family: monospace; font-size: 14px; }
        b { color: #f70 !important; }
        refrao { color: green !important; font-weight: bold !important; display: block; }
        prerefrao { color: teal !important; font-weight: bold !important; display: block; }
        ponte { color: red !important; display: block; }
      `,
      force_br_newlines: true,
      force_p_newlines: false,
      forced_root_block: false,
      remove_trailing_brs: false,
      entity_encoding: 'raw',
      convert_fonts_to_spans: false,
      formats: {
        // Previne conversão de tags customizadas em spans
        refrao: { block: 'refrao', remove: 'all' },
        prerefrao: { block: 'prerefrao', remove: 'all' },
        ponte: { block: 'ponte', remove: 'all' }
      },
      inline: false,
      content_css: false,
      setup: (editor) => {
        const cleanImportedHtml = (rawHtml) => {
          const root = document.createElement('div');
          root.innerHTML = String(rawHtml || '');

          root.querySelectorAll('section.player, .cifra-column--right, script, style, iframe').forEach((el) => el.remove());

          const pre = root.querySelector('pre');
          if (pre) {
            const onlyPre = document.createElement('div');
            onlyPre.innerHTML = pre.innerHTML;
            root.innerHTML = onlyPre.innerHTML;
          }

          root.querySelectorAll('[class]').forEach((el) => {
            if (el.tagName.toLowerCase() !== 'b') {
              el.removeAttribute('class');
            }
          });

          root.querySelectorAll('div,p,span').forEach((el) => {
            if (el.tagName.toLowerCase() === 'span' && /^#?ff7700$/i.test((el.style.color || '').replace(/\s+/g, ''))) {
              const b = document.createElement('b');
              b.innerHTML = el.innerHTML;
              el.replaceWith(b);
              return;
            }
            const html = el.innerHTML;
            el.insertAdjacentHTML('beforebegin', html + '<br/>');
            el.remove();
          });

          let cleaned = root.innerHTML;
          cleaned = cleaned.replace(/\u00a0/g, '&nbsp;');
          cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
          cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
          cleaned = cleaned.replace(/\n/g, '<br/>');
          cleaned = cleaned.replace(/<(?!\/?(?:b|br|refrao|prerefrao|ponte|div)\b)[^>]+>/gi, '');
          cleaned = cleaned.replace(/class="js-modal-trigger"/g, '');
          return cleaned.trim();
        };

        const applySection = (tagName, label) => {
          const selectedContent = editor.selection.getContent({ format: 'html' });
          if (selectedContent) {
            const normalized = selectedContent.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br/>');
            editor.selection.setContent(`<${tagName}>${normalized}</${tagName}>`);
          } else {
            editor.insertContent(`<${tagName}>[${label}]<br/></${tagName}><br/>`);
          }
          setDirty(true);
        };

        const createSectionButton = (btnName, label, tagName) => {
          editor.ui.registry.addButton(btnName, {
            text: label,
            tooltip: `Marcar como ${label}`,
            onAction: () => {
              applySection(tagName, label);
            }
          });
        };

        editor.ui.registry.addButton('limparCifraBtn', {
          text: 'limpar colagem',
          tooltip: 'Limpar HTML colado (Cifra Club)',
          onAction: () => {
            const current = editor.getContent();
            const cleaned = cleanImportedHtml(current);
            editor.setContent(cleaned);
            atualizarPreview();
            setDirty(true);
            toast('Colagem limpa e normalizada');
          }
        });

        createSectionButton('versoBtn', 'Verso', 'div');
        createSectionButton('preRefraoBtn', 'Pre-refrão', 'prerefrao');
        createSectionButton('refraoBtn', 'Refrão', 'refrao');
        createSectionButton('ponteBtn', 'Ponte', 'ponte');
        createSectionButton('introBtn', 'Intro', 'div');

        editor.on('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editor.insertContent('<br/>');
            setDirty(true);
          }
        });

        const onAnyChange = () => {
          atualizarPreview();
          setDirty(true);
        };

        editor.on('change input undo redo', onAnyChange);

        editor.on('BeforeSetContent', (e) => {
          e.content = e.content.replace(/  /g, '&nbsp; ');
          e.content = e.content.replace(/<br\s*?>/g, '<br/>');
        });

        editor.on('PastePreProcess', (e) => {
          if (typeof e.content === 'string' && /cifra-column|cifra_cnt|player--music|js-modal-trigger|<pre/i.test(e.content)) {
            e.content = cleanImportedHtml(e.content);
          }
        });

        editor.on('init', () => {
          atualizarPreview();
          setDirty(false);
        });
      }
    });
  </script>

  <script>
    function atualizarPreview() {
      const raw = tinymce.get('cifraInput').getContent();
      document.getElementById('livePreview').innerHTML = raw;
    }

    function normalizarCifraParaSalvar(cifra) {
      const notas = /^(?:[A-G](?:#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-G](?:#|b)?)?)$/i;
      const container = document.createElement('div');
      container.innerHTML = cifra;

      container.querySelectorAll('b').forEach(b => {
        const texto = (b.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!texto) {
          b.remove();
          return;
        }

        const tokens = texto.split(/\s+/).filter(Boolean);
        const soAcordes = tokens.length > 0 && tokens.every(token => notas.test(token.replace(/[.,;:!?]/g, '')));
        if (soAcordes) {
          b.textContent = tokens.join(' ');
          b.removeAttribute('style');
          b.removeAttribute('class');
        }
      });

      return container.innerHTML;
    }

    function highlightSelected() {
      const lis = document.querySelectorAll('#musicas li');
      lis.forEach(li => li.classList.remove('active'));
      const active = document.querySelector(`#musicas li[data-index="${activeIndex}"]`);
      if (active) active.classList.add('active');
    }

    function carregarMusicas() {
      const ul = document.getElementById('musicas');
      const filtro = (document.getElementById('buscaMusica')?.value || '').toLowerCase().trim();
      ul.innerHTML = '';

      const ordenadas = [...songs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

      currentList = ordenadas.filter(m => m.nome.toLowerCase().includes(filtro));

      currentList.forEach((m, idx) => {
        const li = document.createElement('li');
        li.textContent = m.nome;
        li.dataset.index = idx;

        li.onclick = () => {
          if (!confirmLoseChanges()) return;
          activeIndex = idx;
          carregarEditor(m);
          highlightSelected();
          li.scrollIntoView({ block: 'nearest' });
        };

        ul.appendChild(li);
      });

      // manter selecionada ativa se ainda existir na lista filtrada
      if (selecionada) {
        const found = currentList.findIndex(x => x.id === selecionada.id);
        activeIndex = found;
      } else {
        activeIndex = -1;
      }

      highlightSelected();
    }

    function carregarEditor(song) {
      selecionada = song;

      document.getElementById('titulo').value = song.nome || '';
      document.getElementById('bit').value = song.bit || '';
      document.getElementById('artista').value = song.artista || '';
      document.getElementById('classificacao').value = song.classificacao || '';

      let cifra = (song.cifra || '').trim();
      if (cifra && !cifra.startsWith('<p>')) cifra = '<p>' + cifra;
      if (cifra && !cifra.endsWith('</p>')) cifra += '</p>';
      cifra = cifra.replace(/<br>/g, "<br/>");

      tinymce.get('cifraInput').setContent(cifra || '');
      atualizarPreview();
      setDirty(false);
      toast('Carregada: ' + (song.nome || ''));
    }

    function salvar() {
      const titulo = document.getElementById('titulo').value.trim();
      if (!titulo) {
        toast('Digite o nome da música.');
        return;
      }

      let cifra = tinymce.get('cifraInput').getContent();

      // Limpeza completa e robusta de spans indesejados
      // 1. Remove spans vazios ou com atributos malformados
      cifra = cifra.replace(/<span[^>]*?>\s*<\/span>/g, "");
      
      // 2. Remove todos os spans, EXCETO os com color: #ff7700 (acordes laranja)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cifra;
      
      // Processa todos os spans
      const spans = tempDiv.querySelectorAll('span');
      spans.forEach(span => {
        const style = span.getAttribute('style');
        // Mantém apenas spans com cor laranja #ff7700 (acordes)
        if (style && style.includes('#ff7700')) {
          // Limpa o style mantendo só a cor
          span.setAttribute('style', 'color: #ff7700;');
        } else {
          // Remove o span mantendo o conteúdo
          const content = span.innerHTML;
          const textNode = document.createTextNode('');
          span.parentNode.insertBefore(textNode, span);
          span.insertAdjacentHTML('beforebegin', content);
          span.remove();
        }
      });
      
      cifra = normalizarCifraParaSalvar(tempDiv.innerHTML);
      
      // 3. Limpeza adicional de atributos desnecessários
      cifra = cifra.replace(/class="js-modal-trigger"/g, "");
      cifra = cifra.replace(/ class=""/g, "");
      cifra = cifra.replace(/ style=""/g, "");
      cifra = cifra.replace(/\n/g, "<br />");

      fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selecionada?.id,
          nome: titulo,
          cifra: cifra,
          bit: document.getElementById('bit').value,
          artista: document.getElementById('artista').value,
          classificacao: document.getElementById('classificacao').value,
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            document.getElementById('status').innerText = 'Salvo com sucesso!';
            toast('✅ Salvo!');
            setDirty(false);

            if (selecionada) {
              selecionada.nome = titulo;
              selecionada.cifra = cifra;
              selecionada.bit = document.getElementById('bit').value;
              selecionada.artista = document.getElementById('artista').value;
              selecionada.classificacao = document.getElementById('classificacao').value;
            }

            // Atualiza lista (sem reload total)
            carregarMusicas();
          } else {
            document.getElementById('status').innerText = 'Erro ao salvar!';
            toast('❌ Erro ao salvar');
          }
        })
        .catch(() => toast('❌ Falha de rede ao salvar'));
    }

    function novaMusica() {
      if (!confirmLoseChanges()) return;

      selecionada = null;
      activeIndex = -1;
      document.getElementById('titulo').value = '';
      document.getElementById('bit').value = '';
      document.getElementById('artista').value = '';
      document.getElementById('classificacao').value = '';
      tinymce.get('cifraInput').setContent('');
      atualizarPreview();
      setDirty(false);
      highlightSelected();
      toast('Editor limpo');
    }

    // =========================
    // Ações / atalhos
    // =========================
    document.getElementById('btnSalvar').addEventListener('click', salvar);
    document.getElementById('btnNova').addEventListener('click', novaMusica);

    document.getElementById('buscaMusica').addEventListener('input', () => {
      carregarMusicas();
    });

    // Ctrl+S
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvar();
      }

      // Navegar na lista com teclado (quando foco NÃO está no editor do TinyMCE)
      const isInsideTiny = !!document.activeElement?.closest('.tox');
      if (isInsideTiny) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Enter') {
        // abre a selecionada
        if (activeIndex >= 0 && currentList[activeIndex]) {
          if (!confirmLoseChanges()) return;
          carregarEditor(currentList[activeIndex]);
          highlightSelected();
        }
      }
    });

    function goNext() {
      if (!currentList.length) return;
      const next = Math.min(currentList.length - 1, (activeIndex < 0 ? 0 : activeIndex + 1));
      activeIndex = next;
      highlightSelected();
      const li = document.querySelector(`#musicas li[data-index="${activeIndex}"]`);
      li?.scrollIntoView({ block: 'nearest' });
    }

    function goPrev() {
      if (!currentList.length) return;
      const prev = Math.max(0, (activeIndex < 0 ? 0 : activeIndex - 1));
      activeIndex = prev;
      highlightSelected();
      const li = document.querySelector(`#musicas li[data-index="${activeIndex}"]`);
      li?.scrollIntoView({ block: 'nearest' });
    }

    document.getElementById('btnNextSong').addEventListener('click', goNext);
    document.getElementById('btnPrevSong').addEventListener('click', goPrev);

    // Alternar layout split / editor-only
    document.getElementById('btnToggleLayout').addEventListener('click', () => {
      const app = document.getElementById('app');
      app.classList.toggle('mode-editor-only');
      toast(app.classList.contains('mode-editor-only') ? 'Modo: só editor' : 'Modo: editor + preview');
    });

    // Scroll sync (bem simples)
    let scrollSyncOn = false;
    document.getElementById('btnScrollSync').addEventListener('click', () => {
      scrollSyncOn = !scrollSyncOn;
      toast(scrollSyncOn ? '🔗 Sync ligado (beta)' : '🔗 Sync desligado');
    });

    // =========================
    // Init
    // =========================
    carregarMusicas();
  </script>
</body>
</html>
