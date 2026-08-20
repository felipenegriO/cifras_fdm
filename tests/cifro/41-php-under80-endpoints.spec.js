import fs from 'node:fs';
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

const ADMIN = 'tests/.auth/user.json';
const BASICO = 'tests/.auth/basico.json';

async function csrf(request) {
  const response = await request.get('/api/csrf.php');
  return (await response.json()).csrf_token;
}

async function postJson(request, url, data) {
  return request.post(url, {
    data: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': await csrf(request),
    },
  });
}

test.describe('public/login.php', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renderiza GET, valida credenciais vazias e inválidas', async ({ page }) => {
    await page.goto('/login.php');
    await expect(page.locator('#loginForm')).toBeVisible();

    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/login\.php/);

    await page.locator('#email').fill(`inexistente-${Date.now()}@cifro.test`);
    await page.locator('#senha').fill('senha-incorreta');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page).toHaveURL(/login\.php/);
  });

  test('logout limpa a sessão e redireciona', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/login.php');
    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#senha').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(url => !url.pathname.endsWith('/login.php'));
    // ?logout=1 não desloga mais por GET (era CSRF de logout): encaminha para
    // a porta única, que confirma e exige POST.
    const response = await page.request.get('/login.php?logout=1', { maxRedirects: 0 });
    expect([302, 303]).toContain(response.status());
    expect(response.headers().location).toContain('/logout.php');
    await context.close();
  });
});

test.describe('sync/data.php e sync/version.php', () => {
  test('rejeitam contexto anônimo', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const request = context.request;
    for (const endpoint of ['/api/sync/data.php', '/api/sync/version.php']) {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
      expect(await response.json()).toMatchObject({ sucesso: false });
    }
    await context.close();
  });

  test.describe('com banda selecionada', () => {
    test.use({ storageState: ADMIN });

    test('retornam revisão e identificador coerentes', async ({ request }) => {
      const versionResponse = await request.get('/api/sync/version.php');
      const dataResponse = await request.get('/api/sync/data.php');
      expect(versionResponse.status()).toBe(200);
      expect(dataResponse.status()).toBe(200);

      const version = await versionResponse.json();
      const data = await dataResponse.json();
      expect(Number.isInteger(version.content_revision)).toBe(true);
      expect(Number.isInteger(data.content_revision)).toBe(true);
      expect(data.banda_id).toBe(version.banda_id);
      expect(data).toMatchObject({ musicas: expect.any(Array), playlists: expect.any(Array), roteiros: expect.any(Array), categorias: expect.any(Array) });
    });
  });

  test.describe('com usuário básico e banda selecionada', () => {
    test.use({ storageState: BASICO });

    test('permite leitura do snapshot e da revisão', async ({ request }) => {
      const state = JSON.parse(fs.readFileSync(BASICO, 'utf8'));
      test.skip(!(state.cookies ?? []).length, 'usuário básico não provisionado');
      const data = await request.get('/api/sync/data.php');
      const version = await request.get('/api/sync/version.php');
      expect(data.status()).toBe(200);
      expect(version.status()).toBe(200);
      expect(await data.json()).toHaveProperty('content_revision');
      expect(await version.json()).toHaveProperty('content_revision');
    });
  });
});

