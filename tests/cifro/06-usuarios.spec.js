/**
 * 06-usuarios.spec.js
 * Gestão de usuários por banda (users.php / editoruser).
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/users/salvar_user.php';

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Tela de Usuários', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users.php');
    await page.waitForLoadState('networkidle');
  });

  test('carrega sem erros PHP', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('exibe lista de usuários', async ({ page }) => {
    await expect(page.locator('#listaUsuarios')).toBeVisible({ timeout: 8000 });
  });

  test('botão "Novo Usuário" está presente', async ({ page }) => {
    await expect(page.locator('button:has-text("Novo"), button[onclick*="abrirModalNovo"]')).toBeVisible();
  });

  test('campo de filtro está presente', async ({ page }) => {
    await expect(page.locator('#filtroUsuarios')).toBeVisible();
  });

  test('botão "Importar Usuário" está presente', async ({ page }) => {
    // Botão principal de abrir modal de importar (não o de confirmar dentro do modal)
    await expect(page.locator('button[onclick*="abrirModalImportar"]').first()).toBeVisible();
  });

  test('abre modal de novo usuário', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNovo"]');
    await expect(page.locator('#modalOverlay.open, #modalOverlay[class*="open"]')).toBeVisible();
    await expect(page.locator('#modalTitle')).toContainText('Novo');
    await expect(page.locator('#nome')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('fecha modal ao clicar em Cancelar', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNovo"]');
    await page.click('button:has-text("Cancelar")');
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/open/);
  });

  test('campo bandaPerfil tem opções corretas', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNovo"]');
    const options = await page.locator('#bandaPerfil option').allTextContents();
    expect(options).toContain('Administrador');
    expect(options).toContain('Gestor');
    expect(options).toContain('Básico');
  });
});

test.describe('API de Usuários', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista usuários da banda', async ({ page }) => {
    const res = await page.request.get(API);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: 'Hacker', email: 'hacker@e2e.local' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST cria usuário mínimo e remove', async ({ page }) => {
    const email = `auto.${Date.now()}@e2e.local`;
    const res = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: 'Usuário Auto Teste',
        email,
        ativo: true,
        bandaPerfil: 'basico',
        validade: '',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso).toBeTruthy();

    // Cleanup
    if (body.id) {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', userId: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST exige e-mail', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: 'Teste',
        email: '',
        ativo: true,
        bandaPerfil: 'basico',
        validade: '',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBeFalsy();
  });

  test('POST rejeita e-mail inválido', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: 'Teste',
        email: 'nao-email',
        ativo: true,
        bandaPerfil: 'basico',
        validade: '',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBeFalsy();
    expect(body.mensagem).toMatch(/e-mail|email/i);
  });

  test('resend_invite retorna erro para usuário sem e-mail', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'resend_invite', userId: '00000000000000000000000000000000' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBeFalsy();
  });

  test('ações auxiliares validam busca, importação, remoção e validade', async ({ page }) => {
    const shortSearch = await page.request.post(API, {
      data: JSON.stringify({ action: 'search', q: 'a' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(await shortSearch.json()).toEqual([]);

    const invalidImport = await page.request.post(API, {
      data: JSON.stringify({ action: 'import', userId: '', perfil: 'superadmin' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidImport.json()).sucesso).toBeFalsy();

    const invalidDelete = await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', userId: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidDelete.json()).sucesso).toBeFalsy();

    const current = await (await page.request.get(API)).json();
    const selfUser = current.find(user => /felipe@legacy\.invalid/i.test(user.email || '')) || current[0];
    if (selfUser?.id) {
      const selfDelete = await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', userId: selfUser.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect((await selfDelete.json()).sucesso).toBeFalsy();
    }

    const invalidDate = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: 'Data Inválida',
        email: `data.invalida.${Date.now()}@e2e.local`,
        ativo: true,
        bandaPerfil: 'basico',
        validade: '2026-99-99',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidDate.json()).sucesso).toBeFalsy();
  });
});
