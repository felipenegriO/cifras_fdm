/**
 * 10-seguranca.spec.js
 * Segurança: CSRF, headers HTTP, auth redirect, XSS.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const PROTECTED_ROUTES = [
  '/index.php',
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
  test('index.php tem X-Content-Type-Options', async ({ page }) => {
    const res = await page.request.get('/index.php');
    const header = res.headers()['x-content-type-options'];
    expect(header).toBe('nosniff');
  });

  test('index.php tem X-Frame-Options', async ({ page }) => {
    const res = await page.request.get('/index.php');
    const header = res.headers()['x-frame-options'];
    expect(header?.toLowerCase()).toBe('sameorigin');
  });

  test('landing.php tem Referrer-Policy', async ({ page }) => {
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
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // sessão vazia para não afetar SESS_A
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
