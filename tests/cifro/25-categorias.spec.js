import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/categorias/api.php';

test('cadastra, edita e exclui categoria', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const createResponse = await page.request.post(API, {
    headers,
    data: JSON.stringify({ nome: '__CATEGORIA_TESTE__' }),
  });
  expect(createResponse.status()).toBe(200);
  const created = await createResponse.json();
  expect(created.ok).toBeTruthy();

  const updateResponse = await page.request.post(API, {
    headers,
    data: JSON.stringify({ id: created.id, nome: '__CATEGORIA_EDITADA__' }),
  });
  expect(updateResponse.status()).toBe(200);

  const syncResponse = await page.request.get('/api/sync/data.php');
  const sync = await syncResponse.json();
  expect(sync.categorias.some(category => category.nome === '__CATEGORIA_EDITADA__')).toBeTruthy();

  const deleteResponse = await page.request.post(API, {
    headers,
    data: JSON.stringify({ action: 'delete', id: created.id }),
  });
  expect(deleteResponse.status()).toBe(200);
});

test('GET lista categorias da banda', async ({ page }) => {
  const res = await page.request.get(API);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.categorias)).toBe(true);
});

test('método não permitido (PUT) retorna 405', async ({ page }) => {
  const res = await page.request.put(API);
  expect(res.status()).toBe(405);
  const body = await res.json();
  expect(body.ok).toBe(false);
});

test('delete com id inválido retorna erro 422', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const res = await page.request.post(API, {
    headers,
    data: JSON.stringify({ action: 'delete', id: 'nao-numerico' }),
  });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.ok).toBe(false);
  expect(body.error).toContain('inválida');
});

test('nome duplicado retorna 409 e conflito de revisão retorna 409', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const nome = '__CATEGORIA_DUPLICADA__' + Date.now();

  const first = await page.request.post(API, { headers, data: JSON.stringify({ nome }) });
  expect(first.status()).toBe(200);
  const created = await first.json();

  try {
    const duplicate = await page.request.post(API, { headers, data: JSON.stringify({ nome }) });
    expect(duplicate.status()).toBe(409);
    const duplicateBody = await duplicate.json();
    expect(duplicateBody.error).toContain('Já existe');

    const conflict = await page.request.post(API, {
      headers,
      data: JSON.stringify({ action: 'delete', id: created.id, baseRevision: 1 }),
    });
    expect(conflict.status()).toBe(409);
    const conflictBody = await conflict.json();
    expect(conflictBody.content_revision).toBeGreaterThan(1);
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: created.id }) });
  }
});

test('nome equivalente com acento ou caixa diferente devolve a categoria existente', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const nome = `__EQUIV_Adoração_${Date.now()}__`;

  const first = await page.request.post(API, { headers, data: JSON.stringify({ nome }) });
  expect(first.status()).toBe(200);
  const created = await first.json();

  try {
    const equivalent = await page.request.post(API, {
      headers,
      data: JSON.stringify({ nome: nome.replace('Adoração', 'adoracao') }),
    });
    expect(equivalent.status()).toBe(409);
    const body = await equivalent.json();
    expect(body.categoria.id).toBe(created.id);
    expect(body.categoria.nome).toBe(nome);
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: created.id }) });
  }
});

test('exibe categorias cadastradas na home e no editor', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.locator('.filter-group .chip')).not.toHaveCount(0);

  await page.goto('/src/backend/editor/editor.php');
  await expect(page.locator('#classificacao option')).not.toHaveCount(0);
  await expect(page.locator('#classificacao option').first()).toHaveText('Sem categoria');
  await expect(page.locator('label[for="classificacao"]')).toContainText('Categoria');
});

test('cancela edição e cancela exclusão sem remover', async ({ page }) => {
  const nome = `__CANCEL_${Date.now()}__`;

  await page.goto('/categorias.php');
  await page.getByPlaceholder('Nome da categoria').fill(nome);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const row = page.locator('.category-row', { hasText: nome });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('#cancelEdit')).toBeVisible();
  await page.locator('#cancelEdit').click();
  await expect(page.getByPlaceholder('Nome da categoria')).toHaveValue('');

  await row.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(row).toHaveCount(0);
});

test('exibe onboarding para lista vazia e trata falha ao salvar', async ({ page }) => {
  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Falha simulada' }) });
  });

  await page.goto('/categorias.php');
  await expect(page.locator('.category-empty')).toHaveCount(0);
  await expect(page.getByText('Organize as músicas do seu jeito')).toBeVisible();

  await page.getByPlaceholder('Nome da categoria').fill('__FALHA_SIMULADA__');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('.cifro-toast, .toast', { hasText: 'Falha simulada' })).toBeVisible();

  await page.unroute('**/src/backend/categorias/api.php');
});

