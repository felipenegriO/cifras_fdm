/**
 * 77-capotraste-conflito.spec.js
 * Quando o gestor muda o cadastro e o músico tinha capotraste próprio, o Cifrô
 * detecta a divergência, deixa o cadastro valendo até a decisão, e resolve nos
 * dois sentidos.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

const CIFRA_FIXTURE = '<b>D A Bm G</b><br>letra do conflito<br><b>F#m Bm A D</b>';
// Cada teste ganha a sua própria música. Compartilhar uma só fazia um teste
// enxergar o estado deixado pelo anterior — inclusive no cache do navegador.
const NOME_BASE = '__CAPO_CONFLITO_FIXTURE__';

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  return (await response.json()).csrf_token || '';
}

async function salvarMusica(page, nome, campos) {
  const csrf = await getCsrf(page);
  const resposta = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({ nome, artista: 'Teste', cifra: CIFRA_FIXTURE, classificacao: '', bit: '', ...campos }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(resposta.ok()).toBeTruthy();
  return (await resposta.json()).id;
}

/** Cria a música do teste com capotraste cadastrado 0 e devolve o id. */
async function musicaDoConflito(page, sufixo) {
  const nome = NOME_BASE + sufixo;
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  const existente = snapshot.musicas?.find(item => item?.nome === nome);
  if (existente?.id) {
    await salvarMusica(page, nome, { id: existente.id, transposicao_instrumento: 0 });
    return existente.id;
  }
  return salvarMusica(page, nome, { transposicao_instrumento: 0 });
}

/** Muda o cadastro da música do teste, como faria o gestor da banda. */
async function mudarCadastro(page, sufixo, musicaId, valor) {
  await salvarMusica(page, NOME_BASE + sufixo, { id: musicaId, transposicao_instrumento: valor });
}

