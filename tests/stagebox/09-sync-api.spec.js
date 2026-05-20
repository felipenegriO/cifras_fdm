/**
 * 09-sync-api.spec.js
 * API de sincronização offline — version + data.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('API Sync — Version', () => {
  test('GET /api/sync/version.php retorna JSON com version', async ({ page }) => {
    const bandaId = await page.evaluate(() => window.FDM_BAND_ID || '');
    const res = await page.request.get('/api/sync/version.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.version).toBe('number');
  });

  test('GET sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/api/sync/version.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });
});

test.describe('API Sync — Data', () => {
  test('GET /api/sync/data.php retorna musicas, playlists, roteiros', async ({ page }) => {
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.musicas)).toBe(true);
    expect(Array.isArray(body.playlists)).toBe(true);
    expect(Array.isArray(body.roteiros)).toBe(true);
    expect(typeof body.version).toBe('number');
  });

  test('resposta inclui plano e trial_expira_em', async ({ page }) => {
    const res = await page.request.get('/api/sync/data.php');
    const body = await res.json();
    expect('plano' in body).toBe(true);
    expect('trial_expira_em' in body).toBe(true);
  });

  test('GET sem autenticação retorna 401', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get('/api/sync/data.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });
});

test.describe('API Live Mode', () => {
  test('GET /api/live/status.php retorna JSON', async ({ page }) => {
    const res = await page.request.get('/api/live/status.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('POST /api/live/host.php sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/api/live/host.php', {
      data: JSON.stringify({ action: 'start' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([403, 401]).toContain(res.status());
  });
});
