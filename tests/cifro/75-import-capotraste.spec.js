/**
 * 75-import-capotraste.spec.js
 * Importação que informa capotraste: o Cifrô propõe salvar no tom real, avisa
 * quando a conta não fecha e nunca transpõe sem confirmação.
 *
 * Usa a aba de colar texto, que passa pela mesma confirmação da aba de link
 * sem depender da rede nem do CifraClub estar no ar.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

// Corpo em Sol com capotraste 2: soa em Lá, e é isso que a página declara.
const CIFRA_COERENTE = `Música Com Capo - Artista Teste
Tom: A
Capo: 2

G  D  Em  C
letra de exemplo`;

// Mesma cifra, mas a página declara Fá — a conta não fecha.
const CIFRA_INCOERENTE = `Música Torta - Artista Teste
Tom: F
Capo: 2

G  D  Em  C
letra de exemplo`;

async function cifraNoEditor(page) {
  await page.waitForFunction(() => window.tinymce?.get('cifraInput'));
  return page.evaluate(() => window.tinymce.get('cifraInput').getContent());
}

async function abrirPreviewDeTexto(page, texto) {
  await page.goto('/src/backend/editor/editor.php', { waitUntil: 'domcontentloaded' });
  await page.click('#importSongButton');
  await page.click('#importTabTextButton');
  await page.fill('#importContent', texto);
  await page.click('#previewImportButton');
  await expect(page.locator('#importPreview')).toBeVisible();
}

// A sessao gravada em tests/.auth/user.json e compartilhada por toda a
// suite e nada garante que ela sobreviva 700+ testes: qualquer teste
// anterior que a invalide derruba este arquivo inteiro na landing page.
// fazerLogin e no-op quando a sessao vale e reloga quando nao vale.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

test.describe('Importação com capotraste', () => {
  test('propõe salvar no tom real quando a página informa capotraste', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_COERENTE);

    await expect(page.locator('#importCapoBox')).toBeVisible();
    await expect(page.locator('#importCapoTexto')).toContainText('2ª casa');
    await expect(page.locator('#importCapoTexto')).toContainText('tom real é A');
    await expect(page.locator('#importAplicarCapo')).toBeChecked();
    await expect(page.locator('#importCapoAviso')).toBeHidden();

    await page.click('#confirmImportButton');
    await expect(page.locator('#transposicaoInstrumento')).toHaveValue('2');

    // A cifra foi guardada no tom soante: as formas de Sol viraram Lá.
    const cifra = await cifraNoEditor(page);
    expect(cifra).toContain('A');
    expect(cifra).toContain('F#m');
    expect(cifra).not.toContain('Em');
  });

  test('recusar a sugestão importa a cifra como veio', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_COERENTE);
    await page.uncheck('#importAplicarCapo');
    await page.click('#confirmImportButton');

    await expect(page.locator('#transposicaoInstrumento')).toHaveValue('0');

    // Sem confirmação, nada é transposto: continua nas formas originais.
    const cifra = await cifraNoEditor(page);
    expect(cifra).toContain('Em');
    expect(cifra).not.toContain('F#m');
  });

  test('avisa e não marca a sugestão quando o tom da página não bate', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_INCOERENTE);

    await expect(page.locator('#importCapoAviso')).toBeVisible();
    await expect(page.locator('#importCapoAviso')).toContainText('Confira antes de aplicar');
    await expect(page.locator('#importAplicarCapo')).not.toBeChecked();
  });

  test('cifra sem capotraste não mostra a confirmação', async ({ page }) => {
    await abrirPreviewDeTexto(page, 'Música Simples - Artista Teste\nTom: C\n\nC  G  Am  F\nletra');

    await expect(page.locator('#importCapoBox')).toBeHidden();
  });
});
