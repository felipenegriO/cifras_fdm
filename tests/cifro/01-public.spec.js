/**
 * 01-public.spec.js
 * Telas públicas — sem autenticação necessária.
 * login, register, esqueci-senha.
 *
 * IMPORTANTE: Todos os testes deste arquivo usam contextos sem autenticação
 * para não interferir na sessão compartilhada dos demais specs.
 */
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

// Sobrescreve o storageState do projeto: todos os testes aqui são sem auth
// (evita session_regenerate_id() do login invalidar a sessão dos outros specs)
test.use({ storageState: { cookies: [], origins: [] } });

// ── LOGIN ─────────────────────────────────────────────────────────────────────
test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.php');
  });

  test('exibe formulário de login', async ({ page }) => {
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#senha')).toBeVisible();
  });

  test('exibe link "Esqueci minha senha"', async ({ page }) => {
    await expect(page.locator('a[href="/esqueci-senha.php"]')).toBeVisible();
  });

  test('exibe link "Criar conta"', async ({ page }) => {
    await expect(page.locator('a[href="/register.php"]')).toBeVisible();
  });

  test('mostra erro com credenciais inválidas', async ({ page }) => {
    await page.fill('#email', 'usuario.invalido@e2e.local');
    await page.fill('#senha', 'senha_errada_xyz');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('login.php');
    await expect(page.locator('.alert-danger, .error, [role="alert"]').first()).toBeVisible();
  });

  test('valida campo usuário vazio no cliente', async ({ page }) => {
    await page.fill('#senha', 'qualquercoisa');
    await page.click('button[type="submit"]');
    expect(page.url()).toContain('login.php');
  });

  test('toggle de visibilidade da senha funciona', async ({ page }) => {
    await page.fill('#senha', 'minhasenha');
    const toggleBtn = page.locator('#toggleSenha');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('#senha')).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(page.locator('#senha')).toHaveAttribute('type', 'password');
  });

  test('login válido redireciona para dentro do app', async ({ page }) => {
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#senha', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
    expect(page.url()).not.toContain('login.php');
    // Nota: este contexto tem storageState vazio; o login cria uma sessão nova
    // que é isolada e NÃO afeta a sessão compartilhada em user.json
  });

});

// ── REGISTER ──────────────────────────────────────────────────────────────────
test.describe('Cadastro Público', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register.php');
  });

  test('exibe formulário de cadastro', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('#nome')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#banda_nome')).toBeVisible();
  });

  test('exibe botão de submissão', async ({ page }) => {
    await expect(page.locator('.btn-submit')).toBeVisible();
  });

  test('exibe link de login', async ({ page }) => {
    await expect(page.locator('a[href="/login.php"]')).toBeVisible();
  });

  test('campos têm CSRF token oculto', async ({ page }) => {
    await expect(page.locator('input[name="csrf_token"]')).toHaveCount(1);
  });

  test('rejeita formulário vazio', async ({ page }) => {
    await page.click('.btn-submit');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('register.php');
    const successBox = page.locator('.success-box');
    await expect(successBox).not.toBeVisible();
  });

  test('rejeita e-mail inválido', async ({ page }) => {
    await page.fill('#nome', 'Teste User');
    await page.fill('#email', 'nao-e-um-email');
    await page.fill('#banda_nome', 'Banda Teste');
    await page.check('#legal_acceptance');
    await page.click('.btn-submit');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('register.php');
    await expect(page.locator('.success-box')).not.toBeVisible();
  });
});

// ── ESQUECI SENHA ─────────────────────────────────────────────────────────────
test.describe('Esqueci Senha', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/esqueci-senha.php');
  });

  test('exibe formulário de recuperação', async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('exibe link de voltar ao login', async ({ page }) => {
    await expect(page.locator('a[href="/login.php"]')).toBeVisible();
  });

  test('tem CSRF token', async ({ page }) => {
    await expect(page.locator('input[name="csrf_token"]')).toHaveCount(1);
  });

  test('submissão com e-mail qualquer sempre mostra sucesso', async ({ page }) => {
    await page.fill('input[name="email"]', 'naoexiste@naoexiste.com');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    // Anti-enumeração: sempre mostra success
    await expect(page.locator('.success-box')).toBeVisible();
  });
});
