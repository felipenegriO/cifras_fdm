<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php csrf_meta(); ?>
  <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-confirm.js') ?>"></script>
  <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
  <title>Gerenciar Bandas</title>
  <script src="/src/js/cifro-theme.js"></script>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { font-family: var(--font-ui, sans-serif); padding: 0; margin: 0; background: var(--bg-0); color: var(--text-1); }
    .page-body { padding: 20px; max-width: 760px; margin: 0 auto; }
    .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }

    .banda-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--border-1); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-2); }
    .banda-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-1); min-height: 60px; }
    .banda-row:last-child { border-bottom: none; }
    .banda-info { flex: 1; min-width: 0; }
    .banda-nome { font-size: var(--text-base); font-weight: var(--fw-medium); color: var(--text-1); }
    .banda-meta { font-size: var(--text-xs); color: var(--text-2); margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .banda-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .banda-logo { width: 38px; height: 38px; border-radius: var(--radius-sm); background: var(--brand-soft); object-fit: contain; padding: 5px; flex-shrink: 0; }

    .tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; color: var(--text-2); background: var(--bg-3); }
    .tag-banda     { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,.1); }
    .tag-basico    { border-color: #a78bfa; color: #a78bfa; background: rgba(167,139,250,.1); }
    .tag-gratuito  { border-color: #38bdf8; color: #38bdf8; background: rgba(56,189,248,.1); }
    .tag-bloqueado { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,.1); }
    .tag-ativo     { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,.1); }
    .plan-hint { font-size: 11px; color: var(--text-3); margin-top: 6px; }

    .modal-overlay { display: none; position: fixed; inset: 0; background: var(--bg-overlay); z-index: var(--z-modal); align-items: center; justify-content: center; padding: 16px; }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--bg-elevated); border: 1px solid var(--border-1); border-radius: var(--radius-lg); padding: 24px; width: 100%; max-width: 460px; box-shadow: var(--shadow-3); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal-header h3 { margin: 0; font-size: var(--text-lg); }
    .modal-close { background: none; border: none; color: var(--text-2); cursor: pointer; font-size: 22px; line-height: 1; padding: 0; margin: 0; min-height: unset; }
    .modal-close:hover { color: var(--text-1); }

    .form-group { margin-top: 12px; }
    .form-group label { display: block; font-size: var(--text-sm); font-weight: var(--fw-medium); color: var(--text-2); margin-bottom: 4px; }
    .form-group input, .form-group select { width: 100%; height: 38px; padding: 0 10px; box-sizing: border-box; background: var(--bg-1); color: var(--text-1); border: 1px solid var(--border-1); border-radius: var(--radius-sm); font-family: inherit; font-size: var(--text-sm); }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--border-2); }
    .form-hint { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .modal-footer { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; justify-content: flex-end; }

    .btn-icon-sm { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--border-1); background: var(--bg-3); color: var(--text-2); cursor: pointer; transition: background var(--t-fast), color var(--t-fast); padding: 0; flex-shrink: 0; }
    .btn-icon-sm:hover { background: var(--bg-elevated); color: var(--text-1); }
    .btn-icon-sm.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

    .plan-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-1); }
  </style>
</head>
<body>
  <?php render_partial('topnav'); ?>

  <div class="page-body">
    <div class="toolbar">
      <button type="button" class="btn btn--primary" onclick="abrirModalNova()">
        <?= cifro_icon('plus', 16) ?> Nova Banda
      </button>
    </div>

    <ul class="banda-list" id="listaBandas"></ul>
  </div>

  <!-- ── Modal editar/criar ── -->
  <div class="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modalTitle">Nova Banda</h3>
        <button class="modal-close" onclick="fecharModal()" aria-label="Fechar">×</button>
      </div>

      <div class="form-group">
        <label for="bandaNome">Nome da banda</label>
        <input id="bandaNome" placeholder="Ex: Minha Banda">
      </div>

      <div class="form-group">
        <label for="bandaAtivo">Status</label>
        <select id="bandaAtivo">
          <option value="1">Ativo</option>
          <option value="0">Inativo</option>
        </select>
      </div>

      <div class="form-group">
        <label>Plano</label>
        <div class="plan-summary">
          <strong id="bandaPlanoLabel">Gratuito</strong>
          <button type="button" class="btn btn--secondary btn--sm" id="btnGerenciarPlano" onclick="gerenciarPlano()">Planos e pagamento</button>
        </div>
        <div class="plan-hint" id="planHint"></div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn--ghost" onclick="fecharModal()">Cancelar</button>
        <button type="button" class="btn btn--danger" id="btnDeletar" onclick="deletarBanda()"><?= cifro_icon('trash', 16) ?> Deletar</button>
        <button type="button" class="btn btn--primary" onclick="salvarBanda()"><?= cifro_icon('check', 16) ?> Salvar banda</button>
      </div>
    </div>
  </div>

<script>
const API = '/src/backend/bandas/salvar_banda.php';
let bandas = [];
let bandaAtualId = null;

const PLANO_LABELS = { trial: 'Gratuito', gratuito: 'Gratuito', mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual', bloqueado: 'Bloqueado', ativo: 'Mensal' };
const PLANO_TAG    = { trial: 'tag-gratuito', gratuito: 'tag-gratuito', mensal: 'tag-banda', semestral: 'tag-banda', anual: 'tag-banda', bloqueado: 'tag-bloqueado', ativo: 'tag-banda' };
const PLANO_LIMITES = {
  gratuito: '1 banda · 10 músicas',
  mensal:   '✓ Ilimitado',
  semestral:'✓ Ilimitado',
  anual:    '✓ Ilimitado',
  bloqueado:'✗ Acesso bloqueado',
  ativo:    '✓ Ilimitado',
};

async function carregarBandas() {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    const data = await res.json();
    bandas = Array.isArray(data) ? data : [];
  } catch (e) {
    bandas = [];
  }
  renderListaBandas();
}

