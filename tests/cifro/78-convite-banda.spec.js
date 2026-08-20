/**
 * 78-convite-banda.spec.js
 *
 * Convite da banda por link (ROLE-003). O que estes testes protegem:
 *
 *  1. só administrador gera link — um básico não pode abrir a banda para o mundo;
 *  2. o link morre quando revogado, no request seguinte;
 *  3. quem não pode ter mais membros descobre isso ANTES de compartilhar.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';
import { dbQuery } from '../helpers/db.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

function phpPasswordHash(senha) {
  return execFileSync('C:/xampp/php/php.exe', ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`], { encoding: 'utf8' }).trim();
}

const ENDPOINT = '/api/bandas/convite.php';

test.use({ storageState: 'tests/.auth/user.json' });

test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

async function csrf(page) {
  await page.goto('/index.php');
  return page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
}

async function gerar(page) {
  const token = await csrf(page);
  return page.request.post(ENDPOINT, {
    data: JSON.stringify({ action: 'gerar' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
  });
}

test.describe('Convite da banda — geração do link', () => {
  test('administrador gera um link que aponta para a página de convite', async ({ page }) => {
    const res = await gerar(page);

    expect(res.status()).toBe(200);
    const corpo = await res.json();
    expect(corpo.sucesso).toBe(true);
    expect(corpo.caminho).toMatch(/\/convite\.php\?t=[0-9a-f]{64}$/);
    expect(corpo.banda_nome).toBeTruthy();
  });

  test('o link recém-gerado aparece como convite ativo com validade legível', async ({ page }) => {
    await gerar(page);

    const res = await page.request.get(ENDPOINT);
    const corpo = await res.json();

    expect(corpo.estado.ativo).toBe(true);
    expect(corpo.estado.validade).toMatch(/^\d{2}\/\d{2} às \d{2}h\d{2}$/);
    expect(typeof corpo.estado.usos).toBe('number');
  });

  test('gerar duas vezes não mata o link já compartilhado', async ({ page }) => {
    const primeiro = await (await gerar(page)).json();
    const segundo = await (await gerar(page)).json();

    expect(primeiro.caminho).not.toBe(segundo.caminho);

    // Os dois continuam abrindo a página de convite, não a tela de link inválido.
    for (const caminho of [primeiro.caminho, segundo.caminho]) {
      await page.goto(caminho);
      await expect(page.locator('[data-convite-estado]')).not.toHaveAttribute('data-convite-estado', 'invalido');
    }
  });

  test('revogar derruba o link no request seguinte', async ({ page }) => {
    const { caminho } = await (await gerar(page)).json();
    const token = await csrf(page);

    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'revogar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect((await res.json()).estado.ativo).toBe(false);

    await page.goto(caminho);
    await expect(page.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
  });
});

test.describe('Convite da banda — quem pode gerar', () => {
  test('POST sem CSRF é recusado', async ({ page }) => {
    await page.goto('/index.php');
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('visitante sem sessão não gera convite', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    const res = await anonima.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403, 404]).toContain(res.status());
    await ctx.close();
  });

  test('ação desconhecida é recusada', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'explodir' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(res.status()).toBe(422);
  });

  test('gestor autenticado não gera link — só administrador abre a banda para o mundo', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/gestor.json' });
    const page = await ctx.newPage();

    const token = await csrf(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(res.status()).toBe(403);
    // Precisa ser recusa por ROLE, não por teto de plano — senão o teste
    // continua verde mesmo se require_band_role('administrador') virar
    // require_band_role('gestor'), porque o teto do plano barraria do
    // mesmo jeito antes de chegar na checagem de papel.
    const corpo = await res.json();
    expect(corpo.plano_limit).not.toBe(true);
    expect(corpo.mensagem).toMatch(/permiss/i);
    await ctx.close();
  });

  test('básico autenticado não gera link — só administrador abre a banda para o mundo', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/basico.json' });
    const page = await ctx.newPage();

    const token = await csrf(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(res.status()).toBe(403);
    const corpo = await res.json();
    expect(corpo.plano_limit).not.toBe(true);
    expect(corpo.mensagem).toMatch(/permiss/i);
    await ctx.close();
  });

  test('POST revogar sem CSRF é recusado', async ({ page }) => {
    await page.goto('/index.php');
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'revogar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Convite da banda — a aba Membros', () => {
  test('o administrador encontra o botão Convidar como ação principal', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');

    const convidar = page.locator('#btnConvidar');
    await expect(convidar).toBeVisible();
    await expect(convidar).toHaveClass(/btn--primary/);
  });

  test('gerar o convite copia o link e mostra a validade para o administrador', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');

    // Sem clipboard real no navegador de teste: troca a cópia por um espião.
    await page.evaluate(() => {
      window.__copiado = [];
      window.CifroShare.copy = async texto => { window.__copiado.push(texto); };
    });

    await page.click('#btnConvidar');

    await expect(page.locator('#conviteEstado')).toBeVisible();
    await expect(page.locator('#conviteValidade')).toHaveText(/^\d{2}\/\d{2} às \d{2}h\d{2}$/);

    await expect.poll(() => page.evaluate(() => window.__copiado.length)).toBe(1);
    const copiado = await page.evaluate(() => window.__copiado);
    expect(copiado[0]).toContain('/convite.php?t=');
    expect(copiado[0]).toContain('24 horas');
  });

  test('revogar some com a linha de convite ativo', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    await page.evaluate(() => { window.CifroShare.copy = async () => {}; });

    await page.click('#btnConvidar');
    await expect(page.locator('#conviteEstado')).toBeVisible();

    await page.click('#btnRevogarConvite');
    // cifroConfirm é um modal do próprio produto, não um dialog do navegador:
    // o botão de confirmação é .cifro-confirm-btn--danger (cifro-confirm.js:67).
    await page.click('.cifro-confirm-btn--danger');

    await expect(page.locator('#conviteEstado')).toBeHidden();
  });
});

test.describe('Convite da banda — a página do convidado', () => {
  test('convite inválido não revela o nome da banda', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();

    await anonima.goto('/convite.php?t=' + 'f'.repeat(64));

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
    await expect(anonima.getByText(/não é mais válido/i)).toBeVisible();
    await expect(anonima.getByText(/Banda E2E/i)).toHaveCount(0);
    await ctx.close();
  });

  test('convite sem token nenhum também cai na tela neutra', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();

    await anonima.goto('/convite.php');

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
    await ctx.close();
  });

  test('visitante recebe os caminhos de cadastro com o nome da banda', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho, banda_nome } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    await anonima.goto(caminho);

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'visitante');
    await expect(anonima.getByText(banda_nome)).toBeVisible();
    await expect(anonima.locator('#conviteCriarConta')).toBeVisible();
    await expect(anonima.locator('#conviteJaTenhoConta')).toBeVisible();
    await ctx.close();
  });

  test('entrar por convite não vira atalho para pular os termos de uso', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    await anonima.goto(caminho);

    const google = anonima.locator('#conviteGoogle');
    if (await google.count() === 0) { await ctx.close(); test.skip(true, 'Google OAuth não configurado neste ambiente.'); return; }

    // Sem marcar o aceite, o clique é barrado e ninguém sai da página.
    anonima.once('dialog', d => d.accept());
    await google.click();
    await expect(anonima).toHaveURL(/convite\.php/);

    await ctx.close();
  });

  test('administrador que abre o próprio link vê que já faz parte da banda', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    await page.goto(caminho);

    await expect(page.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'ja-membro');
  });

  test('entrar na banda exige POST — abrir o link não vincula ninguém', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    // GET puro no link não pode ter efeito colateral: o contador segue zerado.
    await page.request.get(caminho);
    const estado = await (await page.request.get('/api/bandas/convite.php')).json();

    expect(estado.estado.usos).toBe(0);
  });

  test('convidado que aceita entra na banda com perfil básico e o vínculo fica gravado', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const tokenConvite = caminho.match(/[?&]t=([0-9a-f]{64})/)[1];
    const [{ banda_id: bandaId }] = dbQuery(
      'SELECT banda_id FROM banda_convites WHERE token = SHA2(?, 256)',
      [tokenConvite],
    ).rows;

    // A Banda E2E compartilhada é semeada no plano gratuito (teto de 1 músico)
    // e já tem vários membros de outras suítes — aceitar sempre bateria no
    // teto do plano antes de provar o caminho feliz. Sobe o plano só para
    // este teste e devolve ao valor original no finally.
    const [{ plano: planoOriginal }] = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaId]).rows;
    dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['mensal', bandaId]);

    const userId = crypto.randomUUID();
    const email = `convite-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
    const senha = 'ConviteE2E#2026!';
    dbQuery(
      `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
       VALUES (?, 'Convidado E2E', ?, ?, 'usuario', 1, 'ativo')`,
      [userId, email, phpPasswordHash(senha)],
    );

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();
    try {
      await convidado.goto('/login.php');
      await convidado.fill('input[name="email"]', email);
      await convidado.fill('input[name="senha"]', senha);
      await convidado.click('button[type="submit"]');
      await convidado.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

      await convidado.goto(caminho);
      await expect(convidado.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'entrar');

      await convidado.click('#conviteEntrar');
      await expect(convidado).not.toHaveURL(/convite\.php/);

      const vinculo = dbQuery(
        'SELECT perfil FROM usuario_banda WHERE usuario_id = ? AND banda_id = ?',
        [userId, bandaId],
      ).rows;
      expect(vinculo).toHaveLength(1);
      expect(vinculo[0].perfil).toBe('basico');
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [userId]);
      dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [planoOriginal, bandaId]);
    }
  });
});

test.describe('Convite da banda — cadastro por e-mail', () => {
  test('o formulário de cadastro esconde o nome da banda para quem veio de um convite', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho, banda_nome } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    try {
      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');

      await expect(convidado).toHaveURL(/register\.php/);
      await expect(convidado.locator('#banda_nome')).toHaveCount(0);
      await expect(convidado.getByText(banda_nome)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('músico convidado se cadastra e entra na banda como básico', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    const tokenConvite = caminho.match(/[?&]t=([0-9a-f]{64})/)[1];
    const [{ banda_id: bandaId }] = dbQuery(
      'SELECT banda_id FROM banda_convites WHERE token = SHA2(?, 256)',
      [tokenConvite],
    ).rows;

    // A Banda E2E compartilhada é semeada no plano gratuito (teto de 1 músico)
    // e já tem vários membros de outras suítes — um convidado real (ao
    // contrário do master) bate no teto do plano antes de aceitar. Sobe o
    // plano só para este teste e devolve ao valor original no finally.
    const [{ plano: planoOriginal }] = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaId]).rows;
    dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['mensal', bandaId]);

    const email = `convidado-${Date.now()}@e2e.local`;
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    try {
      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');
      await convidado.fill('#nome', 'Músico Convidado');
      await convidado.fill('#email', email);
      await convidado.check('#legal_acceptance');
      await convidado.click('button[type="submit"]');

      await expect(convidado.getByText(/Verifique seu e-mail/i)).toBeVisible();

      // A prova real está no banco: vínculo na banda do convite, como básico,
      // e NENHUMA banda nova criada para este usuário.
      const { rows } = dbQuery(
        `SELECT ub.perfil, COUNT(*) OVER () AS vinculos
           FROM usuarios u JOIN usuario_banda ub ON ub.usuario_id = u.id
          WHERE u.email = ?`,
        [email]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].perfil).toBe('basico');
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuarios WHERE email = ?', [email]);
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [planoOriginal, bandaId]);
    }
  });

  test('convite revogado no meio do cadastro não tranca o visitante — ele ainda cria a própria banda', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    const email = `convite-morto-${Date.now()}@e2e.local`;
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    try {
      // Abre o convite (grava na sessão) e segue para o cadastro, ainda com
      // o campo "Nome da banda" escondido.
      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');
      await expect(convidado).toHaveURL(/register\.php/);
      await expect(convidado.locator('#banda_nome')).toHaveCount(0);

      // O administrador revoga o convite enquanto o visitante ainda está no
      // formulário — o cenário do convite que morre no meio do caminho.
      const csrfAdmin2 = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
      const revogar = await page.request.post('/api/bandas/convite.php', {
        data: JSON.stringify({ action: 'revogar' }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin2 },
      });
      expect((await revogar.json()).estado.ativo).toBe(false);

      await convidado.fill('#nome', 'Visitante Sem Convite');
      await convidado.fill('#email', email);
      await convidado.check('#legal_acceptance');
      await convidado.click('button[type="submit"]');

      // Não fica preso: a tela mostra o motivo e devolve o campo para criar
      // a própria banda, em vez de repetir a recusa para sempre.
      await expect(convidado.getByText(/convite não é mais válido/i)).toBeVisible();
      await expect(convidado.locator('#banda_nome')).toBeVisible();

      await convidado.fill('#banda_nome', 'Banda Sem Convite E2E');
      await convidado.click('button[type="submit"]');
      await expect(convidado.getByText(/Verifique seu e-mail/i)).toBeVisible();
    } finally {
      await ctx.close();
      const criada = dbQuery(
        `SELECT ub.banda_id FROM usuario_banda ub JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email = ?`,
        [email],
      ).rows;
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuarios WHERE email = ?', [email]);
      if (criada.length) dbQuery('DELETE FROM bandas WHERE id = ?', [criada[0].banda_id]);
    }
  });

  test('banda cheia no meio do cadastro não tranca o visitante — ele ainda cria a própria banda', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    const bandaId = await page.evaluate(() => window.CIFRO_BAND_ID);
    const { rows: antes } = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaId]);

    const email = `banda-cheia-${Date.now()}@e2e.local`;
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    try {
      // Abre o convite (grava na sessão) e segue para o cadastro, ainda com
      // o campo "Nome da banda" escondido.
      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');
      await expect(convidado).toHaveURL(/register\.php/);
      await expect(convidado.locator('#banda_nome')).toHaveCount(0);

      // A banda cai para o Gratuito enquanto o visitante ainda está no
      // formulário: o convite vira recusa por teto de plano.
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['gratuito', bandaId]);

      await convidado.fill('#nome', 'Visitante de Banda Cheia');
      await convidado.fill('#email', email);
      await convidado.check('#legal_acceptance');
      await convidado.click('button[type="submit"]');

      // Banda cheia não pode trancar quem ainda não tem conta fora de QUALQUER
      // cadastro: o convite sai da sessão e o campo da banda própria volta.
      await expect(convidado.getByText(/limite de músicos do plano/i)).toBeVisible();
      await expect(convidado.locator('#banda_nome')).toBeVisible();

      await convidado.fill('#banda_nome', 'Banda Apos Teto E2E');
      await convidado.click('button[type="submit"]');
      await expect(convidado.getByText(/Verifique seu e-mail/i)).toBeVisible();
    } finally {
      await ctx.close();
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [antes[0].plano, bandaId]);
      const criada = dbQuery(
        `SELECT ub.banda_id FROM usuario_banda ub JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email = ?`,
        [email],
      ).rows;
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)', [email]);
      dbQuery('DELETE FROM usuarios WHERE email = ?', [email]);
      if (criada.length) dbQuery('DELETE FROM bandas WHERE id = ?', [criada[0].banda_id]);
    }
  });
});

test.describe('Convite da banda — quem já tem conta', () => {
  test('músico de outra banda entra na banda convidada sem perder a primeira', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    const tokenConvite = caminho.match(/[?&]t=([0-9a-f]{64})/)[1];
    const [{ banda_id: bandaConvidanteId }] = dbQuery(
      'SELECT banda_id FROM banda_convites WHERE token = SHA2(?, 256)',
      [tokenConvite],
    ).rows;

    // A Banda E2E compartilhada é semeada no plano gratuito (teto de 1 músico)
    // e já tem vários membros de outras suítes — um convidado real (ao
    // contrário do master) bate no teto do plano antes de aceitar. Sobe o
    // plano só para este teste e devolve ao valor original no finally.
    const [{ plano: planoOriginal }] = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaConvidanteId]).rows;
    dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['mensal', bandaConvidanteId]);

    // Um músico que já existe e já toca na própria banda.
    const sufixo = Date.now();
    const usuarioId = `e2e-convidado-${sufixo}`;
    const outraBandaId = `e2e-outra-banda-${sufixo}`;
    const email = `outra-banda-${sufixo}@e2e.local`;
    const senha = 'CifroE2E#2026!';

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });

    try {
      dbQuery('INSERT INTO bandas (id,nome,ativo,plano) VALUES (?,?,1,?)', [outraBandaId, 'Outra Banda', 'mensal']);
      dbQuery('INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo) VALUES (?,?,?,?,?,1)',
        [usuarioId, 'Músico de Duas', email, phpPasswordHash(senha), 'usuario']);
      dbQuery('INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,?)',
        [usuarioId, outraBandaId, 'administrador']);

      const convidado = await ctx.newPage();

      await convidado.goto(caminho);
      await convidado.click('#conviteJaTenhoConta');
      await convidado.fill('input[name="email"]', email);
      await convidado.fill('input[name="senha"]', senha);
      await convidado.click('button[type="submit"]');
      await convidado.waitForURL(url => !url.toString().includes('login.php'));

      const { rows } = dbQuery('SELECT banda_id, perfil FROM usuario_banda WHERE usuario_id = ? ORDER BY perfil', [usuarioId]);
      expect(rows).toHaveLength(2);
      expect(rows.find(r => r.banda_id === outraBandaId).perfil).toBe('administrador');
      expect(rows.find(r => r.banda_id !== outraBandaId).perfil).toBe('basico');
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [usuarioId]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [usuarioId]);
      dbQuery('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
      dbQuery('DELETE FROM bandas WHERE id = ?', [outraBandaId]);
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [planoOriginal, bandaConvidanteId]);
    }
  });
});

test.describe('Convite da banda — limites do plano', () => {
  test('banda no plano Gratuito não gera link e é convidada a fazer upgrade', async ({ browser }) => {
    const sufixo = Date.now();
    const bandaId = `e2e-gratuita-${sufixo}`;
    const adminId = `e2e-admin-gratuito-${sufixo}`;
    const email = `admin-gratuito-${sufixo}@e2e.local`;
    const senha = 'CifroE2E#2026!';

    // Administrador NÃO-master: master pula a checagem de limite de plano.
    dbQuery('INSERT INTO bandas (id,nome,ativo,plano) VALUES (?,?,1,?)', [bandaId, 'Banda Gratuita', 'gratuito']);
    dbQuery('INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo) VALUES (?,?,?,?,?,1)',
      [adminId, 'Admin Gratuito', email, phpPasswordHash(senha), 'usuario']);
    dbQuery('INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,?)',
      [adminId, bandaId, 'administrador']);

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const admin = await ctx.newPage();

    try {
      await admin.goto('/login.php');
      await admin.fill('input[name="email"]', email);
      await admin.fill('input[name="senha"]', senha);
      await admin.click('button[type="submit"]');
      await admin.waitForURL(url => !url.toString().includes('login.php'));

      await admin.goto('/minha-banda.php?aba=membros');
      const csrf = await admin.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));

      const res = await admin.request.post('/api/bandas/convite.php', {
        data: JSON.stringify({ action: 'gerar' }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });

      expect(res.status()).toBe(403);
      const corpo = await res.json();
      expect(corpo.plano_limit).toBe(true);
      expect(corpo.mensagem).toMatch(/Gratuito/);

      // E nenhum convite foi criado — o link impossível de usar nem chega a existir.
      const { rows } = dbQuery('SELECT COUNT(*) AS total FROM banda_convites WHERE banda_id = ?', [bandaId]);
      expect(Number(rows[0].total)).toBe(0);
    } finally {
      await ctx.close();
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [adminId]);
      dbQuery('DELETE FROM usuarios WHERE id = ?', [adminId]);
      dbQuery('DELETE FROM bandas WHERE id = ?', [bandaId]);
    }
  });

  test('banda que atinge o teto durante a validade do link recusa o convidado sem criar conta órfã', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    // O link foi gerado com a banda folgada; agora ela cai para o Gratuito,
    // que já não comporta nem mais um membro. É o caso do downgrade ou do
    // pagamento que falhou dentro das 24h de validade.
    const bandaId = await page.evaluate(() => window.CIFRO_BAND_ID);
    const { rows: antes } = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaId]);
    dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['gratuito', bandaId]);

    try {
      const email = `orfao-${Date.now()}@e2e.local`;
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const convidado = await ctx.newPage();

      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');
      await convidado.fill('#nome', 'Convidado Tardio');
      await convidado.fill('#email', email);
      await convidado.check('#legal_acceptance');
      await convidado.click('button[type="submit"]');

      await expect(convidado.getByText(/limite de músicos do plano/i)).toBeVisible();

      // A conta NÃO pode ter sobrado no banco sem banda: a transação volta atrás.
      const { rows } = dbQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
      expect(rows).toHaveLength(0);

      await ctx.close();
    } finally {
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [antes[0].plano, bandaId]);
    }
  });
});