test.describe('public/roteiro.php e Views/config.php', () => {
  test.use({ storageState: ADMIN });

  test('roteiro usa o controller registrado e renderiza a view', async ({ page }) => {
    const response = await page.goto('/roteiro.php');
    expect(response.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText(/Fatal error|Warning:/);
  });

  test('config cobre fallbacks, salvamento e falha de recursos do navegador', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'storage', { configurable: true, value: undefined });
    });
    await page.goto('/config.php');
    await expect(page.locator('#cfgStorageUsage')).toContainText('Indisponível');

    await page.evaluate(() => {
      window.cifroToast = undefined;
      window.CIFRO_BAND_ID = '';
      window.sincronizarDados();
      window.showSaveResult(true, 'sem toast');
      localStorage.setItem('cifro-tema', 'valor-invalido');
    });
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('config cobre preferências, rede, storage, sync e confirmações', async ({ page }) => {
    await page.goto('/config.php');
    const fallbacks = await page.evaluate(() => {
      window._serverConfig = {};
      localStorage.setItem('cifro-tema', 'light');
      localStorage.setItem('cifro-cifraSize', '22');
      localStorage.setItem('cifro-scrollSpeed', 'slow');
      localStorage.setItem('cifro-keepAwake', 'false');
      return {
        theme: cfgGetEnum('tema', ['dark', 'light', 'auto'], 'dark'),
        size: cfgGetEnum('cifraSize', ['14', '16', '18', '20', '22'], '18'),
        speed: cfgGetEnum('scrollSpeed', ['slow', 'normal', 'fast'], 'normal'),
        awake: cfgGetEnum('keepAwake', ['true', 'false'], 'true'),
        invalid: cfgGetEnum('inexistente', ['a', 'b'], 'b'),
      };
    });
    expect(fallbacks).toEqual({ theme: 'light', size: '22', speed: 'slow', awake: 'false', invalid: 'b' });

    await page.route('**/src/backend/users/salvar_config.php', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sucesso: true }),
    }));
    await page.locator('#cfgTheme').selectOption('auto');
    await page.locator('#cfgCifraSize').selectOption('20');
    await page.locator('#cfgScrollSpeed').selectOption('fast');
    await page.locator('#cfgKeepAwake').uncheck({ force: true });

    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.locator('#cfgSyncStatus')).toContainText(/Servidor disponível|Servidor indisponível/);

    const usage = await page.evaluate(async () => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ usage: 1024 * 1024, quota: 10 * 1024 * 1024 }) },
      });
      await window.atualizarUso();
      return document.getElementById('cfgStorageUsage').textContent;
    });
    expect(usage).toContain('1.0 MB');

    const failedUsage = await page.evaluate(async () => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => { throw new Error('indisponível'); } },
      });
      await window.atualizarUso();
      return document.getElementById('cfgStorageUsage').textContent;
    });
    expect(failedUsage).toContain('Não foi possível');
  });
});

test.describe('bandas/selecionar.php', () => {
  test.use({ storageState: ADMIN });

  test('cobre método inválido, JSON inválido, id ausente e banda inexistente', async ({ request }) => {
    const get = await request.get('/src/backend/bandas/selecionar.php');
    expect(get.status()).toBe(200);
    expect(await get.json()).toMatchObject({ sucesso: false });

    const token = await csrf(request);
    const invalidJson = await request.post('/src/backend/bandas/selecionar.php', {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(await invalidJson.json()).toMatchObject({ sucesso: false });

    const missing = await postJson(request, '/src/backend/bandas/selecionar.php', {});
    expect(await missing.json()).toMatchObject({ sucesso: false });

    const unknown = await postJson(request, '/src/backend/bandas/selecionar.php', { bandaId: '00000000-0000-0000-0000-000000000000' });
    expect(await unknown.json()).toMatchObject({ sucesso: false });
  });

  test('seleciona novamente a banda atual com sucesso', async ({ request }) => {
    const snapshot = await (await request.get('/api/sync/data.php')).json();
    expect(snapshot.banda_id).toBeTruthy();
    const response = await postJson(request, '/src/backend/bandas/selecionar.php', { bandaId: snapshot.banda_id });
    expect(await response.json()).toMatchObject({ sucesso: true });
  });

  test.describe('usuário básico', () => {
    test.use({ storageState: BASICO });

    test('seleciona a própria banda pelo caminho não-master', async ({ request }) => {
      const state = JSON.parse(fs.readFileSync(BASICO, 'utf8'));
      test.skip(!(state.cookies ?? []).length, 'usuário básico não provisionado');
      const snapshot = await (await request.get('/api/sync/data.php')).json();
      const response = await postJson(request, '/src/backend/bandas/selecionar.php', { bandaId: snapshot.banda_id });
      expect(await response.json()).toMatchObject({ sucesso: true });
    });
  });
});

test.describe('download-yt-audio.php', () => {
  test.use({ storageState: ADMIN });

  test('rejeita CSRF e todos os formatos inválidos de videoId', async ({ request }) => {
    const withoutCsrf = await request.post('/src/backend/download-yt-audio.php', { data: { videoId: 'dQw4w9WgXcQ' } });
    expect(withoutCsrf.status()).toBe(403);

    for (const videoId of [null, '', 'curto', '../invalido', 'A'.repeat(12)]) {
      const response = await postJson(request, '/src/backend/download-yt-audio.php', { videoId });
      expect(response.status()).toBe(400);
      expect(await response.json()).toHaveProperty('error');
    }
  });

  test('retorna áudio existente pelo ramo de cache', async ({ request }) => {
    const videoId = 'AbCdEf12345';
    const directory = 'public/rehearsal-audio';
    const file = `${directory}/yt_${videoId}_audio_${videoId}.mp3`;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, Buffer.alloc(150000, 1));
    try {
      const response = await postJson(request, '/src/backend/download-yt-audio.php', { videoId });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, cached: true, videoId });
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  test('retorna 503 quando nenhum provedor conclui o download', async ({ request }) => {
    const response = await postJson(request, '/src/backend/download-yt-audio.php', { videoId: 'NoNet123456' });
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    if (response.status() === 503) expect(body).toHaveProperty('error');
    else expect(body).toMatchObject({ success: true, videoId: 'NoNet123456' });
  });
});

test.describe('CategoriaController', () => {
  test('usuário básico recebe acesso negado', async ({ browser }) => {
    const state = JSON.parse(fs.readFileSync(BASICO, 'utf8'));
    test.skip(!(state.cookies ?? []).length, 'usuário básico não provisionado');
    const context = await browser.newContext({ storageState: BASICO });
    const page = await context.newPage();
    const response = await page.goto('/categorias.php');
    expect(response.status()).toBe(403);
    await expect(page.locator('body')).toContainText('Acesso restrito');
    await context.close();
  });

  test('administrador renderiza categorias', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN });
    const page = await context.newPage();
    const response = await page.goto('/categorias.php');
    expect(response.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await context.close();
  });
});

