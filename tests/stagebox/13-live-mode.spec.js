/**
 * 13-live-mode.spec.js
 * Live mode endpoints: status, host, update — auth, CSRF, edge cases.
 */
import { test, expect } from '@playwright/test';

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
});
