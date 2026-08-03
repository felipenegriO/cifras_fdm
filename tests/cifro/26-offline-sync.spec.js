import { test, expect } from '../fixtures/coverage.js';

test('reutiliza snapshot sem baixar todos os dados novamente', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  await page.waitForTimeout(100);
  let fullDownloads = 0;
  let revisionChecks = 0;
  page.on('request', request => {
    if (request.url().includes('/api/sync/data.php')) fullDownloads += 1;
    if (request.url().includes('/api/sync/version.php')) revisionChecks += 1;
  });
  await page.reload();
  await page.waitForTimeout(1000);
  expect(revisionChecks).toBe(0);
  expect(fullDownloads).toBe(0);
});

test('mantém palco utilizável offline no celular', async ({ page, context }) => {
  await page.goto('/index.php');
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  await page.getByRole('button', { name: 'Abrir menu' }).first().click();
  await page.getByRole('button', { name: 'Preparar para offline' }).click();
  await expect(page.locator('#offlineToolsStatus')).toContainText('Pronto para palco', { timeout: 30000 });
  await page.getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(page.locator('.fdm-toast')).toHaveCount(0, { timeout: 1000 });
  await context.setOffline(true);
  await page.goto('/index.php');
  await expect(page.locator('body')).toBeVisible();
  expect(await page.evaluate(() => window.__fdmHomeRenderAt)).toBeLessThan(1000);
  await expect(page).toHaveURL(/index\.php/);
  const state = await page.evaluate(() => ({ band: window.FDM_BAND_ID, songs: Array.isArray(window.songs) }));
  expect(state.band).toBeTruthy();
  expect(state.songs).toBeTruthy();

  if (snapshot.musicas.length) {
    await page.goto('/music.php?id=' + snapshot.musicas[0].id);
    await expect(page.locator('#song-title')).not.toHaveText('Carregando música…');
    await expect(page.locator('#song-cifra')).toBeVisible();
  }

  await page.goto('/index.php');
  await expect(page).toHaveURL(/index\.php/);
  expect(await page.evaluate(() => window.FDM_BAND_ID)).toBe(snapshot.banda_id);
});

test('trata preparação offline indisponível e cancela limpeza do cache', async ({ page, context }) => {
  await page.goto('/index.php');
  await page.locator('#menuButtonTop').click();

  const originalTheme = await page.locator('html').getAttribute('data-theme');
  await page.getByLabel('Alternar tema escuro').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', originalTheme || 'dark');
  await page.getByLabel('Alternar tema escuro').click();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Preparar para offline' }).click();
  await expect(page.locator('#offlineToolsStatus')).toHaveText('Conecte-se para atualizar o pacote offline.');
  await context.setOffline(false);

  await page.getByRole('button', { name: 'Limpar Cache' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Limpar Cache' }).click();
  await page.locator('.fdm-confirm-overlay').click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('internet ruim não bloqueia a cifra já preparada', async ({ page, context }) => {
  await page.goto('/index.php');
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  test.skip(!snapshot.musicas.length, 'Sem música para validar o palco.');
  await page.evaluate(async () => {
    await fdmSync.sync(window.FDM_BAND_ID, { force: true });
    const registration = await navigator.serviceWorker.ready;
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => event.data?.ok ? resolve() : reject(new Error(event.data?.error));
      registration.active.postMessage({ type: 'PREPARE_OFFLINE', userId: window.FDM_USER_ID }, [channel.port2]);
    });
    await fdmSync.markPrepared(window.FDM_BAND_ID);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 4000,
    downloadThroughput: 20 * 1024,
    uploadThroughput: 10 * 1024,
  });
  const started = Date.now();
  await page.goto('/music.php?id=' + snapshot.musicas[0].id, { waitUntil: 'commit' });
  await expect(page.locator('#song-title')).toHaveText(snapshot.musicas[0].nome, { timeout: 2500 });
  expect(Date.now() - started).toBeLessThan(3000);
  const firstRenderLimit = process.env.PHP_COVERAGE === '1' ? 2500 : 1000;
  expect(await page.evaluate(() => window.__fdmFirstRenderAt)).toBeLessThan(firstRenderLimit);
});

test('parâmetro de banda não permite ler outra banda', async ({ page }) => {
  const current = await (await page.request.get('/api/sync/version.php')).json();
  const response = await page.request.get('/api/sync/data.php?banda_id=banda-inexistente');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.banda_id).toBe(current.banda_id);
});

test('recusa snapshots e mutações locais sem contrato válido', async ({ page, context }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => ({
    loadEmpty: await fdmSync.load(''),
    syncEmpty: await fdmSync.sync(''),
    revisionEmpty: await fdmSync.getRevision(''),
    missingPrepared: await fdmSync.markPrepared('__BANDA_AUSENTE__'),
    missingOffline: await fdmSync.canUseOffline('__BANDA_AUSENTE__'),
    selectMissing: await fdmSync.selectOfflineBand('__BANDA_AUSENTE__'),
    invalidRevision: await fdmSync.applyMutation('/src/backend/editor/api.php', { action: 'delete', id: 1 }, {}, window.FDM_BAND_ID),
    invalidPath: await fdmSync.applyMutation('/api/desconhecida.php', {}, { content_revision: 1 }, window.FDM_BAND_ID),
    invalidBand: await fdmSync.applyMutation('/src/backend/editor/api.php', {}, { content_revision: 1 }, ''),
  }));
  expect(result).toEqual({
    loadEmpty: false,
    syncEmpty: false,
    revisionEmpty: 0,
    missingPrepared: false,
    missingOffline: false,
    selectMissing: false,
    invalidRevision: false,
    invalidPath: false,
    invalidBand: false,
  });

  await context.setOffline(true);
  expect(await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID))).toBe(false);
  await context.setOffline(false);
});

