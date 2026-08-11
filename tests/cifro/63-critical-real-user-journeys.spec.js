import { test, expect } from '@playwright/test';
import { dbQuery } from '../helpers/db.js';

const MASTER = 'tests/.auth/user.json';
const ADMIN = 'tests/.auth/paid-admin.json';
const GESTOR = 'tests/.auth/gestor.json';
const BASICO = 'tests/.auth/basico.json';
const EXTERNO = 'tests/.auth/externo.json';
const BAND_ID = '00000000-0000-4000-8000-000000000002';
const PREFIX = `__CRITICAL_${Date.now()}__`;
let originalPlan = 'gratuito';

async function contextPage(browser, storageState) {
  const context = await browser.newContext({ storageState, serviceWorkers: 'allow' });
  await context.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
  const page = await context.newPage();
  return { context, page };
}

async function refreshBand(page) {
  await page.goto('/select-banda.php');
  const target = page.locator(`.sb-card[data-band-id="${BAND_ID}"]`);
  await expect(target).toBeVisible();
  await target.click();
  await expect(page).toHaveURL(/index\.php/);
}

async function csrf(page) {
  return (await (await page.request.get('/api/csrf.php')).json()).csrf_token;
}

async function saveSongUi(page, name, body = '<p><b>C G Am F</b></p><p>Linha real.</p>') {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
  await page.locator('#titulo').fill(name);
  await page.evaluate(value => {
    const editor = window.tinymce.get('cifraInput');
    editor.setContent(value);
    editor.dispatch('input');
  }, body);
  const response = page.waitForResponse(item => item.url().includes('/src/backend/editor/api.php') && item.request().method() === 'POST');
  await page.locator('#saveButton').click();
  const result = await response;
  const json = await result.json();
  return { response: result, json };
}

async function prepareOffline(page) {
  await page.goto('/index.php');
  await page.waitForFunction(() => window.cifroSync && window.OfflineTools);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.waitForFunction(() => window.cifroSync && window.OfflineTools);
  }
  await page.evaluate(() => window.cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  expect(await page.evaluate(() => window.OfflineTools.prepareOffline())).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await window.cifroSync.getOfflineStatus(window.CIFRO_BAND_ID)).ready), { timeout: 30000 }).toBe(true);
}

function resetLiveState() {
  dbQuery("UPDATE live_state SET host_id=NULL, host_user_id=NULL, host_nome=NULL, cifra_atual='', pagina_atual='index.php', scroll_top=0, scroll_percent=0, version=version+1 WHERE banda_id=?", [BAND_ID]);
}

test.beforeAll(() => {
  if (process.env.APP_ENV !== 'test' || !/(?:e2e|test)/i.test(process.env.E2E_DB_NAME || '')) throw new Error('Banco E2E seguro obrigatório.');
  originalPlan = dbQuery('SELECT plano FROM bandas WHERE id=?', [BAND_ID]).rows[0]?.plano || 'gratuito';
});

test.beforeEach(() => resetLiveState());
test.afterEach(() => resetLiveState());

test.afterAll(() => {
  dbQuery('DELETE FROM roteiros WHERE banda_id=? AND titulo LIKE ?', [BAND_ID, `${PREFIX}%`]);
  dbQuery('DELETE FROM playlists WHERE banda_id=? AND nome LIKE ?', [BAND_ID, `${PREFIX}%`]);
  dbQuery('DELETE FROM musicas WHERE banda_id=? AND nome LIKE ?', [BAND_ID, `${PREFIX}%`]);
  dbQuery('UPDATE bandas SET plano=? WHERE id=?', [originalPlan, BAND_ID]);
  dbQuery("UPDATE live_state SET host_id=NULL, host_user_id=NULL, host_nome=NULL, cifra_atual='', pagina_atual='index.php', version=version+1 WHERE banda_id=?", [BAND_ID]);
});

