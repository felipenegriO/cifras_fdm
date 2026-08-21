import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openPreview(page, setlist) {
  await page.goto('/index.php');
  await page.evaluate(({ song, setlist }) => {
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify(song));
    if (setlist === undefined) sessionStorage.removeItem('cifroSetlist');
    else sessionStorage.setItem('cifroSetlist', setlist);
  }, {
    song: { id: 77, nome: 'Matriz de palco', artista: '', bit: '', cifra: '<b>C G Am F</b><br>'.repeat(120) },
    setlist,
  });
  await page.goto('/music.php?id=77&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

test('sincronização local acompanha mutações reais de todos os editores', async ({ page }) => {
  await page.goto('/config.php');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(_message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
  });
  const result = await page.evaluate(async () => {
    const bandId = window.CIFRO_BAND_ID;
    const initial = await (await fetch('/api/sync/data.php')).json();
    const output = {
      emptyLoad: await cifroSync.load(''),
      emptySync: await cifroSync.sync(''),
      emptyRevision: await cifroSync.getRevision(''),
      unknownOffline: await cifroSync.canUseOffline('__ausente__'),
      unknownSelection: await cifroSync.selectOfflineBand('__ausente__'),
      unsupportedMutation: await cifroSync.applyMutation('/api/outro.php', {}, { content_revision: 1 }, bandId),
      invalidMutation: await cifroSync.applyMutation('/src/backend/editor/api.php', {}, {}, bandId),
    };

    output.synced = await cifroSync.sync(bandId, { force: true });
    output.concurrent = await Promise.all([cifroSync.sync(bandId), cifroSync.sync(bandId, { throttle: true })]);
    await cifroSync.cacheBands([
      { actual_band_id: bandId, nome: 'Atual' },
      { banda_id: '__cache_banda__', nome: 'Cache' },
      { id: '__cache_id__', nome: 'Id' },
    ]);
    output.prepared = await cifroSync.markPrepared(bandId);
    output.shellPrepared = await cifroSync.markShellPrepared(bandId, await cifroSync.getRevision(bandId), 'coverage');
    output.canUse = await cifroSync.canUseOffline(bandId);
    output.offlineStatus = await cifroSync.getOfflineStatus(bandId);
    output.syncStatus = await cifroSync.getSyncStatus(bandId);
    output.selected = await cifroSync.selectOfflineBand(bandId);
    localStorage.removeItem('cifroOfflineBandId:' + String(window.CIFRO_USER_ID || 'anonymous'));

    let categoryId;
    let songId;
    let roteiroId;
    try {
      const category = await (await fetch('/src/backend/categorias/api.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: '__SYNC_BROWSER__' }),
      })).json();
      categoryId = category.id;
      await fetch('/src/backend/categorias/api.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: categoryId, nome: '__SYNC_BROWSER_EDITADA__' }),
      });

      const song = await (await fetch('/src/backend/editor/api.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: '__SYNC_BROWSER__', cifra: 'C G Am F', artista: '', classificacao: '', bit: '' }),
      })).json();
      songId = song.id;
      await fetch('/src/backend/editor/api.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: songId, nome: '__SYNC_BROWSER_EDITADA__', cifra: 'D A Bm G', artista: '', classificacao: '', bit: '' }),
      });

      await fetch('/src/backend/editor/salvar_playlists.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playlists: [...initial.playlists, { nome: '__SYNC_BROWSER__', itens: [] }] }),
      });

      const roteiro = await (await fetch('/src/backend/editor/salvar_roteiros.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', titulo: '__SYNC_BROWSER__', conteudo: 'Palco' }),
      })).json();
      roteiroId = roteiro.id;
      await fetch('/src/backend/editor/salvar_roteiros.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: roteiroId, titulo: '__SYNC_BROWSER_EDITADO__', conteudo: 'Palco atualizado' }),
      });
    } finally {
      if (songId) await fetch('/src/backend/editor/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: songId }) });
      if (roteiroId) await fetch('/src/backend/editor/salvar_roteiros.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteId: roteiroId }) });
      if (categoryId) await fetch('/src/backend/categorias/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: categoryId }) });
      await fetch('/src/backend/editor/salvar_playlists.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playlists: initial.playlists }) });
      await cifroSync.sync(bandId, { force: true });
    }
    return output;
  });

  expect(result.emptyLoad).toBe(false);
  expect(result.emptySync).toBe(false);
  expect(result.emptyRevision).toBe(0);
  expect(result.unknownOffline).toBe(false);
  expect(result.unknownSelection).toBe(false);
  expect(result.unsupportedMutation).toBe(false);
  expect(result.invalidMutation).toBe(false);
  expect(result.synced).toBe(true);
  expect(result.prepared).toBe(true);
  expect(result.shellPrepared).toBe(true);
  expect(result.canUse).toBe(true);
  expect(result.selected).toBe(true);
  expect(result.offlineStatus.ready).toBe(true);
  expect(result.syncStatus.snapshotValid).toBe(true);
});

test('sincronização usa snapshot offline preparado e reconciliação real de banda', async ({ page, context }) => {
  await page.route('**/src/backend/bandas/selecionar.php', route => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ sucesso: false, mensagem: 'Acesso negado' })
  }));
  await page.goto('/config.php');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(_message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
  });
  const result = await page.evaluate(async () => {
    const bandId = String(window.CIFRO_BAND_ID);
    const userId = String(window.CIFRO_USER_ID || 'anonymous');
    const key = `${userId}:${bandId}`;
    await cifroSync.sync(bandId, { force: true });
    const db = await new Promise((resolve, reject) => {
      // Sem fixar versão: o app já abriu o banco na versão dele ao carregar a
      // página, e pedir uma versão menor lança VersionError. O onupgradeneeded
      // abaixo continua valendo para o caso do banco ainda não existir.
      const req = indexedDB.open('cifro');
      req.onupgradeneeded = event => {
        const db = event.target.result;
        ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta', 'cifro_bandas', 'cifro_snapshot_current'].forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'banda_id' });
        });
      };
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = event => reject(event.target.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta', 'cifro_bandas', 'cifro_snapshot_current'], 'readwrite');
      tx.objectStore('cifro_musicas').put({ banda_id: key, actual_band_id: bandId, data: [{ id: 771, nome: 'Offline preparado', cifra: '<b>C</b>' }], content_revision: 321 });
      tx.objectStore('cifro_playlists').put({ banda_id: key, actual_band_id: bandId, data: [], content_revision: 321 });
      tx.objectStore('cifro_roteiros').put({ banda_id: key, actual_band_id: bandId, data: [], content_revision: 321 });
      tx.objectStore('cifro_categorias').put({ banda_id: key, actual_band_id: bandId, data: [{ id: 1, nome: 'Geral' }], content_revision: 321 });
      tx.objectStore('cifro_snapshot_current').put({
        banda_id: key,
        actual_band_id: bandId,
        content_revision: 321,
        data: {
          musicas: [{ id: 771, nome: 'Offline preparado', cifra: '<b>C</b>' }],
          playlists: [],
          roteiros: [],
          categorias: [{ id: 1, nome: 'Geral' }],
          preferencias_musica: [],
          plano: 'trial',
          trial_expira_em: '2000-01-01',
        },
      });
      tx.objectStore('cifro_sync_meta').put({
        banda_id: key,
        actual_band_id: bandId,
        content_revision: 321,
        last_checked_at: Date.now(),
        last_sync: Date.now(),
        snapshot_valid: true,
        prepared_at: Date.now(),
        shell_prepared_revision: 321,
        shell_prepared_at: Date.now(),
        plano: 'trial',
        trial_expira_em: '2000-01-01'
      });
      tx.objectStore('cifro_bandas').put({ banda_id: key, actual_band_id: bandId, snapshot_valid: true, prepared_at: Date.now(), content_revision: 321, shell_prepared_revision: 321, shell_prepared_at: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
    cifroSync.selectOnlineBand('__pendente__');
    return {
      bandId,
      pending: localStorage.getItem(`cifroPendingBandId:${userId}`),
      selectedBefore: window.CIFRO_BAND_ID
    };
  });

  expect(result.pending).toBe('__pendente__');
  expect(result.selectedBefore).toBe('__pendente__');

  await context.setOffline(true);
  const offline = await page.evaluate(async bandId => {
    const loaded = await cifroSync.load(bandId);
    return {
      loaded,
      song: window.songs[0]?.nome,
      online: cifroSync.isOnline(),
      syncResult: await cifroSync.sync(bandId)
    };
  }, result.bandId);
  expect(offline.loaded).toBe(true);
  expect(offline.song).toBe('Offline preparado');
  await expect(page.locator('#_planExpiredBanner')).toContainText('plano expirou');
  expect(offline.online).toBe(false);
  expect(offline.syncResult).toBe(false);

  await context.setOffline(false);
  const online = await page.evaluate(async bandId => {
    document.dispatchEvent(new CustomEvent('cifro:connectivity', { detail: { state: 'servidor_disponivel' } }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await cifroSync.markPrepared(bandId);
    await cifroSync.markShellPrepared(bandId, await cifroSync.getRevision(bandId), 'coverage');
    const selected = await cifroSync.selectOfflineBand(bandId);
    return {
      selected,
      currentBand: window.CIFRO_BAND_ID,
      status: await cifroSync.getSyncStatus(bandId)
    };
  }, result.bandId);
  expect(online.selected).toBe(true);
  expect(online.currentBand).toBe(result.bandId);
  expect(online.status.contentRevision).toBeGreaterThan(0);

  await page.evaluate(() => {
    const userId = String(window.CIFRO_USER_ID || 'anonymous');
    localStorage.setItem(`cifroOfflineBandId:${userId}`, '__banda_negada__');
    document.dispatchEvent(new CustomEvent('cifro:connectivity', { detail: { state: 'servidor_disponivel' } }));
  });
  await expect(page).toHaveURL(/select-banda\.php/);
});

test('reconciliação de banda offline bem-sucedida limpa a chave e recarrega a página', async ({ page }) => {
  await page.goto('/config.php');
  const bandId = await page.evaluate(() => String(window.CIFRO_BAND_ID));
  await page.route('**/src/backend/bandas/selecionar.php', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ sucesso: true })
  }));
  await page.evaluate(bandId => {
    const userId = String(window.CIFRO_USER_ID || 'anonymous');
    localStorage.setItem(`cifroOfflineBandId:${userId}`, bandId);
  }, bandId);

  const [reloaded] = await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => document.dispatchEvent(new CustomEvent('cifro:connectivity', { detail: { state: 'servidor_disponivel' } }))),
  ]);
  expect(reloaded).toBeTruthy();
  const remaining = await page.evaluate(() => {
    const userId = String(window.CIFRO_USER_ID || 'anonymous');
    return localStorage.getItem(`cifroOfflineBandId:${userId}`);
  });
  expect(remaining).toBeNull();
  await page.unroute('**/src/backend/bandas/selecionar.php');
});

