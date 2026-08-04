import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`sem overflow horizontal em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ['/index.php', '/config.php', '/plano.php', '/src/backend/editor/editorplaylist.php']) {
      await page.goto(path);
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        headings: document.querySelectorAll('h1').length,
      }));
      expect(metrics.page).toBeLessThanOrEqual(metrics.viewport + 1);
      expect(metrics.headings).toBeGreaterThan(0);
    }
  });
}

test('controles essenciais móveis têm alvo mínimo de 44px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/src/backend/editor/editorplaylist.php');
  const undersized = await page.evaluate(() => [...document.querySelectorAll('button:not([hidden]), input:not([type="hidden"]), select')]
    .filter(element => element.offsetParent !== null)
    .map(element => ({ label: element.getAttribute('aria-label') || element.textContent?.trim() || element.id, rect: element.getBoundingClientRect() }))
    .filter(item => item.rect.width < 44 || item.rect.height < 44));
  expect(undersized).toEqual([]);
});

test('modal de nova setlist controla foco, Escape e atributos ARIA', async ({ page }) => {
  await page.goto('/src/backend/editor/editorplaylist.php');
  const trigger = page.getByRole('button', { name: 'Novo repertório' });
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Novo repertório' });
  const nameInput = dialog.getByLabel('Nome do repertório', { exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(nameInput).toBeFocused();
  await nameInput.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const zoom of [1.25, 1.5, 2]) {
  test(`conteúdo longo permanece responsivo com zoom de ${zoom * 100}%`, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/config.php');
    await page.evaluate(({ scale, text }) => {
      document.documentElement.style.zoom = String(scale);
      const target = document.querySelector('.config-row__desc');
      if (target) target.textContent = text;
    }, {
      scale: zoom,
      text: 'usuario-com-email-e-identificador-extremamente-longos@subdominio.exemplo.com.br',
    });
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(metrics.page).toBeLessThanOrEqual(metrics.viewport + 1);
  });
}
