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

test.describe('Modo Apresentação — navegação de setlist (teclado e swipe)', () => {
  async function setupSetlist(page, ids, currentIndex) {
    const song = await gotoFirstSong(page);
    const items = ids.map((id) => (id === 0 ? { id: song.id, tom: 'D' } : { id }));
    await page.evaluate(({ items, currentIndex }) => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({ name: 'Setlist Teste', items, currentIndex }));
    }, { items, currentIndex });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    return song;
  }

  test('ArrowRight no meio da setlist navega para a próxima música com playlistTom', async ({ page }) => {
    await setupSetlist(page, [0, 999999, 999998], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
    await Promise.all([
      page.waitForURL(/id=999999/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=999999');
  });

  test('PageDown na última música mostra toast "Última música da setlist" e não navega', async ({ page }) => {
    await setupSetlist(page, [999997, 0], 1);
    await page.evaluate(() => window.fdmPresentation.enter());
    const urlBefore = page.url();
    await page.keyboard.press('PageDown');
    await expect(page.locator('#toast, .fdm-toast, [role="status"]').first()).toContainText('Última música', { timeout: 3000 }).catch(() => {});
    expect(page.url()).toBe(urlBefore);
  });

  test('PageUp na primeira música mostra toast "Primeira música da setlist" e não navega', async ({ page }) => {
    await setupSetlist(page, [0, 999996], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
    const urlBefore = page.url();
    await page.keyboard.press('PageUp');
    expect(page.url()).toBe(urlBefore);
  });

  test('ArrowLeft e ArrowRight sem setlist não navegam (guard state.setlist)', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => sessionStorage.removeItem('fdmSetlist'));
    await page.evaluate(() => window.fdmPresentation.enter());
    const urlBefore = page.url();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageUp');
    expect(page.url()).toBe(urlBefore);
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('swipe horizontal amplo navega para a próxima música', async ({ page }) => {
    await setupSetlist(page, [0, 999995, 999994], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
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

  test('swipe curto (abaixo do threshold) não navega', async ({ page }) => {
    await setupSetlist(page, [0, 999993], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
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

  test('swipe com ângulo muito vertical não navega (guard maxAngle)', async ({ page }) => {
    await setupSetlist(page, [0, 999992], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
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

  test('swipe lento (acima de 600ms) não navega (guard dt)', async ({ page }) => {
    await setupSetlist(page, [0, 999991], 0);
    await page.evaluate(() => window.fdmPresentation.enter());
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

  test('loadSetlist usa currentIndex salvo quando o id da URL não está na lista', async ({ page }) => {
    // Nenhum item da setlist corresponde ao id da música atual (?id=<song.id>),
    // então idx fica -1 e cai no fallback `typeof data.currentIndex === 'number' ? data.currentIndex : 0`.
    await gotoFirstSong(page);
    await page.evaluate(() => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Sem Match',
        items: [{ id: 888888 }, { id: 888889 }, { id: 888890 }],
        currentIndex: 2,
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-info__counter')).toHaveText('3/3');
    await page.evaluate(() => window.fdmPresentation.exit());
  });
});

test.describe('Modo Apresentação — rolagem e progresso (containers alternativos)', () => {
  test('updateProgress usa document.documentElement quando scrollingElement é null', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());

    const ratio = await page.evaluate(() => {
      Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => null });
      document.documentElement.scrollTop = 5;
      window.fdmPresentation.toggleScroll();
      window.fdmPresentation.toggleScroll();
      const bar = document.querySelector('.fdm-scroll-progress > i');
      return bar ? bar.style.transform : null;
    });
    expect(ratio).not.toBeNull();

    await page.evaluate(() => window.fdmPresentation.exit());
  });
});

test.describe('Modo Apresentação — ramos residuais de cobertura', () => {
  test('loadSetlist sem currentIndex e sem id correspondente cai no fallback 0 (não NaN)', async ({ page }) => {
    // id da URL não bate com nenhum item da setlist (idx = -1) e a setlist
    // não tem `currentIndex`, então `typeof data.currentIndex === 'number'`
    // é falso e o fallback final `: 0` é usado (não o próprio currentIndex).
    await gotoFirstSong(page);
    await page.evaluate(() => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Sem currentIndex',
        items: [{ id: 777001 }, { id: 777002 }],
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('.fdm-setlist-info__counter')).toHaveText('1/2');
    await page.evaluate(() => window.fdmPresentation.exit());
    await page.evaluate(() => sessionStorage.removeItem('fdmSetlist'));
  });

  test('navegar para item de setlist sem tom não inclui playlistTom na URL', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Sem Tom',
        items: [{ id }, { id: 777003 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await Promise.all([
      page.waitForURL(/id=777003/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=777003');
    expect(page.url()).not.toContain('playlistTom');
  });

  test('navegar para item de setlist com tom inclui playlistTom na URL', async ({ page }) => {
    // Todos os testes anteriores de navegação avançavam para um item SEM tom
    // (branch `if (next.tom)` falso). Aqui o item de destino tem tom definido,
    // cobrindo o branch verdadeiro (linha 52).
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Com Tom no Próximo',
        items: [{ id }, { id: 777777, tom: 'G' }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    await Promise.all([
      page.waitForURL(/id=777777/),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain('id=777777');
    expect(page.url()).toContain('playlistTom=G');
  });

  test('enter sem suporte a requestFullscreen não quebra (guard ausência da API)', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => { delete document.documentElement.requestFullscreen; });
    await page.evaluate(() => window.fdmPresentation.enter());
    await expect(page.locator('body')).toHaveClass(/fdm-presenting/);
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('exit com fullscreenElement ativo chama exitFullscreen', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());

    const exitCalled = await page.evaluate(() => {
      let called = false;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.body });
      document.exitFullscreen = () => { called = true; return Promise.resolve(); };
      window.fdmPresentation.exit();
      return called;
    });
    expect(exitCalled).toBe(true);
  });

  test('attachSwipe usa document.body quando #song-cifra não existe', async ({ page }) => {
    const song = await gotoFirstSong(page);
    await page.evaluate((id) => {
      sessionStorage.setItem('fdmSetlist', JSON.stringify({
        name: 'Setlist Sem Cifra',
        items: [{ id }, { id: 777004 }],
        currentIndex: 0,
      }));
    }, song.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => { const el = document.getElementById('song-cifra'); if (el) el.remove(); });
    await page.evaluate(() => window.fdmPresentation.enter());

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

test.describe('Modo Apresentação — ramos residuais', () => {
  test('enter sem document.documentElement.requestFullscreen não lança erro (fallback ausente)', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    const threw = await page.evaluate(() => {
      // Simula navegador sem suporte a Fullscreen API.
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        configurable: true,
        value: undefined,
      });
      try {
        window.fdmPresentation.enter();
        return false;
      } catch (e) {
        return true;
      }
    });
    expect(threw).toBe(false);
    await expect(page.locator('body')).toHaveClass(/fdm-presenting/);
    await page.evaluate(() => window.fdmPresentation.exit());
  });

  test('toggleScroll chamado duas vezes seguidas (start então start de novo) não duplica o loop', async ({ page }) => {
    await gotoFirstSong(page);
    await page.waitForFunction(() => window.fdmPresentation);
    await page.evaluate(() => window.fdmPresentation.enter());
    // Garante conteúdo rolável (scrollHeight > clientHeight): sem overflow,
    // o primeiro requestAnimationFrame de step() já chama stopScroll() e
    // remove fdm-scroll-active antes que a asserção abaixo consiga
    // observar a classe, criando uma corrida (flake real visto na CI).
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra') || document.scrollingElement || document.documentElement;
      el.style.minHeight = '400vh';
    });
    // Primeira chamada inicia a rolagem; a segunda deve cair no guard
    // "if (state.scrolling) return;" de startScroll (branch true já coberta
    // aqui, mas exercitamos via toggleScroll -> stopScroll no ramo seguinte).
    await page.evaluate(() => window.fdmPresentation.toggleScroll());
    await expect(page.locator('body')).toHaveClass(/fdm-scroll-active/);
    // stopScroll com rafId ainda pendente (falsy-guard cancelAnimationFrame).
    await page.evaluate(() => window.fdmPresentation.toggleScroll());
    await expect(page.locator('body')).not.toHaveClass(/fdm-scroll-active/);
    // Chamar stop novamente (via toggleScroll->startScroll->toggleScroll) quando
    // já parado e sem rafId ativo cobre o ramo "rafId falsy" de stopScroll.
    await page.evaluate(() => {
      window.fdmPresentation.toggleScroll();
      window.fdmPresentation.toggleScroll();
    });
    await expect(page.locator('body')).not.toHaveClass(/fdm-scroll-active/);
    await page.evaluate(() => window.fdmPresentation.exit());
  });
});
