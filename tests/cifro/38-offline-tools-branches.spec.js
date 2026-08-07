/**
 * 38-offline-tools-branches.spec.js
 * Cobertura de branches residuais de public/src/js/offline-tools.js:
 * formatDate com/sem timestamp, setProgress sem barra, prepareShell com
 * worker.waiting (sem active) e sem nenhum worker, mensagens do
 * MessageChannel com falha/ausência de dados, sync falho, cifroToast
 * ausente, mensagens de erro com/sem .message, navigator.storage ausente,
 * e o re-load dinâmico do módulo (readyState !== 'loading' -> bind direto).
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openPreview(page) {
  await page.goto('/index.php');
  await page.evaluate((song) => {
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify(song));
    sessionStorage.removeItem('cifroSetlist');
  }, { id: 79, nome: 'Matriz offline-tools', artista: '', bit: '', cifra: '<b>C G Am F</b><br>' });
  await page.goto('/music.php?id=79&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

test('offline-tools.js — datas, progresso, prepareShell e mensagens de erro', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async () => {
    const OT = window.OfflineTools;

    // formatDate: com timestamp válido (branch "continua") e sem (branch "nunca").
    localStorage.removeItem('cifroOfflinePreparedAt');
    await OT.renderStatus();
    const semData = document.getElementById('offlineToolsStatus').textContent;
    localStorage.setItem('cifroOfflinePreparedAt', String(Date.now()));
    await OT.renderStatus();
    const comData = document.getElementById('offlineToolsStatus').textContent;

    // setProgress sem #offlineProgressBar não lança.
    const bar = document.getElementById('offlineProgressBar');
    let barRemoved = false;
    if (bar) { bar.remove(); barRemoved = true; }

    // prepareShell: worker via registration.waiting (sem .active).
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: null,
          waiting: { postMessage(message, ports) { ports[0].postMessage({ ok: true, type: message.type }); } },
        }),
      },
    });
    // offline-tools.js referencia o identificador solto "cifroSync", que
    // resolve para o `const cifroSync` léxico declarado em cifro-sync.js (não
    // para a propriedade window.cifroSync) — reatribuir window.cifroSync não
    // afeta essa resolução. É preciso mutar o objeto existente com
    // Object.assign, e restaurá-lo ao final do teste.
    const originalSync = { ...window.cifroSync };
    Object.assign(window.cifroSync, {
      sync: async () => true,
      getRevision: async () => 1,
      markShellPrepared: async () => true,
      getSyncStatus: async () => ({ snapshotValid: true, shellReady: true, contentRevision: 1, lastSync: Date.now(), appVersion: 'x' }),
    });
    delete window.cifroToast;
    // Recria a barra de progresso e o botão, pois prepareOffline() os usa.
    if (barRemoved) {
      const panel = document.getElementById('offlineToolsPanel') || document.body;
      const newBar = document.createElement('div');
      newBar.id = 'offlineProgressBar';
      panel.appendChild(newBar);
    }
    let button = document.getElementById('prepareOfflineBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'prepareOfflineBtn';
      document.body.appendChild(button);
    }
    await OT.prepareOffline();
    const statusViaWaiting = document.getElementById('offlineToolsStatus').textContent;
    const buttonLabelAposSucesso = button.textContent;

    // prepareShell: nem active nem waiting -> throw 'Service worker indisponível'.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: null, waiting: null }) },
    });
    await OT.prepareOffline();
    const statusNoWorker = document.getElementById('offlineToolsStatus').textContent;

    // cifroSync.sync retorna false -> "Falha ao atualizar os dados".
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
    Object.assign(window.cifroSync, { sync: async () => false, getSyncStatus: async () => null });
    await OT.prepareOffline();
    const statusSyncFail = document.getElementById('offlineToolsStatus').textContent;

    // Erro sem .message (objeto lançado sem "message") -> fallback padrão.
    Object.assign(window.cifroSync, {
      sync: async () => { throw { code: 'X' }; },
      getSyncStatus: async () => null,
    });
    await OT.prepareOffline();
    const statusNoMessage = document.getElementById('offlineToolsStatus').textContent;

    // Resposta do MessageChannel sem "ok" e sem "error" -> fallback 'Falha no pacote'.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(message, ports) { ports[0].postMessage({}); } },
          waiting: null,
        }),
      },
    });
    Object.assign(window.cifroSync, { sync: async () => true, getSyncStatus: async () => null });
    await OT.prepareOffline();
    const statusPacoteFalho = document.getElementById('offlineToolsStatus').textContent;

    // navigator.storage ausente (sem persist) — não deve lançar; segue e conclui com sucesso.
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
    Object.assign(window.cifroSync, {
      sync: async () => true, getRevision: async () => 2, markShellPrepared: async () => true,
      getSyncStatus: async () => ({ snapshotValid: true, shellReady: true, contentRevision: 2, lastSync: Date.now(), appVersion: 'x' }),
    });
    await OT.prepareOffline();
    const statusSemStoragePersist = document.getElementById('offlineToolsStatus').textContent;

    // markShellPrepared lança erro -> mensagem de erro chega ao status.
    Object.assign(window.cifroSync, {
      sync: async () => true,
      getRevision: async () => 3,
      markShellPrepared: async () => { throw new Error('IndexedDB indisponível'); },
      getSyncStatus: async () => null,
    });
    await OT.prepareOffline();
    const statusMarkShellFalhou = document.getElementById('offlineToolsStatus').textContent;

    Object.assign(window.cifroSync, originalSync);

    // Re-carrega o módulo dinamicamente (document.readyState já não é
    // 'loading' neste ponto) -> cobre o ramo "else bind()" direto.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/src/js/offline-tools.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const reloadedOk = Boolean(window.OfflineTools);

    return {
      semData, comData, statusViaWaiting, buttonLabelAposSucesso, statusNoWorker, statusSyncFail,
      statusNoMessage, statusPacoteFalho, statusSemStoragePersist, statusMarkShellFalhou, reloadedOk,
    };
  });

  expect(result.semData).toContain('preparado em nunca');
  expect(result.comData).not.toContain('nunca');
  expect(result.statusViaWaiting).toContain('Pronto para palco');
  expect(result.buttonLabelAposSucesso).toBe('Sincronizar');
  expect(result.statusNoWorker).toContain('Service worker indisponível');
  expect(result.statusSyncFail).toContain('Falha ao atualizar os dados');
  expect(result.statusNoMessage).toContain('a versão salva foi mantida');
  expect(result.statusPacoteFalho).toContain('Falha no pacote');
  expect(result.statusSemStoragePersist).toContain('Pronto para palco');
  expect(result.statusMarkShellFalhou).toContain('IndexedDB indisponível');
  expect(result.reloadedOk).toBe(true);
});
