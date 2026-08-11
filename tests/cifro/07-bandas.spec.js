/**
 * 07-bandas.spec.js
 * Gestão de bandas — master only (bandas.php / editorbandas).
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/bandas/salvar_banda.php';

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Tela de Bandas (master)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bandas.php');
    await page.waitForLoadState('networkidle');
  });

  test('carrega sem erros PHP', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('exibe lista de bandas', async ({ page }) => {
    await expect(page.locator('#listaBandas')).toBeVisible({ timeout: 8000 });
  });

  test('botão "Nova Banda" está presente', async ({ page }) => {
    await expect(page.locator('button[onclick*="abrirModalNova"]')).toBeVisible();
  });

  test('abre modal de nova banda', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    await expect(page.locator('#modalOverlay.open, #modalOverlay')).toBeVisible();
    await expect(page.locator('#bandaNome')).toBeVisible();
  });

  test('nova banda não permite ativar plano sem pagamento', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    await expect(page.locator('.plan-btn')).toHaveCount(0);
    await expect(page.locator('#bandaPlanoLabel')).toHaveText('Gratuito');
    await expect(page.locator('#planHint')).toContainText('tela de pagamento');
  });

  test('fecha modal ao clicar Cancelar', async ({ page }) => {
    await page.click('button[onclick*="abrirModalNova"]');
    await page.click('button:has-text("Cancelar")');
    await page.waitForTimeout(300);
    const overlay = page.locator('#modalOverlay');
    const cls = await overlay.getAttribute('class') || '';
    expect(cls).not.toContain('open');
  });
});

/**
 * Cria uma banda via API e retorna { id, csrf }.
 * Para plano pago, usa dbQuery para forçar o plano no banco após criação
 * (salvar_banda.php ignora o campo plano por segurança).
 */
async function criarBandaParaTeste(page, nome, plano = 'gratuito') {
  const csrfRes = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfRes.json();
  const res = await page.request.post(API, {
    data: JSON.stringify({ action: 'save', nome, ativo: 1 }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  const { id } = await res.json();
  if (!id) throw new Error(`Falha ao criar banda "${nome}"`);
  if (plano !== 'gratuito') {
    dbQuery('UPDATE bandas SET plano=? WHERE id=?', [plano, id]);
  }
  return { id, csrf };
}

async function deletarBandaViApi(page, id) {
  const csrfRes = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfRes.json();
  await page.request.post(API, {
    data: JSON.stringify({ action: 'delete', id }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
}

for (const plano of ['gratuito', 'mensal']) {
  test.describe(`Exclusão de banda ${plano} pela UI (E2E)`, () => {
    let bandaId = '';
    const nomeBanda = `__BANDA_${plano.toUpperCase()}_DEL_${Date.now()}__`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
      const page = await ctx.newPage();
      ({ id: bandaId } = await criarBandaParaTeste(page, nomeBanda, plano));
      await ctx.close();
    });

    test.afterAll(async ({ browser }) => {
      if (!bandaId) return;
      const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
      const page = await ctx.newPage();
      await deletarBandaViApi(page, bandaId);
      await ctx.close();
    });

    test(`cancelar na confirmação não remove a banda (${plano})`, async ({ page }) => {
      expect(bandaId).toBeTruthy();
      await page.goto('/bandas.php');
      await page.waitForLoadState('networkidle');

      await expect(page.locator(`text=${nomeBanda}`)).toBeVisible({ timeout: 8000 });

      await page.locator('.banda-row', { hasText: nomeBanda })
        .locator('button[title="Deletar"]').click();

      const dialogOverlay = page.locator('.cifro-confirm-overlay');
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 });

      await dialogOverlay.locator('.cifro-confirm-btn--cancel').click();

      await expect(dialogOverlay).not.toBeVisible({ timeout: 2000 });
      await expect(page.locator(`text=${nomeBanda}`)).toBeVisible();
    });

    test(`botão lixeira confirma e remove a banda (${plano})`, async ({ page }) => {
      expect(bandaId).toBeTruthy();
      await page.goto('/bandas.php');
      await page.waitForLoadState('networkidle');

      await expect(page.locator(`text=${nomeBanda}`)).toBeVisible({ timeout: 8000 });

      const deletePromise = page.waitForRequest(req =>
        req.url().includes('salvar_banda.php') && req.method() === 'POST'
      );

      await page.locator('.banda-row', { hasText: nomeBanda })
        .locator('button[title="Deletar"]').click();

      const dialogOverlay = page.locator('.cifro-confirm-overlay');
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 });
      await expect(dialogOverlay.locator('.cifro-confirm-title')).toContainText('Deletar');

      await dialogOverlay.locator('.cifro-confirm-btn--danger').click();

      const deleteReq = await deletePromise;
      const reqBody = JSON.parse(deleteReq.postData() || '{}');
      expect(reqBody.action).toBe('delete');
      expect(reqBody.id).toBe(bandaId);

      await page.waitForLoadState('networkidle');
      await expect(page.locator(`text=${nomeBanda}`)).not.toBeVisible({ timeout: 5000 });

      bandaId = '';
    });
  });
}

