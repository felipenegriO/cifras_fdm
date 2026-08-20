import { test, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

function assertSafeE2eDatabase() {
  if (String(process.env.APP_ENV).toLowerCase() !== 'test') throw new Error('APP_ENV=test é obrigatório.');
  if (!/(?:^|[_-])(?:e2e|test)(?:$|[_-])/i.test(String(process.env.E2E_DB_NAME || ''))) throw new Error('Banco E2E inválido.');
}

function ensureChangeLog() {
  const exists = Number(dbQuery("SELECT COUNT(*) total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='sync_changes'").rows[0]?.total || 0);
  if (exists > 0) return;
  dbQuery(`CREATE TABLE IF NOT EXISTS sync_changes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    banda_id CHAR(36) NOT NULL,
    revision BIGINT UNSIGNED NOT NULL,
    entity_type ENUM('musica','playlist','roteiro','categoria') NOT NULL,
    entity_id INT NOT NULL DEFAULT 0,
    operation ENUM('upsert','delete','replace') NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), INDEX idx_sync_changes_banda_revision (banda_id, revision),
    FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function login(page) {
  await page.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
  await page.goto('/index.php');
  const authenticated = await page.evaluate(() => Boolean(window.CIFRO_USER_ID)).catch(() => false);
  if (!authenticated) {
    await page.goto('/login.php');
    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#senha').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/index\.php|select-banda\.php/);
  }
  await page.goto('/select-banda.php');
  await page.locator('.sb-card[data-band-id="00000000-0000-4000-8000-000000000002"]').click();
  await page.waitForURL(/index\.php/);
  await expect(page).toHaveURL(/index\.php/);
}

async function waitEditor(page) {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForFunction(() => Boolean(window.tinymce?.get('cifraInput')));
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cifroAppUpdatePending'))).toBe(null);
}

async function setCifra(page, html) {
  await page.evaluate(content => {
    const editor = window.tinymce.get('cifraInput');
    editor.setContent(content);
    editor.dispatch('input');
  }, html);
}

async function saveSong(page) {
  const responsePromise = page.waitForResponse(response => response.url().includes('/src/backend/editor/api.php') && response.request().method() === 'POST');
  await page.locator('#saveButton').click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBeTruthy();
  await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
  return body;
}

async function waitOfflineReady(page) {
  await expect.poll(() => page.evaluate(async () => {
    const status = await cifroSync.getOfflineStatus(window.CIFRO_BAND_ID);
    return status.shellReady && status.shellPreparedRevision === status.contentRevision;
  }), { timeout: 120000 }).toBe(true);
}

function emptyMetrics() {
  return { full: 0, delta: 0, version: 0, songPages: new Map(), songFetches: new Map() };
}

test('criação, navegação sem mudança e edição sincronizam somente a música afetada', async ({ page, context }) => {
  assertSafeE2eDatabase();
  ensureChangeLog();
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const original = { nome: `__E2E_INCREMENTAL_${suffix}__`, letra: `Linha inicial ${suffix}`, acorde: 'C G Am F' };
  const edited = { nome: `__E2E_INCREMENTAL_EDITADA_${suffix}__`, letra: `Linha alterada ${suffix}`, acorde: 'D A Bm G' };
  let songId = null;
  let phase = 'initial';
  const metrics = { initial: emptyMetrics(), create: emptyMetrics(), unchanged: emptyMetrics(), edit: emptyMetrics() };

  context.on('request', request => {
    const current = metrics[phase];
    if (!current) return;
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/sync/data.php')) current.full++;
    if (url.pathname.endsWith('/api/sync/changes.php')) current.delta++;
    if (url.pathname.endsWith('/api/sync/version.php')) current.version++;
    if (url.pathname.endsWith('/music.php') && url.searchParams.has('id')) {
      const id = url.searchParams.get('id');
      current.songPages.set(id, (current.songPages.get(id) || 0) + 1);
      if (request.resourceType() === 'fetch') current.songFetches.set(id, (current.songFetches.get(id) || 0) + 1);
    }
  });

  try {
    await test.step('entra na aplicação e conclui a sincronização inicial', async () => {
      await login(page);
      await waitOfflineReady(page);
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    });

    await test.step('cadastra uma música pela interface', async () => {
      await waitEditor(page);
      metrics.create = emptyMetrics();
      phase = 'create';
      await page.locator('#titulo').fill(original.nome);
      await setCifra(page, `<b>${original.acorde}</b><br>${original.letra}`);
      const saved = await saveSong(page);
      songId = saved.id;
      expect(saved.musica.nome).toBe(original.nome);
      await expect.poll(() => page.evaluate(id => cifroSync.getRecentSong(window.CIFRO_BAND_ID, id)?.nome || '', songId)).toBe(original.nome);
    });

    await test.step('volta à home e prepara somente a nova música', async () => {
      await page.goto('/index.php');
      await waitOfflineReady(page);
      await page.locator('#search').fill(original.nome);
      await expect(page.locator('#music-list a', { hasText: original.nome })).toBeVisible();
      expect(metrics.create.full).toBe(0);
      expect(metrics.create.songPages.get(String(songId)) || 0).toBe(0);
      expect([...metrics.create.songPages.keys()].filter(id => id !== String(songId))).toEqual([]);
    });

    await test.step('abre a música, valida e volta sem iniciar nova sincronização', async () => {
      const fetchesBeforeOpen = metrics.create.songFetches.get(String(songId)) || 0;
      await page.locator('#music-list a', { hasText: original.nome }).click();
      await expect(page.locator('#song-title')).toHaveText(original.nome);
      await expect(page.locator('#song-cifra')).toContainText(original.letra);
      await expect(page.locator('#song-cifra')).toContainText(original.acorde);
      await page.waitForTimeout(300);
      expect(metrics.create.songFetches.get(String(songId)) || 0).toBe(fetchesBeforeOpen);
      phase = 'unchanged';
      await page.goto('/index.php');
      await page.waitForTimeout(1500);
      expect(metrics.unchanged.full).toBe(0);
      expect(metrics.unchanged.delta).toBe(0);
      expect(metrics.unchanged.songPages.size).toBe(0);
    });

    await test.step('edita a mesma música com novas informações', async () => {
      phase = 'initial';
      await waitEditor(page);
      metrics.edit = emptyMetrics();
      phase = 'edit';
      await page.getByRole('tab', { name: 'Músicas' }).click();
      await page.locator('#buscaMusica').fill(original.nome);
      await page.locator(`#musicas button[data-song-id="${songId}"]`).click();
      await page.locator('#titulo').fill(edited.nome);
      await setCifra(page, `<b>${edited.acorde}</b><br>${edited.letra}`);
      const saved = await saveSong(page);
      expect(Number(saved.id)).toBe(Number(songId));
      expect(saved.musica.nome).toBe(edited.nome);
    });

    await test.step('volta à home e atualiza somente a música editada', async () => {
      await page.goto('/index.php');
      await waitOfflineReady(page);
      await page.locator('#search').fill(edited.nome);
      await expect(page.locator('#music-list a', { hasText: edited.nome })).toBeVisible();
      expect(metrics.edit.full).toBe(0);
      expect(metrics.edit.songPages.get(String(songId)) || 0).toBe(0);
      expect([...metrics.edit.songPages.keys()].filter(id => id !== String(songId))).toEqual([]);
    });

    await test.step('abre a cifra e confirma todas as alterações', async () => {
      await page.locator('#music-list a', { hasText: edited.nome }).click();
      await expect(page.locator('#song-title')).toHaveText(edited.nome);
      await expect(page.locator('#song-cifra')).toContainText(edited.letra);
      await expect(page.locator('#song-cifra')).toContainText(edited.acorde);
    });
  } finally {
    await context.setOffline(false).catch(() => {});
    if (songId) {
      const csrf = await (await page.request.get('/api/csrf.php')).json();
      const version = await (await page.request.get('/api/sync/version.php')).json();
      await page.request.post('/src/backend/editor/api.php', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrf_token },
        data: JSON.stringify({ action: 'delete', id: songId, baseRevision: version.content_revision }),
      });
    }
  }
});

