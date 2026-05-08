<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cadastro de Usuários</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: sans-serif; padding: 0; margin: 0; }
    .body { padding: 20px; display: flex; gap: 20px; flex-wrap: wrap; }

    .card {
      border: 1px solid #ccc;
      padding: 14px;
      border-radius: 10px;
      min-width: 320px;
      max-width: 520px;
      flex: 1;
    }

    label { display:block; margin-top: 10px; font-weight: 600; }
    input, select {
      width: 100%;
      height: 36px;
      padding: 6px 10px;
      margin-top: 6px;
      box-sizing: border-box;
    }

    button { margin-right: 10px; padding: 8px 12px; cursor: pointer; }

    ul { list-style: none; padding: 0; margin: 0; }
    li { cursor: pointer; padding: 8px 10px; border-bottom: 1px solid #ccc; display:flex; justify-content:space-between; gap:10px; }
    li:hover { background: #f2f2f2; }
    .tag { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid #999; }

    .row { display:flex; gap:10px; }
    .row > div { flex: 1; }

    .muted { opacity: .7; font-size: 12px; margin-top: 6px; }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>

  <div class="body">

    <div class="card" style="max-width:420px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button onclick="criarNovoUsuario()">➕ Novo Usuário</button>
      </div>

      <div style="margin-top:14px;">
        <label>Filtrar:</label>
        <input id="filtroUsuarios" placeholder="nome ou username..." oninput="renderListaUsuarios()">
      </div>

      <div style="margin-top:14px;">
        <label>Usuários:</label>
        <ul id="listaUsuarios"></ul>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-top:0;">Editar Usuário</h3>

      <label>Selecione:</label>
      <select id="usuarioSelecionado" onchange="carregarUsuarioSelecionado()"></select>

      <div class="row">
        <div>
          <label>Nome:</label>
          <input id="nome" placeholder="Nome completo">
        </div>
        <div>
          <label>Username:</label>
          <input id="username" placeholder="login (sem espaços)">
        </div>
      </div>

      <div class="row">
        <div>
          <label>Status:</label>
          <select id="ativo">
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
        <div>
          <label>Senha (opcional):</label>
          <input id="senha" type="password" placeholder="deixe em branco para não alterar">
          <div class="muted">A senha é salva como hash (mais seguro).</div>
        </div>
      </div>

      <div style="margin-top:14px;">
        <button onclick="aplicarEdicao()">✅ Aplicar Alteração   </button>
        <button onclick="deletarUsuario()" style="background:#c44; color:#fff;">🗑️ Deletar</button>
        <button onclick="salvarUsuarios()">💾 Salvar</button>
      </div>

      <div class="muted" id="hint"></div>
    </div>

  </div>

<script>
let usuarios = [];
let usuarioAtualIndex = -1;

// carrega do backend
async function carregarUsuarios() {
  try {
    const res = await fetch('salvar_user.php', { method: 'GET' });
    const data = await res.json();
    usuarios = Array.isArray(data) ? data : (data.usuarios || []);
  } catch (e) {
    usuarios = [];
  }

  if (usuarios.length === 0) {}

  preencherSelectUsuarios();
  renderListaUsuarios();

  // seleciona primeiro
  document.getElementById('usuarioSelecionado').value = usuarios[0]?.id || '';
  carregarUsuarioSelecionado();
}

function preencherSelectUsuarios() {
  const select = document.getElementById('usuarioSelecionado');
  select.innerHTML = '';
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.nome} (@${u.username})`;
    select.appendChild(opt);
  });
}

function renderListaUsuarios() {
  const ul = document.getElementById('listaUsuarios');
  ul.innerHTML = '';

  const filtro = document.getElementById('filtroUsuarios').value.toLowerCase();

  usuarios
    .filter(u => {
      const texto = (u.nome + ' ' + u.username).toLowerCase();
      return texto.includes(filtro);
    })
    .forEach(u => {
      const li = document.createElement('li');
      li.onclick = () => selecionarPorId(u.id);

      const left = document.createElement('div');
      left.textContent = `${u.nome} (@${u.username})`;

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = u.ativo ? 'ATIVO' : 'INATIVO';
      tag.style.opacity = u.ativo ? '1' : '.6';

      li.appendChild(left);
      li.appendChild(tag);
      ul.appendChild(li);
    });
}

function selecionarPorId(id) {
  document.getElementById('usuarioSelecionado').value = id;
  carregarUsuarioSelecionado();
}

function carregarUsuarioSelecionado() {
  const id = document.getElementById('usuarioSelecionado').value;
  usuarioAtualIndex = usuarios.findIndex(u => u.id === id);
  const u = usuarios[usuarioAtualIndex];
  if (!u) return;

  document.getElementById('nome').value = u.nome || '';
  document.getElementById('username').value = u.username || '';
  document.getElementById('ativo').value = String(!!u.ativo);
  document.getElementById('senha').value = '';

  document.getElementById('hint').textContent =
    `Dica: para inativar um usuário sem apagar, mude para INATIVO.`;
}

function validarUsuario(nome, username) {
  if (!nome.trim()) return 'Nome é obrigatório.';
  if (!username.trim()) return 'Username é obrigatório.';
  if (/\s/.test(username)) return 'Username não pode ter espaços.';
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) return 'Username só pode ter letras, números, ponto, hífen e underscore.';

  const duplicado = usuarios.some((u, idx) =>
    idx !== usuarioAtualIndex && u.username.toLowerCase() === username.toLowerCase()
  );
  if (duplicado) return 'Já existe outro usuário com esse username.';

  return null;
}

function aplicarEdicao() {
  if (usuarioAtualIndex < 0) return;

  const nome = document.getElementById('nome').value;
  const username = document.getElementById('username').value;
  const ativo = document.getElementById('ativo').value === 'true';
  const senha = document.getElementById('senha').value;

  const err = validarUsuario(nome, username);
  if (err) { alert(err); return; }

  usuarios[usuarioAtualIndex].nome = nome.trim();
  usuarios[usuarioAtualIndex].username = username.trim();
  usuarios[usuarioAtualIndex].ativo = ativo;

  // senha: manda pro backend pra virar hash (se veio preenchida)
  usuarios[usuarioAtualIndex]._senhaPlain = senha ? senha : null;

  preencherSelectUsuarios();
  renderListaUsuarios();

  // mantém selecionado
  document.getElementById('usuarioSelecionado').value = usuarios[usuarioAtualIndex].id;
  carregarUsuarioSelecionado();

  alert('Alterações aplicadas. Clique em "Salvar" para persistir.');
}

function criarNovoUsuario() {
  const nome = prompt('Nome do usuário:');
  if (!nome) return;

  const username = prompt('Username (login):');
  if (!username) return;

  const novo = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    username: username.trim(),
    ativo: true,
    senhaHash: null,
    _senhaPlain: null
  };

  usuarios.push(novo);
  preencherSelectUsuarios();
  renderListaUsuarios();
  document.getElementById('usuarioSelecionado').value = novo.id;
  carregarUsuarioSelecionado();
}

function deletarUsuario() {
  if (usuarioAtualIndex < 0) return;
  const u = usuarios[usuarioAtualIndex];
  if (!confirm(`Deletar usuário "${u.nome}"?`)) return;

  usuarios.splice(usuarioAtualIndex, 1);
  usuarioAtualIndex = -1;

  preencherSelectUsuarios();
  renderListaUsuarios();

  if (usuarios.length > 0) {
    document.getElementById('usuarioSelecionado').value = usuarios[0].id;
    carregarUsuarioSelecionado();
  } else {
    document.getElementById('nome').value = '';
    document.getElementById('username').value = '';
    document.getElementById('senha').value = '';
  }
}

async function salvarUsuarios() {
  try {
    const res = await fetch('salvar_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarios })
    });
    const data = await res.json();
    alert(data.mensagem || 'Salvo!');
    if (data.sucesso) {
      // limpa flags de senha plain
      usuarios.forEach(u => delete u._senhaPlain);
      await carregarUsuarios();
    }
  } catch (e) {
    alert('Erro ao salvar usuários.');
  }
}

carregarUsuarios();
</script>
</body>
</html>
