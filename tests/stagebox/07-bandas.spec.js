/**
 * 07-bandas.spec.js
 * Gestão de bandas — master only (bandas.php / editorbandas).
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/bandas/salvar_banda.php';

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Tela de Bandas (master)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bandas.php');
    await page.waitForLoadState('networkidle');
  });

  test('carrega sem erros PHP', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('exibe lista de bandas', async ({ page }) => {
    await expect(page.locator('#listaBandas')).toBeVisible({ timeout: 8000 });
  });

  test('botão "Nova Banda" está presente', async ({ page }) => {
    await expect(page.locator('button[onclick*="abrirModalNova"]')).toBeVisible();
  });

  test('abre modal de nova banda', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    await expect(page.locator('#modalOverlay.open, #modalOverlay')).toBeVisible();
    await expect(page.locator('#bandaNome')).toBeVisible();
  });

  test('botões de plano estão presentes no modal', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    const planBtns = page.locator('.plan-btn');
    await expect(planBtns).toHaveCount(5); // trial, gratuito, basico, banda, bloqueado
  });

  test('botão "+30 dias" funciona no modal', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    const input = page.locator('#bandaTrial');
    const btnExtend = page.locator('#btnExtenderTrial');
    await expect(btnExtend).toBeVisible();
    await btnExtend.click();
    // Deve preencher a data com 30 dias a partir de hoje
    const val = await input.inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('fecha modal ao clicar Cancelar', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    await page.click('button:has-text("Cancelar")');
    await page.waitForTimeout(300);
    const overlay = page.locator('#modalOverlay');
    const cls = await overlay.getAttribute('class') || '';
    expect(cls).not.toContain('open');
  });
});

test.describe('API de Bandas', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista bandas', async ({ page }) => {
    const res = await page.request.get(API);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: 'Hacker' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST cria banda e deleta', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: '__BANDA_AUTO_TEST__',
        ativo: 1,
        plano: 'trial',
        trial_expira_em: null,
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso).toBeTruthy();

    // Cleanup
    if (body.id) {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST rejeita nome vazio', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: '', ativo: 1, plano: 'trial' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBeFalsy();
  });
});