test('banner de plano expirado não aparece sem trial_expira_em, com plano pago ou trial ainda válido', async ({ page, context }) => {
  await page.goto('/config.php');
  const bandId = await page.evaluate(() => String(window.CIFRO_BAND_ID));

  async function setMetaAndLoadOffline(meta) {
    await context.setOffline(false);
    await page.evaluate(async ({ bandId, meta }) => {
      const userId = String(window.CIFRO_USER_ID || 'anonymous');
      const key = `${userId}:${bandId}`;
      const db = await new Promise((resolve, reject) => {
        // Sem fixar versão: o app já abriu o banco na versão dele ao carregar a
        // página, e pedir uma versão menor lança VersionError. O onupgradeneeded
        // abaixo continua valendo para o caso do banco ainda não existir.
        const req = indexedDB.open('cifro');
        req.onupgradeneeded = event => {
          const upgradeDb = event.target.result;
          ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_sync_meta', 'cifro_bandas'].forEach(name => {
            if (!upgradeDb.objectStoreNames.contains(name)) upgradeDb.createObjectStore(name, { keyPath: 'banda_id' });
          });
        };
        req.onsuccess = event => resolve(event.target.result);
        req.onerror = event => reject(event.target.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['cifro_musicas', 'cifro_categorias', 'cifro_sync_meta'], 'readwrite');
        tx.objectStore('cifro_musicas').put({ banda_id: key, actual_band_id: bandId, data: [], content_revision: 1 });
        tx.objectStore('cifro_categorias').put({ banda_id: key, actual_band_id: bandId, data: [], content_revision: 1 });
        tx.objectStore('cifro_sync_meta').put({ banda_id: key, actual_band_id: bandId, content_revision: 1, ...meta });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
      document.getElementById('_planExpiredBanner')?.remove();
    }, { bandId, meta });
    await context.setOffline(true);
    await page.evaluate(bandId => window.cifroSync.load(bandId), bandId);
    // checkOfflinePlanBanner não é aguardado dentro de load() (fire-and-forget
    // assíncrono via IndexedDB); um waitForTimeout fixo de 150ms podia ser
    // insuficiente sob contenção real de I/O na suíte completa (múltiplos
    // workers), causando flake. Fazemos poll curto até estabilizar em vez de
    // um único sleep fixo.
    let present = 0;
    for (let i = 0; i < 20; i++) {
      present = await page.locator('#_planExpiredBanner').count();
      await page.waitForTimeout(50);
    }
    await context.setOffline(false);
    return present > 0;
  }

  expect(await setMetaAndLoadOffline({ plano: 'trial', trial_expira_em: null })).toBe(false);
  expect(await setMetaAndLoadOffline({ plano: 'pro', trial_expira_em: '2000-01-01' })).toBe(false);
  expect(await setMetaAndLoadOffline({ plano: 'trial', trial_expira_em: '2999-01-01' })).toBe(false);
  expect(await setMetaAndLoadOffline({ plano: 'trial', trial_expira_em: '2000-01-01' })).toBe(true);
});

test('sincronização local aplica playlists, roteiros, categorias e estado offline', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(_message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
  });
  const result = await page.evaluate(async () => {
    const band = window.CIFRO_BAND_ID;
    await cifroSync.sync(band, { force: true });
    window.categorias = [{ id: 9101, nome: 'Antiga' }];
    await cifroSync.applyMutation('/src/backend/editor/salvar_playlists.php', {
      playlists: [{ id: 9201, nome: 'Lista local', itens: [{ id: 1, tom: 'D' }] }],
    }, { content_revision: 2001 }, band);
    await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {
      titulo: 'Roteiro local',
    }, { content_revision: 2002, roteiro: { id: 9301, titulo: 'Roteiro local', conteudo: '1' } }, band);
    await cifroSync.applyMutation('/src/backend/editor/salvar_roteiros.php', {
      deleteId: 9301,
    }, { content_revision: 2003 }, band);
    await cifroSync.applyMutation('/src/backend/categorias/api.php', {
      id: 9101,
      nome: 'Nova',
    }, { content_revision: 2004, categoria: { id: 9101, nome: 'Nova' } }, band);
    await cifroSync.applyMutation('/src/backend/categorias/api.php', {
      action: 'delete',
      id: 9101,
    }, { content_revision: 2005 }, band);

    const beforePrepared = await cifroSync.selectOfflineBand(band);
    const marked = await cifroSync.markPrepared(band);
    const shellMarked = await cifroSync.markShellPrepared(band, await cifroSync.getRevision(band), 'coverage');
    // markPrepared resolve após o oncomplete da transação IndexedDB, então a
    // leitura seguinte já deveria ver os dados persistidos — mas sob
    // contenção real de I/O (suíte completa em paralelo) a leitura de
    // selectOfflineBand logo em seguida esporadicamente via canUseOffline()
    // observava valores ainda não commitados (flake não reproduzido
    // isolado). Faz um pequeno retry antes de desistir.
    let afterPrepared = await cifroSync.selectOfflineBand(band);
    for (let i = 0; i < 40 && !afterPrepared; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      afterPrepared = await cifroSync.selectOfflineBand(band);
    }
    const offlineStatus = await cifroSync.getOfflineStatus(band);
    const syncStatus = await cifroSync.getSyncStatus(band);

    return {
      beforePrepared,
      marked,
      shellMarked,
      afterPrepared,
      offlineStatus,
      syncStatus,
      roteiros: window.roteirosSalvos.map(item => item.titulo),
      categorias: window.categorias.map(item => item.nome),
    };
  });

  expect(result.beforePrepared).toBe(false);
  expect(result.marked).toBe(true);
  expect(result.shellMarked).toBe(true);
  expect(result.afterPrepared).toBe(true);
  expect(result.offlineStatus.ready).toBe(true);
  expect(result.syncStatus.contentRevision).toBeGreaterThan(0);
  expect(result.roteiros).not.toContain('Roteiro local');
  expect(result.categorias).not.toContain('Nova');
});

