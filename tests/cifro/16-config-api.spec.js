/**
 * 16-config-api.spec.js
 * User config save endpoint — auth, CSRF, validation, edge cases.
 */
import { test, expect } from '../fixtures/coverage.js';

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
    // Config é persistida na coluna usuarios.config (MySQL) — deve sempre funcionar
    expect(body.sucesso).toBe(true);
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

  test('POST com cifraSize extremo é rejeitado', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { cifraSize: 0 } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).sucesso).toBe(false);
  });

  test('POST com cifraSize muito grande é rejeitado', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { cifraSize: 99999 } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).sucesso).toBe(false);
  });

  test('POST com tema XSS não executa script', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ config: { tema: '<script>window.__xss_cfg=1</script>' } }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    await page.goto('/config.php');
    const xss = await page.evaluate(() => window.__xss_cfg);
    expect(xss).toBeUndefined();
    await expect(page.locator('#cfgTheme')).toHaveValue(/^(dark|light|auto)$/);
  });

  test('GET retorna 405 ou erro', async ({ page }) => {
    const res = await page.request.get(ENDPOINT);
    expect([405, 400, 403, 200]).toContain(res.status());
  });

  test('valida todas as preferências aceitas e rejeita tipos incorretos', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const post = config => page.request.post(ENDPOINT, {
      data: JSON.stringify({ config }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });

    let response = await post({ tema: 'auto', cifraSize: '14', scrollSpeed: 'slow', keepAwake: true });
    expect(response.status(), await response.text()).toBe(200);
    response = await post({ tema: 'light', cifraSize: 22, scrollSpeed: 'fast', keepAwake: 'false' });
    expect(response.status()).toBe(200);
    response = await post({ keepAwake: false, scrollSpeed: 'normal' });
    expect(response.status()).toBe(200);

    for (const invalid of [
      { tema: 1 },
      { scrollSpeed: 1 },
      { scrollSpeed: 'rápida' },
      { keepAwake: 1 },
      { cifraSize: 'texto' },
    ]) {
      response = await post(invalid);
      expect(response.status()).toBe(422);
      expect((await response.json()).sucesso).toBe(false);
    }

    response = await page.request.post(ENDPOINT, {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await response.json()).sucesso).toBe(false);

    response = await post({ tema: 'dark', cifraSize: 18, scrollSpeed: 'normal', keepAwake: 'false' });
    expect(response.status()).toBe(200);
  });
});