test('1. administrador não-master pago gerencia a banda', async ({ browser }) => {
  const original = dbQuery('SELECT nome, logo FROM bandas WHERE id=?', [BAND_ID]).rows[0];
  const editedName = `${PREFIX}_BANDA_ADMIN`;
  dbQuery("UPDATE bandas SET plano='anual' WHERE id=?", [BAND_ID]);
  const { context, page } = await contextPage(browser, ADMIN);
  try {
    await refreshBand(page);
    await page.goto('/bandas.php');
    await expect(page.locator('body')).toContainText(/Banda E2E/i);
    await expect(page).not.toHaveURL(/login|index\.php$/);
    await page.locator('.banda-row', { hasText: original.nome }).getByTitle('Editar').click();
    await page.locator('#bandaNome').fill(editedName);
    await page.getByRole('button', { name: /Remover/i }).click();
    const saved = page.waitForResponse(item => item.url().endsWith('/src/backend/bandas/salvar_banda.php') && item.request().method() === 'POST');
    await page.getByRole('button', { name: /Salvar banda/i }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('.banda-row', { hasText: editedName })).toBeVisible();
    const row = dbQuery("SELECT u.perfil, ub.perfil AS banda_perfil, b.plano FROM usuarios u JOIN usuario_banda ub ON ub.usuario_id=u.id JOIN bandas b ON b.id=ub.banda_id WHERE u.nome='Test Paid Admin'").rows[0];
    expect(row).toMatchObject({ perfil: 'usuario', banda_perfil: 'administrador', plano: 'anual' });
    expect(dbQuery('SELECT nome, logo FROM bandas WHERE id=?', [BAND_ID]).rows[0]).toMatchObject({ nome: editedName, logo: null });
  } finally {
    dbQuery('UPDATE bandas SET nome=?, logo=? WHERE id=?', [original.nome, original.logo, BAND_ID]);
    await context.close();
  }
});

test('2. gestor cria música e repertório pela interface', async ({ browser }) => {
  dbQuery("UPDATE bandas SET plano='anual' WHERE id=?", [BAND_ID]);
  const { context, page } = await contextPage(browser, GESTOR);
  const songName = `${PREFIX}_GESTOR_SONG`;
  const playlistName = `${PREFIX}_GESTOR_PLAYLIST`;
  try {
    await refreshBand(page);
    const saved = await saveSongUi(page, songName);
    expect(saved.response.status(), JSON.stringify(saved.json)).toBe(200);
    expect(saved.json.ok ?? saved.json.sucesso).toBe(true);
    await page.goto('/src/backend/editor/editorplaylist.php');
    await page.getByRole('button', { name: /Novo repertório/i }).click();
    await page.locator('#novaPlaylistNome').fill(playlistName);
    await page.getByRole('button', { name: /Criar repertório/i }).click();
    const addSong = page.locator('#musicasDisponiveis .song-row', { hasText: songName }).getByRole('button', { name: /Adicionar/i });
    await expect(addSong).toBeEnabled();
    await expect.poll(async () => {
      const count = await page.evaluate(() => playlistAtual?.itens?.length || 0);
      if (count === 0 && await addSong.isVisible()) await addSong.click();
      return page.evaluate(() => playlistAtual?.itens?.length || 0);
    }).toBe(1);
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(1);
    await page.getByRole('button', { name: /Salvar repertório/i }).click();
    await expect(page.locator('#playlistSelecionada')).toHaveValue(/\d+/);
    expect(dbQuery('SELECT id FROM playlists WHERE banda_id=? AND nome=?', [BAND_ID, playlistName]).rows).toHaveLength(1);
  } finally { await context.close().catch(() => {}); }
});

test('3. básico visualiza cifras, apresenta e pode iniciar live', async ({ browser }) => {
  const { context, page } = await contextPage(browser, BASICO);
  try {
    await refreshBand(page);
    const song = page.locator('#music-list a[href*="music.php?id="]').first();
    await expect(song).toBeVisible();
    await song.click();
    await expect(page.locator('#song-cifra')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.cifroPresentation));
    expect(await page.evaluate(() => window.CIFRO_CAN_HOST)).toBe(true);
    await page.locator('#menuButton').click();
    await page.locator('button.music-secondary-action', { hasText: 'Modo apresentação' }).click();
    await expect(page.locator('body')).toHaveClass(/cifro-presenting/);
    await expect(page.locator('#musicQuickBar')).toBeVisible();
    await page.keyboard.press('Escape');
    const response = await page.request.post('/api/live/host.php', { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrf(page) }, data: JSON.stringify({ action: 'start' }) });
    expect(response.status(), await response.text()).toBe(200);
  } finally { await context.close(); }
});

