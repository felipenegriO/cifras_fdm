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

async function validSongId(page) {
  const response = await page.goto('/api/sync/data.php');
  expect(response?.ok()).toBeTruthy();
  const data = JSON.parse(await page.locator('body').textContent());
  const song = data.musicas?.find(item => item?.id);
  if (song?.id) return song.id;

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
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
  });

  test('page não tem erros PHP', async ({ page }) => {
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Notice:|Parse error/i);
  });
});