test('cifra aberta recebe alteração remota sem exigir recarregamento', async ({ page }) => {
  assertSafeE2eDatabase();
  ensureChangeLog();
  const suffix = Date.now();
  const original = `__E2E_ATUALIZACAO_ABERTA_${suffix}__`;
  const updated = `${original}_NOVA`;
  let songId = null;
  try {
    await login(page);
    await waitEditor(page);
    await page.locator('#titulo').fill(original);
    await setCifra(page, '<b>C</b><br>Conteúdo anterior');
    songId = Number((await saveSong(page)).id);

    await page.goto('/index.php');
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    await page.locator('#search').fill(original);
    await page.locator('#music-list a', { hasText: original }).click();
    await expect(page.locator('#song-cifra')).toContainText('Conteúdo anterior');
    const documentInstance = await page.evaluate(() => {
      window.__cifroDocumentInstance = crypto.randomUUID();
      return window.__cifroDocumentInstance;
    });

    const csrf = await (await page.request.get('/api/csrf.php')).json();
    const version = await (await page.request.get('/api/sync/version.php')).json();
    const response = await page.request.post('/src/backend/editor/api.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrf_token },
      data: JSON.stringify({
        id: songId,
        nome: updated,
        cifra: '<b>D</b><br>Conteúdo atualizado remotamente',
        artista: '',
        classificacao: '',
        bit: '',
        baseRevision: version.content_revision,
      }),
    });
    expect(response.status(), await response.text()).toBe(200);

    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
    await expect(page.locator('#song-title')).toHaveText(updated);
    await expect(page.locator('#song-cifra')).toContainText('Conteúdo atualizado remotamente');
    expect(await page.evaluate(() => window.__cifroDocumentInstance)).toBe(documentInstance);
  } finally {
    if (songId) dbQuery('DELETE FROM musicas WHERE id=?', [songId]);
  }
});