test('4. externo acompanha live mas não pode ser host', async ({ browser }) => {
  const { context, page } = await contextPage(browser, EXTERNO);
  try {
    await refreshBand(page);
    const status = await page.request.get('/api/live/status.php');
    expect(status.status()).toBe(200);
    const host = await page.request.post('/api/live/host.php', { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrf(page) }, data: JSON.stringify({ action: 'start' }) });
    expect(host.status()).toBe(403);
    await page.locator('#music-list a[href*="music.php?id="]').first().click();
    await expect(page.locator('#song-cifra')).toBeVisible();
    await page.locator('#menuButton').click();
    await expect(page.getByRole('button', { name: /Iniciar como líder/i })).toHaveCount(0);
  } finally { await context.close(); }
});

test('5. plano gratuito bloqueia a 11ª música de administrador não-master', async ({ browser }) => {
  dbQuery("UPDATE bandas SET plano='gratuito' WHERE id=?", [BAND_ID]);
  const initialCount = Number(dbQuery('SELECT COUNT(*) total FROM musicas WHERE banda_id=?', [BAND_ID]).rows[0].total);
  for (let i = initialCount; i < 10; i++) dbQuery('INSERT INTO musicas (banda_id,nome,artista,cifra) VALUES (?,?,?,?)', [BAND_ID, `${PREFIX}_FREE_${i + 1}`, 'E2E', '<b>C</b>']);
  const countAtLimit = Number(dbQuery('SELECT COUNT(*) total FROM musicas WHERE banda_id=?', [BAND_ID]).rows[0].total);
  const { context, page } = await contextPage(browser, ADMIN);
  try {
    await refreshBand(page);
    const saved = await saveSongUi(page, `${PREFIX}_FREE_BLOCKED`);
    expect(saved.response.status()).toBe(403);
    expect(saved.json.plano_limit).toBe(true);
    expect(Number(dbQuery('SELECT COUNT(*) total FROM musicas WHERE banda_id=?', [BAND_ID]).rows[0].total)).toBe(countAtLimit);
  } finally { await context.close(); }
});

test('6. plano pago é ilimitado e mantém a nova cifra offline', async ({ browser }) => {
  dbQuery("UPDATE bandas SET plano='anual' WHERE id=?", [BAND_ID]);
  const { context, page } = await contextPage(browser, ADMIN);
  const name = `${PREFIX}_PAID_OFFLINE`;
  try {
    await refreshBand(page);
    const saved = await saveSongUi(page, name, '<p><b>D A Bm G</b></p><p>Plano pago offline.</p>');
    expect(saved.response.status()).toBe(200);
    await prepareOffline(page);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#search').fill(name);
    await page.locator('#music-list a', { hasText: name }).click();
    await expect(page.locator('#song-cifra')).toContainText('Plano pago offline.');
  } finally { await context.setOffline(false).catch(() => {}); await context.close(); }
});

test('7. básico publica e externo recebe o mesmo estado live no servidor', async ({ browser }) => {
  const host = await contextPage(browser, BASICO);
  const follower = await contextPage(browser, EXTERNO);
  const liveName = `${PREFIX}_LIVE_SCROLL`;
  const liveBody = '<p><b>C G Am F</b></p><p>Live E2E</p>';
  dbQuery('INSERT INTO musicas (banda_id,nome,artista,cifra) VALUES (?,?,?,?)', [BAND_ID, liveName, 'E2E', liveBody]);
  const liveId = Number(dbQuery('SELECT id FROM musicas WHERE banda_id=? AND nome=?', [BAND_ID, liveName]).rows[0].id);
  try {
    await refreshBand(host.page);
    const token = await csrf(host.page);
    const started = await host.page.request.post('/api/live/host.php', { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, data: JSON.stringify({ action: 'start' }) });
    expect(started.status()).toBe(200);
    const hostId = (await started.json()).hostId;
    const published = await host.page.request.post('/api/live/update.php', { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, data: JSON.stringify({ hostId, cifraAtual: String(liveId), paginaAtual: `music.php?id=${liveId}`, scrollTop: 0, scrollPercent: 0, canSyncScroll: true }) });
    expect(published.status()).toBe(200);
    await refreshBand(follower.page);
    const state = await (await follower.page.request.get('/api/live/status.php')).json();
    expect(state.hasHost).toBe(true);
    expect(state.paginaAtual).toBe(`music.php?id=${liveId}`);
    expect(String(state.cifraAtual)).toBe(String(liveId));
  } finally { await host.context.close().catch(() => {}); await follower.context.close().catch(() => {}); }
});

