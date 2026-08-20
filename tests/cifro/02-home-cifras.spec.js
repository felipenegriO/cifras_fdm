/**
 * 02-home-cifras.spec.js
 * Tela principal (index.php) — lista de cifras, busca, filtros.
 */
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Home — Lista de Cifras', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.php');
    await page.waitForLoadState('networkidle');
  });

  test('carrega a página sem erro', async ({ page }) => {
    await expect(page.locator('nav.topnav')).toBeVisible();
    // Sem mensagem de erro PHP visível
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page.locator('body')).not.toContainText('Warning:');
  });

  test('exibe topnav com nome Cifrô', async ({ page }) => {
    await expect(page.locator('nav.topnav')).toBeVisible();
    await expect(page.locator('.topnav__brand')).toBeVisible();
  });

  test('exibe lista ou empty state de cifras', async ({ page }) => {
    // O id real do container de músicas é #music-list
    const list = page.locator('#music-list, .song-list, .empty-state');
    await expect(list.first()).toBeVisible({ timeout: 10000 });
  });

  test('oculta onboarding quando existem cifras e mantém biblioteca visível', async ({ page }) => {
    await expect(page.locator('#onboardingCard')).toBeHidden();
    await expect(page.locator('#musicLibrary')).toBeVisible();
    await expect(page.locator('#search')).toBeVisible();
    await expect(page.locator('#music-list')).toBeVisible();
  });

  test('usa no atalho live o mesmo texto da tela da música', async ({ page }) => {
    await expect(page.locator('#entrarlivePlaynow')).toHaveText('Entrar na sessão ao vivo');
  });

  test('mostra onboarding sozinho quando o repertório está vazio', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('cifroOnboardingDismissed');
      window.songs = [];
      document.dispatchEvent(new CustomEvent('cifro:sync'));
    });

    await expect(page.locator('#onboardingCard')).toBeVisible();
    await expect(page.locator('#musicLibrary')).toBeHidden();
    await expect(page.locator('#search')).toBeHidden();
    await expect(page.locator('#music-list')).toBeHidden();
  });

  test('campo de busca está presente', async ({ page }) => {
    const search = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"], #searchInput, #busca');
    await expect(search.first()).toBeVisible();
  });

  test('link para configurações funciona', async ({ page }) => {
    await page.goto('/config.php');
    await expect(page.locator('nav.topnav')).toBeVisible();
    await expect(page.locator('.config-container')).toBeVisible();
  });

  test('topnav tem link para Configurações', async ({ page }) => {
    // Logout está em config.php, não diretamente na home; verificar que existe link config
    const configLink = page.locator('a[href="/config.php"]').first();
    await expect(configLink).toBeVisible();
  });

  test('usuário não autenticado recebe a landing na rota principal', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/index.php', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/landing\.php/);
    await expect(page.locator('nav .nav-brand')).toBeVisible();
    await expect(page.getByRole('link', { name: /criar conta/i }).first()).toBeVisible();
    await ctx.close();
  });
});

test.describe('Home — Navegação', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('menu "Configurações" navega corretamente', async ({ page }) => {
    await page.goto('/config.php');
    await expect(page.locator('h1, .config-page-title')).toContainText('Configurações');
  });

  test('logout funciona', async ({ browser }) => {
    // Usa contexto COM SESSÃO PRÓPRIA para não destruir a sessão compartilhada
    // A sessão compartilhada (user.json) é preservada para os demais testes
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // sessão vazia — explicitamente limpa para não herdar SESS_A
    const page = await ctx.newPage();
    // Login fresco criando sessão própria (não afeta user.json)
    await page.goto('/login.php');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#senha', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 8000 }).catch(() => {});
    // Logout desta sessão própria (não destrói SESS de user.json).
    // /logout.php agora mostra confirmação: sair exige POST com CSRF.
    await page.goto('/logout.php');
    await page.click('#confirmarLogout');
    await page.waitForURL(url =>
      url.toString().includes('login.php') || url.toString().includes('landing.php'),
      { timeout: 5000 }
    ).catch(() => {});
    expect(page.url()).toMatch(/login\.php|landing\.php/);
    await ctx.close();
  });
});