async function definirCapoPessoal(page, musicaId, valor) {
  const csrf = await getCsrf(page);
  const resposta = await page.request.post('/src/backend/users/preferencia-musica.php', {
    data: JSON.stringify({ musica_id: musicaId, transposicao_instrumento: valor, base_tom: 'D' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(resposta.ok()).toBeTruthy();
}

// "Vale o cadastro" significa que a escolha pessoal fica suspensa e o app volta
// à preferência do usuário. Para observar o valor cadastrado, a preferência
// precisa ser justamente "só quando a música pedir".
async function usarSomenteOCadastro(page) {
  await page.goto('/config.php', { waitUntil: 'domcontentloaded' });
  await page.selectOption('#cfgInstrumento', 'violao');
  await page.selectOption('#cfgTransposicaoPreferencia', 'cadastrado');
  await expect(page.locator('#cfgTransposicaoPreferencia')).toHaveValue('cadastrado');
}

// O app só revalida o cache a cada 30 segundos (CHECK_INTERVAL do cifro-sync),
// então uma alteração feita há instantes ainda não chegou na tela. Num teste
// não dá para esperar isso: pedimos o sync sem throttle e aguardamos o dado.
async function esperarCadastroSincronizado(page, musicaId, valor) {
  await page.evaluate(() => window.cifroSync?.sync(window.CIFRO_BAND_ID));
  await page.waitForFunction(
    ([id, esperado]) => (window.songs || []).some(
      item => Number(item.id) === Number(id) && Number(item.transposicao_instrumento) === Number(esperado)
    ),
    [musicaId, valor]
  );
}

// A tela de pendências também parte do cache; sem forçar o sync ela julgaria
// o conflito contra o cadastro antigo.
async function abrirPendencias(page, musicaId, capoEsperado) {
  await page.goto('/pendencias.php', { waitUntil: 'domcontentloaded' });
  if (musicaId !== undefined) {
    await esperarCadastroSincronizado(page, musicaId, capoEsperado);
  }
  await expect(page.locator('#pendenciasIntro')).toBeVisible();
}

// Cada teste olha só a própria música: a tela lista as pendências de todas,
// e asserção global quebraria por causa da fixture de outro teste.
function cardDaMusica(musicaId) {
  return '.pendencia[data-musica-id="' + musicaId + '"]';
}

async function limparPessoal(page, musicaId) {
  const csrf = await getCsrf(page);
  await page.request.post('/src/backend/users/preferencia-musica.php', {
    data: JSON.stringify({ musica_id: musicaId, acao: 'remover' }),
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

test.describe('Conflito entre personalização e cadastro', () => {
  test('sem mudança no cadastro não há pendência', async ({ page }) => {
    const id = await musicaDoConflito(page, 'A');
    await definirCapoPessoal(page, id, 3);

    await abrirPendencias(page);
    await expect(page.locator(cardDaMusica(id))).toHaveCount(0);
    await limparPessoal(page, id);
  });

  test('o cadastro mudar sem eu ter divergido não vira pendência', async ({ page }) => {
    const id = await musicaDoConflito(page, 'B');
    // Escolho exatamente o que o cadastro dizia: não diverge da base.
    await definirCapoPessoal(page, id, 0);
    await mudarCadastro(page, 'B', id, 4);

    await abrirPendencias(page, id, 4);
    await expect(page.locator(cardDaMusica(id))).toHaveCount(0);
    await limparPessoal(page, id);
  });

  test('cadastro alterado com escolha divergente vira pendência', async ({ page }) => {
    const id = await musicaDoConflito(page, 'C');
    await definirCapoPessoal(page, id, 3);
    await mudarCadastro(page, 'C', id, 4);

    await abrirPendencias(page, id, 4);
    const card = page.locator(cardDaMusica(id));
    await expect(card).toBeVisible();
    await expect(card).toContainText('Cadastro antes');
    await expect(card).toContainText('Você usa');
    await limparPessoal(page, id);
  });

  test('enquanto a pendência não é resolvida vale o cadastro', async ({ page }) => {
    const id = await musicaDoConflito(page, 'D');
    await usarSomenteOCadastro(page);
    await definirCapoPessoal(page, id, 3);
    await mudarCadastro(page, 'D', id, 4);

    await page.goto('/music.php?id=' + id, { waitUntil: 'domcontentloaded' });
    await esperarCadastroSincronizado(page, id, 4);
    // 4 é o cadastro; 3 era a escolha pessoal, que fica suspensa.
    await expect(page.locator('#capoValor')).toHaveText('4');
    await limparPessoal(page, id);
  });

  test('resolver por usar o do cadastro apaga a escolha pessoal', async ({ page }) => {
    const id = await musicaDoConflito(page, 'E');
    await definirCapoPessoal(page, id, 3);
    await mudarCadastro(page, 'E', id, 4);

    await abrirPendencias(page, id, 4);
    await page.locator(cardDaMusica(id)).getByRole('button', { name: 'Usar o do cadastro' }).click();
    await expect(page.locator(cardDaMusica(id))).toHaveCount(0);

    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    expect(snapshot.preferencias_musica?.find(item => Number(item.musica_id) === Number(id))).toBeUndefined();
  });

  test('resolver por manter o meu conserva a escolha e encerra a pendência', async ({ page }) => {
    const id = await musicaDoConflito(page, 'F');
    await usarSomenteOCadastro(page);
    await definirCapoPessoal(page, id, 3);
    await mudarCadastro(page, 'F', id, 4);

    await abrirPendencias(page, id, 4);
    await page.locator(cardDaMusica(id)).getByRole('button', { name: 'Manter o meu' }).click();
    await expect(page.locator(cardDaMusica(id))).toHaveCount(0);

    const snapshot = await (await page.request.get('/api/sync/data.php')).json();
    const preferencia = snapshot.preferencias_musica?.find(item => Number(item.musica_id) === Number(id));
    expect(preferencia.transposicao_instrumento).toBe(3);
    // A base passou a ser o cadastro novo, então não conflita de novo.
    expect(preferencia.base_transposicao).toBe(4);

    await page.goto('/music.php?id=' + id, { waitUntil: 'domcontentloaded' });
    await esperarCadastroSincronizado(page, id, 4);
    await expect(page.locator('#capoValor')).toHaveText('3');
    await limparPessoal(page, id);
  });
});
