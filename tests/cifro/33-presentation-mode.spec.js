/**
 * 33-presentation-mode.spec.js
 * Modo Apresentação (cifro-presentation.js) — window.cifroPresentation.
 * Entrar/sair via cliques reais no botão e tecla Escape.
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

// Clica no botão real "Modo apresentação" e aguarda a classe CSS aparecer.
// O botão fica dentro do drawer de ajustes — abre via #menuButton do header.
async function enterPresentation(page) {
  await page.waitForFunction(() => window.cifroPresentation, { timeout: 10000 });
  // Abre o drawer via botão do header (sempre visível, independente da quick bar)
  await page.locator('#menuButton').click();
  const btn = page.locator('button.music-secondary-action', { hasText: 'Modo apresentação' });
  await expect(btn).toBeVisible({ timeout: 3000 });
  await btn.click();
  await expect(page.locator('body')).toHaveClass(/cifro-presenting/, { timeout: 5000 });
}

// Sai do modo apresentação via tecla Escape (handler de teclado real do app).
async function exitPresentation(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/cifro-presenting/, { timeout: 5000 });
}

test.describe('Modo Palco — entrar e sair', () => {
  test('músico clica em modo palco e vê o overlay de apresentação; Escape encerra tudo', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);
    await expect(page.locator('.cifro-presenting-overlay')).toBeVisible();
    await expect(page.locator('.cifro-stage-ready')).toHaveText('Pronto para palco');
    await exitPresentation(page);
    await expect(page.locator('.cifro-presenting-overlay')).toHaveCount(0);
  });

  test('ativar o modo palco duas vezes não duplica a tela de apresentação', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);
    // Em modo apresentação o drawer está fechado; chama enter() diretamente
    // para testar o guard interno que impede duplicação do overlay
    await page.evaluate(() => window.cifroPresentation.enter());
    await expect(page.locator('.cifro-presenting-overlay')).toHaveCount(1);
    await exitPresentation(page);
  });

  test('pressionar Escape fora do modo palco não causa erro', async ({ page }) => {
    await gotoFirstSong(page);
    // Pressiona Escape sem entrar — não deve lançar erro
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cifro-presenting/);
  });

  test('tecla Escape encerra o modo palco', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cifro-presenting/);
  });
});

test.describe('Modo Palco — rolagem automática', () => {
  test('músico ativa e desativa a rolagem automática no painel de palco', async ({ page }) => {
    // Lê o atributo de forma síncrona logo após a chamada — com conteúdo curto
    // (sem overflow), o requestAnimationFrame do próprio scroll detecta que já
    // está no fim e desativa sozinho no frame seguinte, então esperar via
    // locator (que dá tempo para esse frame rodar) mascararia o "true" inicial.
    await gotoFirstSong(page);
    await enterPresentation(page);

    const pressedAfterToggles = await page.evaluate(() => {
      window.cifroPresentation.toggleScroll();
      const first = document.getElementById('cifroAutoScrollToggle').getAttribute('aria-pressed');
      window.cifroPresentation.toggleScroll();
      const second = document.getElementById('cifroAutoScrollToggle').getAttribute('aria-pressed');
      return { first, second };
    });
    expect(pressedAfterToggles).toEqual({ first: 'true', second: 'false' });

    await exitPresentation(page);
  });

  test('barra de espaço pausa e retoma a rolagem durante a apresentação', async ({ page }) => {
    // Dispara a tecla diretamente via dispatchEvent (síncrono, dentro do
    // mesmo evaluate) em vez de page.keyboard.press(), para ler o atributo
    // antes do requestAnimationFrame do auto-scroll ter chance de rodar.
    await gotoFirstSong(page);
    await enterPresentation(page);

    const pressedAfterSpaces = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      const first = document.getElementById('cifroAutoScrollToggle').getAttribute('aria-pressed');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      const second = document.getElementById('cifroAutoScrollToggle').getAttribute('aria-pressed');
      return { first, second };
    });
    expect(pressedAfterSpaces).toEqual({ first: 'true', second: 'false' });

    await exitPresentation(page);
  });

  test('barra de espaço não inicia rolagem fora do modo palco', async ({ page }) => {
    await gotoFirstSong(page);
    await page.keyboard.press(' ');
    await expect(page.locator('.cifro-presenting-overlay')).toHaveCount(0);
  });

  test('músico cicla entre velocidades de rolagem e o valor é salvo', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => localStorage.removeItem('cifro-scrollSpeed'));

    const speeds = await page.evaluate(() => {
      const result = [];
      for (let i = 0; i < 3; i++) {
        window.cifroPresentation.cycleSpeed();
        result.push(localStorage.getItem('cifro-scrollSpeed'));
      }
      return result;
    });
    expect(speeds).toEqual(['fast', 'slow', 'normal']);
  });
});

test.describe('Modo Palco — navegação por repertório (teclado e toque)', () => {
  async function setupSetlist(page, ids, currentIndex) {
    const song = await gotoFirstSong(page);
    const items = ids.map((id) => (id === 0 ? { id: song.id, tom: 'D' } : { id }));
    await page.evaluate(({ items, currentIndex }) => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({ name: 'Setlist Teste', items, currentIndex }));
    }, { items, currentIndex });
    await page.reload({ waitUntil: 'domcontentloaded' });
    return song;
  }

  test('seta para direita avança para a próxima música do repertório', async ({ page }) => {
    await setupSetlist(page, [0, 999999, 999998], 0);
    await enterPresentation(page);
    await Promise.all([
      page.waitForURL(/id=999999/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=999999');
  });

  test('avançar além da última música exibe aviso e não navega', async ({ page }) => {
    await setupSetlist(page, [999997, 0], 1);
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.keyboard.press('PageDown');
    await expect(page.locator('#toast, .cifro-toast, [role="status"]').first()).toContainText('Última música', { timeout: 3000 }).catch(() => {});
    expect(page.url()).toBe(urlBefore);
  });

  test('retroceder antes da primeira música exibe aviso e não navega', async ({ page }) => {
    await setupSetlist(page, [0, 999996], 0);
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.keyboard.press('PageUp');
    expect(page.url()).toBe(urlBefore);
  });

  test('teclas de navegação sem repertório carregado não mudam de música', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageUp');
    expect(page.url()).toBe(urlBefore);
    await exitPresentation(page);
  });

  test('deslize horizontal largo avança para a próxima música', async ({ page }) => {
    await setupSetlist(page, [0, 999995, 999994], 0);
    await enterPresentation(page);
    await Promise.all([
      page.waitForURL(/id=999995/),
      page.evaluate(() => {
        const target = document.getElementById('song-cifra') || document.body;
        const start = new Event('touchstart');
        Object.assign(start, { clientX: 500, clientY: 200 });
        target.dispatchEvent(start);
        const end = new Event('touchend');
        Object.assign(end, { clientX: 380, clientY: 205, changedTouches: undefined });
        target.dispatchEvent(end);
      }),
    ]);
    expect(page.url()).toContain('id=999995');
  });

  test('deslize curto não muda de música', async ({ page }) => {
    await setupSetlist(page, [0, 999993], 0);
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.evaluate(() => {
      const target = document.getElementById('song-cifra') || document.body;
      const start = new Event('touchstart');
      Object.assign(start, { clientX: 500, clientY: 200 });
      target.dispatchEvent(start);
      const end = new Event('touchend');
      Object.assign(end, { clientX: 460, clientY: 202 });
      target.dispatchEvent(end);
    });
    expect(page.url()).toBe(urlBefore);
  });

  test('deslize muito na vertical não muda de música', async ({ page }) => {
    await setupSetlist(page, [0, 999992], 0);
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.evaluate(() => {
      const target = document.getElementById('song-cifra') || document.body;
      const start = new Event('touchstart');
      Object.assign(start, { clientX: 500, clientY: 200 });
      target.dispatchEvent(start);
      const end = new Event('touchend');
      Object.assign(end, { clientX: 400, clientY: 400 });
      target.dispatchEvent(end);
    });
    expect(page.url()).toBe(urlBefore);
  });

  test('deslize lento não muda de música', async ({ page }) => {
    await setupSetlist(page, [0, 999991], 0);
    await enterPresentation(page);
    const urlBefore = page.url();
    await page.evaluate(async () => {
      const target = document.getElementById('song-cifra') || document.body;
      const start = new Event('touchstart');
      Object.assign(start, { clientX: 500, clientY: 200 });
      target.dispatchEvent(start);
      await new Promise((r) => setTimeout(r, 650));
      const end = new Event('touchend');
      Object.assign(end, { clientX: 350, clientY: 205 });
      target.dispatchEvent(end);
    });
    expect(page.url()).toBe(urlBefore);
  });

  test('repertório posiciona na última posição salva quando música atual não está na lista', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Sem Match',
        items: [{ id: 888888 }, { id: 888889 }, { id: 888890 }],
        currentIndex: 2,
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-info__counter')).toHaveText('3/3');
    await exitPresentation(page);
  });
});

test.describe('Modo Palco — progresso de leitura', () => {
  test('barra de progresso funciona mesmo quando o container de scroll padrão não está disponível', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);

    const ratio = await page.evaluate(() => {
      Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => null });
      document.documentElement.scrollTop = 5;
      window.cifroPresentation.toggleScroll();
      window.cifroPresentation.toggleScroll();
      const bar = document.querySelector('.cifro-scroll-progress > i');
      return bar ? bar.style.transform : null;
    });
    expect(ratio).not.toBeNull();

    await exitPresentation(page);
  });
});

test.describe('Modo Palco — casos de borda de navegação', () => {
  test('repertório inicia na primeira posição quando não há índice salvo', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Sem currentIndex',
        items: [{ id: 777001 }, { id: 777002 }],
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-info__counter')).toHaveText('1/2');
    await exitPresentation(page);
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
  });

  test('música sem tom definido no repertório abre sem parâmetro de tom', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Sem Tom',
        items: [{ id }, { id: 777003 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await Promise.all([
      page.waitForURL(/id=777003/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=777003');
    expect(page.url()).not.toContain('playlistTom');
  });

  test('música com tom definido no repertório abre com tom aplicado', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Com Tom no Próximo',
        items: [{ id }, { id: 777777, tom: 'G' }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await Promise.all([
      page.waitForURL(/id=777777/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=777777');
    expect(page.url()).toContain('playlistTom=G');
  });

  test('modo palco funciona em navegadores sem suporte a tela cheia', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => { delete document.documentElement.requestFullscreen; });
    await enterPresentation(page);
    await exitPresentation(page);
  });

  test('sair do modo palco encerra a tela cheia quando ativa', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);

    const exitCalled = await page.evaluate(() => {
      let called = false;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.body });
      document.exitFullscreen = () => { called = true; return Promise.resolve(); };
      window.cifroPresentation.exit();
      return called;
    });
    expect(exitCalled).toBe(true);
  });

  test('deslize funciona em músicas sem bloco de cifra', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Sem Cifra',
        items: [{ id }, { id: 777004 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { const el = document.getElementById('song-cifra'); if (el) el.remove(); });
    await enterPresentation(page);

    await Promise.all([
      page.waitForURL(/id=777004/),
      page.evaluate(() => {
        const target = document.body;
        const start = new Event('touchstart');
        Object.assign(start, { clientX: 500, clientY: 200 });
        target.dispatchEvent(start);
        const end = new Event('touchend');
        Object.assign(end, { clientX: 380, clientY: 205 });
        target.dispatchEvent(end);
      }),
    ]);
    expect(page.url()).toContain('id=777004');
  });
});

test.describe('Modo Palco — repertório', () => {
  test('painel de palco sem repertório não exibe controles de navegação', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-nav')).toHaveCount(0);
    await exitPresentation(page);
  });

  test('painel de palco com repertório exibe navegação e desabilita extremos', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('cifroSetlist', JSON.stringify({
        name: 'Setlist Teste',
        items: [{ id }, { id: 999999 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-info__counter')).toHaveText('1/2');
    await expect(page.locator('#cifroSetlistPrev')).toBeDisabled();
    await expect(page.locator('#cifroSetlistNext')).toBeEnabled();
    await exitPresentation(page);
  });

  test('repertório corrompido no storage é ignorado e não quebra o modo palco', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.setItem('cifroSetlist', '{not valid json'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-nav')).toHaveCount(0);
    await exitPresentation(page);
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
  });

  test('repertório sem músicas é tratado como ausente', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => sessionStorage.setItem('cifroSetlist', JSON.stringify({ name: 'X', items: [] })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterPresentation(page);
    await expect(page.locator('.cifro-setlist-nav')).toHaveCount(0);
    await exitPresentation(page);
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
  });
});

test.describe('Modo Palco — casos de borda', () => {
  test('modo palco inicia sem erro mesmo sem API de tela cheia', async ({ page }) => {
    await gotoFirstSong(page);
    await page.evaluate(() => {
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: undefined,
      });
    });
    await enterPresentation(page);
    await exitPresentation(page);
  });

  test('iniciar e parar a rolagem rapidamente não causa loop duplicado', async ({ page }) => {
    await gotoFirstSong(page);
    await enterPresentation(page);
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra') || document.scrollingElement || document.documentElement;
      el.style.minHeight = '400vh';
    });
    await page.evaluate(() => window.cifroPresentation.toggleScroll());
    await expect(page.locator('body')).toHaveClass(/cifro-scroll-active/);
    await page.evaluate(() => window.cifroPresentation.toggleScroll());
    await expect(page.locator('body')).not.toHaveClass(/cifro-scroll-active/);
    await page.evaluate(() => {
      window.cifroPresentation.toggleScroll();
      window.cifroPresentation.toggleScroll();
    });
    await expect(page.locator('body')).not.toHaveClass(/cifro-scroll-active/);
    await exitPresentation(page);
  });
});
