<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
  <title>Editor de Cifras — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <link href="/src/css/style2.css" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: var(--bg-0); color: var(--text-1); }
    .body {
      display: flex;
      gap: 20px;
      padding: 20px;
      font-family: sans-serif;
    }
    #lista {
      width: 250px;
      border-right: 1px solid var(--border-1);
      height: 86vh;
      overflow: auto;
    }
    #editor, #preview { flex: 1; min-width: 0; }
    .editor-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }
    .editor-meta input,
    .editor-meta select {
      flex: 1 1 200px;
      min-height: 40px;
      padding: 6px 10px;
      box-sizing: border-box;
      background: var(--bg-2);
      color: var(--text-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
    }
    .editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .editor-actions button { min-height: 44px; padding: 0 14px; }
    textarea {
      width: 100%;
      height: 400px;
      font-family: monospace;
      background: var(--bg-2);
      color: var(--text-1);
      border: 1px solid var(--border-1);
    }
    @media (max-width: 900px) {
      .body { flex-direction: column; padding: 12px; gap: 12px; }
      #lista { width: 100%; height: auto; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border-1); padding-bottom: 8px; }
      #preview { height: auto; max-height: 50vh; }
      textarea { height: 280px; }
    }
    #preview {
      border: 1px solid var(--border-1);
      padding: 10px;
      background: var(--bg-1);
      height: 86vh;
      overflow: auto;
    }
    li { cursor: pointer; }
    refrao { color: var(--cifra-refrao); font-weight: bold; }
    prerefrao { color: var(--cifra-prerefrao); font-weight: bold; }
    ponte { color: var(--cifra-ponte); font-weight: bold; }
    .cifra { white-space: pre-wrap; font-family: monospace; }
    #livePreview * { white-space: inherit; }
    #tabs {
      margin-bottom: 20px;
    }
    #tabs a {
      margin-right: 10px;
      padding: 10px;
      color: black !important;
    }
    
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>
    <div class="body">
      <div id="lista">
      <h3>Músicas</h3>
      <input type="search" id="buscaMusica" placeholder="Buscar música..." oninput="carregarMusicas()" style="width: 100%; margin-bottom: 10px;" aria-label="Buscar música">
      <ul id="musicas"></ul>
    </div>
    
      <div id="editor">
        <div class="editor-actions">
          <button type="button" class="btn btn--secondary" onclick="novaMusica()"><?= fdm_icon('eraser', 16) ?> Limpar</button>
          <button type="button" class="btn btn--primary" onclick="salvar()"><?= fdm_icon('save', 16) ?> Salvar</button>
          <button type="button" class="btn btn--danger" onclick="excluirMusica()"><?= fdm_icon('trash', 16) ?> Excluir música</button>
        </div>
        <div class="editor-meta">
          <input id="titulo" placeholder="Nome da música" aria-label="Nome da música">
          <input id="bit" type="number" placeholder="BPM da música" aria-label="BPM da música" style="flex-basis:120px">
          <input id="artista" type="text" placeholder="Artista" aria-label="Artista">
          <select id="classificacao" aria-label="Classificação">
            <option value="">N/A</option>
            <option value="Louvor Animado">Louvor Animado</option>
            <option value="Marianas">Marianas</option>
            <option value="Oracionais">Oracionais</option>
            <option value="Adoração">Adoração</option>
            <option value="Missa">Missa</option>
          </select>
        </div>
        <textarea id="cifraInput"></textarea><br>
        <p id="status"></p>
      </div>
    
      <div id="preview">
        <h3>Preview</h3>
        <div id="livePreview" class="cifra"></div>
      </div>
    </div>
  <!-- Scripts -->
  <script src="/src/js/jquery-3.5.1.min.js"></script>
  <script>window.FDM_BAND_ID = '<?= e(current_band_id()) ?>';</script>
  <script src="<?= asset_url('/src/js/fdm-sync.js') ?>"></script>
  <script>document.addEventListener('DOMContentLoaded', () => fdmSync.load(window.FDM_BAND_ID));</script>
  <script src="/src/js/script.js" defer></script>

  <script src="https://cdn.tiny.cloud/1/56uixiy3yc6tkjs0wqt9924yoehc5nhmyjo3tj0i9xtn0d0m/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>
  <script>
  const _fdmIsDark = (window.fdmTheme ? window.fdmTheme.get() : 'dark') !== 'light';
  tinymce.init({
    selector: '#cifraInput',
    plugins: 'code',
    toolbar: 'undo redo | bold italic | code | colarPrepararBtn versoBtn preRefraoBtn refraoBtn ponteBtn introBtn limparCifraBtn',
    valid_elements: '*[*]',
    custom_elements: 'refrao,prerefrao,ponte,div,b',
    extended_valid_elements: 'refrao[*],prerefrao[*],ponte[*],div[*],b[*]',
    skin: _fdmIsDark ? 'oxide-dark' : 'oxide',
    content_css: false,
    content_style: (function() {
      const base = 'body { font-family: Consolas, "Courier New", monospace; font-size: 15px; white-space: pre-wrap; line-height: 1.6; }';
      const dark = 'body { background:#1c1c22; color:#f4f4f5; } b { color:#fb923c !important; } refrao { color:#00ff00 !important; font-weight:bold !important; display:block; } prerefrao { color:#00e5ff !important; font-weight:bold !important; display:block; } ponte { color:#ff6b6b !important; display:block; }';
      const light = 'body { background:#fff; color:#18181b; } b { color:#ea580c !important; } refrao { color:#008800 !important; font-weight:bold !important; display:block; } prerefrao { color:#0088aa !important; font-weight:bold !important; display:block; } ponte { color:#cc2222 !important; display:block; }';
      return base + (_fdmIsDark ? dark : light);
    })(),
    force_br_newlines: true,
    force_p_newlines: false,
    forced_root_block: false,
    remove_trailing_brs: false,
    entity_encoding: 'raw',
    convert_fonts_to_spans: false,
    formats: {
      refrao: { block: 'refrao', remove: 'all' },
      prerefrao: { block: 'prerefrao', remove: 'all' },
      ponte: { block: 'ponte', remove: 'all' }
    },
    inline: false,
    setup: (editor) => {
      const plainTextToHtml = (text) => {
        const escaped = String(text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        return escaped
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/ {2}/g, ' &nbsp;')
          .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
          .replace(/\n/g, '<br/>')
          .trim();
      };

      const cleanImportedHtml = (rawHtml) => {
        const preserveSpacesInTextNodes = (html) => {
          const wrap = document.createElement('div');
          wrap.innerHTML = String(html || '');
          const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
          const nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          nodes.forEach((node) => {
            if (!node.nodeValue) return;
            node.nodeValue = node.nodeValue.replace(/ {2,}/g, (m) => '\u00a0'.repeat(m.length - 1) + ' ');
          });
          return wrap.innerHTML;
        };

        const root = document.createElement('div');
        root.innerHTML = String(rawHtml || '');
        root.querySelectorAll('section.player, .cifra-column--right, script, style, iframe').forEach((el) => el.remove());
        const pre = root.querySelector('pre');
        if (pre) {
          let preHtml = pre.innerHTML || '';
          preHtml = preHtml.replace(/class="js-modal-trigger"/g, '');
          preHtml = preHtml.replace(/\r\n/g, '\n');
          preHtml = preHtml.replace(/\r/g, '\n');
          preHtml = preHtml.replace(/\n/g, '<br/>');
          return preserveSpacesInTextNodes(preHtml).trim();
        }

        root.querySelectorAll('div,p,span').forEach((el) => {
          const html = el.innerHTML;
          el.insertAdjacentHTML('beforebegin', html + '<br/>');
          el.remove();
        });

        let cleaned = root.innerHTML;
        cleaned = cleaned.replace(/\u00a0/g, '&nbsp;');
        cleaned = cleaned.replace(/<br\s*\/?>/gi, '<br/>');
        cleaned = cleaned.replace(/<(?!\/?(?:b|br|refrao|prerefrao|ponte|div)\b)[^>]+>/gi, '');
        cleaned = cleaned.replace(/class="js-modal-trigger"/g, '');
        return preserveSpacesInTextNodes(cleaned).trim();
      };

      const applySection = (tagName, label) => {
        const selectedContent = editor.selection.getContent({ format: 'html' });
        if (selectedContent) {
          const normalized = selectedContent.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br/>');
          editor.selection.setContent(`<${tagName}>${normalized}</${tagName}>`);
        } else {
          editor.insertContent(`<${tagName}>[${label}]<br/></${tagName}><br/>`);
        }
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

      createSectionButton('versoBtn', 'Verso', 'div');
      createSectionButton('preRefraoBtn', 'Pre-refrão', 'prerefrao');
      createSectionButton('refraoBtn', 'Refrão', 'refrao');
      createSectionButton('ponteBtn', 'Ponte', 'ponte');
      createSectionButton('introBtn', 'Intro', 'div');
      editor.ui.registry.addButton('limparCifraBtn', {
        text: 'limpar colagem',
        tooltip: 'Limpar HTML colado (Cifra Club)',
        onAction: () => {
          editor.setContent(cleanImportedHtml(editor.getContent()));
          atualizarPreview();
        }
      });
      editor.ui.registry.addButton('colarPrepararBtn', {
        text: 'colar e preparar',
        tooltip: 'Cole no editor e clique para limpar e preparar',
        onAction: () => {
          const cleaned = cleanImportedHtml(editor.getContent());
          if (!cleaned) {
            document.getElementById('status').innerText = 'Cole a cifra primeiro.';
            return;
          }
          editor.setContent('<div>[Verso]<br/></div><br/>' + cleaned);
          atualizarPreview();
          document.getElementById('status').innerText = 'Cifra preparada para marcação de blocos.';
        }
      });

      editor.on('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          editor.insertContent('<br/>');
        }
      });

      editor.on('change input undo redo', () => {
        atualizarPreview();
      });

      editor.on('BeforeSetContent', (e) => {
        e.content = e.content.replace(/  /g, '&nbsp; ');
        e.content = e.content.replace(/<br\s*?>/g, '<br/>');
      });

      editor.on('PastePreProcess', (e) => {
        if (typeof e.content === 'string' && e.content.indexOf('<') === -1) {
          e.content = plainTextToHtml(e.content);
          return;
        }

        if (typeof e.content === 'string' && /cifra-column|cifra_cnt|player--music|js-modal-trigger|<pre/i.test(e.content)) {
          e.content = cleanImportedHtml(e.content);
        }
      });
    }
  });

  </script>

  <script>
    let selecionada = null;

    function carregarMusicas() {
      const ul = document.getElementById('musicas');
      const filtro = document.getElementById('buscaMusica')?.value.toLowerCase() || '';
      ul.innerHTML = '';

      const ordenadas = [...songs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

      ordenadas
        .filter(m => m.nome.toLowerCase().includes(filtro))
        .forEach(m => {
          const li = document.createElement('li');
          li.textContent = m.nome;
          li.onclick = () => carregarEditor(m);
          ul.appendChild(li);
        });
    }


    function carregarEditor(song) {
      selecionada = song;
      document.getElementById('titulo').value = song.nome;
      document.getElementById('bit').value = song.bit;
      document.getElementById('artista').value = song.artista;
      document.getElementById('classificacao').value = song.classificacao;

      let cifra = song.cifra.trim();
      if (!cifra.startsWith('<p>')) cifra = '<p>' + cifra;
      if (!cifra.endsWith('</p>')) cifra += '</p>';
      cifra = cifra.replace("<br>","<br/>")
      tinymce.get('cifraInput').setContent(cifra);
      atualizarPreview();
    }

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

    function salvar() {
      const titulo = document.getElementById('titulo').value.trim();
      if (!titulo) {
        document.getElementById('status').innerText = 'Digite o nome da música.';
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
      cifra = cifra.trim();

      if (!cifra || !cifra.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').replace(/\s+/g, '')) {
        document.getElementById('status').innerText = 'A cifra está vazia.';
        return;
      }

      if (/(cifra-column|player--music|player-core|cifra_cnt|js-pl-v)/i.test(cifra)) {
        document.getElementById('status').innerText = 'Use "limpar colagem" antes de salvar.';
        return;
      }
      
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
          classificacao : document.getElementById('classificacao').value,
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (data.id) {
            if (!selecionada) selecionada = {};
            selecionada.id = data.id;
          }
          document.getElementById('status').innerText = 'Salvo com sucesso!';
          window.fdmToast && fdmToast('Música salva com sucesso!', 'success');
          if (!selecionada.nome) selecionada.nome = titulo;
          selecionada.nome = titulo;
          selecionada.cifra = cifra;

          if (!data.created) {
            return;
          }

          window.location.reload();
        } else {
          document.getElementById('status').innerText = 'Erro ao salvar!';
          window.fdmToast && fdmToast(data.error || 'Erro ao salvar a música.', 'error');
        }
      })
      .catch(() => {
        window.fdmToast && fdmToast('Falha de rede ao salvar.', 'error');
      });
    }

    function novaMusica() {
      selecionada = null;
      document.getElementById('titulo').value = '';
      document.getElementById('bit').value = '';
      document.getElementById('artista').value = '',
      document.getElementById('classificacao').value = '',
      tinymce.get('cifraInput').setContent('');
      atualizarPreview();
    }

    async function excluirMusica() {
      if (!selecionada || !selecionada.id) {
        document.getElementById('status').innerText = 'Selecione uma música para excluir.';
        return;
      }

      const nome = selecionada.nome || 'esta música';
      const confirmou = await fdmConfirm({
        title: 'Excluir música',
        message: 'A música <strong>' + nome.replace(/[<>&]/g, '') + '</strong> será removida permanentemente para todos os usuários. Esta ação não pode ser desfeita.',
        confirmText: 'Sim, excluir',
        cancelText: 'Cancelar',
        danger: true
      });
      if (!confirmou) return;

      fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: selecionada.id
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          document.getElementById('status').innerText = 'Música excluída com sucesso!';
          window.location.reload();
        } else {
          document.getElementById('status').innerText = data.error || 'Erro ao excluir música.';
        }
      })
      .catch(() => {
        document.getElementById('status').innerText = 'Falha de rede ao excluir música.';
      });
    }

    carregarMusicas();
  </script>
</body>
</html>
