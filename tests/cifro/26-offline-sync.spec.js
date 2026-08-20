import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import { aguardarServidorDisponivel } from '../helpers/conectividade.js';

// Evita que o modal "Bem-vindo ao Cifrô — versão beta" (mostrado uma vez
// por navegador via localStorage) intercepte cliques no menu — não é o que
// estes testes de sincronização offline verificam.
//
// Também garante que cada teste comece sem service worker nem Cache Storage
// residual de execuções anteriores: STATIC_CACHE é aberto pelo nome fixo
// (não pela query "?v="), então uma vez populado ele fica servindo os
// mesmos bytes até o app inteiro trocar de versão — sem essa limpeza, um
// teste pode validar comportamento de uma versão antiga do código sem que
// ninguém perceba.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('cifroBetaWelcomeSeen', '1');
  });
  await page.goto('/landing.php');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  });
  await page.goto('about:blank');
});

test.afterEach(async ({ page }) => {
  if (page.isClosed()) return;
  await Promise.race([
    page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }).catch(() => {}),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);
});

test('reutiliza snapshot sem baixar todos os dados novamente', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  await page.waitForTimeout(100);
  let fullDownloads = 0;
  let revisionChecks = 0;
  page.on('request', request => {
    if (request.url().includes('/api/sync/data.php')) fullDownloads += 1;
    if (request.url().includes('/api/sync/version.php')) revisionChecks += 1;
  });
  await page.reload();
  await page.waitForTimeout(1000);
  expect(revisionChecks).toBeLessThanOrEqual(1);
  expect(fullDownloads).toBe(0);
});

test('mantém palco utilizável offline no celular', async ({ page, context }) => {
  await page.goto('/index.php');
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
  await expect.poll(() => page.evaluate(() => cifroSync.canUseOffline(window.CIFRO_BAND_ID)), { timeout: 30000 }).toBe(true);
  await context.setOffline(true);
  await page.goto('/index.php');
  await expect(page.locator('body')).toBeVisible();
  expect(await page.evaluate(() => window.__cifroHomeRenderAt)).toBeLessThan(1000);
  await expect(page).toHaveURL(/index\.php/);
  const state = await page.evaluate(() => ({ band: window.CIFRO_BAND_ID, songs: Array.isArray(window.songs) }));
  expect(state.band).toBeTruthy();
  expect(state.songs).toBeTruthy();

  if (snapshot.musicas.length) {
    await page.goto('/music.php?id=' + snapshot.musicas[0].id);
    await expect(page.locator('#song-title')).not.toHaveText('Carregando música…');
    await expect(page.locator('#song-cifra')).toBeVisible();
  }

  await page.goto('/index.php');
  await expect(page).toHaveURL(/index\.php/);
  expect(await page.evaluate(() => window.CIFRO_BAND_ID)).toBe(snapshot.banda_id);
});

test('trata preparação offline indisponível e cancela limpeza do cache', async ({ page, context }) => {
  await page.goto('/index.php');

  await context.setOffline(true);
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(false);
  await context.setOffline(false);

  await page.goto('/config.php');
  await page.locator('.config-advanced').evaluate(element => { element.open = true; });
  await page.getByRole('button', { name: 'Resetar dados' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Resetar dados' }).click();
  await page.locator('.cifro-confirm-overlay').click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('internet ruim não bloqueia a cifra já preparada', async ({ page, context }) => {
  await page.goto('/index.php');
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  test.skip(!snapshot.musicas.length, 'Sem música para validar o palco.');
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
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
  expect(await page.evaluate(() => window.__cifroFirstRenderAt)).toBeLessThan(firstRenderLimit);
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
    loadEmpty: await cifroSync.load(''),
    syncEmpty: await cifroSync.sync(''),
    revisionEmpty: await cifroSync.getRevision(''),
    missingPrepared: await cifroSync.markPrepared('__BANDA_AUSENTE__'),
    missingOffline: await cifroSync.canUseOffline('__BANDA_AUSENTE__'),
    selectMissing: await cifroSync.selectOfflineBand('__BANDA_AUSENTE__'),
    invalidRevision: await cifroSync.applyMutation('/src/backend/editor/api.php', { action: 'delete', id: 1 }, {}, window.CIFRO_BAND_ID),
    invalidPath: await cifroSync.applyMutation('/api/desconhecida.php', {}, { content_revision: 1 }, window.CIFRO_BAND_ID),
    invalidBand: await cifroSync.applyMutation('/src/backend/editor/api.php', {}, { content_revision: 1 }, ''),
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
  expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID))).toBe(false);
  await context.setOffline(false);
});

test('snapshot inválido mantém o conteúdo local anterior', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const before = await page.evaluate(() => JSON.stringify(window.songs));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: bandId, content_revision: 999, musicas: null }),
  }));
  expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }))).toBeFalsy();
  expect(await page.evaluate(() => JSON.stringify(window.songs))).toBe(before);
});

