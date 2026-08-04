import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function loadSync(page) {
  await page.evaluate(() => {
    window.CifroConnectivity = { isServerAvailable: () => true };
  });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/src/js/cifro-sync.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }));
}

test('cifro-sync rejeita matrizes de snapshots inválidos', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase('cifro');
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
    delete window.CIFRO_USER_ID;
    window.CIFRO_BAND_ID = 'banda-validacao';
    window.songs = null;
    window.playlistsSalvas = null;
    window.roteirosSalvos = null;
    window.categorias = null;
  });
  await loadSync(page);

  const base = {
    banda_id: 'banda-validacao', content_revision: 1,
    musicas: [], playlists: [], roteiros: [], categorias: [],
  };
  const invalid = [
    null,
    { ...base, banda_id: 'outra' },
    { ...base, content_revision: -1 },
    { ...base, musicas: null },
    { ...base, musicas: [{ id: 'x', nome: 'Inválida', cifra: '' }] },
    { ...base, musicas: [{ id: 1, nome: 2, cifra: '' }] },
    { ...base, musicas: [{ id: 1, nome: 'Inválida', cifra: 2 }] },
    { ...base, playlists: [{ nome: 'Lista', itens: [{ id: 1, tom: 'H' }] }] },
    { ...base, playlists: [{ nome: 2, itens: [] }] },
    { ...base, roteiros: [{ id: 'x', titulo: 'R' }] },
    { ...base, categorias: [{ id: 1, nome: 2 }] },
  ];

  for (const payload of invalid) {
    await page.route('**/api/sync/data.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }), { times: 1 });
    expect(await page.evaluate(() => window.cifroSync.sync('banda-validacao', { force: true }))).toBe(false);
  }

  const globals = await page.evaluate(() => ({
    songs: window.songs,
    playlists: window.playlistsSalvas,
    roteiros: window.roteirosSalvos,
    categorias: window.categorias,
  }));
  expect(globals).toEqual({ songs: [], playlists: [], roteiros: [], categorias: [] });
});

test('cifro-sync cobre defaults de snapshot, mutações e status vazio', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase('cifro');
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
    window.CIFRO_USER_ID = 'coverage-user';
    window.CIFRO_BAND_ID = 'banda-defaults';
  });
  await loadSync(page);

  const before = await page.evaluate(async () => ({
    revision: await cifroSync.getRevision('banda-defaults'),
    prepared: await cifroSync.markPrepared('banda-defaults'),
    offline: await cifroSync.getOfflineStatus('banda-defaults'),
    status: await cifroSync.getSyncStatus('banda-defaults'),
  }));
  expect(before.revision).toBe(0);
  expect(before.prepared).toBe(false);
  expect(before.offline.ready).toBe(false);
  expect(before.status.snapshotValid).toBe(false);

  await page.route('**/api/sync/data.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      banda_id: 'banda-defaults', content_revision: 0,
      musicas: [], playlists: [], roteiros: [], categorias: [],
    }),
  }), { times: 1 });
  expect(await page.evaluate(() => cifroSync.sync('banda-defaults', { force: true }))).toBe(true);

  const mutations = await page.evaluate(async () => ({
    playlist: await cifroSync.applyMutation('/src/backend/editor/salvar_playlists.php', {}, { content_revision: 2 }, 'banda-defaults'),
    roteiro: await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {}, { content_revision: 3 }, 'banda-defaults'),
    musica: await cifroSync.applyMutation('/src/backend/editor/api.php', {}, { content_revision: 4 }, 'banda-defaults'),
    categoria: await cifroSync.applyMutation('/src/backend/categorias/api.php', {}, { content_revision: 5 }, 'banda-defaults'),
  }));
  expect(mutations).toEqual({ playlist: true, roteiro: true, musica: true, categoria: true });
});
