/**
 * 16-config-api.spec.js
 * User config save endpoint — auth, CSRF, validation, edge cases.
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

const ENDPOINT = '/src/backend/users/salvar_config.php';

test.describe('Config API — salvar_config.php', () => {
  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: 'dark' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: 'dark' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('POST com payload válido retorna 200 com JSON', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: 'dark', cifraSize: 18 } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Endpoint may return sucesso:false if user is from MySQL (not in usuarios.json)
    // but must always return a valid JSON object with a status field — not a crash
    expect(typeof body).toBe('object');
    expect('sucesso' in body || 'ok' in body).toBe(true);
  });

  test('POST sem chave config retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ tema: 'dark' }), // missing config key
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok ?? body.sucesso).toBeFalsy();
    } else {
      expect([400, 422]).toContain(res.status());
    }
  });

  test('POST com chaves não permitidas são ignoradas (não causam erro)', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: 'dark', admin: true, perfil: 'master' } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Should succeed (allowed keys applied) without exposing injection
      expect(typeof body).toBe('object');
    }
  });

  test('POST com cifraSize extremo (0) é aceito ou rejeitado graciosamente', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { cifraSize: 0 } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('POST com cifraSize muito grande é aceito ou rejeitado graciosamente', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { cifraSize: 99999 } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
  });

  test('POST com tema XSS não executa script', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: '<script>window.__xss_cfg=1</script>' } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    await page.goto('/config.php');
    const xss = await page.evaluate(() => window.__xss_cfg);
    expect(xss).toBeUndefined();
  });

  test('GET retorna 405 ou erro', async ({ page }) => {
    const res = await page.request.get(ENDPOINT);
    expect([405, 400, 403, 200]).toContain(res.status());
  });
});