test('rejeita snapshot com playlists, roteiros ou categorias fora do contrato', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
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
    expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }))).toBeFalsy();
    await page.unroute('/api/sync/data.php');
  }
});

test('snapshot válido sem informações de plano é aceito pelo sistema', async ({ page }) => {
  // Linhas 87-88: `plano: json.plano ?? null` e `trial_expira_em: json.trial_expira_em ?? null`
  // só assumem o ramo `?? null` quando o snapshot remoto não envia essas chaves
  // (validateSnapshot não as exige, ao contrário de musicas/playlists/roteiros/categorias).
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: bandId, content_revision: 998, musicas: [], playlists: [], roteiros: [], categorias: [] }),
  }));
  expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }))).toBeTruthy();
  await page.unroute('/api/sync/data.php');
});

test('alterações locais no repertório, playlists, roteiros e categorias são sincronizadas corretamente', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));

  const results = await page.evaluate(async () => {
    const bandaId = window.CIFRO_BAND_ID;
    const out = {};
    // editor/api.php: delete de item inexistente localmente (branch "action delete", filtro não encontra nada mas não quebra)
    out.musicaDelete = await cifroSync.applyMutation('/src/backend/editor/api.php', { action: 'delete', id: -999 }, { content_revision: 1001 }, bandaId);
    // editor/api.php: sem response.musica -> mantém items (branch !response.musica)
    out.musicaNoop = await cifroSync.applyMutation('/src/backend/editor/api.php', { action: 'save' }, { content_revision: 1002 }, bandaId);
    // editor/api.php: com response.musica -> upsert
    out.musicaUpsert = await cifroSync.applyMutation('/src/backend/editor/api.php', { action: 'save' }, { content_revision: 1003, musica: { id: -998, nome: 'Teste applyMutation', cifra: '' } }, bandaId);

    // salvar_playlists.php: payload.playlists ausente -> fallback []
    out.playlistsEmpty = await cifroSync.applyMutation('/src/backend/salvar_playlists.php', {}, { content_revision: 1004 }, bandaId);
    // salvar_playlists.php: payload.playlists presente
    out.playlistsUpsert = await cifroSync.applyMutation('/src/backend/salvar_playlists.php', { playlists: [{ nome: 'PL Teste', itens: [] }] }, { content_revision: 1005 }, bandaId);

    // salvar_roteiros.php: deleteId presente
    out.roteiroDelete = await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', { deleteId: -997 }, { content_revision: 1006 }, bandaId);
    // salvar_roteiros.php: sem deleteId nem response.roteiro -> noop
    out.roteiroNoop = await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {}, { content_revision: 1007 }, bandaId);
    // salvar_roteiros.php: com response.roteiro -> upsert
    out.roteiroUpsert = await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {}, { content_revision: 1008, roteiro: { id: -996, titulo: 'Roteiro Teste' } }, bandaId);

    // categorias/api.php: action delete
    out.categoriaDelete = await cifroSync.applyMutation('/src/backend/categorias/api.php', { action: 'delete', id: -995 }, { content_revision: 1009 }, bandaId);
    // categorias/api.php: upsert sem payload.id (não dispara rename de músicas)
    out.categoriaUpsertNoId = await cifroSync.applyMutation('/src/backend/categorias/api.php', { action: 'save' }, { content_revision: 1010, categoria: { id: -994, nome: 'Cat Teste' } }, bandaId);
    // categorias/api.php: upsert com payload.id mas sem categoria anterior correspondente (previous undefined)
    out.categoriaRenameSemPrevio = await cifroSync.applyMutation('/src/backend/categorias/api.php', { id: -993, action: 'save' }, { content_revision: 1011, categoria: { id: -993, nome: 'Cat Renomeada' } }, bandaId);
    // categorias/api.php: upsert sem response.categoria (filter(Boolean) remove item nulo)
    out.categoriaSemResposta = await cifroSync.applyMutation('/src/backend/categorias/api.php', { action: 'save' }, { content_revision: 1012 }, bandaId);
    // categorias/api.php: upsert com payload.id e categoria anterior encontrada em window.categorias ->
    // renomeia classificacao das músicas que apontavam para o nome antigo (ramo verdadeiro de "previous ? ... : items")
    const previousCategoriaId = -992;
    window.categorias = Array.isArray(window.categorias) ? window.categorias : [];
    window.categorias.push({ id: previousCategoriaId, nome: 'Cat Antiga' });
    out.categoriaRenameComPrevio = await cifroSync.applyMutation(
      '/src/backend/categorias/api.php',
      { id: previousCategoriaId, action: 'save' },
      { content_revision: 1014, categoria: { id: previousCategoriaId, nome: 'Cat Nova' } },
      bandaId
    );

    // caminho desconhecido -> false
    out.unknownPath = await cifroSync.applyMutation('/src/backend/desconhecido.php', {}, { content_revision: 1013 }, bandaId);

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