test('erro ao carregar lista de categorias exibe mensagem de falha', async ({ page }) => {
  let first = true;
  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET' && first) {
      first = false;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Erro de carregamento' }) });
    }
    return route.continue();
  });

  await page.goto('/categorias.php');
  await expect(page.locator('.category-empty')).toHaveText('Não foi possível carregar as categorias.');

  await page.unroute('**/src/backend/categorias/api.php');
});

test('lista de categorias mostra quantas músicas cada uma tem', async ({ page }) => {
  // O seed de testes garante zero categorias para a banda (ver
  // tests/setup/limpar-residuo.js): sem esta categoria descartável, a
  // asserção abaixo não teria linha nenhuma para observar. A categoria fica
  // sem músicas de propósito — o caso com músicas já é coberto pelo teste
  // seguinte ('categoria em uso...').
  const marcador = `__CONTAGEM_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    await page.goto('/minha-banda.php?aba=categorias');
    const primeira = page.locator('.category-row').first();
    await expect(primeira).toBeVisible();
    await expect(primeira.locator('.category-count')).toHaveText(/(\d+ músicas?|1 música|nenhuma música)/);
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('categoria em uso mostra o motivo antes de tentar excluir', async ({ page }) => {
  const marcador = `__EM_USO_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    // Uma música fictícia com essa categoria, injetada no payload de sync: o
    // teste mede a interface, não o cadastro real de músicas.
    await page.route('**/api/sync/data.php', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.musicas = [{ id: 90003, nome: 'Música do teste', artista: 'Teste', classificacao: marcador, cifra: 'C', bit: '' }];
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    await page.goto('/minha-banda.php?aba=categorias');
    const linha = page.locator('.category-row', { hasText: marcador });
    await expect(linha.locator('.category-count')).toHaveText('1 música');
    await expect(linha.getByRole('button', { name: 'Excluir' })).toBeDisabled();

    await page.unroute('**/api/sync/data.php');
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('banda sem categorias vê os três kits de exemplo', async ({ page }) => {
  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.continue();
  });

  await page.goto('/minha-banda.php?aba=categorias');
  await expect(page.getByText('Organize as músicas do seu jeito')).toBeVisible();
  await expect(page.locator('.category-kit')).toHaveCount(3);
  await expect(page.getByText('Pelo momento do culto')).toBeVisible();
  await expect(page.getByText('Depois de criadas, elas viram filtros na tela inicial e uma opção no editor de cada música.')).toBeVisible();

  await page.unroute('**/src/backend/categorias/api.php');
});

test('aplicar um kit cria todas as categorias do conjunto', async ({ page }) => {
  const sufixo = Date.now();
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const criadas = [];

  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.continue();
  });

  try {
    await page.goto('/minha-banda.php?aba=categorias');
    await page.locator('.category-kit', { hasText: 'Pelo estilo da música' }).getByRole('button').click();
    await expect(page.locator('.cifro-toast, .toast')).toContainText('categorias criadas');

    await page.unroute('**/src/backend/categorias/api.php');
    const lista = await (await page.request.get(API)).json();
    for (const nome of ['Lenta', 'Animada', 'Congregacional']) {
      const encontrada = lista.categorias.find(item => item.nome === nome);
      expect(encontrada, `categoria ${nome} deveria existir`).toBeTruthy();
      criadas.push(encontrada.id);
    }
  } finally {
    for (const id of criadas) {
      await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id }) });
    }
  }
});

test('remove categoria da home sem manter o cache antigo', async ({ page }) => {
  const nome = `__CACHE_${Date.now()}__`;

  await page.goto('/categorias.php');
  await page.getByPlaceholder('Nome da categoria').fill(nome);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const row = page.locator('.category-row', { hasText: nome });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(row).toHaveCount(0);

  await page.goto('/index.php');
  await expect(page.locator('.filter-group .chip', { hasText: nome })).toHaveCount(0);
});

