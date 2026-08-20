/**
 * 69-login-persistente.spec.js
 * O músico fecha o navegador e volta depois: continua logado, sem digitar senha.
 */
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';
import { dbQuery } from '../helpers/db.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

/** Mesmo password_hash() do app, para o hash bater no login. */
function phpPasswordHash(senha) {
  return execFileSync('C:/xampp/php/php.exe', ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`], { encoding: 'utf8' }).trim();
}

async function logar(page) {
  await page.goto('/login.php');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="senha"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
}

/**
 * Navega forçando ida ao servidor. Sem o parâmetro único o navegador pode
 * servir /index.php do cache HTTP e o teste passaria sem exercitar o
 * bootstrap — falso positivo silencioso.
 */
async function abrirDoServidor(page, caminho) {
  const sep = caminho.includes('?') ? '&' : '?';
  await page.goto(`${caminho}${sep}_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
}

/** Remove só o cookie de sessão, preservando o "lembrar-me" — é o que fechar o navegador faz. */
async function simularFechamentoDoNavegador(context) {
  const cookies = await context.cookies();
  const lembrar = cookies.filter(c => c.name === 'cifro_lembrar');
  expect(lembrar, 'o login deveria ter emitido o cookie cifro_lembrar').toHaveLength(1);
  await context.clearCookies();
  await context.addCookies(lembrar);
}

test('login emite o cookie de lembrar-me', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await logar(page);
    const lembrar = (await context.cookies()).find(c => c.name === 'cifro_lembrar');
    expect(lembrar).toBeTruthy();
    expect(lembrar.httpOnly).toBe(true);
    // setcookie() url-encoda o valor, então o separador chega como %3A;
    // o PHP decodifica sozinho ao popular $_COOKIE.
    expect(decodeURIComponent(lembrar.value)).toContain(':');
  } finally {
    await context.close();
  }
});

test('fecha o navegador e volta depois: entra direto, sem digitar senha', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await logar(page);
    await simularFechamentoDoNavegador(context);

    await abrirDoServidor(page, '/index.php');
    await expect(page).not.toHaveURL(/login\.php|landing\.php/);
    await expect(page.locator('#loginForm')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('sair de verdade não deixa rastro para ressuscitar o login', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await logar(page);
    await abrirDoServidor(page, '/logout.php');
    await page.click('#confirmarLogout');

    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'cifro_lembrar' && c.value !== '')).toBeFalsy();

    await page.goto('/index.php');
    await expect(page).toHaveURL(/login\.php|landing\.php/);
  } finally {
    await context.close();
  }
});

test('sair de todos os aparelhos derruba a sessão lembrada dos outros', async ({ browser }) => {
  const celular = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const tablet  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const celularPage = await celular.newPage();
    const tabletPage  = await tablet.newPage();
    await logar(celularPage);
    await logar(tabletPage);

    // No tablet, o usuário manda desconectar tudo.
    const csrf = await tabletPage.evaluate(() => document.querySelector('meta[name=csrf-token]')?.content || '');
    const res = await tabletPage.request.post('/api/account/logout-all.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);

    // O celular perde a sessão e o token não o ressuscita.
    await simularFechamentoDoNavegador(celular);
    await abrirDoServidor(celularPage, '/index.php');
    await expect(celularPage).toHaveURL(/login\.php|landing\.php/);
  } finally {
    await celular.close();
    await tablet.close();
  }
});

test('conta desativada não entra pelo lembrar-me e perde o token', async ({ browser }) => {
  // Desativar um músico precisa tirar o acesso também de quem já está
  // "lembrado" no aparelho — senão o token vira um atalho que pula as
  // barreiras do login por senha.
  //
  // Usuário descartável de propósito: desativar o admin compartilhado da suíte
  // deixaria toda a bateria seguinte sem conta se este teste falhasse no meio.
  const userId = crypto.randomUUID();
  const email = `desativado-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
  const senha = 'DesativadoE2E#2026!';
  dbQuery(
    `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
     VALUES (?, 'Desativado E2E', ?, ?, 'usuario', 1, 'ativo')`,
    [userId, email, phpPasswordHash(senha)],
  );

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto('/login.php');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="senha"]', senha);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

    // Desativa ANTES de matar a sessão: com a página aberta, requisições de
    // fundo (sync/conectividade) chegam a recriar a sessão pelo token, e uma
    // sessão já viva não é revalidada — o que mascararia o teste.
    dbQuery('UPDATE usuarios SET ativo = 0 WHERE id = ?', [userId]);
    await simularFechamentoDoNavegador(context);

    await abrirDoServidor(page, '/index.php');
    await expect(page).toHaveURL(/login\.php|landing\.php/);

    // O token some junto: nada de continuar renovando o acesso de quem saiu.
    const { rows: tokens } = dbQuery('SELECT seletor FROM auth_tokens WHERE usuario_id = ?', [userId]);
    expect(tokens).toHaveLength(0);
  } finally {
    await context.close();
    dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
    dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [userId]);
    dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
  }
});
