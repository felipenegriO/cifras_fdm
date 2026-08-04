import { test, expect } from '../fixtures/coverage.js';

async function csrf(page) {
  return (await (await page.request.get('/api/csrf.php')).json()).csrf_token;
}

test('rejeita gravação baseada em revisão antiga', async ({ page }) => {
  const token = await csrf(page);
  const initial = await (await page.request.get('/api/sync/version.php')).json();
  const name = '__REVISION_' + Date.now() + '__';
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': token };

  const createdResponse = await page.request.post('/src/backend/categorias/api.php', {
    headers,
    data: JSON.stringify({ nome: name, baseRevision: initial.content_revision }),
  });
  expect(createdResponse.ok()).toBeTruthy();
  const created = await createdResponse.json();
  expect(created.content_revision).toBe(initial.content_revision + 1);

  const stale = await page.request.post('/src/backend/categorias/api.php', {
    headers,
    data: JSON.stringify({ nome: name + '_STALE', baseRevision: initial.content_revision }),
  });
  expect(stale.status()).toBe(409);

  const removed = await page.request.post('/src/backend/categorias/api.php', {
    headers,
    data: JSON.stringify({ action: 'delete', id: created.id, baseRevision: created.content_revision }),
  });
  expect(removed.ok()).toBeTruthy();
});

test('falha ao substituir playlists preserva o snapshot anterior', async ({ page }) => {
  const token = await csrf(page);
  const before = await (await page.request.get('/api/sync/data.php')).json();
  const response = await page.request.post('/src/backend/editor/salvar_playlists.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify({ playlists: [{}], baseRevision: before.content_revision }),
  });
  expect(response.ok()).toBeFalsy();
  const after = await (await page.request.get('/api/sync/data.php')).json();
  expect(after.playlists).toEqual(before.playlists);
  expect(after.content_revision).toBe(before.content_revision);
});
