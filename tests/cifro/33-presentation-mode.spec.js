/**
 * 33-presentation-mode.spec.js
 * Modo Apresentação (fdm-presentation.js) — window.fdmPresentation.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  const body = await res.json();
  return body.csrf_token || '';
}

async function ensureAnySong(page) {
  const data = await (await page.request.get('/api/sync/data.php')).json();
  if (data.musicas && data.musicas.length > 0) return data.musicas[0];

  // Other specs in the full suite may run before this one and leave the
  // shared test band without músicas — create a throwaway one rather than
  // assuming one always exists.
  const csrf = await getCsrf(page);
  const res = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({ nome: '__PRESENTATION_MODE_FIXTURE__', cifra: '<b>C</b> fixture', artista: '', classificacao: '', bit: '' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  const body = await res.json();
  return { id: body.id };
}

async function gotoFirstSong(page) {
  const song = await ensureAnySong(page);
  await page.goto(`/music.php?id=${song.id}`, { waitUntil: 'domcontentloaded' });
  return song;
}

test.describe('Modo Apresentação — entrar/sair', () => {
  test('enter aplica classe de apresentação e injeta overlay; exit remove tudo', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);

    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('body')).toHaveClass(/fdm-presenting/);
    await expect(page.locator('.fdm-presenting-overlay')).toBeVisible();
    await expect(page.locator('.fdm-stage-ready')).toHaveText('Pronto para palco');

    await page.evaluate(() => window.fdmPresentation.exit());
    await expect(page.locator('body')).not.toHaveClass(/fdm-presenting/);
    await expect(page.locator('.fdm-presenting-overlay')).toHaveCount(0);
  });

  test('chamar enter duas vezes não duplica o overlay', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => { window.fdmPresentation.enter(); window.fdmPresentation.enter(); });
    await expect(page.locator('.fdm-presenting-overlay')).toHaveCount(1);
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('exit sem estar apresentando não quebra', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.exit());
    await expect(page.locator('body')).not.toHaveClass(/fdm-presenting/);
  });

  test('Escape sai do modo apresentação', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('body')).toHaveClass(/fdm-presenting/);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/fdm-presenting/);
  });
});

test.describe('Modo Apresentação — rolagem automática', () => {
  test('toggleScroll ativa e desativa, alternando o botão', async ({ page }) => {
    // Lê o atributo de forma síncrona logo após a chamada — com conteúdo curto
    // (sem overflow), o requestAnimationFrame do próprio scroll detecta que já
    // está no fim e desativa sozinho no frame seguinte, então esperar via
    // locator (que dá tempo para esse frame rodar) mascararia o "true" inicial.
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());

    const pressedAfterFirstToggle = await page.evaluate(() => {
      window.fdmPresentation.toggleScroll();
      return document.getElementById('fdmAutoScrollToggle').getAttribute('aria-pressed');
    });
    expect(pressedAfterFirstToggle).toBe('true');

    const pressedAfterSecondToggle = await page.evaluate(() => {
      window.fdmPresentation.toggleScroll();
      return document.getElementById('fdmAutoScrollToggle').getAttribute('aria-pressed');
    });
    expect(pressedAfterSecondToggle).toBe('false');

    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('espaço alterna a rolagem enquanto apresentando (dispara o mesmo handler onKey)', async ({ page }) => {
    // Dispara a tecla diretamente via dispatchEvent (síncrono, dentro do
    // mesmo evaluate) em vez de page.keyboard.press(), para ler o atributo
    // antes do requestAnimationFrame do auto-scroll ter chance de rodar.
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());

    const pressedAfterFirstSpace = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      return document.getElementById('fdmAutoScrollToggle').getAttribute('aria-pressed');
    });
    expect(pressedAfterFirstSpace).toBe('true');

    const pressedAfterSecondSpace = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      return document.getElementById('fdmAutoScrollToggle').getAttribute('aria-pressed');
    });
    expect(pressedAfterSecondSpace).toBe('false');

    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('espaço não faz nada fora do modo apresentação', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.keyboard.press(' ');
    await expect(page.locator('.fdm-presenting-overlay')).toHaveCount(0);
  });

  test('cycleSpeed percorre slow -> normal -> fast -> slow e persiste', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => localStorage.removeItem('fdm-scrollSpeed'));

    const speeds = await page.evaluate(() => {
      const result = [];
      for (let i = 0; i < 3; i++) {
        window.fdmPresentation.cycleSpeed();
        result.push(localStorage.getItem('fdm-scrollSpeed'));
      }
      return result;
    });
    expect(speeds).toEqual(['fast', 'slow', 'normal']);
  });
});

test.describe('Modo Apresentação — setlist', () => {
  test('sem setlist na sessão, não injeta UI de navegação', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => sessionStorage.removeItem('fdmSetlist'));
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-nav')).toHaveCount(0);
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('com setlist válida, mostra navegação com limites desabilitados nas pontas', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Teste',
        items: [{ id }, { id: 999999 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);

    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-info__counter')).toHaveText('1/2');
    await expect(page.locator('#fdmSetlistPrev')).toBeDisabled();
    await expect(page.locator('#fdmSetlistNext')).toBeEnabled();
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('setlist inválida no sessionStorage é ignorada silenciosamente', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.setItem('fdmSetlist', '{not valid json'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-nav')).toHaveCount(0);
    await page.evaluate(() => window.fdmPresentation.exit());
    await page.evaluate(() => sessionStorage.removeItem('fdmSetlist'));
  });

  test('setlist com items vazio é tratada como ausente', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.setItem('fdmSetlist', JSON.stringify({ name: 'X', items: [] })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-nav')).toHaveCount(0);
    await page.evaluate(() => window.fdmPresentation.exit());
    await page.evaluate(() => sessionStorage.removeItem('fdmSetlist'));
  });
});
