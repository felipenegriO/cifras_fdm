/**
 * 58-privacidade-conta.spec.js
 *
 * A landing e a Política de Privacidade prometem: "em Configurações você
 * exporta todos os seus dados" e "você exclui sua conta quando quiser".
 * Estes testes existem para provar que os dois botões (config.php:308-309)
 * realmente cumprem isso, ponta a ponta, com um usuário descartável — nunca
 * com o admin compartilhado da suíte.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** Cria uma conta e uma banda isoladas, prontas para login — sem passar pelo fluxo de e-mail. */
function criarUsuarioDescartavel() {
  const userId = crypto.randomUUID();
  const bandId = crypto.randomUUID();
  const email = `descartavel-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
  const senha = 'DescartavelE2E#2026!';

  dbQuery(
    `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
     VALUES (?, 'Descartável E2E', ?, ?, 'usuario', 1, 'ativo')`,
    [userId, email, phpPasswordHash(senha)],
  );
  dbQuery(`INSERT INTO bandas (id, nome, ativo, plano) VALUES (?, 'Banda Descartável', 1, 'gratuito')`, [bandId]);
  dbQuery(`INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, 'administrador')`, [userId, bandId]);

  return { userId, bandId, email, senha };
}

function phpPasswordHash(senha) {
  // Mesmo password_hash() do app, para o hash bater com o que AuthController
  // espera no login.
  return execFileSync(
    'C:/xampp/php/php.exe',
    ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`],
    { encoding: 'utf8' },
  ).trim();
}

async function loginComo(page, email, senha) {
  await page.goto('/login.php', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
}

function usuarioExiste(userId) {
  return dbQuery('SELECT id FROM usuarios WHERE id=?', [userId]).rows.length > 0;
}

// ── Exportar dados ──────────────────────────────────────────────────────────
test.describe('Configurações — exportar meus dados', () => {
  test('o botão "Exportar meus dados" existe e devolve os dados reais da conta', async ({ browser }) => {
    const { userId, bandId, email, senha } = criarUsuarioDescartavel();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await loginComo(page, email, senha);
      await page.goto('/config.php');

      const link = page.locator('a[href="/api/account/export.php"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText(/exportar meus dados/i);

      const res = await page.request.get('/api/account/export.php');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-disposition']).toContain('attachment');

      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.account.email).toBe(email);
      expect(body.data.band_memberships.some(b => b.id === bandId)).toBe(true);
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id=?', [userId]);
      dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
      dbQuery('DELETE FROM usuarios WHERE id=?', [userId]);
    }
  });

  test('visitante não autenticado não exporta dados de ninguém', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await ctx.request.get('/api/account/export.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });
});

// ── Excluir conta ────────────────────────────────────────────────────────────
test.describe('Configurações — excluir conta', () => {
  test('excluir a conta apaga o usuário de verdade e a sessão morre', async ({ browser }) => {
    const { userId, bandId, email, senha } = criarUsuarioDescartavel();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await loginComo(page, email, senha);
      await page.goto('/config.php');
      await expect(page.locator('#deleteAccountButton')).toBeVisible();

      const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.content || '');
      const res = await page.request.post('/api/account/delete.php', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ email }),
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).ok).toBe(true);

      // A promessa é literal: a conta é apagada, não só desativada.
      expect(usuarioExiste(userId)).toBe(false);

      // E a sessão morreu: uma página autenticada agora manda para o login.
      await page.goto('/index.php');
      await expect(page).toHaveURL(/login\.php|landing\.php/);
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id=?', [userId]);
      dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
      dbQuery('DELETE FROM usuarios WHERE id=?', [userId]);
    }
  });

  test('excluir sem confirmar o e-mail correto é recusado e nada é apagado', async ({ browser }) => {
    const { userId, bandId, email, senha } = criarUsuarioDescartavel();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await loginComo(page, email, senha);
      await page.goto('/config.php');
      const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.content || '');

      const res = await page.request.post('/api/account/delete.php', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ email: 'email-errado@e2e.local' }),
      });
      expect(res.status()).toBe(422);
      expect(usuarioExiste(userId)).toBe(true);
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id=?', [userId]);
      dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
      dbQuery('DELETE FROM usuarios WHERE id=?', [userId]);
    }
  });

  test('visitante não autenticado não exclui conta de ninguém', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await ctx.request.post('/api/account/delete.php');
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('excluir o único membro de uma banda remove a banda órfã junto', async ({ browser }) => {
    const { userId, bandId, email, senha } = criarUsuarioDescartavel();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await loginComo(page, email, senha);
      await page.goto('/config.php');
      const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.content || '');
      await page.request.post('/api/account/delete.php', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ email }),
      });

      // A banda cujo único membro era este usuário some junto — não fica
      // órfã acumulando lixo no banco indefinidamente.
      expect(dbQuery('SELECT id FROM bandas WHERE id=?', [bandId]).rows.length).toBe(0);
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id=?', [userId]);
      dbQuery('DELETE FROM bandas WHERE id=?', [bandId]);
      dbQuery('DELETE FROM usuarios WHERE id=?', [userId]);
    }
  });
});