test('8. roteiro sincronizado abre após F5 offline', async ({ browser }) => {
  const { context, page } = await contextPage(browser, MASTER);
  const title = `${PREFIX}_ROTEIRO_OFFLINE`;
  try {
    await refreshBand(page);
    const response = await page.request.post('/src/backend/editor/salvar_roteiros.php', { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrf(page) }, data: JSON.stringify({ action: 'save', titulo: title, conteudo: '<section><h2>Entrada</h2><p>Palco offline</p></section>', visivel_ate: '2099-12-31' }) });
    expect(response.status(), await response.text()).toBe(200);
    await prepareOffline(page);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Abrir repertórios/i }).click();
    await page.locator('.liRoteiro a', { hasText: title }).click();
    await expect(page.locator('#roteiro-title')).toHaveText(title);
    await expect(page.locator('#roteiro-body')).toContainText('Palco offline');
  } finally { await context.setOffline(false).catch(() => {}); await context.close(); }
});

for (const [role, state] of [['gestor', GESTOR], ['básico', BASICO], ['externo', EXTERNO]]) {
  test(`8.${role} navega e abre cifra após F5 offline`, async ({ browser }) => {
    const { context, page } = await contextPage(browser, state);
    try {
      await refreshBand(page);
      const song = page.locator('#music-list a[href*="music.php?id="]').first();
      const href = await song.getAttribute('href');
      expect(href).toMatch(/music\.php\?id=\d+/);
      await prepareOffline(page);
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#music-list')).toBeVisible();
      const offlineSong = page.locator(`#music-list a[href="${href}"]`);
      await expect(offlineSong).toBeVisible();
      await offlineSong.click();
      await expect(page.locator('#song-cifra')).toBeVisible();
      await expect(page.locator('#song-cifra')).toHaveAttribute('aria-busy', 'false');
    } finally {
      await context.setOffline(false).catch(() => {});
      await context.close();
    }
  });
}

test('8. menus administrativos exibem bloqueio sem rede e sem servidor', async ({ browser }) => {
  const { context, page } = await contextPage(browser, ADMIN);
  const assertBlocked = async label => {
    const before = page.url();
    const drawer = page.locator('#menusideMenu');
    if (await drawer.getAttribute('aria-hidden') === 'false') await page.locator('#menusideMenuOverlay').click({ position: { x: 5, y: 5 } });
    await page.locator('#menuButtonTop').click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await page.waitForTimeout(300);
    const link = page.locator('.sidemenu-nav a[data-requires-server]', { hasText: label });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    const dialog = page.getByRole('dialog', { name: /Sem conexão com o servidor/i });
    await expect(dialog).toContainText(/não está disponível no modo offline/i);
    await dialog.getByRole('button', { name: 'Entendi' }).click();
    await page.locator('#menusideMenuOverlay').click({ position: { x: 5, y: 5 } });
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(page.url()).toBe(before);
  };
  try {
    await refreshBand(page);
    await prepareOffline(page);
    await context.setOffline(true);
    for (const label of ['Categorias', 'Músicas', 'Usuários']) await assertBlocked(label);
    await context.setOffline(false);
    await context.addCookies([{ name: 'cifro_e2e_server_down', value: '1', url: test.info().project.use.baseURL }]);
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    for (const label of ['Categorias', 'Músicas', 'Usuários']) await assertBlocked(label);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.clearCookies({ name: 'cifro_e2e_server_down' }).catch(() => {});
    await context.close().catch(() => {});
  }
});

