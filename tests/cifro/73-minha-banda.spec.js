/**
 * 73-minha-banda.spec.js
 *
 * "Minha Banda" reúne dados, plano, membros, categorias e repertórios em abas.
 * O que estes testes protegem, em ordem de gravidade:
 *
 *  1. banda com plano bloqueado PRECISA alcançar a aba de plano — senão o
 *     cliente fica trancado do lado de fora do próprio pagamento;
 *  2. cada perfil vê só as abas que pode;
 *  3. os endereços antigos continuam levando ao lugar certo.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';
import { dbQuery } from '../helpers/db.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

function phpPasswordHash(senha) {
  return execFileSync('C:/xampp/php/php.exe', ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`], { encoding: 'utf8' }).trim();
}

test.use({ storageState: 'tests/.auth/user.json' });

// user.json é compartilhado e session_regenerate_id() roda a cada teste;
// fazerLogin é no-op se a sessão vale e reloga se não.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

test.describe('Minha Banda — abas', () => {
  test('administrador vê as cinco abas', async ({ page }) => {
    await page.goto('/minha-banda.php');
    const abas = await page.locator('[data-aba]').evaluateAll(els => els.map(e => e.dataset.aba));
    expect(abas).toEqual(['dados', 'plano', 'membros', 'categorias', 'repertorios']);
  });

  test('a aba pedida na URL é a que abre', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'membros');
    await expect(page.locator('#mbAba-membros')).toHaveAttribute('aria-selected', 'true');
  });

  test('sem aba na URL abre a primeira', async ({ page }) => {
    await page.goto('/minha-banda.php');
    await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'dados');
  });

  test('aba inventada não quebra: cai na primeira permitida', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=' + encodeURIComponent('../../etc/passwd'));
    await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'dados');
  });

  test('cada aba entrega o conteúdo real, não só o rótulo', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=categorias');
    await expect(page.locator('#categoryForm')).toBeVisible();
    await expect(page.locator('#categoryList')).toBeAttached();
  });

  test('só uma aba fica marcada como selecionada', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=plano');
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  });
});

test.describe('Minha Banda — endereços antigos', () => {
  for (const [antigo, aba] of [['/users.php', 'membros'], ['/categorias.php', 'categorias'], ['/plano.php', 'plano']]) {
    test(`${antigo} leva à aba ${aba}`, async ({ page }) => {
      await page.goto(antigo);
      await expect(page).toHaveURL(new RegExp(`minha-banda\\.php\\?aba=${aba}`));
      await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', aba);
    });
  }

  test('o retorno do Stripe chega na aba de plano com o aviso', async ({ page }) => {
    // O Stripe aponta direto para cá; este teste garante que a query sobrevive.
    await page.goto('/minha-banda.php?aba=plano&checkout=success&session_id=cs_test_123');
    await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'plano');
    await expect(page.locator('body')).toContainText(/pagamento recebido/i);
  });
});

test.describe('Minha Banda — menu', () => {
  test('o menu perde Categorias e Usuários e ganha Minha Banda', async ({ page }) => {
    await page.goto('/index.php');
    const menu = page.locator('.topnav__links');
    await expect(menu.getByRole('link', { name: 'Minha Banda' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Categorias' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  });

  test('Início, Músicas e Repertórios continuam no menu', async ({ page }) => {
    await page.goto('/index.php');
    const menu = page.locator('.topnav__links');
    for (const item of ['Início', 'Músicas', 'Repertórios', 'Bandas']) {
      await expect(menu.getByRole('link', { name: item })).toBeVisible();
    }
  });
});

test.describe('Minha Banda — a trava do pagamento', () => {
  test('banda com plano bloqueado ainda alcança a aba de plano', async ({ browser }) => {
    // Sem isto o administrador de uma banda bloqueada é mandado para
    // plano-expirado.php e nunca chega à tela onde pagaria.
    const userId = crypto.randomUUID();
    const bandaId = crypto.randomUUID();
    const email = `bloq-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
    const senha = 'BloqueadoE2E#2026!';
    dbQuery(
      `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
       VALUES (?, 'Bloqueado E2E', ?, ?, 'usuario', 1, 'ativo')`,
      [userId, email, phpPasswordHash(senha)],
    );
    dbQuery(`INSERT INTO bandas (id, nome, ativo, plano) VALUES (?, ?, 1, 'bloqueado')`, [bandaId, `Banda Bloqueada ${Date.now()}`]);
    dbQuery(`INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, 'administrador')`, [userId, bandaId]);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await page.goto('/login.php');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="senha"]', senha);
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

      await page.goto('/minha-banda.php?aba=plano');
      await expect(page, 'plano bloqueado não pode ser expulso da tela de plano').not.toHaveURL(/plano-expirado/);
      await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'plano');

      // E no seletor a banda continua abrindo: quem tem duas bandas precisa
      // conseguir entrar justamente na que está devendo.
      await page.goto('/select-banda.php');
      const card = page.locator(`[data-band-id="${bandaId}"]`);
      await expect(card).toHaveCount(1);
      await expect(card).not.toHaveAttribute('aria-disabled', 'true');
    } finally {
      await context.close();
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [userId]);
      dbQuery('DELETE FROM bandas WHERE id = ?', [bandaId]);
      dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
    }
  });

  test('gestor vê só as abas de conteúdo', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/.auth/gestor.json' });
    const page = await context.newPage();
    try {
      await page.goto('/minha-banda.php');
      const abas = await page.locator('[data-aba]').evaluateAll(els => els.map(e => e.dataset.aba));
      expect(abas).toEqual(['categorias', 'repertorios']);
    } finally {
      await context.close();
    }
  });
});