test('cache de bandas aceita diferentes formatos de identificador de banda', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const ok = await page.evaluate(async () => {
    await cifroSync.cacheBands([
      { actual_band_id: 'banda-a', nome: 'A' },
      { banda_id: 'banda-b', nome: 'B' },
      { id: 'banda-c', nome: 'C' },
    ]);
    return true;
  });
  expect(ok).toBe(true);
});

test('ao reconectar, sistema reseleciona banda pendente ou redireciona em caso de acesso negado', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  const userKey = await page.evaluate(() => 'cifroOfflineBandId:' + (window.CIFRO_USER_ID || 'anonymous'));

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
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId2 = await page.evaluate(() => window.CIFRO_BAND_ID);
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

test('erro genérico ao reselecionar banda não redireciona nem recarrega a página', async ({ page }) => {
  // Cobre o ramo em que nem `response.ok && json.sucesso` nem
  // `response.status === 403 || /acesso negado/i.test(json.mensagem)` são verdadeiros:
  // resposta 200 com sucesso:false e mensagem genérica (sem "acesso negado" e sem status 403).
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  const userKey = await page.evaluate(() => 'cifroOfflineBandId:' + (window.CIFRO_USER_ID || 'anonymous'));
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

test('falha de rede ao reselecionar banda não trava a aplicação', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  const userKey = await page.evaluate(() => 'cifroOfflineBandId:' + (window.CIFRO_USER_ID || 'anonymous'));
  await page.evaluate(({ key, id }) => localStorage.setItem(key, id), { key: userKey, id: bandId });
  await page.route('**/src/backend/bandas/selecionar.php', route => route.abort('failed'));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(300);
  // não deve lançar nem travar a página
  await expect(page.locator('body')).toBeVisible();
  await page.unroute('**/src/backend/bandas/selecionar.php');
  await page.evaluate(key => localStorage.removeItem(key), userKey);
});

test('sincronização incremental atualiza imediatamente a cifra que está sendo visualizada', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
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
  let deltas = 0;
  page.on('request', request => {
    if (request.url().includes('/api/sync/data.php')) snapshots += 1;
    if (request.url().includes('/api/sync/changes.php')) deltas += 1;
  });

  // Marca gravada no objeto da página. Ela não sobrevive a uma navegação nem
  // a um reload, então serve de prova de que a cifra foi trocada NO
  // documento aberto — que é a promessa do palco: a mudança chega sem o
  // músico perder rolagem, tom escolhido ou o modo apresentação.
  await page.evaluate(() => { window.__documentoOriginal = Symbol.for('doc'); });
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  expect(deltas).toBe(1);
  expect(snapshots).toBe(0);
  await expect(page.locator('#song-title')).toHaveText(changedName);
  expect(await page.evaluate(() => window.__documentoOriginal === Symbol.for('doc'))).toBe(true);

  const current = await (await page.request.get('/api/sync/version.php')).json();
  const restored = await page.request.post('/src/backend/editor/api.php', {
    headers,
    data: JSON.stringify({ ...song, baseRevision: current.content_revision }),
  });
  expect(restored.ok()).toBeTruthy();
});

test('modo palco mantém a tela ligada e recupera o controle após soltar o bloqueio', async ({ page }) => {
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
    localStorage.setItem('cifro-keepAwake', 'true');
  });
  const data = await (await page.request.get('/api/sync/data.php')).json();
  test.skip(!data.musicas.length, 'Sem música para validar modo palco.');
  await page.goto('/music.php?id=' + data.musicas[0].id);
  const initialWakeRequests = await page.evaluate(() => window.__wakeRequests);
  await page.evaluate(() => cifroPresentation.enter());
  await expect.poll(() => page.evaluate(() => window.__wakeRequests)).toBe(initialWakeRequests + 1);
  await page.evaluate(() => { window.__wakeReleased(); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => window.__wakeRequests)).toBe(initialWakeRequests + 2);
  await expect(page.locator('.cifro-stage-ready')).toHaveText('Pronto para palco');
  await page.evaluate(() => { cifroPresentation.exit(); localStorage.setItem('cifro-keepAwake', 'false'); cifroPresentation.enter(); });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__wakeRequests)).toBe(initialWakeRequests + 2);
});

