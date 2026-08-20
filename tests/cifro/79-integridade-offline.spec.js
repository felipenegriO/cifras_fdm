import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';
import { aguardarServidorDisponivel } from '../helpers/conectividade.js';

/**
 * STAGE-001 — integridade física do armazenamento local.
 *
 * O que estes testes protegem: o app não pode concluir "tudo certo" só porque
 * a revisão do servidor é igual à gravada. Se o navegador descartou parte do
 * IndexedDB, a revisão continua igual e o músico fica sem repertório no palco
 * sem que nada tente recuperar.
 */

async function apagarLinha(page, store) {
  return page.evaluate(async store => {
    const banco = await new Promise((resolve, reject) => {
      const pedido = indexedDB.open('cifro');
      pedido.onsuccess = evento => resolve(evento.target.result);
      pedido.onerror = evento => reject(evento.target.error);
    });
    const chave = String(window.CIFRO_USER_ID) + ':' + String(window.CIFRO_BAND_ID);
    await new Promise((resolve, reject) => {
      const transacao = banco.transaction(store, 'readwrite');
      transacao.objectStore(store).delete(chave);
      transacao.oncomplete = resolve;
      transacao.onerror = () => reject(transacao.error);
    });
    banco.close();
  }, store);
}

async function lerLinha(page, store) {
  return page.evaluate(async store => {
    const banco = await new Promise((resolve, reject) => {
      const pedido = indexedDB.open('cifro');
      pedido.onsuccess = evento => resolve(evento.target.result);
      pedido.onerror = evento => reject(evento.target.error);
    });
    const chave = String(window.CIFRO_USER_ID) + ':' + String(window.CIFRO_BAND_ID);
    const linha = await new Promise((resolve, reject) => {
      const transacao = banco.transaction(store, 'readonly');
      const pedido = transacao.objectStore(store).get(chave);
      pedido.onsuccess = () => resolve(pedido.result ?? null);
      transacao.onerror = () => reject(transacao.error);
    });
    banco.close();
    return linha;
  }, store);
}

async function gravarLinha(page, store, linha) {
  return page.evaluate(async ({ store, linha }) => {
    const banco = await new Promise((resolve, reject) => {
      const pedido = indexedDB.open('cifro');
      pedido.onsuccess = evento => resolve(evento.target.result);
      pedido.onerror = evento => reject(evento.target.error);
    });
    await new Promise((resolve, reject) => {
      const transacao = banco.transaction(store, 'readwrite');
      transacao.objectStore(store).put(linha);
      transacao.oncomplete = resolve;
      transacao.onerror = () => reject(transacao.error);
    });
    banco.close();
  }, { store, linha });
}

async function prepararRepertorioLocal(page) {
  await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
  await aguardarServidorDisponivel(page);
  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
  await expect
    .poll(() => page.evaluate(async () => {
      const linha = await cifroSync.getSyncStatus(window.CIFRO_BAND_ID);
      return linha.snapshotValid;
    }), { timeout: 15000 })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  // DEBT-003: a sessão gravada não sobrevive à bateria inteira; cada arquivo
  // precisa garantir a sua.
  await fazerLogin(page);
});

