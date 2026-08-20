import { test, expect } from '@playwright/test';
import { fazerLogin } from '../helpers/auth.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

async function emulateDisplayMode(page, { standalone, reducedMotion = false }) {
  await page.addInitScript(({ installed, reduced }) => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const result = nativeMatchMedia(query);
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { configurable: true, value: installed });
      if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(result, 'matches', { configurable: true, value: reduced });
      return result;
    };
    window.__cifroSplashStates = [];
    document.addEventListener('cifro:pwa-splash', event => window.__cifroSplashStates.push(event.detail?.state));
  }, { installed: standalone, reduced: reducedMotion });
}

test('não executa a splash no navegador comum', async ({ page }) => {
  await emulateDisplayMode(page, { standalone: false });
  await page.goto('/index.php');
  await expect(page.locator('#cifroPwaSplash')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cifroSplashStates)).toEqual([]);
});

test('executa a animação somente no PWA instalado e apenas uma vez por sessão', async ({ page }, testInfo) => {
  await emulateDisplayMode(page, { standalone: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cifroPwaSplash')).toBeVisible();
  await page.waitForTimeout(650);
  await testInfo.attach('splash-mobile-mid-animation', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('#cifroPwaSplash')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => window.__cifroSplashStates)).toEqual(['started', 'finished']);
  expect(await page.evaluate(() => sessionStorage.getItem('cifroPwaSplashShown'))).toBe('1');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cifroPwaSplash')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cifroSplashStates)).toEqual([]);
});

test('respeita preferência por movimento reduzido', async ({ page }) => {
  await emulateDisplayMode(page, { standalone: true, reducedMotion: true });
  await page.goto('/index.php');
  await expect(page.locator('#cifroPwaSplash')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cifroSplashStates)).toEqual([]);
});

test('mantém composição centralizada em tablet', async ({ page }, testInfo) => {
  await emulateDisplayMode(page, { standalone: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cifroPwaSplash')).toBeVisible();
  await page.waitForTimeout(650);
  const layout = await page.locator('.cifro-pwa-splash__logo').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
  });
  expect(layout.width).toBeGreaterThanOrEqual(250);
  expect(Math.abs(layout.centerX - 512)).toBeLessThan(2);
  expect(Math.abs(layout.centerY - 384)).toBeLessThan(2);
  await testInfo.attach('splash-tablet-mid-animation', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('#cifroPwaSplash')).toHaveCount(0, { timeout: 5000 });
});

test('splash e aplicação abrem em um novo lançamento totalmente offline', async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'tests/.auth/user.json', serviceWorkers: 'allow' });
  let page = await context.newPage();
  await emulateDisplayMode(page, { standalone: true });

  try {
    await fazerLogin(page);
    await page.evaluate(() => sessionStorage.setItem('cifroPwaSplashShown', '1'));
    await page.goto('/index.php');
    await expect(page.locator('#cifroPwaSplash')).toHaveCount(0, { timeout: 5000 });
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    await expect.poll(() => page.evaluate(async () => {
      const status = await cifroSync.getOfflineStatus(window.CIFRO_BAND_ID);
      return status.ready && status.shellReady;
    }), { timeout: 30000 }).toBe(true);

    await page.close();
    await context.setOffline(true);
    page = await context.newPage();
    await emulateDisplayMode(page, { standalone: true });
    await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#cifroPwaSplash')).toBeVisible();
    await expect(page.locator('#cifroPwaSplash')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('#music-list')).toBeVisible();
    expect(await page.evaluate(() => window.__cifroSplashStates)).toEqual(['started', 'finished']);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
  }
});
