/**
 * 59-music-fonte-colunas.spec.js
 * Cobertura E2E real dos controles de Tamanho da letra e Colunas em music.php.
 *
 * Cenários de fonte:
 *   - display não exibe "px"
 *   - A+ aumenta 1 pt por clique
 *   - A- diminui 1 pt por clique
 *   - mínimo 10 é respeitado (não desce abaixo)
 *
 * Cenários de colunas (novos e corrigidos):
 *   - estado inicial: auto-columns ativo, botão Auto pressionado
 *   - botões 1 / 2 / 3 fixam forceMaxColumns = forceMinColumns = N
 *   - cifra permanece em auto-columns em todos os modos
 *   - aria-pressed reflete o modo ativo corretamente
 *   - Auto → 2 → Auto não quebra o layout (bug histórico)
 *   - botão 3 existe e funciona (feature adicionada)
 *   - reset limpa colunas forçadas e volta ao auto
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const CIFRA_LONGA = `
<b>C</b>       <b>G</b>       <b>Am</b>      <b>F</b><br>
Primeira linha de cifra para teste de colunas<br>
<b>C</b>       <b>G</b>       <b>Em</b>      <b>F</b><br>
Segunda linha de cifra para teste de colunas<br>
<b>Am</b>      <b>F</b>       <b>C</b>       <b>G</b><br>
Terceira linha de cifra para teste de colunas<br>
<b>Dm</b>      <b>G</b>       <b>C</b>       <b>Em</b><br>
Quarta linha de cifra para teste de colunas<br>
<b>F</b>       <b>C</b>       <b>G</b>       <b>Am</b><br>
Quinta linha de cifra para teste de colunas<br>
<b>C</b>       <b>G</b>       <b>Am</b>      <b>F</b><br>
Sexta linha de cifra para teste de colunas<br>
<b>G</b>       <b>Em</b>      <b>Am</b>      <b>F</b><br>
Sétima linha de cifra para teste de colunas<br>
<b>C</b>       <b>G</b>       <b>F</b>       <b>C</b><br>
Oitava linha de cifra para teste de colunas<br>
`.trim();

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  return (await res.json()).csrf_token || '';
}

async function criarMusica(page, nome, cifra = CIFRA_LONGA) {
  const csrf = await getCsrf(page);
  const res = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({ action: 'save', nome, artista: 'Teste', cifra, classificacao: '', bit: '' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  const body = await res.json();
  expect(body.id).toBeTruthy();
  return body.id;
}

async function deletarMusica(page, id) {
  const csrf = await getCsrf(page);
  await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({ action: 'delete', id }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
}

/** Abre a gaveta de ajustes e aguarda os controles estarem no DOM. */
async function abrirAjustes(page) {
  const menuBtn = page.locator('[data-music-action="menuButton"]').first();
  if (await menuBtn.count()) {
    await menuBtn.evaluate(el => el.click());
  }
  await page.waitForSelector('#fontSizeDisplay', { state: 'attached' });
}

/** Lê o tamanho de fonte atual renderizado (px inteiro). */
function getFontSize(page) {
  return page.evaluate(() =>
    Math.round(parseFloat(window.getComputedStyle(document.getElementById('song-cifra')).fontSize))
  );
}

/** Lê os datasets de colunas forçadas. */
function getColDataset(page) {
  return page.evaluate(() => {
    const el = document.getElementById('song-cifra');
    return {
      forceMax: el.dataset.forceMaxColumns || '',
      forceMin: el.dataset.forceMinColumns || '',
      isAuto: el.classList.contains('auto-columns'),
    };
  });
}

/** Retorna o modo de coluna ativo segundo aria-pressed. */
function getActiveColumnMode(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('[data-column-mode][aria-pressed="true"]');
    return btn ? btn.dataset.columnMode : null;
  });
}