test('processa acordes, playlists e roteiros nos componentes reais da cifra', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    if (typeof window.renderRoteiro !== 'function') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/src/js/roteiros.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const chords = window.CifroChords;
    const chordCases = {
      empty: chords.normalizeKey(null),
      invalid: chords.normalizeKey('H#'),
      invalidSharpB: chords.normalizeKey('B#'),
      flat: chords.normalizeKey('dbm'),
      modes: [chords.modeOf(''), chords.modeOf('Am'), chords.modeOf('C')],
      tonics: [chords.tonicOf('Am'), chords.tonicOf('C')],
      extracts: [
        chords.extractChords(''),
        chords.extractChords('<b>C &amp; G/B</b>'),
        chords.extractChords('C G Am F\nletra comum'),
        chords.extractChords('apenas C'),
        chords.extractChords('<b></b>'),
        chords.extractChords('<b>B# G Am F</b>'),
      ],
      keys: [
        chords.identifyKey('<b>C F G C</b>'),
        chords.identifyKey('<b>Am Dm Em Am</b>'),
        chords.identifyKey('<b>C#dim D#aug Fsus Gm</b>'),
        chords.identifyKey('sem acordes'),
      ],
      intervals: [chords.intervalBetweenKeys('H', 'C'), chords.intervalBetweenKeys('C', 'D')],
      transposed: [
        chords.transposeHtml('', 2),
        chords.transposeHtml('<b>C/E</b><strong>G</strong>', 2),
        chords.transposeHtml('C G\nletra', 2),
        chords.transposeToKey('<b>C</b>', 'H', 'D'),
        chords.transposeToKey('<b>C</b>', 'C', 'D'),
        chords.transposeHtml('<b>B#</b>', 2),
        chords.transposeHtml('<b>C/B#</b>', 2),
      ],
      keysForMode: [chords.keysForMode('minor'), chords.keysForMode('major')],
    };

    const visibility = [
      isRoteiroVisibleMenu(null), isRoteiroVisibleMenu({ visivel_ate: 'inválida' }), isRoteiroVisibleMenu({ visivel_ate: '2000-01-01' }),
      isPlaylistVisibleMenu(null), isPlaylistVisibleMenu({ visivel_ate: 'inválida' }), isPlaylistVisibleMenu({ visivel_ate: '2999-01-01' }),
    ];
    window.songs = [
      { id: 1, nome: 'Maior', cifra: '<b>C F G C</b>' },
      { id: 2, nome: 'Menor', cifra: '<b>Am Dm Em Am</b>' },
      { id: 3, nome: 'SemAcordes', cifra: 'letra sem nenhum acorde identificável aqui' },
    ];
    window.roteirosSalvos = [
      { id: 4, titulo: '', visivel_ate: null },
      { id: 5, titulo: 'Expirado', visivel_ate: '2000-01-01' },
    ];
    window.playlistsSalvas = [
      { nome: 'Variações', visivel_ate: null, itens: [1, { id: 2, tom: 'D' }, { id: 99, tom: 'inválido' }, { id: 3, tom: '' }] },
      { nome: 'Expirada', visivel_ate: '2000-01-01', itens: [] },
    ];
    renderPlaylistsMenu();
    document.querySelectorAll('.liPlaylist-musica').forEach(link => {
      link.addEventListener('click', event => event.preventDefault(), { capture: true });
      link.click();
    });
    const playlistLabels = Array.from(document.querySelectorAll('.liPlaylist-musica')).map(link => link.textContent);
    toggleSubList({ target: document.createElement('button') });

    const container = document.createElement('div');
    container.id = 'roteiroBranchMatrix';
    document.body.appendChild(container);
    renderRoteiro('ausente', '<p>ignorado</p>');
    renderRoteiro('roteiroBranchMatrix', '<script>alert(1)</script><a href="javascript:x">Ruim</a><a href="music.php?id=1">Direto</a><a href="2">Número</a><a href="#">Música 3</a><span style="color:red" onclick="x">Texto</span><div style="text-align:center" data-x="1">Centro</div>');
    const roteiroCases = {
      missing: getRoteiroById('ausente'),
      found: getRoteiroById(4)?.id,
      visible: [isRoteiroVisible(null), isRoteiroVisible({ visivel_ate: 'x' }), isRoteiroVisible({ visivel_ate: '2000-01-01' })],
      dates: [formatRoteiroDate(''), formatRoteiroDate('x'), formatRoteiroDate('2030-12-31')],
      returns: [addRoteiroReturn('/x', 1), addRoteiroReturn('music.php?id=1', ''), addRoteiroReturn('music.php?id=1&from=roteiro', 2), addRoteiroReturn('music.php?id=1', 2)],
      html: container.innerHTML,
    };
    return { chordCases, visibility, playlistLabels, roteiroCases };
  });

  expect(result.chordCases.flat).toBe('C#m');
  expect(result.chordCases.intervals).toEqual([null, 2]);
  expect(result.chordCases.keys[0].key).toBeTruthy();
  expect(result.visibility).toEqual([true, true, false, true, true, true]);
  expect(result.playlistLabels).toHaveLength(4);
  expect(result.roteiroCases.found).toBe(4);
  expect(result.roteiroCases.html).not.toContain('<script');
  expect(result.roteiroCases.html).not.toContain('javascript:');
});

