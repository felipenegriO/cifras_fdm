<?php
/**
 * Aba Membros do "Minha Banda".
 * Recorte de Views/users/editoruser.php, sem redesenho: mesma marcação, mesmo
 * JavaScript. A casca já fornece head, topnav e os scripts compartilhados.
 */
?>
<style>
    body { font-family: var(--font-ui, sans-serif); padding: 0; margin: 0; background: var(--bg-0); color: var(--text-1); }
    .page-body { padding: 24px 20px; max-width: 720px; margin: 0 auto; }

    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: var(--text-2xl); line-height: 1.2; }
    .page-header p { margin: 6px 0 0; color: var(--text-2); font-size: var(--text-sm); }

    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .search-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .search-field { position: relative; flex: 2 1 260px; }
    .search-field svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
    .search-row input,
    .search-row select {
      flex: 1 1 160px; height: 38px; padding: 0 10px;
      background: var(--bg-2); color: var(--text-1);
      border: 1px solid var(--border-1); border-radius: var(--radius-sm);
      font-family: inherit; font-size: var(--text-sm); box-sizing: border-box;
    }
    .search-row .search-field input { width: 100%; padding-left: 36px; }
    .search-row input:focus, .search-row select:focus { outline: none; border-color: var(--border-2); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

    .list-summary { min-height: 18px; margin: 0 0 8px; color: var(--text-2); font-size: var(--text-xs); }

    .user-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-2); }
    .user-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-1); min-height: 56px; }
    .user-row:last-child { border-bottom: none; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); line-height: 1.3; }
    .user-identity { margin-top: 2px; color: var(--text-3); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .modal { background: var(--bg-elevated); border: 1px solid var(--border-1); border-radius: var(--radius-lg); padding: 24px; width: 100%; max-width: 480px; box-shadow: var(--shadow-3); }
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
    .checkbox-field { display: flex; align-items: center; gap: 9px; min-height: 38px; cursor: pointer; }
    .form-group .checkbox-field input { width: 18px; height: 18px; margin: 0; accent-color: var(--brand); }
    .checkbox-field span { color: var(--text-1); font-size: var(--text-sm); }
    .form-hint { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .modal-footer { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; justify-content: flex-end; }

    .btn-icon-sm { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-sm); border: 1px solid var(--border-1); background: var(--bg-3); color: var(--text-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); padding: 0; flex-shrink: 0; }
    .btn-icon-sm:hover { background: var(--bg-elevated); color: var(--text-1); }
    .btn-icon-sm:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    /* import search results */
    .import-results { list-style: none; padding: 0; margin: 8px 0 0; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-1); }
    .import-result-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-1); cursor: pointer; }
    .import-result-row:last-child { border-bottom: none; }
    .import-result-row:hover { background: var(--bg-2); }
    .import-result-row.selected { background: var(--bg-3); }
    .import-result-name { flex: 1; font-size: var(--text-sm); }
    .import-result-user { font-size: 11px; color: var(--text-3); }

    @media (max-width: 480px) {
      .page-body { padding: 20px 16px; }
      .page-header h2 { font-size: var(--text-xl); }
      .toolbar { display: grid; grid-template-columns: 1fr 1fr; }
      .toolbar .btn { width: 100%; padding-inline: 10px; white-space: normal; }
      .search-row { flex-direction: column; }
      .search-field, .search-row select { flex: none; width: 100%; }
      .form-row { flex-direction: column; gap: 0; }
      .modal-overlay { align-items: flex-end; padding: 0; }
      .modal { max-height: calc(100dvh - 24px); overflow-y: auto; border-radius: var(--radius-lg) var(--radius-lg) 0 0; padding: 20px 16px 0; }
      .modal-close { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: -10px -10px -10px 0; }
      .modal-footer { position: sticky; bottom: 0; margin: 20px -16px 0; padding: 12px 16px; background: var(--bg-elevated); border-top: 1px solid var(--border-1); }
      .modal-footer .btn { flex: 1 1 auto; }
      #btnDeletar { flex-basis: 100%; order: 3; }
    }
    @media (min-width: 481px) and (max-height: 680px) {
      .modal { max-height: calc(100vh - 32px); overflow-y: auto; }
    }

    .convite-estado { margin: -6px 0 14px; color: var(--text-2); font-size: var(--text-xs); }
    .convite-estado[hidden] { display: none; }
    .convite-revogar {
      border: 0; background: none; padding: 0; font: inherit;
      color: var(--danger); text-decoration: underline; cursor: pointer;
    }
    .convite-upgrade {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin: -6px 0 14px; padding: 12px 14px;
      background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.45);
      border-radius: var(--radius-md); color: var(--text-2); font-size: var(--text-sm);
    }
    .convite-upgrade[hidden] { display: none; }
    .convite-upgrade strong { color: var(--text-1); }
  </style>

