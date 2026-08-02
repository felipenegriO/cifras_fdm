import { test, expect } from '../fixtures/coverage.js';

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

test('exibe categorias cadastradas na home e no editor', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.locator('.filter-group .chip')).not.toHaveCount(0);

  await page.goto('/src/backend/editor/editor.php');
  await expect(page.locator('#classificacao option')).not.toHaveCount(0);
  await expect(page.locator('#classificacao option').first()).toHaveText('Não classificada');
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

test('exibe mensagem de lista vazia e trata falha ao carregar/salvar', async ({ page }) => {
  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Falha simulada' }) });
  });

  await page.goto('/categorias.php');
  await expect(page.locator('.category-empty')).toHaveText('Nenhuma categoria cadastrada.');

  await page.getByPlaceholder('Nome da categoria').fill('__FALHA_SIMULADA__');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('.fdm-toast, .toast', { hasText: 'Falha simulada' })).toBeVisible();

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