test('gestor cria categoria sem sair do editor', async ({ page }) => {
  const nome = `__EDITOR_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  try {
    await page.goto('/src/backend/editor/editor.php');
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await page.locator('#novaCategoriaNome').fill(nome);
    await page.getByRole('button', { name: 'Criar categoria' }).click();

    await expect(page.locator('#classificacao')).toHaveValue(nome);
  } finally {
    const lista = await (await page.request.get(API)).json();
    const criada = (lista.categorias || []).find(item => item.nome === nome);
    if (criada) await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('escolher "+ Nova categoria…" sem criar não salva a música com o marcador de menu', async ({ page }) => {
  const nome = `__SENTINELA_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  let createdId;

  try {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill(nome);
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G</b>'));

    // "+ Nova categoria…" é uma ação de menu, não uma seleção: o select
    // nunca deve ficar parado no sentinela __nova__.
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await expect(page.locator('#novaCategoriaCampo')).toBeVisible();
    await expect(page.locator('#classificacao')).not.toHaveValue('__nova__');
    await expect(page.locator('#classificacao')).toHaveValue('');

    // Cancelar só precisa esconder o popup: a seleção já foi restaurada.
    await page.locator('#novaCategoriaCampo').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#novaCategoriaCampo')).toBeHidden();
    await expect(page.locator('#classificacao')).toHaveValue('');

    // Reabre o popup e salva com Ctrl+S enquanto ele ainda está aberto: o
    // valor enviado ao servidor não pode ser o sentinela.
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await expect(page.locator('#novaCategoriaCampo')).toBeVisible();
    await page.keyboard.press('Control+s');
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const sync = await page.request.get('/api/sync/data.php');
    const data = await sync.json();
    const musica = data.musicas.find(item => item.nome === nome);
    expect(musica).toBeTruthy();
    createdId = musica.id;
    expect(musica.classificacao).not.toBe('__nova__');
    expect(musica.classificacao).toBe('');
  } finally {
    if (createdId) {
      await page.request.post('/src/backend/editor/api.php', {
        headers,
        data: JSON.stringify({ action: 'delete', id: createdId }),
      });
    }
  }
});

