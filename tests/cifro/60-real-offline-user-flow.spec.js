import { test, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

const API = '/src/backend/editor/api.php';
const emptyStorageState = { cookies: [], origins: [] };

test.use({ storageState: emptyStorageState });
test.describe.configure({ mode: 'serial' });

function assertSafeE2eDatabase() {
  const environment = String(process.env.APP_ENV || '').trim().toLowerCase();
  const database = String(process.env.E2E_DB_NAME || '').trim();
  if (environment !== 'test') throw new Error('Este cenário exige APP_ENV=test.');
  if (!/(?:^|[_-])(?:e2e|test)(?:$|[_-])/i.test(database)) {
    throw new Error('E2E_DB_NAME deve identificar explicitamente um banco E2E/teste.');
  }
}

async function loginPelaInterface(page) {
  await page.goto('/login.php');
  await expect(page.locator('#loginForm')).toBeVisible();
  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.locator('nav.topnav, .select-banda-container, .index-container').first()).toBeVisible();

  if (page.url().includes('select-banda')) {
    await page.locator('.sb-card').first().click();
    await page.waitForURL(/index\.php/i);
  }
}

async function cadastrarMusica(page, nome, letra, acordes) {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
  await page.locator('#titulo').fill(nome);
  await page.evaluate(({ letra, acordes }) => {
    const editor = window.tinymce.get('cifraInput');
    editor.setContent(`<b>${acordes}</b><br>${letra}`);
    editor.dispatch('input');
  }, { letra, acordes });

  const responsePromise = page.waitForResponse(response =>
    response.url().includes('/src/backend/editor/api.php')
      && response.request().method() === 'POST'
      && response.ok()
  );
  await page.locator('#saveButton').click();
  const response = await responsePromise;
  await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
  const body = await response.json();
  expect(body.ok ?? body.sucesso).toBeTruthy();
  expect(body.id).toBeTruthy();
  return body.id;
}

async function abrirListaEEncontrar(page, nome) {
  await page.goto('/index.php');
  await expect(page.locator('#music-list')).toBeVisible();
  await page.locator('#search').fill(nome);
  const link = page.locator('#music-list a', { hasText: nome });
  await expect(link).toBeVisible({ timeout: 10000 });
  return link;
}

async function validarCifra(page, nome, letra, acordes) {
  await expect(page).toHaveURL(/music\.php\?id=\d+/);
  await expect(page.locator('#song-title')).toHaveText(nome);
  await expect(page.locator('#song-cifra')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#song-cifra')).toContainText(letra);
  await expect(page.locator('#song-cifra')).toContainText(acordes);
}

async function aguardarPacoteOffline(page) {
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      scriptURL: ready.active?.scriptURL || '',
      scope: ready.scope,
    };
  });
  expect(registration.controlled).toBe(true);
  expect(registration.scriptURL).toContain('/service-worker.php');
  expect(new URL(registration.scope).pathname).toBe(`${String(await page.evaluate(() => window.APP_BASE || '')).replace(/\/$/, '')}/`);
  await expect.poll(async () => page.evaluate(async () => {
    const status = await window.cifroSync.getOfflineStatus(window.CIFRO_BAND_ID);
    return status.shellReady && status.shellPreparedRevision === status.contentRevision;
  }), { timeout: 30000 }).toBe(true);
  const status = await page.evaluate(() => window.cifroSync.getOfflineStatus(window.CIFRO_BAND_ID));
  expect(status.ready).toBe(true);
  expect(status.shellReady).toBe(true);
  expect(status.shellPreparedAt).toBeGreaterThan(0);
  expect(status.shellPreparedRevision).toBe(status.contentRevision);
  return status;
}

async function confirmarMusicaNoBanco(page, id, musica) {
  const response = await page.request.get('/api/sync/data.php');
  expect(response.ok()).toBe(true);
  const snapshot = await response.json();
  const persisted = snapshot.musicas.find(item => Number(item.id) === Number(id));
  expect(persisted).toBeTruthy();
  expect(persisted.nome).toBe(musica.nome);
  expect(persisted.cifra).toContain(musica.letra);
  expect(persisted.cifra).toContain(musica.acordes);
}

async function confirmarPaginaNoCache(page, id) {
  const cached = await page.evaluate(async songId => {
    const response = await caches.match(`/music.php?id=${encodeURIComponent(songId)}`) || await caches.match('/music.php');
    return response ? { found: true, status: response.status, type: response.headers.get('content-type') } : { found: false };
  }, id);
  expect(cached.found).toBe(true);
  expect(cached.status).toBe(200);
  expect(cached.type).toContain('text/html');
}

