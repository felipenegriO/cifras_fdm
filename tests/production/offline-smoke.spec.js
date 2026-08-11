import { test, expect } from '@playwright/test';

const email = process.env.PROD_TEST_EMAIL?.trim();
const password = process.env.PROD_TEST_PASSWORD?.trim();

test('produção mantém a lista após desligar a rede e pressionar F5', async ({ page, context }) => {
  if (!email || !password) throw new Error('PROD_TEST_EMAIL e PROD_TEST_PASSWORD são obrigatórios.');

  await test.step('login real', async () => {
    await page.goto('login.php');
    await page.locator('#email').fill(email);
    await page.locator('#senha').fill(password);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.locator('nav.topnav, .select-banda-container, .index-container').first()).toBeVisible();
    if (page.url().includes('select-banda')) {
      await page.locator('.sb-card').first().click();
      await page.waitForURL(/index\.php/);
    }
  });

  let songCount = 0;
  let songHref = '';
  let songTitle = '';
  await test.step('confirma músicas e Service Worker preparado', async () => {
    await page.goto('index.php');
    await expect(page.locator('#music-list')).toBeVisible();
    await expect.poll(() => page.locator('#music-list a[href*="music.php?id="]').count(), { timeout: 15000 }).toBeGreaterThan(0);
    songCount = await page.locator('#music-list a[href*="music.php?id="]').count();
    const firstSong = page.locator('#music-list a[href*="music.php?id="]').first();
    songHref = await firstSong.getAttribute('href');
    songTitle = (await firstSong.textContent()).trim();

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        scriptURL: ready.active?.scriptURL || '',
        scope: ready.scope,
      };
    });
    expect(registration.controlled).toBe(true);
    expect(registration.scriptURL).toContain('/beta/public/service-worker.php');
    expect(registration.scope).toBe('https://cifro.online/beta/public/');

    await expect.poll(async () => page.evaluate(async () => {
      const status = await window.cifroSync.getOfflineStatus(window.CIFRO_BAND_ID);
      return status.shellReady && status.shellPreparedRevision === status.contentRevision;
    }), { timeout: 45000 }).toBe(true);

    expect(await page.evaluate(async () => Boolean(await caches.match('/beta/public/index.php')))).toBe(true);
  });

  await test.step('desliga a rede, pressiona F5 e confirma a lista', async () => {
    await context.setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/beta\/public\/index\.php/);
    await expect(page.locator('#music-list')).toBeVisible();
    await expect(page.locator('#music-list a[href*="music.php?id="]')).toHaveCount(songCount);
    await page.locator(`#music-list a[href="${songHref}"]`).click();
    await expect(page.locator('#song-title')).toContainText(songTitle.replace(/\s*[→›].*$/, '').trim());
    await expect(page.locator('#song-cifra')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#song-cifra')).not.toBeEmpty();
  });

  await test.step('mantém o navegador online e usa o cache quando o servidor falha', async () => {
    await context.setOffline(false);
    await page.goto('index.php');
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await context.route('**/beta/public/**', route => route.abort('failed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.locator('#music-list a[href*="music.php?id="]')).toHaveCount(songCount);
    await page.locator(`#music-list a[href="${songHref}"]`).click();
    await expect(page.locator('#song-cifra')).toHaveAttribute('aria-busy', 'false');
    await context.unroute('**/beta/public/**');
  });
});