<div class="page-body">

    <header class="page-header">
      <h2 class="mb-aba-titulo">Usuários da banda</h2>
      <p>Gerencie acessos, perfis e convites.</p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn btn--primary" id="btnConvidar" onclick="convidarPorLink()">
        <?= cifro_icon('users', 16) ?> Convidar
      </button>
      <button type="button" class="btn btn--secondary" onclick="abrirModalNovo()">
        <?= cifro_icon('plus', 16) ?> Novo Usuário
      </button>
      <button type="button" class="btn btn--secondary" onclick="abrirModalImportar()">
        <?= cifro_icon('users', 16) ?> Importar Usuário
      </button>
    </div>

    <p class="convite-estado" id="conviteEstado" hidden>
      Convite ativo até <strong id="conviteValidade"></strong>
      · <span id="conviteUsos">0</span>
      · <button type="button" class="convite-revogar" id="btnRevogarConvite" onclick="revogarConvite()">Revogar</button>
    </p>

    <div class="convite-upgrade" id="conviteUpgrade" hidden>
      <strong>Seu plano Gratuito permite apenas você.</strong>
      <span id="conviteUpgradeMotivo"></span>
      <a class="btn btn--primary" href="<?= e(base_url('/minha-banda.php?aba=plano')) ?>">Ver planos</a>
    </div>

    <div class="search-row">
      <div class="search-field">
        <label class="sr-only" for="filtroUsuarios">Pesquisar usuários</label>
        <?= cifro_icon('search', 16) ?>
        <input id="filtroUsuarios" type="search" placeholder="Pesquisar usuário" oninput="renderListaUsuarios()">
      </div>
      <label class="sr-only" for="filtroStatusUsuarios">Filtrar por status</label>
      <select id="filtroStatusUsuarios" onchange="renderListaUsuarios()">
        <option value="">Todos os status</option>
        <option value="ativos">Ativos</option>
        <option value="temporarios">Temporários</option>
        <option value="expirados">Expirados</option>
        <option value="inativos">Inativos</option>
      </select>
    </div>

    <p class="list-summary" id="resumoUsuarios" aria-live="polite"></p>
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
          <label for="email">E-mail</label>
          <input id="email" type="email" placeholder="usuario@email.com" autocomplete="email">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <label class="checkbox-field" for="ativo">
            <input id="ativo" type="checkbox">
            <span>Usuário ativo</span>
          </label>
        </div>
        <div class="form-group">
          <label for="bandaPerfil">Perfil na banda</label>
          <select id="bandaPerfil">
            <option value="administrador">Administrador</option>
            <option value="gestor">Gestor</option>
            <option value="basico" selected>Básico</option>
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
        <button type="button" class="btn btn--danger" id="btnDeletar" onclick="deletarUsuario()"><?= cifro_icon('trash', 16) ?> Remover da banda</button>
        <button type="button" class="btn btn--primary" onclick="aplicarEdicao()"><?= cifro_icon('check', 16) ?> Salvar usuário</button>
      </div>
    </div>
  </div>

  <!-- ── Modal importar ── -->
  <div class="modal-overlay" id="modalImportar" role="dialog" aria-modal="true" aria-labelledby="modalImportarTitle">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modalImportarTitle">Importar Usuário</h3>
        <button class="modal-close" onclick="fecharModalImportar()" aria-label="Fechar">×</button>
      </div>

      <div class="form-group">
        <label for="importBusca">Buscar usuário</label>
        <input id="importBusca" placeholder="Nome ou e-mail..." oninput="buscarParaImportar()">
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
          <option value="externo">Externo</option>
        </select>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn--ghost" onclick="fecharModalImportar()">Cancelar</button>
        <button type="button" class="btn btn--primary" onclick="confirmarImportar()"><?= cifro_icon('check', 16) ?> Importar</button>
      </div>
    </div>
  </div>

