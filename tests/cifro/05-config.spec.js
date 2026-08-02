/**
 * 05-config.spec.js
 * Tela de configurações.
 */
import { test, expect } from '../fixtures/coverage.js';

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
    await expect(page.locator('#cfgTheme')).toHaveValue(/^(dark|light|auto)$/);
  });

  test('select de tamanho de fonte está presente', async ({ page }) => {
    await expect(page.locator('#cfgCifraSize')).toBeVisible();
    await expect(page.locator('#cfgCifraSize')).toHaveValue(/^(14|16|18|20|22)$/);
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
    await page.locator('.config-advanced__summary').click();
    const resetBtn = page.locator('button:has-text("Resetar")');
    await expect(resetBtn).toBeVisible();
  });

  test('informa quando a configuração não é salva na conta', async ({ page }) => {
    await page.route('/src/backend/users/salvar_config.php', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ sucesso: false }),
    }));

    await page.locator('#cfgScrollSpeed').selectOption('fast');
    await expect(page.getByText('Alteração aplicada neste dispositivo, mas não foi salva na conta.')).toBeVisible();
  });

  test('link de logout está presente', async ({ page }) => {
    await expect(page.locator('a[href="/logout.php"]')).toBeVisible();
  });

  test('plano pago mostra gestão de pagamento nas configurações', async ({ page }) => {
    const response = await page.request.get('/api/sync/data.php');
    const { plano } = await response.json();
    const section = page.locator('#sec-pagamento');
    if (['mensal', 'semestral', 'anual', 'ativo'].includes(plano)) {
      await expect(section).toBeVisible();
      await expect(page.locator('a[href="/plano.php#planos"]')).toContainText('Gerenciar');
    } else {
      await expect(section).toHaveCount(0);
    }
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