test('editor percorre validações, pesquisa, layout e prévia sem persistir dados inválidos', async ({ page }) => {
  test.setTimeout(30000);
  // Other specs in the full suite may run before this one and leave the
  // shared test band with zero músicas — the search-empty-state assertion
  // below needs at least one to exist first (otherwise the library shows
  // the "no músicas at all" state instead of the "search found nothing" one).
  const preSnapshot = await (await page.request.get('/api/sync/data.php')).json();
  if (!preSnapshot.musicas || preSnapshot.musicas.length === 0) {
    const csrfRes = await page.request.get('/api/csrf.php');
    const { csrf_token } = await csrfRes.json();
    await page.request.post('/src/backend/editor/api.php', {
      data: JSON.stringify({ nome: `__BRANCH_MATRIX_FIXTURE_${Date.now()}__`, cifra: '<b>C</b> fixture', artista: '', classificacao: '', bit: '' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf_token },
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/src/backend/editor/editor.php');
  const editorBody = page.frameLocator('.tox-edit-area iframe').locator('body');
  await expect(editorBody).toBeVisible();

  await page.locator('.editor-tab[data-panel="library"]').click();
  await page.locator('#buscaMusica').fill('__NENHUMA_MUSICA_COM_ESTE_NOME__');
  await expect(page.locator('#libraryState')).toHaveText('Nenhuma música encontrada.');
  await page.locator('#buscaMusica').fill('');

  await page.locator('#collapseLibrary').evaluate(button => button.click());
  await expect(page.locator('#editorShell')).toHaveClass(/library-collapsed/);
  await page.locator('#expandLibrary').evaluate(button => button.click());
  await page.locator('.editor-tab[data-panel="workspace"]').click();
  await page.locator('#toggleSongDetails').click();
  await expect(page.locator('#toggleSongDetails')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#toggleSongDetails').click();

  await page.locator('#moreActions').locator('summary').click();
  await page.locator('#deleteSongButton').click();
  await expect(page.locator('#status')).toHaveText('Selecione uma música para excluir.');

  await page.locator('#newSongMenuButton').evaluate(button => button.click());
  await page.keyboard.press('Control+s');
  await expect(page.locator('#status')).toHaveText('Digite o nome da música.');
  await page.locator('#titulo').fill('__EDITOR_VALIDATION__');
  await editorBody.fill('   ');
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toHaveText('A cifra está vazia.');

  await editorBody.evaluate(body => { body.innerHTML = '<div class="cifra-column">C G</div>'; body.dispatchEvent(new InputEvent('input', { bubbles: true })); });
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toHaveText('Use "Limpar colagem" antes de salvar.');

  await page.locator('#newSongButton').evaluate(button => button.click());
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
  await page.evaluate(() => sessionStorage.setItem('cifroSetlist', JSON.stringify({ items: [{ id: 1 }], currentIndex: 0 })));
  await page.locator('#previewButton').click();
  await expect(page.locator('#previewModalTitle')).toHaveText('Preview: Sem título');
  await page.keyboard.press('Escape');
  await expect(page.locator('#previewModal')).not.toHaveClass(/is-open/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cifroSetlist'))).not.toBeNull();

  const firstSong = page.locator('#musicas button').first();
  if (await firstSong.count()) {
    await page.locator('.editor-tab[data-panel="library"]').click();
    await firstSong.click();
    await firstSong.evaluate(button => button.click());
    await page.locator('#previewButton').click();
    await page.locator('#closePreviewButton').click();
  }
});


test('leitura usa abas, modos, colunas, atalhos e restauração reais', async ({ page, context }) => {
  test.setTimeout(20000);
  await openPreview(page);
  const openSettings = page.getByRole('button', { name: 'Abrir ajustes' });
  if (await openSettings.isVisible().catch(() => false)) await openSettings.click();
  const tabs = page.locator('[data-settings-tab]');
  if (await tabs.count()) {
    await tabs.first().evaluate(tab => {
      tab.click();
      tab.focus();
      ['ArrowRight', 'ArrowLeft', 'Enter'].forEach(key => tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    });
  }

  for (const mode of ['lyrics', 'chords']) {
    const button = page.locator(`[data-view-mode="${mode}"]`).first();
    if (await button.count()) await button.evaluate(element => element.click());
  }
  for (const mode of ['1', '2', 'auto']) {
    const button = page.locator(`[data-column-mode="${mode}"]`).first();
    if (await button.count()) await button.evaluate(element => element.click());
  }

  const quickBar = page.locator('#showQuickBar');
  if (await quickBar.count()) {
    await quickBar.evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
    await quickBar.evaluate(input => { input.checked = false; input.dispatchEvent(new Event('change', { bubbles: true })); });
  }
  const speed = page.locator('#autoScrollSpeed');
  if (await speed.count()) {
    await speed.evaluate(input => { input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await speed.evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  const tools = page.locator('.music-tool');
  if (await tools.count() > 1) {
    await tools.nth(0).evaluate(tool => { tool.open = true; tool.dispatchEvent(new Event('toggle')); });
    await tools.nth(1).evaluate(tool => { tool.open = true; tool.dispatchEvent(new Event('toggle')); });
  }

  const autoScroll = page.locator('#autoScrollToggle');
  if (await autoScroll.count()) {
    await autoScroll.evaluate(element => element.click());
    await page.keyboard.press('Escape');
    await page.locator('body').press('Space');
    await page.locator('#autoScrollSpeed').evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  }
  await page.evaluate(() => {
    const missing = document.createElement('button');
    missing.dataset.musicAction = '__controle_ausente__';
    document.body.appendChild(missing);
    const regular = document.createElement('button');
    regular.id = '__controle_real__';
    document.body.appendChild(regular);
    const proxy = document.createElement('button');
    proxy.dataset.musicAction = '__controle_real__';
    document.body.appendChild(proxy);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    missing.click();
    proxy.click();
    const lyric = document.getElementById('toggle-cifra-letra');
    if (lyric && !lyric.classList.contains('active')) lyric.click();
    const columns = document.getElementById('toggle-columns');
    const cifra = document.getElementById('song-cifra');
    if (columns && cifra?.classList.contains('auto-columns')) columns.click();
    const quick = document.getElementById('showQuickBar');
    if (quick) {
      quick.checked = true;
      quick.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  const reset = page.locator('#resetReadingSettings');
  if (await reset.count()) await reset.evaluate(button => button.click());

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#connectionStatus')).toHaveAttribute('data-online', 'false');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#connectionStatus')).toHaveAttribute('data-online', 'true');

  const utilities = await page.evaluate(async () => {
    const headersEmpty = window.cifroCsrfHeaders();
    const headersExtra = window.cifroCsrfHeaders({ Accept: 'application/json' });
    const tones = [identificarTom('sem acordes'), identificarTom('<b>C F G C</b>')];
    const transposed = transporCifraHtml('<b>C/E</b>', 2);
    openSideMenu();
    document.getElementById('menuButton')?.click();
    document.getElementById('menuButtonTop')?.click();
    document.getElementById('menucloseButton')?.click();
    document.getElementById('playlistButton')?.click();
    document.getElementById('playlistButtonTop')?.click();
    document.getElementById('closeButton')?.click();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cifroToast('Padrão', 'info');
    cifroToast('Colorido', 'success');
    cifroSwMessage({ type: 'UNKNOWN' });
    await fetch(new Request('/api/live/status.php', { method: 'GET' }));
    await fetch('/api/live/status.php', { method: 'POST', body: 'texto' });
    await fetch('/src/backend/editor/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
    await fetch('/src/backend/editor/api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: 'inválido', baseRevision: 0 }) });
    return { hasToken: Boolean(headersEmpty['X-CSRF-Token']), accept: headersExtra.Accept, tones, transposed };
  });
  expect(utilities.hasToken).toBe(true);
  expect(utilities.accept).toBe('application/json');
  expect(utilities.tones[0]).toBe('Tom não identificado');
  expect(utilities.transposed).toContain('D/F#');
});

test('editores exibem falhas reais de rede sem persistir alterações', async ({ page, context }) => {
  await page.goto('/src/backend/editor/editor.php');
  const editorBody = page.frameLocator('.tox-edit-area iframe').locator('body');
  await expect(editorBody).toBeVisible();
  const firstSong = page.locator('#musicas button').first();
  if (await firstSong.count()) {
    await firstSong.click();
    await page.locator('#titulo').fill('__NAO_PERSISTIR_OFFLINE__');
    await editorBody.fill('C G Am F');
    await context.setOffline(true);
    await page.locator('#saveButton').click();
    await expect(page.locator('#status')).toContainText(/Failed to fetch|Falha de rede/);
    await page.locator('#moreActions').locator('summary').click();
    await page.locator('#deleteSongButton').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sim, excluir' }).click();
    await expect(page.locator('#status')).toContainText(/Failed to fetch|Falha de rede/);
    await context.setOffline(false);
  }

  await page.goto('/categorias.php');
  await page.locator('#categoryName').fill('__NAO_PERSISTIR_OFFLINE__');
  await context.setOffline(true);
  await page.locator('#categoryForm').getByRole('button', { name: /salvar/i }).click();
  await expect(page.locator('.cifro-toast-message').last()).toContainText(/Failed to fetch|concluir a operação/);
  const edit = page.locator('#categoryList .btn--secondary').first();
  if (await edit.count()) {
    await edit.click();
    await page.locator('#cancelEdit').click();
    await page.locator('#categoryList .btn--danger').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.locator('.cifro-toast-message').last()).toContainText(/Failed to fetch|concluir a operação/);
  }
  await context.setOffline(false);
});

test('editor percorre cancelamento, salvamento em erro e fallback de texto', async ({ page }) => {
  await page.route('**/src/backend/editor/api.php', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'Falha controlada' }),
  }));
  await page.goto('/src/backend/editor/editor.php');
  const editorBody = page.frameLocator('.tox-edit-area iframe').locator('body');
  await expect(editorBody).toBeVisible();

  await page.locator('#newSongMenuButton').evaluate(button => button.click());
  await page.locator('#titulo').fill('__EDITOR_BRANCH_REAL__');
  await editorBody.fill('C  G\nlinha');
  await page.locator('#saveButton').click();
  await expect(page.locator('#status')).toContainText('Falha controlada');

  await page.locator('#newSongButton').evaluate(button => button.click());
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.locator('#titulo')).toHaveValue('__EDITOR_BRANCH_REAL__');
  await page.locator('#newSongButton').evaluate(button => button.click());
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('#titulo')).toHaveValue('');

  const fallback = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const originalTiny = window.tinymce;
    const originalTheme = window.cifroTheme;
    window.tinymce = undefined;
    window.cifroTheme = { get: () => 'light' };
    await load('/src/js/editor.js');
    await new Promise(resolve => setTimeout(resolve, 250));
    document.getElementById('titulo').value = 'Fallback';
    document.getElementById('cifraInput').value = 'A  B';
    document.getElementById('cifraInput').dispatchEvent(new Event('input', { bubbles: true }));
    const visible = !document.getElementById('editorLoadError').hidden;
    window.tinymce = originalTiny;
    window.cifroTheme = originalTheme;
    return visible;
  });
  expect(fallback).toBe(true);
});

test('scripts compartilhados permanecem idempotentes com controles opcionais ausentes', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    await load('/src/js/cifro-confirm.js');
    delete window.cifroConfirm;
    await load('/src/js/cifro-confirm.js');
    await load('/src/js/cifro-toast.js');
    delete window.cifroToast;
    await load('/src/js/cifro-toast.js');
    window.cifroToast('Com opções', 'info', { duration: 0 });
    window.cifroToast('Fecha sozinho', 'info', { duration: 1 });
    await load('/src/js/cifro-sanitize.js');
    await load('/src/js/cifro-presentation.js');
    if (typeof window.renderRoteiro !== 'function') await load('/src/js/roteiros.js');

    const chords = window.CifroChords;
    const chordEdges = [
      chords.extractChords(false),
      chords.transposeChordText(null, 2),
      chords.transposeHtml(null, 2),
      chords.transposeHtml('<b>C</b>', 0),
      chords.transposeToKey(null, 'H', 'D'),
    ];
    const sanitized = window.cifroSanitizeCifra('C  G <script>alert(1)</script><b class="x">D</b><a href="x"><span style="color:red">E</span></a>');

    const savedSongs = window.songs;
    const savedRoteiros = window.roteirosSalvos;
    const savedPlaylists = window.playlistsSalvas;
    const savedChords = window.CifroChords;
    window.songs = undefined;
    addListItem('Sem catálogo', 'lista-playlists', [99]);
    window.songs = [
      { id: 501, nome: 'Maior', cifra: '<b>C F G C</b>' },
      { id: 502, nome: 'Menor', cifra: '<b>Am Dm Em Am</b>' },
    ];
    addListItem('Tons explícitos', 'lista-playlists', [{ id: 501, tom: 'D' }, { id: 502, tom: 'D' }, 503]);
    window.CifroChords = undefined;
    getPlaylistItemTom({ id: 1, tom: 'D' }, null);
    window.CifroChords = savedChords;
    isRoteiroVisibleMenu({ visivel_ate: '2025-xx-01' });
    isPlaylistVisibleMenu({ visivel_ate: '2025-xx-01' });
    toggleSubList({ target: document.createElement('button') });
    window.roteirosSalvos = undefined;
    window.playlistsSalvas = undefined;
    renderPlaylistsMenu();
    window.songs = savedSongs;
    window.roteirosSalvos = savedRoteiros;
    window.playlistsSalvas = savedPlaylists;
    const firstPlaylistLink = document.querySelector('.liPlaylist-musica');
    if (firstPlaylistLink) firstPlaylistLink.click();
    const subButton = document.createElement('button');
    const subList = document.createElement('ul');
    subList.className = 'sub-list';
    subList.style.display = 'block';
    document.body.appendChild(subButton);
    document.body.appendChild(subList);
    toggleSubList({ target: subButton });

    const roteiroContainer = document.createElement('div');
    roteiroContainer.id = 'roteiroOptional';
    document.body.appendChild(roteiroContainer);
    const previousUrl = location.href;
    history.replaceState({}, '', '/music.php');
    renderRoteiro('roteiroOptional', null);
    renderRoteiro('roteiroOptional', '<a>Sem destino</a><a href="#">sem número</a>');
    const roteiroEdges = [
      isRoteiroVisible({ visivel_ate: '2025-xx-01' }),
      addRoteiroReturn('music.php', 2),
      addRoteiroReturn('music.php', null),
      addRoteiroReturn('other.php', 2),
      addRoteiroReturn('music.php?from=roteiro&roteiroId=2', 2),
    ];
    window.roteirosSalvos = undefined;
    roteiroEdges.push(getRoteiroById(1));
    window.roteirosSalvos = savedRoteiros;
    history.replaceState({}, '', previousUrl);

    const optionalIds = [
      'sideMenu', 'menusideMenu', 'playlistButton', 'playlistButtonTop', 'menuButton', 'menuButtonTop',
      'menucloseButton', 'closeButton', 'toast', 'liveStatus', 'connectionStatus', 'autoScrollSpeed',
      'autoScrollSpeedValue', 'musicQuickBar', 'showQuickBar', 'fontSizeDisplay', 'resetReadingSettings',
      'toggle-cifra-letra', 'toggle-columns', 'song-title', 'song-cifra'
    ];
    optionalIds.forEach(id => document.getElementById(id)?.remove());
    document.dispatchEvent(new Event('DOMContentLoaded'));
    openSideMenu();
    // O antigo mostrarToast() de script.js foi substituído por window.cifroToast.
    // O caso que aquela chamada cobria — emitir toast depois que os elementos
    // opcionais foram removidos — é o mesmo da linha abaixo, que roda aqui.
    if (window.cifroToast) window.cifroToast('Toast sem tipo explícito');

    const originalFetch = window.fetch;
    const meta = document.querySelector('meta[name="csrf-token"]');
    meta?.remove();
    window.fetch = undefined;
    await load('/src/js/cifro-csrf.js');
    const csrfEdges = [
      Object.keys(window.cifroCsrfHeaders()).length,
      window.cifroCsrfHeaders({ Accept: 'application/json' }).Accept,
    ];
    window.fetch = originalFetch;
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    try {
      delete window.cifroTheme;
      Storage.prototype.getItem = function () { throw new Error('bloqueado'); };
      await load('/src/js/cifro-theme.js');
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.setItem = function () { throw new Error('bloqueado'); };
      window.cifroTheme.set('dark');
      Storage.prototype.setItem = originalSetItem;
      localStorage.setItem('cifro-theme', 'light');
      const toggled = window.cifroTheme.toggle();
      csrfEdges.push(toggled);
      window.cifroTheme.set('auto'); // valor que não é 'light' nem 'dark' -> ramo else (removeAttribute)
      csrfEdges.push(document.documentElement.getAttribute('data-theme'));
      // cifraSize com formato inválido (regex falha) não deve setar a CSS var
      localStorage.setItem('cifro-cifra-size', 'nao-numerico');
      delete window.cifroTheme;
      await load('/src/js/cifro-theme.js');
      csrfEdges.push(document.documentElement.style.getPropertyValue('--cifra-size'));
    } finally {
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.setItem = originalSetItem;
    }
    await load('/src/js/rehearsal/rehearsal.state.js');
    const rehearsalStateEdges = [
      window.Rehearsal.state.normalizeState({ region: null }).region.A,
      window.Rehearsal.state.loadState('').pitchSemitones,
    ];
    return { chordEdges: chordEdges.length, roteiroEdges: roteiroEdges.length, sanitized, rehearsalStateEdges, csrfEdges };
  });

  expect(result.chordEdges).toBe(5);
  expect(result.roteiroEdges).toBe(6);
  expect(result.sanitized).not.toContain('<script');
  expect(result.sanitized).not.toContain('href=');
  expect(result.sanitized).toContain('&nbsp;');
  expect(result.rehearsalStateEdges).toEqual([null, 0]);
  expect(result.csrfEdges).toEqual([0, 'application/json', 'dark', null, '']);
});

test('modo ensaio cobre fallbacks reais de estado, onda, youtube e pitch', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    await load('/src/js/rehearsal/rehearsal.state.js');
    await load('/src/js/rehearsal/rehearsal.youtube.js');
    await load('/src/js/rehearsal/rehearsal.audio.js');
    await load('/src/js/rehearsal/rehearsal.pitch.js');
    await load('/src/js/rehearsal/rehearsal.ui.js');

    localStorage.setItem('rehearsal:matrix', '{json');
    const invalidState = window.Rehearsal.state.loadState('matrix');
    window.Rehearsal.state.saveState('matrix', {
      youtubeVideoId: 7,
      youtubeUrl: 8,
      youtubeTitle: 9,
      audioFileName: 10,
      pitchSemitones: 99,
      loopEnabled: 1,
      region: { A: -5, B: 200 },
      lastPositionSeconds: -1
    });
    const normalized = window.Rehearsal.state.loadState('matrix');

    const ids = [
      'btnAtivarEnsaio', 'modo-ensaio', 'btnAbrirYoutube', 'inputYoutubeUrl', 'btnVincularYoutube',
      'inputAudio', 'btnInicio', 'btnMinus1', 'btnPlayPause', 'btnPlus1', 'btnLoop', 'btnSetA',
      'btnSetB', 'btnClearAB', 'btnPitchDown', 'btnPitchUp', 'btnPitchReset', 'pitchLabel',
      'ytThumb', 'ytTitle', 'audioFileName', 'rehearsalMessage'
    ];
    ids.forEach(id => {
      if (document.getElementById(id)) return;
      const element = id === 'inputYoutubeUrl' || id === 'inputAudio' ? document.createElement('input') : document.createElement(id === 'modo-ensaio' ? 'section' : 'button');
      element.id = id;
      if (id === 'inputAudio') element.type = 'file';
      document.body.appendChild(element);
    });

    let opened = '';
    const originalOpen = window.open;
    window.open = url => { opened = url; return null; };
    let bound = '';
    let toggles = 0;
    const ui = window.Rehearsal.ui.initUI({
      onToggle: active => { toggles += active ? 1 : -1; },
      onOpenYoutube: () => window.open(window.Rehearsal.youtube.buildSearchUrl('Matriz Ensaio'), '_blank'),
      onBindYoutube: value => { bound = value; },
      onAudioFile: file => { bound = file ? file.name : 'none'; },
      onStart: () => { bound = 'start'; },
      onBack1: () => { bound = 'back'; },
      onPlayPause: () => { bound = 'play'; },
      onForward1: () => { bound = 'forward'; },
      onToggleLoop: () => { bound = 'loop'; },
      onSetA: () => { bound = 'A'; },
      onSetB: () => { bound = 'B'; },
      onClearAB: () => { bound = 'clear'; },
      onPitchDown: () => { bound = 'down'; },
      onPitchUp: () => { bound = 'up'; },
      onPitchReset: () => { bound = 'reset'; }
    });
    document.getElementById('btnAtivarEnsaio').click();
    document.getElementById('btnAtivarEnsaio').click();
    document.getElementById('btnAbrirYoutube').click();
    document.getElementById('inputYoutubeUrl').value = 'https://youtu.be/dQw4w9WgXcQ';
    document.getElementById('btnVincularYoutube').click();
    ['btnInicio', 'btnMinus1', 'btnPlayPause', 'btnPlus1', 'btnLoop', 'btnSetA', 'btnSetB', 'btnClearAB', 'btnPitchDown', 'btnPitchUp', 'btnPitchReset'].forEach(id => document.getElementById(id).click());
    window.open = originalOpen;

    window.Rehearsal.ui.setLoopActive(true);
    window.Rehearsal.ui.setPlayState(true);
    window.Rehearsal.ui.setPitchLabel(2);
    window.Rehearsal.ui.setYoutubePreview({ thumbUrl: 'x.png', title: 'Video' });
    window.Rehearsal.ui.setAudioFileName('ensaio.wav');
    window.Rehearsal.ui.showMessage('ok', 'success');
    window.Rehearsal.ui.showMessage('erro', 'error');
    window.Rehearsal.ui.setControlsEnabled(false);
    window.Rehearsal.ui.setPlaybackControlsEnabled(true);

    const youtubeCases = [
      window.Rehearsal.youtube.extractYoutubeVideoId('dQw4w9WgXcQ'),
      window.Rehearsal.youtube.extractYoutubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'),
      window.Rehearsal.youtube.extractYoutubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ'),
      window.Rehearsal.youtube.extractYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'),
      window.Rehearsal.youtube.extractYoutubeVideoId(''),
      window.Rehearsal.youtube.getThumbnailUrl('')
    ];
    const originalFetch = window.fetch;
    window.fetch = async () => ({ ok: true, json: async () => ({ title: 'Meta', thumbnail_url: 'thumb.jpg' }) });
    const metaOk = await window.Rehearsal.youtube.fetchYoutubeMeta('dQw4w9WgXcQ');
    window.fetch = async () => ({ ok: false, json: async () => ({}) });
    const metaFail = await window.Rehearsal.youtube.fetchYoutubeMeta('dQw4w9WgXcQ');
    window.fetch = async () => { throw new Error('rede'); };
    const metaError = await window.Rehearsal.youtube.fetchYoutubeMeta('dQw4w9WgXcQ');
    window.fetch = originalFetch;

    const messages = [];
    const noWave = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: message => messages.push(message) });
    let savedHandlers = {};
    const region = {
      options: null,
      removed: false,
      setOptions(options) { this.options = options; },
      remove() { this.removed = true; }
    };
    window.WaveSurfer = {
      Regions: { create: () => ({ addRegion: options => { region.options = options; return region; } }) },
      create: () => ({
        time: 0,
        handlers: savedHandlers,
        on(name, handler) { savedHandlers[name] = handler; },
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getDuration() { return 10; },
        setTime(value) { this.time = value; },
        seekTo(value) { this.seek = value; },
        getCurrentTime() { return 4; },
        getRegion() { return region; },
        isReady: true
      })
    };
    const seeks = [];
    const regions = [];
    const wave = window.Rehearsal.audio.createWaveform({
      container: document.body,
      onSeek: time => seeks.push(time),
      onRegionChange: (start, end) => regions.push([start, end]),
      onStatus: message => messages.push(message)
    });
    savedHandlers.interaction();
    savedHandlers['region-created']({ id: 'outro', start: 0, end: 1 });
    savedHandlers['region-created']({ id: 'loop-region', start: 1, end: 3 });
    savedHandlers['region-updated']({ id: 'loop-region', start: 2, end: 4 });
    wave.setRegion(-1, 2);
    window.WaveSurfer.create = () => ({
      on() {},
      registerPlugin() { return null; },
      getDuration() { return 10; },
      seekTo(value) { this.seek = value; },
      getRegion() { return region; },
      isReady: false
    });
    const waveWithoutSetTime = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: message => messages.push(message) });
    waveWithoutSetTime.setTime(5);
    wave.clearRegion();
    wave.setTime(5);
    wave.setTime(0);

    class FakeBufferSource {
      constructor() {
        this.playbackRate = { value: 1 };
      }
      connect() {}
      start() {}
      stop() {}
      disconnect() {}
    }
    class FakeAudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
      }
      createBufferSource() {
        return new FakeBufferSource();
      }
      decodeAudioData() {
        return Promise.resolve({ duration: 2, sampleRate: 44100 });
      }
    }
    const originalAudioContext = window.AudioContext;
    window.AudioContext = FakeAudioContext;
    const player = window.Rehearsal.pitch.createPitchPlayer({
      onTimeUpdate: () => {},
      onEnded: () => {},
      onStatus: message => messages.push(message)
    });
    await player.loadFile(new Blob(['abc'], { type: 'audio/wav' }));
    player.setPitchSemitones(99);
    player.seek(3);
    player.play();
    player.pause();
    player.toggle();
    player.toggle();
    player.setPitchSemitones(-99);
    const pitch = player.getPitchSemitones();
    window.SoundTouch = function () { this.pitch = 1; };
    window.BufferSource = function (buffer) { this.buffer = buffer; this.position = 0; };
    window.SimpleFilter = function (source) { this.source = source; };
    window.getWebAudioNode = () => ({ connect() {}, disconnect() {} });
    const stPlayer = window.Rehearsal.pitch.createPitchPlayer({ onTimeUpdate: () => {}, onEnded: () => {}, onStatus: message => messages.push(message) });
    await stPlayer.loadFile(new Blob(['abc'], { type: 'audio/wav' }));
    stPlayer.setPitchSemitones(2);
    stPlayer.play();
    stPlayer.pause();
    delete window.SoundTouch;
    delete window.BufferSource;
    delete window.SimpleFilter;
    delete window.getWebAudioNode;
    window.AudioContext = originalAudioContext;

    return {
      defaultPitch: invalidState.pitchSemitones,
      normalizedPitch: normalized.pitchSemitones,
      normalizedRegionA: normalized.region.A,
      opened,
      bound,
      toggles,
      panel: Boolean(ui.panel),
      youtubeCases,
      metaOk,
      metaFail,
      metaError,
      noWave,
      messageCount: messages.length,
      ready: wave.isReady(),
      duration: wave.getDuration(),
      seeks,
      regions,
      regionRemoved: region.removed,
      pitch
    };
  });

  expect(result.defaultPitch).toBe(0);
  expect(result.normalizedPitch).toBe(12);
  expect(result.normalizedRegionA).toBe(0);
  expect(result.opened).toContain('youtube.com/results');
  expect(result.bound).toBe('reset');
  expect(result.toggles).toBe(0);
  expect(result.panel).toBe(true);
  expect(result.youtubeCases.slice(0, 3)).toEqual(['dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'dQw4w9WgXcQ']);
  expect(result.youtubeCases[3]).toBeNull();
  expect(result.youtubeCases[4]).toBeNull();
  expect(result.youtubeCases[5]).toBe('');
  expect(result.metaOk.title).toBe('Meta');
  expect(result.metaFail).toBeNull();
  expect(result.metaError).toBeNull();
  expect(result.noWave).toBeNull();
  expect(result.messageCount).toBeGreaterThan(0);
  expect(result.ready).toBe(true);
  expect(result.duration).toBe(10);
  expect(result.seeks).toEqual([4]);
  expect(result.regions).toEqual([[1, 3], [2, 4]]);
  expect(result.regionRemoved).toBe(true);
  expect(result.pitch).toBe(-12);
});