test('9. compartilhamento formata desktop e aciona compartilhamento nativo móvel', async ({ browser }) => {
  const song = dbQuery('SELECT id, nome FROM musicas WHERE banda_id=? ORDER BY id LIMIT 1', [BAND_ID]).rows[0];
  expect(song).toBeTruthy();
  const playlistName = `${PREFIX}_SHARE_UI`;
  dbQuery('INSERT INTO playlists (banda_id,nome,visivel_ate,itens) VALUES (?,?,?,?)', [BAND_ID, playlistName, '2099-12-31', JSON.stringify([{ id: Number(song.id), tom: 'G' }])]);
  const desktop = await contextPage(browser, MASTER);
  const mobileContext = await browser.newContext({ storageState: MASTER, serviceWorkers: 'allow', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', viewport: { width: 390, height: 844 } });
  await mobileContext.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
  const mobile = await mobileContext.newPage();
  try {
    await desktop.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await refreshBand(desktop.page);
    await desktop.page.goto('/src/backend/editor/editorplaylist.php');
    await desktop.page.locator('#playlistSelecionada').selectOption({ label: playlistName });
    await desktop.page.locator('#btnCompartilharPlaylist').click();
    const copied = (await desktop.page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    expect(copied).toContain(`🎶 REPERTÓRIO\n*${playlistName}*`);
    expect(copied).toContain(`${song.nome}`);
    expect(copied).toContain('🎼 Tom: *G*');
    expect(copied).toContain('/landing.php');
    await mobile.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: true } });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { window.__sharedPayload = payload; } });
    });
    await refreshBand(mobile);
    await mobile.goto('/src/backend/editor/editorplaylist.php');
    await mobile.locator('#playlistSelecionada').selectOption({ label: playlistName });
    await mobile.locator('#btnCompartilharPlaylist').click();
    const payload = await mobile.evaluate(() => window.__sharedPayload);
    expect(payload.text).toContain(`*${playlistName}*`);
    expect(payload.text).toContain(song.nome);
  } finally { await desktop.context.close(); await mobileContext.close(); }
});

test('10. instalação PWA antiga é atualizada sem limpar dados', async ({ browser }) => {
  const { context, page } = await contextPage(browser, MASTER);
  try {
    await page.goto('/index.php');
    await page.evaluate(async () => {
      const current = await navigator.serviceWorker.getRegistration();
      if (current) await current.unregister();
    });
    await page.goto('/api/csrf.php');
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const remove = indexedDB.deleteDatabase('cifro');
        remove.onsuccess = resolve;
        remove.onerror = () => reject(remove.error);
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('cifro', 5);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const name of ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta']) {
            db.createObjectStore(name, { keyPath: 'banda_id' });
          }
          request.transaction.objectStore('cifro_musicas').put({ banda_id: '__legacy_e2e__', data: [{ id: 999, nome: 'Legado preservado' }] });
        };
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
      });
    });
    const oldVersion = await page.evaluate(async () => {
      const old = await navigator.serviceWorker.register('/service-worker-e2e-old.php', { scope: '/' });
      await new Promise(resolve => {
        if (old.active) return resolve();
        const worker = old.installing || old.waiting;
        worker?.addEventListener('statechange', () => worker.state === 'activated' && resolve(), { once: true });
        setTimeout(resolve, 5000);
      });
      localStorage.setItem('__e2e_preservado__', 'sim');
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => resolve(event.data.version);
        (old.active || old.waiting).postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      });
    });
    expect(oldVersion).toBe('e2e-old-real');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/service-worker.php', { scope: '/' });
      await registration.update();
      const waiting = await new Promise(resolve => {
        if (registration.waiting) return resolve(registration.waiting);
        const check = () => {
          if (registration.waiting) resolve(registration.waiting);
          else setTimeout(check, 50);
        };
        check();
        setTimeout(() => resolve(null), 10000);
      });
      if (!waiting) throw new Error('Novo Service Worker não chegou ao estado waiting.');
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(resolve, 10000);
      });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL.includes('/service-worker.php');
    }), { timeout: 20000 }).toBe(true);
    await expect.poll(() => page.evaluate(async () => !(await caches.keys()).includes('cifro-static-e2e-old-real')), { timeout: 15000 }).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('__e2e_preservado__'))).toBe('sim');
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    expect(await page.evaluate(async () => new Promise((resolve, reject) => {
      const request = indexedDB.open('cifro');
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('cifro_musicas').objectStore('cifro_musicas').get('__legacy_e2e__');
        read.onsuccess = () => { const value = read.result; db.close(); resolve(value?.data?.[0]?.nome); };
        read.onerror = () => reject(read.error);
      };
      request.onerror = () => reject(request.error);
    }))).toBe('Legado preservado');
  } finally { await context.close(); }
});