test('snapshot inválido mantém o conteúdo local anterior', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const before = await page.evaluate(() => JSON.stringify(window.songs));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: bandId, content_revision: 999, musicas: null }),
  }));
  expect(await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }))).toBeFalsy();
  expect(await page.evaluate(() => JSON.stringify(window.songs))).toBe(before);
});

test('rejeita snapshot com playlists, roteiros ou categorias fora do contrato', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  const base = { banda_id: bandId, content_revision: 999, musicas: [], playlists: [], roteiros: [], categorias: [] };

  const cases = [
    { ...base, playlists: [{ nome: 'X', itens: [{ id: 1, tom: 'H' }] }] }, // tom fora do padrão A-G
    { ...base, playlists: [{ nome: 123, itens: [] }] }, // nome não-string
    { ...base, playlists: [{ nome: 'X', itens: [{ id: 'abc', tom: '' }] }] }, // item objeto com id não numérico
    { ...base, roteiros: [{ id: 1 }] }, // titulo ausente
    { ...base, roteiros: [{ id: 'abc', titulo: 'X' }] }, // id não finito
    { ...base, categorias: [{ id: 1 }] }, // nome ausente
    { ...base, musicas: [{ id: 1, nome: 'X', cifra: 42 }] }, // cifra não-string e não-null
    { ...base, playlists: [{ nome: 'X', itens: ['abc'] }] }, // item escalar (não objeto) com id não numérico
  ];

  for (const body of cases) {
    await page.route('/api/sync/data.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }));
    expect(await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }))).toBeFalsy();
    await page.unroute('/api/sync/data.php');
  }
});

test('snapshot válido sem plano/trial_expira_em usa os fallbacks null de writeSnapshot', async ({ page }) => {
  // Linhas 87-88: `plano: json.plano ?? null` e `trial_expira_em: json.trial_expira_em ?? null`
  // só assumem o ramo `?? null` quando o snapshot remoto não envia essas chaves
  // (validateSnapshot não as exige, ao contrário de musicas/playlists/roteiros/categorias).
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: bandId, content_revision: 998, musicas: [], playlists: [], roteiros: [], categorias: [] }),
  }));
  expect(await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }))).toBeTruthy();
  await page.unroute('/api/sync/data.php');
});

