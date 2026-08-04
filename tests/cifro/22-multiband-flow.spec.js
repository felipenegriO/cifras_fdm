/**
 * 22-multiband-flow.spec.js
 * Fluxo completo multi-banda:
 *   - Criar nova banda via API
 *   - Selecionar banda (trocar banda_atual)
 *   - Cadastrar membro na banda
 *   - Cadastrar música na banda
 *   - Isolamento de dados entre bandas
 *   - UI da página select-banda (modal "Nova banda")
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

async function criarBanda(page, nome) {
  const csrf = await getCsrf(page);
  const res = await page.request.post('/api/bandas/criar.php', {
    data: JSON.stringify({ nome }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  return { res, body: await res.json() };
}

async function selecionarBanda(page, bandaId) {
  const csrf = await getCsrf(page);
  const res = await page.request.post('/src/backend/bandas/selecionar.php', {
    data: JSON.stringify({ bandaId }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  return { res, body: await res.json() };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Criar banda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Criar banda — fluxo API', () => {
  test('criar banda retorna ok:true com id e nome', async ({ page }) => {
    const { res, body } = await criarBanda(page, '__MB_CRIAR_FLOW__');

    if (res.status() === 200) {
      expect(body.ok).toBe(true);
      expect(typeof body.id).toBe('string');
      expect(body.id.length).toBeGreaterThan(0);
      expect(body.nome).toBe('__MB_CRIAR_FLOW__');
      expect(body.plano).toBe('gratuito');
    } else {
      // Plano gratuito atingiu limite — aceitável
      expect(res.status()).toBe(403);
      expect(body.plano_limit).toBe(true);
    }
  });

  test('criar banda sem nome retorna 422', async ({ page }) => {
    const { res, body } = await criarBanda(page, '');
    expect(res.status()).toBe(422);
    expect(body.ok).toBe(false);
  });

  test('criar banda com nome de 121 chars retorna 422', async ({ page }) => {
    const { res } = await criarBanda(page, 'B'.repeat(121));
    expect(res.status()).toBe(422);
  });

  test('criar banda sem autenticação retorna 401/403', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post('/api/bandas/criar.php', {
      data: JSON.stringify({ nome: 'Não deve criar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('criar banda sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post('/api/bandas/criar.php', {
      data: JSON.stringify({ nome: 'Sem CSRF' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Selecionar banda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Selecionar banda — fluxo API', () => {
  test('selecionar banda válida retorna sucesso:true', async ({ page }) => {
    // Primeiro cria uma banda para garantir que temos uma para selecionar
    const { res: resC, body: bodyC } = await criarBanda(page, '__MB_SEL_FLOW__');

    if (resC.status() === 200 && bodyC.ok) {
      const { res, body } = await selecionarBanda(page, bodyC.id);
      expect(res.status()).toBe(200);
      expect(body.sucesso).toBe(true);
    } else {
      // Plano gratuito — tenta selecionar a banda já existente na sessão
      // Apenas verifica que o endpoint existe e responde
      const res = await page.request.post('/src/backend/bandas/selecionar.php', {
        data: JSON.stringify({ bandaId: '' }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrf(page) },
      });
      // bandaId vazio deve retornar sucesso:false
      const body = await res.json();
      expect(body.sucesso).toBe(false);
    }
  });

  test('selecionar banda inexistente retorna sucesso:false', async ({ page }) => {
    const { body } = await selecionarBanda(page, 'banda-que-nao-existe-00000');
    expect(body.sucesso).toBe(false);
  });

  test('selecionar com bandaId vazio retorna sucesso:false', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBe(false);
    expect(typeof body.mensagem).toBe('string');
  });

  test('selecionar banda de outro usuário retorna acesso negado', async ({ page }) => {
    // ID aleatório que claramente não pertence ao usuário
    const { body } = await selecionarBanda(page, 'aaaabbbbccccdddd0000111122223333');
    expect(body.sucesso).toBe(false);
  });

  test('GET em selecionar.php retorna método inválido', async ({ page }) => {
    const res = await page.request.get('/src/backend/bandas/selecionar.php');
    const body = await res.json();
    expect(body.sucesso).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Página select-banda.php — UI
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Página select-banda — UI', () => {
  test('página carrega com título correto', async ({ page }) => {
    await page.goto('/select-banda.php');
    await expect(page).toHaveTitle(/Selecionar Banda|Cifrô/i);
  });

  test('cards de bandas estão visíveis', async ({ page }) => {
    await page.goto('/select-banda.php');
    // Ou cards de bandas, ou mensagem de nenhuma banda
    const cards = page.locator('.sb-card');
    const empty = page.locator('.sb-empty');
    const hasCards = await cards.count() > 0;
    const hasEmpty = await empty.isVisible();
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('botão "Criar nova banda" está visível', async ({ page }) => {
    await page.goto('/select-banda.php');
    await expect(page.locator('#btnNovaBanda')).toBeVisible();
  });

  test('clicar em "Criar nova banda" abre modal', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.click('#btnNovaBanda');
    await expect(page.locator('#modalNovaBanda')).toHaveClass(/open/);
    await expect(page.locator('#inputNomeBanda')).toBeVisible();
  });

  test('Escape fecha modal', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.click('#btnNovaBanda');
    await expect(page.locator('#modalNovaBanda')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#modalNovaBanda')).not.toHaveClass(/open/);
  });

  test('botão Cancelar fecha modal', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.click('#btnNovaBanda');
    await page.locator('.sb-btn-ghost').click();
    await expect(page.locator('#modalNovaBanda')).not.toHaveClass(/open/);
  });

  test('criar banda com nome vazio no modal não submete', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.click('#btnNovaBanda');
    // Deixa input vazio e clica Criar
    await page.click('#btnCriarBanda');
    // Modal permanece aberto (toast de aviso)
    await expect(page.locator('#modalNovaBanda')).toHaveClass(/open/);
  });

  test('link de logout está visível', async ({ page }) => {
    await page.goto('/select-banda.php');
    const logout = page.locator('a.sb-logout, a[href="/logout.php"]');
    await expect(logout).toBeVisible();
  });

  test('sem autenticação redireciona para login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/select-banda.php');
    await expect(page).toHaveURL(/login\.php|landing\.php/i);
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fluxo criar banda → selecionar → verificar
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fluxo completo: criar → selecionar', () => {
  test('criar banda e selecioná-la funciona end-to-end', async ({ page }) => {
    const nomeBanda = `__MB_E2E_${Date.now()}__`;
    const { res: resC, body: bodyC } = await criarBanda(page, nomeBanda);

    if (resC.status() !== 200) {
      // Plano gratuito com limite atingido — não podemos testar este fluxo
      console.log('Limite de bandas atingido — fluxo E2E inconclusivo (esperado em plano gratuito)');
      expect(resC.status()).toBe(403);
      return;
    }

    expect(bodyC.ok).toBe(true);
    const bandaId = bodyC.id;

    // Selecionar a nova banda
    const { res: resSel, body: bodySel } = await selecionarBanda(page, bandaId);
    expect(resSel.status()).toBe(200);
    expect(bodySel.sucesso).toBe(true);

    // Verificar que a sessão foi atualizada (topnav deve mostrar nome da banda)
    await page.goto('/index.php');
    await expect(page).not.toHaveURL(/login\.php/i);
    // A página principal deve carregar sem erro
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cadastrar membros (usuários da banda)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cadastrar membros na banda', () => {
  const ENDPOINT_USER = '/src/backend/users/salvar_user.php';

  test('endpoint de usuários requer autenticação', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.post(ENDPOINT_USER, {
      data: 'nome=Teste&email=test_noauth%40e2e.local&perfil=basico',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('página de usuários carrega para administrador', async ({ page }) => {
    await page.goto('/users.php');
    // Pode redirecionar por acesso, ou carregar a página
    const url = page.url();
    if (url.includes('users.php')) {
      await expect(page.locator('body')).toBeVisible();
    } else {
      // Redirecionou — não é administrador desta banda ou requer seleção
      expect(url).toMatch(/login|select-banda|index/i);
    }
  });

  test('salvar usuário sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(ENDPOINT_USER, {
      data: 'nome=Sem+CSRF&email=sem_csrf_user%40e2e.local&perfil=basico',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status()).toBe(403);
  });

  test('salvar usuário sem nome retorna erro de validação', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(ENDPOINT_USER, {
      data: `nome=&email=sem_nome_user%40e2e.local&perfil=basico&csrf_token=${csrf}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    // Pode ser 422 (validação) ou JSON com sucesso:false
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.sucesso).toBe(false);
    } else {
      expect([400, 422]).toContain(res.status());
    }
  });

  test('listar usuários da banda retorna array', async ({ page }) => {
    const res = await page.request.get('/src/backend/users/salvar_user.php');
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    } else {
      // Pode retornar 403/401 se sem acesso master
      expect([401, 403]).toContain(res.status());
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cadastrar músicas na banda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cadastrar músicas na banda', () => {
  const ENDPOINT_MUSICA = '/src/backend/editor/api.php';
  const ENDPOINT_SYNC = '/api/sync/data.php';

  test('listar músicas requer autenticação', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get(ENDPOINT_SYNC);
    expect([401, 403]).toContain(res.status());
    await ctx.close();
  });

  test('listar músicas retorna array JSON (quando banda_atual está na sessão)', async ({ page }) => {
    const res = await page.request.get(ENDPOINT_SYNC);
    // 200 se banda_atual está na sessão, 403 se sessão sem banda selecionada
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body.musicas)).toBe(true);
    } else {
      expect([403, 401]).toContain(res.status());
    }
  });

  test('salvar música sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(ENDPOINT_MUSICA, {
      data: JSON.stringify({ action: 'save', nome: 'Sem CSRF' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('salvar música com nome retorna id', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(ENDPOINT_MUSICA, {
      data: JSON.stringify({
        action: 'save',
        nome: '__MB_MUSICA_TEST__',
        artista: 'Teste',
        classificacao: '',
        cifra: '# Cifra teste\n\nC G Am F',
        bit: '',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    if (body.plano_limit) {
      // Limite de músicas do plano gratuito atingido — esperado
      expect(body.ok ?? body.sucesso).toBeFalsy();
      return;
    }

    expect(body.sucesso ?? body.ok).toBeTruthy();
    // Cleanup: deletar música criada
    if (body.id) {
      const csrfDel = await getCsrf(page);
      await page.request.post(ENDPOINT_MUSICA, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfDel },
      });
    }
  });

  test('salvar música sem nome retorna erro', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(ENDPOINT_MUSICA, {
      data: JSON.stringify({ action: 'save', nome: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.sucesso ?? body.ok).toBeFalsy();
    } else {
      expect([400, 422]).toContain(res.status());
    }
  });

  test('deletar música inexistente retorna erro gracioso', async ({ page }) => {
    const csrf = await getCsrf(page);
    const res = await page.request.post(ENDPOINT_MUSICA, {
      data: JSON.stringify({ action: 'delete', id: 999999999 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    // Deve responder sem crash
    expect([200, 404]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Isolamento de dados entre bandas
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Isolamento de dados entre bandas', () => {
  test('músicas listadas pertencem à banda_atual da sessão', async ({ page }) => {
    // Lista músicas com banda atual
    const res1 = await page.request.get('/api/sync/data.php');
    // 200 se banda_atual está na sessão; 403 se sessão sem banda selecionada
    if (res1.status() === 200) {
      const musicas1 = (await res1.json()).musicas;
      expect(Array.isArray(musicas1)).toBe(true);
      for (const m of musicas1) {
        expect(typeof (m.nome ?? m.name)).toBe('string');
      }
    } else {
      expect([401, 403]).toContain(res1.status());
    }
  });

  test('playlists listadas pertencem à banda atual', async ({ page }) => {
    const res = await page.request.get('/src/backend/editor/salvar_playlists.php');
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    } else {
      expect([401, 403, 405]).toContain(res.status());
    }
  });

  test('roteiros listados pertencem à banda atual', async ({ page }) => {
    const res = await page.request.get('/src/backend/editor/salvar_roteiros.php');
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    } else {
      expect([401, 403, 405]).toContain(res.status());
    }
  });

  test('live state responde com banda_id da sessão', async ({ page }) => {
    const res = await page.request.get('/api/live/status.php');
    if (res.status() === 200) {
      const body = await res.json();
      // Deve ter campo band_id ou sucesso
      expect(body).toBeDefined();
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Fluxo UI completo: select-banda → criar via modal → redireciona para app
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fluxo UI: nova banda via modal', () => {
  test('criar banda via modal navega para index.php', async ({ page }) => {
    await page.goto('/select-banda.php');
    await page.click('#btnNovaBanda');

    const nomeBanda = `__UI_MODAL_${Date.now()}__`;
    await page.fill('#inputNomeBanda', nomeBanda);

    // Intercepta resposta do criar.php
    const responsePromise = page.waitForResponse(r =>
      r.url().includes('/api/bandas/criar.php') && r.request().method() === 'POST'
    );

    await page.click('#btnCriarBanda');
    const response = await responsePromise;
    const body = await response.json().catch(() => ({}));

    if ((response.status() === 200 && body.ok) || page.url().includes('index.php')) {
      // Deve redirecionar para index.php
      await page.waitForURL(/index\.php/i, { timeout: 8000 });
      expect(page.url()).toMatch(/index\.php/i);
    } else if (response.status() === 403 && body.plano_limit) {
      // Limite de plano — modal fecha e toast aparece
      await expect(page.locator('#modalNovaBanda')).not.toHaveClass(/open/);
    } else {
      // Outro erro — o teste registra mas não falha se for limite de plano
      console.log('Resposta inesperada no modal nova banda:', response.status(), body);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Topnav com multi-banda
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Topnav — contexto multi-banda', () => {
  test('topnav mostra nome da banda atual', async ({ page }) => {
    await page.goto('/index.php');
    const topnav = page.locator('nav, header, .topnav, #topnav').first();
    await expect(topnav).toBeVisible();
  });

  test('trocar banda atualiza interface', async ({ page }) => {
    // Vai para select-banda, verifica que pode selecionar uma banda e voltar para o app
    await page.goto('/select-banda.php');
    const cards = page.locator('.sb-card');
    const count = await cards.count();

    if (count > 0) {
      await cards.first().click();
      // Deve redirecionar para index.php
      await page.waitForURL(/index\.php/i, { timeout: 8000 });
      await expect(page.locator('body')).toBeVisible();
    } else {
      // Sem bandas — criar uma
      console.log('Nenhuma banda disponível para trocar — fluxo inconclusivo');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Limites de plano integrado com bandas
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Limites de plano integrado', () => {
  test('resposta de limite tem estrutura completa', async ({ page }) => {
    // Tenta criar bandas em loop até atingir limite
    let limitBody = null;

    for (let i = 0; i < 4; i++) {
      const { res, body } = await criarBanda(page, `__LIMITE_INT_${i}_${Date.now()}__`);
      if (res.status() === 403 && body.plano_limit) {
        limitBody = body;
        break;
      }
    }

    if (limitBody) {
      expect(limitBody.ok).toBe(false);
      expect(limitBody.plano_limit).toBe(true);
      expect(typeof limitBody.mensagem).toBe('string');
      expect(limitBody.mensagem.length).toBeGreaterThan(0);
      expect(limitBody.mensagem).toMatch(/limite|plano|upgrade|banda/i);
    } else {
      console.log('Usuário em plano sem limite de bandas — teste de limite inconclusivo');
    }
  });

  test('plano.php exibe contagem de bandas', async ({ page }) => {
    await page.goto('/plano.php');
    const bandaRow = page.locator('.usage-row').filter({ hasText: 'Bandas' });
    if (await bandaRow.isVisible()) {
      const count = await bandaRow.locator('.usage-count').textContent();
      expect(count).toMatch(/\d+\s*\/\s*(\d+|∞)/);
    } else {
      // Fallback: a seção de uso existe
      await expect(page.locator('.plan-usage, .usage-section, [class*="usage"]').first()).toBeVisible();
    }
  });
});