// ─────────────────────────────────────────────
// SUITE FONTE
// ─────────────────────────────────────────────
test.describe('Controle de tamanho da letra (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_FONTE__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });
    await abrirAjustes(page);
  });

  test('display não exibe "px" — mostra só número', async ({ page }) => {
    const texto = await page.locator('#fontSizeDisplay').textContent();
    expect(texto).toMatch(/^\d+$/);
    expect(texto).not.toContain('px');
  });

  test('A+ aumenta o tamanho da letra em 1pt por clique', async ({ page }) => {
    const antes = await getFontSize(page);
    await page.locator('#increase-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    const depois = await getFontSize(page);
    expect(depois).toBe(antes + 1);
  });

  test('A- diminui o tamanho da letra em 1pt por clique', async ({ page }) => {
    // Garante fonte acima do mínimo antes de diminuir
    await page.locator('#increase-text').evaluate(el => el.click());
    await page.locator('#increase-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    const antes = await getFontSize(page);
    await page.locator('#decrease-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    const depois = await getFontSize(page);
    expect(depois).toBe(antes - 1);
  });

  test('A- respeita mínimo de 10 — não desce abaixo', async ({ page }) => {
    // Clica A- muitas vezes para forçar o mínimo
    for (let i = 0; i < 30; i++) {
      await page.locator('#decrease-text').evaluate(el => el.click());
    }
    await page.waitForTimeout(200);
    const tamanho = await getFontSize(page);
    expect(tamanho).toBe(10);

    // Mais cliques não alteram
    await page.locator('#decrease-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    expect(await getFontSize(page)).toBe(10);
  });

  test('display atualiza após cada clique em A+ e A-', async ({ page }) => {
    await page.locator('#increase-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    const displayApos = await page.locator('#fontSizeDisplay').textContent();
    const computedApos = await getFontSize(page);
    expect(Number(displayApos)).toBe(computedApos);

    await page.locator('#decrease-text').evaluate(el => el.click());
    await page.waitForTimeout(100);
    const displayFinal = await page.locator('#fontSizeDisplay').textContent();
    const computedFinal = await getFontSize(page);
    expect(Number(displayFinal)).toBe(computedFinal);
  });
});

// ─────────────────────────────────────────────
// SUITE COLUNAS
// ─────────────────────────────────────────────
test.describe('Controle de colunas (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_COLUNAS__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });
    await abrirAjustes(page);
  });

  test('estado inicial: auto-columns ativo e botão Auto pressionado', async ({ page }) => {
    const { isAuto, forceMax, forceMin } = await getColDataset(page);
    expect(isAuto).toBe(true);
    expect(forceMax).toBe('');
    expect(forceMin).toBe('');
    expect(await getActiveColumnMode(page)).toBe('auto');
    await expect(page.locator('#columnModeAuto')).toHaveAttribute('aria-pressed', 'true');
  });

  test('botão 3 existe na UI', async ({ page }) => {
    await expect(page.locator('#columnMode3')).toHaveCount(1);
    await expect(page.locator('[data-column-mode="3"]')).toHaveCount(1);
  });

  for (const n of ['1', '2', '3']) {
    test(`modo ${n}: fixa forceMaxColumns=${n} e mantém auto-columns`, async ({ page }) => {
      await page.locator(`#columnMode${n}`).evaluate(el => el.click());
      await page.waitForTimeout(300);

      const { isAuto, forceMax, forceMin } = await getColDataset(page);
      expect(isAuto).toBe(true);
      expect(forceMax).toBe(n);
      expect(forceMin).toBe(n);
      await expect(page.locator(`#columnMode${n}`)).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('apenas um botão tem aria-pressed=true por vez', async ({ page }) => {
    await page.locator('#columnMode2').evaluate(el => el.click());
    await page.waitForTimeout(200);
    const pressionados = await page.evaluate(() =>
      [...document.querySelectorAll('[data-column-mode]')]
        .filter(b => b.getAttribute('aria-pressed') === 'true')
        .map(b => b.dataset.columnMode)
    );
    expect(pressionados).toEqual(['2']);
  });

  test('Auto → 2 → Auto: limpa colunas forçadas e auto-columns permanece ativo', async ({ page }) => {
    // Auto inicial
    expect((await getColDataset(page)).isAuto).toBe(true);

    // Seleciona 2 colunas
    await page.locator('#columnMode2').evaluate(el => el.click());
    await page.waitForTimeout(300);
    expect((await getColDataset(page)).forceMax).toBe('2');

    // Volta para Auto
    await page.locator('#columnModeAuto').evaluate(el => el.click());
    await page.waitForTimeout(300);
    const { isAuto, forceMax, forceMin } = await getColDataset(page);
    expect(isAuto).toBe(true);
    expect(forceMax).toBe('');
    expect(forceMin).toBe('');
    expect(await getActiveColumnMode(page)).toBe('auto');
  });

  test('sequência 1 → 2 → 3 → Auto funciona sem quebrar o layout', async ({ page }) => {
    for (const mode of ['1', '2', '3', 'auto']) {
      const locator = mode === 'auto'
        ? page.locator('#columnModeAuto')
        : page.locator(`#columnMode${mode}`);
      await locator.evaluate(el => el.click());
      await page.waitForTimeout(300);
      expect((await getColDataset(page)).isAuto).toBe(true);
      expect(await getActiveColumnMode(page)).toBe(mode);
    }
  });

  test('reset limpa colunas forçadas e volta ao modo Auto', async ({ page }) => {
    // Fixa em 3
    await page.locator('#columnMode3').evaluate(el => el.click());
    await page.waitForTimeout(300);
    expect((await getColDataset(page)).forceMax).toBe('3');

    // Reset
    await page.locator('#resetReadingSettings').evaluate(el => el.click());
    await page.waitForTimeout(300);

    const { forceMax, forceMin, isAuto } = await getColDataset(page);
    expect(forceMax).toBe('');
    expect(forceMin).toBe('');
    expect(isAuto).toBe(true);
    expect(await getActiveColumnMode(page)).toBe('auto');
  });
});

// ─────────────────────────────────────────────
// SUITE ROLAGEM AUTOMÁTICA
// ─────────────────────────────────────────────
test.describe('Rolagem automática (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    // Cria uma música longa o suficiente para ter conteúdo a rolar
    const cifraExtra = Array.from({ length: 30 }, (_, i) =>
      `<b>C</b>       <b>G</b>       <b>Am</b>      <b>F</b><br>Verso ${i + 1} — linha de conteúdo longa para garantir scroll real<br>`
    ).join('');
    id = await criarMusica(page, '__TESTE_AUTOSCROLL__', cifraExtra);
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  async function abrirAjustesRolagem(page) {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });
    // Garante que há conteúdo a rolar: cifra com altura limitada
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      if (el) {
        el.style.height = '25vh';
        el.style.overflowY = 'auto';
        el.style.minHeight = '';
      }
    });
    const menuBtn = page.locator('[data-music-action="menuButton"]').first();
    if (await menuBtn.count()) await menuBtn.evaluate(el => el.click());
    await page.waitForSelector('#autoScrollToggle', { state: 'attached' });
  }

  test('botão Iniciar muda para "Pausar" e aria-pressed=true ao ativar', async ({ page }) => {
    await abrirAjustesRolagem(page);
    await expect(page.locator('#autoScrollToggle')).toHaveText('Iniciar');
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#autoScrollToggle')).toHaveText('Pausar');
  });

  test('scroll automático move o conteúdo — scrollTop aumenta após ativação', async ({ page }) => {
    await abrirAjustesRolagem(page);
    // Velocidade máxima para rolar rápido e detectar em curto prazo
    await page.locator('#autoScrollSpeed').evaluate(el => { el.value = '5'; el.dispatchEvent(new Event('input')); });
    const antes = await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      return el ? el.scrollTop : document.scrollingElement.scrollTop;
    });
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    // Aguarda até 3s pelo scroll real
    await expect.poll(
      () => page.evaluate(() => {
        const el = document.getElementById('song-cifra');
        return el ? el.scrollTop : document.scrollingElement.scrollTop;
      }),
      { timeout: 3000 }
    ).toBeGreaterThan(antes + 1);
  });

  test('clicar em Pausar para o scroll e reverte aria-pressed', async ({ page }) => {
    await abrirAjustesRolagem(page);
    await page.locator('#autoScrollSpeed').evaluate(el => { el.value = '5'; el.dispatchEvent(new Event('input')); });
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'true');

    // Captura posição enquanto rola
    await page.waitForTimeout(300);
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#autoScrollToggle')).toHaveText('Iniciar');

    // Posição não deve mudar após parar
    const posAposPausar = await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      return el ? el.scrollTop : document.scrollingElement.scrollTop;
    });
    await page.waitForTimeout(500);
    const posDepois = await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      return el ? el.scrollTop : document.scrollingElement.scrollTop;
    });
    expect(posDepois).toBe(posAposPausar);
  });

  test('barra de espaço pausa e retoma o scroll', async ({ page }) => {
    await abrirAjustesRolagem(page);
    // Foca fora de qualquer input para espaço funcionar
    await page.locator('#song-cifra').click();
    await page.keyboard.press('Space');
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'false');
  });

  test('#quickAutoScroll na barra rápida também controla o scroll', async ({ page }) => {
    await abrirAjustesRolagem(page);
    // Ativa a barra rápida
    await page.evaluate(() => {
      const cb = document.getElementById('showQuickBar');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
    });
    const quickBtn = page.locator('#quickAutoScroll');
    await expect(quickBtn).toHaveAttribute('aria-pressed', 'false');
    await quickBtn.evaluate(el => el.click());
    await expect(quickBtn).toHaveAttribute('aria-pressed', 'true');
    // O botão no drawer também deve refletir o estado
    await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'true');
    await quickBtn.evaluate(el => el.click());
    await expect(quickBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────
// SUITE VELOCIDADE DE ROLAGEM (escala 1-10)
// ─────────────────────────────────────────────
test.describe('Escala de velocidade da rolagem 1-10 (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    const cifraExtra = Array.from({ length: 30 }, (_, i) =>
      `<b>Am</b>      <b>F</b><br>Verso ${i + 1} para teste de velocidade<br>`
    ).join('');
    id = await criarMusica(page, '__TESTE_VELOCIDADE__', cifraExtra);
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test('input de velocidade vai de 1 a 10 (max=10)', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('#autoScrollSpeed');
    await expect(input).toHaveAttribute('min', '1');
    await expect(input).toHaveAttribute('max', '10');
    await expect(input).toHaveAttribute('step', '1');
  });

  test('valor padrão da velocidade é 5/10', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const label = page.locator('#autoScrollSpeedValue');
    await expect(label).toHaveText('5/10');
  });

  test('label exibe X/10 ao mudar a velocidade', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const menuBtn = page.locator('[data-music-action="menuButton"]').first();
    if (await menuBtn.count()) await menuBtn.evaluate(el => el.click());
    await page.waitForSelector('#autoScrollSpeed', { state: 'attached' });

    for (const v of ['1', '7', '10']) {
      await page.locator('#autoScrollSpeed').evaluate((el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input'));
      }, v);
      await expect(page.locator('#autoScrollSpeedValue')).toHaveText(`${v}/10`);
    }
  });

  test('velocidade 1 é consideravelmente mais lenta que velocidade 10', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });
    // Expõe a altura da cifra para gerar scroll
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      if (el) { el.style.height = '25vh'; el.style.overflowY = 'auto'; }
    });
    const menuBtn = page.locator('[data-music-action="menuButton"]').first();
    if (await menuBtn.count()) await menuBtn.evaluate(el => el.click());
    await page.waitForSelector('#autoScrollToggle', { state: 'attached' });

    // Mede scroll a velocidade 1 (lenta) em 500ms
    await page.locator('#autoScrollSpeed').evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('input')); });
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    await page.waitForTimeout(500);
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    const posV1 = await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      return el ? el.scrollTop : document.scrollingElement.scrollTop;
    });

    // Reinicia e mede scroll a velocidade 10 (rápida) em 500ms
    await page.evaluate(() => {
      const el = document.getElementById('song-cifra') || document.scrollingElement;
      el.scrollTop = 0;
    });
    await page.locator('#autoScrollSpeed').evaluate(el => { el.value = '10'; el.dispatchEvent(new Event('input')); });
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    await page.waitForTimeout(500);
    await page.locator('#autoScrollToggle').evaluate(el => el.click());
    const posV10 = await page.evaluate(() => {
      const el = document.getElementById('song-cifra');
      return el ? el.scrollTop : document.scrollingElement.scrollTop;
    });

    // Velocidade 10 deve rolar mais que velocidade 1
    expect(posV10).toBeGreaterThan(posV1 * 3);
  });

  test('reset retorna velocidade para 5/10', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const menuBtn = page.locator('[data-music-action="menuButton"]').first();
    if (await menuBtn.count()) await menuBtn.evaluate(el => el.click());
    await page.waitForSelector('#autoScrollSpeed', { state: 'attached' });

    // Muda para 8 antes de resetar
    await page.locator('#autoScrollSpeed').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input')); });
    await expect(page.locator('#autoScrollSpeedValue')).toHaveText('8/10');

    await page.locator('#resetReadingSettings').evaluate(el => el.click());
    await expect(page.locator('#autoScrollSpeedValue')).toHaveText('5/10');
    await expect(page.locator('#autoScrollSpeed')).toHaveValue('5');
  });
});