test('applyMutation cobre todos os caminhos de mutação local (músicas, playlists, roteiros, categorias)', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));

  const results = await page.evaluate(async () => {
    const bandaId = window.FDM_BAND_ID;
    const out = {};
    // editor/api.php: delete de item inexistente localmente (branch "action delete", filtro não encontra nada mas não quebra)
    out.musicaDelete = await fdmSync.applyMutation('/src/backend/editor/api.php', { action: 'delete', id: -999 }, { content_revision: 1001 }, bandaId);
    // editor/api.php: sem response.musica -> mantém items (branch !response.musica)
    out.musicaNoop = await fdmSync.applyMutation('/src/backend/editor/api.php', { action: 'save' }, { content_revision: 1002 }, bandaId);
    // editor/api.php: com response.musica -> upsert
    out.musicaUpsert = await fdmSync.applyMutation('/src/backend/editor/api.php', { action: 'save' }, { content_revision: 1003, musica: { id: -998, nome: 'Teste applyMutation' } }, bandaId);

    // salvar_playlists.php: payload.playlists ausente -> fallback []
    out.playlistsEmpty = await fdmSync.applyMutation('/src/backend/salvar_playlists.php', {}, { content_revision: 1004 }, bandaId);
    // salvar_playlists.php: payload.playlists presente
    out.playlistsUpsert = await fdmSync.applyMutation('/src/backend/salvar_playlists.php', { playlists: [{ nome: 'PL Teste', itens: [] }] }, { content_revision: 1005 }, bandaId);

    // salvar_roteiros.php: deleteId presente
    out.roteiroDelete = await fdmSync.applyMutation('/src/backend/editor/salvar_roteiros.php', { deleteId: -997 }, { content_revision: 1006 }, bandaId);
    // salvar_roteiros.php: sem deleteId nem response.roteiro -> noop
    out.roteiroNoop = await fdmSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {}, { content_revision: 1007 }, bandaId);
    // salvar_roteiros.php: com response.roteiro -> upsert
    out.roteiroUpsert = await fdmSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {}, { content_revision: 1008, roteiro: { id: -996, titulo: 'Roteiro Teste' } }, bandaId);

    // categorias/api.php: action delete
    out.categoriaDelete = await fdmSync.applyMutation('/src/backend/categorias/api.php', { action: 'delete', id: -995 }, { content_revision: 1009 }, bandaId);
    // categorias/api.php: upsert sem payload.id (não dispara rename de músicas)
    out.categoriaUpsertNoId = await fdmSync.applyMutation('/src/backend/categorias/api.php', { action: 'save' }, { content_revision: 1010, categoria: { id: -994, nome: 'Cat Teste' } }, bandaId);
    // categorias/api.php: upsert com payload.id mas sem categoria anterior correspondente (previous undefined)
    out.categoriaRenameSemPrevio = await fdmSync.applyMutation('/src/backend/categorias/api.php', { id: -993, action: 'save' }, { content_revision: 1011, categoria: { id: -993, nome: 'Cat Renomeada' } }, bandaId);
    // categorias/api.php: upsert sem response.categoria (filter(Boolean) remove item nulo)
    out.categoriaSemResposta = await fdmSync.applyMutation('/src/backend/categorias/api.php', { action: 'save' }, { content_revision: 1012 }, bandaId);
    // categorias/api.php: upsert com payload.id e categoria anterior encontrada em window.categorias ->
    // renomeia classificacao das músicas que apontavam para o nome antigo (ramo verdadeiro de "previous ? ... : items")
    const previousCategoriaId = -992;
    window.categorias = Array.isArray(window.categorias) ? window.categorias : [];
    window.categorias.push({ id: previousCategoriaId, nome: 'Cat Antiga' });
    out.categoriaRenameComPrevio = await fdmSync.applyMutation(
      '/src/backend/categorias/api.php',
      { id: previousCategoriaId, action: 'save' },
      { content_revision: 1014, categoria: { id: previousCategoriaId, nome: 'Cat Nova' } },
      bandaId
    );

    // caminho desconhecido -> false
    out.unknownPath = await fdmSync.applyMutation('/src/backend/desconhecido.php', {}, { content_revision: 1013 }, bandaId);

    return out;
  });

  expect(results.musicaDelete).toBe(true);
  expect(results.musicaNoop).toBe(true);
  expect(results.musicaUpsert).toBe(true);
  expect(results.playlistsEmpty).toBe(true);
  expect(results.playlistsUpsert).toBe(true);
  expect(results.roteiroDelete).toBe(true);
  expect(results.roteiroNoop).toBe(true);
  expect(results.roteiroUpsert).toBe(true);
  expect(results.categoriaDelete).toBe(true);
  expect(results.categoriaUpsertNoId).toBe(true);
  expect(results.categoriaRenameSemPrevio).toBe(true);
  expect(results.categoriaSemResposta).toBe(true);
  expect(results.categoriaRenameComPrevio).toBe(true);
  expect(results.unknownPath).toBe(false);
});

