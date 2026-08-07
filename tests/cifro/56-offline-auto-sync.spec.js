/**
 * 56-offline-auto-sync.spec.js
 * Cobertura do disparo automático de preparação offline (substitui o botão
 * manual "Preparar para offline" por sincronização transparente):
 *
 *  - revisão de shell igual à de dados -> nenhuma preparação é disparada;
 *  - revisão diferente -> preparação completa dispara automaticamente;
 *  - duas notificações concorrentes -> apenas uma execução real (dedupe);
 *  - falha na preparação automática -> aviso aparece uma única vez por sessão;
 *  - botão "Sincronizar" de config.php reaproveita a mesma rotina completa
 *    sem criar um painel solto na tela.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

test.use({ storageState: 'tests/.auth/user.json' });

// tests/.auth/user.json é compartilhado entre todos os specs; a fixture
// automática `isolatedSession` (tests/fixtures/coverage.js) chama
// session_regenerate_id() a cada teste, o que pode invalidar o cookie salvo
// para quem rodar depois na suíte completa. fazerLogin() é um no-op se a
// sessão ainda for válida e reloga se não for.
test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

// Bloqueia o tráfego real de sync/health ANTES de navegar. O próprio
// cifro-sync.js dispara um load()/sync() automático no DOMContentLoaded de
// qualquer página — sem isso, esse sync real de fundo dispararia seu
// próprio 'cifro:sync-checked' (com uma revisão real, fora do nosso
// controle) e correria com o evento sintético que o teste dispara,
// tornando a contagem de chamadas não-determinística.
async function blockRealSyncTraffic(page) {
  await page.route('**/api/sync/version.php', route => route.abort());
  await page.route('**/api/sync/data.php', route => route.abort());
}

async function openPreview(page) {
  await blockRealSyncTraffic(page);
  await page.goto('/index.php');
  await page.evaluate((song) => {
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify(song));
    sessionStorage.removeItem('cifroSetlist');
  }, { id: 80, nome: 'Matriz auto-sync', artista: '', bit: '', cifra: '<b>C G Am F</b><br>' });
  await page.goto('/music.php?id=80&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

test('cifro:sync-checked — revisão igual ao shell já preparado não dispara nova preparação', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: { postMessage(m, p) { p[0].postMessage({ ok: true }); } }, waiting: null }) },
    });
    const originalSync = { ...window.cifroSync };
    let syncCalls = 0;
    Object.assign(window.cifroSync, {
      getOfflineStatus: async () => ({ shellReady: true, shellPreparedRevision: 5 }),
      sync: async () => { syncCalls += 1; return true; },
    });
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 5 } }));
    // handleSyncChecked é assíncrono; aguarda alguns microtasks/macrotasks.
    await new Promise(resolve => setTimeout(resolve, 200));
    Object.assign(window.cifroSync, originalSync);
    return { syncCalls };
  });
  expect(result.syncCalls).toBe(0);
});

test('cifro:sync-checked — revisão diferente completa só o shell, sem re-sincronizar dados', async ({ page }) => {
  // Os DADOS já foram sincronizados pelo próprio evento que dispara este
  // fluxo (é por isso que ele existe) — o disparo automático não deve
  // chamar cifroSync.sync() de novo, senão duplicaria a checagem de
  // revisão a cada abertura do app.
  await openPreview(page);
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: { postMessage(m, p) { p[0].postMessage({ ok: true }); } }, waiting: null }) },
    });
    const originalSync = { ...window.cifroSync };
    let syncCalls = 0;
    let markShellCalls = 0;
    Object.assign(window.cifroSync, {
      getOfflineStatus: async () => ({ shellReady: false, shellPreparedRevision: 3 }),
      sync: async () => { syncCalls += 1; return true; },
      getRevision: async () => 7,
      markShellPrepared: async (bandaId, revision) => { markShellCalls += 1; return revision === 7; },
    });
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 7 } }));
    await new Promise(resolve => setTimeout(resolve, 300));
    Object.assign(window.cifroSync, originalSync);
    return { syncCalls, markShellCalls };
  });
  expect(result.syncCalls).toBe(0);
  expect(result.markShellCalls).toBe(1);
});

test('duas notificações concorrentes disparam apenas uma preparação real (dedupe)', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: { postMessage(m, p) { p[0].postMessage({ ok: true }); } }, waiting: null }) },
    });
    const originalSync = { ...window.cifroSync };
    let preparationStarts = 0;
    Object.assign(window.cifroSync, {
      getOfflineStatus: async () => ({ shellReady: false, shellPreparedRevision: -1 }),
      sync: async () => true,
      getRevision: async () => {
        preparationStarts += 1;
        await new Promise(resolve => setTimeout(resolve, 150));
        return 9;
      },
      markShellPrepared: async () => true,
    });
    // Duas notificações quase simultâneas para a mesma banda.
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 9 } }));
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 9 } }));
    await new Promise(resolve => setTimeout(resolve, 400));
    Object.assign(window.cifroSync, originalSync);
    return { preparationStarts };
  });
  expect(result.preparationStarts).toBe(1);
});

test('falha na preparação automática mostra aviso uma única vez por sessão', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    // Nenhum service worker disponível -> prepareShell() lança
    // 'Service worker indisponível', simulando falha no caminho automático
    // (que não passa mais por cifroSync.sync()).
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: null, waiting: null }) },
    });
    const originalSync = { ...window.cifroSync };
    const originalToast = window.cifroToast;
    let toastCalls = 0;
    window.cifroToast = () => { toastCalls += 1; };
    Object.assign(window.cifroSync, {
      getOfflineStatus: async () => ({ shellReady: false, shellPreparedRevision: -1 }),
      getRevision: async () => 11,
      markShellPrepared: async () => true,
    });
    // Duas rodadas de falha em sequência (revisões diferentes para não
    // colidir com o dedupe da rodada anterior).
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 11 } }));
    await new Promise(resolve => setTimeout(resolve, 200));
    document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId: window.CIFRO_BAND_ID, contentRevision: 12 } }));
    await new Promise(resolve => setTimeout(resolve, 200));
    Object.assign(window.cifroSync, originalSync);
    window.cifroToast = originalToast;
    return { toastCalls };
  });
  expect(result.toastCalls).toBe(1);
});

test('botão "Sincronizar" de config.php reaproveita a rotina completa sem criar painel solto', async ({ page }) => {
  await blockRealSyncTraffic(page);
  await page.goto('/config.php');
  await expect(page.locator('#btnSyncDados')).toBeVisible();

  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: { postMessage(m, p) { p[0].postMessage({ ok: true }); } }, waiting: null }) },
    });
    const originalSync = { ...window.cifroSync };
    let syncCalls = 0;
    Object.assign(window.cifroSync, {
      sync: async () => { syncCalls += 1; return true; },
      getRevision: async () => 1,
      markShellPrepared: async () => true,
      getSyncStatus: async () => null,
    });
    const hasForceSync = typeof window.OfflineTools?.forceSync === 'function';
    const ok = await window.OfflineTools.forceSync(window.CIFRO_BAND_ID);
    const strayPanel = Boolean(document.getElementById('offlineToolsPanel'));
    Object.assign(window.cifroSync, originalSync);
    return { hasForceSync, ok, syncCalls, strayPanel };
  });

  expect(result.hasForceSync).toBe(true);
  expect(result.ok).toBe(true);
  expect(result.syncCalls).toBe(1);
  expect(result.strayPanel).toBe(false);
});