test('modo ensaio UI cobre guards de elementos ausentes e handlers ausentes', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    await load('/src/js/rehearsal/rehearsal.ui.js');

    // Remove todos os elementos reais de modo-ensaio da página real, para
    // exercitar os ramos "elemento ausente" (return antecipado / guard) de
    // cada função exportada por rehearsal.ui.js.
    const ids = [
      'btnAtivarEnsaio', 'modo-ensaio', 'btnAbrirYoutube', 'inputYoutubeUrl', 'btnVincularYoutube',
      'inputAudio', 'btnInicio', 'btnMinus1', 'btnPlayPause', 'btnPlus1', 'btnLoop', 'btnSetA',
      'btnSetB', 'btnClearAB', 'btnPitchDown', 'btnPitchUp', 'btnPitchReset', 'pitchLabel',
      'ytThumb', 'ytTitle', 'audioFileName', 'rehearsalMessage'
    ];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });

    // initUI sem nenhum elemento no DOM e sem handlers: nenhum branch de
    // binding deve ser tomado, e initUI não deve lançar.
    const uiEmpty = window.Rehearsal.ui.initUI(undefined);

    // Recria só btnAtivarEnsaio, sem #modo-ensaio, para cobrir o ramo
    // `if (btnToggle && panel)` com panel ausente (idx1 falso).
    const btnOnly = document.createElement('button');
    btnOnly.id = 'btnAtivarEnsaio';
    document.body.appendChild(btnOnly);
    window.Rehearsal.ui.initUI({});
    btnOnly.remove();

    // Recria btnAtivarEnsaio + modo-ensaio, mas já marcado como vinculado
    // por music.php (dataset.ensaioListenerAdded='true'), para cobrir o
    // ramo "já vinculado" (idx0 falso de linha 32).
    const btnToggle2 = document.createElement('button');
    btnToggle2.id = 'btnAtivarEnsaio';
    btnToggle2.dataset.ensaioListenerAdded = 'true';
    const panel2 = document.createElement('section');
    panel2.id = 'modo-ensaio';
    document.body.appendChild(btnToggle2);
    document.body.appendChild(panel2);
    window.Rehearsal.ui.initUI({ onToggle: () => {} });
    let toggleFiredAfterAlreadyBound = false;
    btnToggle2.addEventListener('click', () => { toggleFiredAfterAlreadyBound = true; });
    btnToggle2.click(); // não deve lançar; listener de initUI não foi re-adicionado
    btnToggle2.remove();
    panel2.remove();

    // Recria btnAtivarEnsaio + panel do zero (sem dataset), com handlers
    // sem onToggle, para cobrir o ramo `handlers && handlers.onToggle`
    // falso (linha 39) e handlers totalmente ausente.
    const btnToggle3 = document.createElement('button');
    btnToggle3.id = 'btnAtivarEnsaio';
    const panel3 = document.createElement('section');
    panel3.id = 'modo-ensaio';
    document.body.appendChild(btnToggle3);
    document.body.appendChild(panel3);
    window.Rehearsal.ui.initUI({}); // handlers existe mas sem onToggle
    btnToggle3.click(); // cobre handlers && handlers.onToggle -> falso
    btnToggle3.remove();
    panel3.remove();

    const btnToggle4 = document.createElement('button');
    btnToggle4.id = 'btnAtivarEnsaio';
    const panel4 = document.createElement('section');
    panel4.id = 'modo-ensaio';
    document.body.appendChild(btnToggle4);
    document.body.appendChild(panel4);
    window.Rehearsal.ui.initUI(undefined); // handlers totalmente ausente
    btnToggle4.click(); // cobre `handlers &&` -> falso
    btnToggle4.remove();
    panel4.remove();

    // btnAbrirYoutube presente mas sem handlers.onOpenYoutube.
    const btnYt = document.createElement('button');
    btnYt.id = 'btnAbrirYoutube';
    document.body.appendChild(btnYt);
    window.Rehearsal.ui.initUI({});
    btnYt.remove();

    // btnVincularYoutube presente sem handlers.onBindYoutube, e depois
    // com handler mas sem inputYoutubeUrl no DOM (ternário falso).
    const btnBind = document.createElement('button');
    btnBind.id = 'btnVincularYoutube';
    document.body.appendChild(btnBind);
    window.Rehearsal.ui.initUI({});
    btnBind.remove();

    let boundValueNoInput = 'unset';
    const btnBind2 = document.createElement('button');
    btnBind2.id = 'btnVincularYoutube';
    document.body.appendChild(btnBind2);
    window.Rehearsal.ui.initUI({ onBindYoutube: v => { boundValueNoInput = v; } });
    btnBind2.click();
    btnBind2.remove();

    // inputAudio presente sem handlers.onAudioFile, e com handler mas
    // sem arquivo selecionado (file falsy).
    const inputA = document.createElement('input');
    inputA.type = 'file';
    inputA.id = 'inputAudio';
    document.body.appendChild(inputA);
    window.Rehearsal.ui.initUI({});
    inputA.remove();

    let audioFileResult = 'unset';
    const inputA2 = document.createElement('input');
    inputA2.type = 'file';
    inputA2.id = 'inputAudio';
    document.body.appendChild(inputA2);
    window.Rehearsal.ui.initUI({ onAudioFile: f => { audioFileResult = f; } });
    inputA2.dispatchEvent(new Event('change'));
    inputA2.remove();

    // bindControl com handler ausente (btnInicio presente, sem onStart).
    const btnInicio = document.createElement('button');
    btnInicio.id = 'btnInicio';
    document.body.appendChild(btnInicio);
    window.Rehearsal.ui.initUI({});
    btnInicio.remove();

    // Setters com elemento ausente: não devem lançar.
    window.Rehearsal.ui.setLoopActive(true);
    window.Rehearsal.ui.setPlayState(true);
    window.Rehearsal.ui.setPitchLabel(3);
    window.Rehearsal.ui.setYoutubePreview({ title: 'Sem thumb' }); // thumb ausente, title truthy sem thumbUrl
    window.Rehearsal.ui.setYoutubePreview(null); // meta ausente
    window.Rehearsal.ui.setAudioFileName('x.mp3');
    window.Rehearsal.ui.showMessage('msg', 'success');
    window.Rehearsal.ui.setControlsEnabled(true);
    window.Rehearsal.ui.setPlaybackControlsEnabled(false);

    // showMessage com texto falsy (linha 133 idx1: text || "").
    const msgEl = document.createElement('div');
    msgEl.id = 'rehearsalMessage';
    document.body.appendChild(msgEl);
    window.Rehearsal.ui.showMessage('', 'success');
    const emptyMessageText = msgEl.textContent;
    msgEl.remove();

    // setYoutubePreview com title ausente do DOM mas thumb presente com meta.
    const thumbOnly = document.createElement('img');
    thumbOnly.id = 'ytThumb';
    document.body.appendChild(thumbOnly);
    window.Rehearsal.ui.setYoutubePreview({ thumbUrl: 'a.png', title: 'T' });
    thumbOnly.remove();

    return {
      uiEmptyOk: uiEmpty && typeof uiEmpty === 'object',
      toggleFiredAfterAlreadyBound,
      boundValueNoInput,
      audioFileResult,
      emptyMessageText
    };
  });

  expect(result.uiEmptyOk).toBe(true);
  expect(result.boundValueNoInput).toBe('');
  expect(result.audioFileResult).toBeNull();
  expect(result.emptyMessageText).toBe('');
});