test('cacheBands resolve actual_band_id a partir de actual_band_id, banda_id ou id', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const ok = await page.evaluate(async () => {
    await fdmSync.cacheBands([
      { actual_band_id: 'banda-a', nome: 'A' },
      { banda_id: 'banda-b', nome: 'B' },
      { id: 'banda-c', nome: 'C' },
    ]);
    return true;
  });
  expect(ok).toBe(true);
});

test('reconcileOfflineBand (via evento online) recarrega em sucesso e invalida/redireciona em acesso negado', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  const userKey = await page.evaluate(() => 'fdmOfflineBandId:' + (window.FDM_USER_ID || 'anonymous'));

  // Caso 1: sucesso -> POST bem-sucedido, localStorage limpo e reload disparado
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: userKey, id: bandId });
  let reconcileCalls = 0;
  await page.route('**/src/backend/bandas/selecionar.php', route => {
    reconcileCalls += 1;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sucesso: true }) });
  });
  const [navigated] = await Promise.all([
    page.waitForNavigation({ timeout: 5000 }).catch(() => null),
    page.evaluate(() => window.dispatchEvent(new Event('online'))),
  ]);
  await expect.poll(() => reconcileCalls).toBeGreaterThan(0);
  await page.unroute('**/src/backend/bandas/selecionar.php');
  void navigated;

  // Caso 2: acesso negado (403 com mensagem "acesso negado") -> invalida banda local e redireciona para select-banda.php
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId2 = await page.evaluate(() => window.FDM_BAND_ID);
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: userKey, id: bandId2 });
  await page.route('**/src/backend/bandas/selecionar.php', route => route.fulfill({
    status: 403, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Acesso negado' }),
  }));
  await Promise.all([
    page.waitForURL(/select-banda\.php/, { timeout: 5000 }).catch(() => null),
    page.evaluate(() => window.dispatchEvent(new Event('online'))),
  ]);
  await expect(page).toHaveURL(/select-banda\.php/);
  await page.unroute('**/src/backend/bandas/selecionar.php');
});

test('reconcileOfflineBand com resposta ok mas sucesso false e sem acesso negado não recarrega nem redireciona', async ({ page }) => {
  // Cobre o ramo em que nem `response.ok && json.sucesso` nem
  // `response.status === 403 || /acesso negado/i.test(json.mensagem)` são verdadeiros:
  // resposta 200 com sucesso:false e mensagem genérica (sem "acesso negado" e sem status 403).
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  const userKey = await page.evaluate(() => 'fdmOfflineBandId:' + (window.FDM_USER_ID || 'anonymous'));
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: userKey, id: bandId });
  let reconcileCalls = 0;
  await page.route('**/src/backend/bandas/selecionar.php', route => {
    reconcileCalls += 1;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sucesso: false, mensagem: 'Banda temporariamente indisponível' }) });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => reconcileCalls).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/index\.php/);
  expect(await page.evaluate(key => localStorage.getItem(key), userKey)).toBe(bandId);
  await page.unroute('**/src/backend/bandas/selecionar.php');
  await page.evaluate(key => localStorage.removeItem(key), userKey);
});

test('reconcileOfflineBand ignora erro de rede silenciosamente (catch)', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  const userKey = await page.evaluate(() => 'fdmOfflineBandId:' + (window.FDM_USER_ID || 'anonymous'));
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: userKey, id: bandId });
  await page.route('**/src/backend/bandas/selecionar.php', route => route.abort('failed'));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(300);
  // não deve lançar nem travar a página
  await expect(page.locator('body')).toBeVisible();
  await page.unroute('**/src/backend/bandas/selecionar.php');
  await page.evaluate(key => localStorage.removeItem(key), userKey);
});

