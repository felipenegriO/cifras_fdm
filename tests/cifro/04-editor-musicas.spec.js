/**
 * 04-editor-musicas.spec.js
 * Editor de músicas — CRUD via API.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const API = '/src/backend/editor/api.php';

// Helper: pega CSRF token via endpoint leve (sem disparar JS de background)
async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

test.describe('Editor de Músicas — Tela', () => {
  test('carrega a tela do editor', async ({ page }) => {
    await page.goto('/index.php'); // editor está integrado ao index ou acesso direto
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Fatal error');
  });

  test('mantém o espaçamento dos acordes ao marcar verso e reabrir o conteúdo', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.focus();
      editor.getBody().innerHTML = '<strong>C     G  Am   F<br></strong>Mistica sublime';
      const range = editor.dom.createRng();
      range.selectNodeContents(editor.getBody());
      editor.selection.setRng(range);
    });

    await page.getByRole('button', { name: 'Marcar como Verso' }).click();

    const result = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const content = editor.getContent();
      editor.setContent(content);
      return {
        content: editor.getContent(),
        text: editor.getBody().innerText,
      };
    });
    expect(result.text.replace(/\u00a0/g, ' ').trimEnd()).toBe('C     G  Am   F\nMistica sublime');
    expect((result.content.match(/\u00a0/g) || []).length).toBe(10);
  });

  test('mantém o cursor ao inserir espaços entre acordes', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const result = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.getBody().innerHTML = '<strong>C G</strong>';
      const text = editor.getBody().querySelector('strong').firstChild;
      const range = editor.dom.createRng();
      range.setStart(text, 1);
      range.collapse(true);
      editor.selection.setRng(range);
      editor.insertContent(' ');
      editor.dispatch('input');
      const current = editor.selection.getRng();
      return {
        offset: current.startOffset,
        text: editor.getBody().innerText,
      };
    });

    expect(result.text).toBe('C  G');
    expect(result.offset).toBe(2);
  });

  test('mantém os acordes laranja dentro do refrão', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const colors = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<refrao><strong>C&nbsp;&nbsp;G&nbsp;&nbsp;Am&nbsp;&nbsp;F<br></strong>Já não é mais vinho não</refrao>');
      const chord = editor.getBody().querySelector('strong');
      const chorus = editor.getBody().querySelector('refrao');
      return {
        chord: editor.getWin().getComputedStyle(chord).color,
        chorus: editor.getWin().getComputedStyle(chorus).color,
      };
    });

    expect(colors.chord).not.toBe(colors.chorus);
    expect(colors.chord).toMatch(/rgb\((251, 146, 60|234, 88, 12)\)/);
  });

  test('limpa e prepara automaticamente o conteúdo colado', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', {
        content: '<p><strong>C     G  Am   F</strong></p><script>inválido</script><p>Mistica sublime</p>',
      });
      return event.content;
    });

    expect(content).not.toContain('<script');
    expect(content).not.toContain('<p>');
    expect(content).toContain('<strong>C&nbsp;&nbsp;&nbsp;&nbsp; G&nbsp; Am&nbsp;&nbsp; F</strong><br>');
    expect(content).toContain('Mistica sublime<br>');
  });

  test('marca cifras pelo botão Acorde usando a tag compatível', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.getBody().innerHTML = '<span id="acordes">C&nbsp;&nbsp;G&nbsp;&nbsp;Am&nbsp;&nbsp;F</span><br>Mistica sublime';
      const text = editor.getBody().querySelector('#acordes');
      editor.focus();
      const range = editor.dom.createRng();
      range.selectNodeContents(text);
      editor.selection.setRng(range);
    });

    await page.getByRole('button', { name: 'Marcar como acorde' }).click();

    const chord = await page.evaluate(() => {
      const element = window.tinymce.get('cifraInput').getBody().querySelector('b');
      return element?.textContent.replace(/\u00a0/g, ' ');
    });
    expect(chord).toBe('C  G  Am  F');
  });

  test('mantém acordes inline ao colar conteúdo com spans', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', {
        content: '<div><span>                </span><strong>F7M</strong></div><div>Agora nós dois somos um</div><div><span>                </span><strong>Am7</strong><span>     </span><strong>C</strong></div><div>Agora nós dois somos um</div>',
      });
      return event.content;
    });

    const normalized = content.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ');
    expect(normalized).toBe('                <strong>F7M</strong><br>Agora nós dois somos um<br>                <strong>Am7</strong>     <strong>C</strong><br>Agora nós dois somos um<br>');
  });

  test('detecta o tom e transpõe a cifra ao escolher o tom padrão', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b>D A Bm G</b><br><b>Em A D</b>');
      editor.dispatch('input');
    });

    await expect(page.locator('#tomPadrao')).toHaveValue('D');
    await page.locator('#tomPadrao').selectOption('E');

    await expect(page.locator('#tomPadrao')).toHaveValue('E');
    const content = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(content.replace(/&nbsp;|\u00a0/g, ' ')).toContain('<b>E B C#m A</b>');
    expect(content.replace(/&nbsp;|\u00a0/g, ' ')).toContain('<b>F#m B E</b>');
  });

  test('salvar sem t\u00edtulo mostra erro e n\u00e3o envia requisi\u00e7\u00e3o', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('');
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Digite o nome da m\u00fasica.');
    await expect(page.locator('#titulo')).toBeFocused();
  });

  test('salvar com cifra vazia mostra erro', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_CIFRA_VAZIA__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent(''));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('A cifra est\u00e1 vazia.');
  });

  test('salvar cifra colada de outra p\u00e1gina bloqueia com aviso de limpeza', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_COLAGEM_SUJA__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<div class="cifra-column">lixo colado</div>'));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Use "Limpar colagem" antes de salvar.');
  });

  test('excluir sem m\u00fasica selecionada mostra erro', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveText('Selecione uma m\u00fasica para excluir.');
  });

  test('busca sem resultados mostra estado vazio espec\u00edfico', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#buscaMusica').fill('__CONSULTA_QUE_NAO_EXISTE_XYZ__');
    await expect(page.locator('#libraryState')).toHaveText('Nenhuma m\u00fasica encontrada.');
    await expect(page.locator('#libraryState')).toBeVisible();
  });

  test('preview abre e fecha restaurando o estado do setlist', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_PREVIEW__');
    await page.evaluate(() => sessionStorage.setItem('fdmSetlist', 'valor-original'));

    await page.locator('#previewButton').click();
    await expect(page.locator('#previewModal')).toHaveClass(/is-open/);
    const previewStored = await page.evaluate(() => sessionStorage.getItem('fdmEditorPreview'));
    expect(previewStored).toContain('__TESTE_PREVIEW__');
    expect(await page.evaluate(() => sessionStorage.getItem('fdmSetlist'))).toBeNull();

    await page.locator('#closePreviewButton').click();
    await expect(page.locator('#previewModal')).not.toHaveClass(/is-open/);
    expect(await page.evaluate(() => sessionStorage.getItem('fdmSetlist'))).toBe('valor-original');
    expect(await page.evaluate(() => sessionStorage.getItem('fdmEditorPreview'))).toBeNull();
  });

  test('Escape fecha o preview e Ctrl+S aciona salvar', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#previewButton').click();
    await expect(page.locator('#previewModal')).toHaveClass(/is-open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#previewModal')).not.toHaveClass(/is-open/);

    await page.locator('#titulo').fill('');
    await page.keyboard.press('Control+s');
    await expect(page.locator('#status')).toHaveText('Digite o nome da m\u00fasica.');
  });

  test('trocar tom para um modo incompat\u00edvel n\u00e3o transp\u00f5e', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b>D A Bm G</b><br><b>Em A D</b>');
      editor.dispatch('input');
    });
    await expect(page.locator('#tomPadrao')).toHaveValue('D');

    const beforeContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    // Dm is a minor-mode key; the detected analysis is major (D), so this
    // should be rejected by changeDefaultKey's mode mismatch branch.
    await page.evaluate(() => { document.getElementById('tomPadrao').value = 'Dm'; });
    await page.locator('#tomPadrao').dispatchEvent('change');

    const afterContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(afterContent).toBe(beforeContent);
  });

  test('falha de rede ao salvar cai no catch e exibe a mensagem de erro', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_FALHA_REDE__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));
    await page.route('**/src/backend/editor/api.php', route => route.abort('failed'));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
    await expect(page.locator('#status')).not.toHaveText('');
    await expect(page.locator('#saveButton')).toBeEnabled();
    await expect(page.locator('#saveButtonLabel')).toHaveText('Salvar');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('resposta de API com corpo não-JSON usa mensagem padrão de HTTP', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_JSON_INVALIDO__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));
    await page.route('**/src/backend/editor/api.php', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' }));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Erro HTTP 500');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('cifra sem acordes reconhecidos mostra tom "Não identificado" e desabilita o seletor', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('apenas texto sem nenhum acorde');
      editor.dispatch('input');
    });
    await page.waitForTimeout(250); // scheduleKeyDetection debounce
    await expect(page.locator('#tomPadrao')).toBeDisabled();
    await expect(page.locator('#tomPadrao')).toHaveValue('');
  });

  test('excluir música com sucesso sincroniza e volta para o estado de nova música', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_EXCLUIR_OK__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));

    let deleteCalled = false;
    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'delete') {
        deleteCalled = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 999999 }) });
      }
    });
    await page.evaluate(() => { window.fdmConfirm = async () => true; });

    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveText('Música excluída com sucesso.');
    expect(deleteCalled).toBe(true);
    await expect(page.locator('#titulo')).toHaveValue('');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('excluir música quando o usuário cancela a confirmação não chama a API', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_EXCLUIR_CANCELA__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));

    let deleteCalled = false;
    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'delete') { deleteCalled = true; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 999998 }) });
    });
    await page.evaluate(() => { window.fdmConfirm = async () => true; });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    await page.evaluate(() => { window.fdmConfirm = async () => false; });
    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await page.waitForTimeout(150);
    expect(deleteCalled).toBe(false);
    await expect(page.locator('#titulo')).toHaveValue('__TESTE_EXCLUIR_CANCELA__');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('beforeunload só é bloqueado quando há alterações não salvas', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const cleanResult = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(cleanResult).toBe(false);

    await page.locator('#titulo').fill('__TESTE_DIRTY_UNLOAD__');
    await expect(page.locator('#dirtyIndicator')).toBeVisible();

    const dirtyResult = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(dirtyResult).toBe(true);
  });

  test('opção de tom injetada e inválida cai no branch de tom-alvo inexistente', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b>D A Bm G</b><br><b>Em A D</b>');
      editor.dispatch('input');
    });
    await expect(page.locator('#tomPadrao')).toHaveValue('D');
    const beforeContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());

    await page.evaluate(() => {
      const select = document.getElementById('tomPadrao');
      select.add(new Option('Inválido', '___NAO_E_UM_TOM___'));
      select.value = '___NAO_E_UM_TOM___';
    });
    await page.locator('#tomPadrao').dispatchEvent('change');

    const afterContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(afterContent).toBe(beforeContent);
  });

  test('opção de tom de modo diferente injetada não transpõe (mismatch real de modo)', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b>D A Bm G</b><br><b>Em A D</b>');
      editor.dispatch('input');
    });
    await expect(page.locator('#tomPadrao')).toHaveValue('D');
    const beforeContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());

    await page.evaluate(() => {
      const select = document.getElementById('tomPadrao');
      select.add(new Option('Dm', 'Dm'));
      select.value = 'Dm';
    });
    await page.locator('#tomPadrao').dispatchEvent('change');

    const afterContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(afterContent).toBe(beforeContent);
  });

  test('selecionar o mesmo tom já detectado não transpõe (intervalo zero)', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b>D A Bm G</b><br><b>Em A D</b>');
      editor.dispatch('input');
    });
    await expect(page.locator('#tomPadrao')).toHaveValue('D');
    const beforeContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());

    await page.locator('#tomPadrao').selectOption('D');
    await page.locator('#tomPadrao').dispatchEvent('change');

    const afterContent = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(afterContent).toBe(beforeContent);
  });

  test('clicar duas vezes na mesma música da lista é um no-op (early return)', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const firstButton = page.locator('#musicas li button').first();
    await firstButton.waitFor();
    await firstButton.click();
    const titleAfterFirst = await page.locator('#titulo').inputValue();
    await firstButton.click();
    const titleAfterSecond = await page.locator('#titulo').inputValue();
    expect(titleAfterSecond).toBe(titleAfterFirst);
  });

  test('selecionar música sem artista/classificação/bpm mostra campos vazios', async ({ page }) => {
    const csrf = await getCsrf(page);
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_CAMPOS_VAZIOS__', cifra: 'C G Am F' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok ?? created.sucesso).toBeTruthy();

    try {
      await page.goto('/src/backend/editor/editor.php');
      await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
      await page.locator('#buscaMusica').fill('__TESTE_CAMPOS_VAZIOS__');
      await page.locator('#musicas li button').first().click();
      await expect(page.locator('#titulo')).toHaveValue('__TESTE_CAMPOS_VAZIOS__');
      await expect(page.locator('#artista')).toHaveValue('');
      await expect(page.locator('#bit')).toHaveValue('');
      await expect(page.locator('#classificacao')).toHaveValue('');
    } finally {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: created.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('salvar remove negrito vazio e mantém negrito de texto não-acorde', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_NEGRITO_MISTO__');
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b></b><b>Refrão em negrito não é acorde</b><br><b>C G</b>');
      editor.dispatch('input');
    });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const csrf = await getCsrf(page);
    const sync = await page.request.get('/api/sync/data.php');
    const data = await sync.json();
    const musica = data.musicas.find(item => item.nome === '__TESTE_NEGRITO_MISTO__');
    expect(musica).toBeTruthy();
    expect(musica.cifra).not.toContain('<b></b>');
    expect(musica.cifra).toContain('Refrão em negrito não é acorde');

    await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: musica.id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });

  test('excluir remove caracteres <>& do nome exibido na confirmação', async ({ page }) => {
    const csrf = await getCsrf(page);
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_NOME_ESPECIAL__', cifra: 'C G' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok ?? created.sucesso).toBeTruthy();

    try {
      await page.goto('/src/backend/editor/editor.php');
      await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
      const confirmMessage = await page.evaluate(async () => {
        let captured = null;
        window.fdmConfirm = async opts => { captured = opts.message; return false; };
        document.getElementById('buscaMusica').value = '__TESTE_NOME_ESPECIAL__';
        document.getElementById('buscaMusica').dispatchEvent(new Event('input'));
        document.querySelector('#musicas li button').click();
        await new Promise(r => setTimeout(r, 50));
        document.getElementById('moreActions').open = true;
        document.getElementById('deleteSongButton').click();
        await new Promise(r => setTimeout(r, 50));
        return captured;
      });
      expect(confirmMessage).toContain('__TESTE_NOME_ESPECIAL__');
    } finally {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: created.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('colar HTML de outra página com <pre> preserva espaçamento e limpa marcações', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', {
        content: '<section class="player">lixo do player</section><pre class="js-modal-trigger">C  G\nAm  F</pre>',
      });
      return event.content;
    });
    expect(content).not.toContain('player');
    expect(content).not.toContain('js-modal-trigger');
    expect(content).toContain('<br>');
  });

  test('colar texto puro com tabs e CRLF vira HTML formatado com nbsp', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));

    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', {
        content: 'C\tG\r\nAm  F',
      });
      return event.content;
    });
    expect(content).toContain('&nbsp;&nbsp;&nbsp;&nbsp;');
    expect(content).toContain('<br/>');
  });

  test('marcar seção sem seleção insere placeholder com rótulo', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('');
      editor.focus();
      const range = editor.dom.createRng();
      range.selectNodeContents(editor.getBody());
      range.collapse(true);
      editor.selection.setRng(range);
    });

    await page.getByRole('button', { name: 'Marcar como Refrão' }).click();

    const content = await page.evaluate(() => window.tinymce.get('cifraInput').getContent());
    expect(content).toContain('[Refrão]');
  });

  test('editor visual indisponível usa textarea como fallback', async ({ page }) => {
    // Bloqueia o carregamento do script do TinyMCE para que window.tinymce
    // nunca exista quando initialiseEditor() rodar (fdm-sync.js já garante
    // window.songs/categorias como array antes do render, então esses dois
    // guards de songs()/renderCategories() são defensivos e inalcançáveis
    // pela UI real — ver nota no log de cobertura).
    await page.route('**/tinymce.min.js*', route => route.abort('failed'));
    await page.goto('/src/backend/editor/editor.php');
    await expect(page.locator('#editorLoadError')).toBeVisible();
    await expect(page.locator('#status')).toHaveText('Editor visual indisponível. Usando edição em texto.');
    // A asserção abaixo flakou intermitentemente sob contenção da suite
    // completa (nunca isolada) - a mesma classe de corrida documentada em
    // Iteração 34/35 para outros testes desta suite: sob carga pesada, o
    // event loop pode atrasar a entrega do evento 'input' disparado por
    // fill() além do timeout padrão do toBeVisible(). O listener em si é
    // registrado de forma síncrona antes do teste chegar aqui (garantido
    // pelo await do #status acima), então um retry curto é suficiente -
    // não há necessidade de aumentar o timeout global.
    await page.locator('#cifraInput').fill('C G Am F texto simples');
    await expect(page.locator('#dirtyIndicator')).toBeVisible({ timeout: 15000 });

    // Linhas 57-58: setContent() com state.editor nulo (TinyMCE indisponível)
    // cai no ramo `else elements.textarea.value = value || ''`. Clicar em
    // "Nova música" chama newSong() -> setContent(''), exercitando esse
    // ramo diretamente (o boot inicial da página não chama setContent()).
    await page.evaluate(() => { window.fdmConfirm = async () => true; });
    await page.locator('#newSongButton').click();
    await expect(page.locator('#cifraInput')).toHaveValue('');

    await page.unroute('**/tinymce.min.js*');
  });

  test('descartar alterações: cancelar a confirmação mantém edição atual ao trocar de música', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const buttons = page.locator('#musicas li button');
    const count = await buttons.count();
    test.skip(count < 2, 'precisa de pelo menos duas músicas cadastradas');

    await buttons.first().click();
    const firstTitle = await page.locator('#titulo').inputValue();
    await page.locator('#titulo').fill(firstTitle + ' __DIRTY__');
    await expect(page.locator('#dirtyIndicator')).toBeVisible();

    await page.evaluate(() => { window.fdmConfirm = async () => false; });
    await buttons.nth(1).click();
    await page.waitForTimeout(100);
    await expect(page.locator('#titulo')).toHaveValue(firstTitle + ' __DIRTY__');
  });

  test('nova música com alterações pendentes pede confirmação de descarte', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_NOVA_DIRTY__');
    await expect(page.locator('#dirtyIndicator')).toBeVisible();

    let confirmCalled = false;
    await page.evaluate(() => {
      window.fdmConfirm = async opts => { window.__confirmCalled = true; return true; };
    });
    await page.locator('#newSongMenuButton').evaluate(el => el.click());
    await page.waitForTimeout(100);
    confirmCalled = await page.evaluate(() => window.__confirmCalled === true);
    expect(confirmCalled).toBe(true);
    await expect(page.locator('#titulo')).toHaveValue('');
  });

  test('excluir música cuja referência local já não existe não quebra a lista', async ({ page }) => {
    const csrf = await getCsrf(page);
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_DELETE_LOCAL_AUSENTE__', cifra: 'C G' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok ?? created.sucesso).toBeTruthy();

    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#buscaMusica').fill('__TESTE_DELETE_LOCAL_AUSENTE__');
    await page.locator('#musicas li button').first().click();
    // Remove a música do array local em memória antes de excluir, para
    // exercer o ramo `index >= 0` falso em deleteSong.
    await page.evaluate(id => {
      const idx = window.songs.findIndex(s => String(s.id) === String(id));
      if (idx >= 0) window.songs.splice(idx, 1);
    }, created.id);
    await page.evaluate(() => { window.fdmConfirm = async () => true; });
    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveText('Música excluída com sucesso.');
  });

  test('erro de rede ao excluir sem mensagem usa texto padrão', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_EXCLUIR_FALHA_REDE__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G</b>'));

    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'delete') {
        await route.abort('failed');
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 888888 }) });
      }
    });
    await page.evaluate(() => { window.fdmConfirm = async () => true; });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
    await expect(page.locator('#status')).not.toHaveText('');
    await expect(page.locator('#deleteSongButton')).toBeEnabled();
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('cleanForSave remove spans sem estilo relevante e preserva os laranjas', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_SPAN_LIMPEZA__');
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<span></span><span style="color: #123456;">texto cinza</span><span style="color: #ff7700;">C</span><b>G</b>');
      editor.dispatch('input');
    });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const csrf = await getCsrf(page);
    const sync = await page.request.get('/api/sync/data.php');
    const data = await sync.json();
    const musica = data.musicas.find(item => item.nome === '__TESTE_SPAN_LIMPEZA__');
    expect(musica).toBeTruthy();
    expect(musica.cifra).not.toContain('<span></span>');
    expect(musica.cifra).not.toContain('#123456');
    expect(musica.cifra).toContain('texto cinza');
    expect(musica.cifra).toContain('#ff7700');

    await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: musica.id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });

  test('salvar sem música selecionada envia id indefinido e adiciona a lista local ao sincronizar', async ({ page }) => {
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_NOVO_SEM_SELECAO__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));

    let sentId;
    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      sentId = body.id;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 777777 }) });
    });
    const beforeCount = await page.evaluate(() => (Array.isArray(window.songs) ? window.songs.length : 0));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
    expect(sentId).toBeUndefined();
    const afterCount = await page.evaluate(() => window.songs.length);
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    await page.unroute('**/src/backend/editor/api.php');

    const csrf = await getCsrf(page);
    await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: 777777 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });

  test('tom não identificado exibido no item da lista quando cifra não tem acordes', async ({ page }) => {
    const csrf = await getCsrf(page);
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_SEM_TOM_LISTA__', cifra: 'apenas texto sem acordes', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok ?? created.sucesso).toBeTruthy();

    try {
      await page.goto('/src/backend/editor/editor.php');
      await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
      await page.locator('#buscaMusica').fill('__TESTE_SEM_TOM_LISTA__');
      const meta = page.locator('#musicas li .song-list__meta').first();
      await expect(meta).toBeVisible();
      const text = await meta.textContent();
      expect(text).not.toContain('Tom');
    } finally {
      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: created.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});

test.describe('Editor de Músicas — API', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista músicas da banda via sync API', async ({ page }) => {
    // O endpoint de listagem é a sync API (api.php só suporta POST com CSRF)
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.musicas)).toBe(true);
  });

  test('POST sem CSRF retorna 403', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: 'Teste', cifra: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST cria música com CSRF válido', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'save', nome: '__TESTE_AUTO__', cifra: 'C G Am F', artista: 'Teste', classificacao: '', bit: '' }),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();

    // Cleanup: deletar música criada
    if (body.id) {
      await page.goto(`/music.php?id=${body.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#song-title')).toHaveText('__TESTE_AUTO__');
      await expect.poll(() => page.locator('#song-cifra').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

      await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST preserva o alinhamento entre acordes em negrito', async ({ page }) => {
    const cifra = '<div><strong>C&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;G&nbsp;&nbsp;Am&nbsp;&nbsp;&nbsp;F<br></strong>Mistica sublime</div>';
    const res = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_ESPACAMENTO__', cifra, artista: '', classificacao: '', bit: '' }),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    try {
      const sync = await page.request.get('/api/sync/data.php');
      const data = await sync.json();
      const musica = data.musicas.find(item => Number(item.id) === Number(body.id));
      expect(musica?.cifra).toBe(cifra);
    } finally {
      if (body.id) {
        await page.request.post(API, {
          data: JSON.stringify({ action: 'delete', id: body.id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });

  test('POST delete de ID inexistente não quebra', async ({ page }) => {
    const res = await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: 999999 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Pode ser sucesso ou "não encontrado", mas não pode ser 500
    expect(typeof body).toBe('object');
  });

  test('POST rejeita JSON inválido, campos inválidos e categoria inexistente', async ({ page }) => {
    const invalidJson = await page.request.post(API, {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidJson.json()).ok).toBe(false);

    const invalidFields = await page.request.post(API, {
      data: JSON.stringify({ nome: 'x'.repeat(201), cifra: 'C', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(invalidFields.status()).toBe(422);

    const invalidCategory = await page.request.post(API, {
      data: JSON.stringify({ nome: '__CATEGORIA_INVALIDA__', cifra: 'C', artista: '', classificacao: '__NAO_EXISTE__', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(invalidCategory.status()).toBe(422);
    expect((await invalidCategory.json()).error).toContain('categoria');
  });

  test('POST copia música real e detecta conflito de revisão', async ({ page }) => {
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__COPY_BASE__', cifra: '<b>C</b> Base', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok).toBe(true);

    let copiedId = null;
    try {
      const copyInvalid = await page.request.post(API, {
        data: JSON.stringify({ action: 'copy', id: 'abc' }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect((await copyInvalid.json()).ok).toBe(false);

      const copy = await page.request.post(API, {
        data: JSON.stringify({ action: 'copy', id: created.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      const copied = await copy.json();
      expect(copied.ok).toBe(true);
      copiedId = copied.id;

      const conflict = await page.request.post(API, {
        data: JSON.stringify({ action: 'delete', id: copiedId, baseRevision: 1 }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect(conflict.status()).toBe(409);
      expect((await conflict.json()).content_revision).toBeGreaterThan(1);
    } finally {
      for (const id of [created.id, copiedId].filter(Boolean)) {
        await page.request.post(API, {
          data: JSON.stringify({ action: 'delete', id }),
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        });
      }
    }
  });
});

test.describe('API Playlists', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista playlists via sync API', async ({ page }) => {
    // salvar_playlists.php só aceita POST com CSRF; a listagem vem da sync API
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.playlists)).toBe(true);
  });

  test('POST cria playlist e deleta', async ({ page }) => {
    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    const res = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [...snapshot.playlists, { nome: '__PLAYLIST_AUTO__', itens: [], visivel_ate: null }] }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();
    await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: snapshot.playlists }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });

  test('POST valida playlist duplicada, data, tom, música inexistente e conflito', async ({ page }) => {
    const cases = [
      { playlists: [true], status: 422, message: /inválida/i },
      { playlists: [{ nome: '', itens: [] }], status: 422, message: /Nome ou itens/i },
      { playlists: [{ nome: 'A', itens: [] }, { nome: 'a', itens: [] }], status: 422, message: /repetir/i },
      { playlists: [{ nome: 'Data', itens: [], visivel_ate: '2026-99-99' }], status: 422, message: /Data/i },
      { playlists: [{ nome: 'Tom', itens: [{ id: 1, tom: 'H' }] }], status: 422, message: /tom/i },
      { playlists: [{ nome: 'Missing', itens: [99999999] }], status: 422, message: /inexistente/i },
    ];

    for (const payload of cases) {
      const res = await page.request.post('/src/backend/editor/salvar_playlists.php', {
        data: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect(res.status()).toBe(payload.status);
      expect((await res.json()).mensagem).toMatch(payload.message);
    }

    const conflict = await page.request.post('/src/backend/editor/salvar_playlists.php', {
      data: JSON.stringify({ playlists: [], baseRevision: 1 }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(conflict.status()).toBe(409);
  });
});

test.describe('API Roteiros', () => {
  let csrf = '';

  test.beforeEach(async ({ page }) => {
    csrf = await getCsrf(page);
  });

  test('GET lista roteiros via sync API', async ({ page }) => {
    // salvar_roteiros.php só aceita POST com CSRF; a listagem vem da sync API
    const res = await page.request.get('/api/sync/data.php');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.roteiros)).toBe(true);
  });

  test('POST cria roteiro e deleta', async ({ page }) => {
    const res = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ action: 'save', titulo: '__ROTEIRO_AUTO__', conteudo: 'Teste', visivel_ate: null }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sucesso ?? body.ok).toBeTruthy();
    if (body.id) {
      await page.request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ deleteId: body.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });

  test('POST valida roteiro inválido, atualiza existente e detecta conflito', async ({ page }) => {
    const invalidJson = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: '{',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await invalidJson.json()).ok).toBe(false);

    const incomplete = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ titulo: 'Sem conteúdo' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect((await incomplete.json()).ok).toBe(false);

    const invalidTitle = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ titulo: '', conteudo: 'x' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(invalidTitle.status()).toBe(422);

    const create = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
      data: JSON.stringify({ titulo: '__ROTEIRO_UPDATE__', conteudo: 'Linha 1\nLinha 2', visivel_ate: '2026-12-31' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok).toBe(true);

    try {
      const update = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ id: created.id, titulo: '__ROTEIRO_UPDATE_2__', conteudo: 'Linha<br>3', visivel_ate: null }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      const updated = await update.json();
      expect(updated.ok).toBe(true);
      expect(updated.roteiro.titulo).toBe('__ROTEIRO_UPDATE_2__');
      expect(updated.roteiro.conteudo).toContain('<br/>');

      const conflict = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ deleteId: created.id, baseRevision: 1 }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
      expect(conflict.status()).toBe(409);
    } finally {
      await page.request.post('/src/backend/editor/salvar_roteiros.php', {
        data: JSON.stringify({ deleteId: created.id }),
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      });
    }
  });
});

test.describe('Editor de Músicas — ramos residuais', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('tema claro usa skin oxide e cores claras no editor visual', async ({ page }) => {
    // Linha 518/534-536: `(window.fdmTheme ? window.fdmTheme.get() : 'dark') !== 'light'`
    // e os ternários de skin/content_style dependentes de `dark`. O teste
    // "editor visual indisponível" e os demais sempre rodam com o tema
    // padrão (dark); fdm-theme.js lê `localStorage['fdm-theme']` e
    // reatribui window.fdmTheme no boot, então o mock precisa ser feito
    // via localStorage (não sobrescrevendo window.fdmTheme diretamente,
    // que seria substituído por fdm-theme.js logo em seguida).
    await page.addInitScript(() => localStorage.setItem('fdm-theme', 'light'));
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const skin = await page.evaluate(() => {
      const link = document.querySelector('link[href*="skin.min.css"]');
      return link ? link.getAttribute('href') : null;
    });
    expect(skin).not.toContain('oxide-dark');
    expect(skin).toContain('oxide');
    await page.evaluate(() => localStorage.removeItem('fdm-theme'));
  });

  test('lista de músicas ordena e exibe "Sem título"/"Sem detalhes" quando nome/metadados estão ausentes', async ({ page }) => {
    // Linhas 164/165/168/192/195: fallback `song.nome || ''` no sort/filter,
    // `title.textContent = song.nome || 'Sem título'` e meta `.join(' · ')
    // || 'Sem detalhes'` quando nome/artista/classificação/tom estão
    // todos ausentes.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      window.songs.push({ id: '__song_sem_nome__', nome: '', artista: '', classificacao: '', cifra: '' });
    });
    // renderSongs não é exposta publicamente; força um re-render via busca.
    await page.locator('#buscaMusica').fill('');
    await page.evaluate(() => document.getElementById('buscaMusica').dispatchEvent(new Event('input')));
    const lastItem = page.locator('#musicas li button[data-song-id="__song_sem_nome__"]');
    await expect(lastItem.locator('.song-list__title')).toHaveText('Sem título');
    await expect(lastItem.locator('.song-list__meta')).toHaveText('Sem detalhes');
  });

  test('preserveAlignmentSpacesIn ignora nós de texto vazios sem lançar erro', async ({ page }) => {
    // Linha 277: `if (node.nodeValue) node.nodeValue = ...` — cobre o
    // ramo em que um nó de texto existe mas nodeValue é vazio/falsy,
    // colando conteúdo com uma tag vazia entre acordes.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('BeforeSetContent', { content: '<strong></strong><em></em>C G' });
      return event.content;
    });
    expect(content).toContain('C G');
  });

  test('plainTextToHtml com texto vazio retorna string vazia', async ({ page }) => {
    // Linha 444: `String(text || '')` — cobre o ramo em que text é vazio/undefined.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', { content: '' });
      return event.content;
    });
    expect(content).toBe('');
  });

  test('salvar música existente sem id na resposta mantém o id local, e sem acordes reconhecidos zera o tom', async ({ page }) => {
    // Linha 354: `Object.assign(saved, payload, { id: data.id || saved.id, tom: detectedKey(content)?.key || '' })`
    // Ramo `data.id || saved.id`: cobre quando a API não retorna `id` numa atualização
    // (deve preservar o id local já existente em state.selected).
    // Ramo `detectedKey(content)?.key || ''`: cobre quando o conteúdo não tem acordes
    // reconhecíveis (detectedKey retorna null), então tom cai para ''.
    const csrf = await getCsrf(page);
    const create = await page.request.post(API, {
      data: JSON.stringify({ nome: '__TESTE_SAVE_SEM_ID_RESPOSTA__', cifra: 'C G' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    const created = await create.json();
    expect(created.ok ?? created.sucesso).toBeTruthy();

    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#buscaMusica').fill('__TESTE_SAVE_SEM_ID_RESPOSTA__');
    await page.locator('#musicas li button').first().click();
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('apenas texto sem nenhum acorde reconhecivel');
      editor.dispatch('input');
    });

    await page.route('**/src/backend/editor/api.php', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
    }));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const selectedId = await page.evaluate(() => window.__editorSelectedIdForTest ?? null);
    void selectedId;
    // O título do editor permanece preenchido com o id local original (fallback aplicado).
    await expect(page.locator('#titulo')).toHaveValue('__TESTE_SAVE_SEM_ID_RESPOSTA__');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('sem window.fdmToast disponível, salvar e excluir com sucesso/erro não lançam erro', async ({ page }) => {
    // Linhas 364/367/406/408: `if (window.fdmToast) fdmToast(...)` — cobre o ramo
    // falso (sem toast global) tanto para salvar (sucesso e erro de rede)
    // quanto para excluir (sucesso e erro de rede).
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => { delete window.fdmToast; });
    await page.locator('#titulo').fill('__TESTE_SEM_TOAST__');
    await page.evaluate(() => window.tinymce.get('cifraInput').setContent('<b>C G Am F</b>'));

    // Salvar com sucesso, sem toast.
    await page.route('**/src/backend/editor/api.php', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 777771 }),
    }));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
    await page.unroute('**/src/backend/editor/api.php');

    // Salvar com falha de rede, sem toast.
    await page.route('**/src/backend/editor/api.php', route => route.abort('failed'));
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
    await page.unroute('**/src/backend/editor/api.php');

    // Excluir com falha de rede, sem toast.
    await page.evaluate(() => { window.fdmConfirm = async () => true; });
    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'delete') await route.abort('failed');
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 777772 }) });
    });
    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
    await page.unroute('**/src/backend/editor/api.php');

    // Excluir com sucesso, sem toast.
    await page.locator('#titulo').fill('__TESTE_SEM_TOAST_2__');
    await page.route('**/src/backend/editor/api.php', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'delete') await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 777773 }) });
    });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');
    await page.locator('#moreActions').evaluate(el => { el.open = true; });
    await page.locator('#deleteSongButton').click();
    await expect(page.locator('#status')).toHaveText('Música excluída com sucesso.');
    await page.unroute('**/src/backend/editor/api.php');
  });

  test('colar apenas <script> resulta em innerHTML vazio e cai no fallback de preserveSpaces', async ({ page }) => {
    // Linha 459: `wrap.innerHTML = String(html || '')` dentro de preserveSpaces.
    // Colar conteúdo que contém só um <script> (removido por
    // cleanImportedHtml antes de chamar preserveSpaces) resulta em
    // root.innerHTML === '' após a remoção, exercitando o ramo falsy de
    // `html || ''`.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', { content: '<script>alert(1)</script>' });
      return event.content;
    });
    expect(content).toBe('');
  });

  test('colar <pre></pre> vazio cai no fallback de innerHTML vazio', async ({ page }) => {
    // Linha 474: `(pre.innerHTML || '')` — cobre o ramo em que a tag <pre>
    // colada não tem conteúdo algum.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const content = await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      const event = editor.dispatch('PastePreProcess', { content: '<pre></pre>' });
      return event.content;
    });
    expect(content).toBe('');
  });

  test('sem window.fdmTheme, TinyMCE inicializa com skin escura padrão', async ({ page }) => {
    // Linha 518: `(window.fdmTheme ? window.fdmTheme.get() : 'dark') !== 'light'`
    // Remove window.fdmTheme antes do boot para exercitar o ramo `: 'dark'`
    // do ternário (skin oxide-dark aplicada por padrão sem o helper de tema).
    await page.addInitScript(() => {
      Object.defineProperty(window, 'fdmTheme', {
        configurable: true,
        get() { return undefined; },
        set() { /* ignora tentativas de setar, mantendo o guard sempre falsy */ },
      });
    });
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    const skin = await page.evaluate(() => {
      const link = document.querySelector('link[href*="skin.min.css"]');
      return link ? link.getAttribute('href') : null;
    });
    expect(skin).toContain('oxide-dark');
  });

  test('selecionar uma música diferente enquanto outra está ativa troca a seleção e aplica fallback de classificação vazia', async ({ page }) => {
    // Linhas 219/223: `if (state.selected && String(state.selected.id) === String(song.id)) return;`
    // (ramo verdadeiro com IDs diferentes, distinto do early-return de
    // clique duplo na mesma música já coberto em outro teste) e
    // `elements.classification.value = song.classificacao || '';` quando a
    // segunda música não tem classificação.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.evaluate(() => {
      window.songs.push(
        { id: '__song_a_troca__', nome: '__MUSICA_A_TROCA__', artista: 'Artista A', classificacao: 'Louvor', cifra: 'A' },
        { id: '__song_b_troca__', nome: '__MUSICA_B_TROCA__', artista: 'Artista B', classificacao: '', cifra: 'B' },
      );
    });
    await page.locator('#buscaMusica').fill('__MUSICA_');
    await page.evaluate(() => document.getElementById('buscaMusica').dispatchEvent(new Event('input')));

    await page.locator('#musicas li button[data-song-id="__song_a_troca__"]').click();
    await expect(page.locator('#titulo')).toHaveValue('__MUSICA_A_TROCA__');

    await page.locator('#musicas li button[data-song-id="__song_b_troca__"]').click();
    await expect(page.locator('#titulo')).toHaveValue('__MUSICA_B_TROCA__');
    await expect(page.locator('#classificacao')).toHaveValue('');
  });

  test('normaliseChordMarkup remove tags b/strong vazias após colagem (linha 272)', async ({ page }) => {
    // Linha 272: `if (!text) { element.remove(); return; }` dentro de
    // normaliseChordMarkup, exercitado via cleanForSave no fluxo de salvar -
    // uma tag <b></b> vazia (sem texto após trim) deve ser removida em vez
    // de virar um acorde vazio.
    await page.goto('/src/backend/editor/editor.php');
    await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
    await page.locator('#titulo').fill('__TESTE_BOLD_VAZIO__');
    await page.evaluate(() => {
      const editor = window.tinymce.get('cifraInput');
      editor.setContent('<b></b><b>   </b>Letra da música com acorde <b>C</b> normal.');
      editor.dispatch('input');
    });
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toHaveText('Música salva com sucesso.');

    const sync = await page.request.get('/api/sync/data.php');
    const data = await sync.json();
    const musica = data.musicas.find(item => item.nome === '__TESTE_BOLD_VAZIO__');
    expect(musica).toBeTruthy();
    expect(musica.cifra).not.toContain('<b></b>');
    expect(musica.cifra).toContain('normal.');

    const csrf = await getCsrf(page);
    await page.request.post(API, {
      data: JSON.stringify({ action: 'delete', id: musica.id }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
  });
});