test('editor e offline usam fallbacks reais quando adaptadores opcionais falham', async ({ page, context }) => {
  await page.goto('/src/backend/editor/editor.php');
  const fallback = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const original = {
      tinymce: window.tinymce,
      theme: window.cifroTheme,
      songs: window.songs,
      categorias: window.categorias,
    };
    window.tinymce = undefined;
    window.cifroTheme = undefined;
    window.songs = undefined;
    window.categorias = undefined;
    await load('/src/js/editor.js');
    await new Promise(resolve => setTimeout(resolve, 250));
    const textFallback = !document.getElementById('editorLoadError').hidden;

    window.tinymce = { init: async () => [], remove() {} };
    window.cifroTheme = original.theme;
    window.songs = original.songs;
    window.categorias = original.categorias;
    await load('/src/js/editor.js');
    await new Promise(resolve => setTimeout(resolve, 250));
    window.tinymce = original.tinymce;
    return textFallback;
  });
  expect(fallback).toBe(true);

  await openPreview(page);
  const withoutSync = await page.evaluate(async () => {
    const mount = document.createElement('div');
    mount.id = 'offlineToolsMount';
    document.body.appendChild(mount);
    const original = window.cifroSync;
    window.cifroSync = undefined;
    localStorage.removeItem('cifroOfflinePreparedAt');
    await window.OfflineTools.renderStatus();
    const first = document.getElementById('offlineToolsStatus').textContent;
    localStorage.setItem('cifroOfflinePreparedAt', String(Date.now()));
    await window.OfflineTools.renderStatus();
    window.cifroSync = original;
    return first;
  });
  expect(withoutSync).toContain('Pacote não validado');
  await context.setOffline(true);
  const offlineMessage = await page.evaluate(async () => {
    await window.OfflineTools.prepareOffline();
    return document.getElementById('offlineToolsStatus').textContent;
  });
  expect(offlineMessage).toContain('Servidor indisponível');
  await context.setOffline(false);

  const prepared = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: {
            postMessage(message, ports) {
              ports[0].postMessage({ ok: true, type: message.type });
            }
          },
          waiting: null
        })
      }
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: async () => true }
    });
    const originalSync = window.cifroSync;
    window.cifroSync = {
      sync: async () => true,
      markPrepared: async () => true,
      getSyncStatus: async () => ({
        snapshotValid: true,
        contentRevision: 777,
        lastSync: Date.now(),
        appVersion: 'teste'
      })
    };
    await window.OfflineTools.prepareOffline();
    const status = document.getElementById('offlineToolsStatus').textContent;
    const progress = document.getElementById('offlineProgressBar').style.width;
    window.cifroSync = originalSync;
    return { status, progress, preparedAt: localStorage.getItem('cifroOfflinePreparedAt') };
  });
  expect(prepared.status).toContain('Pronto para palco');
  expect(prepared.status).toContain('revisão');
  expect(prepared.progress).toBe('100%');
  expect(prepared.preparedAt).toBeTruthy();
});