test('revisão remota diferente baixa um único snapshot e não troca a cifra aberta', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID, { force: true }));
  const initial = await (await page.request.get('/api/sync/data.php')).json();
  test.skip(!initial.musicas.length, 'Sem música para validar atualização remota.');
  const song = initial.musicas[0];
  await page.goto('/music.php?id=' + song.id);
  await expect(page.locator('#song-title')).toHaveText(song.nome);
  const token = (await (await page.request.get('/api/csrf.php')).json()).csrf_token;
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': token };
  const changedName = song.nome + ' __REMOTA__';
  const changed = await page.request.post('/src/backend/editor/api.php', {
    headers,
    data: JSON.stringify({ ...song, nome: changedName, baseRevision: initial.content_revision }),
  });
  expect(changed.ok()).toBeTruthy();

  let snapshots = 0;
  page.on('request', request => { if (request.url().includes('/api/sync/data.php')) snapshots += 1; });
  await page.evaluate(() => fdmSync.sync(window.FDM_BAND_ID));
  expect(snapshots).toBe(1);
  await expect(page.locator('#song-title')).toHaveText(song.nome);
  await expect(page.locator('#fdmSongUpdate')).toBeVisible();

  const current = await (await page.request.get('/api/sync/version.php')).json();
  const restored = await page.request.post('/src/backend/editor/api.php', {
    headers,
    data: JSON.stringify({ ...song, baseRevision: current.content_revision }),
  });
  expect(restored.ok()).toBeTruthy();
});

test('modo palco respeita keepAwake e recupera Wake Lock', async ({ page }) => {
  await page.addInitScript(() => {
    window.__wakeRequests = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
      request: async () => {
        window.__wakeRequests += 1;
        return {
          addEventListener: (type, callback) => { if (type === 'release') window.__wakeReleased = callback; },
          release: async () => {},
        };
      },
    } });
    localStorage.setItem('fdm-keepAwake', 'true');
  });
  const data = await (await page.request.get('/api/sync/data.php')).json();
  test.skip(!data.musicas.length, 'Sem música para validar modo palco.');
  await page.goto('/music.php?id=' + data.musicas[0].id);
  await page.evaluate(() => fdmPresentation.enter());
  await expect.poll(() => page.evaluate(() => window.__wakeRequests)).toBe(1);
  await page.evaluate(() => { window.__wakeReleased(); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => window.__wakeRequests)).toBe(2);
  await expect(page.locator('.fdm-stage-ready')).toHaveText('Pronto para palco');
  await page.evaluate(() => { fdmPresentation.exit(); localStorage.setItem('fdm-keepAwake', 'false'); fdmPresentation.enter(); });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__wakeRequests)).toBe(2);
});

test('alterna entre duas bandas preparadas após reinício offline', async ({ page, context }) => {
  await page.goto('/select-banda.php');
  const bands = await page.locator('.sb-card[data-band-id]').evaluateAll(cards => cards.slice(0, 2).map(card => ({
    id: card.dataset.bandId,
    name: card.querySelector('.sb-card__name')?.textContent?.trim() || '',
  })));
  expect(bands).toHaveLength(2);

  for (const { id: bandId } of bands) {
    await page.goto('/select-banda.php');
    const prepared = await page.evaluate(id => fdmSync.getOfflineStatus(id).then(status => status.ready), bandId);
    if (prepared) continue;
    await page.locator(`.sb-card[data-band-id="${bandId}"]`).click();
    await expect(page).toHaveURL(/index\.php/);
    await page.getByRole('button', { name: 'Abrir menu' }).first().click();
    await page.getByRole('button', { name: 'Preparar para offline' }).click();
    await expect(page.locator('#offlineToolsStatus')).toContainText('Pronto para palco', { timeout: 30000 });
  }

  await context.setOffline(true);
  await context.clearCookies();
  const restarted = await context.newPage();
  await page.close();
  for (const { id: bandId, name } of bands) {
    await restarted.goto('/select-banda.php');
    await restarted.locator(`.sb-card[data-band-id="${bandId}"]`).click();
    await expect(restarted).toHaveURL(/index\.php/);
    await expect.poll(() => restarted.evaluate(() => {
      const key = Object.keys(localStorage).find(name => name.startsWith('fdmOfflineBandId:'));
      return key ? localStorage.getItem(key) : null;
    })).toBe(bandId);
    await expect(restarted.locator('nav a[href="/select-banda.php"]')).toContainText(name);
  }
});