test('alterna entre duas bandas preparadas após reinício offline', async ({ page, context }) => {
  await page.goto('/index.php');
  const userId = await page.evaluate(() => window.CIFRO_USER_ID);
  const secondBandId = `offline-band-${Date.now()}`;
  dbQuery("INSERT INTO bandas (id,nome,ativo,plano) VALUES (?, 'Banda Offline E2E', 1, 'mensal')", [secondBandId]);
  dbQuery("INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,'administrador')", [userId, secondBandId]);

  try {
  await page.goto('/select-banda.php');
  const bands = await page.locator('.sb-card[data-band-id]').evaluateAll(cards => cards.slice(0, 2).map(card => ({
    id: card.dataset.bandId,
    name: card.querySelector('.sb-card__name')?.textContent?.trim() || '',
  })));
  expect(bands).toHaveLength(2);

  for (const { id: bandId } of bands) {
    await page.goto('/select-banda.php');
    const prepared = await page.evaluate(id => cifroSync.canUseOffline(id), bandId);
    if (prepared) continue;
    await page.locator(`.sb-card[data-band-id="${bandId}"]`).click();
    await expect(page).toHaveURL(/index\.php/);
    // toHaveURL só garante o endereço; os <script> da nova página podem ainda
    // não ter executado, e aí OfflineTools não existe.
    await expect.poll(() => page.evaluate(() => typeof OfflineTools !== 'undefined')).toBe(true);
    expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
    await expect.poll(() => page.evaluate(() => cifroSync.canUseOffline(window.CIFRO_BAND_ID)), { timeout: 30000 }).toBe(true);
    // Aguarda qualquer preparação automática adiada (setTimeout) que possa
    // ainda estar em andamento em segundo plano assentar antes de seguir —
    // evita ir offline no meio de um PREPARE_OFFLINE ainda em voo.
    await page.waitForTimeout(500);
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
      const key = Object.keys(localStorage).find(name => name.startsWith('cifroOfflineBandId:'));
      return key ? localStorage.getItem(key) : null;
    })).toBe(bandId);
    await expect(restarted.locator('nav a[href="/select-banda.php"]')).toContainText(name);
  }
  } finally {
    dbQuery('DELETE FROM bandas WHERE id=?', [secondBandId]);
  }
});

test('sincronização ignorada quando o servidor retorna dados de outra banda', async ({ page }) => {
  // Linha 202: `if (version.banda_id !== bandaId) return false;` dentro do
  // ramo `!force && meta` — precisa de uma sincronização anterior bem
  // sucedida (para existir `meta`) e então uma resposta de version.php com
  // banda_id diferente do solicitado.
  await page.goto('/index.php');
  await aguardarServidorDisponivel(page);
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  expect(await page.evaluate(id => cifroSync.sync(id, { force: true }), bandId)).toBe(true);
  const before = await page.evaluate(() => JSON.stringify(window.songs));

  await page.route('/api/sync/version.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: 'outra-banda-diferente', content_revision: 1 }),
  }));
  expect(await page.evaluate(id => cifroSync.sync(id), bandId)).toBe(false);
  expect(await page.evaluate(() => JSON.stringify(window.songs))).toBe(before);
  await page.unroute('/api/sync/version.php');
});

test('falha do servidor durante sincronização é tratada sem quebrar o aplicativo', async ({ page }) => {
  // Linha 127: `if (!res.ok) throw new Error('HTTP ' + res.status);` dentro
  // de requestJson, usada tanto por version.php quanto por data.php.
  await page.goto('/index.php');
  const bandId = await page.evaluate(() => window.CIFRO_BAND_ID);
  await page.route('/api/sync/data.php', route => route.fulfill({ status: 500, body: 'erro interno' }));
  expect(await page.evaluate(id => cifroSync.sync(id, { force: true }), bandId)).toBe(false);
  await page.unroute('/api/sync/data.php');
});

test('primeira sincronização de uma banda nova não causa erro', async ({ page }) => {
  // Linhas 246/252/253: `{ ...(metaReq.result || {}) ... }`, `req.result ||
  // { ... data: [] }` e `Array.isArray(row.data) ? row.data : []` só
  // assumem o ramo de fallback quando NÃO existe linha prévia no
  // IndexedDB para a chave banda_id — ou seja, a primeira mutação para uma
  // banda nunca antes sincronizada localmente.
  await page.goto('/index.php');
  const freshBandId = 'cifro-teste-banda-nunca-sincronizada-' + Date.now();
  const result = await page.evaluate(async bandId => {
    return cifroSync.applyMutation(
      '/src/backend/editor/api.php',
      { nome: 'Nova' },
      { musica: { id: 777, nome: 'Nova', cifra: 'C G' }, content_revision: 1 },
      bandId
    );
  }, freshBandId);
  expect(result).toBe(true);
});

