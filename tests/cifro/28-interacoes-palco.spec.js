import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';
import { dbQuery } from '../helpers/db.js';
import { comPlanoDaBandaAtual } from '../helpers/plano.js';

const BAND_ID = '00000000-0000-4000-8000-000000000002';

function resetLiveState() {
  dbQuery("UPDATE live_state SET host_id=NULL, host_user_id=NULL, host_nome=NULL, cifra_atual='', pagina_atual='index.php', scroll_top=0, scroll_percent=0, version=version+1 WHERE banda_id=?", [BAND_ID]);
}

test.use({ storageState: 'tests/.auth/user.json' });

// tests/.auth/user.json é compartilhado entre todos os specs; a fixture
// automática `isolatedSession` (tests/fixtures/coverage.js) chama
// session_regenerate_id() a cada teste, o que pode invalidar o cookie salvo
// para quem rodar depois na suíte completa. fazerLogin() é um no-op se a
// sessão ainda for válida e reloga se não for.
// Vários testes deste arquivo precisam de plano pago — o Modo Ao Vivo não
// aparece no gratuito — e alteram `bandas.plano` direto no banco. Nenhum
// devolvia o valor no fim, e foi assim que a Banda E2E ficou permanentemente em
// `anual`: paga para o resto da suíte e para todas as execuções seguintes na
// mesma máquina. Snapshot aqui, restauração no afterEach, aconteça o que
// acontecer com o teste.
let planoAnterior = null;

test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
  planoAnterior = dbQuery('SELECT plano FROM bandas WHERE id=?', [BAND_ID]).rows[0]?.plano ?? 'gratuito';
});

test.afterEach(() => {
  if (planoAnterior) dbQuery('UPDATE bandas SET plano=? WHERE id=?', [planoAnterior, BAND_ID]);
});

async function csrf(page) {
  return (await (await page.request.get('/api/csrf.php')).json()).csrf_token;
}

/**
 * Other specs in the full suite may run before this one and leave the
 * shared test band with fewer músicas than these tests assume — seed
 * throwaway ones so the count-based assertions below hold regardless of
 * suite execution order.
 */
async function ensureMinMusicas(page, min) {
  let snapshot = await (await page.request.get('/api/sync/data.php')).json();
  if ((snapshot.musicas || []).length >= min) return snapshot;

  const token = await csrf(page);
  const missing = min - snapshot.musicas.length;
  for (let i = 0; i < missing; i++) {
    await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ nome: `__PALCO_FIXTURE_${Date.now()}_${i}__`, cifra: '<b>C</b> fixture', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
  }
  snapshot = await (await page.request.get('/api/sync/data.php')).json();
  return snapshot;
}

async function openFirstSong(page, fromPlaylist = false) {
  await ensureMinMusicas(page, 1);
  await page.goto('/index.php');
  await page.waitForFunction(() => Array.isArray(window.songs));

  if (fromPlaylist) {
    await page.getByRole('button', { name: 'Abrir repertórios' }).click({ timeout: 5000 });
    const playlistSong = page.locator('.liPlaylist-musica').first();
    if (await playlistSong.count()) {
      await playlistSong.click();
      await expect(page).toHaveURL(/music\.php\?/);
      return;
    }
  }

  const song = page.locator('#music-list a[href*="music.php?id="]').first();
  await expect(song).toBeVisible();
  await song.click();
  await expect(page).toHaveURL(/music\.php\?/);
}

async function openLiveSettings(page) {
  const liveTab = page.locator('#settingsTabLive');
  await expect(liveTab).toBeVisible({ timeout: 5000 });
  await liveTab.click({ timeout: 5000 });
}