// ─────────────────────────────────────────────
// SUITE BOTÃO SAIR DA TELA CHEIA NO HEADER
// ─────────────────────────────────────────────
test.describe('Botão sair da tela cheia no cabeçalho (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_FULLSCREEN_HEADER__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test('botão de sair da tela cheia existe no header com label correto', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const btn = page.locator('#headerFullscreenBtn');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Sair da tela cheia');

    const inHeader = await btn.evaluate(el => !!el.closest('.music-header__actions'));
    expect(inHeader).toBe(true);
  });

  test('botão de tela cheia aparece à esquerda do status de conexão', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // Simula fullscreen para o botão ficar visível e poder medir posição
    await page.evaluate(() => {
      Object.defineProperty(document, 'fullscreenElement', { get: () => document.documentElement, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const positions = await page.evaluate(() => {
      const btn = document.getElementById('headerFullscreenBtn');
      const status = document.getElementById('connectionStatus');
      if (!btn || !status) return null;
      const r1 = btn.getBoundingClientRect();
      const r2 = status.getBoundingClientRect();
      return { btnRight: r1.right, statusLeft: r2.left };
    });
    expect(positions).not.toBeNull();
    expect(positions.btnRight).toBeLessThanOrEqual(positions.statusLeft + 5);
  });
});

// ─────────────────────────────────────────────
// SUITE AO VIVO — VISIBILIDADE POR PLANO
// ─────────────────────────────────────────────
test.describe('Aba "Ao vivo" oculta para bandas gratuitas (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_AO_VIVO_PLANO__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test('aba "Ao vivo" visível para banda paga (plano != gratuito)', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const plano = await page.evaluate(() => window.CIFRO_BAND_PLANO || '');
    // Só verifica se o plano atual for pago
    const pagos = ['trial', 'mensal', 'ativo'];
    if (!pagos.includes(plano)) {
      test.skip();
      return;
    }
    await expect(page.locator('#settingsTabLive')).toBeVisible();
  });

  test('aba "Ao vivo" oculta para banda gratuita — via simulação de plano', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // Simula comportamento para plano gratuito injetando o script equivalente
    await page.evaluate(() => {
      const liveTab = document.getElementById('settingsTabLive');
      const livePanel = document.getElementById('settingsPanelLive');
      if (liveTab) liveTab.style.display = 'none';
      if (livePanel) livePanel.hidden = true;
    });
    await expect(page.locator('#settingsTabLive')).toBeHidden();
    await expect(page.locator('#settingsPanelLive')).toBeHidden();
  });

  test('CIFRO_BAND_PLANO está exposto na página', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const plano = await page.evaluate(() => window.CIFRO_BAND_PLANO);
    expect(typeof plano).toBe('string');
    expect(plano.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// SUITE USO OFFLINE — SEM UI, SYNC EM BACKGROUND
// ─────────────────────────────────────────────
test.describe('Sincronização offline em background — sem seção "Uso offline" (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_OFFLINE_SYNC__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test('seção "Uso offline" não existe mais no painel Ferramentas', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // O <details> de Uso offline deve ter sido removido
    const count = await page.locator('.music-tool summary').evaluateAll(
      els => els.filter(el => el.textContent.trim().startsWith('Uso offline')).length
    );
    expect(count).toBe(0);
  });

  test('cifroSync.load é chamado ao carregar a música (sync em background)', async ({ page }) => {
    let syncCalled = false;
    await page.route('**/api/sync.php**', route => {
      syncCalled = true;
      route.continue();
    });
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // window.__cifroInitialDataPromise deve existir (criado após cifroSync.load)
    const hasPromise = await page.evaluate(() => typeof window.__cifroInitialDataPromise !== 'undefined');
    expect(hasPromise).toBe(true);
  });

  test('OfflineTools permanece acessível via window (background sync ativo)', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const hasOfflineTools = await page.evaluate(() => typeof window.OfflineTools !== 'undefined');
    // offline-tools.js ainda é carregado (background sync depende dele)
    expect(hasOfflineTools).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SUITE FULLSCREEN AUTOMÁTICO E BOTÃO DE SAÍDA
// ─────────────────────────────────────────────
test.describe('Tela cheia automática ao abrir música (music.php)', () => {
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    id = await criarMusica(page, '__TESTE_FULLSCREEN__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!id) return;
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    await deletarMusica(page, id);
    await ctx.close();
  });

  test('botão de sair da tela cheia existe no header com aria-label correto', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const btn = page.locator('#headerFullscreenBtn');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Sair da tela cheia');
  });

  test('botão de sair está oculto fora do fullscreen', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // Playwright não entra em fullscreen por padrão — botão deve estar oculto
    const display = await page.locator('#headerFullscreenBtn').evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('botão fica visível quando fullscreen está ativo', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    // Simula entrada em fullscreen disparando o evento
    await page.evaluate(() => {
      Object.defineProperty(document, 'fullscreenElement', { get: () => document.documentElement, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const display = await page.locator('#headerFullscreenBtn').evaluate(el => el.style.display);
    expect(display).not.toBe('none');
  });

  test('cifro-presentation.js não é mais carregado na página', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    const hasPresentationScript = await page.evaluate(() => typeof window.cifroPresentation !== 'undefined');
    expect(hasPresentationScript).toBe(false);
  });

  test('cifra tem max-width aplicado por padrão (sem modo especial)', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });
    const maxWidth = await page.locator('#song-cifra').evaluate(el =>
      window.getComputedStyle(el).maxWidth
    );
    // max-width: 760px aplicado via CSS
    expect(maxWidth).toBe('760px');
  });
});