test('perda do snapshot com metadados intactos é reconstruída na sincronização', async ({ page }) => {
  await prepararRepertorioLocal(page);
  const antes = await lerLinha(page, 'cifro_snapshot_current');
  expect(antes?.data?.musicas.length).toBeGreaterThan(0);

  // O dano que o navegador causa sob pressão de armazenamento: leva o
  // snapshot e deixa os metadados, então a revisão continua batendo e o app
  // de hoje encerra a sincronização sem reconstruir nada.
  await apagarLinha(page, 'cifro_snapshot_current');
  expect(await lerLinha(page, 'cifro_snapshot_current')).toBeNull();
  const meta = await lerLinha(page, 'cifro_sync_meta');
  expect(Number(meta.content_revision)).toBe(Number(antes.content_revision));

  // O app precisa concluir a sincronização com sucesso E ter o snapshot de
  // volta. Hoje ele devolve sucesso justamente sem reconstruir nada — é essa
  // combinação, e não a falha de rede, que este teste tranca.
  const sincronizou = await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  expect(sincronizou).toBeTruthy();

  await expect
    .poll(async () => (await lerLinha(page, 'cifro_snapshot_current'))?.data?.musicas?.length ?? 0, { timeout: 15000 })
    .toBeGreaterThan(0);

  const depois = await lerLinha(page, 'cifro_snapshot_current');
  expect(Number(depois.content_revision)).toBe(Number(antes.content_revision));
  expect(depois.data.musicas.length).toBe(antes.data.musicas.length);
});

/**
 * Derruba o servidor do ponto de vista do app sem desligar a rede do
 * navegador. Desligar a rede de verdade impediria a própria navegação — no
 * projeto `cifro` o service worker é bloqueado, então não há página cacheada
 * para servir. O que estes testes precisam é de `isOnline()` falso, que é o
 * que faz o `cifro-sync` tomar o caminho offline.
 */
async function derrubarServidor(page) {
  await page.route('**/health.php*', route => route.abort());
  await page.route('**/api/sync/**', route => route.abort());
  await expect
    .poll(() => page.evaluate(async () => {
      await window.CifroConnectivity.probe({ force: true }).catch(() => false);
      return window.CifroConnectivity.isServerAvailable();
    }), { timeout: 15000 })
    .toBe(false);
}

test('sem servidor, snapshot perdido é reconstruído a partir das linhas locais', async ({ page }) => {
  await prepararRepertorioLocal(page);
  const antes = await lerLinha(page, 'cifro_snapshot_current');
  expect(antes?.data?.musicas.length).toBeGreaterThan(0);

  await apagarLinha(page, 'cifro_snapshot_current');
  await derrubarServidor(page);

  await page.evaluate(() => cifroSync.load(window.CIFRO_BAND_ID));

  // Sem servidor não dá para baixar nada, mas as linhas por store
  // sobreviveram — o repertório precisa voltar delas, em vez de ficar
  // dependendo do próximo acesso com internet, que pode só acontecer depois
  // do culto.
  await expect
    .poll(async () => (await lerLinha(page, 'cifro_snapshot_current'))?.data?.musicas?.length ?? 0, { timeout: 15000 })
    .toBe(antes.data.musicas.length);
});

test('reparo não sobrescreve repertório bom com snapshot vazio', async ({ page }) => {
  await prepararRepertorioLocal(page);
  const antes = await lerLinha(page, 'cifro_snapshot_current');
  expect(antes?.data?.musicas.length).toBeGreaterThan(0);

  // O pior dano: some o snapshot E a linha de músicas. Reconstruir "do que
  // sobrou" aqui produziria um repertório vazio que parece válido, e o
  // snapshot bom seria empurrado para previous e perdido no ciclo seguinte.
  await apagarLinha(page, 'cifro_snapshot_current');
  await apagarLinha(page, 'cifro_musicas');
  await derrubarServidor(page);

  await page.evaluate(() => cifroSync.load(window.CIFRO_BAND_ID));
  await page.waitForTimeout(1500);

  const atual = await lerLinha(page, 'cifro_snapshot_current');
  expect(atual?.data?.musicas?.length ?? 0).toBe(antes.data.musicas.length);
});

test('aparelho que não consegue gravar baixa o repertório uma vez por sessão', async ({ page }) => {
  await prepararRepertorioLocal(page);
  await apagarLinha(page, 'cifro_snapshot_current');

  // Servidor responde, mas o que volta não passa na validação: simula o
  // aparelho que baixa e não consegue gravar (quota estourada, modo
  // privativo). A integridade continua falhando depois da tentativa.
  let downloads = 0;
  await page.route('**/api/sync/data.php*', async route => {
    downloads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ banda_id: null, content_revision: 'invalida', musicas: 'nao-e-array' }),
    });
  });

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  }

  // Sem limitador, cada página aberta num aparelho quebrado puxa o
  // repertório inteiro de novo — um punhado deles vira carga constante
  // contra o servidor.
  expect(downloads).toBe(1);
});

