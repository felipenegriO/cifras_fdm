/**
 * 05-config.spec.js
 * Tela de configurações.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config.php');
    await page.waitForLoadState('networkidle');
  });

  test('carrega sem erros PHP', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page.locator('body')).not.toContainText('Warning:');
  });

  test('exibe título "Configurações"', async ({ page }) => {
    await expect(page.locator('.config-page-title, h1')).toContainText('Configurações');
  });

  test('select de tema está presente', async ({ page }) => {
    await expect(page.locator('#cfgTheme')).toBeVisible();
  });

  test('select de tamanho de fonte está presente', async ({ page }) => {
    await expect(page.locator('#cfgCifraSize')).toBeVisible();
  });

  test('select de fonte tem rótulos amigáveis (não valores px)', async ({ page }) => {
    const options = await page.locator('#cfgCifraSize option').allTextContents();
    expect(options).toContain('Padrão');
    expect(options.some(o => o === 'Pequeno' || o === 'Médio' || o === 'Grande')).toBe(true);
    // Não deve ter "px" nos textos visíveis
    expect(options.every(o => !o.includes('px'))).toBe(true);
  });

  test('botão "Sincronizar" está presente', async ({ page }) => {
    await expect(page.locator('#btnSyncDados')).toBeVisible();
  });

  test('botão "Resetar" está presente', async ({ page }) => {
    const resetBtn = page.locator('button:has-text("Resetar")');
    await expect(resetBtn).toBeVisible();
  });

  test('link de logout está presente', async ({ page }) => {
    await expect(page.locator('a[href="/logout.php"]')).toBeVisible();
  });

  test('select de velocidade de rolagem está presente', async ({ page }) => {
    await expect(page.locator('#cfgScrollSpeed')).toBeVisible();
  });

  test('botão "Sincronizar" dispara e retorna toast (sem erro)', async ({ page }) => {
    // Mock: intercepta a chamada de sync para não depender do servidor real
    await page.route('/api/sync/data.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 1, musicas: [], playlists: [], roteiros: [] }),
    }));
    await page.route('/api/sync/version.php*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 1 }),
    }));

    await page.click('#btnSyncDados');
    // Toast de sucesso ou loading — não deve mostrar erro
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).not.toContainText('Erro ao sincronizar');
  });
});
