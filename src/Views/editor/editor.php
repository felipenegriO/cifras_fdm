<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Editor de Cifras</title>
  <link href="/src/css/style2.css" rel="stylesheet">
  <style>
       pre{
            color:black !important;
        }
    .body {
      display: flex;
      gap: 20px;
      padding: 20px;
      font-family: sans-serif;
    }
    body{
        padding: 0px;
        margin: 0px;
    }
    #lista {
      width: 250px;
      border-right: 1px solid #ccc;
      height: 86vh;
      overflow: auto;
    }
    #editor, #preview {
      flex: 1;
    }
    textarea {
      width: 100%;
      height: 400px;
      font-family: monospace;
    }
    button {
      margin: 4px;
      color: white;
      background-color: #333;
    }
    a{
        color:black !important;
    };
    #preview {
      border: 1px solid #ccc;
      padding: 10px;
      background: #f9f9f9;
      height: 86vh;
      overflow: auto;
    }
    li {
      cursor: pointer;
    }
    .tox * {
      color: black !important;
    }
    refrao { color: green; font-weight: bold; }
    prerefrao { color: teal; font-weight: bold; }
    ponte { color: red; font-weight: bold; }
    .cifra {
      white-space: pre-wrap;
    }
     *{
      background-color: white !important;
      color: black !important;
    }
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
      <input type="text" id="buscaMusica" placeholder="🔍 Buscar..." oninput="carregarMusicas()" style="width: 90%; margin-bottom: 10px; padding: 5px;">
      <ul id="musicas"></ul>
    </div>
    
      <div id="editor">
        <button onclick="novaMusica()">Limpar</button>
        <button onclick="salvar()">💾 Salvar</button>
        <div style="display:ruby">
          <input id="titulo" placeholder="Nome da música" style="width: 70%;"><br><br>
          <input id="bit" type="number" placeholder="bit da musica" style="width: 20%;"><br><br>
          <input id="artista" type="text" placeholder="Artista" style="width: 45%;"><br><br>
          <select id="classificacao" style="width: 45%;">
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
  <script src="<?= asset_url('/src/js/musicas.js') ?>"></script>

  <script src="https://cdn.tiny.cloud/1/56uixiy3yc6tkjs0wqt9924yoehc5nhmyjo3tj0i9xtn0d0m/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>
  <script>
  tinymce.init({
    selector: '#cifraInput',
    plugins: 'code',
    toolbar: 'undo redo | bold italic | code | refraoBtn prerefraoBtn ponteBtn bBtn divBtn',
    valid_elements: '*[*]',
    custom_elements: 'refrao,prerefrao,ponte,b,div',
    extended_valid_elements: 'refrao[*],prerefrao[*],ponte[*],b[*],div[*]',
    content_style: `
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
      const createTagButton = (tagName) => {
        editor.ui.registry.addButton(tagName + 'Btn', {
          text: tagName,
          tooltip: `Envolver com <${tagName}>`,
          onAction: () => {
            const selectedContent = editor.selection.getContent({ format: 'html' });
            if (selectedContent) {
              editor.selection.setContent(`<${tagName}>${selectedContent}</${tagName}>`);
            } else {
              editor.insertContent(`<${tagName}><br/></${tagName}>`);
            }
          }
        });
      };

      createTagButton('refrao');
      createTagButton('prerefrao');
      createTagButton('ponte');
      createTagButton('b');
      createTagButton('div');

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
      debugger;
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

    function salvar() {
      const titulo = document.getElementById('titulo').value;
      let cifra = tinymce.get('cifraInput').getContent();
      debugger;
      
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
      
      cifra = tempDiv.innerHTML;
      
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
          document.getElementById('status').innerText = 'Salvo com sucesso!';
          selecionada.nome = titulo;
          selecionada.cifra = cifra;
          window.location.reload(); // atualizar lista
        } else {
          document.getElementById('status').innerText = 'Erro ao salvar!';
        }
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

    carregarMusicas();
  </script>
</body>
</html>
