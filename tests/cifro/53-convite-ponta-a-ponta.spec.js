/**
 * 53-convite-ponta-a-ponta.spec.js
 * Fluxo completo de convite de novo membro:
 *   1. Admin abre a tela de usuários e adiciona um novo membro via formulário
 *   2. Sistema gera token de ativação (devolvido na resposta em APP_ENV=test)
 *   3. Novo membro acessa o link, define senha e acessa o app autenticado
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: 'tests/.auth/user.json' });

const RUN = Date.now();
const EMAIL = `convite.${RUN}@e2e.local`;
const NOME = `Convidado E2E ${RUN}`;
const SENHA = 'SenhaConvite#1Segura';

function limparConvidados() {
  dbQuery(
    `DELETE t FROM password_reset_tokens t
     JOIN usuarios u ON u.id = t.usuario_id WHERE u.email LIKE ?`,
    ['convite.%@e2e.local']
  );
  dbQuery(
    `DELETE ub FROM usuario_banda ub
     JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email LIKE ?`,
    ['convite.%@e2e.local']
  );
  dbQuery(`DELETE FROM usuarios WHERE email LIKE ?`, ['convite.%@e2e.local']);
}

test.beforeAll(() => limparConvidados());
test.afterAll(() => limparConvidados());

test('admin convida novo membro e membro ativa conta pelo link', async ({ browser }) => {
  // ── 1. Admin adiciona membro via formulário ─────────────────────────────────
  const adminCtx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
  const admin = await adminCtx.newPage();

  let activationToken = null;
  admin.on('response', async response => {
    if (response.url().includes('salvar_user.php') && response.request().method() === 'POST') {
      const body = await response.json().catch(() => null);
      if (body?.activation_token) activationToken = body.activation_token;
    }
  });

  await admin.goto('/src/backend/users/editoruser.php');
  // A lista de membros virou aba de Minha Banda: o h1 da página é "Minha Banda".
  await expect(admin.locator('.mb-aba-titulo')).toContainText('Usuários da banda');

  await admin.getByRole('button', { name: 'Novo Usuário' }).click();
  await expect(admin.locator('#modalOverlay')).toBeVisible();

  await admin.fill('#nome', NOME);
  await admin.fill('#email', EMAIL);
  await admin.getByRole('button', { name: 'Salvar usuário' }).click();

  await expect(admin.locator('.cifro-toast-message').first()).toBeVisible({ timeout: 10000 });
  await adminCtx.close();

  expect(activationToken, 'Token de ativação deve estar na resposta em APP_ENV=test').toBeTruthy();

  // ── 2. Token de ativação foi gerado no banco ─────────────────────────────────
  const { rows } = dbQuery(
    `SELECT t.usado, TIMESTAMPDIFF(HOUR, NOW(), t.expira_em) AS horas
     FROM password_reset_tokens t
     JOIN usuarios u ON u.id = t.usuario_id
     WHERE u.email = ?`,
    [EMAIL]
  );
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].usado)).toBe(0);
  expect(Number(rows[0].horas)).toBeGreaterThan(40);

  // ── 3. Novo membro abre o link e vê o formulário de senha ───────────────────
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();

  await member.goto(`/definir-senha.php?token=${activationToken}`);
  await expect(member.locator('#senha')).toBeVisible();
  await expect(member.getByRole('button', { name: /ativar minha conta/i })).toBeVisible();

  // ── 4. Senha fraca é rejeitada no próprio JS, sem perder o formulário ───────
  await member.fill('#senha', '123');
  await member.fill('#senha2', '123');
  await member.click('button[type="submit"]');
  await expect(member.locator('.error')).toContainText(/pelo menos 6 caracteres/i);
  await expect(member.locator('#senha')).toBeVisible();

  // ── 5. Novo membro corrige e define a senha válida ──────────────────────────
  await member.fill('#senha', SENHA);
  await member.fill('#senha2', SENHA);
  await member.click('button[type="submit"]');

  await member.waitForURL(/index\.php|select-banda\.php/, { timeout: 15000 });
  await expect(member).toHaveURL(/index\.php|select-banda\.php/);

  // Token foi consumido e deletado por revokeTokens() chamado em activate().
  // O redirect para index.php/select-banda.php acima já prova a ativação.

  await memberCtx.close();
});

test('link de convite expirado ou inválido mostra mensagem de erro', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/definir-senha.php?token=token-invalido-xyz');
  await expect(page.locator('.error')).toContainText(/inválido|expirado/i);
  await ctx.close();
});

test('admin reenvia convite para membro inativo e novo token é gerado', async ({ browser }) => {
  // Reusa o usuário criado e ativado no teste anterior, desativando-o via DB para simular
  // o cenário em que um membro nunca acessou o link de convite original.
  dbQuery(`UPDATE usuarios SET ativo=0 WHERE email = ?`, [EMAIL]);

  // Faz login direto para garantir sessão válida (a sessão do storageState pode estar
  // desatualizada devido ao session_regenerate_id do isolatedSession nos testes anteriores).
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto('/login.php');
  await admin.fill('#email', process.env.TEST_EMAIL);
  await admin.fill('#senha', process.env.TEST_PASSWORD);
  await admin.click('button[type="submit"]');
  await admin.waitForURL(/index\.php|select-banda\.php/, { timeout: 10000 });
  if (admin.url().includes('select-banda')) {
    await admin.locator('.sb-card').first().click();
    await admin.waitForURL(/index\.php/, { timeout: 8000 });
  }

  await admin.goto('/src/backend/users/editoruser.php');
  // A lista de membros virou aba de Minha Banda: o h1 da página é "Minha Banda".
  await expect(admin.locator('.mb-aba-titulo')).toContainText('Usuários da banda');
  // Filtra por inativos para exibir o usuário recém-desativado
  await admin.locator('#filtroStatusUsuarios').selectOption('inativos');
  await expect(admin.locator('.user-identity').filter({ hasText: EMAIL })).toBeVisible({ timeout: 5000 });

  const userRow = admin.locator('.user-row').filter({ hasText: EMAIL });
  await userRow.locator('[aria-label*="Reenviar convite"]').click();
  await expect(admin.locator('.cifro-toast-message').first()).toBeVisible({ timeout: 15000 });

  await adminCtx.close();

  // Verifica que um novo token foi gerado para o usuário
  const { rows } = dbQuery(
    `SELECT COUNT(*) AS cnt FROM password_reset_tokens t
     JOIN usuarios u ON u.id = t.usuario_id WHERE u.email = ?`,
    [EMAIL]
  );
  expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(1);
});