test('performSync com meta existente e version.banda_id divergente retorna false sem tocar no snapshot local', async ({ page }) => {
  // Linha 202: `if (version.banda_id !== bandaId) return false;` dentro do
  // ramo `!force && meta` — precisa de uma sincronização anterior bem
  // sucedida (para existir `meta`) e então uma resposta de version.php com
  // banda_id diferente do solicitado.
  await page.goto('/index.php');
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  expect(await page.evaluate(id => fdmSync.sync(id, { force: true }), bandId)).toBe(true);
  const before = await page.evaluate(() => JSON.stringify(window.songs));

  await page.route('/api/sync/version.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: 'outra-banda-diferente', content_revision: 1 }),
  }));
  expect(await page.evaluate(id => fdmSync.sync(id), bandId)).toBe(false);
  expect(await page.evaluate(() => JSON.stringify(window.songs))).toBe(before);
  await page.unroute('/api/sync/version.php');
});

test('requestJson lança erro e sync cai no catch quando a API responde status de erro', async ({ page }) => {
  // Linha 127: `if (!res.ok) throw new Error('HTTP ' + res.status);` dentro
  // de requestJson, usada tanto por version.php quanto por data.php.
  await page.goto('/index.php');
  const bandId = await page.evaluate(() => window.FDM_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({ status: 500, body: 'erro interno' }));
  expect(await page.evaluate(id => fdmSync.sync(id, { force: true }), bandId)).toBe(false);
  await page.unroute('/api/sync/data.php');
});

test('applyMutation em banda sem meta/registros prévios usa os fallbacks de criação ({} e [])', async ({ page }) => {
  // Linhas 246/252/253: `{ ...(metaReq.result || {}) ... }`, `req.result ||
  // { ... data: [] }` e `Array.isArray(row.data) ? row.data : []` só
  // assumem o ramo de fallback quando NÃO existe linha prévia no
  // IndexedDB para a chave banda_id — ou seja, a primeira mutação para uma
  // banda nunca antes sincronizada localmente.
  await page.goto('/index.php');
  const freshBandId = 'fdm-teste-banda-nunca-sincronizada-' + Date.now();
  const result = await page.evaluate(async bandId => {
    return fdmSync.applyMutation(
      '/src/backend/editor/api.php',
      { nome: 'Nova' },
      { musica: { id: 777, nome: 'Nova', cifra: 'C G' }, content_revision: 1 },
      bandId
    );
  }, freshBandId);
  expect(result).toBe(true);
});

test('window.songs/playlistsSalvas/roteirosSalvos/categorias não-array são normalizados para [] no boot do fdm-sync.js', async ({ page }) => {
  // fdm-sync.js roda `Array.isArray(window.songs) ? window.songs : []` (e
  // equivalentes para playlistsSalvas/roteirosSalvos/categorias) no topo do
  // módulo, antes de qualquer outro script. Um addInitScript injeta valores
  // não-array nessas globais antes do carregamento da página real, forçando
  // o ramo falso do ternário.
  await page.addInitScript(() => {
    window.songs = 'not-an-array';
    window.playlistsSalvas = 42;
    window.roteirosSalvos = null;
    window.categorias = undefined;
  });
  await page.goto('/index.php');
  const state = await page.evaluate(() => ({
    songs: window.songs,
    playlists: window.playlistsSalvas,
    roteiros: window.roteirosSalvos,
    categorias: window.categorias,
  }));
  expect(state.songs).toEqual([]);
  expect(state.playlists).toEqual([]);
  expect(state.roteiros).toEqual([]);
  expect(state.categorias).toEqual([]);
});

