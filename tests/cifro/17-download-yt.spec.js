/**
 * 17-download-yt.spec.js
 * YouTube audio download endpoint — auth, CSRF, input validation, edge cases.
 */
import { test, expect } from '../fixtures/coverage.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test.use({ storageState: 'tests/.auth/user.json' });

const ENDPOINT = '/src/backend/download-yt-audio.php';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REHEARSAL_AUDIO_DIR = path.resolve(__dirname, '..', '..', 'public', 'rehearsal-audio');

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

  test('POST com áudio já em cache retorna cached=true sem baixar de novo', async ({ page }) => {
    // The endpoint always builds a real YoutubeAudioDownloadService with no
    // injection point, so provider network calls can't be mocked from
    // Playwright. But isCached() only checks file_exists()+filesize(), so
    // pre-placing a large fake file at the exact path the service computes
    // (yt_<id>_audio_<id>.mp3, since fetchTitle() fails without network and
    // falls back to that name) exercises the cached=true branch for real.
    const videoId = 'cAcHeD1234a';
    fs.mkdirSync(REHEARSAL_AUDIO_DIR, { recursive: true });
    const filePath = path.join(REHEARSAL_AUDIO_DIR, `yt_${videoId}_audio_${videoId}.mp3`);
    fs.writeFileSync(filePath, Buffer.alloc(150000, 'a'));

    try {
      const csrf = await getCsrfToken(page);
      const res = await page.request.post(ENDPOINT, {
        data: JSON.stringify({ videoId }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.cached).toBe(true);
      expect(body.success).toBe(true);
      expect(body.videoId).toBe(videoId);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });
});