function renderListaBandas() {
  const ul = document.getElementById('listaBandas');
  ul.innerHTML = '';
  if (bandas.length === 0) {
    ul.innerHTML = '<li style="padding:20px;text-align:center;color:var(--text-3);font-size:var(--text-sm);">Nenhuma banda cadastrada.</li>';
    return;
  }
  bandas.forEach(b => {
    const plano = b.plano === 'trial' ? 'gratuito' : (b.plano || 'gratuito');
    const li = document.createElement('li');
    li.className = 'banda-row';
    const logo = b.logo || '/src/images/cifro-mark.svg';
    li.innerHTML = `
      <img class="banda-logo" src="${escapeHtml(logo)}" alt="">
      <div class="banda-info">
        <div class="banda-nome">${escapeHtml(b.nome)}</div>
        <div class="banda-meta">
          <span class="tag ${PLANO_TAG[plano] || ''}">${PLANO_LABELS[plano] || plano}</span>
          ${!b.ativo || String(b.ativo) === '0' ? '<span class="tag">Inativa</span>' : ''}
        </div>
      </div>
      <div class="banda-actions">
        <button class="btn-icon-sm" title="Editar" onclick="abrirModalEditar('${b.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon-sm danger" title="Deletar" onclick="confirmarDeletar('${b.id}', '${escapeHtml(b.nome)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    ul.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mostrarPlano(plano, novaBanda = false) {
  const normalizado = plano === 'trial' ? 'gratuito' : (plano || 'gratuito');
  document.getElementById('bandaPlanoLabel').textContent = PLANO_LABELS[normalizado] || normalizado;
  document.getElementById('planHint').textContent = novaBanda
    ? 'A nova banda começa no plano gratuito. A contratação será feita na tela de pagamento.'
    : (PLANO_LIMITES[normalizado] || '');
  document.getElementById('btnGerenciarPlano').style.display = novaBanda ? 'none' : '';
}

function abrirModalNova() {
  bandaAtualId = null;
  document.getElementById('modalTitle').textContent = 'Nova Banda';
  document.getElementById('bandaNome').value = '';
  document.getElementById('bandaAtivo').value = '1';
  document.getElementById('btnDeletar').style.display = 'none';
  mostrarPlano('gratuito', true);
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('bandaNome').focus();
}

function abrirModalEditar(id) {
  const b = bandas.find(b => b.id === id);
  if (!b) return;
  bandaAtualId = id;
  document.getElementById('modalTitle').textContent = 'Editar Banda';
  document.getElementById('bandaNome').value = b.nome || '';
  document.getElementById('bandaAtivo').value = (!!b.ativo && String(b.ativo) !== '0') ? '1' : '0';
  document.getElementById('btnDeletar').style.display = '';
  mostrarPlano(b.plano);
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('bandaNome').focus();
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

async function salvarBanda() {
  const nome = document.getElementById('bandaNome').value.trim();
  if (!nome) { cifroToast('Nome é obrigatório.', 'error'); return; }

  const payload = {
    action: 'save',
    id: bandaAtualId || undefined,
    nome,
    ativo: parseInt(document.getElementById('bandaAtivo').value, 10),
    trial_expira_em: null,
  };

  try {
    const res = await cifroFetch(API, payload);
    if (res.sucesso) {
      cifroToast('Banda salva!', 'success');
      fecharModal();
      if (!bandaAtualId && res.id) {
        await selecionarBandaParaPagamento(res.id);
        return;
      }
      await carregarBandas();
    } else {
      cifroToast(res.mensagem || 'Erro ao salvar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao salvar.', 'error');
  }
}

async function selecionarBandaParaPagamento(id) {
  const res = await cifroFetch('/src/backend/bandas/selecionar.php', { bandaId: id });
  if (!res.sucesso) throw new Error(res.mensagem || 'Não foi possível selecionar a banda.');
  window.location.href = '/plano.php#planos';
}

async function gerenciarPlano() {
  if (!bandaAtualId) return;
  try {
    await selecionarBandaParaPagamento(bandaAtualId);
  } catch (e) {
    cifroToast(e.message || 'Não foi possível abrir o pagamento.', 'error');
  }
}

async function confirmarDeletar(id, nome) {
  const ok = await cifroConfirm({
    title: 'Deletar banda',
    message: 'A banda <strong>' + escapeHtml(nome) + '</strong> e todos os seus dados serão removidos permanentemente.',
    confirmText: 'Sim, deletar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;
  try {
    const res = await cifroFetch(API, { action: 'delete', id });
    if (res.sucesso) {
      cifroToast('Banda deletada.', 'success');
      await carregarBandas();
    } else {
      cifroToast(res.mensagem || 'Erro ao deletar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao deletar.', 'error');
  }
}

function deletarBanda() {
  if (!bandaAtualId) return;
  const b = bandas.find(b => b.id === bandaAtualId);
  fecharModal();
  if (b) confirmarDeletar(b.id, b.nome);
}

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

carregarBandas();
</script>
<script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';</script>
<script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
<script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
</body>
</html>
