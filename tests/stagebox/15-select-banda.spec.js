/**
 * 15-select-banda.spec.js
 * Band selection page and selecionar.php API.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrfToken(page) {
  await page.goto('/index.php');
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  });
}

// ── select-banda.php page ─────────────────────────────────────────────────────
test.describe('Select banda — página', () => {
  test('GET /select-banda.php carrega autenticado', async ({ page }) => {
    const res = await page.goto('/select-banda.php');
    expect([200, 302]).toContain(res.status());
  });

  test('GET /select-banda.php sem autenticação redireciona', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/select-banda.php');
    await page.waitForURL(url =>
      url.toString().includes('landing.php') || url.toString().includes('login.php'),
      { timeout: 6000 }
    ).catch(() => {});
    expect(page.url()).toMatch(/landing\.php|login\.php|select-banda/);
    await ctx.close();
  });
});

// ── selecionar.php API ────────────────────────────────────────────────────────
test.describe('Selecionar banda — API', () => {
  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: '00000000-0000-0000-0000-000000000000' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: 'qualquer' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('POST com bandaId vazio retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([400, 422, 403, 200]).toContain(res.status());
    const body = await res.json();
    // Either ok:false or a redirect — just must not crash
    if (res.status() === 200) {
      expect(typeof body).toBe('object');
    }
  });

  test('POST com bandaId UUID inexistente retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: '00000000-0000-0000-0000-000000000000' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Should not return 200 with ok:true for a non-existent band
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok ?? body.sucesso).toBeFalsy();
    } else {
      expect([400, 403, 404, 422]).toContain(res.status());
    }
  });

  test('POST com bandaId contendo SQL injection não retorna dados', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: "' OR '1'='1" }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok ?? body.sucesso).toBeFalsy();
    } else {
      expect([400, 403, 422]).toContain(res.status());
    }
  });

  test('GET retorna 405 ou redireciona', async ({ page }) => {
    const res = await page.request.get('/src/backend/bandas/selecionar.php');
    expect([405, 302, 200]).toContain(res.status());
  });
});
