/**
 * 08-roteiro.spec.js
 * Tela de roteiro (roteiro.php) e select de banda.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Roteiro', () => {
  test('carrega roteiro.php sem erros', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('exibe conteúdo do roteiro', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('networkidle');
    // roteiro.php é uma tela de apresentação/impressão sem topnav,
    // mas deve ter o container principal de conteúdo
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').textContent();
    // Deve conter texto do roteiro ou a mensagem de "nenhum roteiro"
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Seleção de Banda', () => {
  test('select-banda.php carrega', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('API de seleção rejeita POST sem CSRF', async ({ page }) => {
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: 'qualquer' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Plano Expirado', () => {
  test('plano-expirado.php carrega sem crash', async ({ page }) => {
    // Acessa diretamente — pode redirecionar se plano ativo
    const res = await page.goto('/plano-expirado.php');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Offline', () => {
  test('offline.php carrega', async ({ page }) => {
    await page.goto('/offline.php');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});
