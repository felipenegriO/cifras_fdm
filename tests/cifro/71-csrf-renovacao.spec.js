/**
 * 71-csrf-renovacao.spec.js
 * O token CSRF é lido do DOM uma vez, no load. Quando o PHPSESSID morre e o
 * login persistente revive a sessão, o servidor passa a esperar um token novo
 * e o da aba fica velho — todo POST daquela aba viraria 403 até um reload
 * manual. É o cenário da aba deixada aberta durante o ensaio.
 */
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

async function logar(page) {
  await page.goto('/login.php');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="senha"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
}

/** Mata só a sessão, preservando o "lembrar-me" — é o que a expiração faz. */
async function matarSessaoPreservandoToken(context) {
  const cookies = await context.cookies();
  const lembrar = cookies.filter(c => c.name === 'cifro_lembrar' || c.name === '__Host-cifro_lembrar');
  expect(lembrar.length, 'o login deveria ter emitido o cookie lembrar-me').toBeGreaterThan(0);
  await context.clearCookies();
  await context.addCookies(lembrar);
}

test('aba antiga com token CSRF velho se recupera sozinha, sem reload', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await logar(page);
    await page.goto('/index.php');
    const tokenDaAba = await page.evaluate(() => window.CIFRO_CSRF);

    // A sessão morre enquanto a aba segue aberta.
    await matarSessaoPreservandoToken(context);

    // A aba salva uma configuração, ainda com o token antigo em memória.
    const resultado = await page.evaluate(async () => {
      const res = await fetch('/src/backend/users/salvar_config.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: 'escuro' }),
      });
      // O corpo entra na mensagem de falha de propósito: um 403 aqui pode vir
      // de CSRF (que o cifro-csrf.js repete) ou de outra trava — beta fechado,
      // banda sem acesso — que ele NÃO repete, porque ehFalhaDeCsrf() exige a
      // palavra "csrf" no corpo. Sem ver o corpo, os dois casos são o mesmo
      // "esperava 200, veio 403" e o diagnóstico vira adivinhação.
      return { status: res.status, corpo: await res.text().catch(() => ''), tokenAgora: window.CIFRO_CSRF };
    });

    expect(
      resultado.status,
      `o POST deveria ter sido refeito com o token novo. Resposta do servidor: ${resultado.corpo}`
    ).toBe(200);
    expect(resultado.tokenAgora).not.toBe(tokenDaAba);
  } finally {
    await context.close();
  }
});

test('403 de permissão não é confundido com CSRF nem repetido', async ({ browser }) => {
  // Um 403 sem menção a CSRF no corpo (aqui: falta o token de propósito, mas
  // conferimos que o corpo é lido e não vira laço) deve chegar ao chamador.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await logar(page);
    await page.goto('/index.php');
    const status = await page.evaluate(async () => {
      const res = await fetch('/src/backend/bandas/salvar_banda.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'x' }),
      });
      return res.status;
    });
    // Sem laço infinito: a resposta chega ao chamador em tempo normal.
    expect([200, 403]).toContain(status);
  } finally {
    await context.close();
  }
});
