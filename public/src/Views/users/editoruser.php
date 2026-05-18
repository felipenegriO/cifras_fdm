<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
  <title>Cadastro de Usuários</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { font-family: var(--font-ui, sans-serif); padding: 0; margin: 0; background: var(--bg-0); color: var(--text-1); }
    .page-body { padding: 20px; max-width: 720px; margin: 0 auto; }

    /* ── toolbar ── */
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .search-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .search-row input,
    .search-row select {
      flex: 1 1 160px;
      height: 38px;
      padding: 0 10px;
      background: var(--bg-2);
      color: var(--text-1);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: var(--text-sm);
      box-sizing: border-box;
    }
    .search-row input:focus,
    .search-row select:focus { outline: none; border-color: var(--border-2); }

    /* ── user list ── */
    .user-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-2); }
    .user-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-1); min-height: 56px; }
    .user-row:last-child { border-bottom: none; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); line-height: 1.3; }
    .user-meta { font-size: var(--text-xs); color: var(--text-2); margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .user-actions { display: flex; gap: 6px; flex-shrink: 0; }

    /* ── tags ── */
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; color: var(--text-2); background: var(--bg-3); }
    .tag-ativo  { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,.1); }
    .tag-expirado { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,.1); }
    .tag-temp   { border-color: var(--warning); color: var(--warning); background: rgba(245,158,11,.1); }
    .tag-inativo{ border-color: var(--border-2); color: var(--text-3); background: var(--bg-3); }

    /* ── modal overlay ── */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: var(--bg-overlay); z-index: var(--z-modal);
      align-items: center; justify-content: center; padding: 16px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--bg-elevated);
      border: 1px solid var(--border-1);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: 100%; max-width: 480px;
      box-shadow: var(--shadow-3);
      max-height: 90vh; overflow-y: auto;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal-header h3 { margin: 0; font-size: var(--text-lg); }
    .modal-close { background: none; border: none; color: var(--text-2); cursor: pointer; font-size: 22px; line-height: 1; padding: 0; margin: 0; min-height: unset; }
    .modal-close:hover { color: var(--text-1); }

    /* ── form inside modal ── */
    .form-row { display: flex; gap: 10px; }
    .form-row > div { flex: 1; min-width: 0; }
    .form-group { margin-top: 12px; }
    .form-group label { display: block; font-size: var(--text-sm); font-weight: var(--fw-medium); color: var(--text-2); margin-bottom: 4px; }
    .form-group input,
    .form-group select {
      width: 100%; height: 38px; padding: 0 10px; box-sizing: border-box;
      background: var(--bg-1); color: var(--text-1);
      border: 1px solid var(--border-1); border-radius: var(--radius-sm);
      font-family: inherit; font-size: var(--text-sm);
    }
    .form-group input:focus,
    .form-group select:focus { outline: none; border-color: var(--border-2); }
    .form-hint { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .modal-footer { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; justify-content: flex-end; }

    /* action buttons in list */
    .btn-icon-sm {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: var(--radius-sm);
      border: 1px solid var(--border-1); background: var(--bg-3);
      color: var(--text-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast);
      padding: 0; flex-shrink: 0;
    }
    .btn-icon-sm:hover { background: var(--bg-elevated); color: var(--text-1); }
    .btn-icon-sm.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

    @media (max-width: 480px) {
      .form-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>

  <div class="page-body">

    <div class="toolbar">
      <button type="button" class="btn btn--primary" onclick="abrirModalNovo()">
        <?= fdm_icon('plus', 16) ?> Novo Usuário
      </button>
    </div>

    <div class="search-row">
      <input id="filtroUsuarios" placeholder="Pesquisar nome ou username..." oninput="renderListaUsuarios()">
      <select id="filtroStatusUsuarios" onchange="renderListaUsuarios()">
        <option value="">Todos</option>
        <option value="ativos">Ativos</option>
        <option value="temporarios">Temporários</option>
        <option value="expirados">Expirados</option>
        <option value="inativos">Inativos</option>
      </select>
    </div>

    <ul class="user-list" id="listaUsuarios"></ul>

  </div>

  <!-- ── Modal editar / criar ── -->
  <div class="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modalTitle">Editar Usuário</h3>
        <button class="modal-close" onclick="fecharModal()" aria-label="Fechar">×</button>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="nome">Nome</label>
          <input id="nome" placeholder="Nome completo">
        </div>
        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" placeholder="login (sem espaços)">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="ativo">Status</label>
          <select id="ativo">
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
        <div class="form-group">
          <label for="perfil">Perfil</label>
          <select id="perfil">
            <option value="administrador">Administrador</option>
            <option value="musico">Músico</option>
            <option value="externo">Externo</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="validade">Validade (opcional)</label>
        <input id="validade" type="date">
        <div class="form-hint">Preencha apenas para usuário temporário. Em branco = permanente.</div>
      </div>

      <div class="form-group">
        <label for="senha">Senha <span style="font-weight:400;color:var(--text-3)">(deixe em branco para não alterar)</span></label>
        <input id="senha" type="password" placeholder="••••••••">
        <div class="form-hint">Salva como hash seguro.</div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn--ghost" onclick="fecharModal()">Cancelar</button>
        <button type="button" class="btn btn--danger" id="btnDeletar" onclick="deletarUsuario()"><?= fdm_icon('trash', 16) ?> Deletar</button>
        <button type="button" class="btn btn--primary" onclick="aplicarEdicao()"><?= fdm_icon('check', 16) ?> Salvar</button>
      </div>
    </div>
  </div>

<script>
let usuarios = [];
let usuarioAtualIndex = -1;

async function carregarUsuarios() {
  try {
    const res = await fetch('/src/backend/users/salvar_user.php', { method: 'GET' });
    const data = await res.json();
    usuarios = Array.isArray(data) ? data : (data.usuarios || []);
  } catch (e) {
    usuarios = [];
  }
  renderListaUsuarios();
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
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return validade < hoje;
}

function tagHtml(u) {
  const perfil = (u.perfil || 'administrador').toLowerCase();
  const perfilLabel = perfil === 'administrador' ? 'Admin' : perfil === 'musico' ? 'Músico' : 'Externo';

  if (!u.ativo) return `<span class="tag tag-inativo">⊘ Inativo</span>`;
  if (usuarioExpirado(u)) return `<span class="tag tag-expirado">⏱ Expirado</span>`;

  let tags = `<span class="tag tag-ativo">● Ativo</span> <span class="tag">${perfilLabel}</span>`;
  if (u.validade) tags += ` <span class="tag tag-temp">até ${formatarData(u.validade)}</span>`;
  return tags;
}

function renderListaUsuarios() {
  const ul = document.getElementById('listaUsuarios');
  ul.innerHTML = '';

  const filtro = document.getElementById('filtroUsuarios').value.toLowerCase();
  const filtroStatus = document.getElementById('filtroStatusUsuarios').value;

  const lista = usuarios.filter(u => {
    const texto = (u.nome + ' ' + u.username).toLowerCase();
    if (!texto.includes(filtro)) return false;
    if (filtroStatus === 'ativos')      return !!u.ativo && !usuarioExpirado(u);
    if (filtroStatus === 'temporarios') return !!u.ativo && !!u.validade && !usuarioExpirado(u);
    if (filtroStatus === 'expirados')   return !!u.ativo && usuarioExpirado(u);
    if (filtroStatus === 'inativos')    return !u.ativo;
    return true;
  });

  if (lista.length === 0) {
    ul.innerHTML = '<li style="padding:20px;text-align:center;color:var(--text-3);font-size:var(--text-sm);">Nenhum usuário encontrado.</li>';
    return;
  }

  lista.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-row';
    li.innerHTML = `
      <div class="user-info">
        <div class="user-name">${escapeHtml(u.nome)} <span style="color:var(--text-3);font-weight:400">@${escapeHtml(u.username)}</span></div>
        <div class="user-meta">${tagHtml(u)}</div>
      </div>
      <div class="user-actions">
        <button class="btn-icon-sm" title="Editar" onclick="abrirModalEditar('${u.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon-sm danger" title="Excluir" onclick="deletarUsuarioPorId('${u.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    ul.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal ────────────────────────────────────────────────────────────────────

function abrirModalNovo() {
  usuarioAtualIndex = -1;
  document.getElementById('modalTitle').textContent = 'Novo Usuário';
  document.getElementById('nome').value = '';
  document.getElementById('username').value = '';
  document.getElementById('ativo').value = 'true';
  document.getElementById('perfil').value = 'musico';
  document.getElementById('validade').value = '';
  document.getElementById('senha').value = '';
  document.getElementById('btnDeletar').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('nome').focus();
}

function abrirModalEditar(id) {
  const idx = usuarios.findIndex(u => u.id === id);
  if (idx < 0) return;
  usuarioAtualIndex = idx;
  const u = usuarios[idx];

  document.getElementById('modalTitle').textContent = 'Editar Usuário';
  document.getElementById('nome').value = u.nome || '';
  document.getElementById('username').value = u.username || '';
  document.getElementById('ativo').value = String(!!u.ativo);
  document.getElementById('perfil').value = u.perfil || 'administrador';
  document.getElementById('validade').value = u.validade || '';
  document.getElementById('senha').value = '';
  document.getElementById('btnDeletar').style.display = '';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('nome').focus();
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// Fechar clicando fora
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

// ── CRUD ────────────────────────────────────────────────────────────────────

function validarUsuario(nome, username, validade) {
  if (!nome.trim()) return 'Nome é obrigatório.';
  if (!username.trim()) return 'Username é obrigatório.';
  if (/\s/.test(username)) return 'Username não pode ter espaços.';
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) return 'Username só pode ter letras, números, ponto, hífen e underscore.';
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return 'Data de validade inválida.';
  const perfil = document.getElementById('perfil').value;
  if (!['administrador', 'musico', 'externo'].includes(perfil)) return 'Perfil inválido.';
  if (perfil === 'externo' && !validade) return 'Usuário externo precisa de data de validade.';
  const duplicado = usuarios.some((u, idx) =>
    idx !== usuarioAtualIndex && u.username.toLowerCase() === username.toLowerCase()
  );
  if (duplicado) return 'Já existe outro usuário com esse username.';
  return null;
}

function aplicarEdicao() {
  const nome     = document.getElementById('nome').value;
  const username = document.getElementById('username').value;
  const ativo    = document.getElementById('ativo').value === 'true';
  const perfil   = document.getElementById('perfil').value;
  const validade = document.getElementById('validade').value;
  const senha    = document.getElementById('senha').value;

  const err = validarUsuario(nome, username, validade);
  if (err) { fdmToast(err, 'error'); return; }

  if (usuarioAtualIndex < 0) {
    // novo
    usuarios.push({
      id: crypto.randomUUID(),
      nome: nome.trim(), username: username.trim(),
      ativo, perfil, validade,
      senhaHash: null,
      _senhaPlain: senha || null
    });
  } else {
    const u = usuarios[usuarioAtualIndex];
    u.nome     = nome.trim();
    u.username = username.trim();
    u.ativo    = ativo;
    u.perfil   = perfil;
    u.validade = validade;
    if (senha) u._senhaPlain = senha;
  }

  renderListaUsuarios();
  fecharModal();
  salvarUsuarios();
}

async function deletarUsuarioPorId(id) {
  const idx = usuarios.findIndex(u => u.id === id);
  if (idx < 0) return;
  const u = usuarios[idx];
  const nome = escapeHtml(u.nome);
  const isAdmin = (u.perfil || '').toLowerCase() === 'administrador';
  const ok = await fdmConfirm({
    title: 'Deletar usuário',
    message: 'O usuário <strong>' + nome + '</strong> será removido permanentemente.' +
      (isAdmin ? '<br><br>⚠️ <strong>Atenção:</strong> este é um administrador.' : ''),
    confirmText: 'Sim, deletar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;
  usuarios.splice(idx, 1);
  renderListaUsuarios();
  salvarUsuarios();
}

function deletarUsuario() {
  if (usuarioAtualIndex < 0) return;
  fecharModal();
  deletarUsuarioPorId(usuarios[usuarioAtualIndex]?.id);
}

async function salvarUsuarios() {
  try {
    const res = await fetch('/src/backend/users/salvar_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarios })
    });
    const data = await res.json();
    if (data.sucesso) {
      fdmToast('Usuários salvos!', 'success');
      usuarios.forEach(u => delete u._senhaPlain);
      await carregarUsuarios();
    } else {
      fdmToast(data.mensagem || 'Erro ao salvar.', 'error');
    }
  } catch (e) {
    fdmToast('Erro ao salvar usuários.', 'error');
  }
}

carregarUsuarios();
</script>
</body>
</html>
