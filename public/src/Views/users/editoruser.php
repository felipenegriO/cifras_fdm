<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/fdm-toast.js') ?>"></script>
  <title>Usuários — StageBox</title>
  <script src="/src/js/fdm-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { font-family: var(--font-ui, sans-serif); padding: 0; margin: 0; background: var(--bg-0); color: var(--text-1); }
    .page-body { padding: 20px; max-width: 720px; margin: 0 auto; }

    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .search-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .search-row input,
    .search-row select {
      flex: 1 1 160px; height: 38px; padding: 0 10px;
      background: var(--bg-2); color: var(--text-1);
      border: 1px solid var(--border-1); border-radius: var(--radius-sm);
      font-family: inherit; font-size: var(--text-sm); box-sizing: border-box;
    }
    .search-row input:focus, .search-row select:focus { outline: none; border-color: var(--border-2); }

    .user-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-2); }
    .user-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-1); min-height: 56px; }
    .user-row:last-child { border-bottom: none; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); line-height: 1.3; }
    .user-meta { font-size: var(--text-xs); color: var(--text-2); margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .user-actions { display: flex; gap: 6px; flex-shrink: 0; }

    .tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; color: var(--text-2); background: var(--bg-3); }
    .tag-ativo     { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,.1); }
    .tag-expirado  { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,.1); }
    .tag-temp      { border-color: var(--warning); color: var(--warning); background: rgba(245,158,11,.1); }
    .tag-inativo   { border-color: var(--border-2); color: var(--text-3); background: var(--bg-3); }
    .tag-admin     { border-color: #818cf8; color: #818cf8; background: rgba(129,140,248,.1); }
    .tag-gestor    { border-color: #38bdf8; color: #38bdf8; background: rgba(56,189,248,.1); }

    .modal-overlay { display: none; position: fixed; inset: 0; background: var(--bg-overlay); z-index: var(--z-modal); align-items: center; justify-content: center; padding: 16px; }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--bg-elevated); border: 1px solid var(--border-1); border-radius: var(--radius-lg); padding: 24px; width: 100%; max-width: 480px; box-shadow: var(--shadow-3); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal-header h3 { margin: 0; font-size: var(--text-lg); }
    .modal-close { background: none; border: none; color: var(--text-2); cursor: pointer; font-size: 22px; line-height: 1; padding: 0; margin: 0; min-height: unset; }
    .modal-close:hover { color: var(--text-1); }

    .form-row { display: flex; gap: 10px; }
    .form-row > div { flex: 1; min-width: 0; }
    .form-group { margin-top: 12px; }
    .form-group label { display: block; font-size: var(--text-sm); font-weight: var(--fw-medium); color: var(--text-2); margin-bottom: 4px; }
    .form-group input, .form-group select { width: 100%; height: 38px; padding: 0 10px; box-sizing: border-box; background: var(--bg-1); color: var(--text-1); border: 1px solid var(--border-1); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--text-sm); }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--border-2); }
    .form-hint { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .modal-footer { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; justify-content: flex-end; }

    .btn-icon-sm { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--border-1); background: var(--bg-3); color: var(--text-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); padding: 0; flex-shrink: 0; }
    .btn-icon-sm:hover { background: var(--bg-elevated); color: var(--text-1); }
    .btn-icon-sm.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

    /* import search results */
    .import-results { list-style: none; padding: 0; margin: 8px 0 0; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-1); }
    .import-result-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-1); cursor: pointer; }
    .import-result-row:last-child { border-bottom: none; }
    .import-result-row:hover { background: var(--bg-2); }
    .import-result-row.selected { background: var(--bg-3); }
    .import-result-name { flex: 1; font-size: var(--text-sm); }
    .import-result-user { font-size: 11px; color: var(--text-3); }

    @media (max-width: 480px) { .form-row { flex-direction: column; } }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>

  <div class="page-body">

    <div class="toolbar">
      <button type="button" class="btn btn--primary" onclick="abrirModalNovo()">
        <?= fdm_icon('plus', 16) ?> Novo Usuário
      </button>
      <button type="button" class="btn btn--ghost" onclick="abrirModalImportar()">
        <?= fdm_icon('users', 16) ?> Importar Usuário
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

      <div class="form-group">
        <label for="email">E-mail <span style="font-weight:400;color:var(--text-3)">(opcional — envia convite automático)</span></label>
        <input id="email" type="email" placeholder="usuario@email.com">
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
          <label for="bandaPerfil">Perfil na banda</label>
          <select id="bandaPerfil">
            <option value="administrador">Administrador</option>
            <option value="gestor">Gestor</option>
            <option value="basico" selected>Básico</option>
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
        <button type="button" class="btn btn--danger" id="btnDeletar" onclick="deletarUsuario()"><?= fdm_icon('trash', 16) ?> Remover da banda</button>
        <button type="button" class="btn btn--primary" onclick="aplicarEdicao()"><?= fdm_icon('check', 16) ?> Salvar</button>
      </div>
    </div>
  </div>

  <!-- ── Modal importar ── -->
  <div class="modal-overlay" id="modalImportar" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <h3>Importar Usuário</h3>
        <button class="modal-close" onclick="fecharModalImportar()" aria-label="Fechar">×</button>
      </div>

      <div class="form-group">
        <label for="importBusca">Buscar usuário</label>
        <input id="importBusca" placeholder="Nome ou username..." oninput="buscarParaImportar()">
        <div class="form-hint">Busca usuários já cadastrados que ainda não estão nesta banda.</div>
      </div>
      <ul class="import-results" id="importResultados"></ul>
      <input type="hidden" id="importUserId">

      <div class="form-group">
        <label for="importPerfil">Perfil na banda</label>
        <select id="importPerfil">
          <option value="administrador">Administrador</option>
          <option value="gestor">Gestor</option>
          <option value="basico" selected>Básico</option>
        </select>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn--ghost" onclick="fecharModalImportar()">Cancelar</button>
        <button type="button" class="btn btn--primary" onclick="confirmarImportar()"><?= fdm_icon('check', 16) ?> Importar</button>
      </div>
    </div>
  </div>