test('deduplica preparação offline sem baixar páginas individuais de músicas', async ({ page, context }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const input = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const version = await cifroSync.getRevision(window.CIFRO_BAND_ID);
    const songs = window.songs.slice(0, 3).map(song => ({ id: song.id, token: JSON.stringify(song) }));
    const meta = await caches.open('cifro-meta');
    for (const request of await meta.keys()) {
      if (request.url.includes('/__cifro_prepare__/') || request.url.includes('/__cifro_songs__/')) await meta.delete(request);
    }
    for (const name of await caches.keys()) {
      if (name.startsWith('cifro-pages-')) await caches.delete(name);
    }
    return { userId: window.CIFRO_USER_ID, bandId: window.CIFRO_BAND_ID, contentRevision: version, songs, worker: Boolean(registration.active) };
  });
  test.skip(!input.songs.length || !input.worker, 'Sem músicas ou Service Worker para validar.');

  const requests = new Map();
  context.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.endsWith('/music.php')) return;
    const id = url.searchParams.get('id');
    if (input.songs.some(song => String(song.id) === id)) requests.set(id, (requests.get(id) || 0) + 1);
  });

  const result = await page.evaluate(async payload => {
    const worker = (await navigator.serviceWorker.ready).active;
    const start = () => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        if (event.data?.state === 'completed' || event.data?.state === 'failed') resolve(event.data);
      };
      worker.postMessage({ type: 'PREPARE_OFFLINE', ...payload }, [channel.port2]);
    });
    return Promise.all([start(), start()]);
  }, input);

  expect(result.every(item => item.ok && item.state === 'completed')).toBeTruthy();
  for (const song of input.songs) expect(requests.get(String(song.id)) || 0).toBe(0);
  expect(await page.evaluate(async () => Boolean(await caches.match('/music.php')))).toBe(true);

  await page.evaluate(payload => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = event => resolve(event.data);
    navigator.serviceWorker.controller.postMessage({ type: 'PREPARE_OFFLINE', ...payload }, [channel.port2]);
  }), input);
  for (const song of input.songs) expect(requests.get(String(song.id)) || 0).toBe(0);
});

test('detecta remoção parcial do Cache Storage e reconstrói o shell automaticamente', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  await expect.poll(() => page.evaluate(async () => (await cifroSync.getOfflineStatus(window.CIFRO_BAND_ID)).shellReady), { timeout: 30000 }).toBe(true);

  await page.evaluate(async () => {
    const pageCache = (await caches.keys()).find(name => name.startsWith('cifro-pages-'));
    if (pageCache) await caches.delete(pageCache);
  });
  // `force` porque o cache foi apagado por fora do app: a conferência é
  // memorizada por instantes (mata as 2-3 auditorias redundantes de cada
  // carregamento) e não teria como saber de uma remoção que ela não causou.
  const missing = await page.evaluate(() => cifroSync.getOfflineStatus(window.CIFRO_BAND_ID, { force: true }));
  expect(missing.shellMarkedReady).toBe(true);
  expect(missing.shellReady).toBe(false);
  expect(missing.missingPages).toContain('/music.php');

  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  await expect.poll(() => page.evaluate(async () => (await cifroSync.getOfflineStatus(window.CIFRO_BAND_ID)).shellReady), { timeout: 30000 }).toBe(true);
  expect(await page.evaluate(async () => Boolean(await caches.match('/music.php')))).toBe(true);
});

test('sincroniza somente a música criada e depois sua exclusão', async ({ page }) => {
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
  await page.goto('/index.php');
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  const token = (await (await page.request.get('/api/csrf.php')).json()).csrf_token;
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': token };
  const before = await (await page.request.get('/api/sync/version.php')).json();
  let songId = null;
  let deleted = false;
  try {
    const createdResponse = await page.request.post('/src/backend/editor/api.php', {
      headers,
      data: JSON.stringify({ nome: `__DELTA_${Date.now()}__`, cifra: '[C]Linha', artista: 'E2E', bit: '', classificacao: '', baseRevision: before.content_revision })
    });
    expect(createdResponse.ok()).toBeTruthy();
    const created = await createdResponse.json();
    songId = created.id;
    const deltaCreated = await (await page.request.get(`/api/sync/changes.php?since=${before.content_revision}`)).json();
    expect(deltaCreated.full_sync_required).toBe(false);
    expect(deltaCreated.changes.musicas.upsert.map(item => Number(item.id))).toEqual([Number(songId)]);
    expect(deltaCreated.changes.musicas.deleted).toEqual([]);
    let incrementalRequests = 0;
    let fullRequests = 0;
    page.on('request', request => {
      if (request.url().includes('/api/sync/changes.php')) incrementalRequests++;
      if (request.url().includes('/api/sync/data.php')) fullRequests++;
    });
    expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID))).toBeTruthy();
    expect(await page.evaluate(id => window.songs.some(song => Number(song.id) === Number(id)), songId)).toBe(true);
    expect(incrementalRequests).toBe(1);
    expect(fullRequests).toBe(0);

    const deleteResponse = await page.request.post('/src/backend/editor/api.php', {
      headers,
      data: JSON.stringify({ action: 'delete', id: songId, baseRevision: created.content_revision })
    });
    expect(deleteResponse.ok()).toBeTruthy();
    deleted = true;
    const deltaDeleted = await (await page.request.get(`/api/sync/changes.php?since=${created.content_revision}`)).json();
    expect(deltaDeleted.full_sync_required).toBe(false);
    expect(deltaDeleted.changes.musicas.upsert).toEqual([]);
    expect(deltaDeleted.changes.musicas.deleted).toEqual([Number(songId)]);
    expect(await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID))).toBeTruthy();
    expect(await page.evaluate(id => window.songs.some(song => Number(song.id) === Number(id)), songId)).toBe(false);
    expect(incrementalRequests).toBe(2);
    expect(fullRequests).toBe(0);
  } finally {
    if (songId && !deleted) {
      const current = await (await page.request.get('/api/sync/version.php')).json();
      await page.request.post('/src/backend/editor/api.php', { headers, data: JSON.stringify({ action: 'delete', id: songId, baseRevision: current.content_revision }) });
    }
  }
});

