/**
 * 04-editor-musicas.spec.js
 * Editor de músicas — CRUD via API.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/editor/api.php';

// Helper: pega CSRF token via endpoint leve (sem disparar JS de background)
async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Editor de Músicas — Tela', () => {
  test('carrega a tela do editor', async ({ page }) => {
    await page.goto('/index.php'); // editor está integrado ao index ou acesso direto
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });
});

test.describe('Editor de Músicas — API', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista músicas da banda via sync API', async ({ page }) => {
    // O endpoint de listagem é a sync API (api.php só suporta POST com CSRF)
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.musicas)).toBe(true);
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: 'Teste', cifra: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST cria música com CSRF válido', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: '__TESTE_AUTO__', cifra: 'Am G F', artista: 'Teste', classificacao: '', bit: '' }),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();

    // Cleanup: deletar música criada
    if (body.id) {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST delete de ID inexistente não quebra', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: 999999 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Pode ser sucesso ou "não encontrado", mas não pode ser 500
    expect(typeof body).toBe('object');
  });
});

test.describe('API Playlists', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista playlists via sync API', async ({ page }) => {
    // salvar_playlists.php só aceita POST com CSRF; a listagem vem da sync API
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.playlists)).toBe(true);
  });

  test('POST cria playlist e deleta', async ({ page }) => {
    const res = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ action: 'save', nome: '__PLAYLIST_AUTO__', itens: [], visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();
    if (body.id) {
      await page.request.post('/src/backend/editor/salvar_playlists.php', {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});

test.describe('API Roteiros', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista roteiros via sync API', async ({ page }) => {
    // salvar_roteiros.php só aceita POST com CSRF; a listagem vem da sync API
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.roteiros)).toBe(true);
  });

  test('POST cria roteiro e deleta', async ({ page }) => {
    const res = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ action: 'save', titulo: '__ROTEIRO_AUTO__', conteudo: 'Teste', visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();
    if (body.id) {
      await page.request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});
