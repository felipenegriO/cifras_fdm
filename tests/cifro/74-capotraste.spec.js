/**
 * 74-capotraste.spec.js
 * Capotraste e transposição de instrumento: preferência do usuário, controles
 * na tela de música e a garantia de que pôr ou tirar o capo nunca mexe no tom
 * soante — que é o que a banda inteira usa como referência.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

// A cifra da fixture está em Ré e traz F#m e Bm: é o caso em que o nível
// básico do violão tem ganho real (capo 2 troca as duas por Am e Em).
const CIFRA_FIXTURE = '<b>D A Bm G</b><br>letra da fixture<br><b>F#m Bm A D</b>';

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  const body = await response.json();
  return body.csrf_token || '';
}

async function musicaComPestana(page) {
  const response = await page.request.get('/api/sync/data.php');
  const data = await response.json();
  const existente = data.musicas?.find(item => item?.nome === '__CAPOTRASTE_FIXTURE__');
  if (existente?.id) return existente.id;

  const csrf = await getCsrf(page);
  const created = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({
      nome: '__CAPOTRASTE_FIXTURE__',
      artista: 'Teste',
      cifra: CIFRA_FIXTURE,
      classificacao: '',
      bit: '',
      transposicao_instrumento: 0,
    }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.id).toBeTruthy();
  return body.id;
}

// A gaveta de ajustes entra deslizando. Clicar no stepper antes de ela parar
// deixa o teste intermitente, então esperamos o controle estar de fato lá.
async function abrirAjustes(page) {
  await page.click('#menuButton');
  await expect(page.locator('#increase-capo')).toBeVisible();
}

async function definirPreferencia(page, instrumento, preferencia) {
  await page.goto('/config.php', { waitUntil: 'domcontentloaded' });
  await page.selectOption('#cfgInstrumento', instrumento);
  await page.selectOption('#cfgTransposicaoPreferencia', preferencia);
  await expect(page.locator('#cfgTransposicaoPreferencia')).toHaveValue(preferencia);
}

// A sessao gravada em tests/.auth/user.json e compartilhada por toda a
// suite e nada garante que ela sobreviva 700+ testes: qualquer teste
// anterior que a invalide derruba este arquivo inteiro na landing page.
// fazerLogin e no-op quando a sessao vale e reloga quando nao vale.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

test.describe('Capotraste e transposição de instrumento', () => {
  test('as configurações trocam o vocabulário conforme o instrumento', async ({ page }) => {
    await page.goto('/config.php', { waitUntil: 'domcontentloaded' });

    await page.selectOption('#cfgInstrumento', 'violao');
    await expect(page.locator('#cfgCapoTermo')).toHaveText('capotraste');
    await expect(page.locator('#cfgCapoDesc')).toContainText('pestana');

    await page.selectOption('#cfgInstrumento', 'teclado');
    await expect(page.locator('#cfgCapoTermo')).toHaveText('transpose');
    await expect(page.locator('#cfgCapoDesc')).toContainText('teclas pretas');
  });

  test('a preferência escolhida sobrevive ao recarregar a página', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'basico');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#cfgInstrumento')).toHaveValue('violao');
    await expect(page.locator('#cfgTransposicaoPreferencia')).toHaveValue('basico');
  });

  test('quem nunca usa capotraste vê a cifra no tom original', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'nunca');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#capoValor')).toHaveText('0');
    await expect(page.locator('#tom')).toHaveText('D');
    await expect(page.locator('#song-cifra')).toContainText('Bm');
  });

  test('o nível básico propõe o capotraste que elimina a pestana', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'basico');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });

    // Capo 2: as formas caem para Dó, onde F#m e Bm viram Em e Am.
    await expect(page.locator('#capoValor')).toHaveText('2');
    await expect(page.locator('#capoInfo')).toContainText('formas em C');
    // O tom mostrado continua sendo o que SOA, não o das formas.
    await expect(page.locator('#tom')).toHaveText('D');
    await expect(page.locator('#song-cifra')).not.toContainText('Bm');
  });

  test('pôr e tirar o capotraste não altera o tom soante exibido', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'basico');
    const id = await musicaComPestana(page);

    // A barra rápida é o lugar do botão de pôr e tirar, e no desktop ela vem
    // oculta. Ligar pela preferência salva evita depender da animação da
    // gaveta de ajustes só para alcançar o switch.
    await page.addInitScript(() => localStorage.setItem('musicShowQuickBar', '1'));
    await page.goto('/music.php?id=' + id, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#tom')).toHaveText('D');
    await expect(page.locator('#musicQuickBar')).toBeVisible();
    await expect(page.locator('#quickCapo')).toHaveAttribute('aria-pressed', 'true');

    await page.click('#quickCapo');
    await expect(page.locator('#capoValor')).toHaveText('0');
    await expect(page.locator('#quickCapo')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#tom')).toHaveText('D');
    await expect(page.locator('#song-cifra')).toContainText('Bm');

    await page.click('#quickCapo');
    await expect(page.locator('#capoValor')).toHaveText('2');
    await expect(page.locator('#tom')).toHaveText('D');
  });

  test('o stepper move o capotraste sem mexer no tom soante', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'nunca');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });
    await abrirAjustes(page);

    await page.click('#increase-capo');
    await expect(page.locator('#capoValor')).toHaveText('1');
    await expect(page.locator('#capoInfo')).toContainText('formas em C#');
    await expect(page.locator('#tom')).toHaveText('D');

    await page.click('#decrease-capo');
    await expect(page.locator('#capoValor')).toHaveText('0');
    await expect(page.locator('#capoInfo')).toHaveText('');
  });

  test('o violão não aceita capotraste negativo', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'nunca');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });
    await abrirAjustes(page);

    await page.click('#decrease-capo');
    await expect(page.locator('#capoValor')).toHaveText('0');
  });

  test('mudar o tom mantém o capotraste posto à mão', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'nunca');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });
    await abrirAjustes(page);

    await page.click('#increase-capo');
    await expect(page.locator('#capoValor')).toHaveText('1');

    await page.click('#increase-tom');
    await expect(page.locator('#tom')).toHaveText('D#');
    // Posto na mão, o capotraste fica onde o músico deixou.
    await expect(page.locator('#capoValor')).toHaveText('1');
  });

  test('o modo ao vivo publica o tom soante, não o das formas', async ({ page }) => {
    await definirPreferencia(page, 'violao', 'basico');
    await page.goto('/music.php?id=' + (await musicaComPestana(page)), { waitUntil: 'domcontentloaded' });

    // Com capo 2 as formas estão em Dó, mas o que o live publica é o tom que
    // soa — é assim que host com capo e seguidor sem capo tocam junto.
    await expect(page.locator('#capoValor')).toHaveText('2');
    await expect(page.locator('#song-cifra')).toHaveAttribute('data-tom-soante', 'D');
  });
});
