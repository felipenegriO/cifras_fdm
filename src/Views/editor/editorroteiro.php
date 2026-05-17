<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
  <title>Editor de Roteiros</title>
  <link href="/src/css/style2.css" rel="stylesheet">
  <style>
    body{
      padding: 0;
      margin: 0;
    }
    .body {
      display: flex;
      gap: 20px;
      padding: 20px;
      font-family: sans-serif;
    }
    #lista {
      width: 260px;
      border-right: 1px solid #ccc;
      height: 86vh;
      overflow: auto;
    }
    #editor, #preview {
      flex: 1;
      min-width: 0;
    }
    button {
      margin: 4px;
      color: white;
      background-color: #333;
    }
    #preview {
      border: 1px solid #ccc;
      padding: 10px;
      background: #f9f9f9;
      height: 86vh;
      overflow: auto;
    }
    #preview a {
      font-size: inherit;
    }
    li {
      cursor: pointer;
    }
    .tox * {
      color: black !important;
    }
    * {
      background-color: white !important;
      color: black !important;
    }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>
  <div class="body">
    <div id="lista">
      <h3>Roteiros</h3>
      <input type="text" id="buscaRoteiro" placeholder="🔍 Buscar..." oninput="carregarRoteiros()" style="width: 90%; margin-bottom: 10px; padding: 5px;">
      <ul id="roteiros"></ul>
    </div>

    <div id="editor">
      <button onclick="novoRoteiro()">Limpar</button>
      <button onclick="salvarRoteiro()">💾 Salvar</button>
      <button onclick="deletarRoteiro()" style="background:#c44;">🗑️ Deletar</button>
      <button onclick="abrirModalMusicas()" style="background:#1f7a3f;">🎵 Inserir musica</button>
      <div style="display:ruby">
        <input id="titulo" placeholder="Titulo do roteiro" style="width: 100%;"><br><br>
        <input id="visivelAte" type="date" style="width: 100%;"><br><br>
      </div>
      <textarea id="roteiroInput"></textarea><br>
      <p id="status"></p>
    </div>

    <div id="preview">
      <h3>Preview</h3>
      <div id="livePreview"></div>
    </div>
  </div>

  <script src="/src/js/jquery-3.5.1.min.js"></script>
  <script src="<?= asset_url('/src/js/musicas.js') ?>"></script>
  <script src="<?= asset_url('/src/js/roteiros_salvos.js') ?>"></script>

  <script src="https://cdn.tiny.cloud/1/56uixiy3yc6tkjs0wqt9924yoehc5nhmyjo3tj0i9xtn0d0m/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>
  <script>
    tinymce.init({
      selector: '#roteiroInput',
    plugins: 'code link',
  toolbar: 'undo redo | bold italic underline | link | code',

  valid_elements: '*[*]',

  skin: 'oxide-dark',
  content_css: 'dark',

  content_style: `
    body { background:#000; color:#fff; }
    a { color:#8fd3ff; text-decoration:underline; font-size:inherit; }
  `,

  force_br_newlines: false,
  force_p_newlines: false,
  forced_root_block: false,
  remove_trailing_brs: false,

  entity_encoding: 'raw',
  convert_fonts_to_spans: false,
  inline: false,
      setup: (editor) => {
        editor.on('change input undo redo', () => {
          atualizarPreview();
        });
        editor.on('BeforeSetContent', (e) => {
          e.content = e.content.replace(/  /g, '&nbsp; ');
          e.content = e.content.replace(/<br\s*?>/g, '<br/>');
        });
      }
    });
  </script>

  <script>
    let selecionado = null;

    function carregarRoteiros() {
      const ul = document.getElementById('roteiros');
      const filtro = document.getElementById('buscaRoteiro')?.value.toLowerCase() || '';
      ul.innerHTML = '';

      const ordenados = [...roteirosSalvos].sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR', { sensitivity: 'base' }));

      ordenados
        .filter(r => (r.titulo || '').toLowerCase().includes(filtro))
        .forEach(r => {
          const li = document.createElement('li');
          li.textContent = r.titulo || 'Roteiro';
          li.onclick = () => carregarEditor(r);
          ul.appendChild(li);
        });
    }

    function carregarEditor(roteiro) {
      selecionado = roteiro;
      document.getElementById('titulo').value = roteiro.titulo || '';
      document.getElementById('visivelAte').value = roteiro.visivel_ate || '';
      let conteudo = (roteiro.conteudo || '').trim();
      if (conteudo && !/<[^>]+>/.test(conteudo)) {
        conteudo = '<p>' + conteudo + '</p>';
      }
      tinymce.get('roteiroInput').setContent(conteudo);
      atualizarPreview();
    }

    function atualizarPreview() {
      const raw = tinymce.get('roteiroInput').getContent();
      document.getElementById('livePreview').innerHTML = normalizeRoteiroHtml(raw);
    }

    function novoRoteiro() {
      selecionado = null;
      document.getElementById('titulo').value = '';
      document.getElementById('visivelAte').value = '';
      tinymce.get('roteiroInput').setContent('');
      document.getElementById('status').innerText = '';
      atualizarPreview();
    }

    async function salvarRoteiro() {
      if (!navigator.onLine) {
        alert('Sem internet: nao e possivel salvar agora. Conecte-se para salvar.');
        return;
      }
      const titulo = document.getElementById('titulo').value.trim();
      const visivelAte = document.getElementById('visivelAte').value || '';
      const conteudo = normalizeRoteiroHtml(tinymce.get('roteiroInput').getContent());
      if (!titulo) {
        alert('Informe um titulo.');
        return;
      }

      const payload = {
        id: selecionado?.id,
        titulo: titulo,
        visivel_ate: visivelAte,
        conteudo: conteudo
      };

      const res = await fetch('salvar_roteiros.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('status').innerText = 'Salvo com sucesso!';
        window.location.reload();
      } else {
        document.getElementById('status').innerText = data.error || 'Erro ao salvar!';
      }
    }

    async function deletarRoteiro() {
      if (!selecionado) {
        alert('Selecione um roteiro para deletar.');
        return;
      }
      if (!confirm('Tem certeza que deseja deletar?')) return;

      const res = await fetch('salvar_roteiros.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteId: selecionado.id })
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('status').innerText = 'Deletado com sucesso!';
        window.location.reload();
      } else {
        document.getElementById('status').innerText = data.error || 'Erro ao deletar!';
      }
    }

    function abrirModalMusicas() {
      const modal = document.getElementById('modalMusicas');
      if (!modal) return;
      modal.style.display = 'block';
      montarListaMusicas();
    }

    function fecharModalMusicas() {
      const modal = document.getElementById('modalMusicas');
      if (!modal) return;
      modal.style.display = 'none';
    }

    function montarListaMusicas() {
      const lista = document.getElementById('listaMusicasModal');
      const filtro = (document.getElementById('filtroMusicasModal')?.value || '').toLowerCase();
      if (!lista || typeof songs === 'undefined') return;

      lista.innerHTML = '';
      const ordenadas = [...songs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

      ordenadas
        .filter(m => (m.nome || '').toLowerCase().includes(filtro))
        .forEach(m => {
          const li = document.createElement('li');
          li.textContent = m.nome;
          li.onclick = () => inserirMusicaNoRoteiro(m);
          lista.appendChild(li);
        });
    }

    function inserirMusicaNoRoteiro(musica) {
      if (!musica || !musica.id) return;
      const editor = tinymce.get('roteiroInput');
      if (!editor) return;
      const link = `<a href="music.php?id=${musica.id}">${musica.nome}</a>`;
      editor.insertContent(link);
      atualizarPreview();
      fecharModalMusicas();
    }

    document.addEventListener('click', function (event) {
      const modal = document.getElementById('modalMusicas');
      if (!modal || modal.style.display !== 'block') return;
      if (event.target === modal) {
        fecharModalMusicas();
      }
    });

    document.getElementById('filtroMusicasModal')?.addEventListener('input', montarListaMusicas);

    carregarRoteiros();

    function normalizeRoteiroHtml(html) {
      let out = String(html || '');
      out = out.replace(/\r?\n/g, '');
      out = out.replace(/<br\s*?>/g, '<br/>');
      out = out.replace(/<p>(?:\s|&nbsp;|<br\/>)*<\/p>/gi, '');
      out = out.replace(/(<br\/>\s*){2,}/g, '<br/>');
      out = out.replace(/^(<br\/>\s*)+|(<br\/>\s*)+$/g, '');

      if (!out.trim()) return '';
      if (!out.trim().startsWith('<')) {
        out = '<p>' + out + '</p>';
      }

      return out;
    }
  </script>

  <div id="modalMusicas" style="display:none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2000;">
    <div style="background: #fff; color: #000; width: 90%; max-width: 520px; margin: 8vh auto; border-radius: 8px; padding: 16px;">
      <div style="display:flex; justify-content: space-between; align-items: center;">
        <h3 style="margin:0;">Selecionar musica</h3>
        <button onclick="fecharModalMusicas()">×</button>
      </div>
      <input type="text" id="filtroMusicasModal" placeholder="Pesquisar musica..." style="width: 100%; margin: 12px 0; padding: 8px;">
      <ul id="listaMusicasModal" style="list-style: none; padding: 0; margin: 0; max-height: 60vh; overflow: auto;"></ul>
    </div>
  </div>
</body>
</html>
