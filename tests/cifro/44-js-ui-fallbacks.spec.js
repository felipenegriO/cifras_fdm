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
  expect(result.speed).toBe('2');
  expect(result.label).toBe('2/5');
  expect(result.quick).toBe(false);
});

test('script fecha menus por clique externo e executa fallbacks globais', async ({ page }) => {
  await page.goto('/offline.php');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <button id="playlistButton"></button><button id="menuButton"></button>
      <aside id="sideMenu" style="right:0"></aside>
      <aside id="menusideMenu" style="right:0"></aside>
      <div id="toast"></div>`;
  });
  await load(page, '/src/js/script.js');
  const result = await page.evaluate(async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mostrarToast('Teste', '');
    const toastVisible = document.getElementById('toast').style.display;
    window.CifroConnectivity = { isServerAvailable: () => true };
    mostrarToast('Servidor indisponível — usando a versão local ⚠️', '#e74c3c');
    checarStatusConexao();
    const availableToast = document.getElementById('toast').style.display;
    window.CifroConnectivity = { isServerAvailable: () => false };
    checarStatusConexao();
    const unavailableToast = document.getElementById('toast').textContent;
    const menu = document.getElementById('menusideMenu').style.right;
    const side = document.getElementById('sideMenu').style.right;
    document.getElementById('toast').remove();
    mostrarToast('Sem elemento');
    const old = window.CifroChords;
    window.CifroChords = { transposeHtml: () => 'ok', identifyKey: () => null };
    const transposed = transporCifraHtml('', 1);
    const key = identificarTom('');
    window.CifroChords = old;
    return { toastVisible, availableToast, unavailableToast, menu, side, transposed, key };
  });
  expect(result).toMatchObject({
    toastVisible: 'block', availableToast: 'none', menu: '-100%', side: '-100%', transposed: 'ok', key: 'Tom não identificado',
  });
  expect(result.unavailableToast).toContain('Servidor indisponível');
});

test('offline-tools cobre falhas de sincronização, validação e service worker', async ({ page }) => {
  await page.goto('/offline.php');
  await load(page, '/src/js/offline-tools.js');
  const messages = await page.evaluate(async () => {
    const button = document.getElementById('prepareOfflineBtn');
    const output = [];
    const run = async sync => {
      window.cifroSync = sync;
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
      markPrepared: async () => false,
      getSyncStatus: async () => null,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ active: null, waiting: null }) },
    });
    await run({ sync: async () => true });
    return output;
  });
  expect(messages[0]).toContain('Falha ao atualizar os dados');
  expect(messages.at(-1)).toContain('Service worker indisponível');
});
