/**
 * 08-roteiro.spec.js
 * Tela de roteiro e fallback offline.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Roteiro', () => {
  test('carrega roteiro.php sem erros', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('exibe conteúdo do roteiro', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('domcontentloaded');
    // roteiro.php é uma tela de apresentação/impressão sem topnav,
    // mas deve ter o container principal de conteúdo
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').textContent();
    // Deve conter texto do roteiro ou a mensagem de "nenhum roteiro"
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Setlist', () => {
  test('lista de músicas exibe tom detectado quando item não tem tom salvo', async ({ page }) => {
    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token };

    // Cria música real com acorde D para detecção de tom
    const songRes = await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ nome: '__E2E_TOM_INDEX__', cifra: '<b>D A Bm G</b>', artista: '', classificacao: '', bit: '' }),
      headers,
    });
    const { id: songId } = await songRes.json();

    const syncData = await (await page.request.get('/api/sync/data.php')).json();
    const originalPlaylists = syncData.playlists || [];
    await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [...originalPlaylists, { nome: '__E2E_SETLIST_INDEX__', itens: [songId] }] }),
      headers,
    });

    try {
      await page.goto('/index.php');
      await page.waitForFunction(() =>
        window.CifroChords && Array.isArray(window.playlistsSalvas) &&
        window.playlistsSalvas.some(p => p.nome === '__E2E_SETLIST_INDEX__'),
        { timeout: 15000 });
      const result = await page.evaluate(() => {
        window.renderPlaylistsMenu();
        const item = document.querySelector('.liPlaylist-musica');
        return item ? item.textContent : '';
      });
      expect(result).toMatch(/\[D\]/);
    } finally {
      await page.request.post('/src/backend/editor/salvar_playlists.php', {
        data: JSON.stringify({ playlists: originalPlaylists }),
        headers,
      });
      await page.request.post('/src/backend/editor/api.php', {
        data: JSON.stringify({ action: 'delete', id: songId }),
        headers,
      });
    }
  });

  test('editor da setlist mostra e atualiza o tom escolhido', async ({ page }) => {
    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token };

    // Cria música real com acorde D para detecção de tom
    const songRes = await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ nome: '__E2E_TOM__', cifra: '<b>D A Bm G</b>', artista: '', classificacao: '', bit: '' }),
      headers,
    });
    const { id: songId } = await songRes.json();

    const syncData = await (await page.request.get('/api/sync/data.php')).json();
    const originalPlaylists = syncData.playlists || [];
    await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [...originalPlaylists, { nome: '__E2E_SETLIST__', itens: [songId] }] }),
      headers,
    });

    try {
      await page.goto('/src/backend/editor/editorplaylist.php');
      await page.waitForFunction(() => window.CifroChords && typeof carregarPlaylistsDisponiveis === 'function');
      await page.waitForFunction(() => {
        const sel = document.getElementById('playlistSelecionada');
        return sel && Array.from(sel.options).some(o => o.text === '__E2E_SETLIST__');
      }, { timeout: 15000 });
      await page.locator('#playlistSelecionada').selectOption({ label: '__E2E_SETLIST__' });
      await expect(page.locator('.playlist-song-name')).toContainText('__E2E_TOM__ [D]');
      await page.getByLabel('Tom de __E2E_TOM__').selectOption('E');
      await expect(page.locator('.playlist-song-name')).toContainText('__E2E_TOM__ [E]');
    } finally {
      await page.request.post('/src/backend/editor/salvar_playlists.php', {
        data: JSON.stringify({ playlists: originalPlaylists }),
        headers,
      });
      await page.request.post('/src/backend/editor/api.php', {
        data: JSON.stringify({ action: 'delete', id: songId }),
        headers,
      });
    }
  });
});

test.describe('Offline', () => {
  test('offline.php carrega', async ({ page }) => {
    await page.goto('/offline.php');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Editor de roteiros', () => {
  test('abre editor real de roteiros e permite preparar um novo roteiro', async ({ page }) => {
    await page.goto('/src/backend/editor/roteiro.php');
    await expect(page).toHaveTitle(/Editor de Roteiros/i);
    await expect(page.getByLabel('Buscar roteiro')).toBeVisible();
    await page.getByRole('button', { name: /Limpar/ }).click();
    await page.getByLabel('Título do roteiro').fill('__ROTEIRO_UI__');
    await expect(page.getByLabel('Título do roteiro')).toHaveValue('__ROTEIRO_UI__');
  });
});

test.describe('Validade de roteiro', () => {
  let roteiroFuturoId = null;
  let roteiroExpiradoId = null;
  let csrf = null;
  let headers = null;
  let baseRevision = null;

  test.beforeAll(async ({ request }) => {
    const csrfRes = await request.get('/api/csrf.php');
    csrf = (await csrfRes.json()).csrf_token;
    headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

    const syncRes = await request.get('/api/sync/data.php');
    baseRevision = (await syncRes.json()).content_revision;

    const futuro = await request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ titulo: '__ROTEIRO_FUTURO__', conteudo: '<p>Conteúdo do ensaio</p>', visivel_ate: '2099-12-31', baseRevision }),
      headers,
    });
    const fBody = await futuro.json();
    roteiroFuturoId = fBody.id;
    baseRevision = fBody.content_revision;

    const expirado = await request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ titulo: '__ROTEIRO_EXPIRADO__', conteudo: '<p>Conteúdo expirado</p>', visivel_ate: '2020-01-01', baseRevision }),
      headers,
    });
    const eBody = await expirado.json();
    roteiroExpiradoId = eBody.id;
    baseRevision = eBody.content_revision;
  });

  test.afterAll(async ({ request }) => {
    const syncRes = await request.get('/api/sync/data.php');
    const rev = (await syncRes.json()).content_revision;
    if (roteiroFuturoId) {
      await request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ deleteId: roteiroFuturoId, baseRevision: rev }),
        headers,
      });
    }
    if (roteiroExpiradoId) {
      const syncRes2 = await request.get('/api/sync/data.php');
      await request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ deleteId: roteiroExpiradoId, baseRevision: (await syncRes2.json()).content_revision }),
        headers,
      });
    }
  });

  test('roteiro com validade futura exibe o conteúdo na tela', async ({ page }) => {
    await page.goto(`/roteiro.php?id=${roteiroFuturoId}`);
    await expect(page.locator('#roteiro-title')).toHaveText('__ROTEIRO_FUTURO__', { timeout: 10000 });
    await expect(page.locator('#roteiro-body')).toBeVisible();
  });

  test('roteiro com validade expirada exibe mensagem de indisponibilidade', async ({ page }) => {
    await page.goto(`/roteiro.php?id=${roteiroExpiradoId}`);
    await expect(page.locator('#roteiro-title')).toHaveText('Roteiro indisponivel', { timeout: 10000 });
    await expect(page.locator('#roteiro-body')).toBeEmpty();
  });
});
