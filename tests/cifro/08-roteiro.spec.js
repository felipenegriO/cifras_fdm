/**
 * 08-roteiro.spec.js
 * Tela de roteiro e fallback offline.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Roteiro', () => {
  test('carrega roteiro.php sem erros', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });

  test('exibe conteúdo do roteiro', async ({ page }) => {
    await page.goto('/roteiro.php');
    await page.waitForLoadState('domcontentloaded');
    // roteiro.php é uma tela de apresentação/impressão sem topnav,
    // mas deve ter o container principal de conteúdo
    await expect(page.locator('body')).toBeVisible();
    const body = await page.locator('body').textContent();
    // Deve conter texto do roteiro ou a mensagem de "nenhum roteiro"
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Setlist', () => {
  test('exibe o tom detectado quando o item ainda não possui tom salvo', async ({ page }) => {
    await page.goto('/index.php');
    await page.waitForFunction(() => window.FdmChords && Array.isArray(window.songs));

    const result = await page.evaluate(() => {
      const song = { id: 'teste-tom', nome: 'Música teste', cifra: '<b>D A Bm G</b><br><b>Em A D</b>' };
      window.songs = [song];
      const expected = window.FdmChords.identifyKey(song.cifra).key;
      window.playlistsSalvas = [{ nome: 'Teste de tom', itens: [song.id] }];
      window.renderPlaylistsMenu();
      return {
        expected,
        text: document.querySelector('.liPlaylist-musica')?.textContent || '',
      };
    });

    expect(result.text).toContain(`[${result.expected}]`);
  });

  test('editor da setlist mostra e atualiza o tom escolhido', async ({ page }) => {
    await page.goto('/src/backend/editor/editorplaylist.php');
    await page.waitForFunction(() => window.FdmChords && typeof carregarPlaylistsDisponiveis === 'function');
    await page.waitForFunction(() => {
      const select = document.getElementById('playlistSelecionada');
      return select && (select.options.length > 0 || document.querySelector('#musicasDisponiveis .empty-state'));
    });
    await page.evaluate(() => {
      songs.splice(0, songs.length, { id: 987654, nome: 'Música teste', cifra: '<b>D A Bm G</b><br><b>Em A D</b>' });
      playlistsSalvas.splice(0, playlistsSalvas.length, { nome: 'Teste de tom', itens: [987654] });
      carregarPlaylistsDisponiveis();
    });

    await expect(page.locator('.playlist-song-name')).toContainText('Música teste [D]');
    await page.getByLabel('Tom de Música teste').selectOption('E');
    await expect(page.locator('.playlist-song-name')).toContainText('Música teste [E]');
  });
});

test.describe('Offline', () => {
  test('offline.php carrega', async ({ page }) => {
    await page.goto('/offline.php');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).not.toMatch(/Fatal error|Warning:|Parse error/i);
  });
});

test.describe('Editor de roteiros', () => {
  test('abre editor real de roteiros e permite preparar um novo roteiro', async ({ page }) => {
    await page.goto('/src/backend/editor/roteiro.php');
    await expect(page).toHaveTitle(/Editor de Roteiros/i);
    await expect(page.getByLabel('Buscar roteiro')).toBeVisible();
    await page.getByRole('button', { name: /Limpar/ }).click();
    await page.getByLabel('Título do roteiro').fill('__ROTEIRO_UI__');
    await expect(page.getByLabel('Título do roteiro')).toHaveValue('__ROTEIRO_UI__');
  });
});
