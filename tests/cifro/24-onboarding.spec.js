/**
 * 24-onboarding.spec.js
 * Jornada completa de onboarding: landing → cadastro → ativação por token →
 * definição de senha → primeira experiência no app → retorno (login).
 *
 * O e-mail não é enviado em ambiente de teste (sem SMTP); o token de ativação
 * é lido direto do MySQL via tests/helpers/db.js, simulando o clique no link.
 *
 * Os testes marcados com test.fixme documentam bugs conhecidos do fluxo;
 * ao corrigir o bug, troque fixme por test e eles passam a valer.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

// Estes testes exercitam cadastro/login do zero — sem sessão compartilhada.
test.use({ storageState: { cookies: [], origins: [] } });

const RUN = Date.now();
const EMAIL = `onb.${RUN}@e2e.local`;
const SENHA = 'SenhaOnboarding#1';
const NOME = 'Usuário Onboarding E2E';
const BANDA = `Banda Onboarding ${RUN}`;

function limparDadosDeOnboarding() {
  // Remove usuários/bandas de execuções atuais e anteriores (e-mails @e2e.local)
  dbQuery(
    `DELETE t FROM password_reset_tokens t
     JOIN usuarios u ON u.id = t.usuario_id WHERE u.email LIKE ?`,
    ['onb.%@e2e.local']
  );
  dbQuery(
    `DELETE ub FROM usuario_banda ub
     JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email LIKE ?`,
    ['onb.%@e2e.local']
  );
  dbQuery(`DELETE FROM bandas WHERE nome LIKE ?`, ['Banda Onboarding %']);
  dbQuery(`DELETE FROM usuarios WHERE email LIKE ?`, ['onb.%@e2e.local']);
}

async function preencherCadastro(page, { nome = NOME, email = EMAIL, banda = BANDA } = {}) {
  await page.goto('/register.php');
  await page.fill('#nome', nome);
  await page.fill('#email', email);
  await page.fill('#banda_nome', banda);
  // O submit pode demorar: sem SMTP, o servidor aguarda o timeout do PHPMailer
  await page.click('.btn-submit');
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 });
}

test.describe.serial('Onboarding — jornada completa', () => {
  test.beforeAll(() => limparDadosDeOnboarding());
  test.afterAll(() => limparDadosDeOnboarding());

  let token = '';

  test('cadastro válido mostra tela "Verifique seu e-mail"', async ({ page }) => {
    test.slow(); // aguarda timeout do SMTP no servidor
    await preencherCadastro(page);
    await expect(page.getByRole('heading', { name: /verifique seu e-mail/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(EMAIL);
  });

  test('usuário é criado inativo e sem senha; banda entra no plano gratuito', async () => {
    const { rows: users } = dbQuery(
      'SELECT id, ativo, senha_hash FROM usuarios WHERE email = ?', [EMAIL]
    );
    expect(users).toHaveLength(1);
    expect(Number(users[0].ativo)).toBe(0);
    expect(users[0].senha_hash).toBeNull();

    const { rows: bandas } = dbQuery(
      `SELECT b.plano, b.trial_expira_em
       FROM bandas b JOIN usuario_banda ub ON ub.banda_id = b.id
       JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email = ?`, [EMAIL]
    );
    expect(bandas).toHaveLength(1);
    expect(bandas[0].plano).toBe('gratuito');
    expect(bandas[0].trial_expira_em).toBeNull();
  });

  test('usuário criado vira administrador da própria banda', async () => {
    const { rows } = dbQuery(
      `SELECT ub.perfil FROM usuario_banda ub
       JOIN usuarios u ON u.id = ub.usuario_id WHERE u.email = ?`, [EMAIL]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].perfil).toBe('administrador');
  });

  test('token de ativação de ~48h é gerado', async () => {
    const { rows } = dbQuery(
      `SELECT t.token, TIMESTAMPDIFF(HOUR, NOW(), t.expira_em) AS horas, t.usado
       FROM password_reset_tokens t JOIN usuarios u ON u.id = t.usuario_id
       WHERE u.email = ?`, [EMAIL]
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].usado)).toBe(0);
    // 46–52 para absorver diferença de fuso entre PHP e MySQL (UTC−3 no Brasil)
    expect(Number(rows[0].horas)).toBeGreaterThanOrEqual(46);
    expect(Number(rows[0].horas)).toBeLessThanOrEqual(52);
    token = rows[0].token;
  });

  test('cadastrar de novo com o mesmo e-mail mostra "já cadastrado"', async ({ page }) => {
    test.slow();
    await preencherCadastro(page, { banda: BANDA + ' bis' });
    await expect(page.locator('body')).toContainText(/já está cadastrado/i);
  });

  test('link de ativação (definir-senha) com token real exibe o formulário', async ({ page }) => {
    await page.goto(`/definir-senha.php?token=${token}`);
    await expect(page.locator('#senha')).toBeVisible();
    await expect(page.locator('#senha2')).toBeVisible();
    await expect(page.getByRole('button', { name: /ativar minha conta/i })).toBeVisible();
  });

  test('senha curta é rejeitada', async ({ page }) => {
    await page.goto(`/definir-senha.php?token=${token}`);
    await page.fill('#senha', '123');
    await page.fill('#senha2', '123');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toContainText(/pelo menos 6 caracteres/i);
  });

  test('senhas divergentes são rejeitadas', async ({ page }) => {
    await page.goto(`/definir-senha.php?token=${token}`);
    await page.fill('#senha', SENHA);
    await page.fill('#senha2', SENHA + 'x');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toContainText(/não coincidem/i);
  });

  test('definir senha ativa a conta e loga direto no app', async ({ page }) => {
    await page.goto(`/definir-senha.php?token=${token}`);
    await page.fill('#senha', SENHA);
    await page.fill('#senha2', SENHA);
    await page.click('button[type="submit"]');
    await page.waitForURL(/index\.php/, { timeout: 15000 });

    const { rows } = dbQuery(
      'SELECT ativo, senha_hash FROM usuarios WHERE email = ?', [EMAIL]
    );
    expect(Number(rows[0].ativo)).toBe(1);
    expect(rows[0].senha_hash).not.toBeNull();
  });

  test('token não pode ser reutilizado depois de usado', async ({ page }) => {
    await page.goto(`/definir-senha.php?token=${token}`);
    await expect(page.locator('.error')).toContainText(/inválido ou expirado/i);
  });

  test('login com o e-mail cadastrado funciona', async ({ page }) => {
    await page.goto('/login.php');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
    expect(page.url()).not.toContain('login.php');
  });

  test('home de banda nova carrega sem erros e exibe empty-state', async ({ page }) => {
    await page.goto('/login.php');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    const errosJs = [];
    page.on('pageerror', err => errosJs.push(err.message));
    await page.click('button[type="submit"]');
    await page.waitForURL(/index\.php/, { timeout: 10000 });

    await expect(page.locator('#music-list .empty-state')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#music-list .skeleton, #music-list [class*="skeleton"]')).toHaveCount(0);
    expect(errosJs).toEqual([]);
  });

  test('plano gratuito bloqueia a criação de uma segunda banda', async ({ page }) => {
    await page.goto('/logout.php');
    await page.goto('/login.php');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.click('button[type="submit"]');
    await page.waitForURL(/index\.php/, { timeout: 10000 });

    const csrfResponse = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfResponse.json();
    const response = await page.request.post('/api/bandas/criar.php', {
      data: JSON.stringify({ nome: '__SEGUNDA_BANDA_GRATUITA__' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    const body = await response.json();
    expect(response.status()).toBe(403);
    expect(body.plano_limit).toBe(true);
    expect(body.mensagem).toContain('máximo de 1 banda');
  });

  test('plano gratuito bloqueia o cadastro de membros adicionais', async ({ page }) => {
    await page.goto('/login.php');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.click('button[type="submit"]');
    await page.waitForURL(/index\.php/, { timeout: 10000 });

    const csrfResponse = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfResponse.json();
    const response = await page.request.post('/src/backend/users/salvar_user.php', {
      data: JSON.stringify({
        nome: 'Membro bloqueado',
        email: `membro.${RUN}@e2e.local`,
        bandaPerfil: 'basico',
        ativo: true,
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    const body = await response.json();
    expect(response.status()).toBe(403);
    expect(body.plano_limit).toBe(true);
    expect(body.mensagem).toContain('máximo de 1 usuários');
  });

  test('plano gratuito permite somente um setlist', async ({ page }) => {
    await page.goto('/login.php');
    await page.fill('#email', EMAIL);
    await page.fill('#senha', SENHA);
    await page.click('button[type="submit"]');
    // Timeout mais generoso (15s, igual ao usado em outros logins deste
    // arquivo): sob carga da suíte completa em paralelo, o login pode demorar
    // mais que 10s a responder — causa de flake observada em execução
    // completa (não reproduzido isolado).
    await page.waitForURL(/index\.php/, { timeout: 15000 });

    const csrfResponse = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfResponse.json();
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token };
    const first = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [{ nome: 'Setlist 1', itens: [] }] }),
      headers,
    });
    expect(first.status()).toBe(200);

    const second = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({
        playlists: [
          { nome: 'Setlist 1', itens: [] },
          { nome: 'Setlist 2', itens: [] },
        ],
      }),
      headers,
    });
    const body = await second.json();
    expect(second.status()).toBe(403);
    expect(body.plano_limit).toBe(true);
    expect(body.mensagem).toContain('máximo de 1 playlist');
  });
});

test.describe('Cadastro — validações do RegisterController', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  async function getRegisterCsrf(page) {
    await page.goto('/register.php');
    const meta = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    return meta;
  }

  test('e-mail em formato inválido é rejeitado', async ({ page }) => {
    const csrf = await getRegisterCsrf(page);
    const res = await page.request.post('/register.php', {
      form: { nome: 'X', email: 'nao-e-email', banda_nome: 'Banda X', csrf_token: csrf },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('E-mail inválido');
  });

  test('campo obrigatório ausente (nome) é rejeitado', async ({ page }) => {
    const csrf = await getRegisterCsrf(page);
    const res = await page.request.post('/register.php', {
      form: { nome: '', email: `valida.${Date.now()}@e2e.local`, banda_nome: 'Banda X', csrf_token: csrf },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('obrigatórios');
  });

  test('muitas tentativas de cadastro ativam o rate limit', async ({ page }) => {
    const csrf = await getRegisterCsrf(page);
    let lastBody = '';
    for (let i = 0; i < 6; i++) {
      const res = await page.request.post('/register.php', {
        form: { nome: '', email: '', banda_nome: '', csrf_token: csrf },
      });
      lastBody = await res.text();
    }
    expect(lastBody).toContain('Muitas tentativas');
  });
});

test.describe('Landing — consistência da oferta', () => {
  // BUG conhecido: o hero anuncia "R$5/mês depois" mas a tabela de planos
  // cobra R$9,90/mês. O preço do hero precisa bater com o pricing.
  test.fixme('preço anunciado no hero coincide com a tabela de planos', async ({ page }) => {
    await page.goto('/landing.php');
    const hero = await page.locator('.hero').textContent();
    const precoHero = hero.match(/R\$\s?([\d,]+)/);
    if (precoHero) {
      const pricing = await page.locator('body').textContent();
      expect(pricing).toContain(`R$${precoHero[1]}`);
      // o valor do hero deve existir como preço de algum plano
      const precosPlanos = ['9,90', '49,90', '89,90', '0'];
      expect(precosPlanos).toContain(precoHero[1]);
    }
  });
});
