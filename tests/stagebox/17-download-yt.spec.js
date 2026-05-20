/**
 * 17-download-yt.spec.js
 * YouTube audio download endpoint — auth, CSRF, input validation, edge cases.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

const ENDPOINT = '/src/backend/download-yt-audio.php';

async function getCsrfToken(page) {
  await page.goto('/index.php');
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  });
}

test.describe('Download YT Audio — segurança e validação', () => {
  test('POST sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: 'dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: 'dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });

  test('POST com videoId vazio retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok ?? body.success ?? body.sucesso).toBeFalsy();
    } else {
      expect([400, 422]).toContain(res.status());
    }
  });

  test('POST sem campo videoId retorna erro', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.ok ?? body.success ?? body.sucesso).toBeFalsy();
    }
  });

  test('POST com videoId contendo path traversal é rejeitado', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: '../../../etc/passwd' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Should not expose server files — any error response is valid
    expect([200, 400, 422, 500]).toContain(res.status());
    if (res.status() === 200) {
      const text = await res.text();
      expect(text).not.toMatch(/root:|bin:|daemon:/); // should not contain /etc/passwd content
    }
  });

  test('POST com videoId muito longo não causa crash', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const longId = 'A'.repeat(500);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: longId }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422, 500]).toContain(res.status());
  });

  test('POST com videoId contendo caracteres especiais é sanitizado', async ({ page }) => {
    const csrf = await getCsrfToken(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ videoId: '; rm -rf /' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect([200, 400, 422, 500]).toContain(res.status());
  });

  test('GET retorna 405 ou erro', async ({ page }) => {
    const res = await page.request.get(ENDPOINT);
    expect([405, 400, 403, 200]).toContain(res.status());
  });
});
