import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function setEditorContent(page, value) {
  await page.evaluate(value => {
    const editor = window.tinymce?.get('cifraInput');
    if (editor) {
      editor.setContent(value);
      editor.fire('change');
    } else {
      const textarea = document.getElementById('cifraInput');
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, value);
}

test('editor cobre biblioteca vazia, busca sem resultado e validações de salvamento', async ({ page }) => {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.songs.splice(0);
    document.getElementById('buscaMusica').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#libraryState')).toContainText('Seu repertório está vazio');

  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toContainText('Digite o nome da música');

  await page.locator('#titulo').fill('Validação vazia');
  await setEditorContent(page, '<span></span><br>');
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toContainText('A cifra está vazia');

  await setEditorContent(page, '<div class="player--music">C</div>');
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toContainText('Limpar colagem');

  await page.evaluate(() => {
    window.songs.push({ id: 90001, nome: 'Outra música', cifra: '<b>C</b>' });
    const search = document.getElementById('buscaMusica');
    search.value = '__sem_resultado__';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#libraryState')).toContainText('Nenhuma música encontrada');
});

test('editor cobre falhas HTTP e de rede ao salvar', async ({ page }) => {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForTimeout(500);
  await page.locator('#titulo').fill('Falha controlada');
  await setEditorContent(page, '<b>C G</b>');

  await page.route('**/src/backend/editor/api.php', route => route.fulfill({
    status: 500,
    contentType: 'text/plain',
    body: 'erro sem json',
  }), { times: 1 });
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toContainText('Erro HTTP 500');

  await page.route('**/src/backend/editor/api.php', route => route.abort(), { times: 1 });
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).not.toHaveText('Salvando...');
  await expect(page.locator('#saveButton')).toBeEnabled();
});

test('editor cobre exclusão sem seleção, cancelada e concluída', async ({ page }) => {
  await page.goto('/src/backend/editor/editor.php');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('deleteSongButton').click());
  await expect(page.locator('#status')).toContainText('Selecione uma música');

  const first = page.locator('#musicas button[data-song-id]').first();
  await first.click();
  await page.evaluate(() => { window.cifroConfirm = async () => false; });
  await page.evaluate(() => document.getElementById('deleteSongButton').click());
  await expect(page.locator('#deleteSongButton')).toBeEnabled();

  await page.evaluate(() => { window.cifroConfirm = async () => true; });
  await page.route('**/src/backend/editor/api.php', async route => {
    const payload = JSON.parse(route.request().postData() || '{}');
    expect(payload.action).toBe('delete');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, content_revision: 1 }),
    });
  }, { times: 1 });
  await page.evaluate(() => { window.cifroSync.sync = async () => false; });
  await page.evaluate(() => document.getElementById('deleteSongButton').click());
  await expect(page.locator('#status')).toContainText('Música excluída com sucesso');
});
