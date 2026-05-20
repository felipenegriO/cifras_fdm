/**
 * 03-music-view.spec.js
 * Tela de visualização de cifra (music.php).
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Visualização de Cifra', () => {
  test('carrega music.php sem ID com redirect ou erro tratado', async ({ page }) => {
    const res = await page.goto('/music.php');
    // Pode redirecionar ou mostrar empty state — não deve mostrar Fatal error
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('carrega cifra com ID válido', async ({ page }) => {
    // Tenta ID 1 — se não existir, deve mostrar empty state, não crash
    // Usa domcontentloaded para evitar timeout com CDN scripts (WaveSurfer, SoundTouch)
    await page.goto('/music.php?id=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page.locator('body')).not.toContainText('Undefined');
    // Ou tem conteúdo de cifra, ou tem mensagem de não encontrado
    const hasCifra = await page.locator('.cifra, .chord, [data-song]').count();
    const hasEmpty = await page.locator('.empty-state, .not-found').count();
    expect(hasCifra + hasEmpty).toBeGreaterThan(0);
  });

  test('link de voltar aparece na tela de cifra', async ({ page }) => {
    await page.goto('/music.php?id=1', { waitUntil: 'domcontentloaded' });
    // music.php tem #backLink (voltar) em vez de topnav completo
    await expect(page.locator('#backLink')).toBeVisible();
  });

  test('tom.php carrega sem erro', async ({ page }) => {
    await page.goto('/tom.php');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });
});

test.describe('Controles de Cifra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/music.php?id=1', { waitUntil: 'domcontentloaded' });
  });

  test('page não tem erros PHP', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:|Parse error/i);
  });
});
