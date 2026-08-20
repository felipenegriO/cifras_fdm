/**
 * 03-music-view.spec.js
 * Tela de visualização de cifra (music.php).
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  const body = await response.json();
  return body.csrf_token || '';
}

async function validSongId(page, createFresh = true) {
  const response = await page.request.get('/api/sync/data.php');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const song = data.musicas?.find(item => item?.id);
  const fixture = data.musicas?.find(item => item?.nome === '__MUSIC_VIEW_FIXTURE__');
  if (createFresh && fixture?.id) return fixture.id;
  if (!createFresh && song?.id) return song.id;

  const csrf = await getCsrf(page);
  const created = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({
      action: 'save',
      nome: '__MUSIC_VIEW_FIXTURE__',
      artista: 'Teste',
      cifra: '<b>C G Am F</b><br>Fixture real para music.php',
      classificacao: '',
      bit: '',
    }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.id).toBeTruthy();
  return body.id;
}

test.describe('Visualização de Cifra', () => {
  test('carrega music.php sem ID com redirect ou erro tratado', async ({ page }) => {
    const res = await page.goto('/music.php');
    // Pode redirecionar ou mostrar empty state — não deve mostrar Fatal error
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('carrega cifra com ID válido', async ({ page }) => {
    const id = await validSongId(page);
    // Usa domcontentloaded para evitar timeout com CDN scripts (WaveSurfer, SoundTouch)
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page.locator('body')).not.toContainText('Undefined');
    // Ou tem conteúdo de cifra, ou tem mensagem de não encontrado
    const hasCifra = await page.locator('.cifra, .chord, [data-song]').count();
    const hasEmpty = await page.locator('.empty-state, .not-found').count();
    expect(hasCifra + hasEmpty).toBeGreaterThan(0);
  });

  test('link de voltar aparece na tela de cifra', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // music.php tem #backLink (voltar) em vez de topnav completo
    await expect(page.locator('#backLink')).toBeVisible();
  });

  test('música inexistente permite voltar para a home', async ({ page }) => {
    await page.goto('/music.php?id=999999999', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.not-found')).toContainText('Música não encontrada');
    await expect(page.getByRole('link', { name: 'Voltar para a home' })).toHaveAttribute('href', '/index.php');
  });

  test('tom.php carrega sem erro', async ({ page }) => {
    await page.goto('/tom.php');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });
});

test.describe('Controles de Cifra', () => {
  test.beforeEach(async ({ page }) => {
    const id = await validSongId(page, true);
    // Habilita a quick bar antes de navegar (simula usuário com barra de controles ativa)
    await page.addInitScript(() => localStorage.setItem('musicShowQuickBar', '1'));
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.cifroPresentation, { timeout: 10000 });
  });

  test('página carrega sem erros de servidor', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:|Parse error/i);
  });

  test('músico sobe um tom e vê a tonalidade atualizada', async ({ page }) => {
    await page.locator('button[data-music-action="increase-tom"]').first().click();
    // Após transposição, o display deve mostrar o tom atual (não vazio)
    await expect(page.locator('#song-tom-display')).not.toBeEmpty({ timeout: 5000 });
  });

  test('músico desce um tom e vê a tonalidade atualizada', async ({ page }) => {
    await page.locator('button[data-music-action="decrease-tom"]').first().click();
    await expect(page.locator('#song-tom-display')).not.toBeEmpty({ timeout: 5000 });
  });

  test('músico liga e desliga a rolagem automática pela barra de controles', async ({ page }) => {
    // Garante conteúdo alto o suficiente para o scroll não parar imediatamente
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra') || document.body;
      el.style.minHeight = '400vh';
    });
    const btn = page.locator('#quickAutoScroll');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('músico alterna entre visualizar cifra e somente letra', async ({ page }) => {
    const btn = page.locator('#quickLyrics');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('músico entra no modo apresentação pelo menu de ajustes e sai com Escape', async ({ page }) => {
    // O botão fica dentro do drawer de ajustes — abre via #menuButton do header
    await page.locator('#menuButton').click();
    const btn = page.locator('button.music-secondary-action', { hasText: 'Modo apresentação' });
    await expect(btn).toBeVisible({ timeout: 3000 });
    await btn.click();
    await expect(page.locator('body')).toHaveClass(/cifro-presenting/, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cifro-presenting/);
  });
});

test.describe('Barra de controles no celular', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__quickBarTestStarted') === '1') return;
      localStorage.removeItem('musicShowQuickBar');
      sessionStorage.setItem('__quickBarTestStarted', '1');
    });
  });

  test('vem ativada por padrão no primeiro acesso', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#showQuickBar')).toBeChecked();
    await expect(page.locator('#musicQuickBar')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/has-quick-bar/);
  });

  test('lembra quando o usuário desativa e não reserva espaço no rodapé', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#menuButton').click();
    await expect(page.locator('#menusideMenu')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#showQuickBar').uncheck();
    await expect(page.locator('#musicQuickBar')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('musicShowQuickBar'))).toBe('0');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#showQuickBar')).not.toBeChecked();
    await expect(page.locator('#musicQuickBar')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/has-quick-bar/);
    const spacing = await page.evaluate(() => ({
      content: parseFloat(getComputedStyle(document.querySelector('.music-content')).paddingBottom),
      cifra: parseFloat(getComputedStyle(document.getElementById('song-cifra')).paddingBottom),
    }));
    expect(spacing.content).toBeLessThanOrEqual(20);
    expect(spacing.cifra).toBe(0);
  });
});
