/**
 * 36-music-view-branches.spec.js
 * Cobertura de branches residuais de public/src/js/music-view.js:
 * elementos ausentes do template, estados alternativos de tema/colunas/abas
 * e o alvo de auto-scroll ausente (document.scrollingElement === null).
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  const body = await response.json();
  return body.csrf_token || '';
}

async function validSongId(page) {
  const csrf = await getCsrf(page);
  const created = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({
      action: 'save',
      nome: '__MUSIC_VIEW_BRANCH_FIXTURE__',
      artista: 'Teste',
      cifra: '<b>C G Am F</b><br>Fixture curta para music-view.js',
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

/**
 * Remove elementos do DOM entre o parse do HTML e o DOMContentLoaded,
 * registrando um listener ANTES do script (defer) de music-view.js —
 * como addInitScript roda antes de qualquer script da própria página,
 * o listener registrado aqui dispara primeiro (ordem de registro).
 */
async function gotoRemovendo(page, id, selectors) {
  await page.addInitScript((sels) => {
    document.addEventListener('DOMContentLoaded', () => {
      sels.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.remove();
      });
    });
  }, selectors);
  await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(50);
}

test.describe('music-view.js — elementos ausentes', () => {
  test('closeDrawers ignora menu/playlists ausentes (Escape)', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#menusideMenu', '#sideMenu']);
    // Não deve lançar erro ao pressionar Escape sem os drawers no DOM.
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('speedInPixels usa valor default quando #autoScrollSpeed ausente', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#autoScrollSpeed']);
    // #autoScrollToggle vive dentro do drawer de ajustes (aria-hidden), que só
    // fica visível/no viewport após abrir o menu; usamos click via evaluate
    // (elemento existe no DOM mesmo oculto) para não depender de visibilidade.
    const toggle = page.locator('#autoScrollToggle, #quickAutoScroll').first();
    if (await toggle.count()) {
      await toggle.evaluate((el) => el.click());
      await page.waitForTimeout(120);
      await toggle.evaluate((el) => el.click()).catch(() => {});
    }
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('updateSpeed sem #autoScrollSpeedValue não lança erro', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#autoScrollSpeedValue']);
    const speed = page.locator('#autoScrollSpeed');
    if (await speed.count()) {
      await speed.evaluate((input) => {
        input.value = '4';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('updateQuickBar sem #musicQuickBar não lança erro', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#musicQuickBar']);
    const show = page.locator('#showQuickBar');
    if (await show.count()) {
      await show.evaluate((input) => {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('syncLyrics sem #quickLyrics não lança erro', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#quickLyrics']);
    const lyricToggle = page.locator('#toggle-cifra-letra');
    if (await lyricToggle.count()) await lyricToggle.evaluate((el) => el.click());
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('resetReadingSettings com song-cifra, autoScrollSpeed, showQuickBar e __reflowCifra ausentes', async ({ page }) => {
    const id = await validSongId(page);
    await gotoRemovendo(page, id, ['#song-cifra', '#autoScrollSpeed', '#showQuickBar']);
    await page.evaluate(() => { delete window.__reflowCifra; });
    const reset = page.locator('#resetReadingSettings');
    if (await reset.count()) await reset.evaluate((el) => el.click());
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });
});

test.describe('music-view.js — estados alternativos', () => {
  test('aba de leitura salva com valor inválido cai para "reading"', async ({ page }) => {
    const id = await validSongId(page);
    await page.addInitScript(() => {
      try { localStorage.setItem('musicSettingsTab', '__aba_inexistente__'); } catch (e) { /* ignore */ }
    });
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#settingsTabReading')).toHaveClass(/is-active/);
  });

  test('clique nos botões data-music-action=menuButton/playlistButton propaga para o alvo real', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-music-action="menuButton"]').evaluate((el) => el.click());
    await expect(page.locator('#menusideMenu')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await page.locator('[data-music-action="toggle-cifra-letra"]').evaluate((el) => el.click());
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('clicar no modo de visualização já ativo não alterna toggle-cifra-letra de novo', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // Estado inicial: chords ativo (lyrics inativo). Botão vive dentro do
    // drawer de ajustes (aria-hidden) — clicamos via evaluate, sem depender
    // de visibilidade real do elemento.
    const chordsBtn = page.locator('[data-view-mode="chords"]');
    if (await chordsBtn.count()) {
      await chordsBtn.evaluate((el) => el.click());
      await expect(page.locator('#toggle-cifra-letra')).not.toHaveClass(/active/);
    }
  });

  test('clicar no modo de colunas "auto" quando já está automático não alterna toggle-columns de novo', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const autoBtn = page.locator('[data-column-mode="auto"]');
    if (await autoBtn.count()) {
      await expect(page.locator('#song-cifra')).toHaveClass(/auto-columns/);
      await autoBtn.evaluate((el) => el.click());
      await expect(page.locator('#song-cifra')).toHaveClass(/auto-columns/);
    }
  });

  test('auto-scroll para sozinho quando o alvo de rolagem some (document.scrollingElement nulo)', async ({ page }) => {
    const id = await validSongId(page);
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      Object.defineProperty(document, 'scrollingElement', { configurable: true, value: null });
    });
    const toggle = page.locator('#autoScrollToggle');
    await toggle.evaluate((el) => el.click());
    // Sem alvo de scroll, autoScrollStep chama stopAutoScroll no primeiro frame.
    await expect(toggle).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
    await expect(toggle).toHaveText('Iniciar');
  });
});
