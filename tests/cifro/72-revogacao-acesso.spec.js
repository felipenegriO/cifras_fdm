/**
 * 72-revogacao-acesso.spec.js
 *
 * Tirar o acesso de alguém precisa valer NA HORA, não quando a sessão morrer.
 * São dois efeitos deliberadamente diferentes:
 *
 *   conta desativada/vencida -> desconecta de vez, e o login diz o motivo
 *   acesso à banda perdido   -> continua logado, perde só aquela banda
 *
 * Cada teste usa usuário e banda descartáveis: mexer no admin compartilhado da
 * suíte deixaria a bateria seguinte sem conta.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

function phpPasswordHash(senha) {
  return execFileSync('C:/xampp/php/php.exe', ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`], { encoding: 'utf8' }).trim();
}

const SENHA = 'RevogacaoE2E#2026!';

/** Cria usuário + N bandas onde ele é administrador. */
function criarCenario(qtdBandas = 1) {
  const userId = crypto.randomUUID();
  const email = `revog-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`;
  dbQuery(
    `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
     VALUES (?, 'Revogacao E2E', ?, ?, 'usuario', 1, 'ativo')`,
    [userId, email, phpPasswordHash(SENHA)],
  );
  const bandas = [];
  for (let i = 0; i < qtdBandas; i++) {
    const bandaId = crypto.randomUUID();
    dbQuery(`INSERT INTO bandas (id, nome, ativo, plano) VALUES (?, ?, 1, 'gratuito')`, [bandaId, `Banda Revog ${i + 1} ${Date.now()}`]);
    dbQuery(`INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, 'administrador')`, [userId, bandaId]);
    bandas.push(bandaId);
  }
  return { userId, email, bandas };
}

function limpar({ userId, bandas }) {
  dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
  dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [userId]);
  for (const b of bandas) dbQuery('DELETE FROM bandas WHERE id = ?', [b]);
  dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
}

async function logar(page, email) {
  await page.goto('/login.php');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
}

/**
 * Descarrega a página logada antes de mexer no banco.
 *
 * A página do app fica disparando sync/conectividade em segundo plano; se uma
 * dessas requisições chegar depois da mudança no banco, ela é quem percebe a
 * revogação, e a navegação seguinte encontra o estado já resolvido. O teste
 * ficaria medindo a corrida em vez do comportamento.
 */
async function pararTrafegoDeFundo(page) {
  await page.goto('about:blank');
}

