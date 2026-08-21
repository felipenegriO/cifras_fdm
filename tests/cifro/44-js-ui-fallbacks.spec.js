import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function load(page, src) {
  await page.evaluate(src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }), src);
}

test('music-view cobre storage bloqueado e elementos opcionais ausentes', async ({ page }) => {
  await page.goto('/offline.php');
  const result = await page.evaluate(async () => {
    document.body.innerHTML = `
      <input id="autoScrollSpeed" value="3">
      <span id="autoScrollSpeedValue"></span>
      <input id="showQuickBar" type="checkbox">
      <div id="musicQuickBar"></div>
      <button data-settings-tab="reading"></button>
      <section data-settings-panel="reading"></section>`;
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error('bloqueado'); };
    Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/src/js/music-view.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.getElementById('autoScrollSpeed').dispatchEvent(new Event('input'));
    document.getElementById('showQuickBar').checked = true;
    document.getElementById('showQuickBar').dispatchEvent(new Event('change'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new Event('online'));
    Storage.prototype.getItem = get;
    Storage.prototype.setItem = set;
    return {
      speed: document.getElementById('autoScrollSpeed').value,
      label: document.getElementById('autoScrollSpeedValue').textContent,
      quick: document.getElementById('musicQuickBar').classList.contains('is-hidden'),
    };
  });
  // Storage bloqueado: music-view.js cai no padrão de safeStorageGet, que hoje é
  // '5' numa escala de 1 a 10 (antes era '2' em 1 a 5). O que o caso verifica
  // continua sendo o fallback sobrepor o valor que veio no HTML.
  expect(result.speed).toBe('5');
  expect(result.label).toBe('5/10');
  expect(result.quick).toBe(false);
});

// O toast e o aviso de conexão saíram do script.js: viraram window.cifroToast
// (cifro-toast.js) e CifroConnectivity (cifro-connectivity.js), cada um com
// cobertura própria. O que restou aqui é o que o script.js ainda faz.
test('script fecha menus por clique externo e cai nos fallbacks de cifra', async ({ page }) => {
  await page.goto('/offline.php');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <button id="playlistButton"></button><button id="menuButton"></button>
      <aside id="sideMenu" style="right:0"></aside>
      <aside id="menusideMenu" style="right:0"></aside>`;
  });
  await load(page, '/src/js/script.js');
  const result = await page.evaluate(async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const menu = document.getElementById('menusideMenu').style.right;
    const side = document.getElementById('sideMenu').style.right;
    const old = window.CifroChords;
    window.CifroChords = { transposeHtml: () => 'ok', identifyKey: () => null };
    const transposed = transporCifraHtml('', 1);
    const key = identificarTom('');
    window.CifroChords = old;
    return { menu, side, transposed, key };
  });
  expect(result).toMatchObject({
    menu: '-100%', side: '-100%', transposed: 'ok', key: 'Tom não identificado',
  });
});

test('offline-tools cobre falhas de sincronização, validação e service worker', async ({ page }) => {
  await page.goto('/offline.php');
  await page.evaluate(() => {
    const mount = document.createElement('div');
    mount.id = 'offlineToolsMount';
    document.body.appendChild(mount);
  });
  await load(page, '/src/js/offline-tools.js');
  const messages = await page.evaluate(async () => {
    const button = document.getElementById('prepareOfflineBtn');
    const output = [];
    const originalSync = window.cifroSync;
    const originalBand = window.CIFRO_BAND_ID;
    const originalUser = window.CIFRO_USER_ID;
    const originalConnectivity = window.CifroConnectivity;
    const syncAdapter = {};
    window.cifroSync = syncAdapter;
    window.CIFRO_BAND_ID = 'coverage';
    window.CIFRO_USER_ID = 'coverage';
    window.CifroConnectivity = { probe: async () => true, isServerAvailable: () => true };
    const run = async sync => {
      Object.assign(syncAdapter, sync);
      await window.OfflineTools.prepareOffline();
      output.push(document.getElementById('offlineToolsStatus').textContent);
      if (button.disabled) throw new Error('botão permaneceu desabilitado');
    };
    await run({ sync: async () => false });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          active: { postMessage(message, ports) { ports[0].postMessage({ ok: true }); } },
          waiting: null,
        }),
      },
    });
    await run({
      sync: async () => true,
      getRevision: async () => 1,
      verifyOfflinePackage: async () => ({ ok: false }),
      markShellPrepared: async () => true,
      getSyncStatus: async () => null,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: null, waiting: null }) },
    });
    await run({
      sync: async () => true,
      getRevision: async () => 1,
      verifyOfflinePackage: async () => ({ ok: false }),
    });
    window.cifroSync = originalSync;
    window.CIFRO_BAND_ID = originalBand;
    window.CIFRO_USER_ID = originalUser;
    window.CifroConnectivity = originalConnectivity;
    return output;
  });
  expect(messages[0]).toContain('Falha ao atualizar os dados');
  expect(messages.at(-1)).toContain('Service worker indisponível');
});