test('chip de categoria lista apenas músicas daquela categoria', async ({ page }) => {
  const marcador = `__CHIP_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    await page.route('**/api/sync/data.php', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.musicas = [
        { id: 90001, nome: 'Dentro da categoria', artista: 'Teste', classificacao: marcador, cifra: 'C G', bit: '' },
        { id: 90002, nome: 'Fora da categoria', artista: 'Teste', classificacao: '', cifra: 'letra com ' + marcador, bit: '' }
      ];
      body.categorias = [{ id: criada.id, nome: marcador }];
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    await page.goto('/index.php');
    await page.locator('.filter-group .chip', { hasText: marcador }).click();

    await expect(page.locator('#music-list')).toContainText('Dentro da categoria');
    await expect(page.locator('#music-list')).not.toContainText('Fora da categoria');
    await expect(page.locator('#search')).toHaveValue('');

    await page.locator('.filter-group .chip', { hasText: 'Todas' }).click();
    await expect(page.locator('#music-list')).toContainText('Fora da categoria');

    await page.unroute('**/api/sync/data.php');
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('categoria salva no sessionStorage que não existe mais volta a mostrar tudo com "Todas" ativa', async ({ page }) => {
  const marcador = `__CHIP_ORFAO_${Date.now()}__`;
  const categoriaOrfa = `__ORFA_${Date.now()}__`;

  // Simula uma sessão anterior em que a categoria ainda existia: o usuário
  // filtrou por ela e o nome ficou salvo no sessionStorage. Depois a
  // categoria foi excluída (fluxo existente em categorias.php) e agora o
  // sync não a devolve mais — o nome guardado ficou órfão.
  await page.addInitScript((nome) => {
    sessionStorage.setItem('cifroHomeCategory', nome);
  }, categoriaOrfa);

  await page.route('**/api/sync/data.php', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.musicas = [
      { id: 90201, nome: 'Música dentro', artista: 'Teste', classificacao: marcador, cifra: 'C', bit: '' },
      { id: 90202, nome: 'Música fora', artista: 'Teste', classificacao: '', cifra: 'C', bit: '' }
    ];
    body.categorias = [{ id: 999999, nome: marcador }];
    return route.fulfill({ response, body: JSON.stringify(body) });
  });

  try {
    await page.goto('/index.php');

    await expect(page.locator('.filter-group .chip', { hasText: 'Todas' })).toHaveClass(/chip--active/);
    await expect(page.locator('#music-list')).toContainText('Música dentro');
    await expect(page.locator('#music-list')).toContainText('Música fora');
  } finally {
    await page.unroute('**/api/sync/data.php');
  }
});

test('categoria ativa é excluída no meio da sessão e a home volta a mostrar tudo com "Todas" ativa', async ({ page }) => {
  const marcador = `__ATIVA_EXCLUIDA_${Date.now()}__`;
  let categorias = [{ id: 999997, nome: marcador }];

  await page.route('**/api/sync/data.php', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.musicas = [
      { id: 90301, nome: 'Música dentro', artista: 'Teste', classificacao: marcador, cifra: 'C', bit: '' },
      { id: 90302, nome: 'Música fora', artista: 'Teste', classificacao: '', cifra: 'C', bit: '' }
    ];
    body.categorias = categorias;
    return route.fulfill({ response, body: JSON.stringify(body) });
  });

  try {
    await page.goto('/index.php');
    await page.locator('.filter-group .chip', { hasText: marcador }).click();
    await expect(page.locator('.filter-group .chip', { hasText: marcador })).toHaveClass(/chip--active/);
    await expect(page.locator('#music-list')).toContainText('Música dentro');
    await expect(page.locator('#music-list')).not.toContainText('Música fora');
    expect(await page.evaluate(() => sessionStorage.getItem('cifroHomeCategory'))).toBe(marcador);

    // A categoria some do back-end (excluída em outra aba/sessão enquanto
    // esta ficou com o chip ativo): o próximo sync já não a traz mais.
    categorias = [];
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    // O handler de 'cifro:sync' em index.php (public/src/Views/index.php) é
    // quem revalida categoriaAtiva contra window.categorias e limpa o
    // filtro; dispara aqui de novo, sem detail, porque ele só lê
    // window.categorias — já atualizado pelo sync acima.
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('cifro:sync')));

    await expect(page.locator('.filter-group .chip', { hasText: 'Todas' })).toHaveClass(/chip--active/);
    await expect(page.locator('#music-list')).toContainText('Música dentro');
    await expect(page.locator('#music-list')).toContainText('Música fora');
    expect(await page.evaluate(() => sessionStorage.getItem('cifroHomeCategory'))).toBeNull();
  } finally {
    await page.unroute('**/api/sync/data.php');
  }
});

test('banda sem categorias explica o que fazer no editor', async ({ page }) => {
  await page.route('**/api/sync/data.php', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.categorias = [];
    return route.fulfill({ response, body: JSON.stringify(body) });
  });

  await page.goto('/src/backend/editor/editor.php');
  await expect(page.locator('#categoriaAviso')).toContainText('Sua banda ainda não tem categorias.');

  await page.unroute('**/api/sync/data.php');
});

test('checklist da banda aponta para a aba de categorias quando não há nenhuma', async ({ page }) => {
  const sync = await (await page.request.get('/api/sync/data.php')).json();
  const bandId = sync.banda_id;
  const categorias = dbQuery('SELECT id, banda_id, nome FROM categorias WHERE banda_id = ? ORDER BY id', [bandId]).rows;
  dbQuery('DELETE FROM categorias WHERE banda_id = ?', [bandId]);
  try {
    await page.goto('/minha-banda.php?aba=categorias');
    const checklist = page.locator('.mb-checklist');
    await expect(checklist.getByText('Configure sua banda')).toBeVisible();
    const passo = checklist.locator('li[data-passo="categorias"]');
    await expect(passo).toBeVisible();
    await expect(passo.getByRole('link')).toHaveAttribute('href', /aba=categorias/);
  } finally {
    for (const categoria of categorias) {
      dbQuery('INSERT INTO categorias (id, banda_id, nome) VALUES (?, ?, ?)', [categoria.id, categoria.banda_id, categoria.nome]);
    }
  }
});

test('criar categoria pelo editor marca a música como pendente de salvar', async ({ page }) => {
  // Regressão: definirCategoriaSelecionada() atribui .value programaticamente,
  // o que não dispara "input" — sem chamar detectDirty() explicitamente, a
  // categorização recém-criada não acendia o indicador e trocar de música
  // descartava a escolha em silêncio (confirmDiscard() via #newSongButton
  // retornava true de imediato, sem perguntar nada).
  const nomeMusica = `__DIRTY_MUSICA_${Date.now()}__`;
  const nomeCategoria = `__DIRTY_CATEGORIA_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  let songId, categoriaId;

  try {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill(nomeMusica);
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G</b>'));
    await page.keyboard.press('Control+s');
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
    await expect(page.locator('#dirtyIndicator')).toBeHidden();

    const afterSave = await (await page.request.get('/api/sync/data.php')).json();
    songId = afterSave.musicas.find(item => item.nome === nomeMusica)?.id;
    expect(songId, 'música recém-salva deveria existir no sync').toBeTruthy();

    // A música está "carregada" (igual a reabrir uma existente): cria a
    // categoria pelo popup do editor.
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await page.locator('#novaCategoriaNome').fill(nomeCategoria);
    await page.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(page.locator('#classificacao')).toHaveValue(nomeCategoria);

    // O toast afirma que a categoria foi selecionada; o indicador de
    // alteração pendente precisa concordar com isso.
    await expect(page.locator('#dirtyIndicator')).toBeVisible();

    // Trocar de música sem salvar precisa perguntar antes de descartar.
    await page.locator('#newSongButton').click();
    await expect(page.getByRole('dialog')).toContainText('Descartar alterações?');
    await page.getByRole('dialog').getByRole('button', { name: 'Continuar editando' }).click();

    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const afterCategoria = await (await page.request.get('/api/sync/data.php')).json();
    const musica = afterCategoria.musicas.find(item => String(item.id) === String(songId));
    expect(musica?.classificacao).toBe(nomeCategoria);
  } finally {
    if (songId) {
      await page.request.post('/src/backend/editor/api.php', {
        headers,
        data: JSON.stringify({ action: 'delete', id: songId }),
      });
    }
    const lista = await (await page.request.get(API)).json();
    categoriaId = (lista.categorias || []).find(item => item.nome === nomeCategoria)?.id;
    if (categoriaId) await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: categoriaId }) });
  }
});