test.describe('API de Bandas', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista bandas', async ({ page }) => {
    const res = await page.request.get(API);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: 'Hacker' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST cria banda e deleta', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({
        action: 'save',
        nome: '__BANDA_AUTO_TEST__',
        ativo: 1,
        plano: 'gratuito',
        trial_expira_em: null,
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso).toBeTruthy();

    // Cleanup
    if (body.id) {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST rejeita nome vazio', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: '', ativo: 1, plano: 'gratuito' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const body = await res.json();
    expect(body.sucesso).toBeFalsy();
  });

  test('POST delete sem id e toggle_plano inválido retornam erro de validação', async ({ page }) => {
    const deleteRes = await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await deleteRes.json()).sucesso).toBeFalsy();

    const invalidToggle = await page.request.post(API, {
      data: JSON.stringify({ action: 'toggle_plano', id: 'banda-inexistente', plano: 'invalido' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidToggle.json()).sucesso).toBeFalsy();

    const missingToggle = await page.request.post(API, {
      data: JSON.stringify({ action: 'toggle_plano', id: 'banda-inexistente', plano: 'trial' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const missingBody = await missingToggle.json();
    expect(missingBody.sucesso).toBeFalsy();
    expect(missingBody.mensagem).toContain('confirmação do pagamento');
  });

  test('POST atualiza banda sem permitir alteração direta do plano', async ({ page }) => {
    const id = `__BANDA_UPDATE_${Date.now()}__`;
    const create = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', id, nome: '__BANDA_UPDATE__', logo: null, ativo: 1, plano: 'trial' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await create.json()).sucesso).toBeTruthy();

    const update = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', id, nome: '__BANDA_UPDATE_2__', ativo: 0, plano: 'mensal' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await update.json()).sucesso).toBeTruthy();

    const toggle = await page.request.post(API, {
      data: JSON.stringify({ action: 'toggle_plano', id, plano: 'trial' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await toggle.json()).sucesso).toBeFalsy();

    const all = await (await page.request.get(API)).json();
    const saved = all.find(banda => banda.id === id);
    expect(saved.nome).toBe('__BANDA_UPDATE_2__');
    expect(saved.logo).toBeNull();
    expect(saved.plano).toBe('gratuito');

    await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });
});

test.describe.serial('Criação real de banda pela interface', () => {
  const criadas = [];

  test.afterEach(async ({ page }) => {
    await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: '00000000-0000-4000-8000-000000000002' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrf(page) },
    }).catch(() => {});
  });

  test.afterAll(() => {
    for (const id of criadas) dbQuery('DELETE FROM bandas WHERE id = ?', [id]);
  });

  async function criarPelaTela(page, nome, comLogo) {
    await page.goto('/bandas.php');
    await page.getByRole('button', { name: /Nova Banda/i }).click();
    await page.locator('#bandaNome').fill(nome);
    if (comLogo) {
      await page.locator('#bandaLogoInput').setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      });
      await expect.poll(() => page.locator('#bandaLogoPreview').getAttribute('src')).toMatch(/^data:image\/webp;base64,/);
    }

    const responsePromise = page.waitForResponse(response => response.url().includes('/src/backend/bandas/salvar_banda.php') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Salvar banda/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ sucesso: true });
    expect(body.id).toBeTruthy();
    criadas.push(body.id);
    return body.id;
  }

  async function selecionarEValidarChip(page, id, nome, logoPattern) {
    const response = await page.request.post('/src/backend/bandas/selecionar.php', {
      data: JSON.stringify({ bandaId: id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrf(page) },
    });
    expect(response.status()).toBe(200);
    await page.goto('/index.php');
    const chip = page.locator('.topnav__band-chip');
    await expect(chip).toContainText(nome);
    await expect(chip.locator('.topnav__band-logo')).toHaveAttribute('src', logoPattern);
  }

  test('cria banda sem imagem e persiste logo nulo no banco E2E', async ({ page }) => {
    const nome = `__BANDA_SEM_LOGO_${Date.now()}__`;
    const id = await criarPelaTela(page, nome, false);
    const result = dbQuery('SELECT nome, logo, criador_id FROM bandas WHERE id = ?', [id]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].nome).toBe(nome);
    expect(result.rows[0].logo).toBeNull();
    expect(result.rows[0].criador_id).toBeTruthy();
    await selecionarEValidarChip(page, id, nome, /\/src\/images\/cifro-mark\.svg(?:\?v=\d+)?$/);
  });

  test('cria banda com imagem WebP Base64 e persiste no banco E2E', async ({ page }) => {
    const nome = `__BANDA_COM_LOGO_${Date.now()}__`;
    const id = await criarPelaTela(page, nome, true);
    const result = dbQuery('SELECT nome, logo, criador_id FROM bandas WHERE id = ?', [id]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].nome).toBe(nome);
    expect(result.rows[0].logo).toMatch(/^data:image\/webp;base64,/);
    expect(result.rows[0].logo.length).toBeLessThan(100000);
    expect(result.rows[0].criador_id).toBeTruthy();
    await selecionarEValidarChip(page, id, nome, /^data:image\/webp;base64,/);
  });
});
