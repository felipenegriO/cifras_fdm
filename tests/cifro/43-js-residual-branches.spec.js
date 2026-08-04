import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function load(page, src) {
  await page.evaluate(src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }), src);
}

test('tema cobre tamanho válido, tema claro e fallback padrão', async ({ page }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => {
    localStorage.setItem('cifro-cifra-size', '23');
    localStorage.setItem('cifro-theme', 'light');
    delete window.cifroTheme;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/src/js/cifro-theme.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const size = document.documentElement.style.getPropertyValue('--cifra-size');
    const light = window.cifroTheme.get();
    localStorage.removeItem('cifro-theme');
    const fallback = window.cifroTheme.get();
    window.cifroTheme.set('auto');
    return { size, light, fallback, hasTheme: document.documentElement.hasAttribute('data-theme') };
  });
  expect(result).toEqual({ size: '23px', light: 'light', fallback: 'dark', hasTheme: false });
});

test('sanitização cobre nó destacado, atributos e conteúdo vazio', async ({ page }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => {
    const NativeDOMParser = window.DOMParser;
    window.DOMParser = class {
      parseFromString() {
        const detached = document.createElement('script');
        return { body: { querySelectorAll: () => [detached], innerHTML: '' } };
      }
    };
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/src/js/cifro-sanitize.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const detached = window.cifroSanitizeCifra('x');
    window.DOMParser = NativeDOMParser;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/src/js/cifro-sanitize.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return {
      detached,
      empty: window.cifroSanitizeCifra(null),
      clean: window.cifroSanitizeCifra('<b onclick="x">C  G</b><script>alert(1)</script>'),
    };
  });
  expect(result.detached).toBe('');
  expect(result.empty).toBe('');
  expect(result.clean).toContain('<b>C &nbsp;G</b>');
  expect(result.clean).not.toContain('<script');
});

test('roteiros cobre contêiner ausente, href vazio e fallbacks de data', async ({ page }) => {
  await page.goto('/roteiro.php?id=77');
  await load(page, '/src/js/roteiros.js');
  const result = await page.evaluate(() => {
    renderRoteiro('__ausente__', 'texto');
    const container = document.createElement('div');
    container.id = '__roteiro_cobertura__';
    document.body.appendChild(container);
    renderRoteiro(container.id, '<a>Sem href</a><a href="">Vazio</a><a href="javascript:x">Ruim</a><a href="outra">Música 42</a>');
    return {
      invalidDate: isRoteiroVisible({ visivel_ate: 'invalida' }),
      emptyDate: formatRoteiroDate(null),
      malformedDate: formatRoteiroDate('2026-08'),
      html: container.innerHTML,
      external: addRoteiroReturn('/outra', '77'),
      repeated: addRoteiroReturn('music.php?id=1&from=roteiro', '77'),
    };
  });
  expect(result.invalidDate).toBe(true);
  expect(result.emptyDate).toBe('');
  expect(result.malformedDate).toBe('');
  expect(result.html).toContain('music.php?id=42');
  expect(result.html).not.toContain('javascript:');
  expect(result.external).toBe('/outra');
  expect(result.repeated).toBe('music.php?id=1&from=roteiro');
});

test('acordes cobre entradas vazias, tonalidades inválidas e transposição textual', async ({ page }) => {
  await page.goto('/index.php');
  await load(page, '/src/js/chords.js');
  const result = await page.evaluate(() => ({
    unchanged: CifroChords.transposeHtml('', 2),
    invalid: CifroChords.transposeToKey(null, 'H', 'C'),
    text: CifroChords.transposeHtml('C G\nletra comum', 2),
    interval: CifroChords.intervalBetweenKeys('C', 'D'),
    minor: CifroChords.keysForMode('minor').length,
  }));
  expect(result.unchanged).toBe('');
  expect(result.invalid).toBe('');
  expect(result.text).toContain('D A');
  expect(result.text).toContain('letra comum');
  expect(result.interval).toBe(2);
  expect(result.minor).toBeGreaterThan(0);
});
