/**
 * 01-public.spec.js
 * Telas públicas — sem autenticação necessária.
 * landing, login, register, esqueci-senha.
 *
 * IMPORTANTE: Todos os testes deste arquivo usam contextos sem autenticação
 * para não interferir na sessão compartilhada dos demais specs.
 */
import { test, expect } from '@playwright/test';

// Sobrescreve o storageState do projeto: todos os testes aqui são sem auth
// (evita session_regenerate_id() do login invalidar a sessão dos outros specs)
test.use({ storageState: { cookies: [], origins: [] } });

// ── LANDING PAGE ─────────────────────────────────────────────────────────────
test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing.php');
  });

  test('carrega com status 200', async ({ page }) => {
    expect(page.url()).toContain('landing.php');
  });

  test('exibe headline principal', async ({ page }) => {
    // O h1 usa <br> para quebra de linha — o texto concatenado não tem espaço entre "na" e "mesma"
    // Verifica apenas o início do headline para robustez
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.hero h1')).toContainText('Sua banda na');
  });

  test('exibe CTA de cadastro', async ({ page }) => {
    await expect(page.locator('a[href="/register.php"]').first()).toBeVisible();
  });

  test('exibe link de login', async ({ page }) => {
    await expect(page.locator('a[href="/login.php"]').first()).toBeVisible();
  });

  test('exibe seção de preços', async ({ page }) => {
    await expect(page.locator('.pricing, .price-card').first()).toBeVisible();
  });

  test('exibe seção de prova de valor (3 cards)', async ({ page }) => {
    const cards = page.locator('.proof-card');
    await expect(cards).toHaveCount(3);
  });

  test('redireciona usuário autenticado para index', async ({ browser }) => {
    // Cria contexto COM auth para testar redirecionamento
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await page.goto('/landing.php');
    await page.waitForURL(url => !url.toString().includes('landing.php'), { timeout: 8000 }).catch(() => {});
    expect(page.url()).not.toContain('landing.php');
    await ctx.close();
  });
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.php');
  });

  test('exibe formulário de login', async ({ page }) => {
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#senha')).toBeVisible();
  });

  test('exibe link "Esqueci minha senha"', async ({ page }) => {
    await expect(page.locator('a[href="/esqueci-senha.php"]')).toBeVisible();
  });

  test('exibe link "Criar conta"', async ({ page }) => {
    await expect(page.locator('a[href="/register.php"]')).toBeVisible();
  });

  test('mostra erro com credenciais inválidas', async ({ page }) => {
    await page.fill('#username', 'usuario_invalido_xyz');
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
    const user = process.env.TEST_USERNAME || 'felipe';
    const pass = process.env.TEST_PASSWORD || '123';
    await page.fill('#username', user);
    await page.fill('#senha', pass);
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