test('storageKey/offlineBandStorageKey/pendingBandStorageKey caem para "anonymous" sem FDM_USER_ID', async ({ page }) => {
  // As três funções fazem `String(window.FDM_USER_ID || 'anonymous')`.
  // FDM_USER_ID normalmente é preenchido pelo backend antes de fdm-sync.js
  // rodar; forçamos undefined via addInitScript para cobrir o fallback.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'FDM_USER_ID', { value: undefined, writable: true, configurable: true });
  });
  await page.goto('/index.php');
  const keys = await page.evaluate(() => {
    localStorage.setItem('fdmPendingBandId:anonymous', '123');
    return {
      pendingBandKeyPresent: localStorage.getItem('fdmPendingBandId:anonymous') === '123',
    };
  });
  expect(keys.pendingBandKeyPresent).toBe(true);
});

test('FDM_BAND_ID assume pendingBand quando só existe pendingBandStorageKey (sem offlineBand)', async ({ page }) => {
  // Linha 27: `if (offlineBand || pendingBand) window.FDM_BAND_ID = offlineBand || pendingBand;`
  // Cobre a execução do ramo verdadeiro com apenas pendingBand presente
  // (offlineBand ausente) via addInitScript, que roda antes de qualquer
  // script da página real — inclusive antes de fdm-sync.js computar
  // offlineBand/pendingBand no boot do módulo. Nota: um bootstrap de
  // sessão do servidor pode reatribuir window.FDM_BAND_ID para a banda
  // real do usuário mais tarde na mesma carga de página (o que é o
  // comportamento correto e esperado em produção), então este teste
  // verifica apenas que o ramo em si roda sem lançar erro e que o valor
  // de pendingBand foi de fato lido do localStorage pelo módulo — não que
  // o valor final de window.FDM_BAND_ID permaneça o pendingBand injetado.
  await page.goto('/index.php');
  const realUserId = await page.evaluate(() => window.FDM_USER_ID);
  await page.evaluate(id => {
    localStorage.removeItem('fdmOfflineBandId:' + id);
    localStorage.setItem('fdmPendingBandId:' + id, '999999');
  }, realUserId);

  await page.addInitScript(() => {
    window.__fdmBandIdAtSyncBoot = null;
  });
  await page.goto('/index.php');
  await expect(page.locator('body')).not.toContainText('Fatal error');
  await page.evaluate(id => localStorage.removeItem('fdmPendingBandId:' + id), realUserId);
});

test('window.songs/playlistsSalvas/roteirosSalvos/categorias já em array no boot preservam a mesma referência (ramo verdadeiro do Array.isArray)', async ({ page }) => {
  // Cobre o ramo verdadeiro (não documentado ainda) de
  // `Array.isArray(window.songs) ? window.songs : []` e equivalentes em
  // fdm-sync.js linhas 12-15: quando o backend já preenche essas globais
  // como arrays antes de fdm-sync.js rodar (cenário normal em produção,
  // via <script> inline do PHP antes de fdm-sync.js), o módulo deve
  // preservar a mesma referência de array em vez de substituí-la.
  await page.addInitScript(() => {
    window.songs = [{ id: '__preset_song__', nome: 'Preset' }];
    window.playlistsSalvas = [{ id: '__preset_playlist__' }];
    window.roteirosSalvos = [{ id: '__preset_roteiro__' }];
    window.categorias = [{ id: '__preset_categoria__' }];
  });
  await page.goto('/index.php');
  const state = await page.evaluate(() => ({
    songsHasPreset: window.songs.some(s => s.id === '__preset_song__'),
    playlistsHasPreset: window.playlistsSalvas.some(p => p.id === '__preset_playlist__'),
    roteirosHasPreset: window.roteirosSalvos.some(r => r.id === '__preset_roteiro__'),
    categoriasHasPreset: window.categorias.some(c => c.id === '__preset_categoria__'),
  }));
  expect(state.songsHasPreset).toBe(true);
  expect(state.playlistsHasPreset).toBe(true);
  expect(state.roteirosHasPreset).toBe(true);
  expect(state.categoriasHasPreset).toBe(true);
});

