import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test('reabre o PWA sem internet e sem sessão do servidor usando o acesso offline preparado', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: 'tests/.auth/user.json',
    serviceWorkers: 'allow',
  });
  let page = await context.newPage();

  try {
    await page.goto('/index.php');
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    await expect.poll(() => page.evaluate(async () => {
      const status = await cifroSync.getOfflineStatus(window.CIFRO_BAND_ID);
      return status.ready && status.shellReady;
    }), { timeout: 30000 }).toBe(true);

    const expected = await page.evaluate(() => ({
      userId: window.CIFRO_USER_ID,
      bandId: window.CIFRO_BAND_ID,
      firstSong: window.songs[0]?.nome || '',
    }));

    await context.clearCookies();
    await page.close();
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto('/index.php', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#music-list')).toBeVisible();
    await expect(page.locator('#loginForm')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Criar conta grátis');
    await expect.poll(() => page.evaluate(() => ({
      userId: window.CIFRO_USER_ID,
      bandId: window.CIFRO_BAND_ID,
      firstSong: window.songs[0]?.nome || '',
    }))).toEqual(expected);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
  }
});
