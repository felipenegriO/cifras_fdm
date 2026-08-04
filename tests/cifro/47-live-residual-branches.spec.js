import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function loadLive(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/src/js/live.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }));
}

test('live cobre sala padrão, modo offline e host sem identificador', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(() => {
    window.CIFRO_BAND_ID = '';
    document.body.insertAdjacentHTML('beforeend', `
      <button id="livePlay"></button><button id="entrarlivePlay"></button>
      <div id="liveStatus"></div><div id="mostrarbtnplay"><a id="entrarlivePlaynow"></a></div>`);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  });
  await loadLive(page);
  await page.evaluate(() => window.LiveMode.assumirHost());
  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    sessionStorage.setItem('cifroLiveMode_default', 'host');
    localStorage.removeItem('cifroLiveHostId_default');
    window.LiveMode.atualizarPaginaHost(false);
  });
  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');
  expect(await page.evaluate(() => sessionStorage.getItem('cifroLiveMode_default'))).toBeNull();
});

test('live cobre confirmação cancelada, erro sem JSON e falha de status', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(() => {
    window.CIFRO_BAND_ID = 'live-falhas';
    document.body.insertAdjacentHTML('beforeend', `
      <button id="livePlay"></button><button id="entrarlivePlay"></button>
      <div id="liveStatus"></div><div id="mostrarbtnplay"><a id="entrarlivePlaynow"></a></div>`);
    window.cifroConfirm = async () => false;
  });
  await loadLive(page);
  await page.locator('#livePlay').click();
  expect(await page.evaluate(() => sessionStorage.getItem('cifroLiveMode_live-falhas'))).toBeNull();

  await page.route('**/api/live/host.php', route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'erro' }), { times: 1 });
  await page.evaluate(() => { window.cifroConfirm = async () => true; });
  await page.locator('#livePlay').click();
  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');

  await page.route('**/api/live/status.php**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }), { times: 1 });
  await page.evaluate(() => window.LiveMode.consultarStatus());
  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');
});

test('live cobre sessão sem host, entrada e saída do modo seguidor', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(() => {
    window.CIFRO_BAND_ID = 'live-follow';
    document.body.insertAdjacentHTML('beforeend', `
      <button id="livePlay"></button><button id="entrarlivePlay"></button>
      <div id="liveStatus"></div><div id="mostrarbtnplay"><a id="entrarlivePlaynow"></a></div>`);
  });
  await page.route('**/api/live/status.php**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, hasHost: false, paginaAtual: '', hostNome: '' }),
  }));
  await loadLive(page);
  await page.locator('#entrarlivePlay').click();
  await expect(page.locator('#liveStatus')).toContainText('Aguardando host');
  await page.locator('#entrarlivePlay').click();
  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');
  await expect(page.locator('#mostrarbtnplay')).toHaveCSS('display', 'none');
});
