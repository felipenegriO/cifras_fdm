/**
 * 70-sessao-expirada-banner.spec.js
 * Com a sessão inválida e cifras já salvas, o app não expulsa o músico:
 * mantém o conteúdo e avisa que precisa entrar de novo.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

test.use({ storageState: 'tests/.auth/user.json' });

// tests/.auth/user.json é compartilhado entre todos os specs; a fixture
// automática `isolatedSession` (tests/fixtures/coverage.js) chama
// session_regenerate_id() a cada teste, o que pode invalidar o cookie salvo
// para quem rodar depois na suíte completa. fazerLogin() é um no-op se a
// sessão ainda for válida e reloga se não for.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

test('status.php responde autenticado para quem tem sessão', async ({ page }) => {
  const res = await page.request.get('/api/auth/status.php');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, autenticado: true });
});

test('status.php responde não autenticado para visitante, sem redirecionar', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await ctx.request.get('/api/auth/status.php');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, autenticado: false });
  await ctx.close();
});

test('sessão expirada mostra aviso sem tirar as cifras da tela', async ({ page }) => {
  await page.route('**/api/auth/status.php', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, autenticado: false }) }));
  await page.goto('/index.php');
  await expect(page.locator('#music-list')).toBeVisible();

  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());

  const banner = page.locator('#_sessaoExpiradaBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Sessão expirada');
  // o conteúdo continua na tela
  await expect(page.locator('#music-list')).toBeVisible();
});

test('sessão válida não mostra aviso nenhum', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());
  await expect(page.locator('#_sessaoExpiradaBanner')).toHaveCount(0);
});

test('sem rede o aviso não aparece — isso é offline normal, não sessão expirada', async ({ page }) => {
  await page.goto('/index.php');
  await page.route('**/api/auth/status.php', route => route.abort());
  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());
  await expect(page.locator('#_sessaoExpiradaBanner')).toHaveCount(0);
});

test('sessão recuperada limpa o aviso e volta a sincronizar', async ({ page }) => {
  // O estado precisa ser reversível: o músico pode ter entrado de novo em
  // outra aba, ou a sessão pode ter voltado pelo token "lembrar-me". Travar em
  // "inválida" mataria a sincronização até um reload manual.
  // A rota entra ANTES da navegação: a verificação que a própria página dispara
  // no load é assíncrona e, se respondesse "autenticado" depois, apagaria o
  // aviso — o teste mediria a corrida em vez do comportamento.
  await page.route('**/api/auth/status.php', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, autenticado: false }) }));
  await page.goto('/index.php');

  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());
  await expect(page.locator('#_sessaoExpiradaBanner')).toBeVisible();
  expect(await page.evaluate(() => window.cifroSync.sync(window.CIFRO_BAND_ID, { force: true }))).toBe(false);

  // Agora a sessão voltou.
  await page.unroute('**/api/auth/status.php');
  await page.route('**/api/auth/status.php', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, autenticado: true }) }));
  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());

  await expect(page.locator('#_sessaoExpiradaBanner')).toHaveCount(0);
  expect(await page.evaluate(() => window.cifroSync.sync(window.CIFRO_BAND_ID, { force: true }))).toBe(true);
});