<script>
const API = (window.APP_BASE || '') + '/src/backend/users/salvar_user.php';
// Mesmo limite do backend (cifro_require_plan_limit) — só para avisar antes de
// abrir o modal. Quem decide de verdade é o servidor, isto é só UX.
const LIMITE_USUARIOS = <?= json_encode(is_master() ? -1 : (cifro_plan_limits($_SESSION['banda_atual']['plano'] ?? 'bloqueado')['users'] ?? 0)) ?>;
const PLANO_LABEL_ATUAL = <?= json_encode(cifro_plan_label($_SESSION['banda_atual']['plano'] ?? 'bloqueado')) ?>;
let usuarios = [];
let usuarioAtualId = null;
let importBuscaTimer = null;
let modalTrigger = null;
let importModalTrigger = null;

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

const PERFIL_LABELS = { administrador: 'Admin', gestor: 'Gestor', basico: 'Básico', externo: 'Externo', master: 'Master' };

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
  const resumo = document.getElementById('resumoUsuarios');
  ul.innerHTML = '';
  const filtro = document.getElementById('filtroUsuarios').value.toLowerCase();
  const filtroStatus = document.getElementById('filtroStatusUsuarios').value;

  const lista = usuarios.filter(u => {
    const texto = `${u.nome || ''} ${u.email || ''}`.toLowerCase();
    if (!texto.includes(filtro)) return false;
    const ativo = !!u.ativo && String(u.ativo) !== '0';
    if (filtroStatus === 'ativos')      return ativo && !usuarioExpirado(u);
    if (filtroStatus === 'temporarios') return ativo && !!u.validade && !usuarioExpirado(u);
    if (filtroStatus === 'expirados')   return ativo && usuarioExpirado(u);
    if (filtroStatus === 'inativos')    return !ativo;
    return true;
  });

  const filtrando = filtro !== '' || filtroStatus !== '';
  const totalLabel = `${usuarios.length} ${usuarios.length === 1 ? 'usuário' : 'usuários'}`;
  resumo.textContent = filtrando ? `${lista.length} de ${totalLabel}` : totalLabel;

  if (lista.length === 0) {
    ul.innerHTML = '<li style="padding:20px;text-align:center;color:var(--text-3);font-size:var(--text-sm);">Nenhum usuário encontrado.</li>';
    return;
  }

  lista.forEach(u => {
    const li = document.createElement('li');
    const ativo = !!u.ativo && String(u.ativo) !== '0';
    li.className = 'user-row';
    li.innerHTML = `
      <div class="user-info">
        <div class="user-name">${escapeHtml(u.nome)}</div>
        <div class="user-identity">${escapeHtml(u.email)}</div>
        <div class="user-meta">${tagHtml(u)}</div>
      </div>
      <div class="user-actions">
        ${u.email && !ativo ? `<button type="button" class="btn-icon-sm" title="Reenviar convite" aria-label="Reenviar convite para ${escapeHtml(u.nome)}" onclick="reenviarConvite('${u.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>` : ''}
        <button type="button" class="btn-icon-sm" title="Editar" aria-label="Editar ${escapeHtml(u.nome)}" onclick="abrirModalEditar('${u.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
  if (LIMITE_USUARIOS !== -1 && usuarios.length >= LIMITE_USUARIOS) {
    cifroToast('Limite do plano ' + PLANO_LABEL_ATUAL + ' atingido: máximo de ' + LIMITE_USUARIOS + ' usuário(s). Faça upgrade do plano para adicionar mais.', 'error');
    return;
  }
  modalTrigger = document.activeElement;
  usuarioAtualId = null;
  document.getElementById('modalTitle').textContent = 'Novo Usuário';
  document.getElementById('nome').value = '';
  document.getElementById('email').value = '';
  document.getElementById('ativo').checked = true;
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
  modalTrigger = document.activeElement;
  usuarioAtualId = id;

  document.getElementById('modalTitle').textContent = 'Editar Usuário';
  document.getElementById('nome').value = u.nome || '';
  document.getElementById('email').value = u.email || '';
  document.getElementById('ativo').checked = !!u.ativo && String(u.ativo) !== '0';
  document.getElementById('bandaPerfil').value = u.banda_perfil || 'basico';
  document.getElementById('validade').value = u.validade || '';
  document.getElementById('senha').value = '';
  document.getElementById('btnDeletar').style.display = '';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('nome').focus();
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  if (modalTrigger instanceof HTMLElement) modalTrigger.focus();
  modalTrigger = null;
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

// ── CRUD ────────────────────────────────────────────────────────────────────

function validarUsuario(nome, email, validade) {
  if (!nome.trim()) return 'Nome é obrigatório.';
  if (!email) return 'E-mail é obrigatório.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return 'Data de validade inválida.';
  return null;
}

async function aplicarEdicao() {
  const nome        = document.getElementById('nome').value;
  const email       = document.getElementById('email').value.trim();
  const ativo       = document.getElementById('ativo').checked;
  const bandaPerfil = document.getElementById('bandaPerfil').value;
  const validade    = document.getElementById('validade').value;
  const senha       = document.getElementById('senha').value;

  const err = validarUsuario(nome, email, validade);
  if (err) { cifroToast(err, 'error'); return; }

  const payload = {
    action: 'save',
    id: usuarioAtualId || undefined,
    nome: nome.trim(),
    email: email || '',
    ativo,
    bandaPerfil,
    validade,
  };
  if (senha) payload._senhaPlain = senha;

  try {
    const res = await cifroFetch(API, payload);
    if (res.sucesso) {
      const msg = res.convite_enviado ? 'Salvo! Convite enviado por e-mail.' : (res.aviso || 'Salvo!');
      cifroToast(msg, 'success');
      fecharModal();
      await carregarUsuarios();
    } else {
      cifroToast(res.mensagem || 'Erro ao salvar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao salvar.', 'error');
  }
}

async function removerDaBanda(id, nomeUsuario) {
  const ok = await cifroConfirm({
    title: 'Remover da banda',
    message: 'O usuário <strong>' + escapeHtml(nomeUsuario) + '</strong> será removido desta banda.',
    confirmText: 'Sim, remover',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;
  try {
    const res = await cifroFetch(API, { action: 'delete', userId: id });
    if (res.sucesso) {
      cifroToast('Usuário removido da banda.', 'success');
      await carregarUsuarios();
    } else {
      cifroToast(res.mensagem || 'Erro ao remover.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao remover.', 'error');
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
  importModalTrigger = document.activeElement;
  document.getElementById('importBusca').value = '';
  document.getElementById('importResultados').innerHTML = '';
  document.getElementById('importUserId').value = '';
  document.getElementById('importPerfil').value = 'basico';
  document.getElementById('modalImportar').classList.add('open');
  document.getElementById('importBusca').focus();
}

function fecharModalImportar() {
  document.getElementById('modalImportar').classList.remove('open');
  if (importModalTrigger instanceof HTMLElement) importModalTrigger.focus();
  importModalTrigger = null;
}

document.getElementById('modalImportar').addEventListener('click', function(e) {
  if (e.target === this) fecharModalImportar();
});

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modalImportar').classList.contains('open')) fecharModalImportar();
  else if (document.getElementById('modalOverlay').classList.contains('open')) fecharModal();
});

function buscarParaImportar() {
  clearTimeout(importBuscaTimer);
  importBuscaTimer = setTimeout(async () => {
    const q = document.getElementById('importBusca').value.trim();
    const ul = document.getElementById('importResultados');
    if (q.length < 2) { ul.innerHTML = ''; return; }
    try {
      const res = await cifroFetch(API, { action: 'search', q });
      ul.innerHTML = '';
      if (!Array.isArray(res) || res.length === 0) {
        ul.innerHTML = '<li style="padding:10px 12px;color:var(--text-3);font-size:var(--text-sm)">Nenhum resultado.</li>';
        return;
      }
      res.forEach(u => {
        const li = document.createElement('li');
        li.className = 'import-result-row';
        li.dataset.id = u.id;
        li.innerHTML = `<span class="import-result-name">${escapeHtml(u.nome)}</span><span class="import-result-user">${escapeHtml(u.email)}</span>`;
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

async function reenviarConvite(userId) {
  const usuario = usuarios.find(u => u.id === userId);
  try {
    const res = await cifroFetch(API, { action: 'resend_invite', userId });
    if (res.sucesso) {
      cifroToast(`Convite reenviado para ${usuario?.nome || 'o usuário'}.`, 'success');
    } else {
      cifroToast(res.mensagem || 'Erro ao reenviar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao reenviar convite.', 'error');
  }
}

async function confirmarImportar() {
  const userId = document.getElementById('importUserId').value;
  const perfil = document.getElementById('importPerfil').value;
  if (!userId) { cifroToast('Selecione um usuário.', 'error'); return; }
  try {
    const res = await cifroFetch(API, { action: 'import', userId, perfil });
    if (res.sucesso) {
      cifroToast('Usuário importado!', 'success');
      fecharModalImportar();
      await carregarUsuarios();
    } else {
      cifroToast(res.mensagem || 'Erro ao importar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao importar.', 'error');
  }
}

// ── helper: POST with CSRF ────────────────────────────────────────────────────

async function cifroFetch(url, payload) {
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

// ── Convite por link ─────────────────────────────────────────────────────────

const API_CONVITE = (window.APP_BASE || '') + '/api/bandas/convite.php';

function renderConvite(estado) {
  const linha = document.getElementById('conviteEstado');
  if (!estado || !estado.ativo) { linha.hidden = true; return; }
  document.getElementById('conviteValidade').textContent = estado.validade || '';
  document.getElementById('conviteUsos').textContent =
    estado.usos === 1 ? '1 pessoa entrou' : `${estado.usos} pessoas entraram`;
  linha.hidden = false;
}

async function carregarConvite() {
  try {
    const res = await fetch(API_CONVITE, { cache: 'no-store' });
    if (!res.ok) return;
    renderConvite((await res.json()).estado);
  } catch (e) {}
}

async function convidarPorLink() {
  try {
    const dados = await cifroFetch(API_CONVITE, { action: 'gerar' });

    // 403 com plano_limit: a banda não comporta mais ninguém. Quem precisa
    // saber disso é o administrador, AGORA — não o músico depois de clicar
    // num link que já circulou no grupo. Por isso vira card de upgrade e não
    // um toast que some em três segundos.
    if (dados.plano_limit) {
      document.getElementById('conviteUpgradeMotivo').textContent =
        'Faça upgrade para trazer a banda inteira pelo link de convite.';
      document.getElementById('conviteUpgrade').hidden = false;
      return;
    }

    if (!dados.sucesso) {
      cifroToast(dados.mensagem || 'Não foi possível gerar o convite.', 'error');
      return;
    }

    document.getElementById('conviteUpgrade').hidden = true;

    renderConvite(dados.estado);

    const resultado = await window.CifroConviteShare.share({
      bandaNome: dados.banda_nome,
      link: window.location.origin + dados.caminho,
    });
    if (resultado === 'copied') cifroToast('Link copiado! Vale por 24 horas.', 'success');
  } catch (e) {
    cifroToast('Não foi possível gerar o convite.', 'error');
  }
}

async function revogarConvite() {
  const ok = await cifroConfirm({
    title: 'Revogar convite',
    message: 'Os links de convite desta banda param de funcionar imediatamente. Quem já entrou continua na banda.',
    confirmText: 'Sim, revogar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;

  try {
    const res = await cifroFetch(API_CONVITE, { action: 'revogar' });
    if (res.sucesso) {
      renderConvite({ ativo: false });
      cifroToast('Convite revogado.', 'success');
    } else {
      cifroToast(res.mensagem || 'Erro ao revogar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao revogar.', 'error');
  }
}

carregarConvite();

carregarUsuarios();
</script>
<script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';</script>
<script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
<script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