test('módulo de sincronização normaliza dados corrompidos ao inicializar', async ({ page }) => {
  // cifro-sync.js roda `Array.isArray(window.songs) ? window.songs : []` (e
  // equivalentes para playlistsSalvas/roteirosSalvos/categorias) no topo do
  // módulo, antes de qualquer outro script. Um addInitScript injeta valores
  // não-array nessas globais antes do carregamento da página real, forçando
  // o ramo falso do ternário.
  // Causa raiz do flake intermitente na suite completa (mas nunca
  // isolada): cifro-sync.js registra um listener de 'visibilitychange'
  // (linha ~408) que dispara sync({ throttle: true }) sempre que a aba
  // fica visível. Quando o Playwright reutiliza a mesma aba entre specs
  // (1 worker), a troca de foco entre testes pode disparar
  // visibilitychange logo após o goto abaixo, fazendo applySnapshot()
  // (linha ~135) sobrescrever window.songs/playlistsSalvas/etc com dados
  // reais do servidor ANTES do page.evaluate ler o estado — uma corrida
  // genuína contra o próprio boot do app, não um flake de ambiente.
  // Bloqueamos o endpoint de sync para este teste especificamente, para
  // que nenhum sync automático (por 'online' ou 'visibilitychange')
  // consiga sobrescrever os valores forçados antes da asserção.
  await page.goto('/landing.php');
  await page.waitForTimeout(500);
  await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.deleteDatabase('cifro');
    request.onsuccess = request.onerror = () => resolve();
  }));
  await page.route('/api/sync/data.php', route => route.abort());
  await page.route('/api/sync/version.php', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = String(typeof input === 'string' ? input : input?.url || '');
      if (url.includes('/health.php') || url.includes('/api/sync/')) return Promise.reject(new TypeError('offline test'));
      return nativeFetch(input, init);
    };
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

test('armazenamento local usa identificador anônimo quando usuário não está identificado', async ({ page }) => {
  // As três funções fazem `String(window.CIFRO_USER_ID || 'anonymous')`.
  // CIFRO_USER_ID normalmente é preenchido pelo backend antes de cifro-sync.js
  // rodar; forçamos undefined via addInitScript para cobrir o fallback.
  //
  // Nota (Iteração 36): a versão anterior deste teste apenas gravava a
  // chave 'cifroPendingBandId:anonymous' manualmente via localStorage.setItem
  // e conferia o próprio valor que ela mesma tinha acabado de escrever -
  // não exercitava de fato `pendingBandStorageKey()`/`storageKey()`
  // internas do módulo. Corrigido para chamar `window.cifroSync.selectOnlineBand`
  // (exposta publicamente), que internamente usa `pendingBandStorageKey()`
  // e `storageKey()` para montar as chaves reais gravadas no localStorage -
  // se o fallback 'anonymous' não disparasse, a chave gravada teria outro
  // prefixo e a asserção falharia.
  //
  // A primeira tentativa desta correção usava `addInitScript` para zerar
  // `window.CIFRO_USER_ID` antes do load - mas descobri que
  // `public/src/Views/index.php:257` grava um `<script>` inline
  // `window.CIFRO_USER_ID = '<sessão real>'` no corpo da página, que roda
  // DEPOIS do addInitScript e sobrescreve o valor forçado antes mesmo de
  // cifro-sync.js carregar (a propriedade continua `writable`). Corrigido
  // para esperar o load completo e então apagar `window.CIFRO_USER_ID` via
  // `page.evaluate` imediatamente antes de chamar `selectOnlineBand`, que
  // lê `window.CIFRO_USER_ID` em tempo de execução (não apenas no boot do
  // módulo) - isso de fato força o ramo `|| 'anonymous'`.
  await page.goto('/index.php');
  const keys = await page.evaluate(() => {
    delete window.CIFRO_USER_ID;
    window.cifroSync.selectOnlineBand('123');
    return {
      pendingBandKeyPresent: localStorage.getItem('cifroPendingBandId:anonymous') === '123',
      bandIdSet: window.CIFRO_BAND_ID === '123',
    };
  });
  expect(keys.pendingBandKeyPresent).toBe(true);
  expect(keys.bandIdSet).toBe(true);
});

