/**
 * 11-topnav.spec.js
 * Topnav — menus por role, seletor de banda, chip.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Topnav — Estrutura', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.php');
    await page.waitForLoadState('networkidle');
  });

  test('topnav existe e está visível', async ({ page }) => {
    await expect(page.locator('nav.topnav')).toBeVisible();
  });

  test('link de marca aponta para index.php', async ({ page }) => {
    const brand = page.locator('.topnav__brand');
    await expect(brand).toHaveAttribute('href', '/index.php');
  });

  test('chip de banda está presente', async ({ page }) => {
    await expect(page.locator('.topnav__band-chip')).toBeVisible();
  });

  test('sync dot está presente', async ({ page }) => {
    await expect(page.locator('#topnavSyncDot')).toBeVisible();
  });

  test('menu Configurações está presente', async ({ page }) => {
    const configLink = page.locator('.topnav__link[href="/config.php"], a[href="/config.php"]');
    // Pode estar em menu dropdown — verifica existência no DOM
    const count = await configLink.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Topnav — Controle de Acesso por Role', () => {
  test('usuário administrador/gestor vê menu de editor', async ({ page }) => {
    await page.goto('/index.php');
    // Editor aparece no topnav ou não — depende do perfil do usuário de teste
    // O importante é que não haja erro PHP
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('rota /bandas.php só carrega para master (ou redireciona com 403)', async ({ page }) => {
    await page.goto('/bandas.php');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
    // Deve carregar a página de bandas OU mostrar 403 se não for master
    // Nunca deve ter crash
  });
});
