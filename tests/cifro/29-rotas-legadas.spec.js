import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test('rotas legadas autenticadas apontam para os fluxos atuais', async ({ page }) => {
  let response = await page.request.get('/src/backend/editor/roteiro.php', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Editor de Roteiros');

  response = await page.request.get('/src/backend/users/editoruser.php', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('/users.php');

  response = await page.request.get('/src/backend/topnav.php', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('.topnav');
});

test('topnav legado exige autenticação', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const response = await context.request.get('/src/backend/topnav.php', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('login.php');
  await context.close();
});
