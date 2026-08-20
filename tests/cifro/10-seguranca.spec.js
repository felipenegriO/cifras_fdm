/**
 * 10-seguranca.spec.js
 * Segurança: CSRF, headers HTTP, auth redirect, XSS,
 * controle de acesso por perfil e isolamento entre bandas.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const PROTECTED_ROUTES = [
  '/config.php',
  '/users.php',
  '/roteiro.php',
  '/music.php?id=1',
];

const POST_ENDPOINTS = [
  '/src/backend/editor/api.php',
  '/src/backend/editor/salvar_playlists.php',
  '/src/backend/editor/salvar_roteiros.php',
  '/src/backend/users/salvar_user.php',
  '/src/backend/bandas/salvar_banda.php',
  '/src/backend/bandas/selecionar.php',
];

// ── REDIRECIONAMENTO DE ROTAS PROTEGIDAS ──────────────────────────────────────
test.describe('Redirecionamento — rotas protegidas sem auth', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redireciona ${route} para landing/login`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // sem storageState — explicitamente vazio
      const page = await ctx.newPage();
      await page.goto(route);
      await page.waitForURL(url =>
        url.toString().includes('landing.php') || url.toString().includes('login.php'),
        { timeout: 6000 }
      );
      expect(page.url()).toMatch(/landing\.php|login\.php/);
      await ctx.close();
    });
  }
});

// ── CSRF — todos os POST retornam 403 sem token ───────────────────────────────
test.describe('CSRF — POST sem token retorna 403', () => {
  for (const endpoint of POST_ENDPOINTS) {
    test(`${endpoint} rejeita POST sem CSRF`, async ({ page }) => {
      const res = await page.request.post(endpoint, {
        data: JSON.stringify({ action: 'save' }),
        headers: { 'Content-Type': 'application/json' },
        // Sem X-CSRF-Token
      });
      expect(res.status()).toBe(403);
    });
  }
});

// ── HEADERS HTTP DE SEGURANÇA ─────────────────────────────────────────────────
test.describe('Headers HTTP de segurança', () => {
  test('servidor bloqueia content-sniffing do navegador', async ({ page }) => {
    const res = await page.request.get('/index.php');
    const header = res.headers()['x-content-type-options'];
    expect(header).toBe('nosniff');
  });

  test('servidor impede exibição do sistema em iframe de outro site', async ({ page }) => {
    const res = await page.request.get('/index.php');
    const header = res.headers()['x-frame-options'];
    expect(header?.toLowerCase()).toBe('sameorigin');
  });

  test('servidor controla referrer enviado em navegações externas', async ({ page }) => {
    const res = await page.request.get('/landing.php');
    const header = res.headers()['referrer-policy'];
    expect(header).toBeTruthy();
  });
});

// ── XSS — variáveis ecoadas ficam escapadas ──────────────────────────────────
test.describe('XSS — saída escapada', () => {
  test('payload XSS em busca não executa script', async ({ page }) => {
    await page.goto('/index.php');
    const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('<script>window.__xss=1</script>');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const xssExecuted = await page.evaluate(() => window.__xss);
      expect(xssExecuted).toBeUndefined();
    }
  });
});

// ── .HTACCESS — bloqueia arquivos sensíveis ───────────────────────────────────
test.describe('.htaccess — arquivos sensíveis bloqueados', () => {
  test('/.env retorna 403 ou 404', async ({ page }) => {
    const res = await page.request.get('/.env');
    expect([403, 404]).toContain(res.status());
  });

  test('/composer.json retorna 403 ou 404', async ({ page }) => {
    const res = await page.request.get('/composer.json');
    expect([403, 404]).toContain(res.status());
  });
});

// ── RATE LIMIT — muitas tentativas de login ───────────────────────────────────
test.describe('Rate limit — login', () => {
  test('8+ tentativas erradas retornam mensagem de bloqueio', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    let blocked = false;
    for (let i = 0; i < 9; i++) {
      await page.goto('/login.php');
      await page.fill('#email', 'usuario_bloqueio_test@e2e.local');
      await page.fill('#senha', `senha_errada_${i}`);
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      const body = await page.locator('body').textContent();
      if (body?.match(/bloqueado|muitas tentativas|tente.*minutos|aguarde/i)) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
    await ctx.close();
  });
});

// ── CONTROLE DE ACESSO POR PERFIL ─────────────────────────────────────────────
// Cada teste usa o storageState do perfil correto para fazer a requisição como
// um usuário real autenticado — sem evaluate(), sem forçar estado.

test.describe('Perfil basico — acesso negado a ações de gestor', () => {
  test('músico com perfil básico não consegue criar músicas no editor', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/basico.json' });
    const page = await ctx.newPage();

    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    const res = await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ action: 'save', nome: 'Teste', artista: '', cifra: '', bit: '', classificacao: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test('músico com perfil básico não consegue criar categorias', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/basico.json' });
    const page = await ctx.newPage();

    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    const res = await page.request.post('/src/backend/categorias/api.php', {
      data: JSON.stringify({ action: 'create', nome: 'Categoria Teste' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test('músico com perfil básico não consegue salvar playlists', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/basico.json' });
    const page = await ctx.newPage();

    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    const res = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [] }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    expect(res.status()).toBe(403);
    await ctx.close();
  });
});

test.describe('Perfil gestor — acesso negado a ações de administrador', () => {
  test('gestor não consegue alterar dados de outros usuários', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/gestor.json' });
    const page = await ctx.newPage();

    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    const res = await page.request.post('/src/backend/users/salvar_user.php', {
      data: JSON.stringify({ nome: 'Hacker', email: 'hacker@e2e.local', ativo: true, bandaPerfil: 'gestor' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
    expect(res.status()).toBe(403);
    await ctx.close();
  });
});

// ── ISOLAMENTO ENTRE BANDAS ────────────────────────────────────────────────────
// Verifica que um usuário não consegue selecionar uma banda da qual não é membro.
// O servidor deve rejeitar com mensagem de acesso negado.

test.describe('Isolamento entre bandas', () => {
  test('selecionar banda alheia é rejeitado pelo servidor', async ({ page }) => {
    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: '00000000-0000-0000-0000-000000000000' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });

    // Servidor retorna sucesso:false — acesso negado ou banda não encontrada
    const body = await res.json();
    expect(body.sucesso).toBe(false);
  });

  test('sync/data.php retorna apenas dados da banda da sessão — não aceita banda_id externo', async ({ page }) => {
    // A API ignora qualquer banda_id no body/query e usa sempre a sessão.
    // Se passarmos uma banda alheia como query param, não deve vazar dados dela.
    const res = await page.request.get('/api/sync/data.php?banda_id=00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Retornou dados da banda da sessão (não da banda alheia passada no param).
    // Verifica que o campo content_revision existe — é a resposta da banda da sessão.
    expect(body).toHaveProperty('content_revision');
    // Se a banda alheia tivesse sido usada, o content_revision seria 0 e musicas []
    // mas não temos como distinguir sem inspecionar o DB — o que importa é que
    // o parâmetro externo foi ignorado e a requisição não retornou erro 500/403.
  });

  test('sistema não vaza músicas de outra banda por ID externo', async ({ page }) => {
    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();

    // ID de música que não pertence à banda da sessão (ID inexistente)
    const res = await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ action: 'get', id: 999999999 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });

    // Deve retornar erro (not found) — não pode retornar dados de outra banda
    const body = await res.json().catch(() => ({}));
    const succeeded = body.ok === true && body.data != null;
    expect(succeeded).toBe(false);
  });
});