<script>
const API = '/src/backend/users/salvar_user.php';
let usuarios = [];
let usuarioAtualId = null;
let importBuscaTimer = null;

async function carregarUsuarios() {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    const data = await res.json();
    usuarios = Array.isArray(data) ? data : [];
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

const PERFIL_LABELS = { administrador: 'Admin', gestor: 'Gestor', basico: 'Básico', master: 'Master' };

function tagHtml(u) {
  const bandaPerfil = (u.banda_perfil || 'basico').toLowerCase();
  const perfilLabel = PERFIL_LABELS[bandaPerfil] || bandaPerfil;
  const perfilClass = bandaPerfil === 'administrador' ? 'tag-admin' : bandaPerfil === 'gestor' ? 'tag-gestor' : '';

  if (!u.ativo || String(u.ativo) === '0') return `<span class="tag tag-inativo">⊘ Inativo</span>`;
  if (usuarioExpirado(u)) return `<span class="tag tag-expirado">⏱ Expirado</span> <span class="tag ${perfilClass}">${perfilLabel}</span>`;

  let tags = `<span class="tag tag-ativo">● Ativo</span> <span class="tag ${perfilClass}">${perfilLabel}</span>`;
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
    const ativo = !!u.ativo && String(u.ativo) !== '0';
    if (filtroStatus === 'ativos')      return ativo && !usuarioExpirado(u);
    if (filtroStatus === 'temporarios') return ativo && !!u.validade && !usuarioExpirado(u);
    if (filtroStatus === 'expirados')   return ativo && usuarioExpirado(u);
    if (filtroStatus === 'inativos')    return !ativo;
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
        ${u.email && !u.ativo ? `<button class="btn-icon-sm" title="Reenviar convite" onclick="reenviarConvite('${u.id}', '${escapeHtml(u.nome)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>` : ''}
        <button class="btn-icon-sm" title="Editar" onclick="abrirModalEditar('${u.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon-sm danger" title="Remover da banda" onclick="removerDaBanda('${u.id}', '${escapeHtml(u.nome)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    ul.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal editar/criar ────────────────────────────────────────────────────────

function abrirModalNovo() {
  usuarioAtualId = null;
  document.getElementById('modalTitle').textContent = 'Novo Usuário';
  document.getElementById('nome').value = '';
  document.getElementById('username').value = '';
  document.getElementById('email').value = '';
  document.getElementById('ativo').value = 'true';
  document.getElementById('bandaPerfil').value = 'basico';
  document.getElementById('validade').value = '';
  document.getElementById('senha').value = '';
  document.getElementById('btnDeletar').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('nome').focus();
}

function abrirModalEditar(id) {
  const u = usuarios.find(u => u.id === id);
  if (!u) return;
  usuarioAtualId = id;

  document.getElementById('modalTitle').textContent = 'Editar Usuário';
  document.getElementById('nome').value = u.nome || '';
  document.getElementById('username').value = u.username || '';
  document.getElementById('email').value = u.email || '';
  document.getElementById('ativo').value = (!!u.ativo && String(u.ativo) !== '0') ? 'true' : 'false';
  document.getElementById('bandaPerfil').value = u.banda_perfil || 'basico';
  document.getElementById('validade').value = u.validade || '';
  document.getElementById('senha').value = '';
  document.getElementById('btnDeletar').style.display = '';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('nome').focus();
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

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
  return null;
}

async function aplicarEdicao() {
  const nome        = document.getElementById('nome').value;
  const username    = document.getElementById('username').value;
  const email       = document.getElementById('email').value.trim();
  const ativo       = document.getElementById('ativo').value === 'true';
  const bandaPerfil = document.getElementById('bandaPerfil').value;
  const validade    = document.getElementById('validade').value;
  const senha       = document.getElementById('senha').value;

  const err = validarUsuario(nome, username, validade);
  if (err) { fdmToast(err, 'error'); return; }

  const payload = {
    action: 'save',
    id: usuarioAtualId || undefined,
    nome: nome.trim(),
    username: username.trim(),
    email: email || '',
    ativo,
    bandaPerfil,
    validade,
  };
  if (senha) payload._senhaPlain = senha;

  try {
    const res = await fdmFetch(API, payload);
    if (res.sucesso) {
      const msg = res.convite_enviado ? 'Salvo! Convite enviado por e-mail.' : (res.aviso || 'Salvo!');
      fdmToast(msg, 'success');
      fecharModal();
      await carregarUsuarios();
    } else {
      fdmToast(res.mensagem || 'Erro ao salvar.', 'error');
    }
  } catch (e) {
    fdmToast('Erro ao salvar.', 'error');
  }
}

async function removerDaBanda(id, nomeUsuario) {
  const ok = await fdmConfirm({
    title: 'Remover da banda',
    message: 'O usuário <strong>' + escapeHtml(nomeUsuario) + '</strong> será removido desta banda.',
    confirmText: 'Sim, remover',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;
  try {
    const res = await fdmFetch(API, { action: 'delete', userId: id });
    if (res.sucesso) {
      fdmToast('Usuário removido da banda.', 'success');
      await carregarUsuarios();
    } else {
      fdmToast(res.mensagem || 'Erro ao remover.', 'error');
    }
  } catch (e) {
    fdmToast('Erro ao remover.', 'error');
  }
}

function deletarUsuario() {
  if (!usuarioAtualId) return;
  fecharModal();
  const u = usuarios.find(u => u.id === usuarioAtualId);
  if (u) removerDaBanda(u.id, u.nome);
}

// ── Import modal ─────────────────────────────────────────────────────────────

function abrirModalImportar() {
  document.getElementById('importBusca').value = '';
  document.getElementById('importResultados').innerHTML = '';
  document.getElementById('importUserId').value = '';
  document.getElementById('importPerfil').value = 'basico';
  document.getElementById('modalImportar').classList.add('open');
  document.getElementById('importBusca').focus();
}

function fecharModalImportar() {
  document.getElementById('modalImportar').classList.remove('open');
}

document.getElementById('modalImportar').addEventListener('click', function(e) {
  if (e.target === this) fecharModalImportar();
});

function buscarParaImportar() {
  clearTimeout(importBuscaTimer);
  importBuscaTimer = setTimeout(async () => {
    const q = document.getElementById('importBusca').value.trim();
    const ul = document.getElementById('importResultados');
    if (q.length < 2) { ul.innerHTML = ''; return; }
    try {
      const res = await fdmFetch(API, { action: 'search', q });
      ul.innerHTML = '';
      if (!Array.isArray(res) || res.length === 0) {
        ul.innerHTML = '<li style="padding:10px 12px;color:var(--text-3);font-size:var(--text-sm)">Nenhum resultado.</li>';
        return;
      }
      res.forEach(u => {
        const li = document.createElement('li');
        li.className = 'import-result-row';
        li.dataset.id = u.id;
        li.innerHTML = `<span class="import-result-name">${escapeHtml(u.nome)}</span><span class="import-result-user">@${escapeHtml(u.username)}</span>`;
        li.addEventListener('click', () => selecionarImport(u.id, li));
        ul.appendChild(li);
      });
    } catch (e) {}
  }, 300);
}

function selecionarImport(id, el) {
  document.getElementById('importUserId').value = id;
  document.querySelectorAll('.import-result-row').forEach(r => r.classList.remove('selected'));
  el.classList.add('selected');
}

async function reenviarConvite(userId, nome) {
  try {
    const res = await fdmFetch(API, { action: 'resend_invite', userId });
    if (res.sucesso) {
      fdmToast(`Convite reenviado para ${nome}.`, 'success');
    } else {
      fdmToast(res.mensagem || 'Erro ao reenviar.', 'error');
    }
  } catch (e) {
    fdmToast('Erro ao reenviar convite.', 'error');
  }
}

async function confirmarImportar() {
  const userId = document.getElementById('importUserId').value;
  const perfil = document.getElementById('importPerfil').value;
  if (!userId) { fdmToast('Selecione um usuário.', 'error'); return; }
  try {
    const res = await fdmFetch(API, { action: 'import', userId, perfil });
    if (res.sucesso) {
      fdmToast('Usuário importado!', 'success');
      fecharModalImportar();
      await carregarUsuarios();
    } else {
      fdmToast(res.mensagem || 'Erro ao importar.', 'error');
    }
  } catch (e) {
    fdmToast('Erro ao importar.', 'error');
  }
}

// ── helper: POST with CSRF ────────────────────────────────────────────────────

async function fdmFetch(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}

carregarUsuarios();
</script>
</body>
</html>