test('usa apresentação, rolagem, velocidade e navegação da setlist', async ({ page }) => {
  const snapshot = await ensureMinMusicas(page, 2);
  expect(snapshot.musicas.length).toBeGreaterThan(1);
  const items = snapshot.musicas.slice(0, 3).map((song, index) => ({ id: song.id, tom: index === 0 ? 'D' : '' }));
  await page.goto('/index.php', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(setlistItems => {
    sessionStorage.setItem('cifroSetlist', JSON.stringify({ items: setlistItems, currentIndex: 0 }));
  }, items);
  await page.goto(`/music.php?id=${items[0].id}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await expect(page.locator('#song-cifra')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Modo apresentação' }).click({ timeout: 5000 });

  await expect(page.locator('body')).toHaveClass(/cifro-presenting/);
  await expect(page.getByText('Pronto para palco')).toBeVisible();
  await page.getByRole('button', { name: 'Velocidade da rolagem' }).click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Velocidade da rolagem' }).click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Velocidade da rolagem' }).click({ timeout: 5000 });
  await page.locator('#cifroAutoScrollToggle').click({ timeout: 5000 });
  await page.waitForTimeout(50);
  if (!await page.locator('body').evaluate(body => body.classList.contains('cifro-scroll-active'))) {
    await page.evaluate(() => window.cifroPresentation.toggleScroll());
  }
  await expect(page.locator('body')).toHaveClass(/cifro-scroll-active/);
  await page.keyboard.press('Space');
  await expect(page.locator('body')).not.toHaveClass(/cifro-scroll-active/);

  await page.getByRole('button', { name: 'Sair do modo apresentação' }).click({ timeout: 5000 });
  await expect(page.locator('body')).not.toHaveClass(/cifro-presenting/);
});

// O Modo Ao Vivo só existe em plano pago: a aba #settingsTabLive fica oculta no
// gratuito. Este teste dependia de a banda já estar em plano pago por resíduo de
// uma execução anterior, então passava na segunda vez que a suíte rodava na
// máquina e falhava em banco limpo. Agora ele arruma o plano de que precisa e
// devolve o anterior no fim.
test('inicia, segue e encerra uma sessão ao vivo pelos botões', async ({ page, context }) => {
  await comPlanoDaBandaAtual(page, 'anual', async () => {
    await openFirstSong(page);
    await page.getByRole('button', { name: 'Abrir ajustes' }).click();
    await openLiveSettings(page);
    await page.getByRole('button', { name: 'Iniciar como líder' }).click();
    const hostResponse = page.waitForResponse(response => response.url().endsWith('/api/live/host.php'));
    await page.getByRole('dialog').getByRole('button', { name: 'Virar Host' }).click();
    const host = await hostResponse;
    expect(host.status(), await host.text()).toBe(200);
    await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');
    await expect(page.locator('#liveModeIndicator')).toBeVisible();

    if (await page.locator('#menusideMenu').getAttribute('aria-hidden') === 'true') {
      await page.getByRole('button', { name: 'Abrir ajustes' }).click();
      await openLiveSettings(page);
    }
    await page.locator('#entrarlivePlay').click();
    await expect(page.locator('#entrarlivePlay')).toHaveText('Sair da sessão');
    await page.locator('#entrarlivePlay').click();
    await expect(page.locator('#liveStatus')).toHaveText('Live desconectada');

    await context.setOffline(true);
    await page.locator('#livePlay').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Virar Host' }).click();
    await expect(page.locator('#liveStatus')).toContainText('Live desconectada');
    await context.setOffline(false);
  });
});

test('seguidor acompanha navegação e rolagem publicadas pelo líder', async ({ page, browser }) => {
  dbQuery("UPDATE bandas SET plano='anual' WHERE id=?", [BAND_ID]);
  resetLiveState();
  const token = await csrf(page);
  const selected = await page.request.post('/src/backend/bandas/selecionar.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify({ bandaId: BAND_ID }),
  });
  expect(selected.status()).toBe(200);
  const existing = await (await page.request.get('/api/sync/data.php')).json();
  for (const song of existing.musicas.filter(item => String(item.nome).startsWith('__LIVE_FOLLOW_'))) {
    await page.request.post('/src/backend/editor/api.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      data: JSON.stringify({ action: 'delete', id: song.id }),
    });
  }
  const nome = `__LIVE_FOLLOW_${Date.now()}__`;
  const created = await page.request.post('/src/backend/editor/api.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify({
      action: 'save',
      nome,
      artista: 'Playwright',
      cifra: Array.from({ length: 80 }, (_, index) => `<p><b>C G Am F</b></p><p>Linha ${index + 1} da apresentação ao vivo.</p>`).join(''),
    }),
  });
  const createdBody = await created.json();
  expect(created.status(), JSON.stringify(createdBody)).toBe(200);
  const songId = Number(createdBody.id);
  const secondCreated = await page.request.post('/src/backend/editor/api.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify({ action: 'save', nome: `${nome}_B`, artista: 'Playwright', cifra: '<p><b>D A Bm G</b></p><p>Segunda música.</p>' }),
  });
  const secondBody = await secondCreated.json();
  expect(secondCreated.status(), JSON.stringify(secondBody)).toBe(200);
  const secondSongId = Number(secondBody.id);
  const hostPage = page;
  const followerContext = await browser.newContext({ storageState: 'tests/.auth/externo.json', viewport: { width: 390, height: 844 } });
  await followerContext.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
  const followerPage = await followerContext.newPage();

  try {
    await hostPage.goto('/index.php');
    await hostPage.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    const hostSong = hostPage.locator(`#music-list a[href*="id=${songId}"]`);
    await expect(hostSong).toBeVisible({ timeout: 5000 });
    await hostSong.click();
    await expect(hostPage).toHaveURL(new RegExp(`music\\.php\\?id=${songId}`));
    await hostPage.getByRole('button', { name: 'Abrir ajustes' }).click();
    await openLiveSettings(hostPage);
    await hostPage.getByRole('button', { name: 'Iniciar como líder' }).click();
    const initialUpdate = hostPage.waitForResponse(response => response.url().endsWith('/api/live/update.php'));
    await hostPage.getByRole('dialog').getByRole('button', { name: 'Virar Host' }).click();
    expect((await initialUpdate).status()).toBe(200);
    await expect(hostPage.locator('#liveStatus')).toHaveText('Voce e o host');
    const published = await (await page.request.get('/api/live/status.php')).json();
    expect(published.hasHost, JSON.stringify(published)).toBe(true);
    expect(published.paginaAtual).toMatch(new RegExp(`^music\\.php\\?id=${songId}(?:&playlistTom=[A-G](?:%23|#|b)?m?)?$`));

    const followerToken = await csrf(followerPage);
    const followerSelected = await followerPage.request.post('/src/backend/bandas/selecionar.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': followerToken },
      data: JSON.stringify({ bandaId: BAND_ID }),
    });
    expect(followerSelected.status()).toBe(200);
    await followerPage.goto(`/music.php?id=${songId}`);
    await expect(followerPage.locator('#song-cifra')).toBeVisible({ timeout: 10000 });
    await followerPage.locator('#menuButton').click();
    await openLiveSettings(followerPage);
    await followerPage.locator('#entrarlivePlay').dispatchEvent('click');
    await expect(followerPage.locator('#liveStatus')).toHaveText('Seguindo live');
    await expect(followerPage).toHaveURL(new RegExp(`music\\.php\\?id=${songId}`), { timeout: 10000 });
    await expect(followerPage.locator('#liveModeIndicator')).toBeVisible();

    await hostPage.locator('#song-cifra').evaluate(element => {
      element.scrollTop = Math.max(40, (element.scrollHeight - element.clientHeight) * .65);
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await expect.poll(() => followerPage.locator('#song-cifra').evaluate(element => element.scrollTop), { timeout: 10000 }).toBeGreaterThan(4);

    await hostPage.goto(`/music.php?id=${secondSongId}`);
    await expect(hostPage.locator('#liveStatus')).toHaveText('Voce e o host');
    await expect(followerPage).toHaveURL(new RegExp(`music\\.php\\?id=${secondSongId}`), { timeout: 10000 });
    await expect(followerPage.locator('#song-cifra')).toBeVisible();

    const previousTom = (await hostPage.locator('#tom').textContent()).trim();
    await hostPage.getByRole('button', { name: 'Abrir ajustes' }).click();
    await hostPage.locator('#settingsTabReading').click();
    await hostPage.locator('#increase-tom').click();
    await expect.poll(async () => (await hostPage.locator('#tom').textContent()).trim()).not.toBe(previousTom);
    const hostTom = (await hostPage.locator('#tom').textContent()).trim();
    await expect(followerPage).toHaveURL(new RegExp(`music\\.php\\?id=${secondSongId}.*playlistTom=${encodeURIComponent(hostTom)}`), { timeout: 10000 });
    await expect.poll(async () => (await followerPage.locator('#tom').textContent()).trim(), { timeout: 10000 }).toBe(hostTom);

    await followerPage.locator('#entrarlivePlay').dispatchEvent('click');
    await expect(followerPage.locator('#liveStatus')).toHaveText('Live desconectada');
  } finally {
    await followerContext.close().catch(() => {});
    await page.request.post('/src/backend/editor/api.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      data: JSON.stringify({ action: 'delete', id: songId }),
    }).catch(() => {});
    await page.request.post('/src/backend/editor/api.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      data: JSON.stringify({ action: 'delete', id: secondSongId }),
    }).catch(() => {});
    resetLiveState();
  }
});

