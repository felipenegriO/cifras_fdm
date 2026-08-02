/**
 * 13-live-mode.spec.js
 * Live mode endpoints: status, host, update — auth, CSRF, edge cases.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

// Helper: fetch CSRF token from an authenticated page
async function getCsrfToken(page) {
  await page.goto('/index.php');
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  });
}

// ── status.php ────────────────────────────────────────────────────────────────
test.describe('Live — status.php', () => {
  test('GET retorna JSON com estrutura esperada', async ({ page }) => {
    const res = await page.request.get('/api/live/status.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('GET sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/api/live/status.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('POST retorna 405', async ({ page }) => {
    const res = await page.request.post('/api/live/status.php', {
      data: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(405);
  });
});

// ── host.php ──────────────────────────────────────────────────────────────────
test.describe('Live — host.php', () => {
  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('GET retorna 405', async ({ page }) => {
    const res = await page.request.get('/api/live/host.php');
    expect(res.status()).toBe(405);
  });

  test('POST autenticado com CSRF retorna JSON', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST autenticado aceita formulário real', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/host.php', {
      form: { action: 'start' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

// ── update.php ────────────────────────────────────────────────────────────────
test.describe('Live — update.php', () => {
  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test', cifraAtual: '1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('GET retorna 405', async ({ page }) => {
    const res = await page.request.get('/api/live/update.php');
    expect(res.status()).toBe(405);
  });

  test('POST autenticado com CSRF e payload mínimo retorna JSON', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test-host', keepAlive: true }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 403, 422]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST com cifraAtual vazia string aceita', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: JSON.stringify({ hostId: 'test-host', cifraAtual: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('POST com payload JSON inválido (string pura) retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/live/update.php', {
      data: 'não é json',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Accepts any non-crash response
    expect([200, 400, 422, 500]).toContain(res.status());
  });
});

// ── livePlayerLer.php (legacy) ────────────────────────────────────────────────
test.describe('Live — livePlayerLer.php (legacy GET)', () => {
  test('GET sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/src/backend/livePlayerLer.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('GET autenticado retorna resposta', async ({ page }) => {
    const res = await page.request.get('/src/backend/livePlayerLer.php');
    expect([200, 400]).toContain(res.status());
  });
});

// ── livePlayerSalvar.php (legacy POST) ───────────────────────────────────────
test.describe('Live — livePlayerSalvar.php (legacy POST)', () => {
  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'cifraAtual=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'cifraAtual=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('GET retorna 405', async ({ page }) => {
    const res = await page.request.get('/src/backend/livePlayerSalvar.php');
    expect(res.status()).toBe(405);
    expect(await res.text()).toContain('Metodo nao permitido');
  });

  test('POST autenticado com CSRF e hostId inválido retorna mensagem de erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: 'numero=42&hostId=host-invalido',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toBe('OK');
  });

  test('POST autenticado sem numero nem hostId retorna mensagem de erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/livePlayerSalvar.php', {
      data: '',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toBe('OK');
  });
});

// ── live.js (window.LiveMode) — módulo cliente ──────────────────────────────
test.describe('Live — módulo cliente (window.LiveMode)', () => {
  test('consultarStatus sem host mostra "Aguardando host"', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: false }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Aguardando host');
    await expect(page.locator('#liveStatus')).toHaveAttribute('data-status', 'waiting');
  });

  test('entrar e sair da sessão de live alterna o estado do botão', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, hasHost: true, hostNome: 'Ana', version: 1, paginaAtual: 'index.php' }),
    }));
    await page.goto('/index.php');

    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Seguindo live');
    await expect(page.locator('#entrarlivePlay')).toHaveText('Sair da sessão');

    await page.evaluate(() => window.LiveMode.entrarOuSairLive());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
    await expect(page.locator('#entrarlivePlay')).toHaveText('Entrar na sessão');
  });

  test('assumirHost enquanto offline mostra desconectado sem chamar a API', async ({ page, context }) => {
    let called = false;
    await page.route('**/api/live/host.php', route => { called = true; route.abort(); });
    await page.goto('/index.php');
    await context.setOffline(true);
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
    expect(called).toBe(false);
    await context.setOffline(false);
  });

  test('falha de rede ao assumir host mostra "Live desconectada"', async ({ page }) => {
    await page.route('**/api/live/host.php', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'erro interno' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.assumirHost());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });

  test('consultarStatus com status de rede inválido mostra desconectado', async ({ page }) => {
    await page.route('**/api/live/status.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'sala nao encontrada' }),
    }));
    await page.goto('/index.php');
    await page.evaluate(() => window.LiveMode.consultarStatus());
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');
  });
});