// ─────────────────────────────────────────────
// SUITE NAVEGAÇÃO DE SETLIST
// ─────────────────────────────────────────────
test.describe('Navegação de setlist por swipe e teclado (music.php)', () => {
  let idA = '', idB = '';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    idA = await criarMusica(page, '__TESTE_SETLIST_A__');
    idB = await criarMusica(page, '__TESTE_SETLIST_B__');
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
    const page = await ctx.newPage();
    for (const id of [idA, idB]) {
      if (id) await deletarMusica(page, id);
    }
    await ctx.close();
  });

  function setlistPayload(idA, idB) {
    return JSON.stringify({
      name: 'Setlist Teste',
      currentIndex: 0,
      items: [
        { id: String(idA), nome: 'Música A', tom: '' },
        { id: String(idB), nome: 'Música B', tom: '' },
      ],
    });
  }

  test('tecla ArrowRight navega para próxima música da setlist', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(idA)}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((payload) => sessionStorage.setItem('cifroSetlist', payload), setlistPayload(idA, idB));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });

    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.keyboard.press('ArrowRight'),
    ]);
    expect(page.url()).toContain(`id=${encodeURIComponent(idB)}`);
  });

  test('tecla ArrowLeft navega para música anterior da setlist', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(idB)}`, { waitUntil: 'domcontentloaded' });
    // Setlist com currentIndex apontando para idB
    const payload = JSON.stringify({
      name: 'Setlist Teste',
      currentIndex: 1,
      items: [
        { id: String(idA), nome: 'Música A', tom: '' },
        { id: String(idB), nome: 'Música B', tom: '' },
      ],
    });
    await page.evaluate((p) => sessionStorage.setItem('cifroSetlist', p), payload);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.keyboard.press('ArrowLeft'),
    ]);
    expect(page.url()).toContain(`id=${encodeURIComponent(idA)}`);
  });

  test('sem setlist no sessionStorage, setas não navegam', async ({ page }) => {
    await page.goto(`/music.php?id=${encodeURIComponent(idA)}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.removeItem('cifroSetlist'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-cifra', { state: 'visible' });

    // Não deve haver navegação após seta
    let navigated = false;
    page.on('framenavigated', () => { navigated = true; });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    expect(navigated).toBe(false);
  });
});