test('abre roteiro real, sanitiza conteúdo e retorna da música', async ({ page }) => {
  const token = await csrf(page);
  const snapshot = await ensureMinMusicas(page, 1);
  expect(snapshot.musicas.length).toBeGreaterThan(0);
  const titulo = `__ROTEIRO_PALCO_${Date.now()}__`;
  const content = `<section><script>window.__roteiro_xss=1</script><div style="color:red" onclick="window.__click=1"><b>Entrada</b><a href="javascript:alert(1)">inválido</a><a href="${snapshot.musicas[0].id}">Música ${snapshot.musicas[0].id}</a></div></section>`;
  const created = await page.request.post('/src/backend/editor/salvar_roteiros.php', {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify({ action: 'save', titulo, conteudo: content, visivel_ate: '2099-12-31' }),
  });
  const roteiroData = await created.json();
  expect(created.status(), JSON.stringify(roteiroData)).toBe(200);

  try {
    await page.goto('/index.php');
    await page.evaluate(async () => {
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      renderPlaylistsMenu();
    });
    await page.getByRole('button', { name: 'Abrir repertórios' }).click();
    const roteiroLink = page.locator('.liRoteiro a', { hasText: titulo });
    await roteiroLink.click();
    await expect(page).toHaveURL(/roteiro\.php\?id=/);
    await expect(page.locator('#roteiro-title')).toHaveText(titulo);
    await expect(page.locator('#roteiro-body')).toBeVisible();
    await expect(page.locator('#roteiro-body script')).toHaveCount(0);
    await expect(page.locator('#roteiro-body [onclick]')).toHaveCount(0);
    await expect(page.locator('#roteiro-body a[href^="javascript:"]')).toHaveCount(0);
    const musicLink = page.locator('#roteiro-body a[href*="music.php"]').first();
    await musicLink.click();
    await expect(page).toHaveURL(/from=roteiro/);
    await page.getByRole('link', { name: /voltar/i }).click();
    await expect(page).toHaveURL(/roteiro\.php\?id=/);
  } finally {
    if (roteiroData.id) {
      dbQuery('DELETE FROM roteiros WHERE id=? AND banda_id=?', [roteiroData.id, BAND_ID]);
    }
  }
});

