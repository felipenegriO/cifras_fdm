/**
 * 76-capotraste-pessoal.spec.js
 * Capotraste salvo na conta do músico: proteção do endpoint, persistência
 * entre visitas e isolamento do conteúdo oficial da banda.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

const ENDPOINT = '/src/backend/users/preferencia-musica.php';
const CIFRA_FIXTURE = '<b>D A Bm G</b><br>letra da fixture<br><b>F#m Bm A D</b>';

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  const body = await response.json();
  return body.csrf_token || '';
}

async function musicaDeTeste(page) {
  const response = await page.request.get('/api/sync/data.php');
  const data = await response.json();
  const existente = data.musicas?.find(item => item?.nome === '__CAPO_PESSOAL_FIXTURE__');
  if (existente?.id) return existente.id;

  const csrf = await getCsrf(page);
  const created = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({
      nome: '__CAPO_PESSOAL_FIXTURE__',
      artista: 'Teste',
      cifra: CIFRA_FIXTURE,
      classificacao: '',
      bit: '',
      transposicao_instrumento: 0,
    }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()).id;
}

async function salvarCapo(page, musicaId, valor, extra = {}) {
  const csrf = await getCsrf(page);
  return page.request.post(ENDPOINT, {
    data: JSON.stringify({ musica_id: musicaId, transposicao_instrumento: valor, base_tom: 'D', ...extra }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
}

// A sessao gravada em tests/.auth/user.json e compartilhada por toda a
// suite e nada garante que ela sobreviva 700+ testes: qualquer teste
// anterior que a invalide derruba este arquivo inteiro na landing page.
// fazerLogin e no-op quando a sessao vale e reloga quando nao vale.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

test.describe('Capotraste pessoal — proteção do endpoint', () => {
  test('recusa requisição sem token CSRF', async ({ page }) => {
    const id = await musicaDeTeste(page);
    const resposta = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ musica_id: id, transposicao_instrumento: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resposta.status()).toBe(403);
  });

  test('recusa música que não é da banda atual', async ({ page }) => {
    const resposta = await salvarCapo(page, 999999999, 2);
    expect(resposta.status()).toBe(404);
  });

  test('recusa deslocamento fora da faixa', async ({ page }) => {
    const id = await musicaDeTeste(page);
    const resposta = await salvarCapo(page, id, 13);
    expect(resposta.status()).toBe(422);
  });
});

test.describe('Capotraste pessoal — persistência', () => {
  test('guarda a escolha do músico junto com a foto do cadastro', async ({ page }) => {
    const id = await musicaDeTeste(page);
    const resposta = await salvarCapo(page, id, 4);
    expect(resposta.ok()).toBeTruthy();

    const corpo = await resposta.json();
    expect(corpo.sucesso).toBe(true);
    expect(corpo.preferencia.transposicao_instrumento).toBe(4);
    // A base vem do servidor, nunca do cliente.
    expect(corpo.preferencia.base_transposicao).toBe(0);
  });

  test('a escolha aparece no snapshot de sincronização', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 4);

    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    const preferencia = snapshot.preferencias_musica?.find(item => Number(item.musica_id) === Number(id));

    expect(preferencia).toBeTruthy();
    expect(preferencia.transposicao_instrumento).toBe(4);
  });

  test('a escolha pessoal não altera o cadastro da banda', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 4);

    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    const musica = snapshot.musicas.find(item => Number(item.id) === Number(id));

    expect(Number(musica.transposicao_instrumento)).toBe(0);
  });

  test('remover a escolha faz voltar a valer o cadastro', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 4);
    await salvarCapo(page, id, 0, { acao: 'remover' });

    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    const preferencia = snapshot.preferencias_musica?.find(item => Number(item.musica_id) === Number(id));

    expect(preferencia).toBeUndefined();
  });

  test('escolha feita em outro aparelho chega pelo sync incremental', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 0, { acao: 'remover' });

    // O cliente cacheia o snapshot atual, ainda sem a personalização.
    await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.isArray(window.songs) && window.songs.length > 0);

    // Outro aparelho grava a escolha e alguém edita uma música, o que faz a
    // revisão da banda andar — daí o cliente pega o caminho incremental.
    await salvarCapo(page, id, 5);
    const csrf = await getCsrf(page);
    await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({
        id, nome: '__CAPO_PESSOAL_FIXTURE__', artista: 'Teste',
        cifra: CIFRA_FIXTURE, classificacao: '', bit: '', transposicao_instrumento: 0,
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });

    await page.evaluate(() => window.cifroSync?.sync(window.CIFRO_BAND_ID));
    await page.waitForFunction(
      (sid) => (window.preferenciasMusica || []).some(
        item => Number(item.musica_id) === Number(sid) && Number(item.transposicao_instrumento) === 5
      ),
      id,
      { polling: 300 }
    );

    await salvarCapo(page, id, 0, { acao: 'remover' });
  });

  test('o capotraste escolhido na tela sobrevive a recarregar a música', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 0, { acao: 'remover' });

    await page.goto('/config.php', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#cfgInstrumento', 'violao');
    await page.selectOption('#cfgTransposicaoPreferencia', 'nunca');

    await page.goto('/music.php?id=' + id, { waitUntil: 'domcontentloaded' });
    await page.click('#menuButton');
    await expect(page.locator('#increase-capo')).toBeVisible();
    await page.click('#increase-capo');
    await page.click('#increase-capo');
    await expect(page.locator('#capoValor')).toHaveText('2');

    // O salvamento é adiado em 800 ms para não disparar a cada clique.
    await page.waitForTimeout(1500);

    await page.goto('/music.php?id=' + id, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#capoValor')).toHaveText('2');
  });
});

test.describe('Capotraste pessoal — sem mudança de repertório', () => {
  test('escolha de outro aparelho chega mesmo com a revisão da banda parada', async ({ page }) => {
    const id = await musicaDeTeste(page);
    await salvarCapo(page, id, 0, { acao: 'remover' });

    // Cache quente, sem personalização, e a revisão da banda não vai andar
    // daqui para a frente — ninguém edita o repertório.
    await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.isArray(window.songs) && window.songs.length > 0);
    await page.evaluate(() => window.cifroSync?.sync(window.CIFRO_BAND_ID));

    // Outro aparelho grava a escolha. Ela vive FORA da revisão da banda, de
    // propósito: é dado pessoal e não invalida o cache dos outros músicos.
    // Por isso ela precisa chegar pelo caminho de "nada mudou" — o mais
    // percorrido do app, e o único que a traz neste cenário.
    await salvarCapo(page, id, 5);

    await page.evaluate(() => window.cifroSync?.sync(window.CIFRO_BAND_ID));
    await page.waitForFunction(
      sid => (window.preferenciasMusica || []).some(
        item => Number(item.musica_id) === Number(sid) && Number(item.transposicao_instrumento) === 5
      ),
      id,
      { polling: 300, timeout: 15000 }
    );

    await salvarCapo(page, id, 0, { acao: 'remover' });
  });
});