test('falha de recuperação avisa o músico uma única vez', async ({ page }) => {
  await prepararRepertorioLocal(page);
  await apagarLinha(page, 'cifro_snapshot_current');
  await page.evaluate(() => {
    window.__avisos = [];
    document.addEventListener('cifro:integridade-falhou', evento => window.__avisos.push(evento.detail?.motivo || ''));
  });
  await page.route('**/api/sync/data.php*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: null, content_revision: 'invalida', musicas: 'nao-e-array' }),
  }));

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));
  }

  const avisos = await page.evaluate(() => window.__avisos);
  expect(avisos).toHaveLength(1);
  expect(avisos[0]).toMatch(/store_ausente/);
});

test('músico vê aviso na tela quando o repertório não pôde ser recuperado', async ({ page }) => {
  await prepararRepertorioLocal(page);
  await apagarLinha(page, 'cifro_snapshot_current');
  await page.route('**/api/sync/data.php*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ banda_id: null, content_revision: 'invalida', musicas: 'nao-e-array' }),
  }));

  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));

  // Texto exato de propósito: nesta bateria o service worker é bloqueado, e o
  // offline-tools já emite avisos genéricos sobre pacote incompleto. Casar
  // por "offline" ou "recuperado" pegaria aquele toast e o teste passaria sem
  // testar nada.
  const aviso = page.locator('.cifro-toast-message', {
    hasText: 'O repertório salvo neste aparelho está incompleto e não pôde ser recuperado.',
  });
  await expect(aviso).toHaveCount(1, { timeout: 10000 });
});

test('snapshot truncado com revisão certa é detectado e refeito', async ({ page }) => {
  await prepararRepertorioLocal(page);
  const antes = await lerLinha(page, 'cifro_snapshot_current');
  expect(antes?.data?.musicas.length).toBeGreaterThan(0);

  // O dano mais traiçoeiro: a linha existe, a revisão bate, as coleções são
  // arrays — só que o repertório sumiu de dentro. Existência e revisão não
  // pegam isso; só a contagem gravada no momento da escrita pega.
  await gravarLinha(page, 'cifro_snapshot_current', {
    ...antes,
    data: { ...antes.data, musicas: [] },
  });
  expect((await lerLinha(page, 'cifro_snapshot_current')).data.musicas).toHaveLength(0);

  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));

  await expect
    .poll(async () => (await lerLinha(page, 'cifro_snapshot_current'))?.data?.musicas?.length ?? 0, { timeout: 15000 })
    .toBe(antes.data.musicas.length);
});

test('perda de uma única coleção com snapshot intacto é reparada', async ({ page }) => {
  await prepararRepertorioLocal(page);
  const antes = await lerLinha(page, 'cifro_snapshot_current');
  expect(antes?.data?.musicas.length).toBeGreaterThan(0);

  // O snapshot continua lá e íntegro; some só a linha por store. Nada no
  // conteúdo visível quebra hoje — e é por isso que passa despercebido: a
  // reconstrução a partir das linhas deixa de ser possível sem ninguém notar,
  // e o buraco só aparece quando ela for necessária, offline.
  await apagarLinha(page, 'cifro_musicas');
  expect(await lerLinha(page, 'cifro_musicas')).toBeNull();
  expect(await lerLinha(page, 'cifro_snapshot_current')).not.toBeNull();

  await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID));

  await expect
    .poll(async () => (await lerLinha(page, 'cifro_musicas'))?.data?.length ?? 0, { timeout: 15000 })
    .toBe(antes.data.musicas.length);
});