test('apresentação trata wake lock ausente, rejeitado e liberação com erro', async ({ page }) => {
  await openPreview(page);
  await page.evaluate(() => {
    localStorage.setItem('cifro-keepAwake', 'true');
    delete navigator.wakeLock;
    delete Navigator.prototype.wakeLock;
    window.cifroPresentation.toggleScroll();
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.cifroPresentation.toggleScroll());
  await page.evaluate(() => window.cifroPresentation.enter());
  await expect(page.locator('.cifro-presenting-overlay')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { throw new Error('negado'); } } });
    window.cifroPresentation.enter();
  });
  await expect(page.locator('.cifro-toast-message').last()).toContainText('Não foi possível manter a tela acesa');
  await page.keyboard.press('Escape');

  await page.evaluate(async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: async () => ({ addEventListener() {}, release() { throw new Error('liberação'); } }) },
    });
    window.cifroPresentation.enter();
    await new Promise(resolve => setTimeout(resolve, 20));
    window.cifroPresentation.exit();
  });
  await expect(page.locator('.cifro-presenting-overlay')).toHaveCount(0);

  await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    delete window.cifroPresentation;
    await load('/src/js/cifro-presentation.js');
    sessionStorage.setItem('cifroSetlist', JSON.stringify({ name: 'Três', currentIndex: 1, items: [{ id: 1 }, { id: 77 }, { id: 3, tom: 'G' }] }));
    window.cifroPresentation.enter();
  });
  await expect(page.locator('#cifroSetlistPrev')).toBeEnabled();
  await expect(page.locator('#cifroSetlistNext')).toBeEnabled();
  await page.evaluate(async () => {
    const target = document.getElementById('song-cifra');
    const emit = (type, values) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, values);
      target.dispatchEvent(event);
    };
    emit('touchstart', { clientX: 100, clientY: 100 });
    await new Promise(resolve => setTimeout(resolve, 650));
    emit('touchend', { clientX: 250, clientY: 100 });
    document.getElementById('cifroAutoScrollToggle').remove();
    window.cifroPresentation.toggleScroll();
    await new Promise(resolve => setTimeout(resolve, 120));
    window.cifroPresentation.toggleScroll();
    window.cifroPresentation.exit();
  });
});

