import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function loadConnectivity(page) {
  await page.goto('/offline.php');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/src/js/cifro-connectivity.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }));
}

test('considera online somente resposta válida do servidor Cifrô', async ({ page }) => {
  await page.route('**/health.php?probe=*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', service: 'cifro', request_id: 'probe-e2e' }),
  }));
  await loadConnectivity(page);
  await expect.poll(() => page.evaluate(() => CifroConnectivity.current())).toBe('servidor_disponivel');
});

for (const scenario of [
  { name: 'erro 5xx', status: 503, contentType: 'application/json', body: '{"status":"not_ready"}' },
  { name: 'portal cativo', status: 200, contentType: 'text/html', body: '<html>Entre na rede Wi-Fi</html>' },
  { name: 'JSON de outro serviço', status: 200, contentType: 'application/json', body: '{"status":"ok","service":"outro","request_id":"x"}' },
]) {
  test(`considera offline quando recebe ${scenario.name}`, async ({ page }) => {
    await page.route('**/health.php?probe=*', route => route.fulfill(scenario));
    await loadConnectivity(page);
    await expect.poll(() => page.evaluate(() => CifroConnectivity.current())).toBe('servidor_indisponivel');
  });
}