test('exclusão feita em outro navegador propaga somente o ID removido e permanece offline', async ({ browser }) => {
  assertSafeE2eDatabase();
  ensureChangeLog();
  const mutatorContext = await browser.newContext({ storageState: 'tests/.auth/user.json' });
  const observerContext = await browser.newContext({ storageState: 'tests/.auth/user.json', serviceWorkers: 'allow' });
  const mutator = await mutatorContext.newPage();
  const observer = await observerContext.newPage();
  const nome = `__E2E_INCREMENTAL_DELETE_${Date.now()}__`;
  let songId = null;
  try {
    await login(mutator);
    await waitEditor(mutator);
    await mutator.locator('#titulo').fill(nome);
    await setCifra(mutator, '<b>Em</b><br>Linha para exclusão incremental');
    songId = Number((await saveSong(mutator)).id);

    await login(observer);
    await waitOfflineReady(observer);
    await observer.locator('#search').fill(nome);
    await expect(observer.locator('#music-list a', { hasText: nome })).toBeVisible();

    await waitEditor(mutator);
    await mutator.getByRole('tab', { name: 'Músicas' }).click();
    await mutator.locator('#buscaMusica').fill(nome);
    await mutator.locator(`#musicas button[data-song-id="${songId}"]`).click();
    await mutator.locator('#moreActions').evaluate(element => { element.open = true; });
    await mutator.locator('#deleteSongButton').click();
    await mutator.getByRole('dialog', { name: 'Excluir música' }).getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(mutator.locator('#status')).toHaveText('Música excluída com sucesso.');

    const deltaResponse = observer.waitForResponse(response => response.url().includes('/api/sync/changes.php'));
    await observer.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
    const delta = await (await deltaResponse).json();
    expect(delta.full_sync_required).toBe(false);
    expect(delta.changes.musicas.deleted).toEqual([songId]);
    expect(delta.changes.musicas.upsert).toEqual([]);
    expect(delta.changes.roteiros).toEqual({ upsert: [], deleted: [] });
    expect(delta.changes.playlists).toBeUndefined();
    expect(delta.changes.categorias).toBeUndefined();

    await observer.locator('#search').fill(nome);
    await expect(observer.locator('#music-list a', { hasText: nome })).toHaveCount(0);
    await observerContext.setOffline(true);
    await observer.reload({ waitUntil: 'domcontentloaded' });
    await observer.locator('#search').fill(nome);
    await expect(observer.locator('#music-list a', { hasText: nome })).toHaveCount(0);
  } finally {
    await observerContext.setOffline(false).catch(() => {});
    await mutatorContext.close().catch(() => {});
    await observerContext.close().catch(() => {});
    if (songId) dbQuery('DELETE FROM musicas WHERE id=?', [songId]);
  }
});

