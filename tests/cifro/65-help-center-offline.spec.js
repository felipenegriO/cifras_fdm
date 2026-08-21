import { test, expect } from '../fixtures/diagnostics.js';

test('Central de Ajuda permanece disponível sem conexão após preparação real', async ({ page, context }) => {
  await page.goto('/config.php');
  const csrf = (await page.request.get('/api/csrf.php')).json();
  const { csrf_token: token } = await csrf;
  await page.request.post('/src/backend/users/salvar_config.php', {
    data: JSON.stringify({ config: { ajudaDesativada: false } }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
  });
  await page.evaluate(() => localStorage.setItem('cifro-ajudaDesativada', 'false'));

  await page.goto('/index.php');
  await page.evaluate(async () => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();

  await page.goto('/ajuda.php');
  await expect(page.getByRole('heading', { name: 'Como podemos ajudar?' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match('/ajuda.php')))).toBe(true);

  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Como podemos ajudar?' })).toBeVisible();
    await expect(page.locator('.help-article-card')).toHaveCount(11);
  } finally {
    await context.setOffline(false);
  }
});
