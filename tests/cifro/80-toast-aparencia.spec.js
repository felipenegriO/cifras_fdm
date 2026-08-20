/**
 * 80-toast-aparencia.spec.js
 * Aparência do toast (cifroToast) — sem autenticação necessária.
 *
 * Regressão: o toast carregava a classe `toast` do Bootstrap 4 junto com a
 * própria. Como o <style> do cifro-toast.js é injetado ANTES do <link> do
 * bootstrap, o Bootstrap vencia o desempate por ordem e impunha
 * background branco, opacity:0 e flex-basis:350px. Na prática o aviso de
 * sincronização virava um retângulo branco ocupando o rodapé da tela, que
 * aparecia e sumia em ~250ms — o "piscado" relatado ao abrir uma música.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: { cookies: [], origins: [] } });

// Reproduz a ordem de carregamento do music.php: o script do toast vem antes
// da folha do Bootstrap. É essa ordem que criava o bug.
const PAGINA = `
  <!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <script src="/src/js/cifro-toast.js"></script>
  <link href="/src/css/bootstrap.min.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  </head><body class="music-page"></body></html>
`;

async function abrirComToast(page, mensagem, tipo) {
  await page.goto('/login.php');
  await page.setContent(PAGINA, { waitUntil: 'load' });
  await page.evaluate(([m, t]) => window.cifroToast(m, t), [mensagem, tipo]);
  return page.locator('.cifro-toast');
}

function estiloDoToast(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.cifro-toast');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      opacidade: Number(cs.opacity),
      fundo: cs.backgroundColor,
      alturaPx: Math.round(r.height),
      alturaDaTelaPct: Math.round((r.height * 100) / window.innerHeight)
    };
  });
}

// Extrai o brilho percebido (0 a 1) de um rgb()/rgba() computado.
function brilho(cor) {
  const n = String(cor).match(/[\d.]+/g).map(Number);
  return (0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2]) / 255;
}

test.describe('Aviso em toast na tela de música', () => {
  test('continua visível depois da animação de entrada, em vez de piscar e sumir', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirComToast(page, 'Não foi possível recuperar o pacote offline automaticamente.', 'warning');

    // A animação de entrada dura 200ms. Antes da correção, ao terminar ela a
    // opacidade voltava para o 0 herdado do Bootstrap e o aviso desaparecia.
    await page.waitForTimeout(600);

    const estilo = await estiloDoToast(page);
    expect(estilo.opacidade).toBe(1);
  });

  test('usa fundo escuro do tema, não o branco do Bootstrap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirComToast(page, 'Não foi possível recuperar o pacote offline automaticamente.', 'warning');
    await page.waitForTimeout(600);

    const estilo = await estiloDoToast(page);
    expect(brilho(estilo.fundo)).toBeLessThan(0.3);
  });

  test('ocupa apenas o rodapé, não metade da tela do celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirComToast(page, 'Não foi possível recuperar o pacote offline automaticamente.', 'warning');
    await page.waitForTimeout(600);

    // O flex-basis:350px do Bootstrap virava altura, porque a pilha de toasts
    // é uma coluna flex — o aviso engolia ~40% da tela.
    const estilo = await estiloDoToast(page);
    expect(estilo.alturaDaTelaPct).toBeLessThan(25);
  });

  test('não carrega a classe `toast` do Bootstrap', async ({ page }) => {
    const toast = await abrirComToast(page, 'Mensagem de teste', 'info');
    const classes = (await toast.getAttribute('class')).split(/\s+/);
    expect(classes).not.toContain('toast');
  });

  test('some sozinho depois do tempo de exibição', async ({ page }) => {
    await abrirComToast(page, 'Mensagem de teste', 'info');
    await expect(page.locator('.cifro-toast')).toHaveCount(0, { timeout: 6000 });
  });
});