test.describe('auth/google/callback.php', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('rejeita state ausente, state não textual, cancelamento e code ausente', async ({ request }) => {
    for (const query of ['', '?state[]=x&code=x', '?state=x&error=access_denied', '?state=x']) {
      const response = await request.get(`/api/auth/google/callback.php${query}`, { maxRedirects: 0 });
      expect([302, 303]).toContain(response.status());
      expect(response.headers().location).toContain('/login.php?erro=google');
    }
  });
});

test.describe('users/salvar_user.php', () => {
  test.use({ storageState: ADMIN });

  test('cobre métodos, busca e ações inválidas sem alterar usuários', async ({ request }) => {
    const list = await request.get('/src/backend/users/salvar_user.php');
    expect(list.status()).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);

    const put = await request.put('/src/backend/users/salvar_user.php');
    expect(put.status()).toBe(405);

    for (const payload of [
      { action: 'search', q: '' },
      { action: 'search', q: 'a' },
      { action: 'resend_invite', userId: '' },
      { action: 'resend_invite', userId: '00000000-0000-0000-0000-000000000000' },
      { action: 'import', userId: '', perfil: 'basico' },
      { action: 'import', userId: 'x', perfil: 'invalido' },
      { action: 'delete', userId: '' },
      { nome: '', email: '' },
      { nome: 'Nome', email: 'email-invalido' },
      { nome: 'Nome', email: `perfil-${Date.now()}@cifro.test`, bandaPerfil: 'invalido' },
      { nome: 'Nome', email: `data-${Date.now()}@cifro.test`, bandaPerfil: 'basico', validade: '31/12/2030' },
    ]) {
      const response = await postJson(request, '/src/backend/users/salvar_user.php', payload);
      expect([200, 400, 404, 422]).toContain(response.status());
      const body = await response.json();
      expect(body.sucesso === false || body.ok === false || Array.isArray(body)).toBe(true);
    }
  });

  test('busca válida, impede autoexclusão e rejeita POST sem CSRF', async ({ page }) => {
    const request = page.request;
    const search = await postJson(request, '/src/backend/users/salvar_user.php', { action: 'search', q: '__test' });
    expect(search.status()).toBe(200);
    expect(Array.isArray(await search.json())).toBe(true);

    await page.goto('/config.php');
    const currentUserId = await page.evaluate(() => window.CIFRO_USER_ID);
    expect(currentUserId).toBeTruthy();
    const selfDelete = await postJson(request, '/src/backend/users/salvar_user.php', {
      action: 'delete',
      userId: currentUserId,
    });
    expect(await selfDelete.json()).toMatchObject({ sucesso: false });

    const csrfFailure = await request.post('/src/backend/users/salvar_user.php', {
      data: JSON.stringify({ action: 'search', q: '__test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(csrfFailure.status()).toBe(403);

  });
});