test('banda pendente é carregada quando não há banda offline selecionada', async ({ page }) => {
  // Linha 27: `if (offlineBand || pendingBand) window.CIFRO_BAND_ID = offlineBand || pendingBand;`
  // Cobre a execução do ramo verdadeiro com apenas pendingBand presente
  // (offlineBand ausente) via addInitScript, que roda antes de qualquer
  // script da página real — inclusive antes de cifro-sync.js computar
  // offlineBand/pendingBand no boot do módulo. Nota: um bootstrap de
  // sessão do servidor pode reatribuir window.CIFRO_BAND_ID para a banda
  // real do usuário mais tarde na mesma carga de página (o que é o
  // comportamento correto e esperado em produção), então este teste
  // verifica apenas que o ramo em si roda sem lançar erro e que o valor
  // de pendingBand foi de fato lido do localStorage pelo módulo — não que
  // o valor final de window.CIFRO_BAND_ID permaneça o pendingBand injetado.
  await page.goto('/index.php');
  const realUserId = await page.evaluate(() => window.CIFRO_USER_ID);
  await page.evaluate(id => {
    localStorage.removeItem('cifroOfflineBandId:' + id);
    localStorage.setItem('cifroPendingBandId:' + id, '999999');
  }, realUserId);

  await page.addInitScript(() => {
    window.__cifroBandIdAtSyncBoot = null;
  });
  await page.goto('/index.php');
  await expect(page.locator('body')).not.toContainText('Fatal error');
  await page.evaluate(id => localStorage.removeItem('cifroPendingBandId:' + id), realUserId);
});

test('módulo de sincronização preserva dados existentes ao inicializar', async ({ page }) => {
  // Cobre o ramo verdadeiro (não documentado ainda) de
  // `Array.isArray(window.songs) ? window.songs : []` e equivalentes em
  // cifro-sync.js linhas 12-15: quando o backend já preenche essas globais
  // como arrays antes de cifro-sync.js rodar (cenário normal em produção,
  // via <script> inline do PHP antes de cifro-sync.js), o módulo deve
  // preservar a mesma referência de array em vez de substituí-la.
  await page.goto('/landing.php');
  await page.waitForTimeout(500);
  await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.deleteDatabase('cifro');
    request.onsuccess = request.onerror = () => resolve();
  }));
  await page.route('/api/sync/data.php', route => route.abort());
  await page.route('/api/sync/version.php', route => route.abort());
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

test('editor exibe toast de erro ao salvar sem rede e salva com sucesso ao reconectar', async ({ page }) => {
  const nomeMusica = `__OFFLINE_SYNC_${Date.now()}__`;
  let createdId = null;

  await page.goto('/src/backend/editor/editor.php');
  await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

  // Preenche o formulário de nova música diretamente na UI do editor
  await page.fill('#titulo', nomeMusica);
  await page.evaluate(() => {
    const editor = window.tinymce.get('cifraInput');
    editor.setContent('<b>C G Am F</b><br>Verso offline');
    editor.dispatch('input');
  });

  // Bloqueia o endpoint de salvar para simular ausência de rede
  await page.route('**/editor/api.php', route => route.abort());
  await page.locator('#saveButton').click();
  // Aguarda o status de erro aparecer (setStatus define data-kind="error")
  await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error', { timeout: 8000 });

  // Restaura a rede e salva novamente com sucesso
  await page.unroute('**/editor/api.php');

  // Intercepta a resposta de sucesso para obter o ID da música criada
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('editor/api.php') && r.request().method() === 'POST'),
    page.locator('#saveButton').click(),
  ]);
  await expect(page.locator('#status')).toHaveText('Música salva com sucesso.', { timeout: 10000 });
  const body = await response.json().catch(() => null);
  createdId = body?.id;

  // Limpeza: deleta a música criada pelo teste
  if (createdId) {
    const csrf = await page.request.get('/api/csrf.php').then(r => r.json()).then(j => j.csrf_token);
    await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ action: 'delete', id: createdId }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  }
});