async function anexarEvidencia(page, nome) {
  await test.info().attach(nome, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

async function excluirMusicasCriadas(page, ids) {
  if (!ids.length) return;
  const csrfResponse = await page.request.get('/api/csrf.php');
  expect(csrfResponse.ok()).toBe(true);
  const { csrf_token: csrf } = await csrfResponse.json();
  for (const id of ids) {
    const response = await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.ok ?? body.sucesso).toBeTruthy();
  }
  const snapshotResponse = await page.request.get('/api/sync/data.php');
  expect(snapshotResponse.ok()).toBe(true);
  const snapshot = await snapshotResponse.json();
  expect(snapshot.musicas.some(item => ids.some(id => Number(id) === Number(item.id)))).toBe(false);
}

test('usuário cadastra cifras e navega online, offline e com o servidor indisponível', async ({ page, context }) => {
  assertSafeE2eDatabase();
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const primeira = { nome: `__E2E_OFFLINE_1_${suffix}__`, letra: `Primeira linha ${suffix}`, acordes: 'C G Am F' };
  const segunda = { nome: `__E2E_OFFLINE_2_${suffix}__`, letra: `Segunda linha ${suffix}`, acordes: 'D A Bm G' };
  const ids = [];
  let serverOutageCookie = false;
  let phase = 'online';
  const secondSongOnlineVisits = [];

  page.on('framenavigated', frame => {
    if (phase === 'online' && frame === page.mainFrame() && ids[1] && frame.url().includes(`/music.php?id=${ids[1]}`)) {
      secondSongOnlineVisits.push(frame.url());
    }
  });

  try {
    await test.step('abre a aplicação e faz login pela interface', async () => {
      await loginPelaInterface(page);
      await expect(page).toHaveURL(/index\.php/);
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);
      await anexarEvidencia(page, '01-login-e-aplicacao-aberta');
    });

    await test.step('cadastra a primeira música no banco E2E', async () => {
      ids.push(await cadastrarMusica(page, primeira.nome, primeira.letra, primeira.acordes));
      await confirmarMusicaNoBanco(page, ids[0], primeira);
      await anexarEvidencia(page, '02-primeira-musica-cadastrada');
    });

    let link;
    await test.step('volta à lista, encontra e abre a primeira cifra online', async () => {
      link = await abrirListaEEncontrar(page, primeira.nome);
      expect(await link.getAttribute('href')).toContain(`id=${ids[0]}`);
      await anexarEvidencia(page, '03-primeira-musica-na-lista');
      await link.click();
      await validarCifra(page, primeira.nome, primeira.letra, primeira.acordes);
      await anexarEvidencia(page, '04-primeira-cifra-online');
    });

    await test.step('confirma que a sincronização preparou dados e página da primeira cifra', async () => {
      await page.goto('/index.php');
      await aguardarPacoteOffline(page);
      await confirmarPaginaNoCache(page, ids[0]);
    });

    await test.step('desliga a internet, executa F5 e usa a primeira cifra sem servidor', async () => {
      phase = 'offline-primeira';
      await context.setOffline(true);
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      await expect(page.locator('#music-list')).toBeVisible();
      await page.locator('#search').fill(primeira.nome);
      link = page.locator('#music-list a', { hasText: primeira.nome });
      await expect(link).toBeVisible();
      await link.click();
      await validarCifra(page, primeira.nome, primeira.letra, primeira.acordes);
      await anexarEvidencia(page, '05-primeira-cifra-sem-internet');
    });

    await test.step('religa a internet e cadastra a segunda música', async () => {
      await context.setOffline(false);
      phase = 'online';
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);
      ids.push(await cadastrarMusica(page, segunda.nome, segunda.letra, segunda.acordes));
      await confirmarMusicaNoBanco(page, ids[1], segunda);
      await anexarEvidencia(page, '06-segunda-musica-cadastrada');
    });

    await test.step('confirma a segunda música na lista e no pacote offline sem abri-la', async () => {
      link = await abrirListaEEncontrar(page, segunda.nome);
      expect(await link.getAttribute('href')).toContain(`id=${ids[1]}`);
      await aguardarPacoteOffline(page);
      await confirmarPaginaNoCache(page, ids[1]);
      expect(secondSongOnlineVisits).toEqual([]);
      await anexarEvidencia(page, '07-segunda-musica-na-lista-sem-visita');
    });

    await test.step('desliga a internet e abre a segunda cifra nunca visitada', async () => {
      phase = 'offline-segunda';
      await context.setOffline(true);
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      await link.click();
      await validarCifra(page, segunda.nome, segunda.letra, segunda.acordes);
      expect(secondSongOnlineVisits).toEqual([]);
      await anexarEvidencia(page, '08-segunda-cifra-sem-internet');
    });

    await test.step('mantém internet ativa e simula somente o servidor fora', async () => {
      await context.setOffline(false);
      phase = 'online';
      await page.goto('/index.php');
      await aguardarPacoteOffline(page);
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);

      await context.addCookies([{
        name: 'cifro_e2e_server_down',
        value: '1',
        url: test.info().project.use.baseURL,
      }]);
      serverOutageCookie = true;
      phase = 'servidor-indisponivel';

      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await page.evaluate(() => navigator.onLine)).toBe(true);
      const serverResponse = await page.request.get('/health.php');
      expect(serverResponse.status()).toBe(503);
      expect(await serverResponse.json()).toEqual({ status: 'unavailable', service: 'cifro' });
      const probe = await page.evaluate(() => window.CifroConnectivity.probe({ force: true, timeout: 1000 }));
      expect(probe).toBe(false);
      expect(await page.evaluate(() => window.CifroConnectivity.current())).toBe('servidor_indisponivel');
      await expect(page.locator('#music-list')).toBeVisible();
      await page.locator('#search').fill(segunda.nome);
      link = page.locator('#music-list a', { hasText: segunda.nome });
      await expect(link).toBeVisible();
      await link.click();
      await validarCifra(page, segunda.nome, segunda.letra, segunda.acordes);
      await anexarEvidencia(page, '09-cifra-com-internet-e-servidor-fora');
    });
  } finally {
    await context.setOffline(false).catch(() => {});
    if (serverOutageCookie) await context.clearCookies({ name: 'cifro_e2e_server_down' }).catch(() => {});
    phase = 'online';
    await excluirMusicasCriadas(page, ids);
  }
});
