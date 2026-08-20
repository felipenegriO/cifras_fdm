import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: 'tests/.auth/user.json' });

test('cria repertório, adiciona música, salva e mantém após F5', async ({ page }) => {
  const nome = `__REPERTORIO_F5_${Date.now()}__`;
  const banda = dbQuery('SELECT banda_id FROM usuario_banda WHERE usuario_id = ? AND perfil = "administrador" ORDER BY banda_id LIMIT 1', ['00000000-0000-4000-8000-000000000001']);
  const bandaId = banda.rows[0].banda_id;
  dbQuery('DELETE FROM playlists WHERE banda_id = ?', [bandaId]);

  try {
    await page.goto('/src/backend/editor/editorplaylist.php');
    await page.getByRole('button', { name: /Novo repertório/i }).click();
    await page.locator('#novaPlaylistNome').fill(nome);

    const createResponse = page.waitForResponse(response => response.url().endsWith('/src/backend/editor/salvar_playlists.php') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Criar repertório/i }).click();
    expect((await (await createResponse).json()).sucesso).toBe(true);

    const primeiraMusica = page.locator('#musicasDisponiveis .song-row').first();
    const nomeMusica = (await primeiraMusica.locator('span').textContent()).replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    expect(nomeMusica).not.toBe('');
    await primeiraMusica.getByRole('button', { name: /Adicionar ao repertório/i }).click();
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(1);

    const saveResponse = page.waitForResponse(response => response.url().endsWith('/src/backend/editor/salvar_playlists.php') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Salvar repertório/i }).click();
    const saveBody = await (await saveResponse).json();
    expect(saveBody.sucesso).toBe(true);

    const persisted = dbQuery('SELECT itens FROM playlists WHERE banda_id = ? AND nome = ?', [bandaId, nome]);
    expect(persisted.rows).toHaveLength(1);
    const itensGravados = JSON.parse(persisted.rows[0].itens);
    expect(itensGravados).toHaveLength(1);
    // Conferir a quantidade nao prova nada: o item gravado tem que ser a musica
    // que o usuario clicou, e nao outra qualquer da banda.
    const musicaGravada = dbQuery('SELECT nome FROM musicas WHERE banda_id = ? AND id = ?', [bandaId, itensGravados[0].id ?? itensGravados[0]]);
    expect(musicaGravada.rows[0]?.nome).toBe(nomeMusica);

    await page.reload();
    await page.locator('#playlistSelecionada').selectOption({ label: nome });
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(1);
    await expect(page.locator('#musicasNaPlaylist .playlist-song-name')).toContainText(nomeMusica);
  } finally {
    dbQuery('DELETE FROM playlists WHERE banda_id = ? AND nome = ?', [bandaId, nome]);
  }
});

test('respeita validade do repertório online e após F5 offline', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'pwa', 'Cenário exclusivo do projeto PWA');
  const futuro = `__REPERTORIO_FUTURO_${Date.now()}__`;
  const expirado = `__REPERTORIO_EXPIRADO_${Date.now()}__`;

  await page.addInitScript(() => localStorage.setItem('cifroBetaWelcomeSeen', '1'));
  await page.goto('/index.php');
  const snapshot = await (await page.request.get('/api/sync/data.php')).json();
  const song = snapshot.musicas[0];
  expect(song).toBeTruthy();

  try {
    const save = await page.evaluate(async ({ playlists, futuro, expirado, songId, baseRevision }) => {
      const response = await fetch('/src/backend/editor/salvar_playlists.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: [
          ...playlists,
          { nome: futuro, visivel_ate: '2099-12-31', itens: [{ id: songId, tom: 'G' }] },
          { nome: expirado, visivel_ate: '2020-01-01', itens: [{ id: songId, tom: 'G' }] },
        ], baseRevision }),
      });
      return response.json();
    }, { playlists: snapshot.playlists, futuro, expirado, songId: song.id, baseRevision: snapshot.content_revision });
    expect(save.sucesso).toBe(true);

    await page.evaluate(() => cifroSync.sync(window.CIFRO_BAND_ID, { force: true }));
    await page.evaluate(() => window.renderPlaylistsMenu());
    await expect(page.locator('#lista-playlists .liPlaylist > a', { hasText: futuro })).toHaveCount(1);
    await expect(page.locator('#lista-playlists .liPlaylist > a', { hasText: expirado })).toHaveCount(0);

    expect(await page.evaluate(() => window.OfflineTools.prepareOffline())).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lista-playlists .liPlaylist > a', { hasText: futuro })).toHaveCount(1);
    await expect(page.locator('#lista-playlists .liPlaylist > a', { hasText: expirado })).toHaveCount(0);
  } finally {
    await context.setOffline(false);
    await page.goto('/index.php').catch(() => {});
    const current = await page.request.get('/api/sync/version.php').then(response => response.json()).catch(() => null);
    await page.evaluate(async ({ playlists, baseRevision }) => {
      await fetch('/src/backend/editor/salvar_playlists.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists, baseRevision }),
      });
    }, { playlists: snapshot.playlists, baseRevision: current?.content_revision }).catch(() => {});
  }
});

test('segunda música adicionada depois do primeiro salvamento também persiste', async ({ page }) => {
  const nome = `__REPERTORIO_2X_${Date.now()}__`;
  const banda = dbQuery('SELECT banda_id FROM usuario_banda WHERE usuario_id = ? AND perfil = "administrador" ORDER BY banda_id LIMIT 1', ['00000000-0000-4000-8000-000000000001']);
  const bandaId = banda.rows[0].banda_id;
  dbQuery('DELETE FROM playlists WHERE banda_id = ?', [bandaId]);

  const adicionarPrimeiraDisponivel = async () => {
    const linha = page.locator('#musicasDisponiveis .song-row').first();
    const rotulo = (await linha.locator('span').textContent()).replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    expect(rotulo).not.toBe('');
    await linha.getByRole('button', { name: /Adicionar ao repertório/i }).click();
    return rotulo;
  };

  const salvar = async () => {
    const resposta = page.waitForResponse(r => r.url().endsWith('/src/backend/editor/salvar_playlists.php') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Salvar repertório/i }).click();
    expect((await (await resposta).json()).sucesso).toBe(true);
  };

  try {
    await page.goto('/src/backend/editor/editorplaylist.php');
    await page.getByRole('button', { name: /Novo repertório/i }).click();
    await page.locator('#novaPlaylistNome').fill(nome);
    const criacao = page.waitForResponse(r => r.url().endsWith('/src/backend/editor/salvar_playlists.php') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Criar repertório/i }).click();
    expect((await (await criacao).json()).sucesso).toBe(true);

    const primeira = await adicionarPrimeiraDisponivel();
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(1);
    await salvar();

    const segunda = await adicionarPrimeiraDisponivel();
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(2);
    await salvar();

    const gravado = dbQuery('SELECT itens FROM playlists WHERE banda_id = ? AND nome = ?', [bandaId, nome]);
    expect(gravado.rows).toHaveLength(1);
    expect(JSON.parse(gravado.rows[0].itens)).toHaveLength(2);

    await page.reload();
    await page.locator('#playlistSelecionada').selectOption({ label: nome });
    await expect(page.locator('#musicasNaPlaylist .playlist-item-row')).toHaveCount(2);
    await expect(page.locator('#musicasNaPlaylist .playlist-song-name').nth(0)).toContainText(primeira);
    await expect(page.locator('#musicasNaPlaylist .playlist-song-name').nth(1)).toContainText(segunda);
  } finally {
    dbQuery('DELETE FROM playlists WHERE banda_id = ? AND nome = ?', [bandaId, nome]);
  }
});