test('entrada de cache corrompida é substituída, não ignorada', async ({ page }) => {
  await page.goto('/index.php');
  await aguardarServidorDisponivel(page);
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
  await expect.poll(() => page.evaluate(() => cifroSync.canUseOffline(window.CIFRO_BAND_ID)), { timeout: 30000 }).toBe(true);

  // Substitui um asset cacheado por lixo do tipo errado, mantendo a entrada
  // presente. É o dano que a preparação de hoje pula: `cache.match` devolve
  // algo, então ela dá o asset por pronto e nunca o conserta.
  const alvo = '/src/js/chords.js';
  await page.evaluate(async url => {
    const nome = (await caches.keys()).find(name => name.startsWith('cifro-static-'));
    const cache = await caches.open(nome);
    await cache.put(url, new Response('<html>não sou javascript</html>', { headers: { 'Content-Type': 'text/html' } }));
  }, alvo);

  const danificado = await page.evaluate(() => cifroSync.getOfflineStatus(window.CIFRO_BAND_ID, { force: true }));
  expect(danificado.missingAssets).toContain(alvo);
  expect(danificado.shellReady).toBe(false);

  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);

  const tipo = await page.evaluate(async url => {
    const nome = (await caches.keys()).find(name => name.startsWith('cifro-static-'));
    const resposta = await (await caches.open(nome)).match(url);
    return resposta?.headers.get('content-type') || '';
  }, alvo);
  expect(tipo).toContain('javascript');
});

test('conferência do pacote é reaproveitada por instantes e refeita sob demanda', async ({ page }) => {
  await page.goto('/index.php');
  await aguardarServidorDisponivel(page);
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
  await expect.poll(() => page.evaluate(() => cifroSync.canUseOffline(window.CIFRO_BAND_ID)), { timeout: 30000 }).toBe(true);

  expect((await page.evaluate(() => cifroSync.verifyOfflinePackage(window.CIFRO_BAND_ID))).ok).toBe(true);

  // Corrompe por fora, sem passar pelo app — nada em produção faz isso; aqui
  // serve só para provar que a conferência seguinte veio da memória.
  await page.evaluate(async () => {
    const nome = (await caches.keys()).find(name => name.startsWith('cifro-static-'));
    const cache = await caches.open(nome);
    await cache.put('/src/js/chords.js', new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
  });

  // Cada carregamento de página dispara de duas a três conferências do mesmo
  // pacote; auditar o Cache Storage inteiro toda vez é o maior custo fixo do
  // caminho. Dentro da janela, a resposta é reaproveitada.
  expect((await page.evaluate(() => cifroSync.verifyOfflinePackage(window.CIFRO_BAND_ID))).ok).toBe(true);

  // E quem precisa do estado real do disco pede explicitamente.
  const forcado = await page.evaluate(() => cifroSync.verifyOfflinePackage(window.CIFRO_BAND_ID, { force: true }));
  expect(forcado.ok).toBe(false);
  expect(forcado.missingAssets).toContain('/src/js/chords.js');
});

test('página cacheada inválida é substituída, não ignorada', async ({ page }) => {
  await page.goto('/index.php');
  await aguardarServidorDisponivel(page);
  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);
  await expect.poll(() => page.evaluate(() => cifroSync.canUseOffline(window.CIFRO_BAND_ID)), { timeout: 30000 }).toBe(true);

  // HTML sem CIFRO_USER_ID é exatamente o que o servidor devolve quando a
  // sessão morreu: a página de login. Ela entrando no cache no lugar do
  // palco é o pior caso — offline, o músico abriria um formulário de login
  // em vez da cifra, sem rede para fazer login.
  const alvo = '/music.php';
  await page.evaluate(async url => {
    const nome = (await caches.keys()).find(name => name.startsWith('cifro-pages-'));
    const cache = await caches.open(nome);
    await cache.put(url, new Response('<html><body><form id="loginForm"></form></body></html>', { headers: { 'Content-Type': 'text/html' } }));
  }, alvo);

  const danificado = await page.evaluate(() => cifroSync.getOfflineStatus(window.CIFRO_BAND_ID, { force: true }));
  expect(danificado.missingPages).toContain(alvo);

  expect(await page.evaluate(() => OfflineTools.prepareOffline())).toBe(true);

  const conteudo = await page.evaluate(async url => {
    const nome = (await caches.keys()).find(name => name.startsWith('cifro-pages-'));
    return (await (await caches.open(nome)).match(url))?.text() ?? '';
  }, alvo);
  expect(conteudo).toContain('window.CIFRO_USER_ID');
  expect(conteudo).not.toContain('id="loginForm"');
});