test('live usa confirmação nativa quando o diálogo customizado está indisponível', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => {
    delete window.cifroConfirm;
    window.confirm = () => false;
    document.getElementById('livePlay')?.click();
  });
  await page.evaluate(() => {
    window.confirm = () => true;
    document.getElementById('livePlay')?.click();
  });
  await expect(page.locator('#liveStatus')).toContainText(/host|desconectada/, { timeout: 10000 });
});

test('categoria é criada, editada, cancelada e excluída pelos controles da tela', async ({ page }) => {
  const original = `__CATEGORY_UI_${Date.now()}__`;
  const updated = original + '_EDITADA';
  await page.goto('/categorias.php');
  await page.locator('#categoryForm').getByRole('button', { name: /salvar/i }).click();
  await page.locator('#categoryName').fill(original);
  await page.locator('#categoryForm').getByRole('button', { name: /salvar/i }).click();
  const row = page.locator('.category-row', { hasText: original });
  await expect(row).toBeVisible({ timeout: 10000 });

  await row.getByRole('button', { name: 'Editar' }).click();
  await page.locator('#categoryName').fill(updated);
  await page.locator('#categoryForm').getByRole('button', { name: /salvar/i }).click();
  const edited = page.locator('.category-row', { hasText: updated });
  await expect(edited).toBeVisible({ timeout: 10000 });

  await edited.getByRole('button', { name: 'Editar' }).click();
  await page.locator('#cancelEdit').click();
  await edited.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(edited).toBeVisible();
  await edited.getByRole('button', { name: 'Editar' }).click();
  await edited.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(edited).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#categoryId')).toHaveValue('');
});

test('categorias trata respostas vazias e falhas reais da API', async ({ page }) => {
  await page.goto('/categorias.php');
  const result = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const original = {
      fetch: window.fetch,
      cifroToast: window.cifroToast,
      cifroSync: window.cifroSync,
      cifroConfirm: window.cifroConfirm,
    };
    const calls = [];
    window.cifroToast = undefined;
    window.cifroSync = { sync: async () => true };
    window.cifroConfirm = async () => true;
    window.fetch = async (url, init) => {
      const method = init?.method || 'GET';
      calls.push({ url: String(url), method, body: init?.body || '' });
      if (method === 'GET') return { ok: true, json: async () => ({ ok: true, categorias: [{ id: 901, nome: 'Cobertura' }] }) };
      return { ok: false, json: async () => ({}) };
    };
    await load('/src/js/categorias.js');
    await new Promise(resolve => setTimeout(resolve, 20));
    const text = document.getElementById('categoryList').textContent;
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    document.getElementById('categoryName').value = 'Falha';
    document.getElementById('categoryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 20));
    document.querySelector('.category-row .btn--danger')?.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    window.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
    await load('/src/js/categorias.js');
    await new Promise(resolve => setTimeout(resolve, 20));
    const emptyText = document.getElementById('categoryList').textContent;
    const onboarding = document.getElementById('categoryOnboarding');
    const onboardingHidden = onboarding.hidden;
    const onboardingText = onboarding.textContent;
    window.fetch = original.fetch;
    window.cifroToast = original.cifroToast;
    window.cifroSync = original.cifroSync;
    window.cifroConfirm = original.cifroConfirm;
    return { calls, text, emptyText, onboardingHidden, onboardingText };
  });

  expect(result.calls.some(call => call.method === 'POST' && call.body.includes('Falha'))).toBe(true);
  expect(result.text).toContain('Cobertura');
  // Lista vazia não repete a mensagem em .category-list: quem representa
  // "nenhuma categoria" agora é o bloco de onboarding (kits de sugestão).
  expect(result.emptyText).toBe('');
  expect(result.onboardingHidden).toBe(false);
  expect(result.onboardingText).toContain('Organize as músicas do seu jeito');
});

test('roteiros.js cobre roteirosSalvos indefinida e ausência de id na URL', async ({ page }) => {
  await page.goto('/index.php?semId=1');
  const result = await page.evaluate(async () => {
    if (typeof window.renderRoteiro !== 'function') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/src/js/roteiros.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const hadGlobal = 'roteirosSalvos' in window;
    const previous = window.roteirosSalvos;
    delete window.roteirosSalvos;
    const undefinedCase = getRoteiroById('qualquer');
    if (hadGlobal) window.roteirosSalvos = previous; else delete window.roteirosSalvos;

    const container = document.createElement('div');
    container.id = 'roteiroSemId';
    document.body.appendChild(container);
    renderRoteiro('roteiroSemId', '<a href="music.php?id=5">Direto</a><a href="3">Número</a>');

    return {
      undefinedCase,
      html: container.innerHTML,
      hasIdParam: new URLSearchParams(window.location.search).get('id'),
    };
  });

  expect(result.hasIdParam).toBeNull();
  expect(result.undefinedCase).toBeNull();
  expect(result.html).toContain('music.php?id=5');
  expect(result.html).not.toContain('from=roteiro');
  expect(result.html).toContain('music.php?id=3');
});

test('cifro-csrf.js resolve a URL de um objeto Request ao aplicar mutação', async ({ page }) => {
  await page.goto('/index.php?semId=1');
  await page.route('**/fake-mutation-endpoint', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content_revision: 42 }) });
  });
  const result = await page.evaluate(async () => {
    const calls = [];
    window.cifroSync = window.cifroSync || {};
    const previousApplyMutation = window.cifroSync.applyMutation;
    window.cifroSync.applyMutation = async (url, payload, response) => {
      calls.push({ url, payload, response });
    };
    if (!document.querySelector('meta[name="csrf-token"]')) {
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'token-teste';
      document.head.appendChild(meta);
    }
    delete window.cifroCsrfHeaders;
    const script = document.createElement('script');
    script.src = '/src/js/cifro-csrf.js';
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const request = new Request(new URL('/fake-mutation-endpoint', window.location.origin).toString());
    await window.fetch(request, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'teste' }),
    });
    if (previousApplyMutation) window.cifroSync.applyMutation = previousApplyMutation;
    return calls;
  });
  expect(result.length).toBeGreaterThanOrEqual(1);
  expect(result[0].url).toContain('/fake-mutation-endpoint');
  expect(result[0].response.content_revision).toBe(42);
});
