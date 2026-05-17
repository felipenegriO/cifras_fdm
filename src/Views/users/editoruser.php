<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
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
    .tag-expirado { border-color: #c44; color: #c44; }
    .tag-temp { border-color: #c90; color: #8a5b00; }

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
        <select id="filtroStatusUsuarios" onchange="renderListaUsuarios()">
          <option value="">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="temporarios">Temporarios</option>
          <option value="expirados">Expirados</option>
          <option value="inativos">Inativos</option>
        </select>
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
          <label>Perfil:</label>
          <select id="perfil">
            <option value="administrador">Administrador</option>
            <option value="musico">Musico</option>
            <option value="externo">Externo</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Senha (opcional):</label>
          <input id="senha" type="password" placeholder="deixe em branco para não alterar">
          <div class="muted">A senha é salva como hash (mais seguro).</div>
        </div>
      </div>

      <label>Validade (opcional):</label>
      <input id="validade" type="date">
      <div class="muted">Preencha apenas para usuario temporario. Em branco = permanente.</div>

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

function formatarData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return '';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function usuarioExpirado(u) {
  if (!u.validade || !/^\d{4}-\d{2}-\d{2}$/.test(u.validade)) return false;
  const [ano, mes, dia] = u.validade.split('-').map(Number);
  const validade = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return validade < hoje;
}

function renderListaUsuarios() {
  const ul = document.getElementById('listaUsuarios');
  ul.innerHTML = '';

  const filtro = document.getElementById('filtroUsuarios').value.toLowerCase();
  const filtroStatus = document.getElementById('filtroStatusUsuarios').value;

  usuarios
    .filter(u => {
      const texto = (u.nome + ' ' + u.username).toLowerCase();
      if (!texto.includes(filtro)) return false;
      if (filtroStatus === 'ativos') return !!u.ativo && !usuarioExpirado(u);
      if (filtroStatus === 'temporarios') return !!u.ativo && !!u.validade && !usuarioExpirado(u);
      if (filtroStatus === 'expirados') return !!u.ativo && usuarioExpirado(u);
      if (filtroStatus === 'inativos') return !u.ativo;
      return true;
    })
    .forEach(u => {
      const li = document.createElement('li');
      li.onclick = () => selecionarPorId(u.id);

      const left = document.createElement('div');
      left.textContent = `${u.nome} (@${u.username})`;

      const tag = document.createElement('span');
      tag.className = 'tag';
      if (!u.ativo) {
        tag.textContent = 'INATIVO';
      } else if (usuarioExpirado(u)) {
        tag.textContent = 'EXPIRADO';
        tag.classList.add('tag-expirado');
      } else if (u.validade) {
        tag.textContent = `${(u.perfil || 'administrador').toUpperCase()} ATE ${formatarData(u.validade)}`;
        tag.classList.add('tag-temp');
      } else {
        tag.textContent = (u.perfil || 'administrador').toUpperCase();
      }
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
  document.getElementById('perfil').value = u.perfil || 'administrador';
  document.getElementById('validade').value = u.validade || '';
  document.getElementById('senha').value = '';

  document.getElementById('hint').textContent =
    `Dica: para inativar um usuário sem apagar, mude para INATIVO.`;
}

function validarUsuario(nome, username, validade) {
  if (!nome.trim()) return 'Nome é obrigatório.';
  if (!username.trim()) return 'Username é obrigatório.';
  if (/\s/.test(username)) return 'Username não pode ter espaços.';
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) return 'Username só pode ter letras, números, ponto, hífen e underscore.';

  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return 'Data de validade invalida.';
  const perfil = document.getElementById('perfil').value;
  if (!['administrador', 'musico', 'externo'].includes(perfil)) return 'Perfil invalido.';
  if (perfil === 'externo' && !validade) return 'Usuario externo precisa de data de validade.';

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
  const perfil = document.getElementById('perfil').value;
  const validade = document.getElementById('validade').value;
  const senha = document.getElementById('senha').value;

  const err = validarUsuario(nome, username, validade);
  if (err) { alert(err); return; }

  usuarios[usuarioAtualIndex].nome = nome.trim();
  usuarios[usuarioAtualIndex].username = username.trim();
  usuarios[usuarioAtualIndex].ativo = ativo;
  usuarios[usuarioAtualIndex].perfil = perfil;
  usuarios[usuarioAtualIndex].validade = validade;

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
    perfil: 'musico',
    validade: '',
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
    document.getElementById('perfil').value = 'musico';
    document.getElementById('validade').value = '';
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