test('dois navegadores não sobrescrevem edição concorrente e o perdedor recupera a versão atual', async ({ browser }) => {
  assertSafeE2eDatabase();
  const firstContext = await browser.newContext({ storageState: 'tests/.auth/user.json' });
  const secondContext = await browser.newContext({ storageState: 'tests/.auth/user.json' });
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  const nome = `__E2E_CONFLICT_${Date.now()}__`;
  let songId = null;
  try {
    await login(first);
    await waitEditor(first);
    await first.locator('#titulo').fill(nome);
    await setCifra(first, '<b>C</b><br>Versão inicial');
    songId = Number((await saveSong(first)).id);

    await login(second);
    for (const page of [first, second]) {
      await waitEditor(page);
      await page.getByRole('tab', { name: 'Músicas' }).click();
      await page.locator('#buscaMusica').fill(nome);
      await page.locator(`#musicas button[data-song-id="${songId}"]`).click();
    }

    await first.locator('#titulo').fill(`${nome}_PRIMEIRO`);
    await setCifra(first, '<b>D</b><br>Alteração vencedora');
    await saveSong(first);

    await second.locator('#titulo').fill(`${nome}_SEGUNDO`);
    await setCifra(second, '<b>E</b><br>Alteração concorrente');
    const conflictResponse = second.waitForResponse(response => response.url().includes('/src/backend/editor/api.php') && response.request().method() === 'POST');
    await second.locator('#saveButton').click();
    const conflict = await conflictResponse;
    expect(conflict.status()).toBe(409);
    await expect(second.locator('#status')).not.toHaveText('Música salva com sucesso.');
    const persisted = dbQuery('SELECT nome, cifra FROM musicas WHERE id=?', [songId]).rows[0];
    expect(persisted.nome).toBe(`${nome}_PRIMEIRO`);
    expect(persisted.cifra).toContain('Alteração vencedora');
    expect(persisted.cifra).not.toContain('Alteração concorrente');

    await second.reload();
    await second.waitForFunction(() => Boolean(window.tinymce?.get('cifraInput')));
    await second.getByRole('tab', { name: 'Músicas' }).click();
    await second.locator('#buscaMusica').fill(`${nome}_PRIMEIRO`);
    await second.locator(`#musicas button[data-song-id="${songId}"]`).click();
    await expect(second.locator('#titulo')).toHaveValue(`${nome}_PRIMEIRO`);
    expect(await second.evaluate(() => window.tinymce.get('cifraInput').getContent())).toContain('Alteração vencedora');
  } finally {
    await firstContext.close().catch(() => {});
    await secondContext.close().catch(() => {});
    if (songId) dbQuery('DELETE FROM musicas WHERE id=?', [songId]);
  }
});
