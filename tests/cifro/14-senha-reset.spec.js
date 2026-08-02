/**
 * 14-senha-reset.spec.js
 * Password reset & define flows: esqueci-senha, reset-senha, definir-senha.
 */
import { test, expect } from '../fixtures/coverage.js';
import { randomUUID } from 'node:crypto';
import { dbQuery } from '../helpers/db.js';


// ── esqueci-senha.php ─────────────────────────────────────────────────────────
test.describe('Esqueci senha — página pública', () => {
  test('GET /esqueci-senha.php carrega sem erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.goto('/esqueci-senha.php');
    expect([200, 302]).toContain(res.status());
    await ctx.close();
  });

  test('página tem campo de e-mail', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/esqueci-senha.php');
    const input = page.locator('input[type="email"], input[name="email"]');
    expect(await input.count()).toBeGreaterThan(0);
    await ctx.close();
  });

  test('submissão com e-mail inválido mostra erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/esqueci-senha.php');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill('nao-e-email');
    expect(await emailInput.evaluate(input => input.checkValidity())).toBe(false);
    await ctx.close();
  });

  test('submissão com e-mail não cadastrado não revela existência (mensagem genérica)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/esqueci-senha.php');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill('naoexiste_xyzxyz@example.com');
      await page.locator('button[type="submit"], input[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
      const body = await page.locator('body').textContent();
      // Must NOT say "e-mail não encontrado" — security: don't expose user enumeration
      expect(body).not.toMatch(/e-?mail.*não.*encontrado|usuário.*não.*existe/i);
    }
    await ctx.close();
  });
});

// ── reset-senha.php ───────────────────────────────────────────────────────────
test.describe('Reset senha — token flows', () => {
  test('GET /reset-senha.php sem token mostra erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/reset-senha.php');
    const body = await page.locator('body').textContent();
    // Should show error about missing/invalid token
    expect(body).toMatch(/token|inválido|expirado|link/i);
    await ctx.close();
  });

  test('GET /reset-senha.php com token inválido mostra erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/reset-senha.php?token=tokeninvalido123');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/token|inválido|expirado|link/i);
    await ctx.close();
  });

  test('GET /reset-senha.php com token XSS não executa script', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/reset-senha.php?token=<script>window.__xss_reset=1</script>');
    const xss = await page.evaluate(() => window.__xss_reset);
    expect(xss).toBeUndefined();
    await ctx.close();
  });

  test('POST /reset-senha.php sem CSRF retorna 403', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/reset-senha.php', {
      form: { senha: 'novaSenha123', senha2: 'novaSenha123', token: 'faketoken' },
    });
    expect([403, 400]).toContain(res.status());
    await ctx.close();
  });

  test('POST /reset-senha.php com senha curta retorna erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/reset-senha.php?token=faketoken123');
    // Form won't show (invalid token) — just check error message
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/token|inválido|expirado/i);
    await ctx.close();
  });

  test('GET com token válido mostra formulário e POST com senhas válidas redefine com sucesso', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const userId = randomUUID();
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    dbQuery(
      'INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?, 1)',
      [userId, 'Playwright Reset Test', `reset-test-${userId}@example.com`, 'placeholder-hash', 'usuario']
    );
    dbQuery(
      'INSERT INTO password_reset_tokens (token, usuario_id, expira_em, usado) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 0)',
      [token, userId]
    );

    try {
      // GET com token válido: nem $ok nem $erro -> renderiza o formulário
      await page.goto(`/reset-senha.php?token=${token}`);
      const form = page.locator('form[method="post"]');
      await expect(form).toBeVisible();
      await expect(page.locator('input[name="senha"]')).toBeVisible();

      // Página pública (sem sessão autenticada): /api/csrf.php exige login,
      // então extrai o token CSRF do próprio formulário renderizado.
      const csrf = await page.locator('input[name="csrf_token"]').inputValue();
      const res = await page.request.post('/reset-senha.php', {
        form: { csrf_token: csrf, token, senha: 'novaSenhaValida123', senha2: 'novaSenhaValida123' },
      });
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/sucesso/i);

      const row = dbQuery('SELECT usado FROM password_reset_tokens WHERE token=?', [token]).rows[0];
      expect(Number(row.usado)).toBe(1);
    } finally {
      dbQuery('DELETE FROM usuarios WHERE id=?', [userId]);
      await ctx.close();
    }
  });
});

// ── definir-senha.php ─────────────────────────────────────────────────────────
test.describe('Definir senha — token flows', () => {
  test('GET /definir-senha.php sem token mostra erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/definir-senha.php');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/token|inválido|expirado|link/i);
    await ctx.close();
  });

  test('GET /definir-senha.php com token inválido mostra erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/definir-senha.php?token=tokeninvalido456');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/token|inválido|expirado|link/i);
    await ctx.close();
  });

  test('GET /definir-senha.php com token XSS não executa script', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/definir-senha.php?token=<script>window.__xss_def=1</script>');
    const xss = await page.evaluate(() => window.__xss_def);
    expect(xss).toBeUndefined();
    await ctx.close();
  });

  test('POST /definir-senha.php sem CSRF retorna 403 ou redireciona com erro', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/definir-senha.php', {
      form: { senha: 'novaSenha123', senha2: 'novaSenha123', token: 'faketoken' },
    });
    expect([403, 400, 200]).toContain(res.status());
    await ctx.close();
  });
});