test('Enter no campo de nova categoria cria a categoria', async ({ page }) => {
  // Regressão: não há <form> em editor.php, então Enter não tinha submissão
  // implícita nenhuma para acionar, e não havia keydown ligado ao campo —
  // apertar Enter não fazia nada.
  const nome = `__ENTER_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  try {
    await page.goto('/src/backend/editor/editor.php');
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await page.locator('#novaCategoriaNome').fill(nome);
    await page.locator('#novaCategoriaNome').press('Enter');

    await expect(page.locator('#classificacao')).toHaveValue(nome);
    await expect(page.locator('#novaCategoriaCampo')).toBeHidden();
  } finally {
    const lista = await (await page.request.get(API)).json();
    const criada = (lista.categorias || []).find(item => item.nome === nome);
    if (criada) await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('Escape no campo de nova categoria fecha o popup sem criar', async ({ page }) => {
  const nome = `__ESCAPE_${Date.now()}__`;

  await page.goto('/src/backend/editor/editor.php');
  await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
  await page.locator('#novaCategoriaNome').fill(nome);
  await page.locator('#novaCategoriaNome').press('Escape');

  await expect(page.locator('#novaCategoriaCampo')).toBeHidden();
  await expect(page.locator('#classificacao')).toHaveValue('');

  const lista = await (await page.request.get(API)).json();
  expect((lista.categorias || []).some(item => item.nome === nome)).toBe(false);
});

test('filtrar por chip de categoria sem músicas mostra mensagem específica, não o CTA de banda nova', async ({ page }) => {
  // Regressão: a lista vazia usava só o texto de busca para decidir entre
  // "Nenhuma música encontrada" e o empty-state de primeiro uso. Com um chip
  // ativo e a busca vazia, uma categoria sem músicas caía no empty-state de
  // banda nova ("Você ainda não tem músicas cadastradas" + CTA "Adicionar
  // primeira cifra"), mesmo para uma banda com centenas de músicas.
  const marcador = `__CHIP_VAZIO_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    await page.route('**/api/sync/data.php', async route => {
      const response = await route.fetch();
      const body = await response.json();
      // Banda "estabelecida": tem músicas, só nenhuma nesta categoria.
      body.musicas = [
        { id: 90301, nome: 'Música existente', artista: 'Teste', classificacao: '', cifra: 'C', bit: '' }
      ];
      body.categorias = [{ id: criada.id, nome: marcador }];
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    await page.goto('/index.php');
    await page.locator('.filter-group .chip', { hasText: marcador }).click();

    await expect(page.locator('#music-list')).toContainText(`Nenhuma música em ${marcador}`);
    await expect(page.locator('#music-list')).not.toContainText('Você ainda não tem músicas cadastradas');
    await expect(page.locator('#music-list').getByRole('link', { name: 'Adicionar primeira cifra' })).toHaveCount(0);

    await page.unroute('**/api/sync/data.php');
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});
