import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import { fazerLogin, TEST_EMAIL } from '../helpers/auth.js';

const CONFIG_API = '/src/backend/users/salvar_config.php';

async function setHelpPreference(page, disabled) {
  await fazerLogin(page);
  if (page.url() === 'about:blank') await page.goto('/config.php');
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const response = await page.request.post(CONFIG_API, {
    data: JSON.stringify({ config: { ajudaDesativada: disabled } }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.evaluate(value => localStorage.setItem('cifro-ajudaDesativada', value ? 'true' : 'false'), disabled);
}

test.describe.serial('Central de Ajuda', () => {
  test.beforeEach(async ({ page }) => {
    await setHelpPreference(page, false);
  });

  test.afterEach(async ({ page }) => {
    if (page.isClosed()) return;
    await page.goto('/config.php');
    await setHelpPreference(page, false);
  });

  test('abre o catálogo completo, pesquisa, filtra e navega entre guias', async ({ page }) => {
    await page.goto('/ajuda.php');
    await expect(page.getByRole('heading', { name: 'Como podemos ajudar?' })).toBeVisible();
    await expect(page.locator('.help-article-card')).toHaveCount(11);
    expect(await page.evaluate(() => Boolean(window.CifroHelp))).toBe(true);
    await page.locator('[data-help-id="preparar-palco"] summary').click();
    await expect(page.locator('[data-help-id="preparar-palco"] details')).toHaveAttribute('open', '');
    await expect(page.locator('[data-help-id="preparar-palco"] .help-article-body')).toBeVisible();

    await page.locator('#helpSearch').fill('offline');
    await expect(page.locator('.help-article-card:visible')).toHaveCount(2);
    await expect(page.locator('#helpVisibleCount')).toHaveText('2 guias');

    await page.locator('#helpSearch').fill('termo inexistente');
    await expect(page.locator('#helpEmpty')).toBeVisible();

    await page.locator('#helpSearch').fill('');
    await page.getByRole('button', { name: 'Offline', exact: true }).click();
    await expect(page.locator('.help-article-card:visible')).toHaveCount(2);
    await expect(page.locator('#helpFilterFeedback')).toHaveText('Exibindo 2 guias em “Offline”.');

    await page.goto('/ajuda.php?artigo=modo-live');
    await expect(page.locator('[data-help-id="modo-live"] details')).toHaveAttribute('open', '');
    await expect(page.locator('[data-help-id="modo-live"]')).toContainText('Um líder controla');
  });

  // Este caso era um só, com as duas varreduras no mesmo contexto: ~64
  // interações de UI mais o teardown do vídeo não cabiam nos 90s quando a
  // bateria inteira roda. Separado em dois, cada metade cabe com folga e a
  // cobertura continua a mesma.
  async function contextoCelular(browser) {
    const context = await browser.newContext({
      storageState: 'tests/.auth/user.json',
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
    });
    return { context, page: await context.newPage() };
  }

  test('os filtros por categoria respondem ao toque no celular', async ({ browser }) => {
    const { context, page } = await contextoCelular(browser);
    try {
      await page.goto('/ajuda.php');
      const expected = new Map([
        ['Todos', 11], ['Começando', 2], ['Repertórios', 1], ['Offline', 2],
        ['Apresentação', 1], ['Ensaio', 1], ['Conta e banda', 3], ['Cifras', 1],
      ]);
      for (const [category, count] of expected) {
        const button = page.getByRole('button', { name: category, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.help-article-card:visible')).toHaveCount(count);
      }
    } finally {
      await context.close();
    }
  });

  test('todos os guias abrem e fecham ao toque no celular', async ({ browser }) => {
    const { context, page } = await contextoCelular(browser);
    try {
      await page.goto('/ajuda.php');
      await page.getByRole('button', { name: 'Todos', exact: true }).click();
      const guides = page.locator('.help-article-details');
      for (let index = 0; index < await guides.count(); index++) {
        const guide = guides.nth(index);
        await guide.locator('summary').click();
        await expect(guide).toHaveAttribute('open', '');
        await expect(guide.locator('.help-article-body')).toBeVisible();
        await guide.locator('summary').click();
      }
    } finally {
      await context.close();
    }
  });

  test('abre orientação contextual e consulta artigo pela API autenticada', async ({ page, browser }) => {
    await page.goto('/index.php');
    await page.locator('[data-help-article="criar-repertorio"]').evaluate(element => element.click());
    await expect(page.locator('#helpDrawer')).toBeVisible();
    await expect(page.locator('#helpDrawerTitle')).toHaveText('Criar e organizar um repertório');
    await expect(page.locator('#helpDrawerBody')).toContainText('Passos');

    let response = await page.request.get('/api/help/article.php?id=modo-live');
    expect(response.status()).toBe(200);
    const article = await response.json();
    expect(article.ok).toBe(true);
    expect(article.article.id).toBe('modo-live');
    expect(article.article.steps.length).toBeGreaterThan(0);

    response = await page.request.get('/api/help/article.php?id=nao-existe');
    expect(response.status()).toBe(404);

    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    response = await anonymous.request.get('/api/help/article.php?id=modo-live');
    expect(response.status()).toBe(401);
    await anonymous.close();
  });

  test('ajuda contextual do Modo Live segue o layout móvel e abre o guia', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/user.json',
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
    const page = await context.newPage();
    try {
      await page.goto('/index.php');
      await page.locator('#music-list a[href*="music.php?id="]').first().click();
      await page.locator('#menuButton').click();
      await page.getByRole('tab', { name: 'Ao vivo' }).click();
      const help = page.getByRole('button', { name: 'Como funciona o Modo Live?' });
      await expect(help).toBeVisible();
      const layout = await help.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, viewport: innerWidth, display: style.display };
      });
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(layout.viewport);
      expect(layout.width).toBeGreaterThan(180);
      expect(layout.width).toBeLessThan(320);
      expect(layout.height).toBeGreaterThanOrEqual(44);
      expect(layout.display).toBe('flex');
      await help.click();
      await expect(page.locator('#helpDrawer')).toBeVisible();
      await expect(page.locator('#helpDrawerTitle')).toHaveText('Usar o Modo Live');
      await expect(page.locator('#helpDrawerBody')).toContainText('Entrar na sessão');
    } finally {
      await context.close();
    }
  });

  test('registra eventos permitidos e rejeita telemetria inválida', async ({ page }) => {
    await page.goto('/ajuda.php');
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    let response = await page.request.post('/api/help/event.php', {
      data: JSON.stringify({ event: 'guide_completed', article: 'modo-live' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(response.status()).toBe(204);

    response = await page.request.post('/api/help/event.php', {
      data: JSON.stringify({ event: 'evento-invalido' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(response.status()).toBe(422);
  });

  test('desativação na configuração persiste no banco e impede qualquer nova exibição', async ({ page }) => {
    await page.goto('/config.php');
    await expect(page.locator('#cfgHelpEnabled')).toBeChecked();
    await Promise.all([
      page.waitForNavigation(),
      page.locator('#cfgHelpEnabled').locator('..').click(),
    ]);

    await expect(page.locator('#cfgHelpEnabled')).not.toBeChecked();
    await expect(page.locator('[data-help-entry]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cifro-ajudaDesativada'))).toBe('true');

    const persisted = dbQuery(
      "SELECT JSON_UNQUOTE(JSON_EXTRACT(config, '$.ajudaDesativada')) AS ajuda FROM usuarios WHERE email = ? LIMIT 1",
      [TEST_EMAIL],
    );
    expect(persisted.rows[0].ajuda).toBe('true');

    const response = await page.request.get('/ajuda.php');
    expect(response.status()).toBe(404);
    const articleResponse = await page.request.get('/api/help/article.php?id=modo-live');
    expect(articleResponse.status()).toBe(404);
    await page.goto('/index.php');
    await expect(page.locator('[data-help-entry], [data-help-article]')).toHaveCount(0);
  });
});