/** Navega forçando ida ao servidor — sem isso o cache pode mascarar o teste. */
async function abrir(page, caminho) {
  const sep = caminho.includes('?') ? '&' : '?';
  await page.goto(`${caminho}${sep}_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conta: desconexão imediata
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Conta desativada — desconecta na hora', () => {
  test('conta desativada no meio da sessão derruba na requisição seguinte', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('UPDATE usuarios SET ativo = 0 WHERE id = ?', [cenario.userId]);

      await abrir(page, '/index.php');
      await expect(page).toHaveURL(/login\.php|landing\.php/);
      // A sessão morreu de verdade: não é só um redirect de tela.
      await expect(page.locator('#music-list')).toHaveCount(0);
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('validade vencida no meio da sessão também derruba', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('UPDATE usuarios SET validade = ? WHERE id = ?', ['2020-01-01', cenario.userId]);

      await abrir(page, '/index.php');
      await expect(page).toHaveURL(/login\.php|landing\.php/);
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('conta desativada não entra mais pelo login, com motivo explícito', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      dbQuery('UPDATE usuarios SET ativo = 0 WHERE id = ?', [cenario.userId]);
      await page.goto('/login.php');
      await page.fill('input[name="email"]', cenario.email);
      await page.fill('input[name="senha"]', SENHA);
      await page.click('button[type="submit"]');
      await expect(page.locator('body')).toContainText(/inativo/i);
      await expect(page).toHaveURL(/login\.php/);
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('conta desativada perde os tokens de lembrar-me', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      expect(dbQuery('SELECT seletor FROM auth_tokens WHERE usuario_id = ?', [cenario.userId]).rows.length).toBeGreaterThan(0);

      dbQuery('UPDATE usuarios SET ativo = 0 WHERE id = ?', [cenario.userId]);
      await abrir(page, '/index.php');

      const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE usuario_id = ?', [cenario.userId]);
      expect(rows).toHaveLength(0);
    } finally {
      await context.close();
      limpar(cenario);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Banda: continua logado, perde só a banda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Acesso à banda revogado — continua logado', () => {
  test('removido do vínculo perde a banda mas segue logado', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ? AND banda_id = ?', [cenario.userId, cenario.bandas[0]]);

      await abrir(page, '/index.php');
      // Não voltou para o login: a conta continua válida.
      await expect(page).not.toHaveURL(/login\.php|landing\.php/);
      await expect(page).toHaveURL(/select-banda\.php/);
      await expect(page.locator('.sb-aviso')).toBeVisible();
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('banda desativada bloqueia até o administrador dela', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('UPDATE bandas SET ativo = 0 WHERE id = ?', [cenario.bandas[0]]);

      await abrir(page, '/index.php');
      await expect(page).toHaveURL(/select-banda\.php/);
      await expect(page.locator('.sb-card--bloqueada')).toHaveCount(1);
      await expect(page.locator('.sb-card--bloqueada')).toContainText('Desativada');
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('plano bloqueado ainda abre, e abre na cobrança', async ({ browser }) => {
    // Diferente das outras revogações desta suíte: plano vencido é COBRANÇA,
    // não perda de acesso. A banda continua sendo dele e precisa abrir — senão
    // o administrador não tem caminho até o próprio pagamento.
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery("UPDATE bandas SET plano = 'bloqueado' WHERE id = ?", [cenario.bandas[0]]);

      await abrir(page, '/select-banda.php');
      await expect(page.locator('.sb-card--bloqueada')).toHaveCount(0);
      const card = page.locator(`a.sb-card[data-band-id="${cenario.bandas[0]}"]`);
      await expect(card).toHaveCount(1);
      await expect(card).toContainText('Bloqueado');

      // E o palco continua barrado: quem entra cai na tela de pagamento.
      await abrir(page, '/index.php');
      await expect(page).toHaveURL(/plano-expirado\.php/);

      // De onde ele alcança a aba que cobra.
      await abrir(page, '/minha-banda.php?aba=plano');
      await expect(page.locator('[data-aba-ativa]')).toHaveAttribute('data-aba-ativa', 'plano');
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('com outra banda válida, só a bloqueada fica cinza e a outra abre', async ({ browser }) => {
    const cenario = criarCenario(2);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('UPDATE bandas SET ativo = 0 WHERE id = ?', [cenario.bandas[0]]);

      await abrir(page, '/select-banda.php');
      await expect(page.locator('.sb-card--bloqueada')).toHaveCount(1);
      // A banda saudável continua clicável.
      await expect(page.locator(`a.sb-card[data-band-id="${cenario.bandas[1]}"]`)).toHaveCount(1);
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('sem nenhuma banda acessível, sobra a tela de seleção com opção de criar', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [cenario.userId]);

      await abrir(page, '/index.php');
      await expect(page).toHaveURL(/select-banda\.php/);
      await expect(page.locator('#btnNovaBanda')).toBeVisible();
      await expect(page.locator('.sb-empty')).toBeVisible();
    } finally {
      await context.close();
      limpar(cenario);
    }
  });

  test('API responde 403 explicando a perda de acesso, sem redirecionar', async ({ browser }) => {
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await logar(page, cenario.email);
      await pararTrafegoDeFundo(page);
      dbQuery('UPDATE bandas SET ativo = 0 WHERE id = ?', [cenario.bandas[0]]);

      const res = await page.request.get('/api/sync/data.php');
      expect(res.status()).toBe(403);
      const corpo = await res.json();
      expect(corpo.error).toBe('banda_sem_acesso');
      expect(corpo.motivo).toBe('desativada');
    } finally {
      await context.close();
      limpar(cenario);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plano: a sessão precisa acompanhar o banco
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Upgrade de plano — vale na hora', () => {
  test('pagar libera o limite sem precisar deslogar e logar de novo', async ({ browser }) => {
    // A reclamação que isto previne: "paguei e continua limitado". O plano
    // vinha da foto do login, então o webhook do Stripe atualizava o banco e o
    // músico seguia barrado até reabrir a sessão.
    const cenario = criarCenario(1);
    const bandaId = cenario.bandas[0];
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      // Estoura o limite do gratuito (10 músicas).
      for (let i = 0; i < 10; i++) {
        dbQuery('INSERT INTO musicas (banda_id, nome, artista) VALUES (?, ?, ?)', [bandaId, `Musica ${i}`, 'Teste']);
      }
      await logar(page, cenario.email);

      const csrf = await page.evaluate(() => document.querySelector('meta[name=csrf-token]')?.content || '');
      const salvar = () => page.request.post('/src/backend/editor/api.php', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ nome: 'Musica nova', artista: 'Teste', cifra: 'C', classificacao: '', bit: '' }),
      });

      const bloqueado = await (await salvar()).json();
      expect(bloqueado.plano_limit, 'no gratuito o limite deve barrar').toBe(true);

      // O pagamento entra: o webhook muda o plano no banco, não na sessão.
      dbQuery("UPDATE bandas SET plano = 'mensal' WHERE id = ?", [bandaId]);

      const liberado = await (await salvar()).json();
      expect(liberado.plano_limit, 'depois de pagar não pode mais barrar').toBeFalsy();
      expect(liberado.id ?? liberado.ok).toBeTruthy();
    } finally {
      await context.close();
      dbQuery('DELETE FROM musicas WHERE banda_id = ?', [bandaId]);
      limpar(cenario);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lista de bandas: a topnav decide o seletor por ela
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Lista de bandas — acompanha o banco', () => {
  test('ganhar uma segunda banda faz o seletor aparecer sem relogar', async ({ browser }) => {
    // A topnav mostra o seletor quando count(usuario.bandas) > 1, e essa lista
    // era gravada só no login. Quem criava a segunda banda ficava sem como
    // trocar de banda até deslogar.
    const cenario = criarCenario(1);
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const segunda = crypto.randomUUID();
    try {
      await logar(page, cenario.email);
      await abrir(page, '/index.php');
      // Com uma banda só, o chip não leva a lugar nenhum.
      await expect(page.locator('.topnav__band-chip')).not.toHaveAttribute('href', /select-banda/);

      // Uma segunda banda entra em cena (outro admin te adicionou, ou você criou).
      dbQuery(`INSERT INTO bandas (id, nome, ativo, plano) VALUES (?, ?, 1, 'gratuito')`, [segunda, `Segunda ${Date.now()}`]);
      dbQuery(`INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, 'administrador')`, [cenario.userId, segunda]);

      await abrir(page, '/index.php');
      await expect(page.locator('.topnav__band-chip')).toHaveAttribute('href', /select-banda/);
    } finally {
      await context.close();
      dbQuery('DELETE FROM usuario_banda WHERE banda_id = ?', [segunda]);
      dbQuery('DELETE FROM bandas WHERE id = ?', [segunda]);
      limpar(cenario);
    }
  });
});