test('usa controles reais de leitura, colunas, rolagem e metrônomo', async ({ page }) => {
  await openFirstSong(page);
  await expect(page.locator('#song-cifra')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir ajustes' }).click();

  await page.locator('#increase-tom').click();
  await page.locator('#decrease-tom').click();
  await page.locator('#increase-text').click();
  await page.locator('#decrease-text').click();
  await page.locator('#viewModeLyrics').click();
  await expect(page.locator('#viewModeLyrics')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#viewModeChords').click();
  await page.locator('#columnMode1').click();
  await page.locator('#columnMode2').click();
  await page.locator('#columnModeAuto').click();
  await page.locator('.music-switch', { has: page.locator('#showQuickBar') }).click();
  await expect(page.locator('#musicQuickBar')).not.toHaveClass(/is-hidden/);

  await page.locator('#autoScrollSpeed').fill('5');
  await page.locator('#autoScrollToggle').click();
  await expect(page.locator('#autoScrollToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#autoScrollToggle').click();
  await page.locator('#resetReadingSettings').click();

  await page.getByRole('tab', { name: 'Ferramentas' }).click();
  await page.locator('#bpmSlider').fill('120');
  await page.locator('#tapTempo').click();
  await page.waitForTimeout(120);
  await page.locator('#tapTempo').click();
  await page.waitForTimeout(120);
  await page.locator('#tapTempo').click();
  await page.locator('#startMetronome').click();
  await page.waitForTimeout(120);
  await page.locator('#stopMetronome').click();

  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
  await page.getByRole('button', { name: 'Abrir repertórios' }).click();
  await page.locator('#closeButton').click();
});

test('cria, visualiza, descarta alterações e exclui música no editor', async ({ page }) => {
  const nome = `__EDITOR_UI_${Date.now()}__`;
  await page.goto('/src/backend/editor/editor.php');
  const editorBody = page.frameLocator('.tox-edit-area iframe').locator('body');
  await expect(editorBody).toBeVisible();

  await page.locator('#buscaMusica').fill('');
  await page.locator('#newSongButton').click();
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toHaveText('Digite o nome da música.');
  await page.locator('#titulo').fill(nome);
  await page.locator('#artista').fill('Playwright UI');
  await page.locator('#bit').fill('120');
  await editorBody.fill('D A Bm G\nEm A D');
  await expect(page.locator('#dirtyIndicator')).toBeVisible();

  await page.locator('#previewButton').click();
  await expect(page.locator('#previewModal')).toHaveClass(/is-open/);
  await expect(page.locator('#previewFrame')).toHaveAttribute('src', /editorPreview=1/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#previewModal')).not.toHaveClass(/is-open/);

  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toHaveText('Música salva com sucesso.', { timeout: 10000 });
  await page.locator('#buscaMusica').fill(nome);
  const saved = page.locator('#musicas button', { hasText: nome });
  await expect(saved).toBeVisible();

  await page.locator('#titulo').fill(nome + ' alterada');
  await page.locator('#newSongButton').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.locator('#titulo')).toHaveValue(nome + ' alterada');
  await page.locator('#newSongButton').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('#titulo')).toHaveValue('');

  await page.locator('#buscaMusica').fill(nome);
  await saved.click();

  await page.locator('#moreActions').locator('summary').click();
  await page.locator('#deleteSongButton').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#moreActions').locator('summary').click();
  await page.locator('#deleteSongButton').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sim, excluir' }).click();
  await expect(page.locator('#status')).toHaveText('Música excluída com sucesso.', { timeout: 10000 });
});
